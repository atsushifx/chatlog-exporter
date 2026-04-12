// src: scripts/__tests__/unit/filter-chatlog.parseFrontmatter.unit.spec.ts
// @(#): parseFrontmatter のユニットテスト
//       YAML frontmatter のパース: あり・なし・閉じ区切りなし
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { parseFrontmatter } from '../../../../filter-chatlog/scripts/filter-chatlog.ts';

// ─── T-FL-PF-01: frontmatter あり → body 分離 ─────────────────────────────────

describe('parseFrontmatter', () => {
  describe('Given: frontmatter 付きのテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-FL-PF-01 - body が frontmatter 以降になる', () => {
        it('T-FL-PF-01-01: body が frontmatter の後の部分になる', () => {
          const text = '---\ntitle: テスト\n---\n本文です\n';
          const { body } = parseFrontmatter(text);

          assertEquals(body, '本文です\n');
        });

        it('T-FL-PF-01-02: meta が空オブジェクトを返す', () => {
          const text = '---\ntitle: テスト\n---\n本文';
          const { meta } = parseFrontmatter(text);

          assertEquals(typeof meta, 'object');
        });
      });
    });
  });

  // ─── T-FL-PF-02: frontmatter なし → body=全文 ──────────────────────────────

  describe('Given: frontmatter なしのテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-FL-PF-02 - body が全文になる', () => {
        it('T-FL-PF-02-01: body が入力テキスト全体になる', () => {
          const text = '本文のみです\n追加テキスト';
          const { body } = parseFrontmatter(text);

          assertEquals(body, text);
        });
      });
    });
  });

  // ─── T-FL-PF-03: 閉じ区切りなし → body=全文 ────────────────────────────────

  describe('Given: 開始区切りはあるが閉じ区切りがないテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-FL-PF-03 - 閉じ区切りなし → body=全文', () => {
        it('T-FL-PF-03-01: body が入力テキスト全体になる', () => {
          const text = '---\ntitle: テスト\n本文（閉じ区切りなし）';
          const { body } = parseFrontmatter(text);

          assertEquals(body, text);
        });
      });
    });
  });

  // ─── T-FL-PF-04: frontmatter のみ（body 空） ────────────────────────────────

  describe('Given: frontmatter のみで本文がないテキスト', () => {
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      describe('Then: T-FL-PF-04 - body が空文字列になる', () => {
        it('T-FL-PF-04-01: body が空文字列になる', () => {
          const text = '---\ntitle: テスト\n---\n';
          const { body } = parseFrontmatter(text);

          assertEquals(body, '');
        });
      });
    });
  });
});
