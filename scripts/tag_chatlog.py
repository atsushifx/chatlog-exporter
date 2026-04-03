"""
tag_chatlog.py — チャットログMarkdownファイルへのメタデータ付与スクリプト

temp/chatlog/YYYY-MM/ 配下の各Markdownファイルのfrontmatterに
category / topics / tags フィールドを付与する。

使い方:
    python scripts/tag_chatlog.py                          # デフォルト (2026-03)
    python scripts/tag_chatlog.py --dir temp/chatlog/2026-03
    python scripts/tag_chatlog.py --dir temp/chatlog/2026-03/aplys
    python scripts/tag_chatlog.py --dry-run                # 実際の書き込みなし
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


# ─────────────────────────────────────────────
# プロジェクト別ベースマッピング
# ─────────────────────────────────────────────

PROJECT_CATEGORY: dict[str, str] = {
    "ci-platform": "infrastructure",
    "dev-tooling": "infrastructure",
    "sandbox-chatgpt": "conversation",
    "obsidian": "conversation",
    "deckrd": "development",
    "aplys": "development",
    "tests": "development",
    "sandbox-ailogs": "tooling",
    "voift": "development",
    "project-starter-template": "development",
}

PROJECT_TOPICS: dict[str, list[str]] = {
    "ci-platform": ["ci_cd", "automation", "configuration"],
    "dev-tooling": ["ci_cd", "automation", "configuration"],
    "sandbox-chatgpt": ["conversation", "documentation"],
    "obsidian": ["conversation", "documentation"],
    "deckrd": ["documentation", "ai-development", "workflow"],
    "aplys": ["cli", "scripting", "automation"],
    "tests": ["testing", "documentation", "ai-development"],
    "sandbox-ailogs": ["programming", "automation"],
    "voift": ["workflow", "documentation"],
    "project-starter-template": ["testing", "ci_cd"],
}

PROJECT_TAGS: dict[str, list[str]] = {
    "ci-platform": ["tool:github-actions", "infra:ci-cd", "workflow:git-workflow"],
    "dev-tooling": ["tool:github-actions", "infra:ci-cd", "tool:github-cli"],
    "sandbox-chatgpt": ["ai:chatgpt", "meta:conversation"],
    "obsidian": ["ai:claude", "meta:conversation"],
    "deckrd": ["ai:claude", "ai:prompt", "meta:planning"],
    "aplys": ["lang:bash", "tool:shellcheck", "workflow:cli-workflow"],
    "tests": ["ai:claude", "ai:prompt", "dev:testing"],
    "sandbox-ailogs": ["lang:typescript", "data:json-processing", "dev:automation"],
    "voift": ["workflow:pull-request", "workflow:idd", "doc:documentation"],
    "project-starter-template": ["tool:shellspec", "lang:bash", "dev:testing"],
}


# ─────────────────────────────────────────────
# キーワード → topics マッピング
# ─────────────────────────────────────────────

KEYWORD_TOPICS: list[tuple[list[str], str]] = [
    (["shellspec", "テスト", "test", "spec"], "testing"),
    (["github-actions", "ghalint", "actionlint", "ci-build", "workflow", "ci_cd"], "ci_cd"),
    (["shellcheck", "shfmt", "bash", "script", ".sh"], "scripting"),
    (["implement", "実装", "plan"], "programming"),
    (["debug", "error", "デバッグ", "修正", "fatal", "fix"], "debugging"),
    (["claude", "codex", "chatgpt", "gemini", "ai", "agent", "prompt", "llm", "mcp"], "ai-development"),
    (["config", "設定", "yaml", "yml", "configuration"], "configuration"),
    (["spec", "仕様", "ドキュメント", "docs", "documentation", "readme"], "documentation"),
    (["git", "commit", "branch", "pr-", "pull-request", "merge"], "git"),
    (["cli", "コマンド", "command", "runner"], "cli"),
    (["refactor", "リファクタ"], "refactoring"),
    (["release", "バージョン", "version", "changelog"], "release"),
    (["runner", "environment", "環境", "install", "setup"], "environment"),
    (["idd", "issue", "plan"], "workflow"),
]


# ─────────────────────────────────────────────
# キーワード → tags マッピング
# ─────────────────────────────────────────────

KEYWORD_TAGS: list[tuple[list[str], list[str]]] = [
    (["shellspec"], ["tool:shellspec", "dev:testing"]),
    (["shellcheck"], ["tool:shellcheck", "lang:bash"]),
    (["shfmt"], ["tool:shellcheck", "lang:bash"]),
    (["textlint"], ["tool:textlint", "lang:markdown"]),
    (["markdownlint"], ["tool:markdownlint", "lang:markdown"]),
    (["ghalint", "actionlint"], ["tool:github-actions", "infra:ci-cd"]),
    (["github-actions", "github_actions"], ["tool:github-actions", "infra:ci-cd"]),
    (["github-cli", "gh-cli", " gh "], ["tool:github-cli"]),
    (["pnpm"], ["tool:pnpm", "lang:javascript"]),
    (["codex"], ["ai:codex", "tool:codex-cli"]),
    (["claude"], ["ai:claude"]),
    (["chatgpt"], ["ai:chatgpt"]),
    (["gemini"], ["ai:agent"]),
    (["mcp"], ["ai:mcp"]),
    (["powershell", ".ps1"], ["lang:powershell", "os:windows"]),
    (["bash", ".sh", "shell"], ["lang:bash"]),
    (["typescript", ".ts"], ["lang:typescript"]),
    (["python", ".py"], ["lang:python"]),
    (["javascript", ".js"], ["lang:javascript"]),
    (["yaml", ".yml", ".yaml"], ["lang:yaml"]),
    (["json", ".json", "jsonl"], ["lang:json"]),
    (["markdown", ".md"], ["lang:markdown"]),
    (["debug", "debugging"], ["dev:debugging"]),
    (["refactor", "refactoring"], ["dev:refactoring"]),
    (["implement", "implementation"], ["meta:planning"]),
    (["pr-", "pull-request", "pullrequest"], ["workflow:pull-request"]),
    (["idd"], ["workflow:idd"]),
    (["agent", "workflow:agent"], ["ai:agent", "workflow:agent-workflow"]),
    (["ci-cd", "ci_cd", "github-actions"], ["infra:ci-cd"]),
    (["devops"], ["infra:devops"]),
    (["wsl"], ["os:wsl"]),
    (["windows"], ["os:windows"]),
    (["linux", "ubuntu", "debian"], ["os:linux"]),
    (["security", "vulnerability", "脆弱性"], ["infra:permission"]),
    (["validation", "validate"], ["dev:validation"]),
    (["error-handling", "exit-code"], ["dev:error-handling"]),
    (["unit-test", "unit test"], ["dev:unit-test"]),
    (["integration-test"], ["dev:integration-test"]),
    (["e2e", "end-to-end"], ["dev:e2e-test"]),
    (["configuration", "config"], ["dev:configuration"]),
    (["automation"], ["dev:automation"]),
    (["documentation", "docs", "readme"], ["doc:documentation"]),
    (["frontmatter", "front-matter"], ["doc:frontmatter"]),
    (["technical-writing"], ["doc:technical-writing"]),
    (["versioning", "semver"], ["meta:versioning"]),
    (["release"], ["meta:release"]),
    (["repository", "repo"], ["meta:repository"]),
    (["encoding", "unicode", "utf-8"], ["meta:encoding"]),
    (["localization", "locale", "i18n"], ["meta:localization"]),
]


# ─────────────────────────────────────────────
# Frontmatter パース / ダンプ
# ─────────────────────────────────────────────

def load_frontmatter(path: Path) -> tuple[dict, str]:
    """
    Markdownファイルを読み込んでfrontmatter辞書とbody文字列を返す。
    frontmatterが存在しない場合は空辞書とファイル全体をbodyとして返す。
    """
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}, text

    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text

    fm_text = text[4:end]
    body = text[end + 5:]  # "\n---\n" の5文字をスキップ

    meta: dict = {}
    for line in fm_text.splitlines():
        if ": " in line:
            key, _, value = line.partition(": ")
            meta[key.strip()] = value.strip()
        elif line.strip().endswith(":"):
            # リスト形式のキー（topics:, tags:）は後続行で処理
            pass

    # リスト形式（topics / tags）を再パース
    _parse_list_fields(fm_text, meta)

    return meta, body


def _parse_list_fields(fm_text: str, meta: dict) -> None:
    """topics: / tags: などのYAMLリストフィールドをパースしてmetaに格納する"""
    lines = fm_text.splitlines()
    current_key = None
    for line in lines:
        if re.match(r"^[a-z_]+:\s*$", line.strip()):
            current_key = line.strip().rstrip(":")
            meta[current_key] = []
        elif current_key and re.match(r"^\s+-\s+", line):
            value = re.sub(r"^\s+-\s+", "", line).strip()
            if isinstance(meta.get(current_key), list):
                meta[current_key].append(value)
        else:
            current_key = None


def dump_frontmatter(meta: dict, body: str) -> str:
    """frontmatter辞書とbodyをMarkdown文字列に結合して返す"""
    lines = ["---"]

    # 順序を固定: session_id, date, project, slug, title, category, topics, tags
    ordered_keys = ["session_id", "date", "project", "slug", "title", "category", "topics", "tags"]
    written = set()

    for key in ordered_keys:
        if key not in meta:
            continue
        value = meta[key]
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {item}")
        else:
            # titleにコロンや特殊文字が含まれる場合はクォートしない（既存形式に合わせる）
            lines.append(f"{key}: {value}")
        written.add(key)

    # 残りのキーも出力
    for key, value in meta.items():
        if key in written:
            continue
        if isinstance(value, list):
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {item}")
        else:
            lines.append(f"{key}: {value}")

    lines.append("---")
    lines.append("")
    return "\n".join(lines) + body


# ─────────────────────────────────────────────
# メタデータ判定
# ─────────────────────────────────────────────

def _search_text(keywords: list[str], *texts: str) -> bool:
    """任意のテキスト群にキーワードが含まれるか（大文字小文字無視）"""
    combined = " ".join(t.lower() for t in texts)
    return any(kw.lower() in combined for kw in keywords)


def determine_category(project: str, title: str, body_head: str) -> str:
    """project / title / body先頭からcategoryを1つ決定する"""
    # プロジェクト固定マッピングが最優先
    if project in PROJECT_CATEGORY:
        return PROJECT_CATEGORY[project]

    combined = f"{title} {body_head}".lower()

    if any(kw in combined for kw in ["ai", "claude", "chatgpt", "codex", "prompt", "agent", "llm", "mcp"]):
        return "ai"
    if any(kw in combined for kw in ["spec", "仕様", "設計", "アーキテクチャ", "ドキュメント"]):
        return "knowledge"
    if any(kw in combined for kw in ["ci", "deploy", "infrastructure", "devops"]):
        return "infrastructure"
    if any(kw in combined for kw in ["tool", "cli", "script", "bash"]):
        return "tooling"

    return "development"


def determine_topics(project: str, title: str, filename: str) -> list[str]:
    """project / title / filenameからtopicsリストを決定する"""
    topics: list[str] = []

    # プロジェクトベースのtopics
    base = PROJECT_TOPICS.get(project, ["programming"])
    topics.extend(base)

    # キーワードによる追加topics
    search_text = f"{title} {filename}".lower()
    for keywords, topic in KEYWORD_TOPICS:
        if topic not in topics and any(kw.lower() in search_text for kw in keywords):
            topics.append(topic)

    return _dedupe(topics)


def determine_tags(project: str, title: str, filename: str) -> list[str]:
    """project / title / filenameからtagsリストを決定する（重複除去）"""
    tags: list[str] = []

    # プロジェクトベースのtags
    base = PROJECT_TAGS.get(project, [])
    tags.extend(base)

    # キーワードによる追加tags
    search_text = f"{title} {filename}".lower()
    for keywords, tag_list in KEYWORD_TAGS:
        if any(kw.lower() in search_text for kw in keywords):
            for tag in tag_list:
                if tag not in tags:
                    tags.append(tag)

    return _dedupe(tags)


def _dedupe(items: list[str]) -> list[str]:
    """順序を保ちながら重複を除去する"""
    seen: set[str] = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


# ─────────────────────────────────────────────
# ファイル処理
# ─────────────────────────────────────────────

def tag_file(path: Path, dry_run: bool = False) -> bool:
    """
    1ファイルを処理してcategory/topics/tagsを付与する。
    変更が必要な場合は書き込み（dry_run=Trueの場合はスキップ）。
    変更ありでTrue、変更なし（すでに付与済み）でFalseを返す。
    """
    try:
        meta, body = load_frontmatter(path)
    except (OSError, UnicodeDecodeError) as e:
        print(f"警告: {path} の読み込みに失敗しました: {e}", file=sys.stderr)
        return False

    if not meta:
        return False

    # すでに全フィールドが付与済みならスキップ
    if "category" in meta and "topics" in meta and "tags" in meta:
        return False

    project = meta.get("project", "")
    title = meta.get("title", "")
    filename = path.name
    body_head = body[:500]

    category = determine_category(project, title, body_head)
    topics = determine_topics(project, title, filename)
    tags = determine_tags(project, title, filename)

    meta["category"] = category
    meta["topics"] = topics
    meta["tags"] = tags

    if not dry_run:
        content = dump_frontmatter(meta, body)
        path.write_text(content, encoding="utf-8")

    return True


# ─────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="チャットログMarkdownにcategory/topics/tagsを付与する"
    )
    parser.add_argument(
        "--dir",
        type=str,
        default="temp/chatlog/2026-03",
        help="対象ディレクトリ（デフォルト: temp/chatlog/2026-03）",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="ファイルを実際に書き換えず、処理内容のみ表示する",
    )
    args = parser.parse_args()

    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    target_dir = Path(args.dir)
    if not target_dir.exists():
        print(f"エラー: ディレクトリが見つかりません: {target_dir}", file=sys.stderr)
        sys.exit(1)

    md_files = sorted(target_dir.rglob("*.md"))
    print(f"対象ファイル数: {len(md_files)}", file=sys.stderr)
    if args.dry_run:
        print("dry-run モード: ファイルは書き換えません", file=sys.stderr)

    updated = 0
    skipped = 0

    for md_path in md_files:
        changed = tag_file(md_path, dry_run=args.dry_run)
        if changed:
            updated += 1
            if args.dry_run:
                print(f"[dry-run] {md_path}")
            else:
                print(str(md_path))
        else:
            skipped += 1

    print(
        f"\n完了: {updated} ファイルを更新しました（{skipped} 件スキップ）",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
