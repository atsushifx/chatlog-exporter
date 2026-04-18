// src: _scripts/constants/concurrency.constants.ts
// @(#): 並列処理・バッチ処理に関する共通定数
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/** Claude CLI へのバッチリクエスト 1 回あたりの最大ファイル数。 */
export const DEFAULT_CHUNK_SIZE = 10;

/** 同時実行するタスクの最大並列数。 */
export const DEFAULT_CONCURRENCY = 4;
