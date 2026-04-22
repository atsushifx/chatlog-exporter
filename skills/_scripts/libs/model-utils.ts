// src: skills/_scripts/libs/model-utils.ts
// @(#): モデル名バリデーションユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { VALID_AI_MODELS } from '../constants/common.constants.ts';

/** Claude Code CLI が受け付けるモデル名かどうかを返す。 */
export function isValidModel(model: string): boolean {
  return VALID_AI_MODELS.has(model);
}
