// src: scripts/constants/defaults.ts
// @(#): デフォルト値の定数定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { ExportConfig } from '../types/export-config.types.ts';

/**
 * CLI でエージェントが指定されなかった場合のデフォルトエージェント名。
 *
 * `parseArgs()` が引数なしで呼ばれた場合のフォールバック値として使用する。
 * `KNOWN_AGENTS` の先頭要素に対応する。
 *
 * @see parseArgs
 * @see KNOWN_AGENTS
 */
export const DEFAULT_AGENT = 'claude';

/**
 * CLI で `--output` が指定されなかった場合のデフォルト出力ディレクトリ。
 *
 * `parseArgs()` が引数なしで呼ばれた場合のフォールバック値として使用する。
 * スクリプト実行ディレクトリ配下の `chatlogs/` に出力される。
 *
 * @see parseArgs
 */
export const DEFAULT_OUTPUT_DIR = './chatlogs';

/**
 * `parseArgs()` が引数なしで呼ばれた場合に返す `ExportConfig` のデフォルト値。
 *
 * `parseArgs()` はこのオブジェクトをスプレッドコピーしてベースとし、
 * CLI 引数で指定された値で上書きしていく。
 * `period` と `baseDir` は省略値（undefined）のままになる。
 *
 * @see parseArgs
 * @see ExportConfig
 */
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  agent: DEFAULT_AGENT,
  outputDir: DEFAULT_OUTPUT_DIR,
};
