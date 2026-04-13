// src: scripts/__tests__/unit/export-chatlog.parse-args.unit.spec.ts
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

import { parseArgs } from '../../../../export-chatlog/scripts/export-chatlog.ts';

// ─── parseArgs tests ──────────────────────────────────────────────────────────

describe('parseArgs', () => {
  /** 正常系: デフォルト値 */
  describe('Given: 空の引数配列 []', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs([]);
    });

    it('T-EC-PA-01-01: agent が "claude"（デフォルト）', () => {
      assertEquals(result.agent, 'claude');
    });

    it('T-EC-PA-01-02: outputDir が "./temp/chatlog"（デフォルト）', () => {
      assertEquals(result.outputDir, './temp/chatlog');
    });

    it('T-EC-PA-01-03: period が undefined', () => {
      assertEquals(result.period, undefined);
    });

    it('T-EC-PA-01-04: project が undefined', () => {
      assertEquals(result.project, undefined);
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

  /** 正常系: project 指定 */
  describe('Given: ["my-project"]', () => {
    it('T-EC-PA-05-01: project が "my-project"', () => {
      const result = parseArgs(['my-project']);
      assertEquals(result.project, 'my-project');
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
  });

  /** 正常系: 全フィールドを同時指定 */
  describe('Given: ["claude", "2026-03", "my-proj", "--output", "/out"]', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs(['claude', '2026-03', 'my-proj', '--output', '/out']);
    });

    it('T-EC-PA-07-01: agent が "claude"', () => {
      assertEquals(result.agent, 'claude');
    });

    it('T-EC-PA-07-02: period が "2026-03"', () => {
      assertEquals(result.period, '2026-03');
    });

    it('T-EC-PA-07-03: project が "my-proj"', () => {
      assertEquals(result.project, 'my-proj');
    });

    it('T-EC-PA-07-04: outputDir が "/out"', () => {
      assertEquals(result.outputDir, '/out');
    });
  });
});
