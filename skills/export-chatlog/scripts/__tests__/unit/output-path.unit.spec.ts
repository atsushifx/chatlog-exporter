// src: scripts/__tests__/unit/output-path.unit.spec.ts
// @(#): 出力パス生成関数のユニットテスト
//       対象: buildOutputPath
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertStringIncludes } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { buildOutputPath } from '../../../../export-chatlog/scripts/export-chatlog.ts';
import type { SessionMeta } from '../../../../export-chatlog/scripts/export-chatlog.ts';

function _makeMeta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 'abc-def-12345678',
    date: '2026-03-15',
    project: 'my-project',
    slug: 'test-slug',
    firstUserText: 'test',
    ...overrides,
  };
}

/**
 * `buildOutputPath` のユニットテストスイート。
 *
 * セッションの Markdown ファイル出力パスを生成する関数の動作を検証する。
 * パス構造（agent/YYYY/YYYY-MM/）・slug の包含・sessionId ハッシュ（先頭 8 文字）・
 * 異なる agent 名の各ケースをカバーする。
 *
 * @see buildOutputPath
 */
describe('buildOutputPath', () => {
  describe('Given: outputBase="/out", agent="claude", 基本的な meta', () => {
    describe('When: buildOutputPath(...) を呼び出す', () => {
      describe('Then: T-EC-OP-01 - 正しいパス構造を生成する', () => {
        it('T-EC-OP-01-01: パスが "出力ベース/claude/YYYY/YYYY-MM/ファイル名.md" 形式', () => {
          const meta = _makeMeta();
          const result = buildOutputPath('/out', 'claude', meta, 'test-slug');
          assertStringIncludes(result, '/out/claude/2026/2026-03/');
          assertStringIncludes(result, '.md');
        });

        it('T-EC-OP-01-02: ファイル名に slug が含まれる', () => {
          const meta = _makeMeta();
          const result = buildOutputPath('/out', 'claude', meta, 'test-slug');
          assertStringIncludes(result, 'test-slug');
        });

        it('T-EC-OP-01-03: sessionId のハイフンを除去した先頭8文字が含まれる', () => {
          const meta = _makeMeta({ sessionId: 'abc-def-12345678' });
          const result = buildOutputPath('/out', 'claude', meta, 'test-slug');
          // abcdef12 (ハイフン除去 → 'abcdef12345678' の先頭8文字)
          assertStringIncludes(result, 'abcdef12');
        });
      });
    });
  });

  describe('Given: agent="codex"', () => {
    it('T-EC-OP-01-04: パスに "codex" セグメントが含まれる', () => {
      const meta = _makeMeta();
      const result = buildOutputPath('/out', 'codex', meta, 'test');
      assertStringIncludes(result, '/codex/');
    });
  });

  describe('Given: date="2026-03-15"', () => {
    it('T-EC-OP-01-05: YYYY="2026", YYYY-MM="2026-03" が正しく埋め込まれる', () => {
      const meta = _makeMeta({ date: '2026-03-15' });
      const result = buildOutputPath('/out', 'claude', meta, 'test');
      assertStringIncludes(result, '2026/2026-03/');
    });
  });
});
