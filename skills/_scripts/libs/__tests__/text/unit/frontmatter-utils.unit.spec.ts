// src: skills/_scripts/libs/__tests__/unit/frontmatter-utils.unit.spec.ts
// @(#): frontmatter-utils ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- test target --
import { extractFrontmatter } from '../../../text/frontmatter-utils.ts';

// ─────────────────────────────────────────────
// extractFrontmatter
// ─────────────────────────────────────────────

describe('extractFrontmatter', () => {
  describe('Given: title と category を含む frontmatter ブロック', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-01 - title, category が正しく取得できる', () => {
        it('T-LIB-FM-01: 基本フィールド（string）のパース', () => {
          const text = '---\ntitle: Hello\ncategory: dev\n---\nbody text';
          const result = extractFrontmatter(text);
          assertEquals(result.meta['title'], 'Hello');
          assertEquals(result.meta['category'], 'dev');
        });
      });
    });
  });

  describe('Given: topics に配列を含む frontmatter ブロック', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-02 - topics が配列として取得できる', () => {
        it('T-LIB-FM-02: 配列フィールドのパース', () => {
          const text = '---\ntopics:\n  - alpha\n  - beta\n---\nbody';
          const result = extractFrontmatter(text);
          assertEquals(result.meta['topics'], ['alpha', 'beta']);
        });
      });
    });
  });

  describe('Given: frontmatter と本文を含むテキスト', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-03 - frontmatterEnd が本文開始位置と一致する', () => {
        it('T-LIB-FM-03: frontmatterEnd の正確性', () => {
          // "---\ntitle: Hi\n" = 14 chars (index 0-13)
          // "\n---\n" starts at index 13, length 5 → frontmatterEnd = 13 + 5 = 18
          const text = '---\ntitle: Hi\n---\nbody text';
          const result = extractFrontmatter(text);
          // frontmatterEnd should point to the start of "body text" = index 18
          assertEquals(result.frontmatterEnd, 18);
        });
      });
    });
  });

  describe('Given: frontmatter と複数行の本文を含むテキスト', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-04 - body が frontmatter 以降の本文と一致する', () => {
        it('T-LIB-FM-04: body の正確性', () => {
          const text = '---\ntitle: Hello\n---\nThis is the body.\nSecond line.';
          const result = extractFrontmatter(text);
          assertEquals(result.body, 'This is the body.\nSecond line.');
        });
      });
    });
  });

  describe('Given: ---\\n で始まらないプレーンテキスト', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-05 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-05: frontmatter なし（---\\n で始まらない）', () => {
          const text = 'This is plain text without frontmatter.';
          const result = extractFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.body, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 開き --- はあるが閉じ --- がないテキスト', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-06 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-06: 閉じ --- なし', () => {
          const text = '---\ntitle: Hello\nno closing separator';
          const result = extractFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.body, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: CRLF 改行を含む frontmatter ブロック', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-07 - CRLF でも正しくパースされる', () => {
        it('T-LIB-FM-07: CRLF 改行の正規化', () => {
          const text = '---\r\ntitle: Hello\r\ncategory: dev\r\n---\r\nbody text';
          const result = extractFrontmatter(text);
          assertEquals(result.meta['title'], 'Hello');
          assertEquals(result.meta['category'], 'dev');
        });
      });
    });
  });

  describe('Given: 空の frontmatter ブロック（---\\n---\\n の形式）', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-08 - meta:{}, body が後続テキストになる', () => {
        it('T-LIB-FM-08: 空の frontmatter ブロック', () => {
          const text = '---\n---\nafter body';
          const result = extractFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.body, 'after body');
        });
      });
    });
  });

  describe('Given: 不正な YAML を含む frontmatter ブロック', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-09 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-09: YAML パース失敗（不正な YAML）', () => {
          const text = '---\n: invalid: yaml: {\n---\nbody';
          const result = extractFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.body, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 数値フィールドを含む frontmatter ブロック', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-10 - count が number として取得できる', () => {
        it('T-LIB-FM-10: 数値フィールド', () => {
          const text = '---\ncount: 42\n---\nbody';
          const result = extractFrontmatter(text);
          assertEquals(result.meta['count'], 42);
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: extractFrontmatter("") を呼び出す', () => {
      describe('Then: T-LIB-FM-11 - meta:{}, body="", frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-11: 空文字列入力', () => {
          const result = extractFrontmatter('');
          assertEquals(result.meta, {});
          assertEquals(result.body, '');
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 開き --- のみで本文も閉じ --- もないテキスト', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-12 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-12: 開き --- のみ（EOF）', () => {
          const text = '---\n';
          const result = extractFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.body, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 閉じ区切りが \\n--- で終わり末尾改行なしのテキスト', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-13 - \\n---\\n にマッチしないため失敗パス', () => {
        it('T-LIB-FM-13: 末尾改行なしの閉じ ---', () => {
          const text = '---\ntitle: Hello\n---';
          const result = extractFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.body, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: frontmatter のみで本文が空のテキスト', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-14 - body が空文字列で frontmatterEnd が正しい', () => {
        it('T-LIB-FM-14: frontmatter 後の本文が空', () => {
          const text = '---\ntitle: Hello\n---\n';
          const result = extractFrontmatter(text);
          assertEquals(result.meta['title'], 'Hello');
          assertEquals(result.body, '');
          assertEquals(result.frontmatterEnd, text.length);
        });
      });
    });
  });

  describe('Given: CRLF 改行を含む frontmatter ブロック', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-15 - body と frontmatterEnd も正しく取得できる', () => {
        it('T-LIB-FM-15: CRLF 正規化後の body と frontmatterEnd', () => {
          // CRLF を LF に正規化してから処理するため、frontmatterEnd は正規化後の位置
          // "---\ntitle: Hi\n---\n" = 18 chars → frontmatterEnd=18, body=""
          const text = '---\r\ntitle: Hi\r\n---\r\nbody text';
          const result = extractFrontmatter(text);
          assertEquals(result.meta['title'], 'Hi');
          assertEquals(result.body, 'body text');
          assertEquals(result.frontmatterEnd, 18);
        });
      });
    });
  });

  describe('Given: YAML 値の中に --- を含む frontmatter ブロック', () => {
    describe('When: extractFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-16 - 値内の --- を区切りと誤認しない', () => {
        it('T-LIB-FM-16: YAML 値内に --- を含む（quoted string）', () => {
          const text = '---\nsummary: "foo --- bar"\n---\nbody';
          const result = extractFrontmatter(text);
          assertEquals(result.meta['summary'], 'foo --- bar');
          assertEquals(result.body, 'body');
        });
      });
    });
  });
});
