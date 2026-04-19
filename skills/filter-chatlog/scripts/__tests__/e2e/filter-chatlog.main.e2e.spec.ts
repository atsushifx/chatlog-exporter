// src: scripts/__tests__/e2e/filter-chatlog.main.e2e.spec.ts
// @(#): filter-chatlog main() の E2E テスト
//       main() 経由でのフィルタリングフロー（Deno.Command モック・実 tempdir）
//
//       filter-chatlog の動作:
//         入力: inputDir/agent/YYYY/YYYY-MM/*.md
//         DISCARD 判定かつ confidence >= 0.7 のファイルを削除する
//         (classify-chatlog と異なり、移動ではなく削除)
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import { main } from '../../../../filter-chatlog/scripts/filter-chatlog.ts';

// helpers
import {
  installCommandMock,
  makeNotFoundMock,
  makeSuccessMock,
} from '../../../../../skills/_scripts/__tests__/helpers/deno-command-mock.ts';
import type { CommandMockHandle } from '../../../../../skills/_scripts/__tests__/helpers/deno-command-mock.ts';
import type { LoggerStub } from '../../../../../skills/_scripts/__tests__/helpers/logger-stub.ts';
import { makeLoggerStub } from '../../../../../skills/_scripts/__tests__/helpers/logger-stub.ts';

// ─── テスト用一時ディレクトリセットアップ ─────────────────────────────────────

async function _makeTestDirs(agent = 'claude', period = '2026-03'): Promise<{
  inputDir: string;
  agentDir: string;
  monthDir: string;
}> {
  const inputDir = await Deno.makeTempDir();
  const agentDir = `${inputDir}/${agent}`;
  const yearStr = period.slice(0, 4);
  const monthDir = `${agentDir}/${yearStr}/${period}`;
  await Deno.mkdir(monthDir, { recursive: true });
  return { inputDir, agentDir, monthDir };
}

function _makeValidContent(title = 'テスト'): string {
  const userText = 'u'.repeat(500);
  const assistantText = 'a'.repeat(500);
  return `---\ntitle: ${title}\n---\n### User\n${userText}\n\n### Assistant\n${assistantText}\n`;
}

// ─── T-FL-E2E-01: dry-run → ファイル削除なし ─────────────────────────────────

describe('main - dry-run モード', () => {
  describe('Given: 1 件の .md ファイルと claude agent', () => {
    describe('When: main([...args, "--dry-run"]) を呼び出す', () => {
      describe('Then: T-FL-E2E-01 - dry-run → ファイルが削除されない', () => {
        let inputDir: string;
        let monthDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          ({ inputDir, monthDir } = await _makeTestDirs());
          await Deno.writeTextFile(`${monthDir}/chat.md`, _makeValidContent());
          const response = JSON.stringify([
            { file: 'chat.md', decision: 'DISCARD', confidence: 0.9, reason: 'trivial' },
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
        });

        it('T-FL-E2E-01-01: ファイルが削除されずに残っている', async () => {
          await main(['claude', '2026-03', '--dry-run', '--input', inputDir]);

          const stat = await Deno.stat(`${monthDir}/chat.md`);
          assertEquals(stat.isFile, true);
        });

        it('T-FL-E2E-01-02: "[dry-run]" がログに出力される', async () => {
          await main(['claude', '2026-03', '--dry-run', '--input', inputDir]);

          assertEquals(loggerStub.logLogs.some((l) => l.includes('[dry-run]')), true);
        });
      });
    });
  });
});

// ─── T-FL-E2E-02: DISCARD 判定 → ファイルが削除される ───────────────────────

describe('main - DISCARD 判定', () => {
  describe('Given: 1 件の .md ファイルと DISCARD 判定モック', () => {
    describe('When: main([...args]) を呼び出す（dryRun=false）', () => {
      describe('Then: T-FL-E2E-02 - ファイルが削除される', () => {
        let inputDir: string;
        let monthDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          ({ inputDir, monthDir } = await _makeTestDirs());
          await Deno.writeTextFile(`${monthDir}/discard.md`, _makeValidContent());
          const response = JSON.stringify([
            { file: 'discard.md', decision: 'DISCARD', confidence: 0.9, reason: 'trivial' },
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
        });

        it('T-FL-E2E-02-01: ファイルが削除される', async () => {
          await main(['claude', '2026-03', '--input', inputDir]);

          let fileExists = true;
          try {
            await Deno.stat(`${monthDir}/discard.md`);
          } catch {
            fileExists = false;
          }
          assertEquals(fileExists, false);
        });
      });
    });
  });
});

// ─── T-FL-E2E-03: KEEP 判定 → ファイルが残る ─────────────────────────────────

describe('main - KEEP 判定', () => {
  describe('Given: 1 件の .md ファイルと KEEP 判定モック', () => {
    describe('When: main([...args]) を呼び出す', () => {
      describe('Then: T-FL-E2E-03 - ファイルが残る', () => {
        let inputDir: string;
        let monthDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          ({ inputDir, monthDir } = await _makeTestDirs());
          await Deno.writeTextFile(`${monthDir}/keep.md`, _makeValidContent());
          const response = JSON.stringify([
            { file: 'keep.md', decision: 'KEEP', confidence: 0.9, reason: 'valuable' },
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
        });

        it('T-FL-E2E-03-01: ファイルが残っている', async () => {
          await main(['claude', '2026-03', '--input', inputDir]);

          const stat = await Deno.stat(`${monthDir}/keep.md`);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });
});

// ─── T-FL-E2E-04: 対象ファイルなし → Deno.exit(0) ───────────────────────────

describe('main - 対象ファイルなし', () => {
  describe('Given: .md ファイルが存在しないディレクトリ', () => {
    describe('When: main([...args]) を呼び出す', () => {
      describe('Then: T-FL-E2E-04 - "対象ファイルなし" ログが出力される', () => {
        let inputDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;
        let exitStub: Stub;

        beforeEach(async () => {
          ({ inputDir } = await _makeTestDirs());
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode('[]')),
          );
          loggerStub = makeLoggerStub();
          exitStub = stub(Deno, 'exit');
        });

        afterEach(async () => {
          commandHandle.restore();
          loggerStub.restore();
          exitStub.restore();
          await Deno.remove(inputDir, { recursive: true });
        });

        it('T-FL-E2E-04-01: "対象ファイルなし" がログに出力される', async () => {
          await main(['claude', '2026-03', '--input', inputDir]);

          assertEquals(loggerStub.infoLogs.some((l) => l.includes('対象ファイルなし')), true);
        });
      });
    });
  });
});

// ─── T-FL-E2E-06: period 絞り込み → 指定月のみ処理 ──────────────────────────

describe('main - period 絞り込み', () => {
  describe('Given: 複数月のファイルがある場合に period 指定', () => {
    describe('When: main([...args, "2026-03"]) を呼び出す', () => {
      describe('Then: T-FL-E2E-06 - 指定月のファイルのみ削除対象になる', () => {
        let inputDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          inputDir = await Deno.makeTempDir();
          const agentDir = `${inputDir}/claude`;
          const march = `${agentDir}/2026/2026-03`;
          const april = `${agentDir}/2026/2026-04`;
          await Deno.mkdir(march, { recursive: true });
          await Deno.mkdir(april, { recursive: true });

          await Deno.writeTextFile(`${march}/march.md`, _makeValidContent('March'));
          await Deno.writeTextFile(`${april}/april.md`, _makeValidContent('April'));

          const response = JSON.stringify([
            { file: 'march.md', decision: 'DISCARD', confidence: 0.9, reason: 'trivial' },
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
        });

        it('T-FL-E2E-06-01: 指定月 (2026-03) のファイルが削除される', async () => {
          await main(['claude', '2026-03', '--input', inputDir]);

          let marchExists = true;
          try {
            await Deno.stat(`${inputDir}/claude/2026/2026-03/march.md`);
          } catch {
            marchExists = false;
          }
          assertEquals(marchExists, false);
        });

        it('T-FL-E2E-06-02: 他の月 (2026-04) のファイルは残っている', async () => {
          await main(['claude', '2026-03', '--input', inputDir]);

          const stat = await Deno.stat(`${inputDir}/claude/2026/2026-04/april.md`);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });
});

// ─── T-FL-E2E-07: Claude CLI NotFound → 全件 KEEP 扱い ─────────────────────

describe('main - Claude CLI NotFound', () => {
  describe('Given: claude コマンドが存在しないモック', () => {
    describe('When: main([...args]) を呼び出す', () => {
      describe('Then: T-FL-E2E-07 - ファイルが削除されない', () => {
        let inputDir: string;
        let monthDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          ({ inputDir, monthDir } = await _makeTestDirs());
          await Deno.writeTextFile(`${monthDir}/chat.md`, _makeValidContent());
          commandHandle = installCommandMock(makeNotFoundMock());
          loggerStub = makeLoggerStub();
        });

        afterEach(async () => {
          commandHandle.restore();
          loggerStub.restore();
          await Deno.remove(inputDir, { recursive: true });
        });

        it('T-FL-E2E-07-01: ファイルが残っている（全件 KEEP 扱い）', async () => {
          await main(['claude', '2026-03', '--input', inputDir]);

          const stat = await Deno.stat(`${monthDir}/chat.md`);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });
});
