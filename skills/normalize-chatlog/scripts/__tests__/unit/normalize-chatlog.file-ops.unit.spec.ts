// src: scripts/__tests__/unit/normalize-chatlog.file-ops.unit.spec.ts
// @(#): ファイル操作関数のユニットテスト
//       対象: collectMdFiles, findMdFiles, writeOutput, segmentChatlog
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals, assertRejects } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test helpers
import {
  installCommandMock,
  makeFailMock,
  makeSuccessMock,
} from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import type { CommandMockHandle } from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';

// test target
import {
  collectMdFiles,
  findMdFiles,
  segmentChatlog,
  writeOutput,
} from '../../normalize-chatlog.ts';
import type { Stats } from '../../normalize-chatlog.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** フェイクの Deno.DirEntry を作る */
function makeDirEntry(
  name: string,
  options: { isFile: boolean; isDirectory: boolean; isSymlink: boolean },
): Deno.DirEntry {
  return { name, ...options } as Deno.DirEntry;
}

/** 指定エントリを返す fakeReadDir を作る */
function makeFakeReadDir(
  entries: { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean }[],
): (path: string | URL) => Iterable<Deno.DirEntry> {
  return (_path: string | URL): Iterable<Deno.DirEntry> => {
    return entries.map((e) => makeDirEntry(e.name, e)) as Iterable<Deno.DirEntry>;
  };
}

/** 例外をスローする fakeReadDir を作る（存在しないディレクトリのシミュレーション） */
function makeThrowingReadDir(): (path: string | URL) => Iterable<Deno.DirEntry> {
  return (_path: string | URL): Iterable<Deno.DirEntry> => {
    throw new Deno.errors.NotFound('directory not found');
  };
}

// ─── collectMdFiles tests ─────────────────────────────────────────────────────

/**
 * collectMdFiles のユニットテスト。
 * fakeReadDir を使ってファイルシステムへの依存を排除した純粋なユニットテスト。
 */
describe('collectMdFiles', () => {
  /** 正常系: .md ファイルのみが results に追加される */
  describe('[正常] Normal Cases', () => {
    it('T-CMF-01-01: .md ファイルのみが results に追加される', () => {
      // arrange
      const fakeReadDir = makeFakeReadDir([
        { name: 'chat1.md', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'notes.txt', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'readme.md', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'image.png', isFile: true, isDirectory: false, isSymlink: false },
      ]);
      const results: string[] = [];

      // act
      collectMdFiles('testdir', results, fakeReadDir);

      // assert
      assertEquals(results, ['testdir/chat1.md', 'testdir/readme.md']);
    });

    it('T-CMF-02-01: サブディレクトリの .md ファイルも収集される', () => {
      // arrange
      const subDirEntries = [
        { name: 'sub.md', isFile: true, isDirectory: false, isSymlink: false },
      ];
      const rootEntries = [
        { name: 'root.md', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'subdir', isFile: false, isDirectory: true, isSymlink: false },
      ];
      const fakeReadDir = (path: string | URL): Iterable<Deno.DirEntry> => {
        const pathStr = String(path);
        const entries = pathStr.endsWith('subdir') ? subDirEntries : rootEntries;
        return entries.map((e) => makeDirEntry(e.name, e)) as Iterable<Deno.DirEntry>;
      };
      const results: string[] = [];

      // act
      collectMdFiles('testdir', results, fakeReadDir);

      // assert
      assertEquals(results, ['testdir/root.md', 'testdir/subdir/sub.md']);
    });
  });

  /** 異常系: 存在しないディレクトリは例外をスローせず何も追加しない */
  describe('[異常] Error Cases', () => {
    it('T-CMF-03-01: NotFound 例外をスローせず results に何も追加しない', () => {
      // arrange
      const throwingReadDir = makeThrowingReadDir();
      const results: string[] = [];

      // act (例外がスローされないことを確認)
      collectMdFiles('nonexistent/dir', results, throwingReadDir);

      // assert
      assertEquals(results, []);
    });
  });

  /** エッジケース: .md ファイルが1件もないとき */
  describe('[エッジケース] Edge Cases', () => {
    it('T-CMF-04-01: .md ファイルがないとき results が空配列のまま', () => {
      // arrange
      const fakeReadDir = makeFakeReadDir([
        { name: 'notes.txt', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'image.png', isFile: true, isDirectory: false, isSymlink: false },
      ]);
      const results: string[] = [];

      // act
      collectMdFiles('testdir', results, fakeReadDir);

      // assert
      assertEquals(results, []);
    });
  });
});

// ─── findMdFiles tests ────────────────────────────────────────────────────────

/**
 * findMdFiles のユニットテスト。
 * fakeReadDir を使ってファイルシステムへの依存を排除した純粋なユニットテスト。
 */
describe('findMdFiles', () => {
  /** 正常系: .md ファイルが複数あるとき、ソートされた配列を返す */
  describe('[正常] Normal Cases', () => {
    it('T-FMF-01-01: ソートされた .md ファイルパスの配列を返す', () => {
      // arrange
      const fakeReadDir = makeFakeReadDir([
        { name: 'chat-b.md', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'chat-a.md', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'notes.txt', isFile: true, isDirectory: false, isSymlink: false },
        { name: 'chat-c.md', isFile: true, isDirectory: false, isSymlink: false },
      ]);

      // act
      const result = findMdFiles('testdir', fakeReadDir);

      // assert
      assertEquals(result, [
        'testdir/chat-a.md',
        'testdir/chat-b.md',
        'testdir/chat-c.md',
      ]);
    });
  });

  /** エッジケース: ディレクトリが空のとき、空配列を返す */
  describe('[エッジケース] Edge Cases', () => {
    it('T-FMF-02-01: ディレクトリが空のとき空配列を返す', () => {
      // arrange
      const fakeReadDir = makeFakeReadDir([]);

      // act
      const result = findMdFiles('emptydir', fakeReadDir);

      // assert
      assertEquals(result, []);
    });
  });
});

// ─── writeOutput tests ───────────────────────────────────────────────────────

/**
 * writeOutput のユニットテスト。
 * Deno.makeTempDir を使ってテンポラリディレクトリにファイルを書き込む実際のファイル操作テスト。
 */
describe('writeOutput', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await Deno.makeTempDir({ prefix: 'normalize-chatlog-test-' });
  });

  afterEach(async () => {
    await Deno.remove(tmpDir, { recursive: true });
  });

  /** 正常系: dryRun=false のとき、ファイルが書き込まれ stats.success が 1 増える */
  describe('[正常] Normal Cases', () => {
    it('T-WO-01-01: ファイルが書き込まれ stats.success が 1 増える', async () => {
      // arrange
      const outputPath = `${tmpDir}/output.md`;
      const content = '# Test Content\nHello World';
      const stats: Stats = { success: 0, skip: 0, fail: 0 };

      // act
      await writeOutput(outputPath, content, false, stats);

      // assert
      const written = await Deno.readTextFile(outputPath);
      assertEquals(written, content);
      assertEquals(stats.success, 1);
    });

    it('T-WO-02-01: 既存ファイルが .old-01.md にバックアップされ新ファイルが書かれる', async () => {
      // arrange
      const outputPath = `${tmpDir}/output.md`;
      const oldContent = 'old content';
      const newContent = 'new content';
      await Deno.writeTextFile(outputPath, oldContent);
      const stats: Stats = { success: 0, skip: 0, fail: 0 };

      // act
      await writeOutput(outputPath, newContent, false, stats);

      // assert
      const backupPath = `${tmpDir}/output.old-01.md`;
      const backupContent = await Deno.readTextFile(backupPath);
      const written = await Deno.readTextFile(outputPath);
      assertEquals(backupContent, oldContent);
      assertEquals(written, newContent);
      assertEquals(stats.success, 1);
    });
  });

  /** 異常系: dryRun=true のとき、ファイルは書き込まれず stats が変化しない */
  describe('[異常] Dry-run Cases', () => {
    it('T-WO-03-01: dryRun=true のときファイルは書き込まれず stats.success が増えない', async () => {
      // arrange
      const outputPath = `${tmpDir}/output-dryrun.md`;
      const stats: Stats = { success: 0, skip: 0, fail: 0 };

      // act
      await writeOutput(outputPath, 'content', true, stats);

      // assert
      let fileExists = true;
      try {
        await Deno.stat(outputPath);
      } catch {
        fileExists = false;
      }
      assertEquals(fileExists, false);
      assertEquals(stats.success, 0);
    });
  });

  /** 異常系: R-010 ガード — outputPath に temp/chatlog/ が含まれるとき Error をスロー */
  describe('[異常] R-010 Guard Cases', () => {
    it('T-WO-04-01: outputPath に temp/chatlog/ が含まれるとき Error をスロー', async () => {
      // arrange
      const outputPath = 'temp/chatlog/agent/2026/2026-01/output.md';
      const stats: Stats = { success: 0, skip: 0, fail: 0 };

      // act & assert
      await assertRejects(
        () => writeOutput(outputPath, 'content', false, stats),
        Error,
        'Forbidden Output',
      );
    });
  });
});

// ─── segmentChatlog tests ─────────────────────────────────────────────────────

/**
 * segmentChatlog のユニットテスト。
 * Deno.Command をモックして AI 呼び出しを制御する。
 */
describe('segmentChatlog', () => {
  let mockHandle: CommandMockHandle;

  afterEach(() => {
    if (mockHandle) {
      mockHandle.restore();
    }
  });

  /** 正常系: AI が有効な JSON 配列を返すとき Segment 配列を返す */
  describe('[正常] Normal Cases', () => {
    it('T-SC-01-01: AI が有効な JSON 配列を返すとき Segment 配列を返す', async () => {
      // arrange
      const segments = [
        { title: 'Topic 1', summary: 'Summary 1', body: 'Body 1' },
        { title: 'Topic 2', summary: 'Summary 2', body: 'Body 2' },
      ];
      const stdout = new TextEncoder().encode(JSON.stringify(segments));
      mockHandle = installCommandMock(makeSuccessMock(stdout));

      // act
      const result = await segmentChatlog('test.md', 'content');

      // assert
      assertEquals(result, segments);
    });
  });

  /** 異常系: AI が非ゼロ exit code で終了するとき null を返す */
  describe('[異常] Error Cases', () => {
    it('T-SC-02-01: AI が非ゼロ exit code で終了するとき null を返す', async () => {
      // arrange
      mockHandle = installCommandMock(makeFailMock(1));

      // act
      const result = await segmentChatlog('test.md', 'content');

      // assert
      assertEquals(result, null);
    });

    it('T-SC-03-01: AI が JSON でない文字列を返すとき null を返す', async () => {
      // arrange
      const stdout = new TextEncoder().encode('This is not JSON at all.');
      mockHandle = installCommandMock(makeSuccessMock(stdout));

      // act
      const result = await segmentChatlog('test.md', 'content');

      // assert
      assertEquals(result, null);
    });
  });

  /** エッジケース: セグメントが MAX_SEGMENTS(10) を超えるとき先頭10件のみ返す */
  describe('[エッジケース] Edge Cases', () => {
    it('T-SC-04-01: 12件のセグメントが返るとき先頭10件のみに制限される', async () => {
      // arrange
      const segments = Array.from({ length: 12 }, (_, i) => ({
        title: `Topic ${i + 1}`,
        summary: `Summary ${i + 1}`,
        body: `Body ${i + 1}`,
      }));
      const stdout = new TextEncoder().encode(JSON.stringify(segments));
      mockHandle = installCommandMock(makeSuccessMock(stdout));

      // act
      const result = await segmentChatlog('test.md', 'content');

      // assert
      assertEquals(result?.length, 10);
      assertEquals(result?.[0].title, 'Topic 1');
      assertEquals(result?.[9].title, 'Topic 10');
    });
  });
});
