// src: scripts/__tests__/unit/filter-chatlog.isExcludedByContent.unit.spec.ts
// @(#): isExcludedByContent のユニットテスト
//       内容ベース事前フィルタ: 本文長・Userターン・システムメッセージ・Assistant応答
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
<<<<<<< HEAD:.claude/commands/scripts/__tests__/unit/filter-chatlog.isExcludedByContent.unit.spec.ts
import { isExcludedByContent } from '../../../../filter-chatlog/scripts/filter-chatlog.ts';
||||||| parent of 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):.claude/commands/scripts/__tests__/unit/filter-chatlog.isExcludedByContent.unit.spec.ts
=======
import { isExcludedByContent } from '../../filter-chatlog.ts';
>>>>>>> 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):skills/normalize-chatlog/scripts/__tests__/unit/filter-chatlog.isExcludedByContent.unit.spec.ts

// ─── 正常な会話テキスト生成ヘルパー ──────────────────────────────────────────

function _makeBody(options: {
  userText?: string;
  assistantText?: string;
  extraPadding?: number;
}): string {
  const userText = options.userText ?? '質問内容です';
  const assistantText = options.assistantText ?? 'アシスタントの回答です';
  const padding = 'x'.repeat(options.extraPadding ?? 0);

  return `### User\n${userText}${padding}\n\n### Assistant\n${assistantText}\n`;
}

// ─── T-FL-IC-01: 本文が短すぎる → excluded=true ─────────────────────────────

describe('isExcludedByContent', () => {
  describe('Given: 本文が minCharCount より短いテキスト', () => {
    describe('When: isExcludedByContent(body) を呼び出す', () => {
      describe('Then: T-FL-IC-01 - excluded=true が返される', () => {
        it('T-FL-IC-01-01: excluded が true になる', () => {
          const body = '短い本文';
          const { excluded } = isExcludedByContent(body);

          assertEquals(excluded, true);
        });

        it('T-FL-IC-01-02: reason に "短すぎる" が含まれる', () => {
          const body = '短い本文';
          const { reason } = isExcludedByContent(body);

          assertEquals(reason.includes('短すぎる'), true);
        });
      });
    });
  });

  // ─── T-FL-IC-02: User ターンなし → excluded=true ────────────────────────────

  describe('Given: User ターンが存在しない本文', () => {
    describe('When: isExcludedByContent(body) を呼び出す', () => {
      describe('Then: T-FL-IC-02 - excluded=true が返される', () => {
        it('T-FL-IC-02-01: excluded が true になる', () => {
          const body = '### Assistant\n' + 'a'.repeat(1000) + '\n';
          const { excluded } = isExcludedByContent(body);

          assertEquals(excluded, true);
        });

        it('T-FL-IC-02-02: reason に "User" が含まれる', () => {
          const body = '### Assistant\n' + 'a'.repeat(1000) + '\n';
          const { reason } = isExcludedByContent(body);

          assertEquals(reason.includes('User'), true);
        });
      });
    });
  });

  // ─── T-FL-IC-03: User 1 件でシステムタグのみ → excluded=true ─────────────────

  describe('Given: User メッセージがシステムタグのみ', () => {
    describe('When: isExcludedByContent(body) を呼び出す', () => {
      describe('Then: T-FL-IC-03 - excluded=true が返される', () => {
        it('T-FL-IC-03-01: <system-reminder で始まる User メッセージ → excluded=true', () => {
          const body = [
            '### User',
            '<system-reminder>システムメッセージ</system-reminder>',
            '',
            '### Assistant',
            'a'.repeat(500),
          ].join('\n');
          const paddedBody = body + 'x'.repeat(Math.max(0, 1000 - body.length));
          const { excluded } = isExcludedByContent(paddedBody);

          assertEquals(excluded, true);
        });
      });
    });
  });

  // ─── T-FL-IC-04: User 1 件で Assistant が短い → excluded=true ─────────────────

  describe('Given: User 1 ターンで Assistant の応答が短すぎる', () => {
    describe('When: isExcludedByContent(body) を呼び出す', () => {
      describe('Then: T-FL-IC-04 - excluded=true が返される', () => {
        it('T-FL-IC-04-01: Assistant が minAssistantChars より短い → excluded=true', () => {
          const userText = 'u'.repeat(900);
          const assistantText = '短い';
          const body = `### User\n${userText}\n\n### Assistant\n${assistantText}\n`;
          const { excluded } = isExcludedByContent(body);

          assertEquals(excluded, true);
        });

        it('T-FL-IC-04-02: reason に "短すぎる" が含まれる', () => {
          const userText = 'u'.repeat(900);
          const assistantText = '短い';
          const body = `### User\n${userText}\n\n### Assistant\n${assistantText}\n`;
          const { reason } = isExcludedByContent(body);

          assertEquals(reason.includes('短すぎる'), true);
        });
      });
    });
  });

  // ─── T-FL-IC-05: 正常な会話 → excluded=false ─────────────────────────────────

  describe('Given: 十分な長さの正常な会話テキスト', () => {
    describe('When: isExcludedByContent(body) を呼び出す', () => {
      describe('Then: T-FL-IC-05 - excluded=false が返される', () => {
        it('T-FL-IC-05-01: 正常な会話 → excluded=false', () => {
          const body = _makeBody({
            userText: 'u'.repeat(500),
            assistantText: 'a'.repeat(500),
            extraPadding: 200,
          });
          const { excluded } = isExcludedByContent(body);

          assertEquals(excluded, false);
        });

        it('T-FL-IC-05-02: 複数ターンの会話 → excluded=false', () => {
          const body = [
            '### User',
            'u'.repeat(300),
            '',
            '### Assistant',
            'a'.repeat(300),
            '',
            '### User',
            'u'.repeat(300),
            '',
            '### Assistant',
            'a'.repeat(300),
          ].join('\n');
          const { excluded } = isExcludedByContent(body);

          assertEquals(excluded, false);
        });
      });
    });
  });
});
