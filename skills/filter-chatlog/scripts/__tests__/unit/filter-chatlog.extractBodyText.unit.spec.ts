// src: scripts/__tests__/unit/filter-chatlog.extractBodyText.unit.spec.ts
// @(#): extractBodyText のユニットテスト
//       本文テキスト抽出: フォーマット・切り詰め
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals, assertStringIncludes } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { extractBodyText } from '../../filter-chatlog.ts';

// ─── T-FL-EB-01: 通常会話 → User/Assistant フォーマット ──────────────────────

describe('extractBodyText', () => {
  describe('Given: User と Assistant ターンを含む本文', () => {
    describe('When: extractBodyText(body) を呼び出す', () => {
      describe('Then: T-FL-EB-01 - ### User / ### Assistant フォーマットで返される', () => {
        const body = '### User\nユーザーの質問\n\n### Assistant\nアシスタントの回答\n';

        it('T-FL-EB-01-01: "### User" を含む', () => {
          const result = extractBodyText(body);

          assertStringIncludes(result, '### User');
        });

        it('T-FL-EB-01-02: "### Assistant" を含む', () => {
          const result = extractBodyText(body);

          assertStringIncludes(result, '### Assistant');
        });

        it('T-FL-EB-01-03: ユーザーのテキストが含まれる', () => {
          const result = extractBodyText(body);

          assertStringIncludes(result, 'ユーザーの質問');
        });
      });
    });
  });

  // ─── T-FL-EB-02: maxChars 切り詰め ──────────────────────────────────────────

  describe('Given: maxChars より長い本文', () => {
    describe('When: extractBodyText(body, maxChars) を呼び出す', () => {
      describe('Then: T-FL-EB-02 - maxChars 文字以内に切り詰められる', () => {
        it('T-FL-EB-02-01: 結果の長さが maxChars 以下になる', () => {
          const longText = 'x'.repeat(500);
          const body = `### User\n${longText}\n`;
          const maxChars = 100;
          const result = extractBodyText(body, maxChars);

          assertEquals(result.length <= maxChars, true);
        });

        it('T-FL-EB-02-02: maxChars=10 でも結果が返される', () => {
          const body = '### User\n質問テキスト\n\n### Assistant\n回答テキスト\n';
          const result = extractBodyText(body, 10);

          assertEquals(result.length <= 10, true);
        });
      });
    });
  });

  // ─── T-FL-EB-03: ターンなし → 空文字列 ─────────────────────────────────────

  describe('Given: ターンヘッダーがない本文', () => {
    describe('When: extractBodyText(body) を呼び出す', () => {
      describe('Then: T-FL-EB-03 - 空文字列が返される', () => {
        it('T-FL-EB-03-01: ターンなし → 空文字列', () => {
          const body = 'ヘッダーのない本文テキスト';
          const result = extractBodyText(body);

          assertEquals(result, '');
        });
      });
    });
  });
});
