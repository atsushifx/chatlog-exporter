// src: scripts/__tests__/integration/classify-chatlog.fileOps.integration.spec.ts
// @(#): loadProjects / loadFileMeta の統合テスト（実ファイルシステム使用）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { loadFileMeta, loadProjects } from '../../classify-chatlog.ts';

// ─── フィクスチャパス ──────────────────────────────────────────────────────────

const ASSETS_DIR = new URL('./assets', import.meta.url)
  .pathname
  .replace(/^\/([A-Z]:)/, '$1'); // Windows: /C:/... → C:/...

// ─── loadProjects ─────────────────────────────────────────────────────────────

describe('loadProjects', () => {
  // ─── T-CL-LP-01: projects.dic の正常読み込み ─────────────────────────────

  describe('Given: コメント行と misc を含む projects.dic', () => {
    describe('When: loadProjects(dicsDir) を呼び出す', () => {
      describe('Then: T-CL-LP-01 - コメント行と misc を除外してプロジェクト一覧を返す', () => {
        it('T-CL-LP-01-01: app1, app2, infra, dev-tools が含まれる', async () => {
          const projects = await loadProjects(ASSETS_DIR);

          assertEquals(projects.includes('app1'), true);
          assertEquals(projects.includes('app2'), true);
          assertEquals(projects.includes('infra'), true);
          assertEquals(projects.includes('dev-tools'), true);
        });

        it('T-CL-LP-01-02: misc は除外される', async () => {
          const projects = await loadProjects(ASSETS_DIR);

          assertEquals(projects.includes('misc'), false);
        });

        it('T-CL-LP-01-03: コメント行（# で始まる行）は含まれない', async () => {
          const projects = await loadProjects(ASSETS_DIR);

          assertEquals(projects.every((p) => !p.startsWith('#')), true);
        });

        it('T-CL-LP-01-04: 空文字列が含まれない', async () => {
          const projects = await loadProjects(ASSETS_DIR);

          assertEquals(projects.every((p) => p.length > 0), true);
        });
      });
    });
  });

  // ─── T-CL-LP-02: ファイルなし → 空配列 ──────────────────────────────────

  describe('Given: projects.dic が存在しないディレクトリ', () => {
    describe('When: loadProjects("/nonexistent") を呼び出す', () => {
      describe('Then: T-CL-LP-02 - ファイルなし → 空配列（エラーなし）', () => {
        it('T-CL-LP-02-01: 空配列が返される', async () => {
          const projects = await loadProjects('/nonexistent/path/does/not/exist');

          assertEquals(projects, []);
        });
      });
    });
  });
});

// ─── loadFileMeta ─────────────────────────────────────────────────────────────

describe('loadFileMeta', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-CL-LFM-01: frontmatter 付き md の全フィールド確認 ─────────────────

  describe('Given: frontmatter 付き .md ファイル（project なし）', () => {
    describe('When: loadFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-01 - 全フィールドが正しく設定される', () => {
        it('T-CL-LFM-01-01: filename が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadFileMeta(filePath);

          assertEquals(meta?.filename, 'test.md');
        });

        it('T-CL-LFM-01-02: title が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadFileMeta(filePath);

          assertEquals(meta?.title, 'テストタイトル');
        });

        it('T-CL-LFM-01-03: category が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadFileMeta(filePath);

          assertEquals(meta?.category, 'development');
        });

        it('T-CL-LFM-01-04: fullText が正しく設定される', async () => {
          const content = '---\ntitle: テストタイトル\ncategory: development\n---\n本文';
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(filePath, content);

          const meta = await loadFileMeta(filePath);

          assertEquals(meta?.fullText, content);
        });
      });
    });
  });

  // ─── T-CL-LFM-02: 存在しないファイル → null ──────────────────────────────

  describe('Given: 存在しないファイルパス', () => {
    describe('When: loadFileMeta("/nonexistent/file.md") を呼び出す', () => {
      describe('Then: T-CL-LFM-02 - null が返される', () => {
        it('T-CL-LFM-02-01: null が返される（例外なし）', async () => {
          const meta = await loadFileMeta('/nonexistent/file.md');

          assertEquals(meta, null);
        });
      });
    });
  });

  // ─── T-CL-LFM-03: project なし → existingProject = "" ────────────────────

  describe('Given: project フィールドのない frontmatter の .md ファイル', () => {
    describe('When: loadFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-03 - existingProject が空文字列（分類対象）', () => {
        it('T-CL-LFM-03-01: existingProject が "" である', async () => {
          const filePath = `${tempDir}/no-project.md`;
          await Deno.writeTextFile(filePath, '---\ntitle: テスト\n---\n本文');

          const meta = await loadFileMeta(filePath);

          assertEquals(meta?.existingProject, '');
        });
      });
    });
  });

  // ─── T-CL-LFM-04: project 設定済み → existingProject = "my-app" ──────────

  describe('Given: project: my-app を含む frontmatter の .md ファイル', () => {
    describe('When: loadFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-04 - existingProject が "my-app"（スキップ対象）', () => {
        it('T-CL-LFM-04-01: existingProject が "my-app" である', async () => {
          const filePath = `${tempDir}/with-project.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テスト\nproject: my-app\n---\n本文',
          );

          const meta = await loadFileMeta(filePath);

          assertEquals(meta?.existingProject, 'my-app');
        });
      });
    });
  });
});
