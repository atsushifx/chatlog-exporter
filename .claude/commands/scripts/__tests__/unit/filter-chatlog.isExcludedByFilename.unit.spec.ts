// src: scripts/__tests__/unit/filter-chatlog.isExcludedByFilename.unit.spec.ts
// @(#): isExcludedByFilename のユニットテスト
//       ファイル名パターンによる除外判定
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
<<<<<<< HEAD:.claude/commands/scripts/__tests__/unit/filter-chatlog.isExcludedByFilename.unit.spec.ts
import { isExcludedByFilename } from '../../../../filter-chatlog/scripts/filter-chatlog.ts';
||||||| parent of 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):.claude/commands/scripts/__tests__/unit/filter-chatlog.isExcludedByFilename.unit.spec.ts
=======
import { isExcludedByFilename } from '../../filter-chatlog.ts';
>>>>>>> 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):skills/normalize-chatlog/scripts/__tests__/unit/filter-chatlog.isExcludedByFilename.unit.spec.ts

// ─── T-FL-IF-01: 除外パターン一致 → true ─────────────────────────────────────

describe('isExcludedByFilename', () => {
  describe('Given: 除外パターンに一致するファイル名', () => {
    describe('When: isExcludedByFilename(filename) を呼び出す', () => {
      describe('Then: T-FL-IF-01 - true が返される', () => {
        it('T-FL-IF-01-01: you-are-a-topic-and-tag-extraction-assistant を含む → true', () => {
          const result = isExcludedByFilename('you-are-a-topic-and-tag-extraction-assistant.md');

          assertEquals(result, true);
        });

        it('T-FL-IF-01-02: say-ok-and-nothing-else を含む → true', () => {
          const result = isExcludedByFilename('say-ok-and-nothing-else.md');

          assertEquals(result, true);
        });

        it('T-FL-IF-01-03: command-message-claude-idd-framework を含む → true', () => {
          const result = isExcludedByFilename('command-message-claude-idd-framework.md');

          assertEquals(result, true);
        });

        it('T-FL-IF-01-04: command-message-deckrd-deckrd を含む → true', () => {
          const result = isExcludedByFilename('command-message-deckrd-deckrd.md');

          assertEquals(result, true);
        });
      });
    });
  });

  // ─── T-FL-IF-02: 一致しない → false ─────────────────────────────────────────

  describe('Given: 除外パターンに一致しない通常のファイル名', () => {
    describe('When: isExcludedByFilename(filename) を呼び出す', () => {
      describe('Then: T-FL-IF-02 - false が返される', () => {
        it('T-FL-IF-02-01: 通常のファイル名 → false', () => {
          const result = isExcludedByFilename('my-chat-log.md');

          assertEquals(result, false);
        });

        it('T-FL-IF-02-02: 空文字列 → false', () => {
          const result = isExcludedByFilename('');

          assertEquals(result, false);
        });

        it('T-FL-IF-02-03: 無関係なファイル名 → false', () => {
          const result = isExcludedByFilename('architecture-discussion-2026.md');

          assertEquals(result, false);
        });
      });
    });
  });

  // ─── T-FL-IF-03: 大文字小文字の差異（toLowerCase） ──────────────────────────

  describe('Given: 大文字を含む除外パターンのファイル名', () => {
    describe('When: isExcludedByFilename(filename) を呼び出す', () => {
      describe('Then: T-FL-IF-03 - 大文字小文字を区別せず true が返される', () => {
        it('T-FL-IF-03-01: 大文字含む除外パターン → true', () => {
          const result = isExcludedByFilename('Say-Ok-And-Nothing-Else.md');

          assertEquals(result, true);
        });

        it('T-FL-IF-03-02: 全大文字の除外パターン → true', () => {
          const result = isExcludedByFilename('SAY-OK-AND-NOTHING-ELSE.md');

          assertEquals(result, true);
        });
      });
    });
  });
});
