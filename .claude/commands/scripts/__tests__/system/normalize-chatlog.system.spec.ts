#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/system/normalize-chatlog.system.spec.ts
// @(#): 実ファイルを使ったシステムテスト
//       対象: main() — fixtures/chatlog/ の実 MD ファイルを入力として正規化パイプライン全体を検証する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words aplys

// Deno Test module
import { assertEquals, assertMatch } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test helpers
import { makeSuccessMock } from '../_helpers/deno-command-mock.ts';

// test target
import { findMdFiles, main } from '../../normalize-chatlog.ts';

// ─── fixtures パス ────────────────────────────────────────────────────────────

/** fixtures/chatlog/ に置いた実 chatlog ファイルのディレクトリ */
const FIXTURE_DIR = new URL('../_fixtures/chatlog', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// ─── system tests ─────────────────────────────────────────────────────────────

/**
 * main() のシステムテスト。
 * fixtures/chatlog/ に置いた実際のチャットログ MD ファイルを入力として使い、
 * 正規化パイプライン全体 (parseArgs → resolveInputDir → findMdFiles →
 * segmentChatlog → generateSegmentFile + attachFrontmatter → writeOutput →
 * reportResults) が実ファイルで正常動作することを確認する。
 *
 * AI 呼び出し (runAI) は Deno.Command モックで代替する。
 */
describe('main — 実ファイルを使った正規化パイプライン', () => {
  /** 正常系: 実 chatlog ファイルを読み込みセグメント出力ファイルが生成される */
  describe('Given: fixtures/chatlog/ に実 MD ファイルが 1 件存在する', () => {
    let outputDir: string;
    let savedCommand: unknown;
    let logCalls: string[];
    let logStub: Stub;

    beforeEach(async () => {
      outputDir = await Deno.makeTempDir();
      savedCommand = (Deno as unknown as Record<string, unknown>).Command;

      // モック AI: 実ファイルのフロントマターと会話内容に対して 2 セグメントを返す
      const segmentResponse = JSON.stringify([
        {
          title: 'API設計',
          summary: 'aplys の API 設計方針について議論した',
          body: '### User\n1 API設計\n\n現在\n\naplys <domain>/<target> <action> [files...]',
        },
        {
          title: 'exit code 仕様',
          summary: 'exit code の仕様を確認・追加した',
          body: '### User\n2 exit code\n\n現在\n\ncode    意味',
        },
      ]);
      (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
        new TextEncoder().encode(segmentResponse),
      );

      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(async () => {
      (Deno as unknown as Record<string, unknown>).Command = savedCommand;
      logStub.restore();
      await Deno.remove(outputDir, { recursive: true });
    });

    describe('When: main(["--dir", FIXTURE_DIR, "--output", outputDir]) を呼び出す', () => {
      describe('Then: S-01-01 - 実ファイルから正規化されたセグメント出力が生成される', () => {
        it('S-01-01-01: outputDir に 1 件以上の .md ファイルが生成される', async () => {
          await main(['--dir', FIXTURE_DIR, '--output', outputDir]);

          const files = findMdFiles(outputDir);
          assertEquals(files.length >= 1, true);
        });

        it('S-01-01-02: 各出力ファイルが YAML frontmatter (---\\n) で始まる', async () => {
          await main(['--dir', FIXTURE_DIR, '--output', outputDir]);

          for (const filePath of findMdFiles(outputDir)) {
            const content = await Deno.readTextFile(filePath);
            assertEquals(content.startsWith('---\n'), true, `${filePath} は frontmatter で始まる必要がある`);
          }
        });

        it('S-01-01-03: 各出力ファイルが ## Summary セクションを含む', async () => {
          await main(['--dir', FIXTURE_DIR, '--output', outputDir]);

          for (const filePath of findMdFiles(outputDir)) {
            const content = await Deno.readTextFile(filePath);
            assertEquals(content.includes('## Summary'), true, `${filePath} は ## Summary を含む必要がある`);
          }
        });

        it('S-01-01-04: frontmatter に project フィールドが伝播している', async () => {
          await main(['--dir', FIXTURE_DIR, '--output', outputDir]);

          for (const filePath of findMdFiles(outputDir)) {
            const content = await Deno.readTextFile(filePath);
            // 実ファイルの frontmatter に project: aplys があるため伝播するはず
            assertEquals(content.includes('project: aplys'), true, `${filePath} は project: aplys を含む必要がある`);
          }
        });

        it('S-01-01-05: 処理結果レポートに success>=1 が含まれる', async () => {
          await main(['--dir', FIXTURE_DIR, '--output', outputDir]);

          const output = logCalls.join('\n');
          assertMatch(output, /success=[1-9]/);
        });

        it('S-01-01-06: 入力ファイルの内容が main() 実行後も変化しない (R-010)', async () => {
          const inputFile = `${FIXTURE_DIR}/2026-03-11-1-api-a4a84394.md`;
          const before = await Deno.readTextFile(inputFile);

          await main(['--dir', FIXTURE_DIR, '--output', outputDir]);

          const after = await Deno.readTextFile(inputFile);
          assertEquals(after, before);
        });
      });
    });
  });
});
