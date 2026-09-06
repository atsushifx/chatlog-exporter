// src: skills/_cle-libs/libs/__tests__/ai/unit/model-utils.unit.spec.ts
// @(#): isValidModel ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─── BDD modules
import { assert, assertEquals, assertFalse } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// ─── Test target
import { getAiBackend, isEmptyLlamaModelId, isValidModel, parseModel } from '../../model-utils.ts';

// constants
import { AI_BACKEND_COMMAND_MAP } from '../../../../types/ai.const.types.ts';

// types
import type { AiCliBackend, AiModelSpec } from '../../../../types/ai.const.types.ts';

// ─── Internal Helpers

describe('isValidModel', () => {
  // 有効なショートエイリアス
  it('T-LIB-AI-01: returns true for "opus"', () => {
    assert(isValidModel('opus'));
  });

  it('T-LIB-AI-02: returns true for "sonnet"', () => {
    assert(isValidModel('sonnet'));
  });

  it('T-LIB-AI-03: returns true for "haiku"', () => {
    assert(isValidModel('haiku'));
  });

  it('T-LIB-AI-04: returns true for "default"', () => {
    assert(isValidModel('default'));
  });

  it('T-LIB-AI-05: returns true for "best"', () => {
    assert(isValidModel('best'));
  });

  // 有効な特殊エイリアス
  it('T-LIB-AI-06: returns true for "sonnet[1m]"', () => {
    assert(isValidModel('sonnet[1m]'));
  });

  it('T-LIB-AI-07: returns true for "opusplan"', () => {
    assert(isValidModel('opusplan'));
  });

  // 有効なバージョン付き
  it('T-LIB-AI-08: returns true for "claude-opus-4-7"', () => {
    assert(isValidModel('claude-opus-4-7'));
  });

  it('T-LIB-AI-09: returns true for "claude-sonnet-4-6"', () => {
    assert(isValidModel('claude-sonnet-4-6'));
  });

  it('T-LIB-AI-10: returns true for "claude-haiku-4-5-20251001"', () => {
    assert(isValidModel('claude-haiku-4-5-20251001'));
  });

  // 無効
  it('T-LIB-AI-11: returns false for "invalid-model"', () => {
    assertFalse(isValidModel('invalid-model'));
  });

  it('T-LIB-AI-12: returns false for "Opus" (case sensitive)', () => {
    assertFalse(isValidModel('Opus'));
  });

  it('T-LIB-AI-13: returns false for empty string', () => {
    assertFalse(isValidModel(''));
  });

  it('T-LIB-AI-14: returns false for "opus-" (partial match)', () => {
    assertFalse(isValidModel('opus-'));
  });
});

/**
 * `getAiBackend` のユニットテストスイート。
 *
 * モデル名からバックエンド種別（'claude' | 'codex' | 'copilot' | 'opencode' | null）を返すことを検証する。
 *
 * テスト ID 範囲: T-LIB-AI-15 〜 T-LIB-AI-25
 *
 * @see getAiBackend
 */
describe('getAiBackend', () => {
  /** VALID_AI_MODELS に含まれるモデル名 → 'claude' を返す正常ケース。 */
  describe('When: 正常系', () => {
    it('T-LIB-AI-15: getAiBackend("sonnet") → "claude"', () => {
      assertEquals(getAiBackend('sonnet'), 'claude');
    });

    it('T-LIB-AI-16: getAiBackend("opus") → "claude"', () => {
      assertEquals(getAiBackend('opus'), 'claude');
    });

    it('T-LIB-AI-17: getAiBackend("haiku") → "claude"', () => {
      assertEquals(getAiBackend('haiku'), 'claude');
    });

    it('T-LIB-AI-18: getAiBackend("claude-sonnet-4-6") → "claude"', () => {
      assertEquals(getAiBackend('claude-sonnet-4-6'), 'claude');
    });

    it('T-LIB-AI-20: getAiBackend("gpt-5") → "codex"', () => {
      assertEquals(getAiBackend('gpt-5'), 'codex');
    });

    it('T-LIB-AI-22: getAiBackend("copilot/gpt-4") → "copilot"', () => {
      assertEquals(getAiBackend('copilot/gpt-4'), 'copilot');
    });

    it('T-LIB-AI-23: getAiBackend("openai/gpt-4") → "codex"', () => {
      assertEquals(getAiBackend('openai/gpt-4'), 'codex');
    });

    it('T-LIB-AI-24: getAiBackend("unknown") → null', () => {
      assertEquals(getAiBackend('unknown'), null);
    });

    it('T-LIB-AI-30: getAiBackend("google/gemini") → "antigravity" (mapped provider)', () => {
      assertEquals(getAiBackend('google/gemini'), 'antigravity');
    });

    it('T-LIB-AI-31: getAiBackend("antigravity/foo") → "antigravity" (mapped provider)', () => {
      assertEquals(getAiBackend('antigravity/foo'), 'antigravity');
    });

    it('T-LIB-AI-32: getAiBackend("claude/claude-3") → "claude" (via provider map)', () => {
      assertEquals(getAiBackend('claude/claude-3'), 'claude');
    });

    it('T-LIB-AI-33: getAiBackend("codex/gpt-4") → "codex" (via provider map)', () => {
      assertEquals(getAiBackend('codex/gpt-4'), 'codex');
    });

    it('T-LIB-AI-54: getAiBackend("foobar/baz") → null (unknown provider)', () => {
      assertEquals(getAiBackend('foobar/baz'), null);
    });

    /** llama provider は同名の llama バックエンドへ写像される（`AI_PROVIDER_BACKEND_MAP`）。 */
    it('[Normal] T-LIB-AI-MDL-01-02: getAiBackend("llama/qwen3-14b") → "llama"', () => {
      // assert
      assertEquals(getAiBackend('llama/qwen3-14b'), 'llama');
    });
  });

  /** 境界値・特殊エイリアスのエッジケース。 */
  describe('When: エッジケース', () => {
    it('T-LIB-AI-19: getAiBackend("sonnet[1m]") → "claude"', () => {
      assertEquals(getAiBackend('sonnet[1m]'), 'claude');
    });

    it('T-LIB-AI-25: getAiBackend("") → null', () => {
      assertEquals(getAiBackend(''), null);
    });
  });
});

/**
 * `isValidModel` のマルチバックエンド対応ユニットテストスイート。
 *
 * getAiBackend が null でないモデルは true を返すことを検証する。
 *
 * テスト ID 範囲: T-LIB-AI-26 〜 T-LIB-AI-29
 *
 * @see isValidModel
 */
describe('isValidModel (multi-backend)', () => {
  /** getAiBackend が非 null を返すモデル → true の正常ケース。 */
  describe('When: 正常系', () => {
    it('T-LIB-AI-26: isValidModel("gpt-5") → true', () => {
      assert(isValidModel('gpt-5'));
    });

    it('T-LIB-AI-27: isValidModel("copilot/gpt-4") → true', () => {
      assert(isValidModel('copilot/gpt-4'));
    });

    it('T-LIB-AI-28: isValidModel("openai/gpt-4") → true', () => {
      assert(isValidModel('openai/gpt-4'));
    });

    /** llama バックエンドの追加により `<provider>/<model>` 形式の llama モデルが有効になる。 */
    it('[Normal] T-LIB-AI-MDL-01-03: isValidModel("llama/qwen3-14b") → true', () => {
      // assert
      assert(isValidModel('llama/qwen3-14b'));
    });
  });

  /** getAiBackend が null を返すモデル → false の異常ケース。 */
  describe('When: 異常系', () => {
    it('T-LIB-AI-29: isValidModel("unknown") → false', () => {
      assertFalse(isValidModel('unknown'));
    });

    it('T-LIB-AI-55: isValidModel("foobar/baz") → false (unknown provider)', () => {
      assertFalse(isValidModel('foobar/baz'));
    });
  });
});

/**
 * `parseModel` のユニットテストスイート。
 *
 * モデル名から `{ provider, model }` または `null` を返すことを検証する。
 *
 * テスト ID 範囲: T-LIB-AI-40 〜 T-LIB-AI-47
 *
 * @see parseModel
 */
describe('parseModel', () => {
  /** provider/model 形式・bare モデル・gpt-/o1- プレフィックスの正常ケース。 */
  describe('When: 正常系', () => {
    it('T-LIB-AI-40: parseModel("openai/gpt-4") → { provider:"openai", model:"gpt-4" }', () => {
      const _expected: AiModelSpec = { provider: 'openai', model: 'gpt-4' };
      assertEquals(parseModel('openai/gpt-4'), _expected);
    });

    it('T-LIB-AI-41: parseModel("google/gemini") → { provider:"google", model:"gemini" }', () => {
      const _expected: AiModelSpec = { provider: 'google', model: 'gemini' };
      assertEquals(parseModel('google/gemini'), _expected);
    });

    it('T-LIB-AI-51: parseModel("antigravity/foo") → { provider:"antigravity", model:"foo" }', () => {
      const _expected: AiModelSpec = { provider: 'antigravity', model: 'foo' };
      assertEquals(parseModel('antigravity/foo'), _expected);
    });

    it('T-LIB-AI-52: parseModel("anthropic/claude-3") → { provider:"anthropic", model:"claude-3" }', () => {
      const _expected: AiModelSpec = { provider: 'anthropic', model: 'claude-3' };
      assertEquals(parseModel('anthropic/claude-3'), _expected);
    });

    it('T-LIB-AI-42: parseModel("copilot/gpt-4") → { provider:"copilot", model:"gpt-4" }', () => {
      const _expected: AiModelSpec = { provider: 'copilot', model: 'gpt-4' };
      assertEquals(parseModel('copilot/gpt-4'), _expected);
    });

    it('T-LIB-AI-43: parseModel("claude/claude-3") → { provider:"claude", model:"claude-3" }', () => {
      const _expected: AiModelSpec = { provider: 'claude', model: 'claude-3' };
      assertEquals(parseModel('claude/claude-3'), _expected);
    });

    it('T-LIB-AI-44: parseModel("sonnet") → { provider:"claude", model:"sonnet" }', () => {
      const _expected: AiModelSpec = { provider: 'claude', model: 'sonnet' };
      assertEquals(parseModel('sonnet'), _expected);
    });

    it('T-LIB-AI-45: parseModel("gpt-5") → { provider:"codex", model:"gpt-5" }', () => {
      const _expected: AiModelSpec = { provider: 'codex', model: 'gpt-5' };
      assertEquals(parseModel('gpt-5'), _expected);
    });

    /**
     * `parseModel` は provider prefix の照合しか行わず、モデル識別子の空判定は担わない。
     * llama 向けの空識別子拒否を誤って `parseModel` へ入れると既存 provider の
     * 受理範囲まで壊れるため、その回帰を検出するゲートとして固定する（REQ-C-002）。
     */
    it('[Normal] T-LIB-AI-MDL-02-01: parseModel("openai/") は llama 追加後も null を返さず受理される', () => {
      // arrange
      const _expected: AiModelSpec = { provider: 'openai', model: '' };

      // assert
      assertEquals(parseModel('openai/'), _expected);
    });

    /** LAN 上の llama サーバを指す `<provider>/<model>` 形式が known provider として解決される。 */
    it('[Normal] T-LIB-AI-MDL-01-01: parseModel("llama/qwen3-14b") → { provider:"llama", model:"qwen3-14b" }', () => {
      // arrange
      const _expected: AiModelSpec = { provider: 'llama', model: 'qwen3-14b' };

      // assert
      assertEquals(parseModel('llama/qwen3-14b'), _expected);
    });

    /**
     * 2 つ目以降のスラッシュはモデル識別子の一部として扱う。llama のモデル名は
     * `org/model` 形式を取りうるため、多段スラッシュを拒否する分岐を持たない。
     */
    it('[Normal] T-LIB-AI-MDL-03-01: parseModel("llama/org/model") → { provider:"llama", model:"org/model" }', () => {
      // arrange
      const _expected: AiModelSpec = { provider: 'llama', model: 'org/model' };

      // assert
      assertEquals(parseModel('llama/org/model'), _expected);
    });
  });

  /** 既知の受理形式に一致しないモデル値を拒否する異常ケース。 */
  describe('When: 異常系', () => {
    /**
     * 受理形式のいずれにも一致しない値は `parseModel` が `null`、`isValidModel` が `false` を返す。
     * 例外 message へ受理形式一覧が載ることの検証は `runAI` 前段を対象とする別テストが所有し、
     * ここでは message を assert しない。
     */
    it('[Error] T-LIB-AI-MDL-07-01: 未知モデル値に対し parseModel は null、isValidModel は false を返す', () => {
      // assert
      assertEquals(parseModel('mistral-7b'), null);
      assertFalse(isValidModel('mistral-7b'));
      assertEquals(parseModel('llama'), null);
      assertFalse(isValidModel('llama'));
    });

    /**
     * `parseModel` は provider prefix の照合しか行わないため、モデル識別子が空でも
     * `null` にはならない。空識別子の拒否は llama に限定した述語が担う（DR-23）。
     */
    it('[Error] T-LIB-AI-MDL-04-01: parseModel("llama/") → { provider:"llama", model:"" }（null ではない）', () => {
      // arrange
      const _expected: AiModelSpec = { provider: 'llama', model: '' };

      // assert
      assertEquals(parseModel('llama/'), _expected);
    });
  });

  /** バックエンドが特定できないモデル → null のエッジケース。 */
  describe('When: エッジケース', () => {
    it('T-LIB-AI-46: parseModel("unknown") → null', () => {
      assertEquals(parseModel('unknown'), null);
    });

    it('T-LIB-AI-47: parseModel("") → null', () => {
      assertEquals(parseModel(''), null);
    });

    it('T-LIB-AI-56: parseModel("foobar/baz") → null (unknown provider)', () => {
      assertEquals(parseModel('foobar/baz'), null);
    });

    /**
     * provider 照合は完全一致で行う。`toLowerCase()` 等の「親切な」正規化が入ると
     * `Llama/...` が `llama` として解決されてしまうため、その退行を検出する（DR-02）。
     */
    it('[Edge] T-LIB-AI-MDL-05-01: parseModel("Llama/qwen3-14b") → null（provider 照合は完全一致）', () => {
      // assert
      assertEquals(parseModel('Llama/qwen3-14b'), null);
    });
  });
});

/**
 * `AI_BACKEND_COMMAND_MAP` と CLI バックエンド部分集合型のユニットテストスイート。
 *
 * llama は LAN 上の HTTP サーバであり CLI バイナリを持たないため、
 * CLI コマンド表の制約対象から除外されることを検証する。
 *
 * テスト ID 範囲: T-LIB-AI-MDL-06-01
 *
 * @see AI_BACKEND_COMMAND_MAP
 */
describe('AI_BACKEND_COMMAND_MAP', () => {
  /** CLI バイナリを持たないバックエンドの扱いを固定するエッジケース。 */
  describe('When: エッジケース', () => {
    /**
     * `@ts-expect-error` は `AiCliBackend` が `Exclude` を失って `AiBackend` と同義になった
     * 瞬間に「未使用の抑制」となりコンパイルに失敗する。加えて `Object.hasOwn` の実行時検証を
     * 併置し、`AI_BACKEND_COMMAND_MAP` へ `llama` キーが足された場合も検出する。
     */
    it('[Edge] T-LIB-AI-MDL-06-01: llama は AiCliBackend に含まれず AI_BACKEND_COMMAND_MAP にエントリを持たない', () => {
      // arrange
      // @ts-expect-error llama は AiCliBackend から除外されるため代入できない
      const _llamaAsCli: AiCliBackend = 'llama';
      const _cliBackend: AiCliBackend = 'claude';

      // assert
      assertFalse(Object.hasOwn(AI_BACKEND_COMMAND_MAP, 'llama'));
      assertEquals(_llamaAsCli, 'llama');
      assertEquals(AI_BACKEND_COMMAND_MAP[_cliBackend], 'claude');
    });
  });
});

/**
 * `isEmptyLlamaModelId` のユニットテストスイート。
 *
 * llama provider に限定して、モデル識別子が実質空であることを判定する述語を検証する。
 * 例外は投げず `boolean` のみを返す（例外への写像は `runAI` 前段が担う）。
 *
 * テスト ID 範囲: T-LIB-AI-MDL-04-02 〜 T-LIB-AI-MDL-04-03
 *
 * @see isEmptyLlamaModelId
 */
describe('isEmptyLlamaModelId', () => {
  /** llama のモデル識別子が欠落している異常ケース。 */
  describe('When: 異常系', () => {
    /**
     * モデル識別子が空文字・空白のみのいずれでも真を返す。`assertThrows` を使わず、
     * 2 回の呼び出しが例外なく `boolean` を返すこと自体で never-throw を担保する。
     */
    it('[Error] T-LIB-AI-MDL-04-02: isEmptyLlamaModelId は "llama/" と "llama/ " に真を返し throw しない', () => {
      // assert
      assert(isEmptyLlamaModelId('llama/'));
      assert(isEmptyLlamaModelId('llama/ '));
    });

    /**
     * 判定対象は llama provider に限定される。provider を見ずに「空モデル名なら真」と
     * 実装されると既存 provider の受理範囲を狭めてしまうため、その退行を検出する。
     */
    it('[Error] T-LIB-AI-MDL-04-03: isEmptyLlamaModelId("openai/") → false（判定は llama に限定）', () => {
      // assert
      assertFalse(isEmptyLlamaModelId('openai/'));
    });
  });
});
