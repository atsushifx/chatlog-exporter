// src: scripts/__tests__/unit/classify-chatlog.parseArgs.unit.spec.ts
// @(#): parseArgs のユニットテスト
//       classify 固有オプションのモデル名バリデーション

// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// -- BDD modules --
import { assertThrows } from '@std/assert';
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
});
