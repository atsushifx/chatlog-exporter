---
title: "Implementation Plan: chatlog/normalize"
Based on: specifications.md v1.0
Status: Draft
---

<!-- textlint-disable
  ja-technical-writing/sentence-length,
  ja-technical-writing/max-comma,    -->
<!-- markdownlint-disable line-length -->

## 1. Overview

### 1.1 Purpose

チャットログ（Markdown 形式）を Claude CLI で解析し、問題領域ごとのセグメントに分割して
正規化された個別 Markdown ファイルとして出力するモジュール `chatlog/normalize` を実装する。

既存の `classify_chatlog.ts` / `filter_chatlog.ts` / `set_frontmatter.ts` と同様の
構造（CLI オプション解析 → AI 処理 → ファイル出力）を踏襲し、
`temp/normalize_logs/<agent>/<year>/<year-month>/<project>/` 配下に出力する。

### 1.2 Reference

- Prior Art / Reference PR: 既存スクリプト `.claude/commands/scripts/classify_chatlog.ts`、`filter_chatlog.ts`、`set_frontmatter.ts`
- Specifications: `specifications.md v1.0`

---

## 2. Implementation Plan

### Phase 1: 基盤ユーティリティ

#### Commit 1: feat(normalize): add utility functions

- `withConcurrency<T>` — 並列実行コントロール（既存の filter_chatlog.ts パターンを移植）
- `runClaude(systemPrompt, userPrompt)` — Claude CLI 呼び出しラッパー（`claude -p`）
- `cleanYaml(raw, firstField)` — コードフェンス除去＋先頭トリム
- `parseFrontmatter(text)` — full variant: `{ meta: Record<string,string>; fullBody: string }` を返す
- `generateLogId(filePath, agentName, title, index)` — `<年月日>-<agent>-<title-slug>-<hash7>` 形式。hash7 は filePath + index の SHA-256 先頭 7 文字

#### Commit 2: feat(normalize): add file collection and CLI args

- `collectMdFiles(dir, results)` / `findMdFiles(dir)` — 再帰的 MD ファイル収集（既存の set_frontmatter.ts パターン）
- `resolveInputDir(args)` — `--dir` XOR `--agent`/`--year-month` から対象ディレクトリを解決し、パス不在時は `Deno.exit(1)` する（R-003）
- `parseArgs(args)` — `--dir`, `--agent`, `--year-month`, `--dry-run`, `--concurrency`, `--output` を解析

### Phase 2: コア処理

#### Commit 3: feat(normalize): add segmentChatlog

- `segmentChatlog(filePath, content)` — 1 ファイル 1 Claude CLI 呼び出しで JSON 配列を取得（REQ-NF-001）
- システムプロンプトに「問題領域（ドメイン）単位で分割し `[{title, summary, body}]` の JSON を返す」と指示
- `parseJsonArray(raw)` — 3-pass フォールバック（直接パース → 非貪欲マッチ → 貪欲マッチ）
- 最大 10 件制限（R-012）: `segments.slice(0, 10)` で超過分を破棄
- 失敗時は `null` を返し、呼び出し元がスキップしてカウント++（R-008）

#### Commit 4: feat(normalize): add generateSegmentFile + attachFrontmatter

- `generateSegmentFile(segment)` — `## Summary\n<summary>\n\n## Excerpt\n<body>` の MD 文字列を返す
- `attachFrontmatter(content, sourceMeta, segmentMeta)` — 元フロントマターの `project`/`date` 等を引き継ぎ、`title`/`log_id`/`summary` を AI 生成値で付加してフロントマターを合成する（R-007）
- 元フロントマターなしときは AI 生成フィールドのみ付加（Edge Case）

### Phase 3: 統合 + CLI エントリーポイント

#### Commit 5: feat(normalize): integrate normalize_chatlog.ts

- `writeOutput(outputPath, content, dryRun, stats)` — 出力先ファイルが既存なら `stats.skip++` してスキップ（R-011）; そうでなければ atomic write（tmpfile → rename）
- `reportResults(stats)` —「成功: N 件 / スキップ: N 件 / 失敗: N 件」を stdout 出力（R-009）
- `main()` — Phase 1→2→3 を統合。`withConcurrency` でファイル単位並列実行（デフォルト concurrency=4）
- Deno 権限: `--allow-read --allow-write --allow-run`
- `assets/prompts/normalize.yaml` にセグメント抽出用プロンプトテンプレートを追加（system/user テンプレート）

---

## 3. Change History

| Date       | Version | Description                 |
| ---------- | ------- | --------------------------- |
| 2026-04-05 | 1.0     | Initial implementation plan |
