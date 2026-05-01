// src: scripts/__tests__/unit/classify-chatlog.parseArgs.unit.spec.ts
// @(#): parseArgs のユニットテスト
//       classify 固有オプションのモデル名バリデーション

// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// -- BDD modules --
import { assertEquals, assertThrows } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- modules for test --
// test target
import { parseArgs } from '../../classify-chatlog.ts';
// classes
import { ChatlogError } from '../../../../_scripts/classes/ChatlogError.class.ts';

describe('parseArgs', () => {
  // ─── 異常系: 不正なモデル名 ───────────────────────────────────────────────

  describe('Given: 不正なモデル名', () => {
    describe('When: parseArgs(["--model", "invalid-model"]) を呼び出す', () => {
      describe('Then: T-CL-PA-12 - ChatlogError(InvalidArgs) がスローされる', () => {
        it('T-CL-PA-12-01: 不正モデル名 → ChatlogError(InvalidArgs) がスローされる', () => {
          assertThrows(
            () => parseArgs(['--model', 'invalid-model']),
            ChatlogError,
            'Invalid Args',
          );
        });
      });
    });
  });

  // ─── 正常系: --model 未指定時は undefined（globalConfig 解決は main() で行う） ─────

  describe('Given: --model 未指定', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: T-CL-PA-13 - model が undefined になる（globalConfig 解決は main() で行う）', () => {
        it('T-CL-PA-13-01: --model 未指定時、model は undefined になる', () => {
          const result = parseArgs([]);
          assertEquals(result.model, undefined);
        });

        it('T-CL-PA-13-02: --model 明示指定は優先される', () => {
          const result = parseArgs(['--model', 'sonnet']);
          assertEquals(result.model, 'sonnet');
        });
      });
    });
  });
});
