---
title: "Implementation Tasks"
module: chatlog/normalize
status: Active
created: 2026-04-05 00:00:00
source: specifications.md
---

<!-- textlint-disable
  ja-technical-writing/sentence-length, -->
<!-- markdownlint-disable line-length no-duplicate-heading -->

## Task Summary

| Test Target                        | Scenarios | Cases | Status  |
| ---------------------------------- | --------- | ----- | ------- |
| T-01: withConcurrency              | 2         | 4     | Done    |
| T-02: runClaude                    | 3         | 5     | Done    |
| T-03: cleanYaml                    | 2         | 4     | Done    |
| T-04: parseFrontmatter             | 3         | 5     | Done    |
| T-05: generateLogId                | 2         | 4     | Done    |
| T-06: collectMdFiles / findMdFiles | 3         | 5     | Done    |
| T-07: resolveInputDir              | 4         | 7     | Done    |
| T-08: parseArgs                    | 2         | 5     | Done    |
| T-09: segmentChatlog               | 3         | 5     | Done    |
| T-10: parseJsonArray               | 3         | 5     | Pending |
| T-11: generateSegmentFile          | 2         | 3     | Pending |
| T-12: attachFrontmatter            | 3         | 5     | Pending |
| T-13: writeOutput                  | 3         | 5     | Pending |
| T-14: reportResults                | 2         | 4     | Pending |
| T-15: main (integration)           | 4         | 8     | Pending |

---

## T-01: withConcurrency

### [正常] Normal Cases

#### T-01-01: 並列実行の基本動作

- [x] **T-01-01-01**: 並列数以内のタスク数で全タスクが完了する
  - Target: `withConcurrency<T>`
  - Scenario: Given 4つの非同期タスクと並列数 4、When `withConcurrency` を呼び出す
  - Expected: Then 全 4 件の結果が入力順に返される

- [x] **T-01-01-02**: タスク完了順に関わらず結果がインデックス順に返る
  - Target: `withConcurrency<T>`
  - Scenario: Given 遅延時間の異なる 6 タスクと並列数 2、When `withConcurrency` を呼び出す
  - Expected: Then 返却配列のインデックスが入力タスクのインデックスと一致する

### [エッジケース] Edge Cases

#### T-01-02: 境界値・空入力

- [x] **T-01-02-01**: 空タスク配列で空配列が返る
  - Target: `withConcurrency<T>`
  - Scenario: Given 空のタスク配列と並列数 4、When `withConcurrency` を呼び出す
  - Expected: Then エラーなく空配列が返される

- [x] **T-01-02-02**: 並列数がタスク数より大きい場合も全タスクが処理される
  - Target: `withConcurrency<T>`
  - Scenario: Given 2 タスクと並列数 10、When `withConcurrency` を呼び出す
  - Expected: Then 両タスクが完了し、結果が返される

---

## T-02: runClaude

### [正常] Normal Cases

#### T-02-01: Claude CLI の正常呼び出し

- [x] **T-02-01-01**: 正常終了時に stdout テキストを返す
  - Target: `runClaude(systemPrompt, userPrompt)`
  - Scenario: Given 有効なシステムプロンプトとユーザープロンプト、When Claude CLI が exit code 0 で終了する
  - Expected: Then デコードされた stdout 文字列が返される

- [x] **T-02-01-02**: システムプロンプトが `-p` 引数として渡される
  - Target: `runClaude(systemPrompt, userPrompt)`
  - Scenario: Given システムプロンプト文字列、When `runClaude` を呼び出す
  - Expected: Then Claude CLI が `['-p', systemPrompt, '--output-format', 'text']` 形式の引数で起動される

### [異常] Error Cases

#### T-02-02: Claude CLI 失敗時の処理

- [x] **T-02-02-01**: 非ゼロ exit code でエラーをスローする
  - Target: `runClaude(systemPrompt, userPrompt)`
  - Scenario: Given Claude CLI が exit code 1 を返す、When `runClaude` を呼び出す
  - Expected: Then exit code を含むメッセージの Error がスローされる

- [x] **T-02-02-02**: プロセス起動失敗時にエラーが伝播する
  - Target: `runClaude(systemPrompt, userPrompt)`
  - Scenario: Given `claude` コマンドが存在しない、When `runClaude` を呼び出す
  - Expected: Then エラーがスローされ呼び出し元に伝播する

### [エッジケース] Edge Cases

#### T-02-03: 出力のトリミング

- [x] **T-02-03-01**: 前後の空白を除去した文字列を返す
  - Target: `runClaude(systemPrompt, userPrompt)`
  - Scenario: Given Claude CLI の stdout に先頭・末尾の空白が含まれる、When `runClaude` を呼び出す
  - Expected: Then 返却文字列の先頭・末尾の空白が除去されている

---

## T-03: cleanYaml

### [正常] Normal Cases

#### T-03-01: コードフェンスの除去

- [x] **T-03-01-01**: 開始・終了のコードフェンス行を除去する
  - Target: `cleanYaml(raw, firstField)`
  - Scenario: Given `` ```yaml `` と `` ``` `` のフェンス行を含む文字列、When `cleanYaml('title')` を呼び出す
  - Expected: Then フェンス行が除去され、YAML コンテンツが残る

- [x] **T-03-01-02**: firstField の手前の非 YAML 行を除去する
  - Target: `cleanYaml(raw, firstField)`
  - Scenario: Given `title:` フィールドの前に説明テキストを含む文字列、When `cleanYaml('title')` を呼び出す
  - Expected: Then `title:` 行より前がすべて除去される

### [エッジケース] Edge Cases

#### T-03-02: クリーンな入力・空入力

- [x] **T-03-02-01**: フェンスなしの YAML をトリムして返す
  - Target: `cleanYaml(raw, firstField)`
  - Scenario: Given `title:` から始まるクリーンな YAML 文字列、When `cleanYaml` を呼び出す
  - Expected: Then トリムされた文字列が返され YAML コンテンツは変更されない

- [x] **T-03-02-02**: 空文字列入力でエラーをスローしない
  - Target: `cleanYaml(raw, firstField)`
  - Scenario: Given `raw` が空文字列、When `cleanYaml` を呼び出す
  - Expected: Then スローされずに空または空白のみの文字列が返される

---

## T-04: parseFrontmatter

### [正常] Normal Cases

#### T-04-01: フロントマターありのファイル

- [x] **T-04-01-01**: フロントマターブロックからキーバリューペアを抽出する
  - Target: `parseFrontmatter(text)`
  - Scenario: Given `---\nproject: ci-platform\ndate: 2026-03-01\n---` で始まる Markdown テキスト、When `parseFrontmatter` を呼び出す
  - Expected: Then `meta` に `project` と `date` フィールドが含まれる

- [x] **T-04-01-02**: 閉じデリミタ以降のボディテキストを返す
  - Target: `parseFrontmatter(text)`
  - Scenario: Given フロントマターに続くボディコンテンツを持つ Markdown テキスト、When `parseFrontmatter` を呼び出す
  - Expected: Then `fullBody` に閉じ `---` 以降のテキスト全体が含まれる

### [エッジケース] Edge Cases

#### T-04-02: フロントマターなしのファイル

- [x] **T-04-02-01**: フロントマターデリミタなしときに空の meta を返す
  - Target: `parseFrontmatter(text)`
  - Scenario: Given `---` で始まらない Markdown テキスト、When `parseFrontmatter` を呼び出す
  - Expected: Then `meta` が空のレコードである

- [x] **T-04-02-02**: フロントマターなしときにテキスト全体を fullBody として返す
  - Target: `parseFrontmatter(text)`
  - Scenario: Given フロントマターのない Markdown テキスト、When `parseFrontmatter` を呼び出す
  - Expected: Then `fullBody` が元のテキスト全体と等しい

#### T-04-03: 不正なフロントマター

- [x] **T-04-03-01**: 閉じデリミタ欠落時に空の meta とフルテキストの fullBody を返す
  - Target: `parseFrontmatter(text)`
  - Scenario: Given `---` で始まるが閉じ `---` がない Markdown テキスト、When `parseFrontmatter` を呼び出す
  - Expected: Then `meta` が空で `fullBody` が元のテキスト全体を含む

---

## T-05: generateLogId

### [正常] Normal Cases

#### T-05-01: 標準的な log_id 生成

- [x] **T-05-01-01**: `<date>-<agent>-<title-slug>-<hash7>` 形式の ID を返す
  - Target: `generateLogId(filePath, agentName, title, index)`
  - Scenario: Given filePath `temp/chatlog/claude/2026/2026-03/test.md`、agentName `claude`、title `CI/CD Pipeline Fix`、index `0`、When `generateLogId` を呼び出す
  - Expected: Then 結果が `^\d{8}-claude-[a-z0-9-]+-[0-9a-f]{7}$` パターンに一致する

- [x] **T-05-01-02**: タイトルスラッグが小文字ハイフン区切りになる
  - Target: `generateLogId(filePath, agentName, title, index)`
  - Scenario: Given title `Deno/TypeScript Setup & Config`、When `generateLogId` を呼び出す
  - Expected: Then スラッグ部分が小文字英数字とハイフンのみで構成される

### [エッジケース] Edge Cases

#### T-05-02: ハッシュの安定性とインデックス差別化

- [x] **T-05-02-01**: index が異なれば hash7 が異なる
  - Target: `generateLogId(filePath, agentName, title, index)`
  - Scenario: Given 同一の filePath・title で index=0 と index=1、When それぞれ `generateLogId` を呼び出す
  - Expected: Then 2つの結果の hash7 部分が異なる

- [x] **T-05-02-02**: 同一入力は常に同一の log_id を返す（決定論的）
  - Target: `generateLogId(filePath, agentName, title, index)`
  - Scenario: Given 同一の filePath・agentName・title・index で 2回呼び出す、When `generateLogId` を呼び出す
  - Expected: Then 両呼び出しが同一文字列を返す

---

## T-06: collectMdFiles / findMdFiles

### [正常] Normal Cases

#### T-06-01: 再帰的MD収集

- [x] **T-06-01-01**: ディレクトリ配下の全.md ファイルを再帰収集する
  - Target: `collectMdFiles(dir, results)` / `findMdFiles(dir)`
  - Scenario: Given 異なる深さに 3つの.md ファイルを持つディレクトリツリー、When `findMdFiles` を呼び出す
  - Expected: Then 3つのファイルパスすべてが返される

- [x] **T-06-01-02**: ファイルをパスでアルファベット順にソートして返す
  - Target: `findMdFiles(dir)`
  - Scenario: Given 非アルファベット順で作成された複数の.md ファイルを持つディレクトリ、When `findMdFiles` を呼び出す
  - Expected: Then 返却配列が辞書順にソートされている

### [エッジケース] Edge Cases

#### T-06-02: 非MDファイルと空ディレクトリ

- [x] **T-06-02-01**: .md 以外のファイルを無視する
  - Target: `collectMdFiles(dir, results)`
  - Scenario: Given `.md`・`.txt`・`.yaml` ファイルを含むディレクトリ、When `collectMdFiles` を呼び出す
  - Expected: Then `.md` ファイルのみが結果に含まれる

- [x] **T-06-02-02**: .md ファイルが 0 件のディレクトリで空配列を返す
  - Target: `findMdFiles(dir)`
  - Scenario: Given 非 MD ファイルのみを含む既存ディレクトリ、When `findMdFiles` を呼び出す
  - Expected: Then 空配列が返される

#### T-06-03: 存在しないディレクトリ

- [x] **T-06-03-01**: 存在しないディレクトリでエラーをスローせず空結果を返す
  - Target: `collectMdFiles(dir, results)`
  - Scenario: Given ファイルシステムに存在しないパス、When `collectMdFiles` を呼び出す
  - Expected: Then エラーがスローされず `results` が空のままである

---

## T-07: resolveInputDir

### [正常] Normal Cases

#### T-07-01: `--dir` オプションによる解決 (R-001)

- [x] **T-07-01-01**: 存在する `--dir` パスをそのまま返す
  - Target: `resolveInputDir(args)`
  - Scenario: Given 既存ディレクトリを指す `--dir` を含む args、When `resolveInputDir` を呼び出す
  - Expected: Then 指定パスが入力ディレクトリとして返される

#### T-07-02: `--agent` + `--year-month` による解決 (R-002)

- [x] **T-07-02-01**: `temp/chatlog/<agent>/<year>/<year-month>/` パスを構築する
  - Target: `resolveInputDir(args)`
  - Scenario: Given `--agent claude` と `--year-month 2026-03` を含む args、When `resolveInputDir` を呼び出す
  - Expected: Then 返却パスが `temp/chatlog/claude/2026/2026-03/` となる

- [x] **T-07-02-02**: year 部分が year-month 引数から導出される
  - Target: `resolveInputDir(args)`
  - Scenario: Given `--year-month 2025-11`、When `resolveInputDir` を呼び出す
  - Expected: Then 構築パスに `/2025/2025-11/` が含まれる

### [異常] Error Cases

#### T-07-03: 存在しないパスでのエラー終了 (R-003)

- [x] **T-07-03-01**: 存在しない `--dir` パスで `Deno.exit(1)` を呼び出す
  - Target: `resolveInputDir(args)`
  - Scenario: Given 存在しないパスを指す `--dir`、When `resolveInputDir` を呼び出す
  - Expected: Then エラーメッセージが表示され `Deno.exit(1)` が呼び出される

- [x] **T-07-03-02**: `--agent`/`--year-month` 解決先が存在しない場合に `Deno.exit(1)` を呼び出す
  - Target: `resolveInputDir(args)`
  - Scenario: Given 存在しないディレクトリに解決される `--agent` と `--year-month`、When `resolveInputDir` を呼び出す
  - Expected: Then エラーメッセージが表示され `Deno.exit(1)` が呼び出される

### [エッジケース] Edge Cases

#### T-07-04: 必須オプションの欠落

- [x] **T-07-04-01**: 入力選択オプションが何もない場合に `Deno.exit(1)` を呼び出す
  - Target: `resolveInputDir(args)`
  - Scenario: Given 入力選択オプションを含まない args、When `resolveInputDir` を呼び出す
  - Expected: Then 使用法エラーメッセージとともに `Deno.exit(1)` が呼び出される

---

## T-08: parseArgs

### [正常] Normal Cases

#### T-08-01: 全オプションのパース

- [x] **T-08-01-01**: `--dir` オプションを結果にパースする
  - Target: `parseArgs(args)`
  - Scenario: Given `['--dir', '/some/path']`、When `parseArgs` を呼び出す
  - Expected: Then `args.dir` が `/some/path` に等しい

- [x] **T-08-01-02**: `--agent`・`--year-month`・`--dry-run`・`--concurrency`・`--output` をパースする
  - Target: `parseArgs(args)`
  - Scenario: Given `['--agent', 'claude', '--year-month', '2026-03', '--dry-run', '--concurrency', '8', '--output', './out']`、When `parseArgs` を呼び出す
  - Expected: Then 全フィールドが結果オブジェクトに正しく設定される

### [エッジケース] Edge Cases

#### T-08-02: デフォルト値の適用

- [x] **T-08-02-01**: `--concurrency` 未指定時にデフォルト 4 が適用される
  - Target: `parseArgs(args)`
  - Scenario: Given `--concurrency` を含まない args、When `parseArgs` を呼び出す
  - Expected: Then `args.concurrency` が `4` になる

- [x] **T-08-02-02**: `--dry-run` 未指定時に false がデフォルトとなる
  - Target: `parseArgs(args)`
  - Scenario: Given `--dry-run` を含まない args、When `parseArgs` を呼び出す
  - Expected: Then `args.dryRun` が `false` である

- [x] **T-08-02-03**: 未知のオプションで `Deno.exit(1)` を呼び出す
  - Target: `parseArgs(args)`
  - Scenario: Given `--unknown` という未知フラグを含む args、When `parseArgs` を呼び出す
  - Expected: Then エラーメッセージが表示され `Deno.exit(1)` が呼び出される

#### T-08-03: パス区切り文字の正規化と自動 `--dir` 判定

- [x] **T-08-03-01**: パス文字列 (`--dir` 値・位置引数) に含まれる `\` を `/` に正規化する
  - Target: `parseArgs(args)`
  - Scenario: Given `['--dir', 'temp\\chatlog\\claude']`、When `parseArgs` を呼び出す
  - Expected: Then `args.dir` が `temp/chatlog/claude` になる

- [x] **T-08-03-02**: `/` を含む位置引数を `--dir` として扱う
  - Target: `parseArgs(args)`
  - Scenario: Given `['temp/chatlog/claude/2026/2026-03']` (`--dir` なし)、When `parseArgs` を呼び出す
  - Expected: Then `args.dir` が `temp/chatlog/claude/2026/2026-03` になる

- [x] **T-08-03-03**: `\` を含む位置引数を正規化したうえで `--dir` として扱う
  - Target: `parseArgs(args)`
  - Scenario: Given `['temp\\chatlog\\claude\\2026\\2026-03']` (`--dir` なし)、When `parseArgs` を呼び出す
  - Expected: Then `args.dir` が `temp/chatlog/claude/2026/2026-03` になる

---

## T-09: segmentChatlog

### [正常] Normal Cases

#### T-09-01: マルチトピックファイルの正常セグメント化 (R-004, R-005)

- [x] **T-09-01-01**: 各セグメントに title・summary・body を含む配列を返す
  - Target: `segmentChatlog(filePath, content)`
  - Scenario: Given CI/CD とスクリプティングのトピックを含むマルチトピックチャットログ、When `segmentChatlog` を呼び出す
  - Expected: Then `title`・`summary`・`body` を持つ 2 件以上のセグメントオブジェクト配列が返される

- [x] **T-09-01-02**: 1 呼び出しにつき Claude CLI を正確に 1回だけ呼び出す (REQ-NF-001)
  - Target: `segmentChatlog(filePath, content)`
  - Scenario: Given 有効なチャットログコンテンツ、When `segmentChatlog` を呼び出す
  - Expected: Then `runClaude` がちょうど 1回だけ呼び出される

### [異常] Error Cases

#### T-09-02: AI処理失敗時の処理 (R-008)

- [x] **T-09-02-01**: Claude CLI 呼び出しがエラーをスローした場合に null を返す
  - Target: `segmentChatlog(filePath, content)`
  - Scenario: Given Claude CLI が利用不可または非ゼロ exit code を返す、When `segmentChatlog` を呼び出す
  - Expected: Then null が返される（スローされない）

- [x] **T-09-02-02**: Claude レスポンスが JSON 配列としてパースできない場合に null を返す
  - Target: `segmentChatlog(filePath, content)`
  - Scenario: Given Claude がパース不可能なテキストを返す、When `segmentChatlog` を呼び出す
  - Expected: Then null が返される

### [エッジケース] Edge Cases

#### T-09-03: セグメント数の上限 (R-012)

- [x] **T-09-03-01**: 10 件を超えるセグメントを破棄する
  - Target: `segmentChatlog(filePath, content)`
  - Scenario: Given Claude が 15 件のセグメントを含む JSON 配列を返す、When `segmentChatlog` を呼び出す
  - Expected: Then ちょうど 10 件のセグメントが返され超過 5 件を破棄する

---

## T-10: parseJsonArray

### [正常] Normal Cases

#### T-10-01: 直接 JSON 配列パース

- [ ] **T-10-01-01**: `[` で始まる文字列を直接パースする
  - Target: `parseJsonArray(raw)`
  - Scenario: Given `[{"title":"T1","summary":"S1","body":"B1"}]` という文字列、When `parseJsonArray` を呼び出す
  - Expected: Then 1 オブジェクトを含む配列が返される

#### T-10-02: テキスト混在時のフォールバック抽出

- [ ] **T-10-02-01**: 非貪欲マッチで前置テキストから JSON 配列を抽出する
  - Target: `parseJsonArray(raw)`
  - Scenario: Given `Here is the result:\n[{"title":"T"}]` というテキスト、When `parseJsonArray` を呼び出す
  - Expected: Then 配列が抽出されて返される

- [ ] **T-10-02-02**: 非貪欲マッチ失敗時、貪欲マッチにフォールバックする
  - Target: `parseJsonArray(raw)`
  - Scenario: Given 完全な `[...]` スパンのみが有効な JSON を生成するテキスト、When `parseJsonArray` を呼び出す
  - Expected: Then 貪欲マッチの結果が返される

### [異常] Error Cases

#### T-10-03: パース不可能な入力

- [ ] **T-10-03-01**: 有効な JSON 配列が見つからない場合に null を返す
  - Target: `parseJsonArray(raw)`
  - Scenario: Given JSON 配列を含まないプレーンテキスト、When `parseJsonArray` を呼び出す
  - Expected: Then null が返される

- [ ] **T-10-03-02**: 空文字列入力でエラーをスローせず null を返す
  - Target: `parseJsonArray(raw)`
  - Scenario: Given 空文字列、When `parseJsonArray` を呼び出す
  - Expected: Then スローされずに null が返される

---

## T-11: generateSegmentFile

### [正常] Normal Cases

#### T-11-01: セグメントファイルの MD コンテンツ生成 (R-006)

- [ ] **T-11-01-01**: `## Summary` セクションにセグメントサマリーが含まれる
  - Target: `generateSegmentFile(segment)`
  - Scenario: Given `summary: "Fix CI pipeline"` を持つセグメントオブジェクト、When `generateSegmentFile` を呼び出す
  - Expected: Then 返却文字列に `## Summary\nFix CI pipeline` が含まれる

- [ ] **T-11-01-02**: `## Excerpt` セクションにセグメントボディが含まれる
  - Target: `generateSegmentFile(segment)`
  - Scenario: Given `body: "### User\nHow do I..."` を持つセグメントオブジェクト、When `generateSegmentFile` を呼び出す
  - Expected: Then 返却文字列に `## Excerpt\n### User\nHow do I...` が含まれる

### [エッジケース] Edge Cases

#### T-11-02: 空フィールド

- [ ] **T-11-02-01**: summary と body が空文字列でも有効な Markdown 構造を返す
  - Target: `generateSegmentFile(segment)`
  - Scenario: Given `summary: ""` と `body: ""` を持つセグメント、When `generateSegmentFile` を呼び出す
  - Expected: Then `## Summary` と `## Excerpt` の両セクション見出しが含まれる

---

## T-12: attachFrontmatter

### [正常] Normal Cases

#### T-12-01: ソースメタデータ引き継ぎによるフロントマター合成 (R-007)

- [ ] **T-12-01-01**: sourceMeta の `project` フィールドを引き継ぐ
  - Target: `attachFrontmatter(content, sourceMeta, segmentMeta)`
  - Scenario: Given `project: ci-platform` を含む sourceMeta、When `attachFrontmatter` を呼び出す
  - Expected: Then 出力フロントマターに `project: ci-platform` が含まれる

- [ ] **T-12-01-02**: AI 生成の `title`・`log_id`・`summary` フィールドが付加される
  - Target: `attachFrontmatter(content, sourceMeta, segmentMeta)`
  - Scenario: Given `title`・`log_id`・`summary` フィールドを持つ segmentMeta、When `attachFrontmatter` を呼び出す
  - Expected: Then 出力フロントマターに 3 フィールドすべてが含まれる

### [エッジケース] Edge Cases

#### T-12-02: ソースフロントマターなし

- [ ] **T-12-02-01**: sourceMeta が空の場合に AI 生成フィールドのみを持つフロントマターを返す
  - Target: `attachFrontmatter(content, sourceMeta, segmentMeta)`
  - Scenario: Given 空の sourceMeta（入力ファイルにフロントマターなし）、When `attachFrontmatter` を呼び出す
  - Expected: Then 出力フロントマターが AI 生成フィールド（`title`・`log_id`・`summary`）のみを含む

#### T-12-03: フロントマターデリミタ

- [ ] **T-12-03-01**: 出力が `---` デリミタで囲まれた有効な Markdown フロントマターになる
  - Target: `attachFrontmatter(content, sourceMeta, segmentMeta)`
  - Scenario: Given 任意の sourceMeta と segmentMeta、When `attachFrontmatter` を呼び出す
  - Expected: Then 出力が `---\n` で始まり、フロントマターブロックが `\n---\n` で終わる

- [ ] **T-12-03-02**: コンテンツボディがフロントマターブロックの後に重複なく続く
  - Target: `attachFrontmatter(content, sourceMeta, segmentMeta)`
  - Scenario: Given content 文字列 `## Summary\ntext`、When `attachFrontmatter` を呼び出す
  - Expected: Then 出力がフロントマターの閉じ `---` デリミタ後に正確に 1回コンテンツを含む

---

## T-13: writeOutput

### [正常] Normal Cases

#### T-13-01: アトミックなファイル書き込み

- [ ] **T-13-01-01**: ファイルが存在しない場合にコンテンツを書き込む
  - Target: `writeOutput(outputPath, content, dryRun, stats)`
  - Scenario: Given まだ存在しない出力パスと `dryRun=false`、When `writeOutput` を呼び出す
  - Expected: Then 指定コンテンツでファイルが作成され `stats.success` がインクリメントされる

- [ ] **T-13-01-02**: tmpfile→rename パターンでアトミック書き込みを行う
  - Target: `writeOutput(outputPath, content, dryRun, stats)`
  - Scenario: Given 存在しない出力パス、When `writeOutput` を呼び出す
  - Expected: Then `.tmp` ファイルが書き込まれてから最終出力パスにリネームされる

### [エッジケース] Edge Cases

#### T-13-02: 既存出力のスキップ (R-011)

- [ ] **T-13-02-01**: 出力ファイルが既存の場合にスキップしてカウンタをインクリメントする
  - Target: `writeOutput(outputPath, content, dryRun, stats)`
  - Scenario: Given ディスク上にすでに存在する出力パス、When `writeOutput` を呼び出す
  - Expected: Then `stats.skip` がインクリメントされ既存ファイルが上書きされない

#### T-13-03: ドライランモード

- [ ] **T-13-03-01**: ドライランモードではファイルを書き込まない
  - Target: `writeOutput(outputPath, content, dryRun, stats)`
  - Scenario: Given `dryRun=true` と存在しない出力パス、When `writeOutput` を呼び出す
  - Expected: Then ディスクにファイルが作成されず、ドライラン動作がログに記録される

- [ ] **T-13-03-02**: 入力ファイルへの書き込みは設定に関わらず行われない (R-010)
  - Target: `writeOutput(outputPath, content, dryRun, stats)`
  - Scenario: Given outputPath が常に `temp/normalize_logs/` 配下（入力と分離）、When `writeOutput` を呼び出す
  - Expected: Then `temp/chatlog/` 配下のパスへの書き込みは一切行われない

---

## T-14: reportResults

### [正常] Normal Cases

#### T-14-01: stdout への集計レポート (R-009)

- [ ] **T-14-01-01**: 成功件数を stdout に出力する
  - Target: `reportResults(stats)`
  - Scenario: Given `success: 5, skip: 2, fail: 1` を持つ stats、When `reportResults` を呼び出す
  - Expected: Then stdout に `成功: 5`（または同等の英語表記）が含まれる

- [ ] **T-14-01-02**: スキップ数と失敗数を同一レポートに出力する
  - Target: `reportResults(stats)`
  - Scenario: Given `success: 3, skip: 1, fail: 2` を持つ stats、When `reportResults` を呼び出す
  - Expected: Then スキップ数と失敗数が単一の出力行またはブロックに含まれる

### [エッジケース] Edge Cases

#### T-14-02: ゼロ件レポート

- [ ] **T-14-02-01**: 全カウントがゼロでもエラーなくレポートを出力する
  - Target: `reportResults(stats)`
  - Scenario: Given 全カウントが 0 の stats、When `reportResults` を呼び出す
  - Expected: Then スローされずに有効なレポートが stdout に出力される

- [ ] **T-14-02-02**: 失敗数が非ゼロの場合に失敗件数を明示的に含める (R-009)
  - Target: `reportResults(stats)`
  - Scenario: Given `fail: 3` を持つ stats、When `reportResults` を呼び出す
  - Expected: Then 出力に失敗件数が明示されて呼び出し元に警告する

---

## T-15: main (統合)

### [正常] Normal Cases

#### T-15-01: `--dir` を使ったエンドツーエンド処理 (R-001, R-004〜R-009)

- [ ] **T-15-01-01**: 収集した全 MD ファイルを処理してセグメント出力ファイルを生成する
  - Target: `main()`
  - Scenario: Given マルチトピック MD ファイルが 2 件あるディレクトリを指す `--dir`、When `main` を呼び出す
  - Expected: Then `temp/normalize_logs/` 配下にセグメント出力ファイルが作成され、結果レポートが表示される

- [ ] **T-15-01-02**: `withConcurrency` を使ってファイルを並列処理する
  - Target: `main()`
  - Scenario: Given 複数の MD ファイルとデフォルト並列数 4、When `main` を呼び出す
  - Expected: Then `withConcurrency` を使ってファイルが並列バッチで処理される

#### T-15-02: `--agent`/`--year-month` を使ったエンドツーエンド処理 (R-002)

- [ ] **T-15-02-01**: `temp/chatlog/<agent>/<year>/<year-month>/` から入力を解決してファイルを処理する
  - Target: `main()`
  - Scenario: Given `--agent claude --year-month 2026-03` と解決パス配下の MD ファイル、When `main` を呼び出す
  - Expected: Then `temp/chatlog/claude/2026/2026-03/` 内のファイルが収集されて処理される

### [異常] Error Cases

#### T-15-03: 存在しない入力パスでのエラー終了 (R-003)

- [ ] **T-15-03-01**: `--dir` パスが存在しない場合に exit code 1 で終了する
  - Target: `main()`
  - Scenario: Given `--dir /nonexistent/path`、When `main` を呼び出す
  - Expected: Then エラーメッセージが表示されてプロセスが exit code 1 で終了する

- [ ] **T-15-03-02**: 1 ファイルの AI 呼び出しが失敗しても残りファイルの処理を継続する (R-008)
  - Target: `main()`
  - Scenario: Given 3 件の MD ファイルのうち 1 件が Claude CLI エラーを引き起こす、When `main` を呼び出す
  - Expected: Then 2 件が正常処理され 1 件の失敗が最終レポートに記録される

### [エッジケース] Edge Cases

#### T-15-04: エッジケースカバレッジ

- [ ] **T-15-04-01**: 対象ディレクトリに MD ファイルが 0 件でも完了し 0 件レポートを出力する
  - Target: `main()`
  - Scenario: Given 既存だが空の（.md なし）ディレクトリを指す `--dir`、When `main` を呼び出す
  - Expected: Then プロセスが正常完了し `成功: 0, スキップ: 0, 失敗: 0` をレポートする

- [ ] **T-15-04-02**: 再実行時に既存出力ファイルをスキップしスキップ数をレポートする (R-011)
  - Target: `main()`
  - Scenario: Given 出力ファイルがすでに存在する処理済み入力ファイル、When `main` を同一入力で再度呼び出す
  - Expected: Then 既存出力ファイルが上書きされず、スキップ数がレポートされる

- [ ] **T-15-04-03**: 実行全体を通じて入力ファイルが変更されない (R-010)
  - Target: `main()`
  - Scenario: Given 既知の SHA-256 チェックサムを持つ入力 MD ファイル、When `main` が完了する
  - Expected: Then 全入力ファイルの SHA-256 チェックサムが変化しない

- [ ] **T-15-04-04**: 単一トピックのチャットログから出力ファイルが正確に 1 件生成される
  - Target: `main()`
  - Scenario: Given 一貫した単一トピックのチャットログファイル、When `main` を呼び出す
  - Expected: Then その入力に対してセグメント出力ファイルが正確に 1 件生成される

---

## Traceability Matrix

| Rule / Edge Case                             | Test Tasks                         |
| -------------------------------------------- | ---------------------------------- |
| R-001: `--dir` → 全MDファイル収集            | T-07-01-01, T-15-01-01             |
| R-002: `--agent`+`--year-month` → パス収集   | T-07-02-01, T-07-02-02, T-15-02-01 |
| R-003: パス不在 → エラー終了                 | T-07-03-01, T-07-03-02, T-15-03-01 |
| R-004: 1件以上 → AI分割処理へ送る            | T-09-01-01, T-15-01-01             |
| R-005: AI がセグメント識別 → 1件以上確定     | T-09-01-01, T-15-01-01             |
| R-006: セグメント確定 → セグメントごとMD生成 | T-11-01-01, T-11-01-02, T-15-01-01 |
| R-007: 出力生成 → フロントマター合成         | T-12-01-01, T-12-01-02, T-12-03-01 |
| R-008: AI失敗 → スキップして継続             | T-09-02-01, T-09-02-02, T-15-03-02 |
| R-009: 全処理完了 → 失敗数含むレポート       | T-14-01-01, T-14-01-02, T-14-02-02 |
| R-010: 入力ファイルへの書き込み禁止          | T-13-03-02, T-15-04-03             |
| R-011: 再実行 → 既存出力スキップ＆レポート   | T-13-02-01, T-15-04-02             |
| R-012: セグメント最大10件                    | T-09-03-01                         |
| Edge: 存在しないパスで `--dir`               | T-07-03-01, T-15-03-01             |
| Edge: 単一トピックチャットログ → 1セグメント | T-15-04-04                         |
| Edge: フロントマターなし入力                 | T-04-02-01, T-04-02-02, T-12-02-01 |
| Edge: AI処理失敗 → スキップして継続          | T-09-02-01, T-15-03-02             |
| Edge: 再実行 → 既存出力スキップ              | T-13-02-01, T-15-04-02             |
| Edge: 10件超セグメント → 最大10件            | T-09-03-01                         |
| Edge: 0件MDファイルのディレクトリ            | T-06-02-02, T-15-04-01             |
