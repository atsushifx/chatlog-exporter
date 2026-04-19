// src: scripts/exporter/__tests__/functional/export-claude.functional.spec.ts
// @(#): exportClaude の機能テスト（実ファイルシステム使用）
//       projectDir + outputDir を指定して fixture JSONL から Markdown を出力することを確認する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals, assertStringIncludes } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

import { normalizePath } from '../../../../../_scripts/libs/utils.ts';
import type { ExportConfig } from '../../../types/export-config.types.ts';
import { exportClaude } from '../../claude-exporter.ts';

// ─── fixture パス ─────────────────────────────────────────────────────────────

const _FIXTURES_DIR = new URL('../fixtures-data/claude-sessions', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1');

// ─── exportClaude functional tests ───────────────────────────────────────────

/**
 * `exportClaude` の機能テストスイート（実ファイルシステム使用）。
 *
 * テスト用チャット履歴 (fixture JSONL) を `projectDir` に配置し、
 * `outputDir` に `<agent>/<yyyy>/<yyyy-mm>/` 形式で Markdown が書き出されることを検証する。
 *
 * テストケース:
 * - T-EC-CL-F-01: normal-01-basic fixture → exportedCount=1, skippedCount=0, errorCount=0
 * - T-EC-CL-F-02: 出力パスが agent/yyyy/yyyy-mm/ 形式かつファイルが存在する
 * - T-EC-CL-F-03: 出力 Markdown の内容（frontmatter・タイトル・ターン）
 * - T-EC-CL-F-04: edge-01-all-skipped fixture → exportedCount=0, skippedCount=1, errorCount=0
 * - T-EC-CL-F-05: 複数 fixture (normal-01 + normal-02) → exportedCount=2, skippedCount=0, errorCount=0
 *
 * @see exportClaude
 * @see findClaudeSessions
 * @see writeSession
 */
describe('exportClaude (functional)', () => {
  let projectsDir: string;
  let outputDir: string;

  beforeEach(async () => {
    projectsDir = await Deno.makeTempDir();
    outputDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(projectsDir, { recursive: true });
    await Deno.remove(outputDir, { recursive: true });
  });

  // ─── T-EC-CL-F-01: normal-01-basic fixture → 1件出力 ─────────────────────

  describe('Given: normal-01-basic fixture JSONL が projectDir に配置されている', () => {
    beforeEach(async () => {
      const projDir = `${projectsDir}/my-app`;
      await Deno.mkdir(projDir, { recursive: true });
      await Deno.copyFile(`${_FIXTURES_DIR}/normal-01-basic/input.jsonl`, `${projDir}/session-01.jsonl`);
    });

    const config = (): ExportConfig => ({
      agent: 'claude',
      outputDir,
      baseDir: projectsDir,
      period: undefined,
    });

    describe('When: exportClaude(config) を呼び出す', () => {
      it('T-EC-CL-F-01: exportedCount=1, skippedCount=0, errorCount=0, .md が1件出力される', async () => {
        const result = await exportClaude(config());
        assertEquals(result.exportedCount, 1);
        assertEquals(result.skippedCount, 0);
        assertEquals(result.errorCount, 0);
        assertEquals(result.outputPaths.length, 1);
        assertEquals(result.outputPaths[0].endsWith('.md'), true);
      });
    });
  });

  // ─── T-EC-CL-F-02: 出力パスの形式検証 ───────────────────────────────────

  describe('Given: normal-01-basic fixture (date=2026-03-15)', () => {
    beforeEach(async () => {
      const projDir = `${projectsDir}/my-app`;
      await Deno.mkdir(projDir, { recursive: true });
      await Deno.copyFile(`${_FIXTURES_DIR}/normal-01-basic/input.jsonl`, `${projDir}/session-01.jsonl`);
    });

    const config = (): ExportConfig => ({
      agent: 'claude',
      outputDir,
      baseDir: projectsDir,
      period: undefined,
    });

    describe('When: exportClaude(config) を呼び出す', () => {
      it('T-EC-CL-F-02: パスが claude/2026/2026-03/ 形式でファイルが存在する', async () => {
        const result = await exportClaude(config());
        const normalizedPath = normalizePath(result.outputPaths[0]).replace(/^\/([A-Z]:)/, '$1');
        assertStringIncludes(normalizedPath, '/claude/');
        assertStringIncludes(normalizedPath, '/2026/');
        assertStringIncludes(normalizedPath, '/2026-03/');
        const stat = await Deno.stat(normalizedPath);
        assertEquals(stat.isFile, true);
      });
    });
  });

  // ─── T-EC-CL-F-03: 出力 Markdown の内容検証 ─────────────────────────────

  describe('Given: normal-01-basic fixture (firstUserText="テスト駆動開発について説明してください")', () => {
    beforeEach(async () => {
      const projDir = `${projectsDir}/my-app`;
      await Deno.mkdir(projDir, { recursive: true });
      await Deno.copyFile(`${_FIXTURES_DIR}/normal-01-basic/input.jsonl`, `${projDir}/session-01.jsonl`);
    });

    const config = (): ExportConfig => ({
      agent: 'claude',
      outputDir,
      baseDir: projectsDir,
      period: undefined,
    });

    describe('When: exportClaude(config) を呼び出して出力ファイルを読む', () => {
      it('T-EC-CL-F-03: Markdown に session_id・タイトル・User・Assistant が含まれる', async () => {
        const result = await exportClaude(config());
        const normalizedPath = result.outputPaths[0].replace(/^\/([A-Z]:)/, '$1');
        const content = await Deno.readTextFile(normalizedPath);
        assertStringIncludes(content, 'session_id:');
        assertStringIncludes(content, 'テスト駆動開発について説明してください');
        assertStringIncludes(content, '### User');
        assertStringIncludes(content, '### Assistant');
      });
    });
  });

  // ─── T-EC-CL-F-04: edge fixture → exportedCount が 0 ─────────────────────

  describe('Given: edge-01-all-skipped fixture (スキップ対象のみ)', () => {
    beforeEach(async () => {
      const projDir = `${projectsDir}/skip-project`;
      await Deno.mkdir(projDir, { recursive: true });
      await Deno.copyFile(`${_FIXTURES_DIR}/edge-01-all-skipped/input.jsonl`, `${projDir}/session-edge.jsonl`);
    });

    const config = (): ExportConfig => ({
      agent: 'claude',
      outputDir,
      baseDir: projectsDir,
      period: undefined,
    });

    describe('When: exportClaude(config) を呼び出す', () => {
      it('T-EC-CL-F-04: exportedCount=0, skippedCount=1, errorCount=0', async () => {
        const result = await exportClaude(config());
        assertEquals(result.exportedCount, 0);
        assertEquals(result.skippedCount, 1);
        assertEquals(result.errorCount, 0);
      });
    });
  });

  // ─── T-EC-CL-F-05: 複数 fixture → exportedCount が 2 ────────────────────

  describe('Given: normal-01-basic と normal-02-multipart が projectDir に配置されている', () => {
    beforeEach(async () => {
      const proj1 = `${projectsDir}/my-app`;
      const proj2 = `${projectsDir}/chatlog-exporter`;
      await Deno.mkdir(proj1, { recursive: true });
      await Deno.mkdir(proj2, { recursive: true });
      await Deno.copyFile(`${_FIXTURES_DIR}/normal-01-basic/input.jsonl`, `${proj1}/session-01.jsonl`);
      await Deno.copyFile(`${_FIXTURES_DIR}/normal-02-multipart/input.jsonl`, `${proj2}/session-02.jsonl`);
    });

    const config = (): ExportConfig => ({
      agent: 'claude',
      outputDir,
      baseDir: projectsDir,
      period: undefined,
    });

    describe('When: exportClaude(config) を呼び出す', () => {
      it('T-EC-CL-F-05: exportedCount=2, skippedCount=0, errorCount=0, 全出力が .md', async () => {
        const result = await exportClaude(config());
        assertEquals(result.exportedCount, 2);
        assertEquals(result.skippedCount, 0);
        assertEquals(result.errorCount, 0);
        assertEquals(result.outputPaths.length, 2);
        assertEquals(result.outputPaths.every((p) => p.endsWith('.md')), true);
      });
    });
  });
});
