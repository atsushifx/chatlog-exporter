// src: skills/_cle-libs/libs/ai/model-utils.ts
// @(#): モデル名バリデーションユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import {
  AI_MODEL_TO_PROVIDER_MAP,
  AI_PROVIDER_BACKEND_MAP,
  AI_PROVIDERS,
} from '../../types/ai.const.types.ts';
import type { AiBackend, AiModelSpec, AiProvider } from '../../types/ai.const.types.ts';

const _isKnownProvider = (p: string): p is AiProvider => (AI_PROVIDERS as readonly string[]).includes(p);

const _findProviderByModel = (input: string): AiProvider | null => {
  for (const p of AI_MODEL_TO_PROVIDER_MAP) {
    if (p.match === 'regex' && p.pattern.test(input)) { return p.provider; }
    if (p.match === 'exact' && p.value === input) { return p.provider; }
  }
  return null;
};

/**
 * モデル名を解析し、プロバイダー・モデル名を返す。
 *
 * 優先順位:
 * 1. `provider/model` 形式 + known provider → `{ provider, model }`
 * 2. `provider/model` 形式 + unknown provider → `null`
 * 3. bare string → AI_MODEL_PATTERNS で解決し backend名を provider として返す
 * 4. それ以外 → `null`
 */
export const parseModel = (input: string): AiModelSpec | null => {
  if (input.includes('/')) {
    const provider = input.split('/')[0];
    const model = input.split('/').slice(1).join('/');
    if (!_isKnownProvider(provider)) { return null; }
    return { provider, model };
  }
  const provider = _findProviderByModel(input);
  if (provider === null) { return null; }
  return { provider, model: input };
};

/**
 * モデル名から AI バックエンド種別を返す。
 *
 * - `provider/model` 形式 + known provider → AI_PROVIDER_BACKEND_MAP の値
 * - `provider/model` 形式 + unknown provider → `null`
 * - bare string → AI_MODEL_PATTERNS で解決
 * - それ以外 → `null`
 */
export const getAiBackend = (model: string): AiBackend | null => {
  const _parsed = parseModel(model);
  if (_parsed === null || !_isKnownProvider(_parsed.provider)) { return null; }
  return AI_PROVIDER_BACKEND_MAP[_parsed.provider];
};

/** AI バックエンドが識別できるモデル名かどうかを返す。 */
export const isValidModel = (model: string): boolean => parseModel(model) !== null;

/**
 * llama provider のモデル識別子が実質空かどうかを返す。
 *
 * 判定対象は llama provider に限定し、既存 provider の受理範囲は変えない。
 * **never-throw**: 例外を投げず `boolean` のみを返す。
 *
 * @param model - 判定対象のモデル指定文字列（例: `'llama/'`）
 * @returns llama provider かつモデル識別子が空白のみなら `true`
 */
export const isEmptyLlamaModelId = (model: string): boolean => {
  const _parsed = parseModel(model);
  return _parsed?.provider === 'llama' && _parsed.model.trim() === '';
};
