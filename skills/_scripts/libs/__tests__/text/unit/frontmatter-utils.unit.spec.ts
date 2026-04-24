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
import { parseFrontmatter, parseFrontmatterEntries } from '../../../text/frontmatter-utils.ts';

// ─────────────────────────────────────────────
// parseFrontmatter
// ─────────────────────────────────────────────

describe('parseFrontmatter', () => {
  describe('Given: title と category を含む frontmatter ブロック', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-01 - title, category が正しく取得できる', () => {
        it('T-LIB-FM-01: 基本フィールド（string）のパース', () => {
          const text = '---\ntitle: Hello\ncategory: dev\n---\nbody text';
          const result = parseFrontmatter(text);
          assertEquals(result.meta['title'], 'Hello');
          assertEquals(result.meta['category'], 'dev');
        });
      });
    });
  });

  describe('Given: topics に配列を含む frontmatter ブロック', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-02 - topics が配列として取得できる', () => {
        it('T-LIB-FM-02: 配列フィールドのパース', () => {
          const text = '---\ntopics:\n  - alpha\n  - beta\n---\nbody';
          const result = parseFrontmatter(text);
          assertEquals(result.meta['topics'], ['alpha', 'beta']);
        });
      });
    });
  });

  describe('Given: frontmatter と本文を含むテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-03 - frontmatterEnd が本文開始位置と一致する', () => {
        it('T-LIB-FM-03: frontmatterEnd の正確性', () => {
          // "---\ntitle: Hi\n" = 14 chars (index 0-13)
          // "\n---\n" starts at index 13, length 5 → frontmatterEnd = 13 + 5 = 18
          const text = '---\ntitle: Hi\n---\nbody text';
          const result = parseFrontmatter(text);
          // frontmatterEnd should point to the start of "body text" = index 18
          assertEquals(result.frontmatterEnd, 18);
        });
      });
    });
  });

  describe('Given: frontmatter と複数行の本文を含むテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-04 - body が frontmatter 以降の本文と一致する', () => {
        it('T-LIB-FM-04: body の正確性', () => {
          const text = '---\ntitle: Hello\n---\nThis is the body.\nSecond line.';
          const result = parseFrontmatter(text);
          assertEquals(result.content, 'This is the body.\nSecond line.');
        });
      });
    });
  });

  describe('Given: ---\\n で始まらないプレーンテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-05 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-05: frontmatter なし（---\\n で始まらない）', () => {
          const text = 'This is plain text without frontmatter.';
          const result = parseFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.content, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 開き --- はあるが閉じ --- がないテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-06 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-06: 閉じ --- なし', () => {
          const text = '---\ntitle: Hello\nno closing separator';
          const result = parseFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.content, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: CRLF 改行を含む frontmatter ブロック', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-07 - CRLF でも正しくパースされる', () => {
        it('T-LIB-FM-07: CRLF 改行の正規化', () => {
          const text = '---\r\ntitle: Hello\r\ncategory: dev\r\n---\r\nbody text';
          const result = parseFrontmatter(text);
          assertEquals(result.meta['title'], 'Hello');
          assertEquals(result.meta['category'], 'dev');
        });
      });
    });
  });

  describe('Given: 空の frontmatter ブロック（---\\n---\\n の形式）', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-08 - meta:{}, body が後続テキストになる', () => {
        it('T-LIB-FM-08: 空の frontmatter ブロック', () => {
          const text = '---\n---\nafter body';
          const result = parseFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.content, 'after body');
        });
      });
    });
  });

  describe('Given: 不正な YAML を含む frontmatter ブロック', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-09 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-09: YAML パース失敗（不正な YAML）', () => {
          const text = '---\n: invalid: yaml: {\n---\nbody';
          const result = parseFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.content, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 数値フィールドを含む frontmatter ブロック', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-10 - count が number として取得できる', () => {
        it('T-LIB-FM-10: 数値フィールド', () => {
          const text = '---\ncount: 42\n---\nbody';
          const result = parseFrontmatter(text);
          assertEquals(result.meta['count'], 42);
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: parseFrontmatter("") を呼び出す', () => {
      describe('Then: T-LIB-FM-11 - meta:{}, body="", frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-11: 空文字列入力', () => {
          const result = parseFrontmatter('');
          assertEquals(result.meta, {});
          assertEquals(result.content, '');
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 開き --- のみで本文も閉じ --- もないテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-12 - meta:{}, body=text, frontmatterEnd=0 が返る', () => {
        it('T-LIB-FM-12: 開き --- のみ（EOF）', () => {
          const text = '---\n';
          const result = parseFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.content, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: 閉じ区切りが \\n--- で終わり末尾改行なしのテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-13 - \\n---\\n にマッチしないため失敗パス', () => {
        it('T-LIB-FM-13: 末尾改行なしの閉じ ---', () => {
          const text = '---\ntitle: Hello\n---';
          const result = parseFrontmatter(text);
          assertEquals(result.meta, {});
          assertEquals(result.content, text);
          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  describe('Given: frontmatter のみで本文が空のテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-14 - body が空文字列で frontmatterEnd が正しい', () => {
        it('T-LIB-FM-14: frontmatter 後の本文が空', () => {
          const text = '---\ntitle: Hello\n---\n';
          const result = parseFrontmatter(text);
          assertEquals(result.meta['title'], 'Hello');
          assertEquals(result.content, '');
          assertEquals(result.frontmatterEnd, text.length);
        });
      });
    });
  });

  describe('Given: CRLF 改行を含む frontmatter ブロック', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-15 - body と frontmatterEnd も正しく取得できる', () => {
        it('T-LIB-FM-15: CRLF 正規化後の body と frontmatterEnd', () => {
          // CRLF を LF に正規化してから処理するため、frontmatterEnd は正規化後の位置
          // "---\ntitle: Hi\n---\n" = 18 chars → frontmatterEnd=18, body=""
          const text = '---\r\ntitle: Hi\r\n---\r\nbody text';
          const result = parseFrontmatter(text);
          assertEquals(result.meta['title'], 'Hi');
          assertEquals(result.content, 'body text');
          assertEquals(result.frontmatterEnd, 18);
        });
      });
    });
  });

  describe('Given: YAML 値の中に --- を含む frontmatter ブロック', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-LIB-FM-16 - 値内の --- を区切りと誤認しない', () => {
        it('T-LIB-FM-16: YAML 値内に --- を含む（quoted string）', () => {
          const text = '---\nsummary: "foo --- bar"\n---\nbody';
          const result = parseFrontmatter(text);
          assertEquals(result.meta['summary'], 'foo --- bar');
          assertEquals(result.content, 'body');
        });
      });
    });
  });
});

// ─────────────────────────────────────────────
// parseFrontmatterEntries
// ─────────────────────────────────────────────

describe('parseFrontmatterEntries', () => {
  describe('Given: 基本的な文字列フィールドを持つ frontmatter', () => {
    describe('When: parseFrontmatterEntries(text) を呼び出す', () => {
      describe('Then: T-LIB-FSM-01 - 文字列フィールドが正しく取得できる', () => {
        it('T-LIB-FSM-01: 基本文字列フィールドのパース', () => {
          const text = '---\ntitle: Hello\nproject: my-proj\n---\nbody text';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta['title'], 'Hello');
          assertEquals(result.meta['project'], 'my-proj');
        });
      });
    });
  });

  describe('Given: date フィールドを含む frontmatter', () => {
    describe('When: parseFrontmatterEntries(text) を呼び出す', () => {
      describe('Then: T-LIB-FSM-02 - date が YYYY-MM-DD 文字列として返る', () => {
        it('T-LIB-FSM-02: Date オブジェクトが YYYY-MM-DD 文字列に変換される', () => {
          const text = '---\ndate: 2026-03-15\n---\nbody';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta['date'], '2026-03-15');
        });
      });
    });
  });

  describe('Given: 数値フィールドを含む frontmatter', () => {
    describe('When: parseFrontmatterEntries(text) を呼び出す', () => {
      describe('Then: T-LIB-FSM-03 - 数値が文字列として返る', () => {
        it('T-LIB-FSM-03: 数値フィールドが文字列に変換される', () => {
          const text = '---\ncount: 42\n---\nbody';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta['count'], '42');
        });
      });
    });
  });

  describe('Given: frontmatter のないプレーンテキスト', () => {
    describe('When: parseFrontmatterEntries(text) を呼び出す', () => {
      describe('Then: T-LIB-FSM-04 - meta={}, body=元テキスト が返る', () => {
        it('T-LIB-FSM-04: frontmatter なし', () => {
          const text = 'plain text without frontmatter';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta, {});
          assertEquals(result.content, text);
        });
      });
    });
  });

  describe('Given: frontmatter と本文を含むテキスト', () => {
    describe('When: parseFrontmatterEntries(text) を呼び出す', () => {
      describe('Then: T-LIB-FSM-05 - body が frontmatter 後のテキストと一致する', () => {
        it('T-LIB-FSM-05: body の正確性', () => {
          const text = '---\ntitle: Hello\n---\n# 本文\n内容';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.content, '# 本文\n内容');
        });
      });
    });
  });

  describe('Given: 配列フィールドを含む frontmatter', () => {
    describe('When: parseFrontmatterEntries(text) を呼び出す', () => {
      describe('Then: T-LIB-FSM-06 - 配列フィールドが string[] として返る', () => {
        it('T-LIB-FSM-06-01: 複数要素配列が順序保持で string[] に変換される', () => {
          const text = '---\ntags:\n  - foo\n  - bar\n---\nbody';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta['tags'], ['foo', 'bar']);
        });

        it('T-LIB-FSM-06-02: 単一要素配列が string[] に変換される', () => {
          const text = '---\ntags:\n  - foo\n---\nbody';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta['tags'], ['foo']);
        });

        it('T-LIB-FSM-06-03: 空配列が [] として返る', () => {
          const text = '---\ntags: []\n---\nbody';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta['tags'], []);
        });

        it('T-LIB-FSM-06-04: null 混入配列の null 要素が空文字列に変換される', () => {
          const text = '---\ntags:\n  - foo\n  - ~\n  - bar\n---\nbody';
          const result = parseFrontmatterEntries(text);
          assertEquals(result.meta['tags'], ['foo', '', 'bar']);
        });
      });
    });
  });
});
