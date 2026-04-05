---
title: "Requirements: chatlog/normalize"
module: "chatlog/normalize"
status: Draft
version: 1.0
created: "2026-04-05"
---

<!-- markdownlint-disable line-length -->

## 1. Overview

### 1.1 Purpose

チャットログ（Markdown 形式）の本文を AI が読み取り、問題・作業の問題領域ごとにセグメントを分解・分割し、
正規化された個別 Markdown ファイルとして出力する。
これにより、1つのセッションログに混在する複数トピックを独立したナレッジ単位として整理・再利用可能にする。

### 1.2 Scope

**In Scope**:

- 指定ディレクトリまたはエージェント・年月指定による入力チャットログの自動収集
- AI による本文解析・問題領域の特定とセグメント分割
- 各セグメントのサマリー生成と元ログ該当部分の抽出
- 出力ファイルへのフロントマター付加（元メタデータ引き継ぎ + AI 生成フィールド）
- 出力先 `temp/normalize_logs/<agent>/<year>/<year-month>/<project>/` への書き出し

**Out of Scope**:

- 元のチャットログファイルの変更・削除
- フロントマター付加以外のチャットログ変換処理（export、filter、classify）
- Obsidian への直接インポート処理
- リアルタイム・インクリメンタル処理

## 2. Context

- Target Environment: Deno/TypeScript CLI、Windows 11 / Unix 互換シェル
- Related Components: `temp/chatlog/`（入力）、`assets/dics/`（辞書）、Claude CLI（AI 処理）
- Assumptions: 入力ファイルは Markdown 形式でフロントマターを持つ場合がある

### System Context Diagram

```text
[User (CLI)]  -->  +---------------------------+  -->  [temp/normalize_logs/]
                   |   chatlog/normalize       |
[temp/chatlog/] -->|   (normalize module)      |
                   +---------------------------+
                              |
                              v
                       [Claude CLI (AI)]
```

## 3. Design Decisions (Summary)

| ID    | Decision                                               | Linked Record |
| ----- | ------------------------------------------------------ | ------------- |
| DR-01 | 元ファイルを変更せず出力先を分離する                   | —             |
| DR-02 | AIによる問題領域判定（ルールベースでなく）             | —             |
| DR-03 | 出力フロントマターは元メタデータ引き継ぎ＋AI生成の合成 | —             |

## 4. Functional Requirements

### REQ-F-001: 入力ディレクトリの収集

- EARS Type: event-driven (WHEN)

```text
GIVEN CLIが起動された
  WHEN ユーザーが --dir オプションでパスを指定した
THEN the system SHALL 指定パス以下のすべてのMarkdownファイルを収集する。
```

**Rationale**: 任意のディレクトリを直接指定できる柔軟性を確保する。

**Acceptance Criteria**:

| AC ID  | Scenario                       |
| ------ | ------------------------------ |
| AC-001 | 既存ディレクトリ指定で全MD収集 |
| AC-002 | 存在しないパス指定でエラー終了 |

### REQ-F-002: エージェント・年月指定による入力解決

- EARS Type: event-driven (WHEN)

```text
GIVEN CLIが起動された
  WHEN ユーザーが --agent と --year-month オプションを指定した
THEN the system SHALL temp/chatlog/<agent>/<year>/<year-month>/ 配下のすべてのMarkdownファイルを収集する。
```

**Rationale**: 既存パイプラインのディレクトリ構造と整合させる。

**Acceptance Criteria**:

| AC ID  | Scenario                                |
| ------ | --------------------------------------- |
| AC-003 | agent=claude, year-month=2026-03 で収集 |

### REQ-F-003: AIによる問題領域の特定と分割

- EARS Type: event-driven (WHEN)

```text
GIVEN 1つのチャットログMarkdownファイルが収集された
  WHEN システムがAI（Claude CLI）にファイル本文を渡した
THEN the system SHALL 本文から1つ以上の問題領域セグメントを識別し、各セグメントの範囲（開始・終了）を確定する。
```

**Rationale**: ルールベースでなく AI の文脈理解を利用することで、多様なトピック混在に対応する。

**Acceptance Criteria**:

| AC ID  | Scenario                                          |
| ------ | ------------------------------------------------- |
| AC-004 | 複数トピック混在ログから2件以上のセグメントを抽出 |
| AC-005 | 単一トピックのログから1件のセグメントを抽出       |

### REQ-F-004: 分割MDファイルの生成

- EARS Type: event-driven (WHEN)

```text
GIVEN 問題領域セグメントが識別された
  WHEN システムがセグメントごとの出力ファイルを生成する
THEN the system SHALL 各セグメントに対してサマリー＋元ログ該当部分を含むMarkdownファイルを
     temp/normalize_logs/<agent>/<year>/<year-month>/<project>/ 配下に生成する。
```

**Rationale**: 元ファイルを変更せず、問題領域単位のナレッジとして独立保存する。

**Acceptance Criteria**:

| AC ID  | Scenario                                     |
| ------ | -------------------------------------------- |
| AC-006 | 出力ファイルにサマリーセクションが存在する   |
| AC-007 | 出力ファイルに元ログ抜粋セクションが存在する |

### REQ-F-005: 出力フロントマターの付加

- EARS Type: event-driven (WHEN)

```text
GIVEN 出力Markdownファイルが生成された
  WHEN システムがフロントマターを付加する
THEN the system SHALL 元ファイルの project / date 等のフィールドを引き継ぎ、
     かつ title / log_id / summary をAIで新規生成して付加する。
```

**Rationale**: 出力ファイルを独立したナレッジとして検索・参照できるようにする。

**Acceptance Criteria**:

| AC ID  | Scenario                                          |
| ------ | ------------------------------------------------- |
| AC-008 | 出力フロントマターに project フィールドが存在する |
| AC-009 | 出力フロントマターに title と summary が存在する  |

### REQ-F-006: 元ファイルの保全

- EARS Type: unwanted behavior (NOT DO)

```text
GIVEN normalize処理が実行される
  NOT DO 入力ファイルを変更・削除する
THEN the system SHALL 元のチャットログファイルを読み取り専用として扱い、一切の変更を行わない。
```

**Rationale**: パイプラインの冪等性と安全性を保証する。

**Acceptance Criteria**:

| AC ID  | Scenario                                     |
| ------ | -------------------------------------------- |
| AC-010 | 処理前後で入力ファイルのハッシュ値が一致する |

## 5. Non-Functional Requirements

### REQ-NF-001: 処理性能

1 ファイルあたりの AI API 呼び出し回数を最小化し、バッチ処理を可能な限り並列化すること。
目安: 10 ファイルを 5分以内に処理できること（Claude CLI 1 呼び出し/ファイル想定）。

### REQ-NF-002: エラー耐性

個別ファイルの処理失敗は他ファイルの処理に影響しないこと。
失敗したファイルはスキップし、処理完了時に失敗件数をレポートすること。

### REQ-NF-003: 文字エンコーディング

入力・出力ファイルはともに UTF-8 で処理すること。

### REQ-NF-004: 冪等性

同一入力ファイルに対して複数回実行した場合、出力結果が同一であること（または既存ファイルをスキップすること）。

## 6. Constraints

### REQ-C-001: ランタイム

実装は Deno/TypeScript を使用すること（プロジェクトの既存スタックに準拠）。

### REQ-C-002: AI呼び出し

AI 処理は Claude CLI（`claude -p`）を使用すること。

### REQ-C-003: 出力ディレクトリ

出力先は `temp/normalize_logs/` 配下とし、入力ディレクトリ（`temp/chatlog/`）とは分離すること。

## 7. User Stories

- As a developer, I want to split a multi-topic chatlog into domain-specific files. Because I want to reuse each topic as an independent knowledge unit.
- As a developer, I want to specify a directory or agent/year-month to target a batch of chatlogs. Because I process logs periodically and need flexible scope control.
- As a knowledge engineer, I want each split file to have a generated title and summary. Because I need to find and reference them without reading the full content.
- As a pipeline operator, I want the original chatlog files to remain untouched. Because I need to rerun the process safely without data loss.
- As a developer, I want failed files to be skipped with a report. Because I need the batch to complete even when individual files have issues.

## 8. Acceptance Criteria

```gherkin
# AC-001: 既存ディレクトリ指定で全MD収集
# Requirement: REQ-F-001
Scenario: 既存ディレクトリ指定で全MD収集
  Given temp/chatlog/claude/2026/2026-03/ci-platform/ に3件のMDファイルが存在する
  When  --dir temp/chatlog/claude/2026/2026-03/ci-platform を指定して実行する
  Then  3件のファイルが処理対象として収集される

# AC-004: 複数トピック混在ログからのセグメント抽出
# Requirement: REQ-F-003
Scenario: 複数トピック混在ログからのセグメント抽出
  Given 1つのチャットログにCI/CDとスクリプト修正の2つのトピックが混在している
  When  normalize処理を実行する
  Then  2件以上のセグメントが識別される

# AC-006: 出力ファイルにサマリーセクションが存在する
# Requirement: REQ-F-004
Scenario: 出力ファイルにサマリーセクションが存在する
  Given セグメントが識別された
  When  出力MDファイルが生成される
  Then  ファイル内に ## Summary セクションが存在する

# AC-008: 出力フロントマターに project フィールドが存在する
# Requirement: REQ-F-005
Scenario: 出力フロントマターに元メタデータが引き継がれる
  Given 入力ファイルのフロントマターに project: ci-platform が存在する
  When  normalize処理を実行する
  Then  出力ファイルのフロントマターに project: ci-platform が存在する

# AC-010: 元ファイルの保全
# Requirement: REQ-F-006
Scenario: 元ファイルが変更されない
  Given 入力ファイルのSHA256ハッシュを記録する
  When  normalize処理を実行する
  Then  処理後の入力ファイルのSHA256ハッシュが変化していない
```

## 9. Traceability

| REQ ID     | AC IDs         | Type           |
| ---------- | -------------- | -------------- |
| REQ-F-001  | AC-001, AC-002 | Functional     |
| REQ-F-002  | AC-003         | Functional     |
| REQ-F-003  | AC-004, AC-005 | Functional     |
| REQ-F-004  | AC-006, AC-007 | Functional     |
| REQ-F-005  | AC-008, AC-009 | Functional     |
| REQ-F-006  | AC-010         | Functional     |
| REQ-NF-001 | —              | Non-Functional |
| REQ-NF-002 | —              | Non-Functional |
| REQ-NF-003 | —              | Non-Functional |
| REQ-NF-004 | —              | Non-Functional |
| REQ-C-001  | —              | Constraint     |
| REQ-C-002  | —              | Constraint     |
| REQ-C-003  | —              | Constraint     |

## 10. Open Questions

| Question                                                            | Type       | Impact Area              | Owner |
| ------------------------------------------------------------------- | ---------- | ------------------------ | ----- |
| セグメント分割の粒度（1会話交換単位 vs トピック単位）はどう決めるか | EARS/GIVEN | REQ-F-003 スコープ       | TBD   |
| 1ファイルから抽出するセグメント数の上限はあるか                     | EARS/THEN  | REQ-F-003 出力量         | TBD   |
| log_id の採番ルールは何か（元session_id+連番など）                  | EARS/THEN  | REQ-F-005 フロントマター | TBD   |
| 既存の出力ファイルが存在する場合、上書きするかスキップするか        | EARS/WHEN  | REQ-NF-004 冪等性        | TBD   |

## 11. Change History

| Date       | Version | Description     |
| ---------- | ------- | --------------- |
| 2026-04-05 | 1.0.0   | Initial release |
