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

        it('T-CL-LFM-01-02: frontmatter の title が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);
          const _title = meta?.frontmatter.get('title');

          assertEquals(typeof _title === 'string' ? _title : '', 'テストタイトル');
        });

        it('T-CL-LFM-01-03: frontmatter の category が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);
          const _category = meta?.frontmatter.get('category');

          assertEquals(typeof _category === 'string' ? _category : '', 'development');
        });

        it('T-CL-LFM-01-04: frontmatterText と content が正しく設定される', async () => {
          const filePath = `${tempDir}/test.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テストタイトル\ncategory: development\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);

          assertEquals(
            meta?.frontmatterText,
            '---\ntitle: テストタイトル\ncategory: development\n---\n',
          );
          assertEquals(meta?.content, '本文\n');
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

  // ─── T-CL-LFM-03: project なし → frontmatter.get('project') が undefined ────

  describe('Given: project フィールドのない frontmatter の .md ファイル', () => {
    describe('When: loadClassifyFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-03 - frontmatter.get("project") が undefined（分類対象）', () => {
        it('T-CL-LFM-03-01: frontmatter.get("project") が undefined である', async () => {
          const filePath = `${tempDir}/no-project.md`;
          await Deno.writeTextFile(filePath, '---\ntitle: テスト\n---\n本文');

          const meta = await loadClassifyFileMeta(filePath);
          const _project = meta?.frontmatter.get('project');

          assertEquals(_project, undefined);
        });
      });
    });
  });

  // ─── T-CL-LFM-04: project 設定済み → frontmatter.get('project') = "my-app" ──

  describe('Given: project: my-app を含む frontmatter の .md ファイル', () => {
    describe('When: loadClassifyFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-04 - frontmatter.get("project") が "my-app"（スキップ対象）', () => {
        it('T-CL-LFM-04-01: frontmatter.get("project") が "my-app" である', async () => {
          const filePath = `${tempDir}/with-project.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntitle: テスト\nproject: my-app\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);
          const _project = meta?.frontmatter.get('project');

          assertEquals(typeof _project === 'string' ? _project : '', 'my-app');
        });
      });
    });
  });

  // ─── T-CL-LFM-05: topics 配列の取得 ─────────────────────────────────────

  describe('Given: topics を含む frontmatter の .md ファイル', () => {
    describe('When: loadClassifyFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-05 - topics が正しく取得される', () => {
        it('T-CL-LFM-05-01: frontmatter.get("topics") が ["TypeScript", "Deno"] である', async () => {
          const filePath = `${tempDir}/with-topics.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntopics:\n  - TypeScript\n  - Deno\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);
          const _topics = meta?.frontmatter.get('topics');

          assertEquals(Array.isArray(_topics) ? _topics as string[] : [], ['TypeScript', 'Deno']);
        });
      });
    });
  });

  // ─── T-CL-LFM-06: tags 配列の取得 ────────────────────────────────────────

  describe('Given: tags を含む frontmatter の .md ファイル', () => {
    describe('When: loadClassifyFileMeta(filePath) を呼び出す', () => {
      describe('Then: T-CL-LFM-06 - tags が正しく取得される', () => {
        it('T-CL-LFM-06-01: frontmatter.get("tags") が ["refactoring", "bdd"] である', async () => {
          const filePath = `${tempDir}/with-tags.md`;
          await Deno.writeTextFile(
            filePath,
            '---\ntags:\n  - refactoring\n  - bdd\n---\n本文',
          );

          const meta = await loadClassifyFileMeta(filePath);
          const _tags = meta?.frontmatter.get('tags');

          assertEquals(Array.isArray(_tags) ? _tags as string[] : [], ['refactoring', 'bdd']);
        });
      });
    });
  });
});
