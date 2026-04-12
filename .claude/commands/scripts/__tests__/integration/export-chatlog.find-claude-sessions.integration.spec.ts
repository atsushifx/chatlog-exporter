// src: scripts/__tests__/integration/export-chatlog.find-claude-sessions.integration.spec.ts
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

<<<<<<< HEAD:.claude/commands/scripts/__tests__/integration/export-chatlog.find-claude-sessions.integration.spec.ts
import { findClaudeSessions, parsePeriod } from '../../../../export-chatlog/scripts/export-chatlog.ts';
import type { PeriodRange } from '../../../../export-chatlog/scripts/export-chatlog.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

const ALL_PERIOD: PeriodRange = parsePeriod(undefined);

// ─── findClaudeSessions ───────────────────────────────────────────────────────

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

  // ─── T-EC-FS-03: projectFilter によるディレクトリ絞り込み ──────────────────

  describe('Given: "my-app" と "other-project" のディレクトリがある', () => {
    describe('When: projectFilter="my-app" で呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects`;
        // プロジェクトディレクトリ名の末尾がプロジェクト名に対応（ハイフン区切り）
        await Deno.mkdir(`${projectsDir}/C--users-home-projects-my-app`, { recursive: true });
        await Deno.mkdir(`${projectsDir}/C--users-home-projects-other-project`, { recursive: true });
        await Deno.writeTextFile(
          `${projectsDir}/C--users-home-projects-my-app/session.jsonl`,
          '{}',
        );
        await Deno.writeTextFile(
          `${projectsDir}/C--users-home-projects-other-project/session.jsonl`,
          '{}',
        );
      });

      describe('Then: T-EC-FS-03 - "my-app" に関連するディレクトリのみ走査する', () => {
        it('T-EC-FS-03-01: 収集ファイル数が 1', async () => {
          const results = await findClaudeSessions(ALL_PERIOD, 'my-app');
          assertEquals(results.length, 1);
        });

        it('T-EC-FS-03-02: 収集パスに "my-app" が含まれる', async () => {
          const results = await findClaudeSessions(ALL_PERIOD, 'my-app');
          assertEquals(results.every((f: string) => f.includes('my-app')), true);
||||||| parent of 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):.claude/commands/scripts/__tests__/integration/export-chatlog.find-claude-sessions.integration.spec.ts
=======
import { findClaudeSessions, parsePeriod } from '../../export-chatlog.ts';
import type { PeriodRange } from '../../export-chatlog.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

const ALL_PERIOD: PeriodRange = parsePeriod(undefined);

// ─── findClaudeSessions ───────────────────────────────────────────────────────

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
          assertEquals(results.every((f) => f.endsWith('.jsonl')), true);
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
          assertEquals(results.every((f) => !f.includes('subagents')), true);
        });
      });
    });
  });

  // ─── T-EC-FS-03: projectFilter によるディレクトリ絞り込み ──────────────────

  describe('Given: "my-app" と "other-project" のディレクトリがある', () => {
    describe('When: projectFilter="my-app" で呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects`;
        // プロジェクトディレクトリ名の末尾がプロジェクト名に対応（ハイフン区切り）
        await Deno.mkdir(`${projectsDir}/C--users-home-projects-my-app`, { recursive: true });
        await Deno.mkdir(`${projectsDir}/C--users-home-projects-other-project`, { recursive: true });
        await Deno.writeTextFile(
          `${projectsDir}/C--users-home-projects-my-app/session.jsonl`,
          '{}',
        );
        await Deno.writeTextFile(
          `${projectsDir}/C--users-home-projects-other-project/session.jsonl`,
          '{}',
        );
      });

      describe('Then: T-EC-FS-03 - "my-app" に関連するディレクトリのみ走査する', () => {
        it('T-EC-FS-03-01: 収集ファイル数が 1', async () => {
          const results = await findClaudeSessions(ALL_PERIOD, 'my-app');
          assertEquals(results.length, 1);
        });

        it('T-EC-FS-03-02: 収集パスに "my-app" が含まれる', async () => {
          const results = await findClaudeSessions(ALL_PERIOD, 'my-app');
          assertEquals(results.every((f) => f.includes('my-app')), true);
>>>>>>> 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):skills/normalize-chatlog/scripts/__tests__/integration/export-chatlog.find-claude-sessions.integration.spec.ts
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
});
