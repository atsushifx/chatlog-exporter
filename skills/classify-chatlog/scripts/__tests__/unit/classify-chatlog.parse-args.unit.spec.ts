// src: scripts/__tests__/unit/classify-chatlog.parseArgs.unit.spec.ts
// @(#): parseArgs のユニットテスト
//       CLI 引数解析: デフォルト値・各オプション・エラー終了

// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// -- BDD modules --
import { assertEquals, assertThrows } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- modules for test --
import { ChatlogError } from '../../../../_scripts/classes/ChatlogError.class.ts';
// test target
import { parseArgs } from '../../classify-chatlog.ts';

type ClassifyConfig = ReturnType<typeof parseArgs>;

// ─── デフォルト値の確認 ───────────────────────────────────────────────────────

describe('parseArgs', () => {
  describe('Given: 引数なしの空配列', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: T-CL-PA-01 - デフォルト値が適用される', () => {
        const _defaultCases: { id: string; field: keyof ClassifyConfig; expected: unknown }[] = [
          { id: 'T-CL-PA-01-01', field: 'agent', expected: 'chatgpt' },
          { id: 'T-CL-PA-01-02', field: 'dryRun', expected: false },
          { id: 'T-CL-PA-01-03', field: 'inputDir', expected: './temp/chatlog' },
          { id: 'T-CL-PA-01-04', field: 'dicsDir', expected: './assets/dics' },
          { id: 'T-CL-PA-01-05', field: 'period', expected: undefined },
        ];
        for (const { id, field, expected } of _defaultCases) {
          it(`${id}: ${field} が ${JSON.stringify(expected)} になる`, () => {
            assertEquals(parseArgs([])[field], expected);
          });
        }
      });
    });
  });

  // ─── 単一オプションの解析 ─────────────────────────────────────────────────

  describe('Given: 単一オプション', () => {
    describe('When: parseArgs(args) を呼び出す', () => {
      describe('Then: 対応フィールドに値が設定される', () => {
        const _cases: { id: string; args: string[]; field: keyof ClassifyConfig; expected: unknown }[] = [
          { id: 'T-CL-PA-02-01', args: ['claude'], field: 'agent', expected: 'claude' },
          { id: 'T-CL-PA-03-01', args: ['2026-03'], field: 'period', expected: '2026-03' },
          { id: 'T-CL-PA-04-01', args: ['--dry-run'], field: 'dryRun', expected: true },
          { id: 'T-CL-PA-05-01', args: ['--input', '/path/to/input'], field: 'inputDir', expected: '/path/to/input' },
          { id: 'T-CL-PA-06-01', args: ['--input=/path/to/input'], field: 'inputDir', expected: '/path/to/input' },
          { id: 'T-CL-PA-07-01', args: ['--dics', '/path/to/dics'], field: 'dicsDir', expected: '/path/to/dics' },
        ];
        for (const { id, args, field, expected } of _cases) {
          it(`${id}: ${field} が ${JSON.stringify(expected)} になる`, () => {
            assertEquals(parseArgs(args)[field], expected);
          });
        }
      });
    });
  });

  // ─── 複数オプションの組み合わせ ──────────────────────────────────────────

  describe('Given: claude 2026-03 --dry-run --input ./in --dics ./dics を渡す', () => {
    describe('When: parseArgs(args) を呼び出す', () => {
      describe('Then: T-CL-PA-08 - 複数オプション組み合わせ', () => {
        it('T-CL-PA-08-01: 全フィールドが正しく解析される', () => {
          const result = parseArgs([
            'claude',
            '2026-03',
            '--dry-run',
            '--input',
            './in',
            '--dics',
            './dics',
          ]);

          assertEquals(result.agent, 'claude');
          assertEquals(result.period, '2026-03');
          assertEquals(result.dryRun, true);
          assertEquals(result.inputDir, './in');
          assertEquals(result.dicsDir, './dics');
        });
      });
    });
  });

  // ─── 異常系: ChatlogError がスローされる ──────────────────────────────────

  describe('Given: 不正な引数', () => {
    describe('When: parseArgs(args) を呼び出す', () => {
      describe('Then: ChatlogError(InvalidArgs) がスローされる', () => {
        const _errorCases: { id: string; args: string[]; label: string }[] = [
          { id: 'T-CL-PA-09-01', args: ['--unknown'], label: '未知オプション' },
          { id: 'T-CL-PA-10-01', args: ['invalid-arg'], label: '未知の位置引数' },
        ];
        for (const { id, args, label } of _errorCases) {
          it(`${id}: ${label} → ChatlogError(InvalidArgs) がスローされる`, () => {
            assertThrows(
              () => parseArgs(args),
              ChatlogError,
              'Invalid Args',
            );
          });
        }
      });
    });
  });
});
