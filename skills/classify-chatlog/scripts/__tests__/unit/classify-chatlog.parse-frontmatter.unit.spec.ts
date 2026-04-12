// src: scripts/__tests__/unit/classify-chatlog.parseFrontmatter.unit.spec.ts
// @(#): parseFrontmatter のユニットテスト (classify-chatlog 専用)
//       topics/tags リスト対応・frontmatterEnd インデックス付き
//       ※ normalize-chatlog.ts の parseFrontmatter とは戻り値型が異なる
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { parseFrontmatter } from '../../classify-chatlog.ts';

// ─── 基本フィールドの解析 ─────────────────────────────────────────────────────

describe('parseFrontmatter', () => {
  describe('Given: title と category を含む基本的なフロントマターテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-01 - 基本フィールドの解析', () => {
        it('T-CL-PF-01-01: title が正しく解析される', () => {
          const text = '---\ntitle: API設計\ncategory: dev\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.title, 'API設計');
        });

        it('T-CL-PF-01-02: category が正しく解析される', () => {
          const text = '---\ntitle: API設計\ncategory: dev\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.category, 'dev');
        });

        it('T-CL-PF-01-03: topics がフィールドなしのとき空配列である', () => {
          const text = '---\ntitle: API設計\ncategory: dev\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.topics, []);
        });

        it('T-CL-PF-01-04: tags がフィールドなしのとき空配列である', () => {
          const text = '---\ntitle: API設計\ncategory: dev\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.tags, []);
        });
      });
    });
  });

  // ─── topics リストの解析 ───────────────────────────────────────────────────

  describe('Given: topics リストを含むフロントマターテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-02 - topics リストの解析', () => {
        it('T-CL-PF-02-01: topics が正しいリストとして解析される', () => {
          const text = '---\ntitle: test\ntopics:\n  - API\n  - 設計\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.topics, ['API', '設計']);
        });
      });
    });
  });

  // ─── tags リストの解析 ─────────────────────────────────────────────────────

  describe('Given: tags リストを含むフロントマターテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-03 - tags リストの解析', () => {
        it('T-CL-PF-03-01: tags が正しいリストとして解析される', () => {
          const text = '---\ntitle: test\ntags:\n  - typescript\n  - deno\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.tags, ['typescript', 'deno']);
        });
      });
    });
  });

  // ─── topics と tags が両方存在する ────────────────────────────────────────

  describe('Given: topics と tags が両方存在するフロントマターテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-04 - topics と tags の相互汚染なし', () => {
        it('T-CL-PF-04-01: topics は topics の値のみを持つ', () => {
          const text = '---\ntopics:\n  - API\ntags:\n  - typescript\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.topics, ['API']);
        });

        it('T-CL-PF-04-02: tags は tags の値のみを持つ', () => {
          const text = '---\ntopics:\n  - API\ntags:\n  - typescript\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.tags, ['typescript']);
        });
      });
    });
  });

  // ─── project フィールドの解析 ─────────────────────────────────────────────

  describe('Given: project フィールドを含むフロントマターテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-05 - project フィールドの解析', () => {
        it('T-CL-PF-05-01: project が正しく解析される', () => {
          const text = '---\nproject: my-app\ntitle: test\n---\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.project, 'my-app');
        });
      });
    });
  });

  // ─── frontmatterEnd の正確性 ──────────────────────────────────────────────

  describe('Given: フロントマターブロックを含むテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-06 - frontmatterEnd の正確性', () => {
        it('T-CL-PF-06-01: frontmatterEnd が本文開始位置を指す', () => {
          const text = '---\ntitle: test\n---\nHello World';

          const result = parseFrontmatter(text);

          assertEquals(text.slice(result.frontmatterEnd), 'Hello World');
        });
      });
    });
  });

  // ─── frontmatter なし ─────────────────────────────────────────────────────

  describe('Given: --- で始まらない Markdown テキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-07 - frontmatter なし → 全フィールド空', () => {
        it('T-CL-PF-07-01: title が空文字列である', () => {
          const text = '# タイトル\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.title, '');
        });

        it('T-CL-PF-07-02: frontmatterEnd が 0 である', () => {
          const text = '# タイトル\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.frontmatterEnd, 0);
        });

        it('T-CL-PF-07-03: topics が空配列である', () => {
          const text = '# タイトル\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.topics, []);
        });
      });
    });
  });

  // ─── 閉じ --- がない不正なフロントマター ──────────────────────────────────

  describe('Given: --- で始まるが閉じ --- がない不正なテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-08 - 不正な frontmatter → 全フィールド空', () => {
        it('T-CL-PF-08-01: title が空文字列である', () => {
          const text = '---\ntitle: foo\n';

          const result = parseFrontmatter(text);

          assertEquals(result.title, '');
        });

        it('T-CL-PF-08-02: frontmatterEnd が 0 である', () => {
          const text = '---\ntitle: foo\n';

          const result = parseFrontmatter(text);

          assertEquals(result.frontmatterEnd, 0);
        });
      });
    });
  });

  // ─── CRLF 改行の正規化 ────────────────────────────────────────────────────

  describe('Given: CRLF 改行を含むフロントマターテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-CL-PF-09 - CRLF 改行の正規化', () => {
        it('T-CL-PF-09-01: CRLF 改行でも title が正しく解析される', () => {
          const text = '---\r\ntitle: CRLF test\r\ncategory: dev\r\n---\r\n本文';

          const result = parseFrontmatter(text);

          assertEquals(result.title, 'CRLF test');
        });
      });
    });
  });
});
