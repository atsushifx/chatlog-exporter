// src: scripts/__tests__/unit/filter-chatlog.parseJsonArray.unit.spec.ts
// @(#): parseJsonArray のユニットテスト
//       JSON 配列パース: 直接パース・埋め込み・貪欲マッチ・失敗
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals, assertNotEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { parseJsonArray } from '../../../../filter-chatlog/scripts/filter-chatlog.ts';

// ─── T-FL-PJ-01: 純粋な JSON 配列文字列 → パース成功 ─────────────────────────

describe('parseJsonArray', () => {
  describe('Given: 純粋な JSON 配列文字列', () => {
    describe('When: parseJsonArray(raw) を呼び出す', () => {
      describe('Then: T-FL-PJ-01 - 配列が返される', () => {
        it('T-FL-PJ-01-01: 有効な JSON 配列 → null でない', () => {
          const raw = JSON.stringify([
            { file: 'a.md', decision: 'KEEP', confidence: 0.9, reason: 'good' },
          ]);
          const result = parseJsonArray(raw);

          assertNotEquals(result, null);
        });

        it('T-FL-PJ-01-02: 配列の最初の要素の file が "a.md" になる', () => {
          const raw = JSON.stringify([
            { file: 'a.md', decision: 'KEEP', confidence: 0.9, reason: 'good' },
          ]);
          const result = parseJsonArray(raw);

          assertEquals(result![0].file, 'a.md');
        });

        it('T-FL-PJ-01-03: decision が "KEEP" になる', () => {
          const raw = JSON.stringify([
            { file: 'a.md', decision: 'KEEP', confidence: 0.9, reason: 'good' },
          ]);
          const result = parseJsonArray(raw);

          assertEquals(result![0].decision, 'KEEP');
        });

        it('T-FL-PJ-01-04: 複数件の配列が正しくパースされる', () => {
          const raw = JSON.stringify([
            { file: 'a.md', decision: 'KEEP', confidence: 0.9, reason: 'good' },
            { file: 'b.md', decision: 'DISCARD', confidence: 0.8, reason: 'bad' },
          ]);
          const result = parseJsonArray(raw);

          assertEquals(result!.length, 2);
        });
      });
    });
  });

  // ─── T-FL-PJ-02: テキスト中に [...] 埋め込み → フォールバック成功 ─────────

  describe('Given: テキスト中に JSON 配列が埋め込まれた文字列', () => {
    describe('When: parseJsonArray(raw) を呼び出す', () => {
      describe('Then: T-FL-PJ-02 - フォールバックで配列が返される', () => {
        it('T-FL-PJ-02-01: 前置テキスト + JSON 配列 → null でない', () => {
          const arr = [{ file: 'a.md', decision: 'KEEP', confidence: 0.9, reason: 'ok' }];
          const raw = `前置テキスト\n${JSON.stringify(arr)}\n後置テキスト`;
          const result = parseJsonArray(raw);

          assertNotEquals(result, null);
        });

        it('T-FL-PJ-02-02: マークダウンコードブロック内の JSON → null でない', () => {
          const arr = [{ file: 'b.md', decision: 'DISCARD', confidence: 0.8, reason: 'no' }];
          const raw = `\`\`\`json\n${JSON.stringify(arr)}\n\`\`\``;
          const result = parseJsonArray(raw);

          assertNotEquals(result, null);
        });
      });
    });
  });

  // ─── T-FL-PJ-03: 貪欲マッチのみで成功するケース ─────────────────────────────

  describe('Given: 非貪欲マッチでは失敗するが貪欲マッチで成功するテキスト', () => {
    describe('When: parseJsonArray(raw) を呼び出す', () => {
      describe('Then: T-FL-PJ-03 - 貪欲マッチで配列が返される', () => {
        it('T-FL-PJ-03-01: ネストした配列を含む文字列 → null でない', () => {
          // 非貪欲では [] 内の ] で止まってしまうケース
          const arr = [{ file: 'c.md', decision: 'KEEP', confidence: 0.7, reason: 'nested [x]' }];
          const raw = `some text ${JSON.stringify(arr)} more text`;
          const result = parseJsonArray(raw);

          assertNotEquals(result, null);
        });
      });
    });
  });

  // ─── T-FL-PJ-04: JSON でないテキスト → null ─────────────────────────────────

  describe('Given: JSON として解析できないテキスト', () => {
    describe('When: parseJsonArray(raw) を呼び出す', () => {
      describe('Then: T-FL-PJ-04 - null が返される', () => {
        it('T-FL-PJ-04-01: 完全に無効なテキスト → null', () => {
          const result = parseJsonArray('これはJSONではありません');

          assertEquals(result, null);
        });

        it('T-FL-PJ-04-02: 空文字列 → null', () => {
          const result = parseJsonArray('');

          assertEquals(result, null);
        });

        it('T-FL-PJ-04-03: 空の配列 → null（length=0 の場合は null 扱い）', () => {
          const result = parseJsonArray('[]');

          assertEquals(result, null);
        });
      });
    });
  });
});
