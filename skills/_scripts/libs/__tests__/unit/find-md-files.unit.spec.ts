// src: skills/_scripts/libs/__tests__/unit/find-md-files.unit.spec.ts
// @(#): findMdFiles のユニットテスト - GlobProvider モックによる検証
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- test target --
import { findMdFiles } from '../../../libs/find-md-files.ts';
import type { GlobProvider } from '../../../types/providers.types.ts';

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

/**
 * mdMap: dir → .md ファイルパス一覧
 * dirMap: dir → サブディレクトリパス一覧
 */
function _makeGlob(mdMap: Record<string, string[]>, dirMap: Record<string, string[]> = {}): GlobProvider {
  return (pattern: string): Promise<string[]> => {
    if (pattern.endsWith('/*.md')) {
      const dir = pattern.slice(0, -5);
      return Promise.resolve(mdMap[dir] ?? []);
    }
    if (pattern.endsWith('/*/')) {
      const dir = pattern.slice(0, -3);
      return Promise.resolve(dirMap[dir] ?? []);
    }
    return Promise.resolve([]);
  };
}

// ─────────────────────────────────────────────
// T-LIB-FM-01: 単一階層の .md ファイル3件取得
// ─────────────────────────────────────────────

describe('findMdFiles', () => {
  describe('Given: 単一階層のディレクトリに .md ファイルが3件ある', () => {
    describe('When: findMdFiles(dir, { glob }) を呼び出す', () => {
      describe('Then: T-LIB-FM-01 - 単一階層の .md ファイル3件取得', () => {
        it('T-LIB-FM-01-01: 全3件のファイルパスが返される', async () => {
          const _glob = _makeGlob({
            '/mock/root': ['/mock/root/a.md', '/mock/root/b.md', '/mock/root/c.md'],
          });

          const _result = await findMdFiles('/mock/root', { glob: _glob });

          assertEquals(_result.length, 3);
        });

        it('T-LIB-FM-01-02: 各パスが /mock/root/<filename> 形式になっている', async () => {
          const _glob = _makeGlob({
            '/mock/root': ['/mock/root/a.md', '/mock/root/b.md', '/mock/root/c.md'],
          });

          const _result = await findMdFiles('/mock/root', { glob: _glob });

          assertEquals(_result.every((p) => p.startsWith('/mock/root/')), true);
        });
      });
    });
  });

  // ─────────────────────────────────────────────
  // T-LIB-FM-02: 3階層ディレクトリの再帰収集
  // ─────────────────────────────────────────────

  describe('Given: 3階層ネストしたディレクトリツリー', () => {
    describe('When: findMdFiles(dir, { glob }) を呼び出す', () => {
      describe('Then: T-LIB-FM-02 - 3階層ディレクトリの再帰収集', () => {
        it('T-LIB-FM-02-01: 全3ファイルのフルパスが返される', async () => {
          const _glob = _makeGlob(
            {
              '/mock': ['/mock/a.md'],
              '/mock/sub1': ['/mock/sub1/b.md'],
              '/mock/sub1/sub2': ['/mock/sub1/sub2/c.md'],
            },
            {
              '/mock': ['/mock/sub1'],
              '/mock/sub1': ['/mock/sub1/sub2'],
            },
          );

          const _result = await findMdFiles('/mock', { glob: _glob });

          assertEquals(_result.length, 3);
        });

        it('T-LIB-FM-02-02: ディレクトリエントリ (sub1, sub2) はパスに含まれない', async () => {
          const _glob = _makeGlob(
            {
              '/mock': ['/mock/a.md'],
              '/mock/sub1': ['/mock/sub1/b.md'],
              '/mock/sub1/sub2': ['/mock/sub1/sub2/c.md'],
            },
            {
              '/mock': ['/mock/sub1'],
              '/mock/sub1': ['/mock/sub1/sub2'],
            },
          );

          const _result = await findMdFiles('/mock', { glob: _glob });

          assertEquals(
            _result.every((p) => !p.endsWith('/sub1') && !p.endsWith('/sub2')),
            true,
          );
        });
      });
    });
  });

  // ─────────────────────────────────────────────
  // T-LIB-FM-03: 辞書順ソートの保証
  // ─────────────────────────────────────────────

  describe('Given: glob が [c.md, a.md, b.md] を逆順で返す', () => {
    describe('When: findMdFiles(dir, { glob }) を呼び出す', () => {
      describe('Then: T-LIB-FM-03 - 辞書順ソートの保証', () => {
        it('T-LIB-FM-03-01: 返却配列が辞書順にソートされている', async () => {
          const _glob = _makeGlob({
            '/mock/root': ['/mock/root/c.md', '/mock/root/a.md', '/mock/root/b.md'],
          });

          const _result = await findMdFiles('/mock/root', { glob: _glob });

          const _sorted = [..._result].sort();
          assertEquals(_result, _sorted);
        });
      });
    });
  });

  // ─────────────────────────────────────────────
  // T-LIB-FM-04: .md 以外ファイルの除外
  // ─────────────────────────────────────────────

  describe('Given: glob が .md ファイルのみを返す（フィルタ済み）', () => {
    describe('When: findMdFiles(dir, { glob }) を呼び出す', () => {
      describe('Then: T-LIB-FM-04 - .md 以外ファイルの除外', () => {
        it('T-LIB-FM-04-01: .md ファイルのみが返される（1件）', async () => {
          const _glob = _makeGlob({
            '/mock/dir': ['/mock/dir/readme.md'],
          });

          const _result = await findMdFiles('/mock/dir', { glob: _glob });

          assertEquals(_result.length, 1);
        });

        it('T-LIB-FM-04-02: .txt/.yaml/.json ファイルは含まれない', async () => {
          const _glob = _makeGlob({
            '/mock/dir': ['/mock/dir/readme.md'],
          });

          const _result = await findMdFiles('/mock/dir', { glob: _glob });

          assertEquals(
            _result.some((p) => p.endsWith('.txt') || p.endsWith('.yaml') || p.endsWith('.json')),
            false,
          );
        });
      });
    });
  });

  // ─────────────────────────────────────────────
  // T-LIB-FM-05: 存在しないディレクトリで空配列（例外なし）
  // ─────────────────────────────────────────────

  describe('Given: glob が空配列を返す（存在しないディレクトリ相当）', () => {
    describe('When: findMdFiles(dir, { glob }) を呼び出す', () => {
      describe('Then: T-LIB-FM-05 - 存在しないディレクトリで空配列（例外なし）', () => {
        it('T-LIB-FM-05-01: 例外がスローされず空配列が返される', async () => {
          const _glob = _makeGlob({});

          const _result = await findMdFiles('/nonexistent/dir', { glob: _glob });

          assertEquals(_result, []);
        });
      });
    });
  });
});
