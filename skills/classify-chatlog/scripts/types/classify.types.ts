// src: scripts/types/classify.types.ts
// @(#): classify-chatlog スクリプト固有の型定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─────────────────────────────────────────────
// 分類結果型
// ─────────────────────────────────────────────

/** Claude CLI が返す1ファイルあたりの分類結果。 */
export interface ClassifyResult {
  /** 対象ファイル名（パスなし）。 */
  file: string;
  /** 割り当てられたプロジェクト名。`FALLBACK_PROJECT` の場合もある。 */
  project: string;
  /** 分類の確信度（0.0〜1.0）。 */
  confidence: number;
  /** 分類根拠の説明文。 */
  reason: string;
}

// ─────────────────────────────────────────────
// ファイルメタデータ型
// ─────────────────────────────────────────────

/** 分類処理に使用する1ファイルのメタデータ。`loadFileMeta` が返す。 */
export interface ClassifyFileMeta {
  /** ファイルの絶対パス。 */
  filePath: string;
  /** ファイル名（パスなし）。 */
  filename: string;
  /** フロントマターに既に設定されているプロジェクト名。空文字の場合は未分類。 */
  existingProject: string;
  /** フロントマターの `title` フィールド値。 */
  title: string;
  /** フロントマターの `category` フィールド値。 */
  category: string;
  /** フロントマターの `topics` リスト。 */
  topics: string[];
  /** フロントマターの `tags` リスト。 */
  tags: string[];
  /** ファイル全文（フロントマター更新時の書き込み用）。 */
  fullText: string;
}

// ─────────────────────────────────────────────
// 処理統計型
// ─────────────────────────────────────────────

/** 処理全体の集計カウンター。`main` 関数が完了時に出力する。 */
export interface ClassifyStats {
  /** 移動（または dry-run での移動予定）件数。 */
  moved: number;
  /** 既にプロジェクト設定済みでスキップした件数。 */
  skipped: number;
  /** 読み込み・移動に失敗した件数。 */
  error: number;
}

// ─────────────────────────────────────────────
// 分類設定型
// ─────────────────────────────────────────────

/** `main` が使用する分類処理の設定。すべてのフィールドに値が入る。 */
export interface ClassifyConfig {
  /** 対象 AI エージェント名（例: `claude`, `chatgpt`）。 */
  agent: string;
  /** 対象年月（`YYYY-MM` 形式）。省略時は全期間。 */
  period?: string;
  /** `true` のときファイルを移動せず分類結果のみ表示する。 */
  dryRun: boolean;
  /** チャットログが格納された入力ディレクトリのパス。 */
  inputDir: string;
  /** `projects.dic` が置かれた辞書ディレクトリのパス。 */
  dicsDir: string;
  /** claude CLI に渡すモデル名。 */
  model: string;
}

/** `parseArgs` の戻り値型。引数で指定されたフィールドのみ含む。 */
export type ParsedConfig = Partial<ClassifyConfig>;

// ─────────────────────────────────────────────
// フロントマター解析結果型
// ─────────────────────────────────────────────

/** `parseFrontmatter` が返す YAML フロントマターの解析結果。 */
export interface FrontmatterData {
  /** フロントマターの `project` フィールド値。未設定の場合は空文字。 */
  project: string;
  /** フロントマターの `title` フィールド値。 */
  title: string;
  /** フロントマターの `category` フィールド値。 */
  category: string;
  /** フロントマターの `topics` リスト。 */
  topics: string[];
  /** フロントマターの `tags` リスト。 */
  tags: string[];
}
