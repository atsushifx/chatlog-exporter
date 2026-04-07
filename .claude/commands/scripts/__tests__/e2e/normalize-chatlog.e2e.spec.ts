#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/e2e/normalize-chatlog.e2e.spec.ts
// @(#): main() のエンドツーエンドテスト
//       実ファイルシステム + モック AI による統合オーケストレーション検証
//       parseArgs → resolveInputDir → findMdFiles → withConcurrency →
//       segmentChatlog → generateSegmentFile + attachFrontmatter → writeOutput → reportResults
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

/** outputDir 配下の .md ファイルを再帰的に収集する */
async function collectMdFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      const nested = await collectMdFilesRecursive(fullPath);
      files.push(...nested);
    } else if (entry.isFile && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

// test helpers
import {
  makeSuccessMock,
} from '../_helpers/deno-command-mock.ts';

// test target
import {
  main,
} from '../../normalize-chatlog.ts';

// ─── main() tests ─────────────────────────────────────────────────────────────

/**
 * main() のユニットテスト。
 * parseArgs → resolveInputDir → findMdFiles → withConcurrency → segmentChatlog
 * → generateSegmentFile + attachFrontmatter → writeOutput → reportResults の
 * エンドツーエンドオーケストレーションを検証する。
 */
describe('main', () => {
  // ─── T-15-01: --dir エンドツーエンド処理 ─────────────────────────────────────

  /** 正常系: --dir で指定したディレクトリの MD ファイルを処理してセグメント出力ファイルを生成する */
  describe('Given: マルチトピック MD ファイルが存在するディレクトリを --dir で指定する', () => {
    let inputDir: string;
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;

    beforeEach(async () => {
      inputDir = await Deno.makeTempDir();
      outputDir = await Deno.makeTempDir();

      // 2 MD files with frontmatter
      await Deno.writeTextFile(
        `${inputDir}/chat-a.md`,
        '---\nproject: test\n---\n### User\nHello\n\n### AI\nHi',
      );
      await Deno.writeTextFile(
        `${inputDir}/chat-b.md`,
        '---\nproject: test\n---\n### User\nFix CI\n\n### AI\nSure',
      );

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      // Mock AI: returns 1 segment per call
      const segmentResponse = JSON.stringify([
        { title: 'Topic A', summary: 'Summary A', body: '### User\nHello' },
      ]);
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
        new TextEncoder().encode(segmentResponse),
      );

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(inputDir, { recursive: true });
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--dir", inputDir, "--output", outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-01-01 - 収集した全 MD ファイルを処理してセグメント出力ファイルを生成する', () => {
        it('T-15-01-01-01: outputDir 配下に 2 件以上のセグメント出力ファイルが生成される', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const files = await collectMdFilesRecursive(outputDir);
          assertEquals(files.length >= 2, true);
        });

        it('T-15-01-01-02: 各出力ファイルが ---\\n で始まる YAML frontmatter を含む', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const files = await collectMdFilesRecursive(outputDir);
          for (const filePath of files) {
            const content = await Deno.readTextFile(filePath);
            assertEquals(content.startsWith('---\n'), true);
          }
        });
      });
    });
  });

  /** 正常系: 複数 MD ファイルを並列処理し全件成功レポートを出力する */
  describe('Given: 4 件の MD ファイルを含むディレクトリとデフォルト並列数 4', () => {
    let inputDir: string;
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;

    beforeEach(async () => {
      inputDir = await Deno.makeTempDir();
      outputDir = await Deno.makeTempDir();

      for (let i = 1; i <= 4; i++) {
        await Deno.writeTextFile(
          `${inputDir}/chat-${i}.md`,
          `### User\nQuestion ${i}\n\n### AI\nAnswer ${i}`,
        );
      }

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      const segmentResponse = JSON.stringify([
        { title: 'Topic', summary: 'Summary', body: 'Body' },
      ]);
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
        new TextEncoder().encode(segmentResponse),
      );

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(inputDir, { recursive: true });
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--dir", inputDir, "--output", outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-01-02 - withConcurrency を使ってファイルを並列処理する', () => {
        it('T-15-01-02-01: 全 4 件が処理されて結果レポートに success=4 が含まれる', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const output = logCalls.join('\n');
          assertMatch(output, /success=4/);
        });
      });
    });
  });

  // ─── T-15-02: --agent/--year-month エンドツーエンド ──────────────────────────

  /** 正常系: --agent/--year-month で temp/chatlog/<agent>/<year>/<year-month>/ を解決して処理する */
  describe('Given: --agent claude --year-month 2026-03 と対応パスが存在する', () => {
    const AGENT_DIR = 'temp/chatlog/claude/2026/2026-03';
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;

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

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      const segmentResponse = JSON.stringify([
        { title: 'Topic', summary: 'Summary', body: 'Body' },
      ]);
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
        new TextEncoder().encode(segmentResponse),
      );

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--agent","claude","--year-month","2026-03","--output",outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-02-01 - temp/chatlog/<agent>/<year>/<year-month>/ から入力を解決してファイルを処理する', () => {
        it('T-15-02-01-01: temp/chatlog/claude/2026/2026-03/ 内のファイルが処理されて出力が生成される', async () => {
          await main(['--agent', 'claude', '--year-month', '2026-03', '--output', outputDir]);

          const output = logCalls.join('\n');
          assertMatch(output, /success=1/);
        });
      });
    });
  });

  // ─── T-15-03: エラー処理 ──────────────────────────────────────────────────────

  /** 異常系: 存在しない --dir パスで exit code 1 で終了する */
  describe('Given: 存在しない --dir /nonexistent/path/xyz', () => {
    let exitStub: Stub<typeof Deno, [code?: number], never>;
    let savedCommand: unknown;

    beforeEach(() => {
      exitStub = stub(Deno, 'exit');
      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(new Uint8Array());
    });

    afterEach(() => {
      exitStub.restore();
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
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

  /** 異常系: 3 件のうち 1 件が AI エラー → success=2, fail=1 */
  describe('Given: 3 件の MD ファイルのうち 1 件が AI エラーを起こす', () => {
    let inputDir: string;
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;

    beforeEach(async () => {
      inputDir = await Deno.makeTempDir();
      outputDir = await Deno.makeTempDir();

      for (let i = 1; i <= 3; i++) {
        await Deno.writeTextFile(
          `${inputDir}/chat-0${i}.md`,
          `### User\nQ${i}\n\n### AI\nA${i}`,
        );
      }

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;

      // Selective mock: fail on the 3rd call
      let callCount = 0;
      const segmentResponse = JSON.stringify([
        { title: 'Topic', summary: 'Summary', body: 'Body' },
      ]);
      const successBytes = new TextEncoder().encode(segmentResponse);
      (Deno as unknown as Record<string, unknown>).Command = class {
        private readonly shouldFail: boolean;
        constructor(_cmd: string, _opts: unknown) {
          callCount++;
          this.shouldFail = callCount === 3;
        }
        spawn() {
          const shouldFail = this.shouldFail;
          return {
            stdin: {
              getWriter() {
                return {
                  write(_d: Uint8Array) {
                    return Promise.resolve();
                  },
                  close() {
                    return Promise.resolve();
                  },
                };
              },
            },
            output(): Promise<{ success: boolean; code: number; stdout: Uint8Array }> {
              if (shouldFail) {
                return Promise.resolve({ success: false, code: 1, stdout: new Uint8Array() });
              }
              return Promise.resolve({ success: true, code: 0, stdout: successBytes });
            },
          };
        }
      };

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(inputDir, { recursive: true });
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--dir", inputDir, "--output", outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-03-02 - 1 ファイルの AI 呼び出し失敗でも残りファイルの処理を継続する', () => {
        it('T-15-03-02-01: success=2 かつ fail=1 がレポートに含まれる', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const output = logCalls.join('\n');
          assertMatch(output, /success=2/);
          assertMatch(output, /fail=1/);
        });
      });
    });
  });

  // ─── T-15-04: エッジケース ────────────────────────────────────────────────────

  /** エッジケース: 空ディレクトリで 0 件レポートを出力する */
  describe('Given: .md ファイルが存在しない空ディレクトリ', () => {
    let inputDir: string;
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;

    beforeEach(async () => {
      inputDir = await Deno.makeTempDir();
      outputDir = await Deno.makeTempDir();

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(new Uint8Array());

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(inputDir, { recursive: true });
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--dir", inputDir, "--output", outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-04-01 - 空ディレクトリでも完了し 0 件レポートを出力する', () => {
        it('T-15-04-01-01: success=0, skip=0, fail=0 がレポートに含まれる', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const output = logCalls.join('\n');
          assertMatch(output, /success=0.*skip=0.*fail=0/);
        });
      });
    });
  });

  /** エッジケース: 再実行時に既存出力ファイルをスキップする */
  describe('Given: 出力ファイルがすでに存在する処理済み入力ファイル', () => {
    let inputDir: string;
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;
    beforeEach(async () => {
      inputDir = await Deno.makeTempDir();
      outputDir = await Deno.makeTempDir();

      await Deno.writeTextFile(
        `${inputDir}/chat.md`,
        '### User\nHello\n\n### AI\nHi',
      );

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      const segmentResponse = JSON.stringify([
        { title: 'Topic', summary: 'Summary', body: 'Body' },
      ]);
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
        new TextEncoder().encode(segmentResponse),
      );

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(inputDir, { recursive: true });
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main() を同一入力で 2 回呼び出す', () => {
      describe('Then: Task T-15-04-02 - 再実行時に既存出力ファイルをスキップする', () => {
        it('T-15-04-02-01: 2 回目の呼び出しで skip=1 がレポートに含まれる', async () => {
          // Fixed hash so both runs generate the same output filename
          const fixedHash = () => '0000000';

          // First run: creates output
          await main(['--dir', inputDir, '--output', outputDir], fixedHash);

          // Reset log capture
          logCalls = [];

          // Second run: should skip existing output
          await main(['--dir', inputDir, '--output', outputDir], fixedHash);

          const output = logCalls.join('\n');
          assertMatch(output, /skip=1/);
        });
      });
    });
  });

  /** エッジケース: 実行後も入力ファイルの内容が変化しない (R-010) */
  describe('Given: 既知の内容を持つ入力 MD ファイル', () => {
    let inputDir: string;
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;
    const inputContent = '---\nproject: test\n---\n### User\nHello\n\n### AI\nHi';

    beforeEach(async () => {
      inputDir = await Deno.makeTempDir();
      outputDir = await Deno.makeTempDir();

      await Deno.writeTextFile(`${inputDir}/input.md`, inputContent);

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      const segmentResponse = JSON.stringify([
        { title: 'Topic', summary: 'Summary', body: 'Body' },
      ]);
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
        new TextEncoder().encode(segmentResponse),
      );

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(inputDir, { recursive: true });
      await Deno.remove(outputDir, { recursive: true });
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

  /** エッジケース: 単一トピックのチャットログから出力ファイルが正確に 1 件生成される */
  describe('Given: 単一トピックのチャットログファイルを含むディレクトリ', () => {
    let inputDir: string;
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;

    beforeEach(async () => {
      inputDir = await Deno.makeTempDir();
      outputDir = await Deno.makeTempDir();

      await Deno.writeTextFile(
        `${inputDir}/single-topic.md`,
        '### User\nHow do I fix CI?\n\n### AI\nUse deno test.',
      );

      savedCommand = (Deno as unknown as Record<string, unknown>).Command;
      // AI returns exactly 1 segment
      const segmentResponse = JSON.stringify([
        { title: 'Fix CI', summary: 'Fix CI pipeline', body: '### User\nHow do I fix CI?' },
      ]);
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
        new TextEncoder().encode(segmentResponse),
      );

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(inputDir, { recursive: true });
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--dir", inputDir, "--output", outputDir]) を呼び出す', () => {
      describe('Then: Task T-15-04-04 - 単一トピックの MD ファイルから出力ファイルが正確に 1 件生成される', () => {
        it('T-15-04-04-01: outputDir 配下に正確に 1 件の .md ファイルが生成される', async () => {
          await main(['--dir', inputDir, '--output', outputDir]);

          const files = await collectMdFilesRecursive(outputDir);
          assertEquals(files.length, 1);
        });
      });
    });
  });
});
