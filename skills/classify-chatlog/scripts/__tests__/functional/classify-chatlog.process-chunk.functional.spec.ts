// src: scripts/__tests__/functional/classify-chatlog.processChunk.functional.spec.ts
// @(#): processChunk の機能テスト
//       runClaude + classifyFile の連携フロー（Deno.Command モック・dryRun=true）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { processChunk } from '../../classify-chatlog.ts';
// constants
import { DEFAULT_AI_MODEL } from '../../../../_scripts/constants/defaults.constants.ts';
import { FALLBACK_PROJECT } from '../../constants/classify.constants.ts';
// types
import type { ClassifyFileMeta, ClassifyStats, ProjectDicEntry } from '../../types/classify.types.ts';

// helpers
import {
  installCommandMock,
  makeFailMock,
  makeSuccessMock,
} from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import type { CommandMockHandle } from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import { makeLoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';
import type { LoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';

// ─── テスト用ヘルパー ──────────────────────────────────────────────────────────

function _makeClassifyFileMeta(filename: string, overrides: Partial<ClassifyFileMeta> = {}): ClassifyFileMeta {
  return {
    filePath: `/tmp/input/${filename}`,
    filename,
    existingProject: '',
    title: 'Test Title',
    category: 'development',
    topics: ['API'],
    tags: ['typescript'],
    fullText: `---\ntitle: Test Title\ncategory: development\n---\n本文`,
    ...overrides,
  };
}

function _makeStats(): ClassifyStats {
  return { moved: 0, skipped: 0, error: 0 };
}

// ─── T-CL-PC-01: 正常分類 → stats.moved インクリメント ───────────────────────

describe('processChunk', () => {
  describe('Given: 有効な分類結果を返す Deno.Command モック', () => {
    describe('When: processChunk([fileMeta], projects, true, stats) を呼び出す', () => {
      describe('Then: T-CL-PC-01 - 正常分類 → stats.moved インクリメント', () => {
        let mockHandle: CommandMockHandle;
        let loggerStub: LoggerStub;
        let model: string;

        beforeEach(() => {
          model = DEFAULT_AI_MODEL;
          loggerStub = makeLoggerStub();
          const response = JSON.stringify([
            { file: 'a.md', project: 'app1', confidence: 0.9, reason: 'matched' },
          ]);
          mockHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
        });

        afterEach(() => {
          mockHandle.restore();
          loggerStub.restore();
        });

        it('T-CL-PC-01-01: stats.moved が 1 になる', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, app2: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(stats.moved, 1);
        });

        it('T-CL-PC-01-02: stats.error が 0 のまま', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, app2: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(stats.error, 0);
        });

        it('T-CL-PC-01-03: classify ログが infoLogs に記録される', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, app2: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(
            loggerStub.infoLogs.some((l) => l.includes('classify:')),
            true,
            'classify ログが infoLogs に記録されていない',
          );
        });

        it('T-CL-PC-01-04: [dry-run] ログが infoLogs に記録される', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, app2: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(
            loggerStub.infoLogs.some((l) => l.includes('[dry-run]')),
            true,
            '[dry-run] ログが infoLogs に記録されていない',
          );
        });
      });
    });
  });

  // ─── T-CL-PC-02: Claude CLI エラー → FALLBACK_PROJECT で全件処理 ───────────

  describe('Given: Claude CLI が失敗する Deno.Command モック', () => {
    describe('When: processChunk([fileMeta1, fileMeta2], projects, true, stats) を呼び出す', () => {
      describe(`Then: T-CL-PC-02 - CLI エラー → ${FALLBACK_PROJECT} で全件処理`, () => {
        let mockHandle: CommandMockHandle;
        let loggerStub: LoggerStub;
        let model: string;

        beforeEach(() => {
          model = DEFAULT_AI_MODEL;
          loggerStub = makeLoggerStub();
          mockHandle = installCommandMock(makeFailMock(1));
        });

        afterEach(() => {
          mockHandle.restore();
          loggerStub.restore();
        });

        it('T-CL-PC-02-01: stats.moved が ファイル数（2）になる', async () => {
          const metas = [_makeClassifyFileMeta('a.md'), _makeClassifyFileMeta('b.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(stats.moved, 2);
        });

        it('T-CL-PC-02-02: stats.error が 0 のまま（fallback 処理成功）', async () => {
          const metas = [_makeClassifyFileMeta('a.md'), _makeClassifyFileMeta('b.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(stats.error, 0);
        });

        it('T-CL-PC-02-03: warn ログが warnLogs に記録される', async () => {
          const metas = [_makeClassifyFileMeta('a.md'), _makeClassifyFileMeta('b.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(
            loggerStub.warnLogs.some((l) => l.includes('claude CLI 実行失敗')),
            true,
            '警告ログが warnLogs に記録されていない',
          );
        });
      });
    });
  });

  // ─── T-CL-PC-03: JSON パース失敗 → FALLBACK_PROJECT で全件処理 ──────────────

  describe('Given: JSON でないテキストを返す Deno.Command モック', () => {
    describe('When: processChunk([fileMeta], projects, true, stats) を呼び出す', () => {
      describe(`Then: T-CL-PC-03 - JSON パース失敗 → ${FALLBACK_PROJECT} で全件処理`, () => {
        let mockHandle: CommandMockHandle;
        let loggerStub: LoggerStub;
        let model: string;

        beforeEach(() => {
          model = DEFAULT_AI_MODEL;
          loggerStub = makeLoggerStub();
          mockHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode('これはJSONではありません')),
          );
        });

        afterEach(() => {
          mockHandle.restore();
          loggerStub.restore();
        });

        it('T-CL-PC-03-01: stats.moved が 1 になる', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(stats.moved, 1);
        });

        it('T-CL-PC-03-02: stats.error が 0 のまま', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(stats.error, 0);
        });

        it('T-CL-PC-03-03: warn ログが warnLogs に記録される', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(
            loggerStub.warnLogs.some((l) => l.includes('JSON パース失敗')),
            true,
            '警告ログが warnLogs に記録されていない',
          );
        });
      });
    });
  });

  // ─── T-CL-PC-04: 分類結果にファイル名なし → FALLBACK_PROJECT 使用 ───────────

  describe('Given: ファイル名が一致しない分類結果を返す Deno.Command モック', () => {
    describe('When: processChunk([fileMeta], projects, true, stats) を呼び出す', () => {
      describe(`Then: T-CL-PC-04 - ファイル名不一致 → ${FALLBACK_PROJECT} で処理`, () => {
        let mockHandle: CommandMockHandle;
        let loggerStub: LoggerStub;
        let model: string;

        beforeEach(() => {
          model = DEFAULT_AI_MODEL;
          loggerStub = makeLoggerStub();
          // "b.md" の結果を返すが、対象ファイルは "a.md"
          const response = JSON.stringify([
            { file: 'b.md', project: 'app1', confidence: 0.9, reason: 'matched' },
          ]);
          mockHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
        });

        afterEach(() => {
          mockHandle.restore();
          loggerStub.restore();
        });

        it('T-CL-PC-04-01: stats.moved が 1 になる（FALLBACK_PROJECT で移動）', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(stats.moved, 1);
        });

        it('T-CL-PC-04-02: [dry-run] ログが infoLogs に記録される', async () => {
          const metas = [_makeClassifyFileMeta('a.md')];
          const stats = _makeStats();
          const projects: ProjectDicEntry = { app1: {}, misc: {} };

          await processChunk(metas, projects, true, stats, model);

          assertEquals(
            loggerStub.infoLogs.some((l) => l.includes('[dry-run]')),
            true,
            '[dry-run] ログが infoLogs に記録されていない',
          );
        });
      });
    });
  });
});
