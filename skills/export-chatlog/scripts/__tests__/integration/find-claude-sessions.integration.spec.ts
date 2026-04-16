// src: scripts/__tests__/integration/find-claude-sessions.integration.spec.ts
// @(#): findClaudeSessions の統合テスト（実ファイルシステム使用）
//       対象: findClaudeSessions
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

import { findClaudeSessions, parsePeriod } from '../../../../export-chatlog/scripts/export-chatlog.ts';
import type { PeriodRange } from '../../../../export-chatlog/scripts/export-chatlog.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

const ALL_PERIOD: PeriodRange = parsePeriod(undefined);

// ─── findClaudeSessions ───────────────────────────────────────────────────────

/**
 * `findClaudeSessions` の統合テストスイート（実ファイルシステム使用）。
 *
 * `Deno.env.get` をスタブして `homeDir()` を一時ディレクトリに向け、
 * 実際のディレクトリ構造を作成して動作を検証する。以下のケースをカバーする:
 * - ~/.claude/projects/ 配下の複数プロジェクトディレクトリの走査
 * - subagents/ サブディレクトリ内ファイルの除外
 * - projects ディレクトリが存在しない場合の空配列返却（エラーなし）
 * - 結果の辞書順ソート
 *
 * 各テストは `Deno.makeTempDir()` で独立した home 環境を使用し、
 * `afterEach` で `envStub.restore()` とディレクトリ削除を行う。
 *
 * @see findClaudeSessions
 * @see walkFiles
 * @see homeDir
 */
describe('findClaudeSessions', () => {
  let tempDir: string;
  let envStub: Stub<typeof Deno.env, [key: string], string | undefined>;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
    // homeDir() を tempDir に向ける
    envStub = stub(Deno.env, 'get', (key: string) => {
      if (key === 'USERPROFILE' || key === 'HOME') { return tempDir; }
      return undefined;
    });
  });

  afterEach(async () => {
    envStub.restore();
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-EC-FS-01: projectsDir 走査 ─────────────────────────────────────────

  describe('Given: ~/.claude/projects/ に2つのプロジェクトディレクトリと .jsonl ファイルがある', () => {
    describe('When: findClaudeSessions(allPeriod) を呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects`;
        await Deno.mkdir(`${projectsDir}/proj-a`, { recursive: true });
        await Deno.mkdir(`${projectsDir}/proj-b`, { recursive: true });
        await Deno.writeTextFile(`${projectsDir}/proj-a/session1.jsonl`, '{}');
        await Deno.writeTextFile(`${projectsDir}/proj-a/session2.jsonl`, '{}');
        await Deno.writeTextFile(`${projectsDir}/proj-b/session3.jsonl`, '{}');
      });

      describe('Then: T-EC-FS-01 - 全プロジェクトの .jsonl ファイルを収集する', () => {
        it('T-EC-FS-01-01: 収集ファイル数が 3', async () => {
          const results = await findClaudeSessions(ALL_PERIOD);
          assertEquals(results.length, 3);
        });

        it('T-EC-FS-01-02: 全パスが .jsonl で終わる', async () => {
          const results = await findClaudeSessions(ALL_PERIOD);
          assertEquals(results.every((f: string) => f.endsWith('.jsonl')), true);
        });
      });
    });
  });

  // ─── T-EC-FS-02: subagents/ ディレクトリの除外 ────────────────────────────

  describe('Given: プロジェクト内に subagents/ サブディレクトリがある', () => {
    describe('When: findClaudeSessions(allPeriod) を呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects`;
        await Deno.mkdir(`${projectsDir}/proj-a/subagents`, { recursive: true });
        await Deno.writeTextFile(`${projectsDir}/proj-a/main.jsonl`, '{}');
        await Deno.writeTextFile(`${projectsDir}/proj-a/subagents/sub.jsonl`, '{}');
      });

      describe('Then: T-EC-FS-02 - subagents/ 内ファイルは除外される', () => {
        it('T-EC-FS-02-01: 収集ファイル数が 1（subagents 除外）', async () => {
          const results = await findClaudeSessions(ALL_PERIOD);
          assertEquals(results.length, 1);
        });

        it('T-EC-FS-02-02: 収集パスに "subagents" が含まれない', async () => {
          const results = await findClaudeSessions(ALL_PERIOD);
          assertEquals(results.every((f: string) => !f.includes('subagents')), true);
        });
      });
    });
  });

  // ─── T-EC-FS-04: projectsDir が存在しない → 空配列 ───────────────────────

  describe('Given: ~/.claude/projects/ が存在しない', () => {
    describe('When: findClaudeSessions(allPeriod) を呼び出す', () => {
      describe('Then: T-EC-FS-04 - 空配列を返す（エラーなし）', () => {
        it('T-EC-FS-04-01: 空配列が返される', async () => {
          // tempDir に .claude/projects/ を作らない
          const results = await findClaudeSessions(ALL_PERIOD);
          assertEquals(results.length, 0);
        });
      });
    });
  });

  // ─── T-EC-FS-05: 結果がソートされている ──────────────────────────────────

  describe('Given: 複数のファイルが存在する', () => {
    describe('When: findClaudeSessions(allPeriod) を呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects`;
        await Deno.mkdir(`${projectsDir}/proj-z`, { recursive: true });
        await Deno.mkdir(`${projectsDir}/proj-a`, { recursive: true });
        await Deno.writeTextFile(`${projectsDir}/proj-z/session.jsonl`, '{}');
        await Deno.writeTextFile(`${projectsDir}/proj-a/session.jsonl`, '{}');
      });

      describe('Then: T-EC-FS-05 - 結果がソートされている', () => {
        it('T-EC-FS-05-01: 返却パスが辞書順', async () => {
          const results = await findClaudeSessions(ALL_PERIOD);
          const sorted = [...results].sort();
          assertEquals(results, sorted);
        });
      });
    });
  });

  // ─── T-EC-FS-06: projectDir 引数で任意ディレクトリを指定 ─────────────────

  describe('Given: projectDir 引数に任意のディレクトリを指定する', () => {
    let customProjectsDir: string;

    beforeEach(async () => {
      customProjectsDir = await Deno.makeTempDir();
      await Deno.mkdir(`${customProjectsDir}/proj-x`, { recursive: true });
      await Deno.writeTextFile(`${customProjectsDir}/proj-x/session.jsonl`, '{}');
    });

    afterEach(async () => {
      await Deno.remove(customProjectsDir, { recursive: true });
    });

    describe('When: findClaudeSessions(allPeriod, customProjectsDir) を呼び出す', () => {
      describe('Then: T-EC-FS-06 - 指定ディレクトリを参照してファイルを収集する', () => {
        it('T-EC-FS-06-01: 収集ファイル数が 1', async () => {
          const results = await findClaudeSessions(ALL_PERIOD, customProjectsDir);
          assertEquals(results.length, 1);
        });

        it('T-EC-FS-06-02: デフォルトの ~/.claude/projects は参照しない', async () => {
          const results = await findClaudeSessions(ALL_PERIOD, customProjectsDir);
          assertEquals(results.every((f: string) => f.includes(customProjectsDir)), true);
        });
      });
    });
  });
});
