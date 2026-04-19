// src: scripts/__tests__/unit/parse-args.unit.spec.ts
// @(#): CLI 引数解析関数のユニットテスト
//       対象: parseArgs
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals, assertThrows } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { ChatlogError } from '../../../../_scripts/classes/ChatlogError.class.ts';
import {
  DEFAULT_EXPORT_CONFIG,
} from '../../../../export-chatlog/scripts/constants/defaults.constants.ts';
import { parseArgs } from '../../../../export-chatlog/scripts/export-chatlog.ts';

type ExportConfig = ReturnType<typeof parseArgs>;

describe('parseArgs', () => {
  // ─── T-EC-PA-01: デフォルト値 ────────────────────────────────────────────────

  describe('Given: 空の引数配列 []', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: T-EC-PA-01 - デフォルト値が適用される', () => {
        const _defaultCases: { id: string; field: keyof ExportConfig; expected: unknown }[] = [
          { id: 'T-EC-PA-01-01', field: 'agent', expected: DEFAULT_EXPORT_CONFIG.agent },
          { id: 'T-EC-PA-01-02', field: 'outputDir', expected: DEFAULT_EXPORT_CONFIG.outputDir },
          { id: 'T-EC-PA-01-03', field: 'period', expected: undefined },
          { id: 'T-EC-PA-01-05', field: 'baseDir', expected: undefined },
        ];
        for (const { id, field, expected } of _defaultCases) {
          it(`${id}: ${field} が ${JSON.stringify(expected)} になる`, () => {
            assertEquals(parseArgs([])[field], expected);
          });
        }
      });
    });
  });

  // ─── T-EC-PA-02〜15: 単一オプション ──────────────────────────────────────────

  describe('Given: 単一オプション', () => {
    describe('When: parseArgs(args) を呼び出す', () => {
      describe('Then: 対応フィールドに値が設定される', () => {
        const _cases: { id: string; args: string[]; field: keyof ExportConfig; expected: unknown }[] = [
          { id: 'T-EC-PA-02-01', args: ['codex'], field: 'agent', expected: 'codex' },
          { id: 'T-EC-PA-03-01', args: ['2026-03'], field: 'period', expected: '2026-03' },
          { id: 'T-EC-PA-03-02', args: ['2026'], field: 'period', expected: '2026' },
          { id: 'T-EC-PA-04-01', args: ['--output', '/tmp/out'], field: 'outputDir', expected: '/tmp/out' },
          { id: 'T-EC-PA-04-02', args: ['--output=/tmp/out'], field: 'outputDir', expected: '/tmp/out' },
          { id: 'T-EC-PA-08-01', args: ['--base', '/data/logs'], field: 'baseDir', expected: '/data/logs' },
          { id: 'T-EC-PA-08-02', args: ['--base=/data/logs'], field: 'baseDir', expected: '/data/logs' },
          {
            id: 'T-EC-PA-11-01',
            args: ['--output', '/chatlog/claude'],
            field: 'outputDir',
            expected: '/chatlog/claude',
          },
          {
            id: 'T-EC-PA-12-01',
            args: ['--input', '/data/chatgpt-export'],
            field: 'inputDir',
            expected: '/data/chatgpt-export',
          },
          {
            id: 'T-EC-PA-12-02',
            args: ['--input=/data/chatgpt-export'],
            field: 'inputDir',
            expected: '/data/chatgpt-export',
          },
          { id: 'T-EC-PA-13-01', args: ['chatgpt'], field: 'agent', expected: 'chatgpt' },
          { id: 'T-EC-PA-15-01', args: ['chatgpt', '/path/to/export'], field: 'inputDir', expected: '/path/to/export' },
          {
            id: 'T-EC-PA-15-04',
            args: ['chatgpt', 'C:\\Users\\foo\\export'],
            field: 'inputDir',
            expected: 'C:/Users/foo/export',
          },
        ];
        for (const { id, args, field, expected } of _cases) {
          it(`${id}: ${field} が ${JSON.stringify(expected)} になる`, () => {
            assertEquals(parseArgs(args)[field], expected);
          });
        }
      });
    });
  });

  // ─── 複数フィールド組み合わせ ─────────────────────────────────────────────────

  describe('Given: ["--base", "/data", "--output", "/data/claude"]', () => {
    it('T-EC-PA-09: baseDir と outputDir が同時に設定される', () => {
      const result = parseArgs(['--base', '/data', '--output', '/data/claude']);
      assertEquals(result.baseDir, '/data');
      assertEquals(result.outputDir, '/data/claude');
    });
  });

  describe('Given: ["claude", "2026-03", "--output", "/out"]', () => {
    it('T-EC-PA-07: agent・period・outputDir が同時に設定される', () => {
      const result = parseArgs(['claude', '2026-03', '--output', '/out']);
      assertEquals(result.agent, 'claude');
      assertEquals(result.period, '2026-03');
      assertEquals(result.outputDir, '/out');
    });
  });

  describe('Given: ["claude", "--base", "/data/logs"]', () => {
    it('T-EC-PA-10: agent と baseDir が同時に設定される', () => {
      const result = parseArgs(['claude', '--base', '/data/logs']);
      assertEquals(result.agent, 'claude');
      assertEquals(result.baseDir, '/data/logs');
    });
  });

  describe('Given: ["chatgpt", "--input", "/data/export"]', () => {
    it('T-EC-PA-14: agent と inputDir が同時に設定される', () => {
      const result = parseArgs(['chatgpt', '--input', '/data/export']);
      assertEquals(result.agent, 'chatgpt');
      assertEquals(result.inputDir, '/data/export');
    });
  });

  describe('Given: ["chatgpt", "2026-03", "/path/to/export"]', () => {
    it('T-EC-PA-15-02: period と inputDir が同時に設定される', () => {
      const result = parseArgs(['chatgpt', '2026-03', '/path/to/export']);
      assertEquals(result.period, '2026-03');
      assertEquals(result.inputDir, '/path/to/export');
    });
  });

  describe('Given: ["chatgpt", "/path/to/export", "2026-03"]（順番逆）', () => {
    it('T-EC-PA-15-03: 順番が逆でも period と inputDir が正しく設定される', () => {
      const result = parseArgs(['chatgpt', '/path/to/export', '2026-03']);
      assertEquals(result.period, '2026-03');
      assertEquals(result.inputDir, '/path/to/export');
    });
  });

  // ─── 異常系: ChatlogError がスローされる ──────────────────────────────────────

  describe('Given: 不正な引数', () => {
    describe('When: parseArgs(args) を呼び出す', () => {
      describe('Then: ChatlogError(InvalidArgs) がスローされる', () => {
        const _errorCases: { id: string; args: string[]; label: string }[] = [
          { id: 'T-EC-PA-06-01', args: ['--unknown'], label: '未知オプション' },
          { id: 'T-EC-PA-06-02', args: ['my-project'], label: '未知の位置引数' },
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
