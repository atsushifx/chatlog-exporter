// src: scripts/__tests__/unit/parse-args.unit.spec.ts
// @(#): CLI 引数解析関数のユニットテスト
//       対象: parseArgs
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

import {
  DEFAULT_AGENT,
  DEFAULT_EXPORT_CONFIG,
  DEFAULT_OUTPUT_DIR,
} from '../../../../export-chatlog/scripts/constants/defaults.constants.ts';
import { parseArgs } from '../../../../export-chatlog/scripts/export-chatlog.ts';

// ─── parseArgs tests ──────────────────────────────────────────────────────────

/**
 * `parseArgs` のユニットテストスイート。
 *
 * CLI 引数配列を解析して ExportConfig を生成する関数の動作を検証する。
 * テスト対象ケース:
 * - デフォルト値（引数なし）
 * - agent 指定（"codex"）
 * - 期間指定（YYYY-MM・YYYY）
 * - --output / --output= オプション
 * - --base / --base= オプション
 * - --output と --base の併用
 * - 全フィールド同時指定
 * - 未知のオプション・位置引数での Deno.exit(1) 呼び出し
 *
 * 異常系テストでは `stub(Deno, 'exit')` でプロセス終了をモックして検証する。
 *
 * @see parseArgs
 * @see DEFAULT_EXPORT_CONFIG
 */
describe('parseArgs', () => {
  describe('Given: 空の引数配列 []', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs([]);
    });

    it('T-EC-PA-01-01: agent が DEFAULT_EXPORT_CONFIG.agent（デフォルト）', () => {
      assertEquals(result.agent, DEFAULT_EXPORT_CONFIG.agent);
    });

    it('T-EC-PA-01-02: outputDir が DEFAULT_EXPORT_CONFIG.outputDir（デフォルト）', () => {
      assertEquals(result.outputDir, DEFAULT_EXPORT_CONFIG.outputDir);
    });

    it('T-EC-PA-01-03: period が undefined', () => {
      assertEquals(result.period, undefined);
    });

    it('T-EC-PA-01-05: baseDir が undefined', () => {
      assertEquals(result.baseDir, undefined);
    });
  });

  /** 正常系: agent 指定 */
  describe('Given: ["codex"]', () => {
    it('T-EC-PA-02-01: agent が "codex"', () => {
      const result = parseArgs(['codex']);
      assertEquals(result.agent, 'codex');
    });
  });

  /** 正常系: 期間指定（YYYY-MM）*/
  describe('Given: ["2026-03"]', () => {
    it('T-EC-PA-03-01: period が "2026-03"', () => {
      const result = parseArgs(['2026-03']);
      assertEquals(result.period, '2026-03');
    });
  });

  /** 正常系: 期間指定（YYYY）*/
  describe('Given: ["2026"]', () => {
    it('T-EC-PA-03-02: period が "2026"', () => {
      const result = parseArgs(['2026']);
      assertEquals(result.period, '2026');
    });
  });

  /** 正常系: --output オプション */
  describe('Given: ["--output", "/tmp/out"]', () => {
    it('T-EC-PA-04-01: outputDir が "/tmp/out"', () => {
      const result = parseArgs(['--output', '/tmp/out']);
      assertEquals(result.outputDir, '/tmp/out');
    });
  });

  /** 正常系: --output= 形式 */
  describe('Given: ["--output=/tmp/out"]', () => {
    it('T-EC-PA-04-02: outputDir が "/tmp/out"', () => {
      const result = parseArgs(['--output=/tmp/out']);
      assertEquals(result.outputDir, '/tmp/out');
    });
  });

  /** 正常系: --base オプション */
  describe('Given: ["--base", "/data/logs"]', () => {
    it('T-EC-PA-08-01: baseDir が "/data/logs"', () => {
      const result = parseArgs(['--base', '/data/logs']);
      assertEquals(result.baseDir, '/data/logs');
    });
  });

  /** 正常系: --base= 形式 */
  describe('Given: ["--base=/data/logs"]', () => {
    it('T-EC-PA-08-02: baseDir が "/data/logs"', () => {
      const result = parseArgs(['--base=/data/logs']);
      assertEquals(result.baseDir, '/data/logs');
    });
  });

  /** 正常系: --output と --base の併用 */
  describe('Given: ["--base", "/data", "--output", "/data/claude"]', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs(['--base', '/data', '--output', '/data/claude']);
    });

    it('T-EC-PA-09-01: baseDir が "/data"', () => {
      assertEquals(result.baseDir, '/data');
    });

    it('T-EC-PA-09-02: outputDir が "/data/claude"', () => {
      assertEquals(result.outputDir, '/data/claude');
    });
  });

  /** 異常系: 未知のオプション */
  describe('Given: ["--unknown"]', () => {
    let exitStub: Stub<typeof Deno, [code?: number], never>;

    beforeEach(() => {
      exitStub = stub(Deno, 'exit');
    });

    afterEach(() => {
      exitStub.restore();
    });

    it('T-EC-PA-06-01: Deno.exit(1) が呼ばれる', () => {
      parseArgs(['--unknown']);
      assertEquals(exitStub.calls.length, 1);
      assertEquals(exitStub.calls[0].args[0], 1);
    });

    it('T-EC-PA-06-02: 未知の位置引数で Deno.exit(1) が呼ばれる', () => {
      parseArgs(['my-project']);
      assertEquals(exitStub.calls.length, 1);
      assertEquals(exitStub.calls[0].args[0], 1);
    });
  });

  /** 正常系: 全フィールドを同時指定 */
  describe('Given: ["claude", "2026-03", "--output", "/out"]', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs(['claude', '2026-03', '--output', '/out']);
    });

    it('T-EC-PA-07-01: agent が "claude"', () => {
      assertEquals(result.agent, 'claude');
    });

    it('T-EC-PA-07-02: period が "2026-03"', () => {
      assertEquals(result.period, '2026-03');
    });

    it('T-EC-PA-07-04: outputDir が "/out"', () => {
      assertEquals(result.outputDir, '/out');
    });
  });

  /** 正常系: --base と agent の組み合わせ */
  describe('Given: ["claude", "--base", "/data/logs"]', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs(['claude', '--base', '/data/logs']);
    });

    it('T-EC-PA-10-01: agent が "claude"', () => {
      assertEquals(result.agent, 'claude');
    });

    it('T-EC-PA-10-02: baseDir が "/data/logs"', () => {
      assertEquals(result.baseDir, '/data/logs');
    });
  });

  /** 正常系: /chatlog/<agent> スタイルの --output パス */
  describe('Given: ["--output", "/chatlog/claude"]', () => {
    it('T-EC-PA-11-01: outputDir が "/chatlog/claude"', () => {
      const result = parseArgs(['--output', '/chatlog/claude']);
      assertEquals(result.outputDir, '/chatlog/claude');
    });
  });
});
