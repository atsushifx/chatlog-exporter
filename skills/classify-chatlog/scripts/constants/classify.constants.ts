// src: scripts/constants/classify.constants.ts
// @(#): classify-chatlog スクリプト固有の定数
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─────────────────────────────────────────────
// 共通定数の re-export
// ─────────────────────────────────────────────

export { isKnownAgent, KNOWN_AGENTS, type KnownAgent } from '../../../_scripts/constants/agents.constants.ts';
export {
  DEFAULT_CHUNK_SIZE as CHUNK_SIZE,
  DEFAULT_CONCURRENCY as CONCURRENCY,
} from '../../../_scripts/constants/concurrency.constants.ts';

// ─────────────────────────────────────────────
// classify-chatlog 固有定数
// ─────────────────────────────────────────────

/** プロジェクトが特定できなかった場合に割り当てるフォールバックプロジェクト名。 */
export const FALLBACK_PROJECT = 'misc';

/** フロントマターなし時に分類を試みる最低本文長（文字数）。これ未満は misc に直接分類する。 */
export const MIN_CLASSIFIABLE_LENGTH = 50;
