// src: scripts/constants/common.constants.ts
// @(#): スクリプト共通定数定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─────────────────────────────────────────────
// AI 実行系
// ─────────────────────────────────────────────

/** runAI のデフォルトモデル。 */
export const DEFAULT_AI_MODEL = 'sonnet';

/** runAI のデフォルトタイムアウト (ms)。0 = タイムアウトなし。 */
export const DEFAULT_TIMEOUT_MS = 120_000;

// ─────────────────────────────────────────────
// ハッシュ生成系
// ─────────────────────────────────────────────

/** generateHash の length パラメータのデフォルト値。 */
export const DEFAULT_HASH_LENGTH = 8;

/** _buildRandomString が生成するランダム文字列の最小長。 */
export const MIN_RANDOM_LENGTH = 4;

/** generateHash の maxRandomLength パラメータのデフォルト値。 */
export const DEFAULT_MAX_RANDOM_LENGTH = 16;
