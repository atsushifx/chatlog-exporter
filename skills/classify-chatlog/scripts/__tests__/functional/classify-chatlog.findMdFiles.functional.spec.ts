// src: scripts/__tests__/functional/classify-chatlog.findMdFiles.functional.spec.ts
// @(#): findMdFilesFlat の機能テスト
//       collectChatGptFiles / collectClaudeFiles の組み合わせ（実 tempdir 使用）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { findMdFilesFlat } from '../../classify-chatlog.ts';

// ─── tempdir セットアップ ─────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await Deno.makeTempDir();
});

afterEach(async () => {
  await Deno.remove(tempDir, { recursive: true });
});

// ─── T-CL-FMF-01: agent=chatgpt → YYYY/YYYY-MM/*.md 形式で収集 ───────────────

describe('findMdFilesFlat', () => {
  describe('Given: chatgpt/2026/2026-03/ に .md ファイルが2件', () => {
    describe('When: findMdFilesFlat(tempDir, "chatgpt") を呼び出す', () => {
      describe('Then: T-CL-FMF-01 - chatgpt ディレクトリ構造から .md を収集', () => {
        it('T-CL-FMF-01-01: 2件の .md ファイルパスが返される', async () => {
          const monthDir = `${tempDir}/chatgpt/2026/2026-03`;
          await Deno.mkdir(monthDir, { recursive: true });
          await Deno.writeTextFile(`${monthDir}/chat-a.md`, '# A');
          await Deno.writeTextFile(`${monthDir}/chat-b.md`, '# B');

          const result = await findMdFilesFlat(tempDir, 'chatgpt');

          assertEquals(result.length, 2);
        });

        it('T-CL-FMF-01-02: 返されたパスがすべて .md で終わる', async () => {
          const monthDir = `${tempDir}/chatgpt/2026/2026-03`;
          await Deno.mkdir(monthDir, { recursive: true });
          await Deno.writeTextFile(`${monthDir}/chat-a.md`, '# A');
          await Deno.writeTextFile(`${monthDir}/chat-b.md`, '# B');

          const result = await findMdFilesFlat(tempDir, 'chatgpt');

          assertEquals(result.every((p) => p.endsWith('.md')), true);
        });
      });
    });
  });

  // ─── T-CL-FMF-02: agent=claude → YYYY-MM/*.md 形式で収集 ────────────────────

  describe('Given: claude/2026-03/ に .md ファイルが2件', () => {
    describe('When: findMdFilesFlat(tempDir, "claude") を呼び出す', () => {
      describe('Then: T-CL-FMF-02 - claude ディレクトリ構造から .md を収集', () => {
        it('T-CL-FMF-02-01: 2件の .md ファイルパスが返される', async () => {
          const monthDir = `${tempDir}/claude/2026-03`;
          await Deno.mkdir(monthDir, { recursive: true });
          await Deno.writeTextFile(`${monthDir}/chat-a.md`, '# A');
          await Deno.writeTextFile(`${monthDir}/chat-b.md`, '# B');

          const result = await findMdFilesFlat(tempDir, 'claude');

          assertEquals(result.length, 2);
        });

        it('T-CL-FMF-02-02: 返されたパスがすべて .md で終わる', async () => {
          const monthDir = `${tempDir}/claude/2026-03`;
          await Deno.mkdir(monthDir, { recursive: true });
          await Deno.writeTextFile(`${monthDir}/chat-a.md`, '# A');
          await Deno.writeTextFile(`${monthDir}/chat-b.md`, '# B');

          const result = await findMdFilesFlat(tempDir, 'claude');

          assertEquals(result.every((p) => p.endsWith('.md')), true);
        });
      });
    });
  });

  // ─── T-CL-FMF-03: period 指定でフィルタリング ────────────────────────────────

  describe('Given: claude/2026-02/ と claude/2026-03/ に各1件の .md', () => {
    describe('When: findMdFilesFlat(tempDir, "claude", "2026-03") を呼び出す', () => {
      describe('Then: T-CL-FMF-03 - period 指定で 2026-03 のみ収集', () => {
        it('T-CL-FMF-03-01: 1件のみ返される（2026-03 の分）', async () => {
          await Deno.mkdir(`${tempDir}/claude/2026-02`, { recursive: true });
          await Deno.mkdir(`${tempDir}/claude/2026-03`, { recursive: true });
          await Deno.writeTextFile(`${tempDir}/claude/2026-02/chat-feb.md`, '# Feb');
          await Deno.writeTextFile(`${tempDir}/claude/2026-03/chat-mar.md`, '# Mar');

          const result = await findMdFilesFlat(tempDir, 'claude', '2026-03');

          assertEquals(result.length, 1);
        });

        it('T-CL-FMF-03-02: 返されたパスが "2026-03" を含む', async () => {
          await Deno.mkdir(`${tempDir}/claude/2026-02`, { recursive: true });
          await Deno.mkdir(`${tempDir}/claude/2026-03`, { recursive: true });
          await Deno.writeTextFile(`${tempDir}/claude/2026-02/chat-feb.md`, '# Feb');
          await Deno.writeTextFile(`${tempDir}/claude/2026-03/chat-mar.md`, '# Mar');

          const result = await findMdFilesFlat(tempDir, 'claude', '2026-03');

          assertEquals(result[0].includes('2026-03'), true);
        });
      });
    });
  });

  // ─── T-CL-FMF-04: 結果がソートされる ────────────────────────────────────────

  describe('Given: claude/2026-03/ に逆順で作成した3つの .md ファイル', () => {
    describe('When: findMdFilesFlat(tempDir, "claude") を呼び出す', () => {
      describe('Then: T-CL-FMF-04 - 返却パスが辞書順ソートされる', () => {
        it('T-CL-FMF-04-01: 結果が sorted() と一致する', async () => {
          const monthDir = `${tempDir}/claude/2026-03`;
          await Deno.mkdir(monthDir, { recursive: true });
          await Deno.writeTextFile(`${monthDir}/c.md`, '# C');
          await Deno.writeTextFile(`${monthDir}/a.md`, '# A');
          await Deno.writeTextFile(`${monthDir}/b.md`, '# B');

          const result = await findMdFilesFlat(tempDir, 'claude');

          const sorted = [...result].sort();
          assertEquals(result, sorted);
        });
      });
    });
  });

  // ─── T-CL-FMF-05: 対象ディレクトリが存在しない → 空配列 ─────────────────────

  describe('Given: 存在しない inputDir を指定', () => {
    describe('When: findMdFilesFlat("/nonexistent", "claude") を呼び出す', () => {
      describe('Then: T-CL-FMF-05 - ディレクトリなし → 空配列（エラーなし）', () => {
        it('T-CL-FMF-05-01: 空配列が返される（例外なし）', async () => {
          const result = await findMdFilesFlat('/nonexistent/path/does/not/exist', 'claude');

          assertEquals(result, []);
        });
      });
    });
  });
});
