#!/usr/bin/env -S deno run --allow-read --allow-write
// src: scripts/__tests__/functional/find-md-files.functional.spec.ts
// @(#): findMdFiles の機能テスト - readDir 外部注入によるモック
//       対象: findMdFiles (collectMdFiles を内部利用)
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { findMdFiles } from '../../normalize-chatlog.ts';

// ─── local helpers ────────────────────────────────────────────────────────────

/** テスト用 DirEntry モック生成 */
function _makeDirEntry(
  name: string,
  opts: { isDirectory?: boolean; isFile?: boolean } = {},
): Deno.DirEntry {
  return {
    name,
    isDirectory: opts.isDirectory ?? false,
    isFile: opts.isFile ?? true,
    isSymlink: false,
  };
}

// ─── findMdFiles functional tests ────────────────────────────────────────────

/**
 * findMdFiles の機能テスト。
 * readDir 外部注入により仮想ディレクトリツリーを構築し、
 * .md ファイルの正常取得・再帰・ソート・フィルタリングを検証する。
 */
describe('findMdFiles', () => {
  // ── T-06-04 ──────────────────────────────────────────────────────────────

  /** 正常系: 単一階層に .md ファイルが3件ある場合、全件取得できる */
  describe('Given: readDir がルートディレクトリに3つの .md ファイルを返す', () => {
    describe('When: findMdFiles(dir, readDir) を呼び出す', () => {
      /**
       * Task T-06-04: 単一階層の .md ファイル取得。
       * 全3件が返され、各パスが正しいフルパス形式であることを確認する。
       */
      describe('Then: Task T-06-04 - 単一階層の .md ファイル取得', () => {
        const mockReadDir = (_dir: string | URL): Iterable<Deno.DirEntry> => [
          _makeDirEntry('a.md'),
          _makeDirEntry('b.md'),
          _makeDirEntry('c.md'),
        ];

        it('T-06-04-01: 全3件のファイルパスが返される', () => {
          const result = findMdFiles('/mock/root', mockReadDir);

          assertEquals(result.length, 3);
        });

        it('T-06-04-02: 各パスが /mock/root/<filename> 形式になっている', () => {
          const result = findMdFiles('/mock/root', mockReadDir);

          assertEquals(result.every((p) => p.startsWith('/mock/root/')), true);
        });
      });
    });
  });

  // ── T-06-05 ──────────────────────────────────────────────────────────────

  /** 正常系: サブディレクトリを含む3階層ツリーを再帰的に収集できる */
  describe('Given: readDir が3階層ディレクトリツリーを返す', () => {
    describe('When: findMdFiles(dir, readDir) を呼び出す', () => {
      /**
       * Task T-06-05: サブディレクトリの再帰的 .md 収集。
       * 全階層の .md ファイルが収集され、ディレクトリ自体はパスに含まれないことを確認する。
       */
      describe('Then: Task T-06-05 - 再帰的な .md ファイル収集', () => {
        const mockReadDir = (dir: string | URL): Iterable<Deno.DirEntry> => {
          const d = String(dir);
          if (d === '/mock') {
            return [
              _makeDirEntry('sub1', { isDirectory: true, isFile: false }),
              _makeDirEntry('a.md'),
            ];
          }
          if (d === '/mock/sub1') {
            return [
              _makeDirEntry('sub2', { isDirectory: true, isFile: false }),
              _makeDirEntry('b.md'),
            ];
          }
          if (d === '/mock/sub1/sub2') {
            return [_makeDirEntry('c.md')];
          }
          return [];
        };

        it('T-06-05-01: 全3ファイルのフルパスが返される', () => {
          const result = findMdFiles('/mock', mockReadDir);

          assertEquals(result.length, 3);
        });

        it('T-06-05-02: ディレクトリエントリ (sub1, sub2) はパスに含まれない', () => {
          const result = findMdFiles('/mock', mockReadDir);

          assertEquals(
            result.every((p) => !p.endsWith('/sub1') && !p.endsWith('/sub2')),
            true,
          );
        });
      });
    });
  });

  // ── T-06-06 ──────────────────────────────────────────────────────────────

  /** 正常系: readDir が逆順でファイルを返しても、結果が辞書順ソートされる */
  describe('Given: readDir が [c.md, a.md, b.md] を逆順で返す', () => {
    describe('When: findMdFiles(dir, readDir) を呼び出す', () => {
      /**
       * Task T-06-06: 辞書順ソートの保証。
       * readDir の返却順序に依らず結果が辞書順にソートされることを確認する。
       */
      describe('Then: Task T-06-06 - 辞書順ソートの保証', () => {
        const mockReadDir = (_dir: string | URL): Iterable<Deno.DirEntry> => [
          _makeDirEntry('c.md'),
          _makeDirEntry('a.md'),
          _makeDirEntry('b.md'),
        ];

        it('T-06-06-01: 返却配列が辞書順にソートされている', () => {
          const result = findMdFiles('/mock/root', mockReadDir);

          const sorted = [...result].sort();
          assertEquals(result, sorted);
        });
      });
    });
  });

  // ── T-06-07 ──────────────────────────────────────────────────────────────

  /** 異常系: .md ファイルが存在しない場合は空配列を返す */
  describe('Given: readDir が空の iterable を返す', () => {
    describe('When: findMdFiles(dir, readDir) を呼び出す', () => {
      /**
       * Task T-06-07: ファイルなし時の空配列返却。
       * .md ファイルが存在しない場合に空配列が返ることを確認する。
       */
      describe('Then: Task T-06-07 - .md ファイルなし時の空配列返却', () => {
        const mockReadDir = (_dir: string | URL): Iterable<Deno.DirEntry> => [];

        it('T-06-07-01: 返却配列が空配列 [] である', () => {
          const result = findMdFiles('/empty/dir', mockReadDir);

          assertEquals(result, []);
        });
      });
    });
  });

  // ── T-06-08 ──────────────────────────────────────────────────────────────

  /** エッジケース: .md 以外の拡張子ファイルは結果に含まれない */
  describe('Given: readDir が .md/.txt/.yaml を混在で返す', () => {
    describe('When: findMdFiles(dir, readDir) を呼び出す', () => {
      /**
       * Task T-06-08: 非 .md ファイルのフィルタリング。
       * .md 以外の拡張子ファイルは結果から除外されることを確認する。
       */
      describe('Then: Task T-06-08 - 非 .md ファイルのフィルタリング', () => {
        const mockReadDir = (_dir: string | URL): Iterable<Deno.DirEntry> => [
          _makeDirEntry('note.txt'),
          _makeDirEntry('data.yaml'),
          _makeDirEntry('readme.md'),
          _makeDirEntry('config.json'),
        ];

        it('T-06-08-01: .md ファイルのみが返される（1件）', () => {
          const result = findMdFiles('/mock/dir', mockReadDir);

          assertEquals(result.length, 1);
        });

        it('T-06-08-02: 返却されたパスが .md で終わる', () => {
          const result = findMdFiles('/mock/dir', mockReadDir);

          assertEquals(result[0].endsWith('.md'), true);
        });

        it('T-06-08-03: .txt/.yaml/.json ファイルは含まれない', () => {
          const result = findMdFiles('/mock/dir', mockReadDir);

          assertEquals(
            result.some((p) =>
              p.endsWith('.txt') || p.endsWith('.yaml') || p.endsWith('.json')
            ),
            false,
          );
        });
      });
    });
  });
});
