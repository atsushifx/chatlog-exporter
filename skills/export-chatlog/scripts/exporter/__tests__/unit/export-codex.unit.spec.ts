// src: scripts/exporter/__tests__/unit/export-codex.unit.spec.ts
// @(#): exportCodex オーケストレーション関数のユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import type { ExportConfig } from '../../../types/export-config.types.ts';
import type { ExportedSession } from '../../../types/session.types.ts';
import { exportCodex } from '../../codex-exporter.ts';
import { _makeFlowProviders } from '../_helpers/flow-providers.ts';

// ─── テスト用フィクスチャ ─────────────────────────────────────────────────────

const BASE_CONFIG: ExportConfig = {
  agent: 'codex',
  outputDir: '/tmp/test-output',
  baseDir: undefined,
  period: undefined,
};

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

// ─── exportCodex tests ───────────────────────────────────────────────────────

/**
 * `exportCodex` のユニットテストスイート。
 *
 * Provider パターンで findSessions / parseSession / writeSession を
 * 差し替えることで、実ファイルシステムへの依存なしに動作を検証する。
 *
 * テストケース:
 * - T-EC-XC-01: セッション1件が有効 → exportedCount=1, outputPaths に1件
 * - T-EC-XC-02: parseSession が null → exportedCount=0, outputPaths=[]
 * - T-EC-XC-03: findSessions が0件 → exportedCount=0, outputPaths=[]
 * - T-EC-XC-04: 3件中2件有効 → exportedCount=2, outputPaths.length=2
 *
 * @see exportCodex
 */
describe('exportCodex', () => {
  // ─── T-EC-XC-01: 正常にエクスポートされる ───────────────────────────────────

  describe('Given: セッションファイルが1件あり、parseSession が有効なセッションを返す', () => {
    describe('When: exportCodex(config, providers) を呼び出す', () => {
      const outPath = '/tmp/test-output/codex/2026/2026-03/2026-03-15-test-sess0001.md';

      it('T-EC-XC-01-01: exportedCount が 1', async () => {
        const session = _makeSession('sess-0001', 'my-app');
        const result = await exportCodex(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/session.jsonl', () => Promise.resolve(session), () => Promise.resolve(outPath)],
          ]),
        );
        assertEquals(result.exportedCount, 1);
      });

      it('T-EC-XC-01-02: outputPaths に1件のパスが含まれる', async () => {
        const session = _makeSession('sess-0001', 'my-app');
        const result = await exportCodex(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/session.jsonl', () => Promise.resolve(session), () => Promise.resolve(outPath)],
          ]),
        );
        assertEquals(result.outputPaths.length, 1);
        assertEquals(result.outputPaths[0], outPath);
      });
    });
  });

  // ─── T-EC-XC-02: parseSession が null → スキップ ───────────────────────────

  describe('Given: parseSession が null を返す（スキップ対象セッション）', () => {
    describe('When: exportCodex(config, providers) を呼び出す', () => {
      it('T-EC-XC-02-01: exportedCount が 0', async () => {
        const result = await exportCodex(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/skipped.jsonl', () => Promise.resolve(null), () => Promise.resolve('')],
          ]),
        );
        assertEquals(result.exportedCount, 0);
      });

      it('T-EC-XC-02-02: outputPaths が空配列', async () => {
        const result = await exportCodex(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/skipped.jsonl', () => Promise.resolve(null), () => Promise.resolve('')],
          ]),
        );
        assertEquals(result.outputPaths, []);
      });
    });
  });

  // ─── T-EC-XC-03: セッションファイルが0件 ─────────────────────────────────────

  describe('Given: findSessions がファイルを1件も返さない', () => {
    describe('When: exportCodex(config, providers) を呼び出す', () => {
      it('T-EC-XC-03-01: exportedCount が 0', async () => {
        const result = await exportCodex(BASE_CONFIG, _makeFlowProviders([]));
        assertEquals(result.exportedCount, 0);
      });

      it('T-EC-XC-03-02: outputPaths が空配列', async () => {
        const result = await exportCodex(BASE_CONFIG, _makeFlowProviders([]));
        assertEquals(result.outputPaths, []);
      });
    });
  });

  // ─── T-EC-XC-04: 複数セッションのカウント ────────────────────────────────────

  describe('Given: セッションファイルが3件あり、2件は有効で1件はスキップ', () => {
    describe('When: exportCodex(config, providers) を呼び出す', () => {
      const session = _makeSession('session-0001', 'my-app');

      it('T-EC-XC-04-01: exportedCount が 2', async () => {
        const result = await exportCodex(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/a.jsonl', () => Promise.resolve(session), () => Promise.resolve('/tmp/out.md')],
            ['/fake/b.jsonl', () => Promise.resolve(null), () => Promise.resolve('')],
            ['/fake/c.jsonl', () => Promise.resolve(session), () => Promise.resolve('/tmp/out.md')],
          ]),
        );
        assertEquals(result.exportedCount, 2);
      });

      it('T-EC-XC-04-02: outputPaths の件数が 2', async () => {
        const result = await exportCodex(
          BASE_CONFIG,
          _makeFlowProviders([
            ['/fake/a.jsonl', () => Promise.resolve(session), () => Promise.resolve('/tmp/out.md')],
            ['/fake/b.jsonl', () => Promise.resolve(null), () => Promise.resolve('')],
            ['/fake/c.jsonl', () => Promise.resolve(session), () => Promise.resolve('/tmp/out.md')],
          ]),
        );
        assertEquals(result.outputPaths.length, 2);
      });
    });
  });
});
