// src: skills/_scripts/classes/__tests__/unit/ChatlogFrontmatter.unit.spec.ts
// @(#): ChatlogFrontmatter ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
// -- test target --
import { ChatlogFrontmatter } from '../../ChatlogFrontmatter.class.ts';

// ─────────────────────────────────────────────
// ChatlogFrontmatter
// ─────────────────────────────────────────────

describe('ChatlogFrontmatter', () => {
  describe('Given: title と category を含む frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-01 - title, category が entries に格納される', () => {
        it('T-CLS-CF-01: 基本フィールド（string）のパース', () => {
          const text = '---\ntitle: Hello\ncategory: dev\n---\nbody text';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('title'), 'Hello');
          assertEquals(fm.get('category'), 'dev');
        });
      });
    });
  });

  describe('Given: tags に配列を含む frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-02 - tags が string[] として entries に格納される', () => {
        it('T-CLS-CF-02: 配列フィールドのパース', () => {
          const text = '---\ntags:\n  - foo\n  - bar\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('tags'), ['foo', 'bar']);
        });
      });
    });
  });

  describe('Given: frontmatter なしのプレーンテキスト', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-03 - entries が空になる', () => {
        it('T-CLS-CF-03: frontmatter なし', () => {
          const text = 'plain text without frontmatter';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('title'), undefined);
        });
      });
    });
  });

  describe('Given: count に数値を含む frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-04 - count が文字列 "42" として entries に格納される', () => {
        it('T-CLS-CF-04: 数値フィールドが文字列に変換される', () => {
          const text = '---\ncount: 42\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('count'), '42');
        });
      });
    });
  });

  describe('Given: date フィールドを含む frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-05 - date が YYYY-MM-DD 文字列として entries に格納される', () => {
        it('T-CLS-CF-05: Date フィールドが YYYY-MM-DD 文字列に変換される', () => {
          const text = '---\ndate: 2026-03-15\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('date'), '2026-03-15');
        });
      });
    });
  });

  describe('Given: CRLF 改行を含む frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-06 - CRLF でも正しくパースされる', () => {
        it('T-CLS-CF-06: CRLF 改行の正規化', () => {
          const text = '---\r\ntitle: Hello\r\ncategory: dev\r\n---\r\nbody text';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('title'), 'Hello');
          assertEquals(fm.get('category'), 'dev');
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: new ChatlogFrontmatter("") を呼び出す', () => {
      describe('Then: T-CLS-CF-07 - entries が空になる', () => {
        it('T-CLS-CF-07: 空文字列入力', () => {
          const fm = new ChatlogFrontmatter('');
          assertEquals(fm.get('title'), undefined);
        });
      });
    });
  });

  describe('Given: 閉じ --- なしの不完全な frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-08 - entries が空になる', () => {
        it('T-CLS-CF-08: 閉じ --- なし', () => {
          const text = '---\ntitle: Hello\nno closing separator';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('title'), undefined);
        });
      });
    });
  });

  describe('Given: 不正な YAML を含む frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-09 - entries が空になる', () => {
        it('T-CLS-CF-09: YAML パース失敗（不正な YAML）', () => {
          const text = '---\n: invalid: yaml: {\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('title'), undefined);
        });
      });
    });
  });

  describe('Given: tags に null 混入配列（~ を含む）を含む frontmatter ブロック', () => {
    describe('When: new ChatlogFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CLS-CF-10 - null 要素が空文字列に変換される', () => {
        it('T-CLS-CF-10: null 混入配列の null 要素が空文字列に変換される', () => {
          const text = '---\ntags:\n  - foo\n  - ~\n  - bar\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('tags'), ['foo', '', 'bar']);
        });
      });
    });
  });

  describe('Given: title を含む frontmatter ブロック', () => {
    describe('When: get("title") を呼び出す', () => {
      describe('Then: T-CLS-CF-11 - title の文字列値が返る', () => {
        it('T-CLS-CF-11: [正常] - 存在するキーの文字列値を返す', () => {
          const text = '---\ntitle: Hello\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('title'), 'Hello');
        });
      });
    });
  });

  describe('Given: tags に配列を含む frontmatter ブロック', () => {
    describe('When: get("tags") を呼び出す', () => {
      describe('Then: T-CLS-CF-12 - tags の配列値が返る', () => {
        it('T-CLS-CF-12: [正常] - 存在するキーの配列値を返す', () => {
          const text = '---\ntags:\n  - foo\n  - bar\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('tags'), ['foo', 'bar']);
        });
      });
    });
  });

  describe('Given: title のみを含む frontmatter ブロック', () => {
    describe('When: get("missing") を呼び出す', () => {
      describe('Then: T-CLS-CF-13 - undefined が返る', () => {
        it('T-CLS-CF-13: [正常] - 存在しないキーは undefined を返す', () => {
          const text = '---\ntitle: Hello\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          assertEquals(fm.get('missing'), undefined);
        });
      });
    });
  });

  describe('Given: 空の ChatlogFrontmatter', () => {
    describe('When: set("title", "Hello") を呼び出す', () => {
      describe('Then: T-CLS-CF-14 - title が "Hello" になる', () => {
        it('T-CLS-CF-14: [正常] - 新規キーに文字列をセットできる', () => {
          const fm = new ChatlogFrontmatter('');
          fm.set('title', 'Hello');
          assertEquals(fm.get('title'), 'Hello');
        });
      });
    });
  });

  describe('Given: title: "Old" を含む frontmatter ブロック', () => {
    describe('When: set("title", "New") を呼び出す', () => {
      describe('Then: T-CLS-CF-15 - title が "New" に上書きされる', () => {
        it('T-CLS-CF-15: [正常] - 既存キーを上書きできる', () => {
          const text = '---\ntitle: Old\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          fm.set('title', 'New');
          assertEquals(fm.get('title'), 'New');
        });
      });
    });
  });

  describe('Given: 空の ChatlogFrontmatter', () => {
    describe('When: set("tags", ["foo", "bar"]) を呼び出す', () => {
      describe('Then: T-CLS-CF-16 - tags が ["foo", "bar"] になる', () => {
        it('T-CLS-CF-16: [正常] - 新規キーに配列をセットできる', () => {
          const fm = new ChatlogFrontmatter('');
          fm.set('tags', ['foo', 'bar']);
          assertEquals(fm.get('tags'), ['foo', 'bar']);
        });
      });
    });
  });

  describe('Given: 空の ChatlogFrontmatter', () => {
    describe('When: set("title", "") を呼び出す', () => {
      describe('Then: T-CLS-CF-17 - title が空文字列になる（有効な値）', () => {
        it('T-CLS-CF-17: [エッジケース] - 空文字列をセットできる', () => {
          const fm = new ChatlogFrontmatter('');
          fm.set('title', '');
          assertEquals(fm.get('title'), '');
        });
      });
    });
  });

  describe('Given: 空の ChatlogFrontmatter', () => {
    describe('When: set("tags", []) を呼び出す', () => {
      describe('Then: T-CLS-CF-18 - tags が空配列になる（有効な値）', () => {
        it('T-CLS-CF-18: [エッジケース] - 空配列をセットできる', () => {
          const fm = new ChatlogFrontmatter('');
          fm.set('tags', []);
          assertEquals(fm.get('tags'), []);
        });
      });
    });
  });

  describe('Given: title を含む frontmatter ブロック', () => {
    describe('When: remove("title") を呼び出す', () => {
      describe('Then: T-CLS-CF-19 - title が削除され undefined になる', () => {
        it('T-CLS-CF-19: [正常] - 存在するキーを削除できる', () => {
          const text = '---\ntitle: Hello\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          fm.remove('title');
          assertEquals(fm.get('title'), undefined);
        });
      });
    });
  });

  describe('Given: 空の ChatlogFrontmatter', () => {
    describe('When: remove("missing") を呼び出す', () => {
      describe('Then: T-CLS-CF-20 - エラーにならず無視される', () => {
        it('T-CLS-CF-20: [エッジケース] - 存在しないキーへの呼び出しはエラーにならない', () => {
          const fm = new ChatlogFrontmatter('');
          fm.remove('missing');
          assertEquals(fm.get('missing'), undefined);
        });
      });
    });
  });

  describe('Given: 空の ChatlogFrontmatter', () => {
    describe('When: set("title", "Hello") してから toFrontmatter(["title"]) を呼び出す', () => {
      describe('Then: T-CLS-CF-21 - set したフィールドが toFrontmatter の出力に含まれる', () => {
        it('T-CLS-CF-21: [正常] - set で追加したフィールドが toFrontmatter に反映される', () => {
          const fm = new ChatlogFrontmatter('');
          fm.set('title', 'Hello');
          const result = fm.toFrontmatter(['title']);
          assertEquals(result, '---\ntitle: "Hello"\n---\n');
        });
      });
    });
  });

  describe('Given: title を含む frontmatter ブロック', () => {
    describe('When: remove("title") してから toFrontmatter(["title"]) を呼び出す', () => {
      describe('Then: T-CLS-CF-22 - title が toFrontmatter の出力に含まれない', () => {
        it('T-CLS-CF-22: [正常] - remove で削除したフィールドが toFrontmatter に含まれない', () => {
          const text = '---\ntitle: Hello\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          fm.remove('title');
          const result = fm.toFrontmatter(['title']);
          assertEquals(result, '---\n\n---\n');
        });
      });
    });
  });

  describe('Given: title と category を含む frontmatter ブロック', () => {
    describe('When: toFrontmatter() を引数なしで呼び出す', () => {
      describe('Then: T-CLS-CF-23 - DEFAULT_FIELD_ORDER に従い title → category の順で出力される', () => {
        it('T-CLS-CF-23: [正常] - fieldOrder 省略時は _DEFAULT_FIELD_ORDER が使われる', () => {
          const text = '---\ntitle: Hello\ncategory: dev\n---\nbody';
          const fm = new ChatlogFrontmatter(text);
          const result = fm.toFrontmatter();
          assertEquals(result, '---\ntitle: "Hello"\ncategory: "dev"\n---\n');
        });
      });
    });
  });
});
