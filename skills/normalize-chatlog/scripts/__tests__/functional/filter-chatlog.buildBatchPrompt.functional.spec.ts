// src: scripts/__tests__/functional/filter-chatlog.buildBatchPrompt.functional.spec.ts
// @(#): buildBatchPrompt の機能テスト
//       実ファイルを使用したバッチプロンプト構築の検証
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertStringIncludes } from '@std/assert';
import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { buildBatchPrompt } from '../../filter-chatlog.ts';

// ─── 共通セットアップ ──────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await Deno.makeTempDir();
});

afterEach(async () => {
  await Deno.remove(tempDir, { recursive: true });
});

// ─── T-FL-BP-01: 複数ファイル → === FILE N: filename === 形式 ──────────────────

describe('buildBatchPrompt', () => {
  describe('Given: 2 つのファイル', () => {
    describe('When: buildBatchPrompt([file1, file2]) を呼び出す', () => {
      describe('Then: T-FL-BP-01 - === FILE N: filename === 形式で結合される', () => {
        it('T-FL-BP-01-01: "=== FILE 1:" を含む', async () => {
          const file1 = `${tempDir}/chat-a.md`;
          await Deno.writeTextFile(
            file1,
            '---\ntitle: テスト\n---\n### User\n質問\n\n### Assistant\n回答\n',
          );

          const result = await buildBatchPrompt([file1]);

          assertStringIncludes(result, '=== FILE 1:');
        });

        it('T-FL-BP-01-02: ファイル名が含まれる', async () => {
          const file1 = `${tempDir}/my-chatlog.md`;
          await Deno.writeTextFile(
            file1,
            '---\ntitle: テスト\n---\n### User\n質問\n\n### Assistant\n回答\n',
          );

          const result = await buildBatchPrompt([file1]);

          assertStringIncludes(result, 'my-chatlog.md');
        });

        it('T-FL-BP-01-03: 2 ファイルで "=== FILE 2:" も含まれる', async () => {
          const file1 = `${tempDir}/chat-a.md`;
          const file2 = `${tempDir}/chat-b.md`;
          await Deno.writeTextFile(
            file1,
            '---\ntitle: A\n---\n### User\n質問A\n\n### Assistant\n回答A\n',
          );
          await Deno.writeTextFile(
            file2,
            '---\ntitle: B\n---\n### User\n質問B\n\n### Assistant\n回答B\n',
          );

          const result = await buildBatchPrompt([file1, file2]);

          assertStringIncludes(result, '=== FILE 1:');
          assertStringIncludes(result, '=== FILE 2:');
        });
      });
    });
  });

  // ─── T-FL-BP-02: 本文が maxChars を超える → 切り詰め ─────────────────────────

  describe('Given: MAX_BODY_CHARS を超える長大な本文のファイル', () => {
    describe('When: buildBatchPrompt([file]) を呼び出す', () => {
      describe('Then: T-FL-BP-02 - 本文が切り詰められる', () => {
        it('T-FL-BP-02-01: 結果の長さが無制限に増大しない', async () => {
          const longText = 'x'.repeat(20000);
          const file = `${tempDir}/long.md`;
          await Deno.writeTextFile(
            file,
            `---\ntitle: Long\n---\n### User\n${longText}\n\n### Assistant\n回答\n`,
          );

          const result = await buildBatchPrompt([file]);

          // MAX_BODY_CHARS=8000 + ヘッダー分で合理的な範囲内に収まる
          assertEquals(result.length < 10000, true);
        });
      });
    });
  });
});
