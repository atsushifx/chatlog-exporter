#!/usr/bin/env python3
"""
Claude Code セッション Markdown エクスポートスクリプト（ノイズ除外版）

システムログ・短文肯定応答を除外し、指定年月のセッションを
chatlog/YYYY-MM/{project}/YYYY-MM-DD-{titleslug}-{sessionid8}.md 形式で書き出す。

使い方:
    python export_log.py                        # 全期間・全プロジェクト
    python export_log.py 2026-03                # 2026年3月
    python export_log.py 2026                   # 2026年全体
    python export_log.py 2026-03 prompt-review  # 年月 + プロジェクトフィルタ
    python export_log.py 2026 sandbox           # 年 + プロジェクトフィルタ
    python export_log.py --output ./temp/chatlog     # 出力先を指定
"""

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path


# ─────────────────────────────────────────────
# 短文肯定応答除外定数
# ─────────────────────────────────────────────

SKIP_EXACT = {
    "y", "yes", "はい", "うん", "ok", "sure", "yep", "yeah",
    "進めて", "やって", "do it", "doit", "go", "go ahead", "proceed",
    "それで", "それでいい", "それでお願いします", "お願いします", "いいよ", "いいです", "大丈夫",
    "ありがとう", "ありがとうございます", "thanks", "thx",
}
SHORT_AFFIRMATION_MAX_LEN = 20


# ─────────────────────────────────────────────
# ユーティリティ関数
# ─────────────────────────────────────────────

def get_claude_dir() -> Path:
    return Path.home() / ".claude"


def iso_to_ms(iso_str: str) -> int | None:
    """ISO 8601タイムスタンプをUnix epoch ミリ秒に変換"""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except (ValueError, AttributeError):
        return None


def iso_to_date(iso_str: str) -> str:
    """ISO 8601タイムスタンプを YYYY-MM-DD 形式に変換"""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return "unknown"


def sanitize_text(text: str) -> str:
    """サロゲート文字等のJSON非互換文字を除去する"""
    return text.encode("utf-8", errors="replace").decode("utf-8")


def extract_user_text(content) -> str:
    """message.content からユーザーテキストを抽出する（システムメッセージを除外）"""
    if isinstance(content, str):
        text = content.strip()
        # 文字列全体が local-command-stdout タグで囲まれている場合は除外
        if re.match(r"^<local-command-stdout\b", text):
            return ""
        return sanitize_text(text)
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text = item.get("text", "")
                if re.match(
                    r"^<(ide_opened_file|ide_selection|local-command-caveat"
                    r"|local-command-stdout|system-reminder)\b",
                    text,
                ):
                    continue
                if item.get("type") == "tool_result":
                    continue
                parts.append(text)
            elif isinstance(item, dict) and item.get("type") == "tool_result":
                continue
        return sanitize_text(" ".join(parts).strip())
    return ""


def extract_assistant_text(content) -> str:
    """assistant の content からテキスト部分のみを抽出（ツール使用は除外）"""
    if isinstance(content, str):
        return sanitize_text(content.strip())
    elif isinstance(content, list):
        parts = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text":
                parts.append(item.get("text", ""))
        return sanitize_text("\n".join(parts).strip())
    return ""


# ─────────────────────────────────────────────
# 期間パース
# ─────────────────────────────────────────────

def parse_period(period: str | None) -> tuple[datetime, datetime]:
    """
    (start_dt, end_dt) のタプルを返す。UTC基準。
    period=None のとき全期間を返す。
    """
    if period is None:
        return (
            datetime.min.replace(tzinfo=timezone.utc),
            datetime.max.replace(tzinfo=timezone.utc),
        )

    m_ym = re.match(r"^(\d{4})-(\d{1,2})$", period.strip())
    m_y = re.match(r"^(\d{4})$", period.strip())

    if m_ym:
        year = int(m_ym.group(1))
        month = int(m_ym.group(2))
        start_dt = datetime(year, month, 1, tzinfo=timezone.utc)
        next_month = month % 12 + 1
        next_year = year + (1 if month == 12 else 0)
        end_dt = datetime(next_year, next_month, 1, tzinfo=timezone.utc)
    elif m_y:
        year = int(m_y.group(1))
        start_dt = datetime(year, 1, 1, tzinfo=timezone.utc)
        end_dt = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        raise ValueError(f"期間の形式が不正です（例: 2026-03 または 2026）: {period}")

    return start_dt, end_dt


# ─────────────────────────────────────────────
# スラッグ生成
# ─────────────────────────────────────────────

def text_to_slug(text: str, fallback: str = "session") -> str:
    """テキストから YYYY-MM-DD-{slug}-{8char}.md 用のスラッグを生成する"""
    text = text.strip().split("\n\n")[0][:200]
    text = text.split("\n")[0].strip()

    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", errors="ignore").decode("ascii")

    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text)
    slug = slug.strip("-").lower()
    slug = re.sub(r"-{2,}", "-", slug)
    slug = slug[:50].rstrip("-")

    if len(slug) < 5:
        slug = fallback if fallback else "session"

    return slug


# ─────────────────────────────────────────────
# セッションファイル検索
# ─────────────────────────────────────────────

def is_subagent_file(path: Path) -> bool:
    """サブエージェントセッションファイルかどうかを判定"""
    return path.parent.name == "subagents"


def find_session_files(
    projects_dir: Path, project_filter: str | None
) -> list[Path]:
    """
    ~/.claude/projects/ 以下のセッション JSONL ファイルを列挙する。
    subagents/ 以下は除外。project_filter が指定された場合は部分一致フィルタ。
    """
    session_files = []
    if not projects_dir.exists():
        return session_files

    for project_dir in projects_dir.iterdir():
        if not project_dir.is_dir():
            continue

        if project_filter:
            dir_name = project_dir.name.lower()
            project_name = dir_name.rsplit("-", 1)[-1] if "-" in dir_name else dir_name
            if (
                project_filter.lower() not in project_name
                and project_filter.lower().replace(" ", "-") not in dir_name
            ):
                continue

        for jsonl_file in project_dir.rglob("*.jsonl"):
            if not jsonl_file.is_file():
                continue
            if is_subagent_file(jsonl_file):
                continue
            session_files.append(jsonl_file)

    return sorted(session_files, key=lambda p: p.stat().st_mtime)


# ─────────────────────────────────────────────
# セッションデータ読み込みと構造化
# ─────────────────────────────────────────────

def load_session_entries(session_file: Path) -> list[dict]:
    """JSONL ファイルを読み込んでエントリリストを返す"""
    entries = []
    try:
        with open(session_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    entries.append(entry)
                except json.JSONDecodeError:
                    continue
    except (OSError, UnicodeDecodeError):
        pass
    return entries


def filter_entries_by_period(
    entries: list[dict], start_dt: datetime, end_dt: datetime
) -> list[dict]:
    """タイムスタンプが [start_dt, end_dt) の範囲内のエントリのみを返す"""
    # 全期間指定の場合はそのまま返す
    if start_dt == datetime.min.replace(tzinfo=timezone.utc):
        return entries

    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)
    result = []
    for entry in entries:
        ts_str = entry.get("timestamp", "")
        ts_ms = iso_to_ms(ts_str) if ts_str else None
        if ts_ms is None:
            continue
        if start_ms <= ts_ms < end_ms:
            result.append(entry)
    return result


_SKIP_PATTERNS = ["/clear", "/help", "/reset", "/exit", "/quit"]

_NOISE_PATTERNS = [
    "<system-reminder",
    "<command-name",
    "<command-message",
    "[Request interrupted",
    "Tool loaded.",
    "Unknown skill:",
    "Say 'OK' and nothing else.",
]

# local-command-stdout の中身が短い場合に除外する閾値（文字数）
_LOCAL_COMMAND_STDOUT_MAX_LEN = 100


def _is_short_local_command_stdout(text: str) -> bool:
    """<local-command-stdout>...</local-command-stdout> のみで中身が短いテキストか判定"""
    m = re.fullmatch(
        r"<local-command-stdout>(.*?)</local-command-stdout>", text, re.DOTALL
    )
    if m:
        inner = m.group(1).strip()
        return len(inner) < _LOCAL_COMMAND_STDOUT_MAX_LEN
    return False


def is_meaningful_user_entry(entry: dict) -> bool:
    """意味のあるユーザーエントリかどうかを判定（短文肯定応答も除外）"""
    if entry.get("type") != "user":
        return False
    if entry.get("isMeta"):
        return False
    message = entry.get("message", {})
    content = message.get("content", "")
    text = extract_user_text(content)
    if not text:
        return False
    if any(text.startswith(p) for p in _SKIP_PATTERNS):
        return False
    if any(text.startswith(p) for p in _NOISE_PATTERNS):
        return False
    # 短い local-command-stdout のみのメッセージを除外
    if _is_short_local_command_stdout(text):
        return False
    # 短文肯定応答を除外
    if len(text) <= SHORT_AFFIRMATION_MAX_LEN and text.strip().lower() in SKIP_EXACT:
        return False
    return True


def build_session_metadata(
    entries: list[dict], project_dir_name: str
) -> dict | None:
    """
    エントリリストからセッションのメタデータを生成する。
    意味あるユーザーメッセージがなければ None を返す。
    """
    first_user_entry = None
    for entry in entries:
        if is_meaningful_user_entry(entry):
            first_user_entry = entry
            break

    if first_user_entry is None:
        return None

    session_id = first_user_entry.get("sessionId", "unknown")
    timestamp_str = first_user_entry.get("timestamp", "")
    date = iso_to_date(timestamp_str)

    auto_slug = first_user_entry.get("slug", "")

    cwd = first_user_entry.get("cwd", "")
    if cwd:
        project = Path(cwd).name
    else:
        parts = project_dir_name.rsplit("-", 1)
        project = parts[-1] if len(parts) > 1 else project_dir_name

    message = first_user_entry.get("message", {})
    content = message.get("content", "")
    first_user_text = extract_user_text(content)

    return {
        "session_id": session_id,
        "date": date,
        "project": project,
        "slug": auto_slug,
        "first_user_text": first_user_text,
        "title": first_user_text[:100],
    }


def extract_conversation(entries: list[dict]) -> list[dict]:
    """
    エントリリストから会話ターンを抽出する。
    同一 message.id の連続する assistant エントリはテキストを結合する。
    """
    conversation = []
    last_assistant_msg_id = None
    last_assistant_idx = -1

    for entry in entries:
        entry_type = entry.get("type")

        if entry_type == "user":
            if not is_meaningful_user_entry(entry):
                continue
            message = entry.get("message", {})
            content = message.get("content", "")
            text = extract_user_text(content)
            if text:
                conversation.append({"role": "user", "text": text})
                last_assistant_msg_id = None

        elif entry_type == "assistant":
            if entry.get("isMeta"):
                continue
            message = entry.get("message", {})
            msg_id = message.get("id", "")
            content = message.get("content", [])
            text = extract_assistant_text(content)
            if not text:
                continue

            if msg_id and msg_id == last_assistant_msg_id and last_assistant_idx >= 0:
                conversation[last_assistant_idx]["text"] += text
            else:
                conversation.append({"role": "assistant", "text": text})
                last_assistant_idx = len(conversation) - 1
                last_assistant_msg_id = msg_id

    return conversation


# ─────────────────────────────────────────────
# ファイル名・パス・Markdown 生成
# ─────────────────────────────────────────────

def build_filename(metadata: dict) -> str:
    """YYYY-MM-DD-{titleslug}-{sessionid8}.md 形式のファイル名を生成する"""
    date = metadata["date"]
    session_id = metadata["session_id"]
    session_id_8 = session_id.replace("-", "")[:8]
    auto_slug = metadata.get("slug", "session")

    title_slug = text_to_slug(metadata["first_user_text"], fallback=auto_slug)
    return f"{date}-{title_slug}-{session_id_8}.md"


def build_output_path(output_base: Path, metadata: dict) -> Path:
    """
    output_base/YYYY-MM/{project}/YYYY-MM-DD-{slug}-{sessionid8}.md を返す。
    """
    year_month = metadata["date"][:7]  # "2026-03"
    project = metadata["project"]
    filename = build_filename(metadata)
    return output_base / year_month / project / filename


def render_markdown(metadata: dict, conversation: list[dict]) -> str:
    """Frontmatter + 会話ログを含む Markdown 文字列を生成する"""
    lines = []

    lines.append("---")
    lines.append(f"session_id: {metadata['session_id']}")
    lines.append(f"date: {metadata['date']}")
    lines.append(f"project: {metadata['project']}")
    if metadata.get("slug"):
        lines.append(f"slug: {metadata['slug']}")
    lines.append("---")
    lines.append("")

    title = metadata["title"].replace("\n", " ").strip()
    lines.append(f"# {title}")
    lines.append("")

    lines.append("## 会話ログ")
    lines.append("")

    for turn in conversation:
        role_label = "User" if turn["role"] == "user" else "Assistant"
        lines.append(f"### {role_label}")
        lines.append("")
        lines.append(turn["text"].strip())
        lines.append("")

    return "\n".join(lines)


# ─────────────────────────────────────────────
# セッションエクスポート
# ─────────────────────────────────────────────

def export_session(
    session_file: Path,
    start_dt: datetime,
    end_dt: datetime,
    output_base: Path,
    project_filter: str | None,
) -> Path | None:
    """
    1 セッション JSONL ファイルを処理して Markdown ファイルを書き出す。
    書き出し成功で出力ファイルパスを返し、スキップで None を返す。
    """
    entries = load_session_entries(session_file)
    if not entries:
        return None

    filtered = filter_entries_by_period(entries, start_dt, end_dt)
    if not filtered:
        return None

    project_dir_name = session_file.parent.name
    metadata = build_session_metadata(filtered, project_dir_name)
    if metadata is None:
        return None

    conversation = extract_conversation(filtered)
    if not conversation:
        return None

    out_path = build_output_path(output_base, metadata)
    content = render_markdown(metadata, conversation)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(content, encoding="utf-8")
    return out_path


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Claude Code セッションをノイズ除外してMarkdownにエクスポートする"
    )
    parser.add_argument(
        "period", nargs="?", default=None,
        help="期間フィルタ（例: 2026-03 または 2026）。省略時は全期間"
    )
    parser.add_argument(
        "project", nargs="?", default=None,
        help="プロジェクト名でフィルタ（部分一致）"
    )
    parser.add_argument(
        "--output", type=str, default="./temp/chatlog",
        help="出力ベースディレクトリ（デフォルト: ./temp/chatlog）"
    )
    args = parser.parse_args()

    # Windows環境でのUTF-8出力を保証
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    try:
        start_dt, end_dt = parse_period(args.period)
    except ValueError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)

    if args.period:
        print(
            f"対象期間: {start_dt.strftime('%Y-%m-%d')} 〜 {end_dt.strftime('%Y-%m-%d')}",
            file=sys.stderr,
        )
    else:
        print("対象期間: 全期間", file=sys.stderr)

    if args.project:
        print(f"プロジェクトフィルタ: {args.project}", file=sys.stderr)

    output_base = Path(args.output)
    projects_dir = get_claude_dir() / "projects"

    session_files = find_session_files(projects_dir, args.project)
    print(f"セッションファイル数: {len(session_files)}", file=sys.stderr)

    exported = 0
    skipped = 0
    for session_file in session_files:
        try:
            out_path = export_session(session_file, start_dt, end_dt, output_base, args.project)
            if out_path:
                exported += 1
                print(str(out_path))
            else:
                skipped += 1
        except Exception as e:
            print(f"警告: {session_file} の処理中にエラーが発生しました: {e}", file=sys.stderr)
            skipped += 1

    print(
        f"\n完了: {exported} ファイルを {output_base} に書き出しました（{skipped} 件スキップ）",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
