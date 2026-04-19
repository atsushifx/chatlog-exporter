// src: scripts/__tests__/e2e/classify-chatlog.main.e2e.spec.ts
// @(#): classify-chatlog main() の E2E テスト
//       main() 経由でのファイル分類フロー（Deno.Command モック・実 tempdir）
//
//       classify-chatlog の動作:
//         入力: inputDir/agent/YYYY-MM/*.md
//         出力: ファイルを inputDir/agent/YYYY-MM/<project>/ サブディレクトリに移動
//               (normalize-chatlog と異なり、別出力ディレクトリはない)
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals, assertStringIncludes } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import { main } from '../../classify-chatlog.ts';

// helpers
import {
  installCommandMock,
  makeSuccessMock,
} from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import type { CommandMockHandle } from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import type { LoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';
import { makeLoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';

// ─── テスト用一時ディレクトリセットアップ ─────────────────────────────────────

/**
 * inputDir / dicsDir を作成して返す。
 * agent=claude 形式のディレクトリ構造: inputDir/claude/2026-03/
 */
async function _makeTestDirs(agent = 'claude', period = '2026-03'): Promise<{
  inputDir: string;
  dicsDir: string;
  monthDir: string;
}> {
  const inputDir = await Deno.makeTempDir();
  const dicsDir = await Deno.makeTempDir();
  const monthDir = `${inputDir}/${agent}/${period}`;
  await Deno.mkdir(monthDir, { recursive: true });
  await Deno.writeTextFile(`${dicsDir}/projects.dic`, 'app1\napp2\n');
  return { inputDir, dicsDir, monthDir };
}

// ─── T-CL-E2E-01: dry-run モード ─────────────────────────────────────────────

describe('main - dry-run モード', () => {
  describe('Given: 1件の .md ファイルと claude agent', () => {
    describe('When: main([...args, "--dry-run"]) を呼び出す', () => {
      describe('Then: T-CL-E2E-01 - dry-run → ファイルが移動しない', () => {
        let inputDir: string;
        let dicsDir: string;
        let monthDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          ({ inputDir, dicsDir, monthDir } = await _makeTestDirs());
          await Deno.writeTextFile(
            `${monthDir}/chat.md`,
            '---\ntitle: テスト\ncategory: development\n---\n本文',
          );
          const response = JSON.stringify([
            { file: 'chat.md', project: 'app1', confidence: 0.9, reason: 'matched' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          loggerStub = makeLoggerStub();
        });

        afterEach(async () => {
          commandHandle.restore();
          loggerStub.restore();
          await Deno.remove(inputDir, { recursive: true });
          await Deno.remove(dicsDir, { recursive: true });
        });

        it('T-CL-E2E-01-01: 元ファイルが移動せず残っている', async () => {
          await main(['claude', '2026-03', '--dry-run', '--input', inputDir, '--dics', dicsDir]);

          const stat = await Deno.stat(`${monthDir}/chat.md`);
          assertEquals(stat.isFile, true);
        });

        it('T-CL-E2E-01-02: "[dry-run]" がログに出力される', async () => {
          await main(['claude', '2026-03', '--dry-run', '--input', inputDir, '--dics', dicsDir]);

          assertEquals(loggerStub.infoLogs.some((l) => l.includes('[dry-run]')), true);
        });
      });
    });
  });
});

// ─── T-CL-E2E-02: 正常分類 → ファイルがサブディレクトリに移動 ───────────────

describe('main - 正常分類', () => {
  describe('Given: 1件の .md ファイルと有効な分類結果', () => {
    describe('When: main([...args]) を呼び出す（dryRun=false）', () => {
      describe('Then: T-CL-E2E-02 - ファイルがプロジェクトサブディレクトリに移動', () => {
        let inputDir: string;
        let dicsDir: string;
        let monthDir: string;
        let commandHandle: CommandMockHandle;
        let errStub: Stub;

        beforeEach(async () => {
          ({ inputDir, dicsDir, monthDir } = await _makeTestDirs());
          await Deno.writeTextFile(
            `${monthDir}/chat.md`,
            '---\ntitle: テスト\ncategory: development\n---\n本文',
          );
          const response = JSON.stringify([
            { file: 'chat.md', project: 'app1', confidence: 0.9, reason: 'matched' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          errStub = stub(console, 'error', () => {});
        });

        afterEach(async () => {
          commandHandle.restore();
          errStub.restore();
          await Deno.remove(inputDir, { recursive: true });
          await Deno.remove(dicsDir, { recursive: true });
        });

        it('T-CL-E2E-02-01: ファイルが app1/ サブディレクトリに移動している', async () => {
          await main(['claude', '2026-03', '--input', inputDir, '--dics', dicsDir]);

          const stat = await Deno.stat(`${monthDir}/app1/chat.md`);
          assertEquals(stat.isFile, true);
        });

        it('T-CL-E2E-02-02: 移動先ファイルに "project: app1" が含まれる', async () => {
          await main(['claude', '2026-03', '--input', inputDir, '--dics', dicsDir]);

          const content = await Deno.readTextFile(`${monthDir}/app1/chat.md`);
          assertStringIncludes(content, 'project: app1');
        });
      });
    });
  });
});

// ─── T-CL-E2E-03: project 設定済みファイル → スキップ ───────────────────────

describe('main - スキップ', () => {
  describe('Given: project が設定済みの .md ファイル', () => {
    describe('When: main([...args]) を呼び出す', () => {
      describe('Then: T-CL-E2E-03 - スキップされ skipped カウント増加', () => {
        let inputDir: string;
        let dicsDir: string;
        let monthDir: string;
        let commandHandle: CommandMockHandle;
        let errLogs: string[];
        let errStub: Stub;
        let exitStub: Stub;

        beforeEach(async () => {
          ({ inputDir, dicsDir, monthDir } = await _makeTestDirs());
          await Deno.writeTextFile(
            `${monthDir}/chat.md`,
            '---\ntitle: テスト\nproject: existing-project\n---\n本文',
          );
          // project 設定済みファイルは Claude CLI を呼ばないが、念のため設定
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode('[]')),
          );
          errLogs = [];
          errStub = stub(console, 'error', (...args: unknown[]) => {
            errLogs.push(args.map(String).join(' '));
          });
          // targetMetas が空になると Deno.exit(0) が呼ばれる
          exitStub = stub(Deno, 'exit');
        });

        afterEach(async () => {
          commandHandle.restore();
          errStub.restore();
          exitStub.restore();
          await Deno.remove(inputDir, { recursive: true });
          await Deno.remove(dicsDir, { recursive: true });
        });

        it('T-CL-E2E-03-01: "skipped" メッセージがログに出力される', async () => {
          await main(['claude', '2026-03', '--dry-run', '--input', inputDir, '--dics', dicsDir]);

          assertEquals(errLogs.some((l) => l.includes('skipped')), true);
        });

        it('T-CL-E2E-03-02: 完了ログに skipped=1 が含まれる', async () => {
          await main(['claude', '2026-03', '--dry-run', '--input', inputDir, '--dics', dicsDir]);

          assertEquals(errLogs.some((l) => l.includes('skipped=1')), true);
        });
      });
    });
  });
});

// ─── T-CL-E2E-04: 対象ファイルなし → エラーなし終了 ─────────────────────────

describe('main - 対象ファイルなし', () => {
  describe('Given: .md ファイルが存在しない月別ディレクトリ', () => {
    describe('When: main([...args]) を呼び出す', () => {
      describe('Then: T-CL-E2E-04 - moved=0 skipped=0 error=0 が出力される', () => {
        let inputDir: string;
        let dicsDir: string;
        let commandHandle: CommandMockHandle;
        let errLogs: string[];
        let errStub: Stub;
        let exitStub: Stub;

        beforeEach(async () => {
          ({ inputDir, dicsDir } = await _makeTestDirs());
          // monthDir は _makeTestDirs で作成済み、.md ファイルは置かない
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode('[]')),
          );
          errLogs = [];
          errStub = stub(console, 'error', (...args: unknown[]) => {
            errLogs.push(args.map(String).join(' '));
          });
          exitStub = stub(Deno, 'exit');
        });

        afterEach(async () => {
          commandHandle.restore();
          errStub.restore();
          exitStub.restore();
          await Deno.remove(inputDir, { recursive: true });
          await Deno.remove(dicsDir, { recursive: true });
        });

        it('T-CL-E2E-04-01: "moved=0 skipped=0 error=0" がログに出力される', async () => {
          await main(['claude', '2026-03', '--input', inputDir, '--dics', dicsDir]);

          assertEquals(errLogs.some((l) => l.includes('moved=0 skipped=0 error=0')), true);
        });
      });
    });
  });
});
