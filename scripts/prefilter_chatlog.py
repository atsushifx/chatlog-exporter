"""
prefilter_chatlog.py — チャットログの高速事前フィルタスクリプト

Claude API呼び出し前に、正規表現・テキストパターンで
明らかなノイズファイルを削除候補として絞り込む。

対象パターン:
  1. 機械的指示のみ  : "Implement the following plan:", "===== PROMPT =====", etc.
  2. システム生成ログ : "You are a topic and tag extraction assistant" など
  3. 作業専用ログ    : ファイル名ベースのパターン（command-message, say-ok 等）
  4. 指示だけの1ターン: User=1ターンかつ機械的な定型文

使い方:
    python scripts/prefilter_chatlog.py                        # temp/chatlog/ 全体
    python scripts/prefilter_chatlog.py 2026-03                # 指定月
    python scripts/prefilter_chatlog.py 2026-03 aplys          # 指定月・プロジェクト
    python scripts/prefilter_chatlog.py --dry-run              # 削除せず候補一覧のみ表示
    python scripts/prefilter_chatlog.py --report               # 削除せず理由つき一覧を stdout に出力
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


# ─────────────────────────────────────────────
# ノイズ判定パターン定義
# ─────────────────────────────────────────────

# 1. ファイル名に含まれていれば即除外
NOISE_FILENAME_PATTERNS: list[str] = [
    "you-are-a-topic-and-tag-extraction-assistant",
    "say-ok-and-nothing-else",
    "command-message-claude-idd-framework",
    "command-message-deckrd-deckrd",
    "command-message-deckrd-coder",
]

# 2. User本文の先頭が機械的指示パターン（前方一致）
NOISE_USER_PREFIXES: list[str] = [
    # deckrd impl 系
    "implement the following plan",
    "以下のプランを実装",
    # プロンプトテスト系
    "===== prompt =====",
    "you are a topic and tag extraction assistant",
    "you are a log curator",
    # スラッシュコマンド転写
    "/export-log",
    "/filter-chatlog",
    "/commit",
    "/idd",
    "/deckrd",
    "/clear",
    "/help",
    # Windowsパスのみ（例: C:\Users\... を貼り付けただけ）
]

# 3. User本文の全体がこのパターンに合致すれば除外（完全一致寄り）
NOISE_USER_EXACT_PATTERNS: list[re.Pattern] = [
    # "C:\..." のようなWindowsパスのみ（改行なし or 1行）
    re.compile(r"^[A-Za-z]:\\[^\n]{0,200}$"),
    # "docs/..." のようなUnixパスのみ
    re.compile(r"^(?:docs|temp|scripts|src|tests?)/[^\n]{0,200}$"),
]

# 4. タイトル（frontmatter title）がノイズパターン
NOISE_TITLE_PREFIXES: list[str] = [
    "implement the following plan",
    "===== prompt =====",
    "---",           # YAML汚染（titleがYAMLで始まる）
]

# 5. Userターンがシステムタグのみと判断するプレフィックス
_SYSTEM_TAG_PREFIXES: tuple[str, ...] = (
    "<system-reminder",
    "<command-name",
    "<command-message",
    "<local-command-stdout",
    "<ide_opened_file",
    "<ide_selection",
)


# ─────────────────────────────────────────────
# Frontmatter パーサー
# ─────────────────────────────────────────────

def load_frontmatter(path: Path) -> tuple[dict, str]:
    """ファイルを読んでfrontmatter辞書とbody文字列を返す"""
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---\n"):
        return {}, text

    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text

    fm_text = text[4:end]
    body = text[end + 5:]

    meta: dict = {}
    for line in fm_text.splitlines():
        if ": " in line and not line.startswith(" "):
            key, _, value = line.partition(": ")
            meta[key.strip()] = value.strip()

    return meta, body


# ─────────────────────────────────────────────
# 会話ターン解析
# ─────────────────────────────────────────────

def _parse_conversation(body: str) -> list[dict]:
    """### User / ### Assistant ヘッダーで会話ターンを解析する"""
    turns = []
    pattern = re.compile(r"^### (User|Assistant)\s*$", re.MULTILINE)
    matches = list(pattern.finditer(body))

    for i, m in enumerate(matches):
        role = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        text = body[start:end].strip()
        if text:
            turns.append({"role": role, "text": text})

    return turns


# ─────────────────────────────────────────────
# 個別判定ロジック
# ─────────────────────────────────────────────

def _check_filename(path: Path) -> str | None:
    """ファイル名がノイズパターンに一致すれば理由を返す"""
    name_lower = path.name.lower()
    for pat in NOISE_FILENAME_PATTERNS:
        if pat in name_lower:
            return f"ファイル名パターン: {pat}"
    return None


def _check_title(meta: dict) -> str | None:
    """frontmatter title がノイズパターンなら理由を返す"""
    title = meta.get("title", "").lower().strip()
    if not title:
        return None
    for pat in NOISE_TITLE_PREFIXES:
        if title.startswith(pat.lower()):
            return f"titleがノイズパターン: {pat!r}"
    return None


def _is_system_tag_only(text: str) -> bool:
    """テキストがシステムタグのみで構成されているか"""
    return text.startswith(_SYSTEM_TAG_PREFIXES)


def _check_user_content(turns: list[dict]) -> str | None:
    """
    Userターンの内容がノイズかどうかを判定する。
    ノイズなら理由文字列を返す。
    """
    user_turns = [t for t in turns if t["role"] == "user"]

    if not user_turns:
        return "Userターンが存在しない"

    # 全Userターンがシステムタグのみ
    if all(_is_system_tag_only(t["text"]) for t in user_turns):
        return "全UserターンがシステムTGのみ"

    # 1ターンのみの場合、内容を詳細チェック
    if len(user_turns) == 1:
        text = user_turns[0]["text"]
        text_lower = text.lower().strip()

        # 機械的指示プレフィックス
        for pat in NOISE_USER_PREFIXES:
            if text_lower.startswith(pat.lower()):
                return f"機械的指示: {pat!r}"

        # 完全一致パターン（Windowsパス等）
        for pattern in NOISE_USER_EXACT_PATTERNS:
            if pattern.match(text.strip()):
                return f"パスのみのUser本文"

        # システムタグ
        if _is_system_tag_only(text):
            return "UserがシステムTGのみ"

    return None


def _check_assistant_content(turns: list[dict], min_chars: int = 100) -> str | None:
    """
    Assistantの応答が短すぎる場合（実質作業ログのみ）に理由を返す。
    1ターンのUserに対してAssistantが短い応答のみの場合を対象とする。
    """
    user_turns = [t for t in turns if t["role"] == "user"]
    assistant_turns = [t for t in turns if t["role"] == "assistant"]

    if len(user_turns) == 1 and assistant_turns:
        total = sum(len(t["text"]) for t in assistant_turns)
        if total < min_chars:
            return f"Assistant応答が短すぎる ({total} < {min_chars} 文字)"

    return None


# ─────────────────────────────────────────────
# メイン判定関数
# ─────────────────────────────────────────────

def classify_file(path: Path) -> tuple[bool, str]:
    """
    ファイルがノイズかどうかを判定する。

    Returns:
        (is_noise: bool, reason: str)
    """
    # 1. ファイル名チェック（最速）
    reason = _check_filename(path)
    if reason:
        return True, reason

    # 2. frontmatter + body 読み込み
    try:
        meta, body = load_frontmatter(path)
    except Exception as e:
        return False, f"読み込みエラー: {e}"

    # 3. title チェック
    reason = _check_title(meta)
    if reason:
        return True, reason

    # 4. 会話ターン解析
    turns = _parse_conversation(body)

    # 5. User本文チェック
    reason = _check_user_content(turns)
    if reason:
        return True, reason

    # 6. Assistant応答の長さチェック（1ターンのみ対象）
    reason = _check_assistant_content(turns)
    if reason:
        return True, reason

    return False, ""


# ─────────────────────────────────────────────
# ファイル列挙
# ─────────────────────────────────────────────

def find_md_files(base_dir: Path, period: str | None, project: str | None) -> list[Path]:
    """temp/chatlog/ 配下の .md ファイルを列挙する"""
    if period and project:
        target = base_dir / period / project
        return sorted(target.glob("*.md")) if target.is_dir() else []
    elif period:
        target = base_dir / period
        return sorted(target.rglob("*.md")) if target.is_dir() else []
    else:
        return sorted(base_dir.rglob("*.md"))


# ─────────────────────────────────────────────
# エントリポイント
# ─────────────────────────────────────────────

def main() -> None:
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(
        description="チャットログの明らかなノイズファイルを事前フィルタで絞り込む"
    )
    parser.add_argument(
        "period",
        nargs="?",
        default=None,
        help="対象月（例: 2026-03）",
    )
    parser.add_argument(
        "project",
        nargs="?",
        default=None,
        help="プロジェクト名でフィルタ",
    )
    parser.add_argument(
        "--input",
        type=str,
        default="./temp/chatlog",
        help="入力ベースディレクトリ（デフォルト: ./temp/chatlog）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="削除せず候補ファイルのパスのみ表示する",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="削除せず理由つきの一覧を stdout に出力する（--dry-run より詳細）",
    )
    args = parser.parse_args()

    # --report は暗黙的に --dry-run を含む
    dry_run = args.dry_run or args.report

    base_dir = Path(args.input)
    if not base_dir.is_dir():
        print(f"エラー: 入力ディレクトリが見つかりません: {base_dir}", file=sys.stderr)
        sys.exit(1)

    md_files = find_md_files(base_dir, args.period, args.project)
    print(f"対象ファイル数: {len(md_files)}", file=sys.stderr)
    if dry_run:
        mode = "report" if args.report else "dry-run"
        print(f"{mode} モード: ファイルは削除しません", file=sys.stderr)

    counts = {"noise": 0, "keep": 0, "error": 0}

    for md_path in md_files:
        try:
            is_noise, reason = classify_file(md_path)
        except Exception as e:
            print(f"  error ({md_path.name}): {e}", file=sys.stderr)
            counts["error"] += 1
            continue

        if is_noise:
            counts["noise"] += 1
            if args.report:
                # 理由つきで stdout に出力
                print(f"NOISE\t{reason}\t{md_path}")
            elif dry_run:
                # パスのみ stdout に出力
                print(md_path)
            else:
                # 実際に削除
                try:
                    md_path.unlink()
                    print(f"deleted: {md_path}", file=sys.stderr)
                except PermissionError as e:
                    print(f"  削除失敗: {md_path.name}: {e}", file=sys.stderr)
                    counts["error"] += 1
                    counts["noise"] -= 1
        else:
            counts["keep"] += 1

    dry_suffix = f" ({('report' if args.report else 'dry-run')})" if dry_run else ""
    print(
        f"\n完了{dry_suffix}: noise={counts['noise']} keep={counts['keep']} error={counts['error']}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
