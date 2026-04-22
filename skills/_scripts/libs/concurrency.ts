// src: skills/_scripts/libs/concurrency.ts
// @(#): 並列処理共通ユーティリティ — 後方互換バレル
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export type { Task } from './parallel/concurrency.ts';
export { createChunkedTasks, createTasks, runChunked, runConcurrent, withConcurrency } from './parallel/concurrency.ts';
