// src: scripts/constants/common.constants.ts
// @(#): スクリプト共通定数定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/** Claude Code CLI が受け付けるモデル ID およびエイリアスの集合。 */
export const VALID_AI_MODELS = new Set([
  'default',
  'best',
  'opus',
  'sonnet',
  'haiku',
  'sonnet[1m]',
  'opus[1m]',
  'opusplan',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
]);
