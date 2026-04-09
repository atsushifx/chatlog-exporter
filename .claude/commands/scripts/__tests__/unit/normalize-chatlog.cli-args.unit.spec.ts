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
  resolveOutputDir,
} from '../../normalize-chatlog.ts';

// ─── parseArgs tests ──────────────────────────────────────────────────────────

/**
 * parseArgs のユニットテスト。
 * CLI 引数配列を解析して { dir, agent, yearMonth, dryRun, concurrency, output } を返す関数の
 * 正常系・デフォルト値・エラー終了・パス正規化を検証する。
 */
describe('parseArgs', () => {
  /** 正常系: --dir・--agent・--year-month・--dry-run・--concurrency・--output を正しくパースする */
  describe('Given: --dir オプションを含む引数配列', () => {
    describe('When: parseArgs(["--dir", "/some/path"]) を呼び出す', () => {
      describe('Then: Task T-08-01 - 全オプションのパース', () => {
        it('T-08-01-01: args.dir が "/some/path" になる', () => {
          const result = parseArgs(['--dir', '/some/path']);

          assertEquals(result.dir, '/some/path');
        });
      });
    });
  });

  /** 正常系: 複数オプションが混在しても全フィールドを正しく解析する */
  describe('Given: --agent・--year-month・--dry-run・--concurrency・--output を含む引数配列', () => {
    describe('When: parseArgs(["--agent","claude","--year-month","2026-03","--dry-run","--concurrency","8","--output","./out"]) を呼び出す', () => {
      describe('Then: Task T-08-01 - 全オプションのパース', () => {
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
    });
  });

  /** 正常系: 省略時はデフォルト値 (concurrency=4, dryRun=false) が適用される */
  describe('Given: --concurrency・--dry-run を含まない引数配列', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: Task T-08-02 - デフォルト値の適用', () => {
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
    });
  });

  /** 異常系: 未知のオプションは Deno.exit(1) を呼び出してエラー終了する */
  describe('Given: 未知のオプションを含む引数配列', () => {
    describe('When: parseArgs(["--unknown"]) を呼び出す', () => {
      describe('Then: Task T-08-03 - 未知オプションでのエラー終了', () => {
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
    });
  });

  /** 正常系: バックスラッシュをスラッシュへ正規化し、位置引数をパスとして auto-detect する */
  describe('Given: パス区切り文字の正規化または自動 --dir 判定が必要な引数配列', () => {
    describe('When: parseArgs(["--dir", "temp\\\\chatlog\\\\claude"]) を呼び出す', () => {
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-01: --dir 値のバックスラッシュがスラッシュに正規化される', () => {
          const result = parseArgs(['--dir', 'temp\\chatlog\\claude']);

          assertEquals(result.dir, 'temp/chatlog/claude');
        });
      });
    });

    describe('When: parseArgs(["temp/chatlog/claude/2026/2026-03"]) を呼び出す', () => {
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-02: / を含む位置引数が args.dir に設定される', () => {
          const result = parseArgs(['temp/chatlog/claude/2026/2026-03']);

          assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
        });
      });
    });

    describe('When: parseArgs(["temp\\\\chatlog\\\\claude\\\\2026\\\\2026-03"]) を呼び出す', () => {
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-03: \\ を含む位置引数がスラッシュ正規化されて args.dir に設定される', () => {
          const result = parseArgs(['temp\\chatlog\\claude\\2026\\2026-03']);

          assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
        });
      });
    });
  });
});

// ─── resolveOutputDir tests ──────────────────────────────────────────────────

/**
 * resolveOutputDir のユニットテスト。
 * InputDir と outputBase、project から OutputDir を解決する関数の
 * 正常系 (chatlog形式/任意パス)・エッジケース (project未指定) を検証する。
 */
describe('resolveOutputDir', () => {
  /** 正常系: chatlog形式のinputDirから agent/<yyyy>/<yyyy-mm>/<project> を組み立てる */
  describe('[正常] Normal Cases', () => {
    describe('Given: chatlog形式のinputDir "temp/chatlog/claude/2026/2026-03" と project "myapp"', () => {
      describe('When: resolveOutputDir(inputDir, outputBase, project) を呼び出す', () => {
        describe('Then: Task T-15-01 - chatlog形式のOutputDir生成', () => {
          it('T-15-01-01: Given chatlog形式のinputDir "temp/chatlog/claude/2026/2026-03" と project "myapp", When resolveOutputDir, Then "base/claude/2026/2026-03/myapp" を返す', () => {
            const result = resolveOutputDir('temp/chatlog/claude/2026/2026-03', 'base', 'myapp');

            assertEquals(result, 'base/claude/2026/2026-03/myapp');
          });
        });
      });
    });

    describe('Given: chatlog形式のinputDir と project が undefined', () => {
      describe('When: resolveOutputDir(inputDir, outputBase, undefined) を呼び出す', () => {
        describe('Then: Task T-15-02 - projectがundefinedのとき "misc" を使う', () => {
          it('T-15-02-01: Given projectがundefined, When resolveOutputDir, Then "base/claude/2026/2026-03/misc" を返す', () => {
            const result = resolveOutputDir('temp/chatlog/claude/2026/2026-03', 'base', undefined);

            assertEquals(result, 'base/claude/2026/2026-03/misc');
          });
        });
      });
    });

    describe('Given: chatlog形式のinputDir と project が空文字', () => {
      describe('When: resolveOutputDir(inputDir, outputBase, "") を呼び出す', () => {
        describe('Then: Task T-15-03 - projectが空文字のとき "misc" を使う', () => {
          it('T-15-03-01: Given projectが空文字, When resolveOutputDir, Then "base/claude/2026/2026-03/misc" を返す', () => {
            const result = resolveOutputDir('temp/chatlog/claude/2026/2026-03', 'base', '');

            assertEquals(result, 'base/claude/2026/2026-03/misc');
          });
        });
      });
    });
  });

  /** 正常系: 任意パスのinputDirは outputBase/<project> を返す */
  describe('[正常] Arbitrary Path Cases', () => {
    describe('Given: 任意パスのinputDir "some/custom/path" と project "proj"', () => {
      describe('When: resolveOutputDir(inputDir, outputBase, project) を呼び出す', () => {
        describe('Then: Task T-15-04 - 任意パスのOutputDir生成', () => {
          it('T-15-04-01: Given 任意パスのinputDir "some/custom/path" と project "proj", When resolveOutputDir, Then "base/proj" を返す', () => {
            const result = resolveOutputDir('some/custom/path', 'base', 'proj');

            assertEquals(result, 'base/proj');
          });
        });
      });
    });

    describe('Given: 任意パスのinputDir と project が undefined', () => {
      describe('When: resolveOutputDir(inputDir, outputBase, undefined) を呼び出す', () => {
        describe('Then: Task T-15-05 - 任意パス + projectがundefinedのとき "misc" を使う', () => {
          it('T-15-05-01: Given 任意パスのinputDir と projectがundefined, When resolveOutputDir, Then "base/misc" を返す', () => {
            const result = resolveOutputDir('some/custom/path', 'base', undefined);

            assertEquals(result, 'base/misc');
          });
        });
      });
    });
  });
});
