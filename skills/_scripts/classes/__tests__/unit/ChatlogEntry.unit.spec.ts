// src: skills/_scripts/classes/__tests__/unit/ChatlogEntry.unit.spec.ts
// @(#): ChatlogEntry ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals, assertThrows } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
// -- error class --
import { ChatlogError } from '../../ChatlogError.class.ts';
// -- test target --
import { ChatlogEntry } from '../../ChatlogEntry.class.ts';

// ─────────────────────────────────────────────
// ChatlogEntry
// ─────────────────────────────────────────────

describe('ChatlogEntry', () => {
  describe('Given: title と category を含む frontmatter + body の Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-01 - frontmatter.get("title") が正しい値を返す', () => {
        it('T-CLS-CE-01: frontmatter フィールドのパース', () => {
          const text = '---\ntitle: Hello\ncategory: dev\n---\nbody text\n';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.frontmatter.get('title'), 'Hello');
          assertEquals(entry.frontmatter.get('category'), 'dev');
        });
      });
    });
  });

  describe('Given: frontmatter + body の Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-02 - content が本文のみ（frontmatter を除く）', () => {
        it('T-CLS-CE-02: content に本文のみが格納される', () => {
          const text = '---\ntitle: Hello\n---\nbody text\n';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.content, 'body text\n');
        });
      });
    });
  });

  describe('Given: frontmatter なしのプレーンテキスト', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-03 - frontmatter は空、content は末尾 \\n 付きテキスト全体', () => {
        it('T-CLS-CE-03: frontmatter なし入力', () => {
          const text = 'plain text without frontmatter';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.frontmatter.get('title'), undefined);
          assertEquals(entry.content, 'plain text without frontmatter\n');
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: new ChatlogEntry("") を呼び出す', () => {
      describe('Then: T-CLS-CE-04 - frontmatter は空、content は空文字列', () => {
        it('T-CLS-CE-04: 空文字列入力', () => {
          const entry = new ChatlogEntry('');
          assertEquals(entry.frontmatter.get('title'), undefined);
          assertEquals(entry.content, '');
        });
      });
    });
  });

  describe('Given: CRLF 改行を含む frontmatter + body の Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-05 - content が正しく取り出される', () => {
        it('T-CLS-CE-05: CRLF 改行の正規化', () => {
          const text = '---\r\ntitle: Hello\r\n---\r\nbody text\r\n';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.frontmatter.get('title'), 'Hello');
          assertEquals(entry.content, 'body text\n');
        });
      });
    });
  });

  describe('Given: frontmatter + body の Markdown', () => {
    describe('When: renderEntry() を引数なしで呼び出す', () => {
      describe('Then: T-CLS-CE-06 - フロントマター + 空行 + 本文の形式で出力される', () => {
        it('T-CLS-CE-06: renderEntry() の基本出力形式', () => {
          const text = '---\ntitle: Hello\n---\nbody text\n';
          const entry = new ChatlogEntry(text);
          const result = entry.renderEntry(['title']);
          assertEquals(result, '---\ntitle: "Hello"\n---\n\nbody text\n');
        });
      });
    });
  });

  describe('Given: frontmatter のみで body が空の Markdown', () => {
    describe('When: renderEntry() を呼び出す', () => {
      describe('Then: T-CLS-CE-07 - フロントマター + 空行で終わる出力', () => {
        it('T-CLS-CE-07: body が空の場合の renderEntry() 出力', () => {
          const text = '---\ntitle: Hello\n---\n';
          const entry = new ChatlogEntry(text);
          const result = entry.renderEntry(['title']);
          assertEquals(result, '---\ntitle: "Hello"\n---\n');
        });
      });
    });
  });

  describe('Given: ChatlogEntry 構築後に frontmatter.set() で値を変更', () => {
    describe('When: renderEntry() を呼び出す', () => {
      describe('Then: T-CLS-CE-08 - 変更後の title が出力に反映される', () => {
        it('T-CLS-CE-08: frontmatter 変更が renderEntry() に反映される', () => {
          const text = '---\ntitle: Old\n---\nbody\n';
          const entry = new ChatlogEntry(text);
          entry.frontmatter.set('title', 'New');
          const result = entry.renderEntry(['title']);
          assertEquals(result, '---\ntitle: "New"\n---\n\nbody\n');
        });
      });
    });
  });

  describe('Given: frontmatter + body の Markdown', () => {
    describe('When: renderEntry(["title"]) と fieldOrder を指定して呼び出す', () => {
      describe('Then: T-CLS-CE-09 - fieldOrder が toFrontmatter に渡され指定フィールドのみ出力', () => {
        it('T-CLS-CE-09: fieldOrder 指定が renderEntry() に反映される', () => {
          const text = '---\ntitle: Hello\ncategory: dev\n---\nbody\n';
          const entry = new ChatlogEntry(text);
          const result = entry.renderEntry(['title']);
          assertEquals(result, '---\ntitle: "Hello"\n---\n\nbody\n');
        });
      });
    });
  });

  describe('Given: tags に配列を含む frontmatter + body の Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-10 - tags が string[] として取得できる', () => {
        it('T-CLS-CE-10: 配列フィールドのパース', () => {
          const text = '---\ntags:\n  - foo\n  - bar\n---\nbody';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.frontmatter.get('tags'), ['foo', 'bar']);
        });
      });
    });
  });

  describe('Given: count に数値を含む frontmatter + body の Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-11 - count が文字列 "42" として取得できる', () => {
        it('T-CLS-CE-11: 数値フィールドが文字列に変換される', () => {
          const text = '---\ncount: 42\n---\nbody';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.frontmatter.get('count'), '42');
        });
      });
    });
  });

  describe('Given: date フィールドを含む frontmatter + body の Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-12 - date が YYYY-MM-DD 文字列として取得できる', () => {
        it('T-CLS-CE-12: Date フィールドが YYYY-MM-DD 文字列に変換される', () => {
          const text = '---\ndate: 2026-03-15\n---\nbody';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.frontmatter.get('date'), '2026-03-15');
        });
      });
    });
  });

  describe('Given: 閉じ --- なしの不完全な frontmatter ブロック', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-13 - InvalidFormat を throw する', () => {
        it('T-CLS-CE-13: 閉じ --- なし入力では InvalidFormat を throw する', () => {
          const text = '---\ntitle: Hello\nno closing separator';
          const err = assertThrows(
            () => new ChatlogEntry(text),
            ChatlogError,
          );
          assertEquals(err.kind, 'InvalidFormat');
        });
      });
    });
  });

  describe('Given: 不正な YAML を含む frontmatter ブロック', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-14 - InvalidYaml を throw する', () => {
        it('T-CLS-CE-14: YAML パース失敗時は InvalidYaml を throw する', () => {
          const text = '---\n: invalid: yaml: {\n---\nbody';
          const err = assertThrows(
            () => new ChatlogEntry(text),
            ChatlogError,
          );
          assertEquals(err.kind, 'InvalidYaml');
        });
      });
    });
  });

  describe('Given: tags に null 混入配列（~ を含む）を含む frontmatter ブロック', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-15 - null 要素が空文字列に変換される', () => {
        it('T-CLS-CE-15: null 混入配列の null 要素が空文字列に変換される', () => {
          const text = '---\ntags:\n  - foo\n  - ~\n  - bar\n---\nbody';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.frontmatter.get('tags'), ['foo', '', 'bar']);
        });
      });
    });
  });

  describe('Given: frontmatter の直後に複数の空行が続く Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-16 - content の先頭の複数改行が全て削除される', () => {
        it('T-CLS-CE-16: 先頭複数改行の削除', () => {
          const text = '---\ntitle: T\n---\n\n\nbody\n';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.content, 'body\n');
        });
      });
    });
  });

  describe('Given: frontmatter 後の本文末尾に複数の空行が続く Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-17 - content の末尾の複数改行が単一 \\n に正規化される', () => {
        it('T-CLS-CE-17: 末尾複数改行の正規化', () => {
          const text = '---\ntitle: T\n---\nbody\n\n\n';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.content, 'body\n');
        });
      });
    });
  });

  describe('Given: frontmatter 後の本文が改行のみの Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-18 - content が空文字列になる', () => {
        it('T-CLS-CE-18: 改行のみの本文は空文字列に正規化される', () => {
          const text = '---\ntitle: T\n---\n\n\n';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.content, '');
        });
      });
    });
  });

  describe('Given: frontmatter 後の本文中に空行を含む Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-19 - content の本文中の空行は保持される', () => {
        it('T-CLS-CE-19: 本文中空行の保持', () => {
          const text = '---\ntitle: T\n---\nline1\n\nline2\n';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.content, 'line1\n\nline2\n');
        });
      });
    });
  });

  describe('Given: frontmatter 後の本文が末尾改行なしの Markdown', () => {
    describe('When: new ChatlogEntry(text) を呼び出す', () => {
      describe('Then: T-CLS-CE-20 - content の末尾に \\n が付与される', () => {
        it('T-CLS-CE-20: 末尾改行なし入力への \\n 付与', () => {
          const text = '---\ntitle: T\n---\nbody';
          const entry = new ChatlogEntry(text);
          assertEquals(entry.content, 'body\n');
        });
      });
    });
  });

  describe('Given: frontmatter の直後に複数の空行が続く Markdown', () => {
    describe('When: renderEntry() を呼び出す', () => {
      describe('Then: T-CLS-CE-21 - 出力は先頭空行 1 つ + 本文の標準形になる', () => {
        it('T-CLS-CE-21: 先頭複数改行入力でも renderEntry() の出力は標準形', () => {
          const text = '---\ntitle: T\n---\n\n\n\nbody\n';
          const entry = new ChatlogEntry(text);
          const result = entry.renderEntry(['title']);
          assertEquals(result, '---\ntitle: "T"\n---\n\nbody\n');
        });
      });
    });
  });

  describe('Given: frontmatter 後の本文末尾に複数の空行が続く Markdown', () => {
    describe('When: renderEntry() を呼び出す', () => {
      describe('Then: T-CLS-CE-22 - 出力の本文末尾は単一 \\n のみになる', () => {
        it('T-CLS-CE-22: 末尾余剰改行入力でも renderEntry() の末尾は単一 \\n', () => {
          const text = '---\ntitle: T\n---\nbody\n\n\n';
          const entry = new ChatlogEntry(text);
          const result = entry.renderEntry(['title']);
          assertEquals(result, '---\ntitle: "T"\n---\n\nbody\n');
        });
      });
    });
  });
});
