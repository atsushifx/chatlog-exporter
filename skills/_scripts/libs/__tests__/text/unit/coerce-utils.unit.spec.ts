// src: skills/_scripts/libs/__tests__/text/unit/coerce-utils.unit.spec.ts
// @(#): coerce-utils ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- test target --
import { toStringArrayWithNull, toStringWithNull } from '../../../text/coerce-utils.ts';

// ─────────────────────────────────────────────
// toStringWithNull
// ─────────────────────────────────────────────

describe('toStringWithNull', () => {
  describe('Given: null', () => {
    describe('When: toStringWithNull を実行する', () => {
      describe('Then: T-LIB-TU-01 - "" が返る', () => {
        it('T-LIB-TU-01: null は空文字列を返す', () => {
          assertEquals(toStringWithNull(null), '');
        });
      });
    });
  });

  describe('Given: undefined', () => {
    describe('When: toStringWithNull を実行する', () => {
      describe('Then: T-LIB-TU-02 - "" が返る', () => {
        it('T-LIB-TU-02: undefined は空文字列を返す', () => {
          assertEquals(toStringWithNull(undefined), '');
        });
      });
    });
  });

  describe("Given: 文字列 'hello'", () => {
    describe('When: toStringWithNull を実行する', () => {
      describe("Then: T-LIB-TU-03 - 'hello' が返る", () => {
        it('T-LIB-TU-03: 文字列はそのまま返す', () => {
          assertEquals(toStringWithNull('hello'), 'hello');
        });
      });
    });
  });

  describe("Given: 空文字列 ''", () => {
    describe('When: toStringWithNull を実行する', () => {
      describe("Then: T-LIB-TU-04 - '' が返る", () => {
        it('T-LIB-TU-04: 空文字列はそのまま返す', () => {
          assertEquals(toStringWithNull(''), '');
        });
      });
    });
  });

  describe('Given: 数値 42', () => {
    describe('When: toStringWithNull を実行する', () => {
      describe("Then: T-LIB-TU-05 - '42' が返る", () => {
        it('T-LIB-TU-05: 数値は文字列に変換して返す', () => {
          assertEquals(toStringWithNull(42), '42');
        });
      });
    });
  });

  describe('Given: 数値 0', () => {
    describe('When: toStringWithNull を実行する', () => {
      describe("Then: T-LIB-TU-06 - '0' が返る", () => {
        it("T-LIB-TU-06: 数値 0 は '0' を返す（null 扱いにならない）", () => {
          assertEquals(toStringWithNull(0), '0');
        });
      });
    });
  });

  describe('Given: オブジェクト { a: 1 }', () => {
    describe('When: toStringWithNull を実行する', () => {
      describe("Then: T-LIB-TU-07 - '[object Object]' が返る", () => {
        it('T-LIB-TU-07: オブジェクトは String() 変換結果を返す', () => {
          assertEquals(toStringWithNull({ a: 1 }), '[object Object]');
        });
      });
    });
  });

  describe('Given: 真偽値 true', () => {
    describe('When: toStringWithNull を実行する', () => {
      describe("Then: T-LIB-TU-08 - 'true' が返る", () => {
        it("T-LIB-TU-08: true は 'true' を返す", () => {
          assertEquals(toStringWithNull(true), 'true');
        });
      });
    });
  });
});

// ─────────────────────────────────────────────
// toStringArrayWithNull
// ─────────────────────────────────────────────

describe('toStringArrayWithNull', () => {
  describe("Given: 文字列配列 ['a', 'b']", () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe("Then: T-LIB-TU-09 - ['a', 'b'] が返る", () => {
        it('T-LIB-TU-09: 文字列配列はそのまま返す', () => {
          assertEquals(toStringArrayWithNull(['a', 'b']), ['a', 'b']);
        });
      });
    });
  });

  describe("Given: 数値混在配列 [1, 'two', 3]", () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe("Then: T-LIB-TU-10 - ['1', 'two', '3'] が返る", () => {
        it('T-LIB-TU-10: 数値混在配列は全要素を文字列に変換して返す', () => {
          assertEquals(toStringArrayWithNull([1, 'two', 3]), ['1', 'two', '3']);
        });
      });
    });
  });

  describe('Given: 空配列 []', () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe('Then: T-LIB-TU-11 - [] が返る', () => {
        it('T-LIB-TU-11: 空配列はそのまま空配列を返す', () => {
          assertEquals(toStringArrayWithNull([]), []);
        });
      });
    });
  });

  describe('Given: null', () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe('Then: T-LIB-TU-12 - [] が返る', () => {
        it('T-LIB-TU-12: null は空配列を返す', () => {
          assertEquals(toStringArrayWithNull(null), []);
        });
      });
    });
  });

  describe('Given: undefined', () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe('Then: T-LIB-TU-13 - [] が返る', () => {
        it('T-LIB-TU-13: undefined は空配列を返す', () => {
          assertEquals(toStringArrayWithNull(undefined), []);
        });
      });
    });
  });

  describe("Given: 文字列 'hello'（配列でない）", () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe('Then: T-LIB-TU-14 - [] が返る', () => {
        it('T-LIB-TU-14: 文字列は配列でないため空配列を返す', () => {
          assertEquals(toStringArrayWithNull('hello'), []);
        });
      });
    });
  });

  describe('Given: 数値 42（配列でない）', () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe('Then: T-LIB-TU-15 - [] が返る', () => {
        it('T-LIB-TU-15: 数値は配列でないため空配列を返す', () => {
          assertEquals(toStringArrayWithNull(42), []);
        });
      });
    });
  });

  describe('Given: オブジェクト { a: 1 }（配列でない）', () => {
    describe('When: toStringArrayWithNull を実行する', () => {
      describe('Then: T-LIB-TU-16 - [] が返る', () => {
        it('T-LIB-TU-16: オブジェクトは配列でないため空配列を返す', () => {
          assertEquals(toStringArrayWithNull({ a: 1 }), []);
        });
      });
    });
  });
});
