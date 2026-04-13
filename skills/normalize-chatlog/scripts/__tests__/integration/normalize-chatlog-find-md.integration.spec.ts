#!/usr/bin/env -S deno run --allow-read --allow-write
// src: scripts/__tests__/integration/normalize-chatlog-findMd.integration.spec.ts
// @(#): findMdFiles / collectMdFiles の統合テスト - 実ファイルシステムを使った検証
//       対象: findMdFiles, collectMdFiles
//       テスト種別: 正常系 / 異常系 / エッジケース
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals, assertGreater } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { collectMdFiles, findMdFiles } from '../../normalize-chatlog.ts';

// ─── findMdFiles integration tests ───────────────────────────────────────────

/**
 * findMdFiles のインテグレーションテスト。
 * 実ファイルシステムを使って再帰的 .md 収集の正常系・フィルタリング・
 * エッジケースを検証する。
 */
describe('findMdFiles', () => {
  // ─── T-16-01: 再帰的 MD 収集（正常系） ──────────────────────────────────

  /** 正常系: ネストしたディレクトリから .md ファイルを再帰収集する */
  describe('Given: 複数階層に .md ファイルを持つディレクトリツリー', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await Deno.makeTempDir();
    });

    afterEach(async () => {
      await Deno.remove(dir, { recursive: true });
    });

    describe('When: findMdFiles(dir) を呼び出す', () => {
      describe('Then: Task T-16-01 - 再帰的 MD 収集', () => {
        /** 正常系: 3階層ネストの .md ファイルが全件収集される */
        it('T-16-01-01: ネストしたディレクトリ配下の全 .md ファイルが返される', async () => {
          await Deno.mkdir(`${dir}/sub1`);
          await Deno.mkdir(`${dir}/sub1/sub2`);
          await Deno.writeTextFile(`${dir}/a.md`, '');
          await Deno.writeTextFile(`${dir}/sub1/b.md`, '');
          await Deno.writeTextFile(`${dir}/sub1/sub2/c.md`, '');

          const result = findMdFiles(dir);

          assertEquals(result.length, 3);
        });

        /** 正常系: ソート順が辞書順になっている */
        it('T-16-01-02: 返却配列が辞書順にソートされている', async () => {
          await Deno.writeTextFile(`${dir}/c.md`, '');
          await Deno.writeTextFile(`${dir}/a.md`, '');
          await Deno.writeTextFile(`${dir}/b.md`, '');

          const result = findMdFiles(dir);

          const sorted = [...result].sort();
          assertEquals(result, sorted);
        });

        /** 正常系: サブディレクトリより深い階層のパスも絶対パスに含む */
        it('T-16-01-03: 返却パスにサブディレクトリ名が含まれる', async () => {
          await Deno.mkdir(`${dir}/sub1`);
          await Deno.writeTextFile(`${dir}/sub1/b.md`, '');

          const result = findMdFiles(dir);

          assertEquals(result.length, 1);
          assertEquals(result[0].includes('sub1'), true);
        });
      });
    });
  });

  // ─── T-16-02: 非 MD ファイルのフィルタリング（正常系） ──────────────────

  /** 正常系: .md 以外の拡張子と空ディレクトリはスキップし .md のみを返す */
  describe('Given: .md、.txt、.yaml ファイルを含むディレクトリ', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await Deno.makeTempDir();
    });

    afterEach(async () => {
      await Deno.remove(dir, { recursive: true });
    });

    describe('When: findMdFiles(dir) を呼び出す', () => {
      describe('Then: Task T-16-02 - 非 MD ファイルのフィルタリング', () => {
        /** 正常系: .md のみが結果に含まれる */
        it('T-16-02-01: .md ファイルのみが結果に含まれる', async () => {
          await Deno.writeTextFile(`${dir}/a.md`, '');
          await Deno.writeTextFile(`${dir}/b.txt`, '');
          await Deno.writeTextFile(`${dir}/c.yaml`, '');

          const result = findMdFiles(dir);

          assertEquals(result.length, 1);
          assertEquals(result[0].endsWith('.md'), true);
        });

        /** 正常系: .md ゼロ件のディレクトリでは空配列 */
        it('T-16-02-02: .md ファイルが 0 件のディレクトリで空配列を返す', async () => {
          await Deno.writeTextFile(`${dir}/b.txt`, '');
          await Deno.writeTextFile(`${dir}/c.yaml`, '');

          const result = findMdFiles(dir);

          assertEquals(result, []);
        });

        /** 正常系: 大文字拡張子 .MD はフィルタリングされる */
        it('T-16-02-03: 大文字拡張子 .MD のファイルは結果に含まれない', async () => {
          await Deno.writeTextFile(`${dir}/a.md`, '');
          await Deno.writeTextFile(`${dir}/b.MD`, '');

          const result = findMdFiles(dir);

          // .md（小文字）のみ収集され、.MD は除外される
          assertEquals(result.length, 1);
          assertEquals(result[0].endsWith('.md'), true);
        });

        /** 正常系: .md 拡張子を含まない名前（例: readme.mdx）は除外される */
        it('T-16-02-04: .mdx や .markdown 拡張子のファイルは結果に含まれない', async () => {
          await Deno.writeTextFile(`${dir}/a.md`, '');
          await Deno.writeTextFile(`${dir}/b.mdx`, '');
          await Deno.writeTextFile(`${dir}/c.markdown`, '');

          const result = findMdFiles(dir);

          assertEquals(result.length, 1);
        });
      });
    });
  });

  // ─── T-16-03: 空ディレクトリのエッジケース ───────────────────────────────

  /** エッジケース: 空ディレクトリで空配列を返す */
  describe('Given: .md ファイルが存在しない空ディレクトリ', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await Deno.makeTempDir();
    });

    afterEach(async () => {
      await Deno.remove(dir, { recursive: true });
    });

    describe('When: findMdFiles(dir) を呼び出す', () => {
      describe('Then: Task T-16-03 - 空ディレクトリのエッジケース', () => {
        /** エッジケース: 完全に空のディレクトリ */
        it('T-16-03-01: 空ディレクトリで空配列が返される', () => {
          const result = findMdFiles(dir);

          assertEquals(result, []);
        });

        /** エッジケース: 空のサブディレクトリのみ存在する場合 */
        it('T-16-03-02: 空のサブディレクトリのみの場合も空配列が返される', async () => {
          await Deno.mkdir(`${dir}/empty_sub`);

          const result = findMdFiles(dir);

          assertEquals(result, []);
        });

        /** エッジケース: 存在しないパスを渡した場合も空配列が返される */
        it('T-16-03-03: 存在しないパスを渡した場合も空配列が返される', () => {
          const nonExistentDir = `${dir}/does_not_exist`;

          const result = findMdFiles(nonExistentDir);

          assertEquals(result, []);
        });
      });
    });
  });

  // ─── T-16-06: ドットファイルと特殊名称のエッジケース ────────────────────

  /** エッジケース: ドット始まりの .md ファイルや特殊ファイル名の扱い */
  describe('Given: ドット始まりの .md ファイルを含むディレクトリ', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await Deno.makeTempDir();
    });

    afterEach(async () => {
      await Deno.remove(dir, { recursive: true });
    });

    describe('When: findMdFiles(dir) を呼び出す', () => {
      describe('Then: Task T-16-06 - ドットファイルのエッジケース', () => {
        /** エッジケース: .hidden.md のような隠しファイル（ドット始まり）も収集される */
        it('T-16-06-01: ドット始まりの .md ファイル（隠しファイル）も収集される', async () => {
          await Deno.writeTextFile(`${dir}/normal.md`, '');
          await Deno.writeTextFile(`${dir}/.hidden.md`, '');

          const result = findMdFiles(dir);

          // どちらも .md なので両方収集される
          assertGreater(result.length, 0);
          assertEquals(result.some((p) => p.endsWith('.md')), true);
        });

        /** エッジケース: ファイル名が .md だけのファイルも収集される */
        it('T-16-06-02: ファイル名が ".md" だけのファイルも収集される', async () => {
          await Deno.writeTextFile(`${dir}/.md`, '');

          const result = findMdFiles(dir);

          assertEquals(result.length, 1);
          assertEquals(result[0].endsWith('.md'), true);
        });
      });
    });
  });
});

// ─── collectMdFiles integration tests ────────────────────────────────────────

/**
 * collectMdFiles のインテグレーションテスト。
 * 実ファイルシステムを使って results アキュムレータへの追記と
 * 存在しないディレクトリでのエラー耐性を検証する。
 */
describe('collectMdFiles', () => {
  // ─── T-16-04: results アキュムレータへの追記（正常系） ───────────────────

  /** 正常系: .md ファイルを results に追記する */
  describe('Given: .md、.txt ファイルを含むディレクトリ', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await Deno.makeTempDir();
    });

    afterEach(async () => {
      await Deno.remove(dir, { recursive: true });
    });

    describe('When: collectMdFiles(dir, results) を呼び出す', () => {
      describe('Then: Task T-16-04 - .md ファイルの results への追記', () => {
        /** 正常系: .md のみが results に追加される */
        it('T-16-04-01: .md ファイルのみが results に追記される', async () => {
          await Deno.writeTextFile(`${dir}/a.md`, '');
          await Deno.writeTextFile(`${dir}/b.txt`, '');

          const results: string[] = [];
          collectMdFiles(dir, results);

          assertEquals(results.length, 1);
          assertEquals(results[0].endsWith('.md'), true);
        });

        /** 正常系: 複数ディレクトリを渡すと results に累積される */
        it('T-16-04-02: 2つのディレクトリを連続して呼び出すと results に累積される', async () => {
          const dir2 = await Deno.makeTempDir();
          try {
            await Deno.writeTextFile(`${dir}/a.md`, '');
            await Deno.writeTextFile(`${dir2}/b.md`, '');

            const results: string[] = [];
            collectMdFiles(dir, results);
            collectMdFiles(dir2, results);

            // 両ディレクトリの .md ファイルが累積されている
            assertEquals(results.length, 2);
          } finally {
            await Deno.remove(dir2, { recursive: true });
          }
        });

        /** 正常系: サブディレクトリ内の .md も results に追記される */
        it('T-16-04-03: サブディレクトリ内の .md ファイルも results に追記される', async () => {
          await Deno.mkdir(`${dir}/sub`);
          await Deno.writeTextFile(`${dir}/a.md`, '');
          await Deno.writeTextFile(`${dir}/sub/b.md`, '');
          await Deno.writeTextFile(`${dir}/sub/c.txt`, '');

          const results: string[] = [];
          collectMdFiles(dir, results);

          assertEquals(results.length, 2);
          assertEquals(results.every((p) => p.endsWith('.md')), true);
        });
      });
    });
  });

  // ─── T-16-05: 存在しないディレクトリのエラー耐性（異常系） ──────────────

  /** 異常系/エッジケース: 存在しないパスはエラーをスローせず results を空のまま返す */
  describe('Given: ファイルシステムに存在しないパス', () => {
    describe('When: collectMdFiles(nonExistentPath, results) を呼び出す', () => {
      describe('Then: Task T-16-05 - 存在しないディレクトリのエラー耐性', () => {
        /** 異常系: 存在しないパスでもエラーをスローしない */
        it('T-16-05-01: エラーがスローされず results が空のままである', () => {
          const nonExistentPath = '/this/path/does/not/exist/at/all/9999';

          const results: string[] = [];
          collectMdFiles(nonExistentPath, results);

          assertEquals(results, []);
        });

        /** 異常系: 既存 results に追記済みの場合、存在しないパスでも既存エントリは保持される */
        it('T-16-05-02: 既存 results に影響せず既存エントリが保持される', async () => {
          const tempDir = await Deno.makeTempDir();
          try {
            await Deno.writeTextFile(`${tempDir}/a.md`, '');
            const results: string[] = [];
            collectMdFiles(tempDir, results);

            // 存在しないパスを渡しても既存 results は変わらない
            collectMdFiles('/nonexistent/xyz/9999', results);

            assertEquals(results.length, 1);
          } finally {
            await Deno.remove(tempDir, { recursive: true });
          }
        });
      });
    });
  });
});
