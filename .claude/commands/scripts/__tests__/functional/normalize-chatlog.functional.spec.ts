#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/functional/normalize-chatlog.functional.spec.ts
// @(#): 外部依存をモックで代替する関数テスト
//       対象: runAI (Deno.Command モック), segmentChatlog (runAI モック経由)
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals, assertRejects } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test helpers
import {
  makeCountingMock,
  makeFailMock,
  makeNotFoundMock,
  makeSuccessMock,
} from '../_helpers/deno-command-mock.ts';

// test target
import {
  runAI,
  segmentChatlog,
} from '../../normalize-chatlog.ts';

// ─── runAI tests ──────────────────────────────────────────────────────────────

/**
 * runAI のユニットテスト。
 * Claude CLI をサブプロセスとして起動し、stdout をデコードして返す関数の
 * 正常系・異常系・出力トリミングを検証する。
 */
describe('runAI', () => {
  /** 正常系: Claude CLI が exit code 0 で終了し、stdout テキストが返る */
  describe('Given: Claude CLI が exit code 0 で正常終了する', () => {
    /**
     * When: 標準的な model・systemPrompt・userPrompt を渡して runAI を呼び出す。
     */
    describe('When: runAI("claude-sonnet-4-6", "You are a helper.", "Summarize this") を呼び出す', () => {
      /**
       * Task T-02-01: Claude CLI の正常呼び出し。
       * exit code 0 のとき stdout テキストをデコードして返し、渡した引数が CLI に正しく伝わることを確認する。
       */
      describe('Then: Task T-02-01 - Claude CLI の正常呼び出し', () => {
        let savedCommand: unknown;
        beforeEach(() => {
          savedCommand = (Deno as unknown as Record<string, unknown>).Command;
        });
        afterEach(() => {
          (Deno as unknown as Record<string, unknown>).Command = savedCommand;
        });

        it('exit code 0 のとき stdout テキストをデコードして返す', async () => {
          const stdoutText = 'Summary result';
          const mock = makeSuccessMock(new TextEncoder().encode(stdoutText));
          (Deno as unknown as Record<string, unknown>).Command = mock;

          const result = await runAI('claude-sonnet-4-6', 'You are a helper.', 'Summarize this');

          assertEquals(result, stdoutText);
        });

        it('model・systemPrompt・安全オプションが CLI に渡される', async () => {
          const captured = { value: [] as string[] };
          const mock = makeSuccessMock(new TextEncoder().encode('ok'), captured);
          (Deno as unknown as Record<string, unknown>).Command = mock;

          await runAI('claude-sonnet-4-6', 'You are a helper.', 'Summarize this');

          assertEquals(captured.value, [
            '-p',
            'You are a helper.',
            '--output-format',
            'text',
            '--permission-mode',
            'acceptEdits',
            '--strict-mcp-config',
            '--mcp-config',
            '{"mcpServers":{}}',
            '--model',
            'claude-sonnet-4-6',
          ]);
        });
      });
    });
  });

  /** 異常系: CLI が非ゼロ exit code で終了したとき Error をスローする */
  describe('Given: Claude CLI が非ゼロ exit code で終了する', () => {
    describe('When: runAI("claude-sonnet-4-6", "sys", "user") を呼び出す', () => {
      /**
       * Task T-02-02: Claude CLI 失敗時の処理。
       * 非ゼロ exit code のとき、exit code を含む Error がスローされることを確認する。
       */
      describe('Then: Task T-02-02 - Claude CLI 失敗時の処理', () => {
        let savedCommand: unknown;
        beforeEach(() => {
          savedCommand = (Deno as unknown as Record<string, unknown>).Command;
          (Deno as unknown as Record<string, unknown>).Command = makeFailMock(1);
        });
        afterEach(() => {
          (Deno as unknown as Record<string, unknown>).Command = savedCommand;
        });

        it('非ゼロ exit code のとき exit code を含む Error をスローする', async () => {
          await assertRejects(
            () => runAI('claude-sonnet-4-6', 'sys', 'user'),
            Error,
            '1',
          );
        });
      });
    });
  });

  /** 異常系: `claude` コマンドが見つからず Deno.errors.NotFound が伝播する */
  describe('Given: `claude` コマンドが存在しない', () => {
    describe('When: runAI("claude-sonnet-4-6", "sys", "user") を呼び出す', () => {
      /**
       * Task T-02-03: Claude CLI 失敗時の処理（コマンド不在）。
       * spawn が NotFound をスローした場合、そのエラーが呼び出し元に伝播することを確認する。
       */
      describe('Then: Task T-02-03 - Claude CLI 失敗時の処理（コマンド不在）', () => {
        let savedCommand: unknown;
        beforeEach(() => {
          savedCommand = (Deno as unknown as Record<string, unknown>).Command;
          (Deno as unknown as Record<string, unknown>).Command = makeNotFoundMock();
        });
        afterEach(() => {
          (Deno as unknown as Record<string, unknown>).Command = savedCommand;
        });

        it('spawn が Deno.errors.NotFound をスローしたとき、エラーが呼び出し元に伝播する', async () => {
          await assertRejects(
            () => runAI('claude-sonnet-4-6', 'sys', 'user'),
            Deno.errors.NotFound,
          );
        });
      });
    });
  });

  /** 正常系: stdout の前後空白・改行を trim して返す */
  describe('Given: Claude CLI の stdout に前後の空白が含まれる', () => {
    describe('When: runAI("claude-sonnet-4-6", "sys", "user") を呼び出す', () => {
      /**
       * Task T-02-04: 出力のトリミング。
       * stdout の前後に空白や改行が含まれる場合、trim した文字列が返ることを確認する。
       */
      describe('Then: Task T-02-04 - 出力のトリミング', () => {
        let savedCommand: unknown;
        beforeEach(() => {
          savedCommand = (Deno as unknown as Record<string, unknown>).Command;
          (Deno as unknown as Record<string, unknown>).Command = makeSuccessMock(
            new TextEncoder().encode('  Summary result\n'),
          );
        });
        afterEach(() => {
          (Deno as unknown as Record<string, unknown>).Command = savedCommand;
        });

        it('stdout の前後の空白を除去した文字列を返す', async () => {
          const result = await runAI('claude-sonnet-4-6', 'sys', 'user');

          assertEquals(result, 'Summary result');
        });
      });
    });
  });
});

// ─── segmentChatlog tests ─────────────────────────────────────────────────────

/**
 * segmentChatlog のユニットテスト。
 * チャットログコンテンツを AI に渡してセグメント配列 `{title, summary, body}[]` を取得する関数の
 * 正常系・エラー耐性・上限制御を検証する。
 */
describe('segmentChatlog', () => {
  /** 正常系: runAI が有効な JSON 配列を返したときセグメント配列を返す */
  describe('Given: runAI が有効な JSON セグメント配列を返す', () => {
    describe('When: segmentChatlog(filePath, content) を呼び出す', () => {
      /**
       * Task T-09-01: 正常なセグメント配列の返却。
       * セグメントが正しく配列として返され、runAI がちょうど1回呼ばれることを確認する。
       */
      describe('Then: Task T-09-01 - 正常なセグメント配列の返却', () => {
        let savedCommand: unknown;
        beforeEach(() => {
          savedCommand = (Deno as unknown as Record<string, unknown>).Command;
        });
        afterEach(() => {
          (Deno as unknown as Record<string, unknown>).Command = savedCommand;
        });

        it('T-09-01-01: {title, summary, body}[] の2件以上の配列を返す', async () => {
          const segments = [
            { title: 'Topic A', summary: 'Summary A', body: 'Body A' },
            { title: 'Topic B', summary: 'Summary B', body: 'Body B' },
          ];
          const mock = makeSuccessMock(new TextEncoder().encode(JSON.stringify(segments)));
          (Deno as unknown as Record<string, unknown>).Command = mock;

          const result = await segmentChatlog('path/to/file.md', 'some chat content');

          assertEquals(Array.isArray(result), true);
          assertEquals((result as unknown[]).length >= 2, true);
          assertEquals((result as { title: string }[])[0].title, 'Topic A');
          assertEquals((result as { summary: string }[])[0].summary, 'Summary A');
          assertEquals((result as { body: string }[])[0].body, 'Body A');
        });

        it('T-09-01-02: 1呼び出しにつき runAI をちょうど1回だけ呼び出す', async () => {
          const counter = { calls: 0 };
          const segments = [
            { title: 'Topic A', summary: 'Summary A', body: 'Body A' },
            { title: 'Topic B', summary: 'Summary B', body: 'Body B' },
          ];
          const mock = makeCountingMock(JSON.stringify(segments), counter);
          (Deno as unknown as Record<string, unknown>).Command = mock;

          await segmentChatlog('path/to/file.md', 'some chat content');

          assertEquals(counter.calls, 1);
        });
      });
    });
  });

  /** 異常系: runAI がエラーまたは非 JSON を返した場合は null を返す */
  describe('Given: runAI がエラーをスローする', () => {
    describe('When: segmentChatlog(filePath, content) を呼び出す', () => {
      /**
       * Task T-09-02: エラー時の null 返却。
       * runAI がエラーをスロー、または非 JSON を返した場合に null が返ることを確認する。
       */
      describe('Then: Task T-09-02 - エラー時の null 返却', () => {
        let savedCommand: unknown;
        beforeEach(() => {
          savedCommand = (Deno as unknown as Record<string, unknown>).Command;
        });
        afterEach(() => {
          (Deno as unknown as Record<string, unknown>).Command = savedCommand;
        });

        it('T-09-02-01: null を返す', async () => {
          (Deno as unknown as Record<string, unknown>).Command = makeFailMock(1);

          const result = await segmentChatlog('path/to/file.md', 'some chat content');

          assertEquals(result, null);
        });

        it('T-09-02-02: runAI が "not json" を返す場合に null を返す', async () => {
          const mock = makeSuccessMock(new TextEncoder().encode('not json'));
          (Deno as unknown as Record<string, unknown>).Command = mock;

          const result = await segmentChatlog('path/to/file.md', 'some chat content');

          assertEquals(result, null);
        });
      });
    });
  });

  /** 正常系: セグメント数が上限 (10件) を超えた場合は最初の10件のみ返す */
  describe('Given: runAI が 15件のセグメントを返す', () => {
    describe('When: segmentChatlog(filePath, content) を呼び出す', () => {
      /**
       * Task T-09-03: セグメント数の上限適用。
       * runAI が10件を超えるセグメントを返した場合、最初の10件のみに絞られることを確認する。
       */
      describe('Then: Task T-09-03 - セグメント数の上限適用', () => {
        let savedCommand: unknown;
        beforeEach(() => {
          savedCommand = (Deno as unknown as Record<string, unknown>).Command;
        });
        afterEach(() => {
          (Deno as unknown as Record<string, unknown>).Command = savedCommand;
        });

        it('T-09-03-01: ちょうど10件のみ返される', async () => {
          const segments = Array.from({ length: 15 }, (_, i) => ({
            title: `Topic ${i + 1}`,
            summary: `Summary ${i + 1}`,
            body: `Body ${i + 1}`,
          }));
          const mock = makeSuccessMock(new TextEncoder().encode(JSON.stringify(segments)));
          (Deno as unknown as Record<string, unknown>).Command = mock;

          const result = await segmentChatlog('path/to/file.md', 'some chat content');

          assertEquals((result as unknown[]).length, 10);
        });
      });
    });
  });
});
