// src: scripts/__tests__/unit/export-chatlog.period-filter.unit.spec.ts
// @(#): 期間フィルタ関数のユニットテスト
//       対象: parsePeriod, inPeriod
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals, assertThrows } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { inPeriod, parsePeriod } from '../../../../export-chatlog/scripts/export-chatlog.ts';

// ─── parsePeriod ──────────────────────────────────────────────────────────────

describe('parsePeriod', () => {
  describe('Given: undefined（期間指定なし）', () => {
    describe('When: parsePeriod(undefined) を呼び出す', () => {
      describe('Then: T-EC-PF-01 - 全期間を返す', () => {
        it('T-EC-PF-01-01: startMs=0, endMs=Infinity を返す', () => {
          const range = parsePeriod(undefined);
          assertEquals(range.startMs, 0);
          assertEquals(range.endMs, Infinity);
        });
      });
    });
  });

  describe('Given: "2026-03"（年月指定）', () => {
    describe('When: parsePeriod("2026-03") を呼び出す', () => {
      describe('Then: T-EC-PF-01 - 2026年3月の範囲を返す', () => {
        it('T-EC-PF-01-02: startMs が 2026年3月1日のミリ秒', () => {
          const range = parsePeriod('2026-03');
          const expected = new Date(2026, 2, 1).getTime(); // 月は0始まり
          assertEquals(range.startMs, expected);
        });

        it('T-EC-PF-01-03: endMs が 2026年4月1日のミリ秒', () => {
          const range = parsePeriod('2026-03');
          const expected = new Date(2026, 3, 1).getTime();
          assertEquals(range.endMs, expected);
        });
      });
    });
  });

  describe('Given: "2026"（年指定）', () => {
    describe('When: parsePeriod("2026") を呼び出す', () => {
      describe('Then: T-EC-PF-01 - 2026年の範囲を返す', () => {
        it('T-EC-PF-01-04: startMs が 2026年1月1日のミリ秒', () => {
          const range = parsePeriod('2026');
          const expected = new Date(2026, 0, 1).getTime();
          assertEquals(range.startMs, expected);
        });

        it('T-EC-PF-01-05: endMs が 2027年1月1日のミリ秒', () => {
          const range = parsePeriod('2026');
          const expected = new Date(2027, 0, 1).getTime();
          assertEquals(range.endMs, expected);
        });
      });
    });
  });

  describe('Given: "invalid"（不正な形式）', () => {
    describe('When: parsePeriod("invalid") を呼び出す', () => {
      describe('Then: T-EC-PF-01 - Error をスローする', () => {
        it('T-EC-PF-01-06: Error がスローされる', () => {
          assertThrows(() => parsePeriod('invalid'), Error);
        });
      });
    });
  });
});

// ─── inPeriod ─────────────────────────────────────────────────────────────────

describe('inPeriod', () => {
  const range = parsePeriod('2026-03'); // 2026-03-01 〜 2026-04-01

  describe('Given: 範囲内のタイムスタンプ "2026-03-15T00:00:00Z"', () => {
    it('T-EC-PF-02-01: true を返す', () => {
      assertEquals(inPeriod('2026-03-15T00:00:00Z', range), true);
    });
  });

  describe('Given: startMs の 1ms 前のタイムスタンプ（範囲外）', () => {
    it('T-EC-PF-02-02: false を返す', () => {
      // startMs - 1ms は必ず範囲外（ローカル時刻ベースの境界値テスト）
      const ts = new Date(range.startMs - 1).toISOString();
      assertEquals(inPeriod(ts, range), false);
    });
  });

  describe('Given: 範囲外（後）のタイムスタンプ "2026-04-01T00:00:00Z"', () => {
    it('T-EC-PF-02-03: false を返す（半開区間）', () => {
      assertEquals(inPeriod('2026-04-01T00:00:00Z', range), false);
    });
  });

  describe('Given: startMs と等しいタイムスタンプ（2026-03-01T00:00:00 local）', () => {
    it('T-EC-PF-02-04: true を返す（境界値含む）', () => {
      // 月の最初の瞬間は範囲内
      const ts = new Date(range.startMs).toISOString();
      assertEquals(inPeriod(ts, range), true);
    });
  });

  describe('Given: endMs と等しいタイムスタンプ（2026-04-01T00:00:00 local）', () => {
    it('T-EC-PF-02-05: false を返す（半開区間、終端は含まない）', () => {
      const ts = new Date(range.endMs).toISOString();
      assertEquals(inPeriod(ts, range), false);
    });
  });
});
