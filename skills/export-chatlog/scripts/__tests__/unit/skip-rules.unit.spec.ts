// src: scripts/__tests__/unit/skip-rules.unit.spec.ts
// @(#): スキップルール関数のユニットテスト
//       対象: isShortAffirmation, isSkippable
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import {
  isShortAffirmation,
  isSkippable,
} from '../../libs/skip-rules.ts';

// ─── isShortAffirmation ───────────────────────────────────────────────────────

describe('isShortAffirmation', () => {
  describe('Given: "yes"', () => {
    it('T-EC-SU-02-01: true を返す', () => {
      assertEquals(isShortAffirmation('yes'), true);
    });
  });

  describe('Given: "はい"', () => {
    it('T-EC-SU-02-02: true を返す', () => {
      assertEquals(isShortAffirmation('はい'), true);
    });
  });

  describe('Given: 大文字 "YES"', () => {
    it('T-EC-SU-02-03: true を返す（toLowerCase 適用）', () => {
      assertEquals(isShortAffirmation('YES'), true);
    });
  });

  describe('Given: 21文字以上の文字列', () => {
    it('T-EC-SU-02-04: false を返す（長さ超過）', () => {
      assertEquals(isShortAffirmation('a'.repeat(21)), false);
    });
  });

  describe('Given: "hello"（SKIP_EXACT に非該当）', () => {
    it('T-EC-SU-02-05: false を返す', () => {
      assertEquals(isShortAffirmation('hello'), false);
    });
  });
});

// ─── isSkippable ──────────────────────────────────────────────────────────────

describe('isSkippable', () => {
  describe('Given: 空文字列 ""', () => {
    it('T-EC-SU-03-01: true を返す', () => {
      assertEquals(isSkippable(''), true);
    });
  });

  describe('Given: "/clear" プレフィックス', () => {
    it('T-EC-SU-03-02: true を返す', () => {
      assertEquals(isSkippable('/clear'), true);
    });
  });

  describe('Given: "<system-reminder>..." プレフィックス', () => {
    it('T-EC-SU-03-03: true を返す', () => {
      assertEquals(isSkippable('<system-reminder>some content'), true);
    });
  });

  describe('Given: "yes"（短文肯定）', () => {
    it('T-EC-SU-03-04: true を返す', () => {
      assertEquals(isSkippable('yes'), true);
    });
  });

  describe('Given: "explain this code"（通常テキスト）', () => {
    it('T-EC-SU-03-05: false を返す', () => {
      assertEquals(isSkippable('explain this code'), false);
    });
  });

  describe('Given: "/help コマンド"', () => {
    it('T-EC-SU-03-06: true を返す', () => {
      assertEquals(isSkippable('/help'), true);
    });
  });

  describe('Given: "[Request interrupted..."', () => {
    it('T-EC-SU-03-07: true を返す', () => {
      assertEquals(isSkippable('[Request interrupted by user]'), true);
    });
  });
});
