// src: scripts/exporter/__tests__/integration/find-chatgpt-files.integration.spec.ts
// @(#): findChatGPTFiles の統合テスト（実ファイルシステム使用）
//       対象: findChatGPTFiles
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

import { findChatGPTFiles } from '../../../export-chatlog.ts';

// ─── findChatGPTFiles ─────────────────────────────────────────────────────────

/**
 * `findChatGPTFiles` の統合テストスイート（実ファイルシステム使用）。
 *
 * 一時ディレクトリに conversations-*.json ファイルを作成し、
 * 実際のディレクトリ走査動作を検証する。以下のケースをカバーする:
 * - conversations-*.json ファイルのみ収集
 * - 全パスが .json で終わる
 * - ディレクトリが存在しない → 空配列（エラーなし）
 * - conversations-*.json 以外のファイルは除外
 * - 複数ファイル → 辞書順ソート
 *
 * 各テストは `Deno.makeTempDir()` で独立した作業ディレクトリを使用し、
 * `afterEach` で自動クリーンアップする。
 *
 * @see findChatGPTFiles
 */
describe('findChatGPTFiles', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-EC-GF-01: conversations-*.json ファイルを収集 ──────────────────────

  describe('Given: conversations-000.json と conversations-001.json が存在する', () => {
    beforeEach(async () => {
      await Deno.writeTextFile(`${tempDir}/conversations-000.json`, '[]');
      await Deno.writeTextFile(`${tempDir}/conversations-001.json`, '[]');
    });

    describe('When: findChatGPTFiles(tempDir) を呼び出す', () => {
      it('T-EC-GF-01-01: 2件のパスを返す', async () => {
        const result = await findChatGPTFiles(tempDir);
        assertEquals(result.length, 2);
      });

      it('T-EC-GF-01-02: 全パスが .json で終わる', async () => {
        const result = await findChatGPTFiles(tempDir);
        assertEquals(result.every((f) => f.endsWith('.json')), true);
      });
    });
  });

  // ─── T-EC-GF-02: ディレクトリが存在しない → 空配列 ───────────────────────

  describe('Given: ディレクトリが存在しない', () => {
    describe('When: findChatGPTFiles(nonExistentDir) を呼び出す', () => {
      it('T-EC-GF-02-01: 空配列を返す（エラーなし）', async () => {
        const result = await findChatGPTFiles(`${tempDir}/non-existent`);
        assertEquals(result.length, 0);
      });
    });
  });

  // ─── T-EC-GF-03: conversations-*.json 以外のファイルは除外 ───────────────

  describe('Given: conversations-*.json 以外のファイルが含まれる', () => {
    beforeEach(async () => {
      await Deno.writeTextFile(`${tempDir}/conversations-000.json`, '[]');
      await Deno.writeTextFile(`${tempDir}/export_manifest.json`, '{}');
      await Deno.writeTextFile(`${tempDir}/user.json`, '{}');
    });

    describe('When: findChatGPTFiles(tempDir) を呼び出す', () => {
      it('T-EC-GF-03-01: conversations-*.json 以外のファイルを除外した結果を返す', async () => {
        const result = await findChatGPTFiles(tempDir);
        assertEquals(result.length, 1);
        assertEquals(result[0].endsWith('conversations-000.json'), true);
      });
    });
  });

  // ─── T-EC-GF-04: 複数ファイル → 辞書順ソート ─────────────────────────────

  describe('Given: 複数の conversations-*.json ファイルが存在する', () => {
    beforeEach(async () => {
      // ランダムな順序でファイルを作成
      await Deno.writeTextFile(`${tempDir}/conversations-002.json`, '[]');
      await Deno.writeTextFile(`${tempDir}/conversations-000.json`, '[]');
      await Deno.writeTextFile(`${tempDir}/conversations-001.json`, '[]');
    });

    describe('When: findChatGPTFiles(tempDir) を呼び出す', () => {
      it('T-EC-GF-04-01: 辞書順ソートされた結果を返す', async () => {
        const result = await findChatGPTFiles(tempDir);
        const sorted = [...result].sort();
        assertEquals(result, sorted);
      });
    });
  });
});
