// src: scripts/__tests__/e2e/prefilter-chatlog.e2e.spec.ts
// @(#): prefilter-chatlog main() の E2E テスト
//       main() 経由でのノイズフィルタリングフロー（実 tempdir・Deno.exit stub）
//
//       prefilter-chatlog の動作:
//         入力: inputDir/agent/YYYY/YYYY-MM/*.md
//         正規表現でノイズと判定したファイルを削除する
//         --dry-run: 削除せず対象パスを stdout に出力
//         --report:  NOISE\t{reason}\t{path} 形式で stdout に出力（削除なし）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import { main } from '../../prefilter-chatlog.ts';

// helpers
import type { LoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';
import { makeLoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';

// ─── テスト用一時ディレクトリセットアップ ─────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await Deno.makeTempDir();
});

afterEach(async () => {
  await Deno.remove(tempDir, { recursive: true });
});

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

function _makeValidContent(): string {
  const userText = 'u'.repeat(300);
  const assistantText = 'a'.repeat(300);
  return `---\ntitle: テスト\n---\n### User\n${userText}\n\n### Assistant\n${assistantText}\n`;
}

async function _makeAgentDir(agent: string, period: string): Promise<string> {
  const yyyy = period.slice(0, 4);
  const dir = `${tempDir}/${agent}/${yyyy}/${period}`;
  await Deno.mkdir(dir, { recursive: true });
  return dir;
}

// ─── T-PF-E2E-01: --dry-run → ファイル削除なし、パスが stdout に出力 ──────────

describe('main (prefilter) - dry-run モード', () => {
  describe('Given: ノイズファイル名の .md ファイルと --dry-run フラグ', () => {
    describe('When: main(["claude", "--dry-run", "--input", tempDir]) を呼び出す', () => {
      describe('Then: T-PF-E2E-01 - ファイルが削除されずパスが stdout に出力される', () => {
        let loggerStub: LoggerStub;

        beforeEach(() => {
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          loggerStub.restore();
        });

        it('T-PF-E2E-01-01: ノイズファイルが削除されずに残っている', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          const filePath = `${dir}/say-ok-and-nothing-else.md`;
          await Deno.writeTextFile(filePath, _makeValidContent());

          await main(['claude', '2026-03', '--dry-run', '--input', tempDir]);

          const stat = await Deno.stat(filePath);
          assertEquals(stat.isFile, true);
        });

        it('T-PF-E2E-01-02: stdout にノイズファイルのパスが出力される', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          const filePath = `${dir}/say-ok-and-nothing-else.md`;
          await Deno.writeTextFile(filePath, _makeValidContent());

          await main(['claude', '2026-03', '--dry-run', '--input', tempDir]);

          assertEquals(loggerStub.logLogs.some((line) => line.includes('say-ok-and-nothing-else.md')), true);
        });
      });
    });
  });
});

// ─── T-PF-E2E-02: --report → NOISE\t{reason}\t{path} 形式、削除なし ──────────

describe('main (prefilter) - report モード', () => {
  describe('Given: ノイズファイル名の .md ファイルと --report フラグ', () => {
    describe('When: main(["claude", "--report", "--input", tempDir]) を呼び出す', () => {
      describe('Then: T-PF-E2E-02 - NOISE タブ区切り形式で出力、削除なし', () => {
        let loggerStub: LoggerStub;

        beforeEach(() => {
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          loggerStub.restore();
        });

        it('T-PF-E2E-02-01: logger.log の出力が "NOISE\\t" で始まる', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/say-ok-and-nothing-else.md`, _makeValidContent());

          await main(['claude', '2026-03', '--report', '--input', tempDir]);

          assertEquals(loggerStub.logLogs.some((line) => line.startsWith('NOISE\t')), true);
        });

        it('T-PF-E2E-02-02: タブ区切りで reason と filePath が含まれる', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/say-ok-and-nothing-else.md`, _makeValidContent());

          await main(['claude', '2026-03', '--report', '--input', tempDir]);

          const noiseLine = loggerStub.logLogs.find((line) => line.startsWith('NOISE\t'));
          assertEquals(noiseLine !== undefined, true);
          assertEquals(noiseLine!.split('\t').length >= 3, true);
        });

        it('T-PF-E2E-02-03: ファイルが削除されずに残っている', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          const filePath = `${dir}/say-ok-and-nothing-else.md`;
          await Deno.writeTextFile(filePath, _makeValidContent());

          await main(['claude', '2026-03', '--report', '--input', tempDir]);

          const stat = await Deno.stat(filePath);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });
});

// ─── T-PF-E2E-03: 通常実行 → ノイズファイルが削除される ─────────────────────

describe('main (prefilter) - 通常実行（削除あり）', () => {
  describe('Given: ノイズと正常ファイルが混在するディレクトリ', () => {
    describe('When: main(["claude", "--input", tempDir]) を呼び出す', () => {
      describe('Then: T-PF-E2E-03 - ノイズは削除、正常は残る', () => {
        let loggerStub: LoggerStub;

        beforeEach(() => {
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          loggerStub.restore();
        });

        it('T-PF-E2E-03-01: say-ok-and-nothing-else.md が削除される', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          const noisePath = `${dir}/say-ok-and-nothing-else.md`;
          await Deno.writeTextFile(noisePath, _makeValidContent());

          await main(['claude', '2026-03', '--input', tempDir]);

          let exists = false;
          try {
            await Deno.stat(noisePath);
            exists = true;
          } catch {
            exists = false;
          }
          assertEquals(exists, false);
        });

        it('T-PF-E2E-03-02: 正常ファイルが残っている', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/say-ok-and-nothing-else.md`, _makeValidContent());
          const validPath = `${dir}/valid-chat.md`;
          await Deno.writeTextFile(validPath, _makeValidContent());

          await main(['claude', '2026-03', '--input', tempDir]);

          const stat = await Deno.stat(validPath);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });
});

// ─── T-PF-E2E-04: 正常ファイルのみ → 全件 keep ───────────────────────────────

describe('main (prefilter) - 全件 keep', () => {
  describe('Given: 正常ファイル 2 件', () => {
    describe('When: main(["claude", "--input", tempDir]) を呼び出す', () => {
      describe('Then: T-PF-E2E-04 - 全ファイルが残っており keep=2 のログ', () => {
        let loggerStub: LoggerStub;

        beforeEach(() => {
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          loggerStub.restore();
        });

        it('T-PF-E2E-04-01: 全ファイルが削除されずに残っている', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          const path1 = `${dir}/valid-1.md`;
          const path2 = `${dir}/valid-2.md`;
          await Deno.writeTextFile(path1, _makeValidContent());
          await Deno.writeTextFile(path2, _makeValidContent());

          await main(['claude', '2026-03', '--input', tempDir]);

          const stat1 = await Deno.stat(path1);
          const stat2 = await Deno.stat(path2);
          assertEquals(stat1.isFile, true);
          assertEquals(stat2.isFile, true);
        });

        it('T-PF-E2E-04-02: 完了ログに "noise=0" が含まれる', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/valid-1.md`, _makeValidContent());

          await main(['claude', '2026-03', '--input', tempDir]);

          assertEquals(loggerStub.infoLogs.some((line) => line.includes('noise=0')), true);
        });
      });
    });
  });
});

// ─── T-PF-E2E-05: 存在しない inputDir → Deno.exit(1) ────────────────────────

describe('main (prefilter) - 存在しない inputDir', () => {
  describe('Given: 存在しない inputDir', () => {
    describe('When: main(["claude", "--input", "/nonexistent/path"]) を呼び出す', () => {
      describe('Then: T-PF-E2E-05 - Deno.exit(1) が呼ばれる', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        let loggerStub: LoggerStub;

        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          exitStub.restore();
          loggerStub.restore();
        });

        it('T-PF-E2E-05-01: Deno.exit(1) がちょうど 1 回呼ばれる', async () => {
          await main(['claude', '--input', '/nonexistent/path/that/does/not/exist']);

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });
});

// ─── T-PF-E2E-06: 空ディレクトリ → noise=0 keep=0 ログ ──────────────────────

describe('main (prefilter) - 空ディレクトリ', () => {
  describe('Given: .md ファイルが 0 件のディレクトリ', () => {
    describe('When: main(["claude", "--input", tempDir]) を呼び出す', () => {
      describe('Then: T-PF-E2E-06 - "noise=0 keep=0 error=0" を含むログが出力される', () => {
        let loggerStub: LoggerStub;

        beforeEach(() => {
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          loggerStub.restore();
        });

        it('T-PF-E2E-06-01: 完了ログに "noise=0 keep=0 error=0" が含まれる', async () => {
          await Deno.mkdir(`${tempDir}/claude`, { recursive: true });

          await main(['claude', '--input', tempDir]);

          assertEquals(loggerStub.infoLogs.some((line) => line.includes('noise=0') && line.includes('keep=0')), true);
        });
      });
    });
  });
});

// ─── T-PF-E2E-07: period 絞り込み → 指定月のみ削除対象 ──────────────────────

describe('main (prefilter) - period 絞り込み', () => {
  describe('Given: 2026-03 と 2026-04 両方にノイズファイル', () => {
    describe('When: main(["claude", "2026-03", "--input", tempDir]) を呼び出す', () => {
      describe('Then: T-PF-E2E-07 - 2026-03 のみ削除され 2026-04 は残る', () => {
        let loggerStub: LoggerStub;

        beforeEach(() => {
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          loggerStub.restore();
        });

        it('T-PF-E2E-07-01: 2026-03 のノイズファイルが削除される', async () => {
          const dir03 = await _makeAgentDir('claude', '2026-03');
          const noisePath03 = `${dir03}/say-ok-and-nothing-else.md`;
          await Deno.writeTextFile(noisePath03, _makeValidContent());

          await main(['claude', '2026-03', '--input', tempDir]);

          let exists = false;
          try {
            await Deno.stat(noisePath03);
            exists = true;
          } catch {
            exists = false;
          }
          assertEquals(exists, false);
        });

        it('T-PF-E2E-07-02: 2026-04 のノイズファイルは残っている（period 絞り込み）', async () => {
          const dir03 = await _makeAgentDir('claude', '2026-03');
          const dir04 = await _makeAgentDir('claude', '2026-04');
          await Deno.writeTextFile(`${dir03}/say-ok-and-nothing-else.md`, _makeValidContent());
          const noisePath04 = `${dir04}/say-ok-and-nothing-else.md`;
          await Deno.writeTextFile(noisePath04, _makeValidContent());

          await main(['claude', '2026-03', '--input', tempDir]);

          const stat = await Deno.stat(noisePath04);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });
});

// ─── T-PF-E2E-08: --report → 完了ログに "report" が含まれる ─────────────────

describe('main (prefilter) - report 完了ログ', () => {
  describe('Given: 正常ファイル 1 件と --report フラグ', () => {
    describe('When: main(["claude", "--report", "--input", tempDir]) を呼び出す', () => {
      describe('Then: T-PF-E2E-08 - 完了ログに "report" が含まれる', () => {
        let loggerStub: LoggerStub;

        beforeEach(() => {
          loggerStub = makeLoggerStub();
        });

        afterEach(() => {
          loggerStub.restore();
        });

        it('T-PF-E2E-08-01: 完了ログに "report" が含まれる', async () => {
          const dir = await _makeAgentDir('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/valid.md`, _makeValidContent());

          await main(['claude', '2026-03', '--report', '--input', tempDir]);

          assertEquals(loggerStub.infoLogs.some((line) => line.includes('report')), true);
        });
      });
    });
  });
});
