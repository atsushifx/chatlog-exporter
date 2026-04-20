// src: skills/_scripts/libs/__tests__/unit/json-utils.unit.spec.ts
// @(#): json-utils ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- test target --
import { parseJsonArray } from '../../../libs/json-utils.ts';

// ─────────────────────────────────────────────
// parseJsonArray
// ─────────────────────────────────────────────

describe('parseJsonArray', () => {
  describe('Given: 配列直接 \'[{"a":1}]\'', () => {
    describe('When: parseJsonArray を実行する', () => {
      describe('Then: T-LIB-J-01 - [{a:1}] が返る', () => {
        it('T-LIB-J-01: 配列から始まる文字列をパースして返す', () => {
          assertEquals(parseJsonArray('[{"a":1}]'), [{ a: 1 }]);
        });
      });
    });
  });

  describe('Given: 前置テキスト付き \'前置テキスト\\n[{"a":2}]\'', () => {
    describe('When: parseJsonArray を実行する', () => {
      describe('Then: T-LIB-J-02 - [{a:2}] が返る', () => {
        it('T-LIB-J-02: 前置テキストがある場合も non-greedy マッチで配列を返す', () => {
          assertEquals(parseJsonArray('前置テキスト\n[{"a":2}]'), [{ a: 2 }]);
        });
      });
    });
  });

  describe('Given: 前後テキスト付き \'テキスト [{"a":3}] 後置テキスト\'', () => {
    describe('When: parseJsonArray を実行する', () => {
      describe('Then: T-LIB-J-03 - [{a:3}] が返る', () => {
        it('T-LIB-J-03: 前後テキストがある場合も greedy マッチで配列を返す', () => {
          assertEquals(parseJsonArray('テキスト [{"a":3}] 後置テキスト'), [{ a: 3 }]);
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: parseJsonArray を実行する', () => {
      describe('Then: T-LIB-J-04 - null が返る', () => {
        it('T-LIB-J-04: 空文字列は null を返す', () => {
          assertEquals(parseJsonArray(''), null);
        });
      });
    });
  });

  describe("Given: 配列なしの文字列 'no array here'", () => {
    describe('When: parseJsonArray を実行する', () => {
      describe('Then: T-LIB-J-05 - null が返る', () => {
        it('T-LIB-J-05: 配列を含まない文字列は null を返す', () => {
          assertEquals(parseJsonArray('no array here'), null);
        });
      });
    });
  });

  describe('Given: 前後テキスト付き複数オブジェクト配列', () => {
    describe('When: parseJsonArray を実行する', () => {
      describe('Then: T-LIB-J-06 - 2件の配列が返る', () => {
        it('T-LIB-J-06: greedy マッチで複数オブジェクトを含む配列を返す', () => {
          const result = parseJsonArray('result: [{"a":1},{"a":2}] end');
          assertEquals(Array.isArray(result), true);
          assertEquals((result as unknown[]).length, 2);
        });
      });
    });
  });

  describe("Given: 空の JSON 配列文字列 '[]'", () => {
    describe('When: parseJsonArray を実行する', () => {
      describe('Then: T-LIB-J-07 - null が返る', () => {
        it('T-LIB-J-07: 空配列は null を返す（length > 0 条件）', () => {
          assertEquals(parseJsonArray('[]'), null);
        });
      });
    });
  });
});
