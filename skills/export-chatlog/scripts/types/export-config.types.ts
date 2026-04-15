// src: scripts/types/export-config.types.ts
// @(#): エクスポート実行設定の型定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/**
 * `parseArgs()` が CLI 引数から生成するエクスポート実行設定。
 *
 * `main()` 関数がこの設定を受け取り、エージェント選択・期間フィルタ・
 * 出力先パスを決定する。`DEFAULT_EXPORT_CONFIG` がデフォルト値のベースになる。
 *
 * @see parseArgs
 * @see main
 * @see DEFAULT_EXPORT_CONFIG
 */
export interface ExportConfig {
  /** 対象エージェント名。"claude" または "codex" */
  agent: string;
  /**
   * エクスポート対象期間。
   * "YYYY-MM"（月指定）または "YYYY"（年指定）の文字列。
   * 省略時は全期間が対象となる。
   */
  period?: string;
  /**
   * 入力ベースディレクトリ（将来拡張用）。
   * 省略時は `homeDir()` を基点として各エージェントのデフォルトパスを使用する。
   */
  baseDir?: string;
  /** 出力先ディレクトリのベースパス。デフォルトは "./chatlogs" */
  outputDir: string;
}
