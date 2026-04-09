#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/e2e/normalize-chatlog-reproducibility.e2e.spec.ts
// @(#): main() の再現性検証 E2E テスト
//       再実行時のスキップ動作 (R-011) と入力ファイル不変保証 (R-010) を確認する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals, assertMatch } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// ─── helpers ──────────────────────────────────────────────────────────────────

import type { CommandMockHandle } from '../_helpers/deno-command-mock.ts';
import { installCommandMock, makeSuccessMock } from '../_helpers/deno-command-mock.ts';
import type { LogCapture, LogSilencer } from '../_helpers/e2e-setup.ts';
import { captureLog, makeTempDirs, removeTempDirs, silenceLog } from '../_helpers/e2e-setup.ts';

// test target
import { main } from '../../normalize-chatlog.ts';
import type { HashProvider } from '../../normalize-chatlog.ts';

// ─── 再現性テスト ──────────────────────────────────────────────────────────────

/**
 * 再実行時のスキップ動作と入力ファイル不変保証の検証。
 * R-011: 既存出力ファイルはスキップされる。
 * R-010: 入力ファイルは処理後も変化しない。
 */
describe('main - reproducibility', () => {
  // ─── T-15-04-02: 再実行時のスキップ ─────────────────────────────────────────

  /** エッジケース: 再実行時に既存出力ファイルをスキップする (R-011) */
  describe('Given: 出力ファイルがすでに存在する処理済み入力ファイル', () => {
    let inputDir: string;
    let outputDir: string;
    let commandHandle: CommandMockHandle;
    let logCapture: LogCapture;

    beforeEach(async () => {
      ({ inputDir, outputDir } = await makeTempDirs());

      await Deno.writeTextFile(
        `${inputDir}/chat.md`,
        '### User\nHello\n\n### AI\nHi',
      );

      const segmentResponse = JSON.stringify([
        { title: 'Topic', summary: 'Summary', body: 'Body' },
      ]);
      commandHandle = installCommandMock(
        makeSuccessMock(new TextEncoder().encode(segmentResponse)),
      );
      logCapture = captureLog();
    });

    afterEach(async () => {
      commandHandle.restore();
      logCapture.restore();
      await removeTempDirs(inputDir, outputDir);
    });

    describe('When: main() を同一入力で 2 回呼び出す', () => {
      describe('Then: Task T-15-04-02 - 再実行時に既存出力ファイルをスキップする', () => {
        it('T-15-04-02-01: 2 回目の呼び出しで skip=1 がレポートに含まれる', async () => {
          // Fixed hash so both runs generate the same output filename
          const fixedHash: HashProvider = () => '0000000';

          // First run: creates output
          await main(['--dir', inputDir, '--output', outputDir], fixedHash);

          // Reset log capture for second run
          logCapture.calls.splice(0);

          // Second run: should skip existing output
          await main(['--dir', inputDir, '--output', outputDir], fixedHash);

          assertMatch(logCapture.calls.join('\n'), /skip=1/);
        });
      });
    });
  });

  // ─── T-15-04-03: 入力ファイル不変保証 ───────────────────────────────────────

  /** エッジケース: 実行後も入力ファイルの内容が変化しない (R-010) */
  describe('Given: 既知の内容を持つ入力 MD ファイル', () => {
    let inputDir: string;
    let outputDir: string;
    let commandHandle: CommandMockHandle;
    let logSilencer: LogSilencer;
    const inputContent = '---\nproject: test\n---\n### User\nHello\n\n### AI\nHi';

    beforeEach(async () => {
      ({ inputDir, outputDir } = await makeTempDirs());

      await Deno.writeTextFile(`${inputDir}/input.md`, inputContent);

      const segmentResponse = JSON.stringify([
        { title: 'Topic', summary: 'Summary', body: 'Body' },
      ]);
      commandHandle = installCommandMock(
        makeSuccessMock(new TextEncoder().encode(segmentResponse)),
      );
      logSilencer = silenceLog();
    });

    afterEach(async () => {
      commandHandle.restore();
      logSilencer.restore();
      await removeTempDirs(inputDir, outputDir);
    });

    describe('When: main() が完了する', () => {
      describe('Then: Task T-15-04-03 - 実行全体を通じて入力ファイルが変更されない', () => {
        it('T-15-04-03-01: 入力ファイルの内容が main() 実行後も変化しない', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const afterContent = await Deno.readTextFile(`${inputDir}/input.md`);
          assertEquals(afterContent, inputContent);
        });
      });
    });
  });
});
