"""
obsidian_filter.py — チャットログの Obsidian 登録フィルタリングモジュール

ファイル名パターン・内容ベースでノイズを除外し、quality ラベルを付与する。
"""

from __future__ import annotations

import re
from pathlib import Path


# ─────────────────────────────────────────────
# デフォルト除外パターン
# ─────────────────────────────────────────────

DEFAULT_EXCLUDE_PATTERNS: list[str] = [
    "you-are-a-topic-and-tag-extraction-assistant",
    "say-ok-and-nothing-else",
    "command-message-claude-idd-framework",
    "command-message-deckrd-deckrd",
]

# User メッセージがシステム/コマンド専用と判断するプレフィックス
_SYSTEM_PREFIXES = (
    "<system-reminder",
    "<command-name",
    "<command-message",
    "<local-command-stdout",
    "<ide_opened_file",
    "<ide_selection",
    "---\n",   # YAML Front Matter のみ
)


# ─────────────────────────────────────────────
# ファイル名パターン除外
# ─────────────────────────────────────────────

def is_excluded_by_filename(filename: str, exclude_patterns: list[str]) -> bool:
    """ファイル名にノイズパターンが含まれるか判定する"""
    lower = filename.lower()
    return any(pat.lower() in lower for pat in exclude_patterns)


# ─────────────────────────────────────────────
# 会話解析ユーティリティ
# ─────────────────────────────────────────────

def _parse_conversation(body: str) -> list[dict]:
    """
    Markdown 本文から会話ターンを解析する。
    ### User / ### Assistant ヘッダーで区切られた形式を想定。
    返り値: [{"role": "user"|"assistant", "text": str}, ...]
    """
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


def _is_system_only_user_message(text: str) -> bool:
    """User メッセージがシステムタグ・コマンドタグのみで構成されているか判定"""
    stripped = text.strip()
    return any(stripped.startswith(prefix) for prefix in _SYSTEM_PREFIXES)


# ─────────────────────────────────────────────
# 内容ベースフィルタリング
# ─────────────────────────────────────────────

def is_excluded_by_content(
    body: str,
    min_char_count: int = 1000,
    min_assistant_chars: int = 300,
) -> tuple[bool, str]:
    """
    Markdown 本文（フロントマター除く）の内容でノイズかどうかを判定する。

    Returns:
        (excluded: bool, reason: str)
    """
    if len(body) < min_char_count:
        return True, f"本文が短すぎる ({len(body)} < {min_char_count} 文字)"

    turns = _parse_conversation(body)
    user_turns = [t for t in turns if t["role"] == "user"]
    assistant_turns = [t for t in turns if t["role"] == "assistant"]

    if not user_turns:
        return True, "Userターンが存在しない"

    if len(user_turns) == 1:
        user_text = user_turns[0]["text"]

        if _is_system_only_user_message(user_text):
            return True, "Userメッセージがシステム/コマンドタグのみ"

        total_assistant_chars = sum(len(t["text"]) for t in assistant_turns)
        if total_assistant_chars < min_assistant_chars:
            return True, (
                f"Assistantの応答が短すぎる "
                f"({total_assistant_chars} < {min_assistant_chars} 文字)"
            )

    return False, ""


# ─────────────────────────────────────────────
# quality ラベル
# ─────────────────────────────────────────────

def compute_quality_label(body: str) -> str:
    """
    本文の会話ターン数と文字数から quality ラベルを返す。

    Returns:
        "quality/high" | "quality/medium" | "quality/low"
    """
    turns = _parse_conversation(body)
    user_turns = [t for t in turns if t["role"] == "user"]
    total_chars = len(body)

    if len(user_turns) >= 5 and total_chars >= 5000:
        return "quality/high"
    if len(user_turns) >= 3 and total_chars >= 2000:
        return "quality/medium"
    return "quality/low"


# ─────────────────────────────────────────────
# プロジェクトフィルタ
# ─────────────────────────────────────────────

def is_project_included(
    project: str,
    include_projects: list[str],
    exclude_projects: list[str],
) -> bool:
    """プロジェクト名が処理対象かどうかを判定する"""
    if exclude_projects and project in exclude_projects:
        return False
    if include_projects and project not in include_projects:
        return False
    return True


# ─────────────────────────────────────────────
# 統合フィルタ
# ─────────────────────────────────────────────

def filter_file(
    md_path: Path,
    frontmatter: dict,
    body: str,
    exclude_patterns: list[str] = DEFAULT_EXCLUDE_PATTERNS,
    include_projects: list[str] | None = None,
    exclude_projects: list[str] | None = None,
    min_char_count: int = 1000,
    min_assistant_chars: int = 300,
) -> tuple[bool, str]:
    """
    1 ファイルを受け取り、登録対象かどうかを判定する。

    Returns:
        (should_include: bool, reason: str)
        should_include=False の場合、reason に除外理由が入る。
    """
    # ファイル名パターン
    if is_excluded_by_filename(md_path.name, exclude_patterns):
        return False, f"ファイル名パターン除外: {md_path.name}"

    # プロジェクトフィルタ
    project = frontmatter.get("project", "")
    if not is_project_included(
        project,
        include_projects or [],
        exclude_projects or [],
    ):
        return False, f"プロジェクト除外: {project}"

    # 内容ベース
    excluded, reason = is_excluded_by_content(
        body,
        min_char_count=min_char_count,
        min_assistant_chars=min_assistant_chars,
    )
    if excluded:
        return False, reason

    return True, ""
