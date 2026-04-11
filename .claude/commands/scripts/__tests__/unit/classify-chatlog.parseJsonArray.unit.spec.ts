// src: scripts/__tests__/unit/classify-chatlog.parseJsonArray.unit.spec.ts
// @(#): parseJsonArray のユニットテスト (classify-chatlog 専用)
//       ClassifyResult[] を返す3段階フォールバックパーサー
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { parseJsonArray } from '../../classify-chatlog.ts';
import type { ClassifyResult } from '../../classify-chatlog.ts';

// ─── 直接 JSON 配列パース（第1段階） ─────────────────────────────────────────

describe('parseJsonArray', () => {
  describe('Given: "[" で始まる有効な JSON 配列文字列', () => {
    describe('When: parseJsonArray を呼び出す', () => {
      describe('Then: T-CL-PJA-01 - 直接 JSON 配列パース', () => {
        it('T-CL-PJA-01-01: ClassifyResult[] として返される', () => {
          const raw = '[{"file":"a.md","project":"app1","confidence":0.9,"reason":"matched topic"}]';

          const result = parseJsonArray(raw);

          assertEquals(Array.isArray(result), true);
          assertEquals((result as ClassifyResult[]).length, 1);
          assertEquals((result as ClassifyResult[])[0].file, 'a.md');
          assertEquals((result as ClassifyResult[])[0].project, 'app1');
        });
      });
    });
  });

  // ─── 前置テキストありの非貪欲マッチ（第2段階フォールバック） ──────────────

  describe('Given: 前置テキストを含む文字列（非貪欲マッチで JSON 配列を抽出可能）', () => {
    describe('When: parseJsonArray を呼び出す', () => {
      describe('Then: T-CL-PJA-02 - 前置テキストありの非貪欲マッチフォールバック', () => {
        it('T-CL-PJA-02-01: JSON 配列部分が抽出されて返される', () => {
          const raw = 'ここに結果を示します:\n[{"file":"a.md","project":"app1","confidence":0.8,"reason":"ok"}]';

          const result = parseJsonArray(raw);

          assertEquals(Array.isArray(result), true);
          assertEquals((result as ClassifyResult[])[0].file, 'a.md');
        });
      });
    });
  });

  // ─── 貪欲マッチフォールバック（第3段階） ─────────────────────────────────

  describe('Given: 貪欲マッチが必要な複数オブジェクトの文字列', () => {
    describe('When: parseJsonArray を呼び出す', () => {
      describe('Then: T-CL-PJA-03 - 貪欲マッチフォールバック', () => {
        it('T-CL-PJA-03-01: 2件の配列が返される', () => {
          const raw =
            'result: [{"file":"a.md","project":"app1","confidence":0.9,"reason":"A"},{"file":"b.md","project":"app2","confidence":0.8,"reason":"B"}] end';

          const result = parseJsonArray(raw);

          assertEquals(Array.isArray(result), true);
          assertEquals((result as ClassifyResult[]).length, 2);
        });
      });
    });
  });

  // ─── JSON 配列なし → null ─────────────────────────────────────────────────

  describe('Given: 有効な JSON 配列を含まないプレーンテキスト', () => {
    describe('When: parseJsonArray を呼び出す', () => {
      describe('Then: T-CL-PJA-04 - JSON 配列なし → null', () => {
        it('T-CL-PJA-04-01: null が返される', () => {
          const raw = 'これはJSONではないプレーンテキスト';

          const result = parseJsonArray(raw);

          assertEquals(result, null);
        });
      });
    });
  });

  // ─── 空文字列 → null ──────────────────────────────────────────────────────

  describe('Given: 空文字列', () => {
    describe('When: parseJsonArray("") を呼び出す', () => {
      describe('Then: T-CL-PJA-05 - 空文字列 → null', () => {
        it('T-CL-PJA-05-01: null が返される（スローしない）', () => {
          const result = parseJsonArray('');

          assertEquals(result, null);
        });
      });
    });
  });

  // ─── 空配列 [] → null ────────────────────────────────────────────────────

  describe('Given: 空の JSON 配列文字列 "[]"', () => {
    describe('When: parseJsonArray("[]") を呼び出す', () => {
      describe('Then: T-CL-PJA-06 - 空配列 [] → null (length > 0 条件)', () => {
        it('T-CL-PJA-06-01: null が返される', () => {
          const result = parseJsonArray('[]');

          assertEquals(result, null);
        });
      });
    });
  });
});
