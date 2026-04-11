// src: scripts/__tests__/unit/normalize-chatlog.cli-args.unit.spec.ts
// @(#): CLI引数・出力ディレクトリ解決のユニットテスト
//       対象: parseArgs, resolveOutputDir
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import {
  parseArgs,
} from '../../normalize-chatlog.ts';

// ─── parseArgs tests ──────────────────────────────────────────────────────────

/**
 * parseArgs のユニットテスト。
 * CLI 引数配列を解析して { dir, agent, yearMonth, dryRun, concurrency, output } を返す関数の
 * 正常系・デフォルト値・エラー終了・パス正規化を検証する。
 */
describe('parseArgs', () => {
  /** 正常系: --dir オプションを正しくパースする */
  describe('Given: --dir オプションを含む引数配列', () => {
    it('T-08-01-01: args.dir が "/some/path" になる', () => {
      const result = parseArgs(['--dir', '/some/path']);

      assertEquals(result.dir, '/some/path');
    });
  });

  /** 正常系: 複数オプションが混在しても全フィールドを正しく解析する */
  describe('Given: --agent・--year-month・--dry-run・--concurrency・--output を含む引数配列', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs([
        '--agent',
        'claude',
        '--year-month',
        '2026-03',
        '--dry-run',
        '--concurrency',
        '8',
        '--output',
        './out',
      ]);
    });

    it('T-08-01-02a: args.agent が "claude" になる', () => {
      assertEquals(result.agent, 'claude');
    });

    it('T-08-01-02b: args.yearMonth が "2026-03" になる', () => {
      assertEquals(result.yearMonth, '2026-03');
    });

    it('T-08-01-02c: args.dryRun が true になる', () => {
      assertEquals(result.dryRun, true);
    });

    it('T-08-01-02d: args.concurrency が 8 になる', () => {
      assertEquals(result.concurrency, 8);
    });

    it('T-08-01-02e: args.output が "./out" になる', () => {
      assertEquals(result.output, './out');
    });
  });

  /** 正常系: 省略時はデフォルト値 (concurrency=4, dryRun=false) が適用される */
  describe('Given: --concurrency・--dry-run を含まない引数配列', () => {
    let result: ReturnType<typeof parseArgs>;
    beforeEach(() => {
      result = parseArgs([]);
    });

    it('T-08-02-01: args.concurrency が 4 になる', () => {
      assertEquals(result.concurrency, 4);
    });

    it('T-08-02-02: args.dryRun が false になる', () => {
      assertEquals(result.dryRun, false);
    });
  });

  /** 異常系: 未知のオプションは Deno.exit(1) を呼び出してエラー終了する */
  describe('Given: 未知のオプションを含む引数配列', () => {
    let exitStub: Stub<typeof Deno, [code?: number], never>;
    beforeEach(() => {
      exitStub = stub(Deno, 'exit');
    });
    afterEach(() => {
      exitStub.restore();
    });

    it('T-08-03-01: Deno.exit(1) が呼ばれる', () => {
      parseArgs(['--unknown']);

      assertEquals(exitStub.calls.length, 1);
      assertEquals(exitStub.calls[0].args[0], 1);
    });
  });

  /** 正常系: パス正規化と自動 --dir 判定 */
  describe('Given: パス区切り文字の正規化または自動 --dir 判定が必要な引数配列', () => {
    it('T-08-04-01: --dir 値のバックスラッシュがスラッシュに正規化される', () => {
      const result = parseArgs(['--dir', 'temp\\chatlog\\claude']);

      assertEquals(result.dir, 'temp/chatlog/claude');
    });

    it('T-08-04-02: / を含む位置引数が args.dir に設定される', () => {
      const result = parseArgs(['temp/chatlog/claude/2026/2026-03']);

      assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
    });

    it('T-08-04-03: \\ を含む位置引数がスラッシュ正規化されて args.dir に設定される', () => {
      const result = parseArgs(['temp\\chatlog\\claude\\2026\\2026-03']);

      assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
    });
  });
});
