// src: skills/_cle-libs/libs/ai/abort-utils.ts
// @(#): AI 一括処理の中断判定ユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─── Shared libraries
// functions
import { ChatlogError } from '../../classes/ChatlogError.class.ts';

/** llama 経路で一括処理を中断すべき subindex。 */
const _ABORT_SUBINDEXES: readonly string[] = [
  'RateLimit',
  'InvalidEndpoint',
  'BackendUnavailable',
  'ResponseFormatRejected',
];

/**
 * 与えられた値が llama 経路で一括処理を中断すべき `ChatlogError` かどうかを判定する。
 *
 * @param e - 判定対象の値（catch 節で受け取る `unknown` を想定）
 * @returns `kind==='AiError'` かつ `subindex` が `_ABORT_SUBINDEXES` に含まれる `ChatlogError` なら `true`、それ以外は `false`
 */
export const isAbortingAiError = (e: unknown): boolean =>
  e instanceof ChatlogError && e.kind === 'AiError' && _ABORT_SUBINDEXES.includes(e.subindex);
