// src: scripts/__tests__/unit/filter-chatlog.parseConversation.unit.spec.ts
// @(#): parseConversation のユニットテスト
//       会話ターン解析: User/Assistant ターンの抽出
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
<<<<<<< HEAD:.claude/commands/scripts/__tests__/unit/filter-chatlog.parseConversation.unit.spec.ts
import { parseConversation } from '../../../../filter-chatlog/scripts/filter-chatlog.ts';
||||||| parent of 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):.claude/commands/scripts/__tests__/unit/filter-chatlog.parseConversation.unit.spec.ts
=======
import { parseConversation } from '../../filter-chatlog.ts';
>>>>>>> 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):skills/normalize-chatlog/scripts/__tests__/unit/filter-chatlog.parseConversation.unit.spec.ts

// ─── T-FL-PC-01: User/Assistant ターン 1 件ずつ ────────────────────────────────

describe('parseConversation', () => {
  describe('Given: User と Assistant のターンが 1 件ずつあるテキスト', () => {
    describe('When: parseConversation(body) を呼び出す', () => {
      describe('Then: T-FL-PC-01 - 2 件のターンが返される', () => {
        const body = '### User\nユーザーの質問\n\n### Assistant\nアシスタントの回答\n';

        it('T-FL-PC-01-01: ターン数が 2 になる', () => {
          const turns = parseConversation(body);

          assertEquals(turns.length, 2);
        });

        it('T-FL-PC-01-02: 最初のターンの role が "user" になる', () => {
          const turns = parseConversation(body);

          assertEquals(turns[0].role, 'user');
        });

        it('T-FL-PC-01-03: 2 番目のターンの role が "assistant" になる', () => {
          const turns = parseConversation(body);

          assertEquals(turns[1].role, 'assistant');
        });

        it('T-FL-PC-01-04: User ターンのテキストが正しく抽出される', () => {
          const turns = parseConversation(body);

          assertEquals(turns[0].text, 'ユーザーの質問');
        });
      });
    });
  });

  // ─── T-FL-PC-02: 複数ターン ────────────────────────────────────────────────

  describe('Given: 3 ターンある本文', () => {
    describe('When: parseConversation(body) を呼び出す', () => {
      describe('Then: T-FL-PC-02 - 3 件のターンが返される', () => {
        const body = [
          '### User',
          '質問1',
          '',
          '### Assistant',
          '回答1',
          '',
          '### User',
          '質問2',
        ].join('\n');

        it('T-FL-PC-02-01: ターン数が 3 になる', () => {
          const turns = parseConversation(body);

          assertEquals(turns.length, 3);
        });

        it('T-FL-PC-02-02: 3 番目のターンの role が "user" になる', () => {
          const turns = parseConversation(body);

          assertEquals(turns[2].role, 'user');
        });
      });
    });
  });

  // ─── T-FL-PC-03: ターンなし → 空配列 ──────────────────────────────────────

  describe('Given: ターンヘッダーがないテキスト', () => {
    describe('When: parseConversation(body) を呼び出す', () => {
      describe('Then: T-FL-PC-03 - 空配列が返される', () => {
        it('T-FL-PC-03-01: 空配列が返される', () => {
          const body = 'ヘッダーのない本文テキスト';
          const turns = parseConversation(body);

          assertEquals(turns.length, 0);
        });
      });
    });
  });

  // ─── T-FL-PC-04: テキストなしターン → 除外 ────────────────────────────────

  describe('Given: テキストのないターンヘッダー', () => {
    describe('When: parseConversation(body) を呼び出す', () => {
      describe('Then: T-FL-PC-04 - 空テキストのターンは除外される', () => {
        it('T-FL-PC-04-01: テキストなしのターンは含まれない', () => {
          const body = '### User\n\n### Assistant\n回答あり\n';
          const turns = parseConversation(body);

          // テキストなし User ターンは除外され、Assistant ターンのみ
          assertEquals(turns.length, 1);
          assertEquals(turns[0].role, 'assistant');
        });
      });
    });
  });
});
