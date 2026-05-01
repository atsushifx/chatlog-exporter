// src: scripts/__tests__/integration/classify-chatlog.fileOps.integration.spec.ts
// @(#): loadClassifyFileMeta の統合テスト（実ファイルシステム使用）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { loadClassifyFileMeta } from '../../classify-chatlog.ts';

// ─── loadClassifyFileMeta ─────────────────────────────────────────────────────────────

describe('loadClassifyFileMeta', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-CL-LFM-01: frontmatter 付き md の全フィールド確認 ─────────────────

  describe('Given: frontmatter 付き .md ファイル（project なし）', () => {
    describe('When: loadClassifyFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-01 - 全フィールドが正しく設定される', () => {
        it('T-CL-LFM-01-01: filename が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);

          assertEquals(meta?.filename, 'test.md');
        });

        it('T-CL-LFM-01-02: title が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);

          assertEquals(meta?.title, 'テストタイトル');
        });

        it('T-CL-LFM-01-03: category が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);

          assertEquals(meta?.category, 'development');
        });

        it('T-CL-LFM-01-04: fullText が正しく設定される', async () => {
          const content = '---\ntitle: テストタイトル\ncategory: development\n---\n本文';
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(filePath, content);

          const meta = await loadClassifyFileMeta(filePath);

          assertEquals(meta?.fullText, content);
        });
      });
    });
  });

  // ─── T-CL-LFM-02: 存在しないファイル → null ──────────────────────────────

  describe('Given: 存在しないファイルパス', () => {
    describe('When: loadClassifyFileMeta("/nonexistent/file.md") を呼び出す', () => {
      describe('Then: T-CL-LFM-02 - null が返される', () => {
        it('T-CL-LFM-02-01: null が返される（例外なし）', async () => {
          const meta = await loadClassifyFileMeta('/nonexistent/file.md');

          assertEquals(meta, null);
        });
      });
    });
  });

  // ─── T-CL-LFM-03: project なし → existingProject = "" ────────────────────

  describe('Given: project フィールドのない frontmatter の .md ファイル', () => {
    describe('When: loadClassifyFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-03 - existingProject が空文字列（分類対象）', () => {
        it('T-CL-LFM-03-01: existingProject が "" である', async () => {
          const filePath = `${tempDir}/no-project.md`;
          await Deno.writeTextFile(filePath, '---\ntitle: テスト\n---\n本文');

          const meta = await loadClassifyFileMeta(filePath);

          assertEquals(meta?.existingProject, '');
        });
      });
    });
  });

  // ─── T-CL-LFM-04: project 設定済み → existingProject = "my-app" ──────────

  describe('Given: project: my-app を含む frontmatter の .md ファイル', () => {
    describe('When: loadClassifyFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-04 - existingProject が "my-app"（スキップ対象）', () => {
        it('T-CL-LFM-04-01: existingProject が "my-app" である', async () => {
          const filePath = `${tempDir}/with-project.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テスト\nproject: my-app\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);

          assertEquals(meta?.existingProject, 'my-app');
        });
      });
    });
  });
});
