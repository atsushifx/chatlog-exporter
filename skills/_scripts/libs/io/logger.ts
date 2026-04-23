// src: skills/_scripts/libs/io/logger.ts
// @(#): ログ出力ユーティリティ
//       logger.log → stdout (prefix なし)
//       logger.info/warn/error → stderr (::info:: / ::warn:: / ::error:: prefix 付き)
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/**
 * logger — ログレベルごとに prefix を付けて出力するユーティリティ。
 *
 * - `log`  : prefix なし、stdout へ出力（結果・ファイルパス等）
 * - `info` : `::info::` prefix を付けて stderr へ出力（進捗情報）
 * - `warn` : `::warn::` prefix を付けて stderr へ出力（警告）
 * - `error`: `::error::` prefix を付けて stderr へ出力（エラー）
 *
 * `const logger = {...}` 形式で export することで、`@std/testing/mock` の `stub()` による
 * テスト時のメソッド差し替えが可能。
 */
export const logger = {
  log(msg: string): void {
    console.log(msg);
  },
  info(msg: string): void {
    console.error(`::info:: ${msg}`);
  },
  warn(msg: string): void {
    console.error(`::warn:: ${msg}`);
  },
  error(msg: string): void {
    console.error(`::error:: ${msg}`);
  },
};
