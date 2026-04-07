#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/integration/normalize-chatlog.integration.spec.ts
// @(#): 実ファイルシステムを使った統合テスト
//       対象: findMdFiles, collectMdFiles, resolveInputDir, writeOutput
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals, assertRejects } from '@std/assert';
import { after, afterEach, before, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import {
  collectMdFiles,
  findMdFiles,
  resolveInputDir,
  writeOutput,
} from '../../normalize-chatlog.ts';
import type { Stats } from '../../normalize-chatlog.ts';

// ─── findMdFiles / collectMdFiles tests ──────────────────────────────────────

/**
 * findMdFiles / collectMdFiles のユニットテスト。
 * ディレクトリを再帰的に走査して .md ファイルを辞書順で収集する関数の
 * 正常系・フィルタリング・エラー耐性を検証する。
 */
describe('findMdFiles', () => {
  /** 正常系: サブディレクトリを再帰的に走査して .md ファイルを辞書順で収集する */
  describe('Given: 異なる深さに3つの.mdファイルを持つディレクトリツリー', () => {
    describe('When: findMdFiles(dir) を呼び出す', () => {
      /**
       * Task T-06-01: 再帰的MD収集。
       * 全 .md ファイルが収集され、返却配列が辞書順にソートされていることを確認する。
       */
      describe('Then: Task T-06-01 - 再帰的MD収集', () => {
        let dir: string;
        beforeEach(() => {
          dir = Deno.makeTempDirSync();
        });
        afterEach(() => {
          Deno.removeSync(dir, { recursive: true });
        });

        it('T-06-01-01: 全3つのファイルパスが返される', () => {
          Deno.mkdirSync(`${dir}/sub1`);
          Deno.mkdirSync(`${dir}/sub1/sub2`);
          Deno.writeTextFileSync(`${dir}/a.md`, '');
          Deno.writeTextFileSync(`${dir}/sub1/b.md`, '');
          Deno.writeTextFileSync(`${dir}/sub1/sub2/c.md`, '');

          const result = findMdFiles(dir);

          assertEquals(result.length, 3);
        });

        it('T-06-01-02: 返却配列が辞書順にソートされている', () => {
          Deno.writeTextFileSync(`${dir}/c.md`, '');
          Deno.writeTextFileSync(`${dir}/a.md`, '');
          Deno.writeTextFileSync(`${dir}/b.md`, '');

          const result = findMdFiles(dir);

          const sorted = [...result].sort();
          assertEquals(result, sorted);
        });
      });
    });
  });

  /** 正常系: .md 以外の拡張子と空ディレクトリはスキップし .md のみを返す */
  describe('Given: .md、.txt、.yamlファイルを含むディレクトリ', () => {
    describe('When: collectMdFiles(dir, results) を呼び出す', () => {
      /**
       * Task T-06-02: 非MDファイルと空ディレクトリ。
       * .md 以外の拡張子はスキップされ、.md が0件の場合は空配列が返ることを確認する。
       */
      describe('Then: Task T-06-02 - 非MDファイルと空ディレクトリ', () => {
        let dir: string;
        beforeEach(() => {
          dir = Deno.makeTempDirSync();
        });
        afterEach(() => {
          Deno.removeSync(dir, { recursive: true });
        });

        it('T-06-02-01: .mdファイルのみが結果に含まれる', () => {
          Deno.writeTextFileSync(`${dir}/a.md`, '');
          Deno.writeTextFileSync(`${dir}/b.txt`, '');
          Deno.writeTextFileSync(`${dir}/c.yaml`, '');

          const results: string[] = [];
          collectMdFiles(dir, results);

          assertEquals(results.length, 1);
          assertEquals(results[0].endsWith('.md'), true);
        });

        it('T-06-02-02: .mdファイルが0件のディレクトリで空配列を返す', () => {
          Deno.writeTextFileSync(`${dir}/b.txt`, '');
          Deno.writeTextFileSync(`${dir}/c.yaml`, '');

          const result = findMdFiles(dir);

          assertEquals(result, []);
        });
      });
    });
  });

  /** エッジケース: 存在しないパスはエラーをスローせず空のまま返す */
  describe('Given: ファイルシステムに存在しないパス', () => {
    describe('When: collectMdFiles(nonExistentPath, results) を呼び出す', () => {
      /**
       * Task T-06-03: 存在しないディレクトリ。
       * 存在しないパスを渡してもエラーがスローされず、results が空のまま返ることを確認する。
       */
      describe('Then: Task T-06-03 - 存在しないディレクトリ', () => {
        it('T-06-03-01: エラーがスローされず results が空のままである', () => {
          const nonExistentPath = '/this/path/does/not/exist/at/all/9999';

          const results: string[] = [];
          collectMdFiles(nonExistentPath, results);

          assertEquals(results, []);
        });
      });
    });
  });
});

// ─── resolveInputDir tests ────────────────────────────────────────────────────

/**
 * resolveInputDir のユニットテスト。
 * --dir・--agent/--year-month オプションから入力ディレクトリパスを解決し、
 * 存在しない場合は Deno.exit(1) を呼び出す関数の正常系・異常系を検証する。
 */
describe('resolveInputDir', () => {
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

        it('T-07-01-01: 存在する --dir パスをそのまま返す', () => {
          const result = resolveInputDir({ dir });

          assertEquals(result, dir);
        });
      });
    });
  });

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

        it('T-07-03-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ dir: '/nonexistent/path/xyz' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

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

        it('T-07-04-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({});

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

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

        it('T-07-05-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ agent: 'claude', yearMonth: '1999-01' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

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

        before(async () => {
          await Deno.mkdir(DIR_2026, { recursive: true });
          await Deno.mkdir(DIR_2025, { recursive: true });
        });

        after(async () => {
          await Deno.remove(`temp/chatlog/${AGENT}/2026`, { recursive: true });
          await Deno.remove(`temp/chatlog/${AGENT}/2025`, { recursive: true });
        });

        it('T-07-02-01: temp/chatlog/<agent>/<year>/<yearMonth> のパスを返す', () => {
          const result = resolveInputDir({ agent: AGENT, yearMonth: YEAR_MONTH_2026 });

          assertEquals(result, DIR_2026);
        });

        it('T-07-02-02: yearMonth="2025-11" のとき返却パスが "2025/2025-11" のサブパスを含む', () => {
          const result = resolveInputDir({ agent: AGENT, yearMonth: YEAR_MONTH_2025 });

          assertEquals(result.includes('2025/2025-11'), true);
        });
      });
    });
  });
});

// ─── writeOutput tests ────────────────────────────────────────────────────────

/**
 * writeOutput のユニットテスト。
 * アトミックなファイル書き込み、既存ファイルのスキップ、ドライランモードを検証する。
 */
describe('writeOutput', () => {
  /** 正常系: 存在しない出力パスにアトミックにファイルを書き込む */
  describe('Given: 存在しない出力パスと dryRun=false', () => {
    let tmpDir: string;
    let stats: Stats;
    const content = '---\ntitle: test\n---\n## Summary\nbody';

    beforeEach(async () => {
      tmpDir = await Deno.makeTempDir();
      stats = { success: 0, skip: 0, fail: 0 };
    });

    afterEach(async () => {
      await Deno.remove(tmpDir, { recursive: true });
    });

    describe('When: writeOutput を呼び出す', () => {
      describe('Then: Task T-13-01 - アトミックなファイル書き込み', () => {
        it('T-13-01-01: ファイルが作成され stats.success がインクリメントされる', async () => {
          const outputPath = `${tmpDir}/entry.md`;

          await writeOutput(outputPath, content, false, stats);

          const written = await Deno.readTextFile(outputPath);
          assertEquals(written, content);
          assertEquals(stats.success, 1);
        });

        it('T-13-01-02: .tmp ファイルが最終的に存在せず出力ファイルが作成される', async () => {
          const outputPath = `${tmpDir}/entry.md`;
          const tmpPath = outputPath + '.tmp';

          await writeOutput(outputPath, content, false, stats);

          // Final output file must exist
          const written = await Deno.readTextFile(outputPath);
          assertEquals(written, content);
          // .tmp file must not remain
          let tmpExists = false;
          try {
            await Deno.stat(tmpPath);
            tmpExists = true;
          } catch {
            tmpExists = false;
          }
          assertEquals(tmpExists, false);
          assertEquals(stats.success, 1);
        });
      });
    });
  });

  /** エッジケース: すでに存在するファイルはスキップされる */
  describe('Given: すでに存在する出力パス', () => {
    let tmpDir: string;
    let stats: Stats;

    beforeEach(async () => {
      tmpDir = await Deno.makeTempDir();
      stats = { success: 0, skip: 0, fail: 0 };
      await Deno.writeTextFile(`${tmpDir}/existing.md`, 'existing content');
    });

    afterEach(async () => {
      await Deno.remove(tmpDir, { recursive: true });
    });

    describe('When: writeOutput を呼び出す', () => {
      describe('Then: Task T-13-02 - 既存出力のスキップ (R-011)', () => {
        it('T-13-02-01: stats.skip がインクリメントされ既存ファイルが上書きされない', async () => {
          const outputPath = `${tmpDir}/existing.md`;

          await writeOutput(outputPath, 'new content', false, stats);

          const fileContent = await Deno.readTextFile(outputPath);
          assertEquals(fileContent, 'existing content');
          assertEquals(stats.skip, 1);
          assertEquals(stats.success, 0);
        });
      });
    });
  });

  /** 正常系: dryRun=true のときファイルを作成しない */
  describe('Given: dryRun=true と存在しない出力パス', () => {
    let tmpDir: string;
    let stats: Stats;

    beforeEach(async () => {
      tmpDir = await Deno.makeTempDir();
      stats = { success: 0, skip: 0, fail: 0 };
    });

    afterEach(async () => {
      await Deno.remove(tmpDir, { recursive: true });
    });

    describe('When: writeOutput を呼び出す', () => {
      describe('Then: Task T-13-03 - ドライランモード', () => {
        it('T-13-03-01: ファイルが作成されない', async () => {
          const dryPath = `${tmpDir}/dry.md`;

          await writeOutput(dryPath, '## Summary\nbody', true, stats);

          let fileExists = false;
          try {
            Deno.statSync(dryPath);
            fileExists = true;
          } catch {
            fileExists = false;
          }
          assertEquals(fileExists, false);
          assertEquals(stats.success, 0);
        });
      });
    });
  });

  /** 異常系: R-010 ガード — temp/chatlog/ 配下への書き込みはエラーをスローする */
  describe('[異常] Error Cases', () => {
    describe('Given: temp/chatlog/ 配下の入力パスを出力先に指定する', () => {
      describe('When: writeOutput(inputPath, content, false, stats) を呼び出す', () => {
        describe('Then: Task T-13-04 - R-010 ガードによるエラー', () => {
          it('T-13-04-01: temp/chatlog/ 配下のパスへの書き込みが行われない (R-010)', async () => {
            const stats: Stats = { success: 0, skip: 0, fail: 0 };
            const inputPath = 'temp/chatlog/claude/2026/2026-03/sample.md';

            await assertRejects(
              async () => {
                await writeOutput(inputPath, 'overwrite', false, stats);
              },
              Error,
              'R-010',
            );
          });
        });
      });
    });
  });
});
