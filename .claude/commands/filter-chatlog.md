---
name: filter-chatlog
description: >
  エクスポート済みチャットログMarkdownをclaude CLIで一括バッチ判定し、
  再利用価値の低いファイル（DISCARD）を削除する。
  /filter-chatlog で呼び出す。
  KEEP/DISCARD判定にはclaude CLIを使用するため ANTHROPIC_API_KEY 不要。
argument-hint: "[YYYY-MM [project]] [--dry-run]"
allowed-tools: Bash, Glob
---

<!-- cspell:words aplys -->

# filter-chatlog スキル

エクスポート済みチャットログをclaude CLIで品質判定してフィルタリングする。
複数ファイルをチャンク単位（10件）でバッチ判定し、低価値ファイルを削除する。

## 前提条件

- `claude` コマンドがPATHに存在すること（Claude Code CLIインストール済み）
- `deno` コマンドが利用可能であること（TypeScript実行用）

## 引数の処理

`$ARGUMENTS` を解析し、以下のルールで引数を処理:

- 引数なし → `temp/chatlog/` 全体を処理
- `YYYY-MM`（例: `2026-03`）→ 指定月のみ
- `YYYY-MM project`（例: `2026-03 aplys`）→ 指定月・プロジェクトのみ
- `--dry-run` → 削除せず判定結果のみ表示

## ステップ1: スクリプトパスの解決

Glob ツールで `**/commands/filter-chatlog.md` を検索し、そのディレクトリを `SKILL_DIR` として確定する。

```bash
SKILL_DIR   = <filter-chatlog.md が存在するディレクトリの絶対パス>
SCRIPT_PATH = $SKILL_DIR/scripts/filter_chatlog.ts
INPUT       = <cwd>/temp/chatlog
```

## ステップ2: スクリプト実行

解決した `SCRIPT_PATH` と `INPUT` を使い、Bash で実行する:

```bash
deno run --allow-read --allow-run "$SCRIPT_PATH" [period] [project] [--dry-run] --input "$INPUT"
```

### 引数からオプションを組み立てるルール

- 引数なし → `deno run --allow-read --allow-run "$SCRIPT_PATH" --input "$INPUT"`
- `YYYY-MM` のみ → `deno run --allow-read --allow-run "$SCRIPT_PATH" 2026-03 --input "$INPUT"`
- `YYYY-MM project` → `deno run --allow-read --allow-run "$SCRIPT_PATH" 2026-03 aplys --input "$INPUT"`
- `--dry-run` を含む → 末尾に `--dry-run` を追加

スクリプトは以下の基準でKEEP/DISCARDを判定し、DISCARDかつ confidence >= 0.7 のファイルを削除する:

- **KEEP**: 設計判断・アーキテクチャ議論・再利用可能なパターン・新概念を含む
- **DISCARD**: 実行ステータスのみ・再利用不可・文脈依存で汎用性なし

## ステップ3: 結果通知

スクリプト完了後、`stderr` のサマリー行を読んでユーザーに結果を通知する。

通知形式:

- kept / discarded / skipped / error の件数を報告
- dry-run モードの場合はその旨を明示する
- DISCARDされたファイルのパスと理由を簡潔にまとめる
