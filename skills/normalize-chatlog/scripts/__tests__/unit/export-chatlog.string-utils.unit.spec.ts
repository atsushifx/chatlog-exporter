// src: scripts/__tests__/unit/export-chatlog.string-utils.unit.spec.ts
// @(#): 文字列ユーティリティ関数のユニットテスト
//       対象: textToSlug, isShortAffirmation, isSkippable, isoToDate, isoToMs
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import {
  isoToDate,
  isoToMs,
  isShortAffirmation,
  isSkippable,
  textToSlug,
} from '../../export-chatlog.ts';

// ─── textToSlug ──────────────────────────────────────────────────────────────

describe('textToSlug', () => {
  describe('Given: ASCII 文字列 "hello world"', () => {
    describe('When: textToSlug("hello world") を呼び出す', () => {
      describe('Then: T-EC-SU-01 - ASCII からスラッグを生成する', () => {
        it('T-EC-SU-01-01: "hello-world" を返す', () => {
          assertEquals(textToSlug('hello world'), 'hello-world');
        });
      });
    });
  });

  describe('Given: 日本語のみ "テスト"', () => {
    describe('When: textToSlug("テスト") を呼び出す', () => {
      describe('Then: T-EC-SU-01 - 日本語のみは fallback を返す', () => {
        it('T-EC-SU-01-02: fallback "session" を返す', () => {
          assertEquals(textToSlug('テスト'), 'session');
        });
      });
    });
  });

  describe('Given: 混在テキスト "API設計 plan"', () => {
    describe('When: textToSlug("API設計 plan") を呼び出す', () => {
      describe('Then: T-EC-SU-01 - ASCII 部分からスラッグを生成する', () => {
        it('T-EC-SU-01-03: ASCII 部分のみが残る', () => {
          const result = textToSlug('API設計 plan');
          assertEquals(result.includes('api'), true);
          assertEquals(result.includes('plan'), true);
        });
      });
    });
  });

  describe('Given: 200文字を超えるテキスト', () => {
    describe('When: textToSlug(longText) を呼び出す', () => {
      describe('Then: T-EC-SU-01 - 50文字以内に切り詰める', () => {
        it('T-EC-SU-01-04: 結果の長さが 50 以下', () => {
          const longText = 'a'.repeat(300);
          const result = textToSlug(longText);
          assertEquals(result.length <= 50, true);
        });
      });
    });
  });

  describe('Given: 空文字列 ""', () => {
    describe('When: textToSlug("") を呼び出す', () => {
      describe('Then: T-EC-SU-01 - 空文字は fallback を返す', () => {
        it('T-EC-SU-01-05: fallback "session" を返す', () => {
          assertEquals(textToSlug(''), 'session');
        });
      });
    });
  });

  describe('Given: 2文字以下の ASCII "ab"', () => {
    describe('When: textToSlug("ab") を呼び出す', () => {
      describe('Then: T-EC-SU-01 - 短すぎる場合は fallback を返す', () => {
        it('T-EC-SU-01-06: fallback "session" を返す', () => {
          assertEquals(textToSlug('ab'), 'session');
        });
      });
    });
  });

  describe('Given: 複数行テキスト "line1\\n\\nline2"', () => {
    describe('When: textToSlug("line1\\n\\nline2") を呼び出す', () => {
      describe('Then: T-EC-SU-01 - 最初の段落の先頭行のみ使用する', () => {
        it('T-EC-SU-01-07: "line1" のスラッグが含まれる', () => {
          const result = textToSlug('line1\n\nline2');
          assertEquals(result, 'line1');
        });
      });
    });
  });
});

// ─── isShortAffirmation ───────────────────────────────────────────────────────

describe('isShortAffirmation', () => {
  describe('Given: "yes"', () => {
    it('T-EC-SU-02-01: true を返す', () => {
      assertEquals(isShortAffirmation('yes'), true);
    });
  });

  describe('Given: "はい"', () => {
    it('T-EC-SU-02-02: true を返す', () => {
      assertEquals(isShortAffirmation('はい'), true);
    });
  });

  describe('Given: 大文字 "YES"', () => {
    it('T-EC-SU-02-03: true を返す（toLowerCase 適用）', () => {
      assertEquals(isShortAffirmation('YES'), true);
    });
  });

  describe('Given: 21文字以上の文字列', () => {
    it('T-EC-SU-02-04: false を返す（長さ超過）', () => {
      assertEquals(isShortAffirmation('a'.repeat(21)), false);
    });
  });

  describe('Given: "hello"（SKIP_EXACT に非該当）', () => {
    it('T-EC-SU-02-05: false を返す', () => {
      assertEquals(isShortAffirmation('hello'), false);
    });
  });
});

// ─── isSkippable ──────────────────────────────────────────────────────────────

describe('isSkippable', () => {
  describe('Given: 空文字列 ""', () => {
    it('T-EC-SU-03-01: true を返す', () => {
      assertEquals(isSkippable(''), true);
    });
  });

  describe('Given: "/clear" プレフィックス', () => {
    it('T-EC-SU-03-02: true を返す', () => {
      assertEquals(isSkippable('/clear'), true);
    });
  });

  describe('Given: "<system-reminder>..." プレフィックス', () => {
    it('T-EC-SU-03-03: true を返す', () => {
      assertEquals(isSkippable('<system-reminder>some content'), true);
    });
  });

  describe('Given: "yes"（短文肯定）', () => {
    it('T-EC-SU-03-04: true を返す', () => {
      assertEquals(isSkippable('yes'), true);
    });
  });

  describe('Given: "explain this code"（通常テキスト）', () => {
    it('T-EC-SU-03-05: false を返す', () => {
      assertEquals(isSkippable('explain this code'), false);
    });
  });

  describe('Given: "/help コマンド"', () => {
    it('T-EC-SU-03-06: true を返す', () => {
      assertEquals(isSkippable('/help'), true);
    });
  });

  describe('Given: "[Request interrupted..."', () => {
    it('T-EC-SU-03-07: true を返す', () => {
      assertEquals(isSkippable('[Request interrupted by user]'), true);
    });
  });
});

// ─── isoToDate ────────────────────────────────────────────────────────────────

describe('isoToDate', () => {
  describe('Given: 有効な ISO 日付 "2026-03-15T12:00:00Z"', () => {
    it('T-EC-SU-04-01: "2026-03-15" を返す', () => {
      assertEquals(isoToDate('2026-03-15T12:00:00Z'), '2026-03-15');
    });
  });

  describe('Given: 無効な文字列 "not-a-date"', () => {
    it('T-EC-SU-04-02: "unknown" を返す', () => {
      assertEquals(isoToDate('not-a-date'), 'unknown');
    });
  });
});

// ─── isoToMs ─────────────────────────────────────────────────────────────────

describe('isoToMs', () => {
  describe('Given: 有効な ISO 日付 "2026-03-15T00:00:00Z"', () => {
    it('T-EC-SU-05-01: 正のミリ秒整数を返す', () => {
      const ms = isoToMs('2026-03-15T00:00:00Z');
      assertEquals(ms > 0, true);
      assertEquals(typeof ms, 'number');
    });
  });

  describe('Given: 無効な文字列 "bad"', () => {
    it('T-EC-SU-05-02: NaN を返す（invalid date）', () => {
      const result = isoToMs('bad');
      assertEquals(Number.isNaN(result), true);
    });
  });
});
