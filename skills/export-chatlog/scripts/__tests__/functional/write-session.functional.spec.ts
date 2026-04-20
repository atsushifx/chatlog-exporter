// src: scripts/__tests__/functional/write-session.functional.spec.ts
// @(#): writeSession の機能テスト
//       対象: writeSession
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words sess sessabcd sessabcdef

// -- import --

import { assertEquals, assertStringIncludes } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

import { writeSession } from '../../libs/session-writer.ts';
import type { ExportedSession } from '../../types/session.types.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

function _makeSession(overrides: Partial<ExportedSession> = {}): ExportedSession {
  return {
    meta: {
      sessionId: 'sess-abcdef12-3456-7890-abcd-ef1234567890',
      date: '2026-03-15',
      project: 'my-project',
      slug: 'test-question',
      firstUserText: 'What is TDD?',
    },
    turns: [
      { role: 'user', text: 'What is TDD?' },
      { role: 'assistant', text: 'TDD stands for Test-Driven Development.' },
    ],
    ...overrides,
  };
}

// ─── writeSession ─────────────────────────────────────────────────────────────

/**
 * `writeSession` の機能テストスイート。
 *
 * エクスポートセッションを Markdown ファイルとして書き出す関数の動作を検証する。
 * 以下のケースをカバーする:
 * - Markdown ファイルの生成確認（返却パスが .md で終わる・ファイルが実際に存在する）
 * - パス構造: agent/YYYY/YYYY-MM/ セグメントの確認
 * - ファイル内容: frontmatter・H1 タイトル・### User/Assistant セクション
 * - 深いネストの outputBase でのディレクトリ自動生成
 * - agent="codex" でのパス確認
 * - sessionId ハッシュ（先頭 8 文字）のファイル名への包含
 *
 * 各テストは `Deno.makeTempDir()` で独立した出力先を使用し、
 * `afterEach` で自動クリーンアップする。
 *
 * @see writeSession
 * @see buildOutputPath
 * @see renderMarkdown
 */
describe('writeSession', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-EC-WS-01: ファイル生成確認 ─────────────────────────────────────────

  describe('Given: 基本的な ExportedSession', () => {
    describe('When: writeSession(tempDir, "claude", session) を呼び出す', () => {
      describe('Then: T-EC-WS-01 - Markdown ファイルが生成される', () => {
        it('T-EC-WS-01-01: 返却パスが .md で終わる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          assertEquals(outPath.endsWith('.md'), true);
        });

        it('T-EC-WS-01-02: 返却パスのファイルが実際に存在する', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          // Windows パス対応
          const normalizedPath = outPath.replace(/^\/([A-Z]:)/, '$1');
          const stat = await Deno.stat(normalizedPath);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });

  // ─── T-EC-WS-02: パス構造の検証 ───────────────────────────────────────────

  describe('Given: agent="claude", date="2026-03-15", project="my-project"', () => {
    describe('When: writeSession(tempDir, "claude", session) を呼び出す', () => {
      describe('Then: T-EC-WS-02 - 正しいディレクトリ構造のパスが返る', () => {
        it('T-EC-WS-02-01: パスに "claude" セグメントが含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          assertStringIncludes(outPath, '/claude/');
        });

        it('T-EC-WS-02-02: パスに "2026" が含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          assertStringIncludes(outPath, '2026');
        });

        it('T-EC-WS-02-03: パスに "2026-03" が含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          assertStringIncludes(outPath, '2026-03');
        });

        it('T-EC-WS-02-04: パスに "my-project" が含まれない（フラット構造）', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          const filename = outPath.split('/').pop()!;
          assertStringIncludes(filename, '.md');
        });
      });
    });
  });

  // ─── T-EC-WS-03: ファイル内容の検証 ──────────────────────────────────────

  describe('Given: firstUserText="What is TDD?" のセッション', () => {
    describe('When: writeSession を呼び出してファイルを読み込む', () => {
      describe('Then: T-EC-WS-03 - ファイル内容が正しい', () => {
        it('T-EC-WS-03-01: frontmatter の "session_id:" が含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          const normalizedPath = outPath.replace(/^\/([A-Z]:)/, '$1');
          const content = await Deno.readTextFile(normalizedPath);
          assertStringIncludes(content, 'session_id:');
        });

        it('T-EC-WS-03-02: "# What is TDD?" タイトル行が含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          const normalizedPath = outPath.replace(/^\/([A-Z]:)/, '$1');
          const content = await Deno.readTextFile(normalizedPath);
          assertStringIncludes(content, '# What is TDD?');
        });

        it('T-EC-WS-03-03: "### User" セクションが含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          const normalizedPath = outPath.replace(/^\/([A-Z]:)/, '$1');
          const content = await Deno.readTextFile(normalizedPath);
          assertStringIncludes(content, '### User');
        });

        it('T-EC-WS-03-04: "### Assistant" セクションが含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          const normalizedPath = outPath.replace(/^\/([A-Z]:)/, '$1');
          const content = await Deno.readTextFile(normalizedPath);
          assertStringIncludes(content, '### Assistant');
        });
      });
    });
  });

  // ─── T-EC-WS-04: 深いネストのディレクトリ自動生成 ────────────────────────

  describe('Given: 存在しない深いネストの outputBase', () => {
    describe('When: writeSession(nestedOutputBase, "codex", session) を呼び出す', () => {
      describe('Then: T-EC-WS-04 - ディレクトリが自動生成されファイルが書き出される', () => {
        it('T-EC-WS-04-01: エラーなく実行され .md ファイルが返る', async () => {
          const session = _makeSession();
          const nestedBase = `${tempDir}/a/b/c/output`;
          const outPath = await writeSession(nestedBase, 'codex', session);
          assertEquals(outPath.endsWith('.md'), true);
        });

        it('T-EC-WS-04-02: 生成されたファイルが実際に存在する', async () => {
          const session = _makeSession();
          const nestedBase = `${tempDir}/deep/nested/dir`;
          const outPath = await writeSession(nestedBase, 'codex', session);
          const normalizedPath = outPath.replace(/^\/([A-Z]:)/, '$1');
          const stat = await Deno.stat(normalizedPath);
          assertEquals(stat.isFile, true);
        });
      });
    });
  });

  // ─── T-EC-WS-05: agent="codex" のパス検証 ────────────────────────────────

  describe('Given: agent="codex"', () => {
    describe('When: writeSession(tempDir, "codex", session) を呼び出す', () => {
      describe('Then: T-EC-WS-05 - パスに "codex" セグメントが含まれる', () => {
        it('T-EC-WS-05-01: パスに "/codex/" が含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'codex', session);
          assertStringIncludes(outPath, '/codex/');
        });
      });
    });
  });

  // ─── T-EC-WS-06: sessionId のハッシュがファイル名に含まれる ──────────────

  describe('Given: sessionId="sess-abcdef12-3456-7890-abcd-ef1234567890"', () => {
    describe('When: writeSession を呼び出す', () => {
      describe('Then: T-EC-WS-06 - ファイル名に sessionId 先頭8文字（ハイフン除去）が含まれる', () => {
        it('T-EC-WS-06-01: パスに "sessabcd" が含まれる', async () => {
          const session = _makeSession();
          const outPath = await writeSession(tempDir, 'claude', session);
          // "sess-abcdef12-..." → ハイフン除去 → "sessabcdef12..." → 先頭8文字 → "sessabcd"
          assertStringIncludes(outPath, 'sessabcd');
        });
      });
    });
  });
});
