// src: skills/_cle-libs/libs/ai/__tests__/unit/abort-utils.unit.spec.ts
// @(#): abort-utils のユニットテスト
//       対象: isAbortingAiError
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─── BDD modules
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// ─── Test target
import { isAbortingAiError } from '../../abort-utils.ts';

// ─── Regression targets (未変更の既存判定関数)
import { isFatalAiError, isRateLimitError } from '../../rate-limit-utils.ts';

// ─── Helpers
import { ChatlogError } from '../../../../classes/ChatlogError.class.ts';

// ─── Internal Helpers

// constants
/** `isAbortingAiError` が `true` を返すべき中断側ケース。 */
const _trueCases = [
  {
    id: 'T-LIB-AI-LAP-01-01',
    desc: 'kind=AiError かつ subindex=RateLimit の ChatlogError → true',
    value: new ChatlogError('AiError', 'RateLimit'),
  },
  {
    id: 'T-LIB-AI-LAP-01-02',
    desc: 'kind=AiError かつ subindex=InvalidEndpoint の ChatlogError → true',
    value: new ChatlogError('AiError', 'InvalidEndpoint'),
  },
  {
    id: 'T-LIB-AI-LAP-01-03',
    desc: 'kind=AiError かつ subindex=BackendUnavailable の ChatlogError → true',
    value: new ChatlogError('AiError', 'BackendUnavailable'),
  },
  {
    id: 'T-LIB-AI-LAP-01-04',
    desc: 'kind=AiError かつ subindex=ResponseFormatRejected の ChatlogError → true',
    value: new ChatlogError('AiError', 'ResponseFormatRejected'),
  },
] as const;

/** `isAbortingAiError` が `false` を返すべき続行側・エッジケース。 */
const _falseCases = [
  {
    id: 'T-LIB-AI-LAP-03-01',
    label: 'Edge',
    desc: 'kind=AiError だが続行側 subindex=ExitFailure の ChatlogError → false',
    value: new ChatlogError('AiError', 'ExitFailure'),
  },
  {
    id: 'T-LIB-AI-LAP-03-02',
    label: 'Edge',
    desc: 'kind=AiError だが続行側 subindex=ResponseSchemaViolation の ChatlogError → false',
    value: new ChatlogError('AiError', 'ResponseSchemaViolation'),
  },
  {
    id: 'T-LIB-AI-LAP-03-03',
    label: 'Edge',
    desc: '中断側 subindex だが kind 違いの ChatlogError → false',
    value: new ChatlogError('UnknownModel', 'BackendUnavailable'),
  },
  {
    id: 'T-LIB-AI-LAP-05-01',
    label: 'Edge',
    desc: 'ChatlogError 以外の Error → false',
    value: new Error('BackendUnavailable'),
  },
  {
    id: 'T-LIB-AI-LAP-05-03',
    label: 'Edge',
    desc: 'kind も subindex も持たない任意オブジェクト → false',
    value: { foo: 'bar' },
  },
] as const;

// ─── Tests

/**
 * `isAbortingAiError` のユニットテストスイート。
 *
 * llama 経路で一括処理を中断すべき `ChatlogError` のみを `true` と判定することを検証する。
 *
 * テスト ID: T-LIB-AI-LAP-01-01〜01-04 / 03-01〜03-03 / 05-01〜05-03
 * （04-01・04-02 は別 describe の回帰テスト）
 *
 * @see isAbortingAiError
 */
describe('isAbortingAiError', () => {
  describe('When: 正常系', () => {
    for (const { id, desc, value } of _trueCases) {
      it(`[Normal] ${id}: ${desc}`, () => {
        assertEquals(isAbortingAiError(value), true);
      });
    }
  });

  describe('When: 続行側・エッジケース', () => {
    for (const { id, label, desc, value } of _falseCases) {
      it(`[${label}] ${id}: ${desc}`, () => {
        assertEquals(isAbortingAiError(value), false);
      });
    }

    it('[Edge] T-LIB-AI-LAP-05-02: null / undefined → false（throw しない）', () => {
      assertEquals(isAbortingAiError(null), false);
      assertEquals(isAbortingAiError(undefined), false);
    });
  });
});

/**
 * 既存判定関数の回帰テスト。
 *
 * 兄弟述語 `isAbortingAiError` の追加後も `isRateLimitError` / `isFatalAiError` の
 * 真偽が変わらないことを固定する。
 *
 * テスト ID 範囲: T-LIB-AI-LAP-04-01 〜 T-LIB-AI-LAP-04-02
 */
describe('回帰: 既存判定関数の挙動', () => {
  it('[Normal] T-LIB-AI-LAP-04-01: isRateLimitError は RateLimit のみ true のまま', () => {
    assertEquals(isRateLimitError(new ChatlogError('AiError', 'RateLimit')), true);
    assertEquals(isRateLimitError(new ChatlogError('AiError', 'ExitFailure')), false);
  });

  it('[Normal] T-LIB-AI-LAP-04-02: isFatalAiError は kind=AiError のみ true のまま', () => {
    assertEquals(isFatalAiError(new ChatlogError('AiError', 'ExitFailure')), true);
    assertEquals(isFatalAiError(new ChatlogError('TimedOut', 'Timeout')), false);
  });
});
