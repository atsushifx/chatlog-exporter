#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/e2e/normalize-chatlog-io.e2e.spec.ts
// @(#): main() の I/O 検証 E2E テスト
//       ファイル生成・ディレクトリ解決（--dir / --agent --year-month）・エラー終了を確認する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals, assertMatch } from '@std/assert';
import { after, afterEach, before, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// ─── helpers ──────────────────────────────────────────────────────────────────

import type { CommandMockHandle } from '../_helpers/deno-command-mock.ts';
import { installCommandMock, makeSuccessMock } from '../_helpers/deno-command-mock.ts';
import type { LogCapture, LogSilencer } from '../_helpers/e2e-setup.ts';
import { captureLog, makeTempDirs, removeTempDirs, silenceLog } from '../_helpers/e2e-setup.ts';

// test target
import { findMdFiles, main } from '../../normalize-chatlog.ts';

// ─── I/O テスト ────────────────────────────────────────────────────────────────

/**
 * ファイル生成・ディレクトリ解決・エラー終了の I/O 検証。
 * --dir / --agent --year-month によるパス解決と出力ファイル生成を確認する。
 */
describe('main - I/O', () => {
  // ─── T-15-01-01: --dir によるファイル生成 ───────────────────────────────────

  /** 正常系: --dir で指定したディレクトリの MD ファイルを処理してセグメント出力ファイルを生成する */
  describe('Given: マルチトピック MD ファイルが存在するディレクトリを --dir で指定する', () => {
    let inputDir: string;
    let outputDir: string;
    let commandHandle: CommandMockHandle;
    let logSilencer: LogSilencer;

    beforeEach(async () => {
      ({ inputDir, outputDir } = await makeTempDirs());

      // 2 MD files with frontmatter
      await Deno.writeTextFile(
        `${inputDir}/chat-a.md`,
        '---\nproject: test\n---\n### User\nHello\n\n### AI\nHi',
      );
      await Deno.writeTextFile(
        `${inputDir}/chat-b.md`,
        '---\nproject: test\n---\n### User\nFix CI\n\n### AI\nSure',
      );

      const segmentResponse = JSON.stringify([
        { title: 'Topic A', summary: 'Summary A', body: '### User\nHello' },
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

    describe('When: main(["--dir", inputDir, "--output", outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-01-01 - 収集した全 MD ファイルを処理してセグメント出力ファイルを生成する', () => {
        it('T-15-01-01-01: outputDir 配下に 2 件以上のセグメント出力ファイルが生成される', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const files = findMdFiles(outputDir);
          assertEquals(files.length >= 2, true);
        });
      });
    });
  });

  // ─── T-15-02-01: --agent --year-month によるパス解決 ────────────────────────

  /** 正常系: --agent/--year-month で temp/chatlog/<agent>/<year>/<year-month>/ を解決して処理する */
  describe('Given: --agent claude --year-month 2026-03 と対応パスが存在する', () => {
    const AGENT_DIR = 'temp/chatlog/claude/2026/2026-03';
    let outputDir: string;
    let commandHandle: CommandMockHandle;
    let logCapture: LogCapture;

    before(async () => {
      await Deno.mkdir(AGENT_DIR, { recursive: true });
      await Deno.writeTextFile(
        `${AGENT_DIR}/sample.md`,
        '### User\nHello\n\n### AI\nHi',
      );
    });

    after(async () => {
      await Deno.remove('temp/chatlog/claude/2026', { recursive: true });
    });

    beforeEach(async () => {
      outputDir = await Deno.makeTempDir();

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
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--agent","claude","--year-month","2026-03","--output",outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-02-01 - temp/chatlog/<agent>/<year>/<year-month>/ から入力を解決してファイルを処理する', () => {
        it('T-15-02-01-01: temp/chatlog/claude/2026/2026-03/ 内のファイルが処理されて出力が生成される', async () => {
          await main(['--agent', 'claude', '--year-month', '2026-03', '--output', outputDir]);

          assertMatch(logCapture.calls.join('\n'), /success=1/);
        });
      });
    });
  });

  // ─── T-15-03-01: 存在しないパスでのエラー終了 ───────────────────────────────

  /** 異常系: 存在しない --dir パスで exit code 1 で終了する */
  describe('Given: 存在しない --dir /nonexistent/path/xyz', () => {
    let exitStub: Stub<typeof Deno, [code?: number], never>;
    let commandHandle: CommandMockHandle;

    beforeEach(() => {
      exitStub = stub(Deno, 'exit');
      commandHandle = installCommandMock(makeSuccessMock(new Uint8Array()));
    });

    afterEach(() => {
      exitStub.restore();
      commandHandle.restore();
    });

    describe('When: main(["--dir", "/nonexistent/path/xyz"]) を呼び出す', () => {
      describe('Then: Task T-15-03-01 - 存在しない入力パスでのエラー終了', () => {
        it('T-15-03-01-01: Deno.exit(1) が呼ばれる', async () => {
          await main(['--dir', '/nonexistent/path/xyz']);

          assertEquals(exitStub.calls.length >= 1, true);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  // ─── T-15-04-04: 単一トピックから 1 件生成 ──────────────────────────────────

  /** エッジケース: 単一トピックのチャットログから出力ファイルが正確に 1 件生成される */
  describe('Given: 単一トピックのチャットログファイルを含むディレクトリ', () => {
    let inputDir: string;
    let outputDir: string;
    let commandHandle: CommandMockHandle;
    let logSilencer: LogSilencer;

    beforeEach(async () => {
      ({ inputDir, outputDir } = await makeTempDirs());

      await Deno.writeTextFile(
        `${inputDir}/single-topic.md`,
        '### User\nHow do I fix CI?\n\n### AI\nUse deno test.',
      );

      // AI returns exactly 1 segment
      const segmentResponse = JSON.stringify([
        { title: 'Fix CI', summary: 'Fix CI pipeline', body: '### User\nHow do I fix CI?' },
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

    describe('When: main(["--dir", inputDir, "--output", outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-04-04 - 単一トピックの MD ファイルから出力ファイルが正確に 1 件生成される', () => {
        it('T-15-04-04-01: outputDir 配下に正確に 1 件の .md ファイルが生成される', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const files = findMdFiles(outputDir);
          assertEquals(files.length, 1);
        });
      });
    });
  });
});
