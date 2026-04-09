#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/integration/normalize-chatlog.integration-inputDir.spec.ts
// @(#): 実ファイルシステムを使った統合テスト
//       対象: resolveInputDir
//       テスト種別: 正常系 / 異常系 / エッジケース
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals } from '@std/assert';
import { after, afterEach, before, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import {
  resolveInputDir,
} from '../../normalize-chatlog.ts';

// ─── resolveInputDir tests ────────────────────────────────────────────────────

/**
 * resolveInputDir の統合テスト。
 * --dir・--agent/--year-month オプションから入力ディレクトリパスを解決し、
 * 存在しない場合は Deno.exit(1) を呼び出す関数の正常系・異常系・エッジケースを検証する。
 */
describe('resolveInputDir', () => {
  // ─── T-07-01: --dir オプションによる解決（正常系） ───────────────────────

  /** 正常系: 存在する --dir パスをそのまま返す */
  describe('Given: 存在する --dir パスが与えられる', () => {
    describe('When: resolveInputDir({ dir }) を呼び出す', () => {
      /**
       * Task T-07-01: --dir オプションによる解決。
       * 存在するパスが指定された場合、そのまま返されることを確認する。
       */
      describe('Then: Task T-07-01 - --dir オプションによる解決', () => {
        let dir: string;
        beforeEach(() => {
          dir = Deno.makeTempDirSync();
        });
        afterEach(() => {
          Deno.removeSync(dir, { recursive: true });
        });

        /** 正常系: 存在するパスがそのまま返される */
        it('T-07-01-01: 存在する --dir パスをそのまま返す', () => {
          const result = resolveInputDir({ dir });

          assertEquals(result, dir);
        });

        /** 正常系: スペースを含むディレクトリパスも正しく返す */
        it('T-07-01-02: スペースを含む --dir パスも正しく返す', async () => {
          const dirWithSpace = `${dir}/path with space`;
          await Deno.mkdir(dirWithSpace);

          const result = resolveInputDir({ dir: dirWithSpace });

          assertEquals(result, dirWithSpace);
        });
      });
    });
  });

  // ─── T-07-02: --agent/--year-month による解決（正常系） ──────────────────

  /** 正常系: --agent/--year-month で `temp/chatlog/<agent>/<year>/<yearMonth>` を解決して返す */
  describe('Given: agent="claude", yearMonth="2026-03" が与えられ対応パスが存在する', () => {
    describe('When: resolveInputDir({ agent, yearMonth }) を呼び出す', () => {
      /**
       * Task T-07-02: --agent/--year-month による解決。
       * `temp/chatlog/<agent>/<year>/<yearMonth>` のパスが正しく構築・返却されることを確認する。
       */
      describe('Then: Task T-07-02 - --agent/--year-month による解決', () => {
        const AGENT = 'claude';
        const YEAR_MONTH_2026 = '2026-03';
        const DIR_2026 = `temp/chatlog/${AGENT}/2026/${YEAR_MONTH_2026}`;
        const YEAR_MONTH_2025 = '2025-11';
        const DIR_2025 = `temp/chatlog/${AGENT}/2025/${YEAR_MONTH_2025}`;
        const YEAR_MONTH_JAN = '2026-01';
        const DIR_JAN = `temp/chatlog/${AGENT}/2026/${YEAR_MONTH_JAN}`;

        before(async () => {
          await Deno.mkdir(DIR_2026, { recursive: true });
          await Deno.mkdir(DIR_2025, { recursive: true });
          await Deno.mkdir(DIR_JAN, { recursive: true });
        });

        after(async () => {
          await Deno.remove(`temp/chatlog/${AGENT}/2026`, { recursive: true });
          await Deno.remove(`temp/chatlog/${AGENT}/2025`, { recursive: true });
        });

        /** 正常系: 標準的な yearMonth から正しいパスが構築される */
        it('T-07-02-01: temp/chatlog/<agent>/<year>/<yearMonth> のパスを返す', () => {
          const result = resolveInputDir({ agent: AGENT, yearMonth: YEAR_MONTH_2026 });

          assertEquals(result, DIR_2026);
        });

        /** 正常系: 異なる年の yearMonth でも正しく年が抽出される */
        it('T-07-02-02: yearMonth="2025-11" のとき返却パスが "2025/2025-11" のサブパスを含む', () => {
          const result = resolveInputDir({ agent: AGENT, yearMonth: YEAR_MONTH_2025 });

          assertEquals(result.includes('2025/2025-11'), true);
        });

        /** 正常系: 1月（境界値）でも正しく解決される */
        it('T-07-02-03: yearMonth="2026-01"（1月）でも正しく解決される', () => {
          const result = resolveInputDir({ agent: AGENT, yearMonth: YEAR_MONTH_JAN });

          assertEquals(result, DIR_JAN);
        });
      });
    });
  });

  // ─── T-07-03: 存在しない --dir パスのエラー終了（異常系） ────────────────

  /** 異常系: 存在しないパスが指定された場合は Deno.exit(1) を呼び出す */
  describe('Given: 存在しない --dir パスが与えられる', () => {
    describe('When: resolveInputDir({ dir: "/nonexistent/path/xyz" }) を呼び出す', () => {
      /**
       * Task T-07-03: 存在しないパスでのエラー終了。
       * 解決先パスが存在しない場合、Deno.exit(1) が呼ばれることを確認する。
       */
      describe('Then: Task T-07-03 - 存在しないパスでのエラー終了', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        /** 異常系: 存在しない --dir パスで exit(1) が呼ばれる */
        it('T-07-03-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ dir: '/nonexistent/path/xyz' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  // ─── T-07-04: 必須オプションの欠落（異常系） ────────────────────────────

  /** 異常系: 必須オプションが一切ない場合は Deno.exit(1) を呼び出す */
  describe('Given: --dir も --agent/--yearMonth も与えられない', () => {
    describe('When: resolveInputDir({}) を呼び出す', () => {
      /**
       * Task T-07-04: 必須オプションの欠落。
       * --dir も --agent/--yearMonth も指定されない場合、Deno.exit(1) が呼ばれることを確認する。
       */
      describe('Then: Task T-07-04 - 必須オプションの欠落', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        /** 異常系: 空オブジェクトで exit(1) が呼ばれる */
        it('T-07-04-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({});

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });

        /** 異常系: agent のみ（yearMonth なし）でも exit(1) が呼ばれる */
        it('T-07-04-02: agent のみ指定（yearMonth なし）で Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ agent: 'claude' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });

        /** 異常系: yearMonth のみ（agent なし）でも exit(1) が呼ばれる */
        it('T-07-04-03: yearMonth のみ指定（agent なし）で Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ yearMonth: '2026-03' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  // ─── T-07-05: 存在しないパスでのエラー終了（--agent/--year-month 経由、異常系） ──

  /** 異常系: --agent/--year-month で解決されたパスが存在しない場合は Deno.exit(1) を呼び出す */
  describe('Given: agent="claude", yearMonth="1999-01" が与えられ解決先パスが存在しない', () => {
    describe('When: resolveInputDir({ agent: "claude", yearMonth: "1999-01" }) を呼び出す', () => {
      /**
       * Task T-07-05: 存在しないパスでのエラー終了（--agent/--year-month 経由）。
       * --agent/--year-month から構築したパスが存在しない場合、Deno.exit(1) が呼ばれることを確認する。
       */
      describe('Then: Task T-07-05 - 存在しないパスでのエラー終了（--agent/--year-month 経由）', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        /** 異常系: 存在しない年月パスで exit(1) が呼ばれる */
        it('T-07-05-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ agent: 'claude', yearMonth: '1999-01' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });

        /** 異常系: 不正フォーマットの yearMonth（スラッシュ区切り）でも exit(1) が呼ばれる */
        it('T-07-05-02: 不正フォーマット yearMonth="2026/03" でも Deno.exit(1) が呼ばれる', () => {
          // スラッシュ区切りは仕様外: 解決先パスが存在しないため exit(1)
          resolveInputDir({ agent: 'claude', yearMonth: '2026/03' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  // ─── T-07-06: --dir の優先順位（エッジケース） ───────────────────────────

  /** エッジケース: --dir と --agent/--yearMonth が両方指定された場合は --dir が優先される */
  describe('Given: --dir と --agent/--yearMonth が両方指定される', () => {
    describe('When: resolveInputDir({ dir, agent, yearMonth }) を呼び出す', () => {
      describe('Then: Task T-07-06 - --dir の優先順位', () => {
        let dir: string;
        beforeEach(() => {
          dir = Deno.makeTempDirSync();
        });
        afterEach(() => {
          Deno.removeSync(dir, { recursive: true });
        });

        /** エッジケース: --dir が存在すれば --agent/--yearMonth は無視される */
        it('T-07-06-01: --dir が存在するとき --agent/--yearMonth は無視され --dir のパスが返る', () => {
          // --agent/--yearMonth は存在しないパスだが --dir が優先されるため exit されない
          const result = resolveInputDir({
            dir,
            agent: 'claude',
            yearMonth: '1999-01',
          });

          assertEquals(result, dir);
        });
      });
    });
  });
});

