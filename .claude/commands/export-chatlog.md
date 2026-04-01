---
name: export-log
description: >
  Claude Code セッション履歴をノイズ除外してMarkdownにエクスポートする。
  /export-log で呼び出す。
  システムログ・短文肯定応答（「y」「はい」「ok」等）・ツール使用記録を除外し、
  指定期間・プロジェクトの実質的な会話のみを chatlog/{YYYY-MM}/ に書き出す。
argument-hint: YYYY-MM [project]
allowed-tools: Bash, Read
---

# export-log スキル

Claude Code セッション履歴をノイズ除外して Markdown にエクスポートする。

## 引数の処理

`$ARGUMENTS` を解析し、以下のルールで引数を処理:

- 引数なし → 全期間・全プロジェクト
- `YYYY-MM` 形式（例: `2026-03`）→ **年月フィルタ**（その月のみ）
- `YYYY` 形式（4桁、例: `2026`）→ **年フィルタ**（その年全体）
- `YYYY-MM プロジェクト名`（例: `2026-03 sandbox`）→ **年月** + **プロジェクトフィルタ**
- `YYYY プロジェクト名`（例: `2026 sandbox`）→ **年** + **プロジェクトフィルタ**

## ステップ1: スクリプト実行

`$ARGUMENTS` を解析し、Bash で以下のように実行:

```bash
python scripts/export_log.py [period] [project] --output {cwd}/chatlog
```

### 引数からオプションを組み立てるルール

- 引数なし → `python {cwd}/scripts/export_log.py --output {cwd}/chatlog`
- `YYYY-MM` のみ → `python {cwd}/scripts/export_log.py 2026-03 --output {cwd}/chatlog`
- `YYYY` のみ → `python {cwd}/scripts/export_log.py 2026 --output {cwd}/chatlog`
- `YYYY-MM project` → `python {cwd}/scripts/export_log.py 2026-03 sandbox --output {cwd}/chatlog`
- `YYYY project` → `python {cwd}/scripts/export_log.py 2026 sandbox --output {cwd}/chatlog`

> 重要:
> スクリプトのパスは、コマンドが存在するパスを基準に検索する

スクリプトは以下を除外してエクスポート:

- システムログ（`isMeta: true` エントリ）
- ツール使用・ツール結果エントリ
- スラッシュコマンド（`/clear`、`/help`、`/reset`、`/exit`、`/quit`）
- システムタグで始まるメッセージ（`<system-reminder` 等）
- 短文肯定応答（20 文字以下で「y」「yes」「はい」「ok」「進めて」等）

## ステップ2: 結果通知

スクリプト完了後、`stderr` のサマリー行を読んでユーザーに結果を通知する。

通知形式:

- 書き出したファイル数と出力先ディレクトリ
- 書き出しが 0 件の場合は、その理由と確認方法を案内する

出力ディレクトリ構造:

```bash
chatlog/
  └── YYYY-MM/
       └── YYYY-MM-DD-{slug}-{sessionid8}.md
```
