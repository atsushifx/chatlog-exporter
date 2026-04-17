// Copyright (c) 2026 atsushifx <http://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
// src: scripts/exporter/__tests__/unit/export-claude.unit.spec.ts
// @(#): exportClaude オーケストレーション関数のユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import type { ExportConfig } from '../../../types/export-config.types.ts';
import type { ExportedSession } from '../../../types/session.types.ts';
import { exportClaude } from '../../claude-exporter.ts';
import { _makeFlowProviders } from '../_helpers/flow-providers.ts';

// ─── テスト用フィクスチャ ─────────────────────────────────────────────────────

const BASE_CONFIG: ExportConfig = {
  agent: 'claude',
  outputDir: '/tmp/test-output',
  baseDir: undefined,
  period: undefined,
};

const DEFAULT_OUT_PATH = '/tmp/test-output/claude/2026/2026-03/2026-03-15-test-session0001.md';

function _makeSession(sessionId: string, project: string): ExportedSession {
  return {
    meta: {
      sessionId,
      date: '2026-03-15',
      project,
      slug: '',
      firstUserText: 'テスト用のメッセージです',
    },
    turns: [
      { role: 'user', text: 'テスト用のメッセージです' },
      { role: 'assistant', text: 'テスト用の応答です。' },
    ],
  };
}

type MockProviderOptions = {
  findSessions?: string[];
  parseSession?: NonNullable<Parameters<typeof exportClaude>[1]>['parseSession'];
  writeSession?: NonNullable<Parameters<typeof exportClaude>[1]>['writeSession'];
};

function _makeMockProviders(
  options?: MockProviderOptions,
): NonNullable<Parameters<typeof exportClaude>[1]> {
  return {
    findSessions: () => Promise.resolve(options?.findSessions ?? []),
    parseSession: options?.parseSession ?? (() => Promise.resolve(null)),
    writeSession: options?.writeSession ?? (() => Promise.resolve(DEFAULT_OUT_PATH)),
  };
}

// ─── exportClaude tests ───────────────────────────────────────────────────────

/**
 * `exportClaude` のユニットテストスイート。
 *
 * Provider パターンで findSessions / parseSession / writeSession を
 * 差し替えることで、実ファイルシステムへの依存なしに動作を検証する。
 *
 * テストケース:
 * - T-EC-CL-01: セッション1件が有効 → exportedCount=1, skippedCount=0, errorCount=0
 * - T-EC-CL-02: parseSession が null → exportedCount=0, skippedCount=1, errorCount=0
 * - T-EC-CL-03: findSessions が0件 → exportedCount=0, skippedCount=0, errorCount=0
 * - T-EC-CL-04: 3件中2件有効・1件スキップ → exportedCount=2, skippedCount=1, errorCount=0
 * - T-EC-CL-05: config.baseDir が存在しない → exportedCount=0
 * - T-EC-CL-06: writeSession が例外 → exportedCount=0, skippedCount=0, errorCount=1
 * - T-EC-CL-07: 3件中1件成功・1件スキップ・1件エラー → 各カウントが正確
 *
 * @see exportClaude
 */
describe('exportClaude', () => {
  // ─── T-EC-CL-01: 正常にエクスポートされる ───────────────────────────────────

  describe('Given: セッションファイルが1件あり、parseSession が有効なセッションを返す', () => {
    describe('When: exportClaude(config, providers) を呼び出す', () => {
      it('T-EC-CL-01: exportedCount=1, skippedCount=0, errorCount=0, outputPaths に1件', async () => {
        const session = _makeSession('session-0001', 'my-app');
        const result = await exportClaude(
          BASE_CONFIG,
          _makeMockProviders({
            findSessions: ['/fake/session.jsonl'],
            parseSession: () => Promise.resolve(session),
          }),
        );
        assertEquals(result.exportedCount, 1);
        assertEquals(result.skippedCount, 0);
        assertEquals(result.errorCount, 0);
        assertEquals(result.outputPaths.length, 1);
        assertEquals(result.outputPaths[0], DEFAULT_OUT_PATH);
      });
    });
  });

  // ─── T-EC-CL-02: parseSession が null → スキップ ───────────────────────────

  describe('Given: parseSession が null を返す（スキップ対象セッション）', () => {
    describe('When: exportClaude(config, providers) を呼び出す', () => {
      it('T-EC-CL-02: exportedCount=0, skippedCount=1, errorCount=0, outputPaths=[]', async () => {
        const result = await exportClaude(
          BASE_CONFIG,
          _makeMockProviders({
            findSessions: ['/fake/skipped.jsonl'],
          }),
        );
        assertEquals(result.exportedCount, 0);
        assertEquals(result.skippedCount, 1);
        assertEquals(result.errorCount, 0);
        assertEquals(result.outputPaths, []);
      });
    });
  });

  // ─── T-EC-CL-03: セッションファイルが0件 ─────────────────────────────────────

  describe('Given: findSessions がファイルを1件も返さない', () => {
    describe('When: exportClaude(config, providers) を呼び出す', () => {
      it('T-EC-CL-03: exportedCount=0, skippedCount=0, errorCount=0, outputPaths=[]', async () => {
        const result = await exportClaude(BASE_CONFIG, _makeMockProviders());
        assertEquals(result.exportedCount, 0);
        assertEquals(result.skippedCount, 0);
        assertEquals(result.errorCount, 0);
        assertEquals(result.outputPaths, []);
      });
    });
  });

  // ─── T-EC-CL-04: 複数セッションのカウント ────────────────────────────────────

  describe('Given: セッションファイルが3件あり、2件は有効で1件はスキップ', () => {
    describe('When: exportClaude(config, providers) を呼び出す', () => {
      it('T-EC-CL-04: exportedCount=2, skippedCount=1, errorCount=0, outputPaths.length=2', async () => {
        const session = _makeSession('session-0001', 'my-app');
        const result = await exportClaude(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/a.jsonl', () => Promise.resolve(session), () => Promise.resolve('/tmp/out.md')],
            ['/fake/b.jsonl', () => Promise.resolve(null), () => Promise.resolve('')],
            ['/fake/c.jsonl', () => Promise.resolve(session), () => Promise.resolve('/tmp/out.md')],
          ]),
        );
        assertEquals(result.exportedCount, 2);
        assertEquals(result.skippedCount, 1);
        assertEquals(result.errorCount, 0);
        assertEquals(result.outputPaths.length, 2);
      });
    });
  });

  // ─── T-EC-CL-05: config.baseDir が findClaudeSessions に渡される ─────────────

  describe('Given: config.baseDir に存在しないディレクトリを指定し、findSessions を省略する', () => {
    describe('When: exportClaude(config) をデフォルト provider で呼び出す', () => {
      it('T-EC-CL-05: baseDir が空ディレクトリなら exportedCount=0, outputPaths=[]', async () => {
        const config = { ...BASE_CONFIG, baseDir: '/nonexistent/custom/projects' };
        const result = await exportClaude(config);
        assertEquals(result.exportedCount, 0);
        assertEquals(result.outputPaths, []);
      });
    });
  });

  // ─── T-EC-CL-06: writeSession が例外 → errorCount=1 ─────────────────────────

  describe('Given: parseSession が有効なセッションを返し writeSession が例外を投げる', () => {
    describe('When: exportClaude(config, providers) を呼び出す', () => {
      it('T-EC-CL-06: exportedCount=0, skippedCount=0, errorCount=1', async () => {
        const session = _makeSession('session-0001', 'my-app');
        const result = await exportClaude(
          BASE_CONFIG,
          _makeMockProviders({
            findSessions: ['/fake/session.jsonl'],
            parseSession: () => Promise.resolve(session),
            writeSession: () => Promise.reject(new Error('write failed')),
          }),
        );
        assertEquals(result.exportedCount, 0);
        assertEquals(result.skippedCount, 0);
        assertEquals(result.errorCount, 1);
      });
    });
  });

  // ─── T-EC-CL-07: 3件中 1成功・1スキップ・1エラー ────────────────────────────

  describe('Given: セッションファイルが3件あり 1件成功・1件スキップ・1件エラー', () => {
    describe('When: exportClaude(config, providers) を呼び出す', () => {
      it('T-EC-CL-07: exportedCount=1, skippedCount=1, errorCount=1', async () => {
        const session = _makeSession('session-0001', 'my-app');
        const result = await exportClaude(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/a.jsonl', () => Promise.resolve(session), () => Promise.resolve('/tmp/out.md')],
            ['/fake/b.jsonl', () => Promise.resolve(null), () => Promise.resolve('')],
            ['/fake/c.jsonl', () => Promise.reject(new Error('parse failed')), () => Promise.resolve('')],
          ]),
        );
        assertEquals(result.exportedCount, 1);
        assertEquals(result.skippedCount, 1);
        assertEquals(result.errorCount, 1);
      });
    });
  });
});
