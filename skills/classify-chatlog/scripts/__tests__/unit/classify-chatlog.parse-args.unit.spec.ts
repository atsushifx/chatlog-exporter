// src: scripts/__tests__/unit/classify-chatlog.parseArgs.unit.spec.ts
// @(#): parseArgs のユニットテスト
//       classify 固有オプションのモデル名バリデーション

// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// -- BDD modules --
import { assertEquals, assertThrows } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// -- modules for test --
// test target
import { parseArgs } from '../../classify-chatlog.ts';
// classes
import { ChatlogError } from '../../../../_scripts/classes/ChatlogError.class.ts';
import { globalConfig } from '../../../../_scripts/classes/GlobalConfig.class.ts';

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

  // ─── 正常系: globalConfig からのデフォルトモデル読み込み ─────────────────

  describe('Given: --model 未指定, globalConfig.get("model") が "opus" を返す', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: T-CL-PA-13 - model が globalConfig 値になる', () => {
        let gcStub: Stub;

        beforeEach(() => {
          gcStub = stub(globalConfig, 'get', (key: string): string | number | undefined => {
            if (key === 'model') { return 'opus'; }
            return undefined;
          });
        });

        afterEach(() => gcStub.restore());

        it('T-CL-PA-13-01: model が globalConfig.get("model") の値 "opus" になる', () => {
          const result = parseArgs([]);
          assertEquals(result.model, 'opus');
        });

        it('T-CL-PA-13-02: --model 明示指定は globalConfig より優先される', () => {
          const result = parseArgs(['--model', 'sonnet']);
          assertEquals(result.model, 'sonnet');
        });
      });
    });
  });
});
