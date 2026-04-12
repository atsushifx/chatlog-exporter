// src: scripts/__tests__/functional/filter-chatlog.findMdFiles.functional.spec.ts
// @(#): findMdFiles の機能テスト
//       実 tempdir を使用したファイル列挙の検証
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { findMdFiles } from '../../filter-chatlog.ts';

// ─── 共通セットアップ ──────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await Deno.makeTempDir();
});

afterEach(async () => {
  await Deno.remove(tempDir, { recursive: true });
});

// ─── T-FL-FM-01: YYYY/YYYY-MM/ 構造 ─────────────────────────────────────────

describe('findMdFiles', () => {
  describe('Given: YYYY/YYYY-MM/ 構造のディレクトリに .md ファイルが 2 件', () => {
    describe('When: findMdFiles(baseDir) を呼び出す', () => {
      describe('Then: T-FL-FM-01 - 2 件のファイルパスが返される', () => {
        it('T-FL-FM-01-01: 2 件の .md ファイルが返される', async () => {
          const monthDir = `${tempDir}/2026/2026-03`;
          await Deno.mkdir(monthDir, { recursive: true });
          await Deno.writeTextFile(`${monthDir}/chat-a.md`, '# A');
          await Deno.writeTextFile(`${monthDir}/chat-b.md`, '# B');

          const result = await findMdFiles(tempDir);

          assertEquals(result.length, 2);
        });

        it('T-FL-FM-01-02: ソート済みで返される', async () => {
          const monthDir = `${tempDir}/2026/2026-03`;
          await Deno.mkdir(monthDir, { recursive: true });
          await Deno.writeTextFile(`${monthDir}/chat-b.md`, '# B');
          await Deno.writeTextFile(`${monthDir}/chat-a.md`, '# A');

          const result = await findMdFiles(tempDir);

          assertEquals(result[0].endsWith('chat-a.md'), true);
          assertEquals(result[1].endsWith('chat-b.md'), true);
        });
      });
    });
  });

  // ─── T-FL-FM-02: period 指定 → 対象月のみ ──────────────────────────────────

  describe('Given: 複数月のディレクトリがある場合に period 指定', () => {
    describe('When: findMdFiles(baseDir, "2026-03") を呼び出す', () => {
      describe('Then: T-FL-FM-02 - 指定月のファイルのみ返される', () => {
        it('T-FL-FM-02-01: period="2026-03" → その月のファイルのみ', async () => {
          const march = `${tempDir}/2026/2026-03`;
          const april = `${tempDir}/2026/2026-04`;
          await Deno.mkdir(march, { recursive: true });
          await Deno.mkdir(april, { recursive: true });
          await Deno.writeTextFile(`${march}/chat.md`, '# March');
          await Deno.writeTextFile(`${april}/chat.md`, '# April');

          const result = await findMdFiles(tempDir, '2026-03');

          assertEquals(result.length, 1);
          assertEquals(result[0].includes('2026-03'), true);
        });
      });
    });
  });

  // ─── T-FL-FM-03: period + project 指定 ─────────────────────────────────────

  describe('Given: period と project を両方指定', () => {
    describe('When: findMdFiles(baseDir, period, project) を呼び出す', () => {
      describe('Then: T-FL-FM-03 - 該当プロジェクトのファイルのみ返される', () => {
        it('T-FL-FM-03-01: project 指定 → そのプロジェクトのファイルのみ', async () => {
          const projA = `${tempDir}/2026/2026-03/proj-a`;
          const projB = `${tempDir}/2026/2026-03/proj-b`;
          await Deno.mkdir(projA, { recursive: true });
          await Deno.mkdir(projB, { recursive: true });
          await Deno.writeTextFile(`${projA}/chat.md`, '# ProjA');
          await Deno.writeTextFile(`${projB}/chat.md`, '# ProjB');

          const result = await findMdFiles(tempDir, '2026-03', 'proj-a');

          assertEquals(result.length, 1);
          assertEquals(result[0].includes('proj-a'), true);
        });
      });
    });
  });

  // ─── T-FL-FM-04: ディレクトリなし → 空配列 ─────────────────────────────────

  describe('Given: 存在しないディレクトリを指定', () => {
    describe('When: findMdFiles("/nonexistent/path") を呼び出す', () => {
      describe('Then: T-FL-FM-04 - 空配列が返される（エラーなし）', () => {
        it('T-FL-FM-04-01: 存在しないディレクトリ → 空配列', async () => {
          const result = await findMdFiles(`${tempDir}/nonexistent`);

          assertEquals(result.length, 0);
        });
      });
    });
  });

  // ─── T-FL-FM-05: フラット構造（YYYY-MM/ のみ） ──────────────────────────────

  describe('Given: YYYY/YYYY-MM/ ではなく YYYY-MM/ のフラット構造', () => {
    describe('When: findMdFiles(baseDir, "2026-03") を呼び出す', () => {
      describe('Then: T-FL-FM-05 - フラット構造からもファイルを収集する', () => {
        it('T-FL-FM-05-01: フラット構造でも .md ファイルが返される', async () => {
          const flatDir = `${tempDir}/2026-03`;
          await Deno.mkdir(flatDir, { recursive: true });
          await Deno.writeTextFile(`${flatDir}/chat.md`, '# Flat');

          const result = await findMdFiles(tempDir, '2026-03');

          assertEquals(result.length, 1);
        });
      });
    });
  });
});
