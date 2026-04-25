// src: scripts/__tests__/unit/classify-chatlog.insertProjectField.unit.spec.ts
// @(#): insertProjectField のユニットテスト
//       date: 行の後に project: を挿入する / date: なしのとき先頭に挿入する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals, assertStringIncludes } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { insertProjectField } from '../../classify-chatlog.ts';

// ─── date: 行の後に project: を挿入する ──────────────────────────────────────

describe('insertProjectField', () => {
  describe('Given: date: 行を含む frontmatter テキスト', () => {
    describe('When: insertProjectField(text, "my-app") を呼び出す', () => {
      describe('Then: T-CL-IPF-01 - date: 行の後に project: を挿入する', () => {
        it('T-CL-IPF-01-01: 結果に "project: \'my-app\'" が含まれる', () => {
          const text = "---\ndate: '2026-03-01'\ntitle: 'foo'\n---\n本文";

          const result = insertProjectField(text, 'my-app');

          assertStringIncludes(result, "project: 'my-app'");
        });

        it('T-CL-IPF-01-02: "project: \'my-app\'" が "date: \'2026-03-01\'" の直後に挿入される', () => {
          const text = "---\ndate: '2026-03-01'\ntitle: 'foo'\n---\n本文";

          const result = insertProjectField(text, 'my-app');

          const lines = result.split('\n');
          const dateIdx = lines.findIndex((l) => l === "date: '2026-03-01'");
          assertEquals(lines[dateIdx + 1], "project: 'my-app'");
        });
      });
    });
  });

  // ─── date: なしのとき先頭に挿入する ──────────────────────────────────────

  describe('Given: date: 行のない frontmatter テキスト', () => {
    describe('When: insertProjectField(text, "my-app") を呼び出す', () => {
      describe('Then: T-CL-IPF-02 - date: なし → frontmatter 先頭に挿入する', () => {
        it('T-CL-IPF-02-01: 結果に "project: \'my-app\'" が含まれる', () => {
          const text = "---\ntitle: 'foo'\n---\n本文";

          const result = insertProjectField(text, 'my-app');

          assertStringIncludes(result, "project: 'my-app'");
        });

        it('T-CL-IPF-02-02: "project: \'my-app\'" が frontmatter の先頭行になる', () => {
          const text = "---\ntitle: 'foo'\n---\n本文";

          const result = insertProjectField(text, 'my-app');

          const lines = result.split('\n');
          // --- の次の行が project:
          assertEquals(lines[1], "project: 'my-app'");
        });
      });
    });
  });

  // ─── frontmatter なしのテキストはそのまま返す ─────────────────────────────

  describe('Given: --- で始まらない frontmatter なしテキスト', () => {
    describe('When: insertProjectField(text, "any") を呼び出す', () => {
      describe('Then: T-CL-IPF-03 - frontmatter なし → テキストをそのまま返す', () => {
        it('T-CL-IPF-03-01: 返却値が元のテキストと等しい', () => {
          const text = '# タイトル\n本文';

          const result = insertProjectField(text, 'any');

          assertEquals(result, text);
        });
      });
    });
  });

  // ─── 閉じ --- がない不正な frontmatter はそのまま返す ─────────────────────

  describe('Given: 閉じ --- がない不正な frontmatter テキスト', () => {
    describe('When: insertProjectField(text, "any") を呼び出す', () => {
      describe('Then: T-CL-IPF-04 - 不正な frontmatter → テキストをそのまま返す', () => {
        it('T-CL-IPF-04-01: 返却値が元のテキストと等しい', () => {
          const text = "---\ntitle: 'foo'\n";

          const result = insertProjectField(text, 'any');

          assertEquals(result, text);
        });
      });
    });
  });

  // ─── 本文部分が破損しない ─────────────────────────────────────────────────

  describe('Given: frontmatter と複数行の本文を持つテキスト', () => {
    describe('When: insertProjectField(text, "proj") を呼び出す', () => {
      describe('Then: T-CL-IPF-05 - 本文部分が破損しない', () => {
        it('T-CL-IPF-05-01: 本文の内容が保持される', () => {
          const text = "---\ndate: '2026-01-01'\n---\n# 見出し\n\n本文の内容";

          const result = insertProjectField(text, 'proj');

          assertStringIncludes(result, '# 見出し\n\n本文の内容');
        });
      });
    });
  });
});
