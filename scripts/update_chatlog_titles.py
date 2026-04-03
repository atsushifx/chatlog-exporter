"""
temp/chatlog/YYYY-MM 配下の Markdown ログに対して、機械的な title を再推定し、
summary フィールドをブロックスカラー形式で frontmatter に追加するスクリプト。

使い方:
    python scripts/update_chatlog_titles.py --dir temp/chatlog/2026-03
    python scripts/update_chatlog_titles.py --dir temp/chatlog/2026-03 --dry-run
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


MECHANICAL_TITLE_PATTERNS = [
    r"^implement the following plan\b",
    r"^docs\\",
    r"^[a-z]:\\",
    r'^"[a-z]:\\',      # 引用符付きWindowsパス（"C:\...）
    r"^c:\s*/",
    r"^c:\\",
    r"^\[error\]",
    r"^===== prompt =====",
    r"^#\s+",           # Markdownヘッダー形式（# Plan: ... 等）
    r"^/[a-z]",         # Unix絶対パス（/c/... や /usr/... 等）
    r"^[a-z][\w\-]+/",  # 相対パス（scripts/lib/... 等）
]


def split_frontmatter(text: str) -> tuple[dict[str, object], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    fm_text = text[4:end]
    body = text[end + 5:]

    meta: dict[str, object] = {}
    current_key: str | None = None
    block_scalar_key: str | None = None
    block_scalar_lines: list[str] = []

    lines = fm_text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]

        # ブロックスカラー（key: |）の開始
        m_block = re.match(r"^([a-zA-Z0-9_\-]+):\s*\|\s*$", line)
        if m_block:
            if block_scalar_key:
                meta[block_scalar_key] = "\n".join(block_scalar_lines)
            block_scalar_key = m_block.group(1)
            block_scalar_lines = []
            current_key = None
            i += 1
            continue

        # ブロックスカラーの継続行（インデントあり）
        if block_scalar_key is not None:
            if line.startswith("  ") or line.startswith("\t"):
                block_scalar_lines.append(line.lstrip())
                i += 1
                continue
            else:
                # ブロックスカラー終了
                meta[block_scalar_key] = "\n".join(block_scalar_lines)
                block_scalar_key = None
                block_scalar_lines = []

        # リストキー（key:）
        if re.match(r"^[a-zA-Z0-9_\-]+:\s*$", line):
            current_key = line[:-1].strip()
            meta[current_key] = []
            i += 1
            continue

        # リスト要素（  - value）
        if current_key and re.match(r"^\s+-\s+", line):
            assert isinstance(meta[current_key], list)
            meta[current_key].append(re.sub(r"^\s+-\s+", "", line).strip())
            i += 1
            continue

        # 通常のキー: 値
        current_key = None
        if ": " in line:
            key, _, value = line.partition(": ")
            key_stripped = key.strip()
            # キー部分が単純な識別子（英数字/アンダースコア/ハイフン）でなければ本文の混入とみなしてスキップ
            if re.match(r"^[a-zA-Z0-9_\-]+$", key_stripped):
                meta[key_stripped] = value.strip()
        # それ以外の行（本文の混入等）は無視してスキップ
        i += 1

    # 最後のブロックスカラーを確定
    if block_scalar_key:
        meta[block_scalar_key] = "\n".join(block_scalar_lines)

    return meta, body


def dump_frontmatter(meta: dict[str, object], body: str) -> str:
    order = ["session_id", "date", "project", "slug", "title", "summary", "category", "topics", "tags"]
    lines = ["---"]
    written: set[str] = set()

    for key in order:
        if key not in meta:
            continue
        value = meta[key]
        if key == "summary":
            lines.append("summary: |")
            for sub_line in str(value).splitlines():
                lines.append(f"  {sub_line}")
        elif isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {item}")
        else:
            lines.append(f"{key}: {value}")
        written.add(key)

    for key, value in meta.items():
        if key in written:
            continue
        if key == "summary":
            lines.append("summary: |")
            for sub_line in str(value).splitlines():
                lines.append(f"  {sub_line}")
        elif isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {item}")
        else:
            lines.append(f"{key}: {value}")

    lines.append("---")
    lines.append("")
    return "\n".join(lines) + body


def normalize_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("：", ":")
    return text


def find_body_h1(body: str) -> str:
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return ""


def find_user_text(body: str) -> str:
    m = re.search(r"^### User\s*$([\s\S]*?)(?=^### (?:Assistant|User)\s*$|\Z)", body, re.MULTILINE)
    return normalize_text(m.group(1)) if m else ""


def find_user_lines(body: str) -> list[str]:
    m = re.search(r"^### User\s*$([\s\S]*?)(?=^### (?:Assistant|User)\s*$|\Z)", body, re.MULTILINE)
    if not m:
        return []
    lines: list[str] = []
    for raw in m.group(1).splitlines():
        line = raw.strip()
        if not line:
            continue
        if line in {"```", "```yaml", "```text"}:
            continue
        if line.lower().startswith("implement the following plan"):
            continue
        if re.match(r"^=+\s*prompt\s*=+", line, re.I):
            continue
        if line.startswith("# "):
            line = line[2:].strip()
        # パス形式・機械的プレフィックスの除去
        line = re.sub(r'^"?[a-zA-Z]:\\[\w\\\.\-]+\s*', "", line)
        line = re.sub(r"^/[a-zA-Z]/[\w/\-\.]+\s*", "", line)
        line = line.lstrip('"\'「」')
        line = normalize_text(line)
        if not line:
            continue
        if line.lower().startswith("context"):
            line = f"Context: {line[7:].strip()}" if len(line) > 7 else "Context"
        lines.append(line)
    return lines


def infer_title(meta: dict[str, object], body: str) -> str:
    current = normalize_text(str(meta.get("title", "")))
    h1 = normalize_text(find_body_h1(body))
    user = find_user_text(body)

    if h1.lower().startswith("implement the following plan"):
        plan = re.search(r"^# Plan:\s*(.+)$", body, re.MULTILINE)
        if plan:
            return normalize_text(plan.group(1))

    if h1 and not any(re.match(pat, h1.lower()) for pat in MECHANICAL_TITLE_PATTERNS):
        return h1

    if current and not any(re.match(pat, current.lower()) for pat in MECHANICAL_TITLE_PATTERNS):
        return current

    source = user or h1 or current
    source = re.sub(r"^(implement the following plan:?\s*)", "", source, flags=re.I)
    source = re.sub(r"^#\s*plan:\s*", "", source, flags=re.I)
    source = re.sub(r"^#\s*issue:\s*", "", source, flags=re.I)
    source = re.sub(r"^=+\s*prompt\s*=+\s*", "", source, flags=re.I)
    source = re.sub(r"^#+\s*", "", source)
    source = re.sub(r'^"?[a-zA-Z]:\\[\w\\\.\-]+\s*', "", source)  # Windowsパスを除去
    source = re.sub(r"^/[a-zA-Z]/[\w/\-\.]+\s*", "", source)  # Unix形式Windowsパスを除去
    source = re.sub(r"^[a-zA-Z][\w\-]*/[\w/\-\.]+\s*", "", source)  # 相対パス形式を除去
    source = source.lstrip('"\'「」')  # 残った引用符を除去
    source = source.replace("```", "")
    # Markdownヘッダー（## ...）が残っている場合はその前で截断
    source = re.sub(r"\s*##.*$", "", source)
    source = normalize_text(source)

    if not source:
        return "会話ログ"

    if len(source) > 48:
        source = source[:48].rstrip(" ,，.。")
    return source


def _is_poor_summary(s: str) -> bool:
    """summaryが空か「詳細は本文参照」のみで構成されている場合にTrueを返す"""
    lines = [ln.strip() for ln in str(s).splitlines() if ln.strip()]
    return not lines or all("詳細は本文参照" in ln for ln in lines)


def infer_summary(body: str) -> str:
    user_lines = find_user_lines(body)

    # 最初のAssistantターン
    assistant_match = re.search(
        r"^### Assistant\s*$([\s\S]*?)(?=^### (?:Assistant|User)\s*$|\Z)",
        body,
        re.MULTILINE,
    )
    assistant_text = ""
    if assistant_match:
        raw = assistant_match.group(1)
        # コードブロックを除く
        raw = re.sub(r"```[\s\S]*?```", "", raw)
        assistant_text = normalize_text(raw)

    # 2番目のUser/Assistantターン（補足情報）
    second_text = ""
    turns = re.findall(
        r"^### (?:User|Assistant)\s*$([\s\S]*?)(?=^### (?:Assistant|User)\s*$|\Z)",
        body,
        re.MULTILINE,
    )
    if len(turns) >= 3:
        raw = turns[2]
        raw = re.sub(r"```[\s\S]*?```", "", raw)
        second_text = normalize_text(raw)

    parts: list[str] = []

    # 行1: 最初のUserターンの主要な意図
    if user_lines:
        line1 = user_lines[0]
        if len(line1) > 60:
            line1 = line1[:60].rstrip(" ,，.。")
        parts.append(line1 + "。" if not line1.endswith(("。", ".", "！", "？")) else line1)

    # 行2: 最初のAssistantの応答要点
    if assistant_text:
        line2 = assistant_text
        if len(line2) > 60:
            line2 = line2[:60].rstrip(" ,，.。")
        parts.append(line2 + "。" if not line2.endswith(("。", ".", "！", "？")) else line2)

    # 行3: 補足情報（2番目のUser/Assistantか、追加userターンから）
    if second_text and len(parts) >= 2:
        line3 = second_text
        if len(line3) > 60:
            line3 = line3[:60].rstrip(" ,，.。")
        parts.append(line3 + "。" if not line3.endswith(("。", ".", "！", "？")) else line3)
    elif len(user_lines) >= 2 and len(parts) < 3:
        line3 = user_lines[1]
        if len(line3) > 60:
            line3 = line3[:60].rstrip(" ,，.。")
        parts.append(line3 + "。" if not line3.endswith(("。", ".", "！", "？")) else line3)

    if not parts:
        return "内容を要約する情報が本文から十分に取れない。"

    return "\n".join(parts[:3])


def is_target(path: Path, title: str) -> bool:
    title_l = title.lower()
    if any(re.match(pat, title_l) for pat in MECHANICAL_TITLE_PATTERNS):
        return True
    if len(title) >= 90:
        return True
    return False


def _frontmatter_has_corruption(text: str) -> bool:
    """フロントマターに本文の混入など不正な行が含まれているか確認する"""
    if not text.startswith("---\n"):
        return False
    end = text.find("\n---\n", 4)
    if end == -1:
        return False
    fm_text = text[4:end]
    for line in fm_text.splitlines():
        # 空行、インデント行、リスト行、ブロックスカラー、通常のキー行はOK
        if not line.strip():
            continue
        if line.startswith("  ") or line.startswith("\t"):
            continue
        if re.match(r"^\s+-\s+", line):
            continue
        if re.match(r"^[a-zA-Z0-9_\-]+:\s*(\|.*)?$", line):
            continue
        if re.match(r"^[a-zA-Z0-9_\-]+:\s+\S", line):
            continue
        # それ以外は本文混入の疑い
        return True
    return False


def process_file(path: Path, dry_run: bool) -> bool:
    text = path.read_text(encoding="utf-8")
    meta, body = split_frontmatter(text)
    if not meta:
        return False

    old_title = normalize_text(str(meta.get("title", "")))
    new_title = infer_title(meta, body)
    new_summary = infer_summary(body)

    # フロントマター汚染の検出（強制再書き込み）
    has_corruption = _frontmatter_has_corruption(text)

    changed = has_corruption
    if is_target(path, old_title) and new_title and new_title != old_title:
        meta["title"] = new_title
        changed = True
    if _is_poor_summary(meta.get("summary", "")) or meta.get("summary") != new_summary:
        meta["summary"] = new_summary
        changed = True

    if changed and not dry_run:
        path.write_text(dump_frontmatter(meta, body), encoding="utf-8")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    files = sorted(args.dir.rglob("*.md"))
    changed = 0
    for path in files:
        if process_file(path, args.dry_run):
            changed += 1

    print(f"processed={len(files)} changed={changed} dry_run={args.dry_run}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
