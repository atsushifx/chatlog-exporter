// src: scripts/__tests__/integration/walk-files.integration.spec.ts
// @(#): walkFiles の統合テスト（実ファイルシステム使用）
//       対象: walkFiles
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

import { walkFiles } from '../../../../_scripts/libs/file-io/walk-files.ts';

// ─── walkFiles ────────────────────────────────────────────────────────────────

/**
 * `walkFiles` の統合テストスイート（実ファイルシステム使用）。
 *
 * ディレクトリを再帰的に走査して指定拡張子のファイルパスを yield する
 * 非同期ジェネレータの動作を検証する。以下のケースをカバーする:
 * - フラットなディレクトリへの複数ファイル収集
 * - サブディレクトリへの再帰走査（全階層のファイルを収集）
 * - 拡張子フィルタ（.jsonl のみ収集し .txt/.md を除外）
 * - 辞書順ソート
 * - 存在しないディレクトリ → 空（エラーなし）
 * - 空ディレクトリ → 空
 *
 * 各テストは `Deno.makeTempDir()` で独立した作業ディレクトリを使用し、
 * `afterEach` で自動クリーンアップする。
 *
 * @see walkFiles
 */
describe('walkFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-EC-WF-01: 複数ファイルの収集 ──────────────────────────────────────

  describe('Given: フラットなディレクトリに .jsonl ファイルが3件', () => {
    describe('When: walkFiles(dir, ".jsonl") を呼び出す', () => {
      beforeEach(async () => {
        await Deno.writeTextFile(`${tempDir}/a.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/b.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/c.jsonl`, '{}');
      });

      describe('Then: T-EC-WF-01 - 3件のファイルパスが返る', () => {
        it('T-EC-WF-01-01: 収集ファイル数が 3', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(tempDir, '.jsonl')) {
            results.push(f);
          }
          assertEquals(results.length, 3);
        });

        it('T-EC-WF-01-02: 全パスが .jsonl で終わる', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(tempDir, '.jsonl')) {
            results.push(f);
          }
          assertEquals(results.every((f) => f.endsWith('.jsonl')), true);
        });
      });
    });
  });

  // ─── T-EC-WF-02: 再帰走査 ─────────────────────────────────────────────────

  describe('Given: サブディレクトリに .jsonl ファイルが存在する構造', () => {
    describe('When: walkFiles(rootDir, ".jsonl") を呼び出す', () => {
      beforeEach(async () => {
        await Deno.mkdir(`${tempDir}/sub1`);
        await Deno.mkdir(`${tempDir}/sub1/deep`);
        await Deno.writeTextFile(`${tempDir}/root.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/sub1/child.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/sub1/deep/grandchild.jsonl`, '{}');
      });

      describe('Then: T-EC-WF-02 - 全階層のファイルを収集する', () => {
        it('T-EC-WF-02-01: 収集ファイル数が 3（全階層）', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(tempDir, '.jsonl')) {
            results.push(f);
          }
          assertEquals(results.length, 3);
        });
      });
    });
  });

  // ─── T-EC-WF-03: 拡張子フィルタ ──────────────────────────────────────────

  describe('Given: .jsonl と .txt が混在するディレクトリ', () => {
    describe('When: walkFiles(dir, ".jsonl") を呼び出す', () => {
      beforeEach(async () => {
        await Deno.writeTextFile(`${tempDir}/a.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/b.txt`, 'text');
        await Deno.writeTextFile(`${tempDir}/c.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/d.md`, '# markdown');
      });

      describe('Then: T-EC-WF-03 - .jsonl ファイルのみ返る', () => {
        it('T-EC-WF-03-01: 収集ファイル数が 2（.jsonl のみ）', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(tempDir, '.jsonl')) {
            results.push(f);
          }
          assertEquals(results.length, 2);
        });

        it('T-EC-WF-03-02: 全パスが .jsonl で終わる', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(tempDir, '.jsonl')) {
            results.push(f);
          }
          assertEquals(results.every((f) => f.endsWith('.jsonl')), true);
        });
      });
    });
  });

  // ─── T-EC-WF-04: ソート順 ─────────────────────────────────────────────────

  describe('Given: アルファベット順でない名前のファイルが複数', () => {
    describe('When: walkFiles(dir, ".jsonl") を呼び出す', () => {
      beforeEach(async () => {
        await Deno.writeTextFile(`${tempDir}/c.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/a.jsonl`, '{}');
        await Deno.writeTextFile(`${tempDir}/b.jsonl`, '{}');
      });

      describe('Then: T-EC-WF-04 - アルファベット順で返る', () => {
        it('T-EC-WF-04-01: パスが辞書順に並んでいる', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(tempDir, '.jsonl')) {
            results.push(f);
          }
          const sorted = [...results].sort();
          assertEquals(results, sorted);
        });
      });
    });
  });

  // ─── T-EC-WF-05: 不存在ディレクトリ → 空 ────────────────────────────────

  describe('Given: 存在しないディレクトリパス', () => {
    describe('When: walkFiles(nonExistentDir, ".jsonl") を呼び出す', () => {
      describe('Then: T-EC-WF-05 - 空のイテレータを返す（エラーなし）', () => {
        it('T-EC-WF-05-01: 収集ファイル数が 0', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(`${tempDir}/no-such-dir`, '.jsonl')) {
            results.push(f);
          }
          assertEquals(results.length, 0);
        });
      });
    });
  });

  // ─── T-EC-WF-06: 空ディレクトリ → 空 ────────────────────────────────────

  describe('Given: ファイルが存在しない空のディレクトリ', () => {
    describe('When: walkFiles(emptyDir, ".jsonl") を呼び出す', () => {
      let emptyDir: string;

      beforeEach(async () => {
        emptyDir = `${tempDir}/empty`;
        await Deno.mkdir(emptyDir);
      });

      describe('Then: T-EC-WF-06 - 空のイテレータを返す', () => {
        it('T-EC-WF-06-01: 収集ファイル数が 0', async () => {
          const results: string[] = [];
          for await (const f of walkFiles(emptyDir, '.jsonl')) {
            results.push(f);
          }
          assertEquals(results.length, 0);
        });
      });
    });
  });
});
