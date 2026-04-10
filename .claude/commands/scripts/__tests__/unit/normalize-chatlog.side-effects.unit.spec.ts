#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/unit/normalize-chatlog.side-effects.unit.spec.ts
// @(#): 副作用のある関数のユニットテスト
//       対象: reportResults (console.log への出力),
//             runAI (Deno.Command によるサブプロセス起動)
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals, assertMatch, assertNotEquals, assertRejects } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test helpers
import {
  makeCountingMock,
  makeFailMock,
  makeNotFoundMock,
  makeSuccessMock,
} from '../_helpers/deno-command-mock.ts';

// test target
import {
  reportResults,
  runAI,
} from '../../normalize-chatlog.ts';
import type { Stats } from '../../normalize-chatlog.ts';

// ─── reportResults tests ──────────────────────────────────────────────────────

describe('reportResults', () => {
  /** 正常系: success/skip/fail カウントを stdout に集計レポートとして出力する */
  describe('Given: success/skip/fail カウントを持つ stats', () => {
    let logStub: Stub;
    let logCalls: string[];

    // T-14-01-TF: stub console.log, collect call args
    beforeEach(() => {
      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(() => {
      logStub.restore();
    });

    describe('When: reportResults を呼び出す', () => {
      describe('Then: Task T-14-01 - stdout への集計レポート (R-009)', () => {
        it('T-14-01-01: stdout に成功件数が含まれる', () => {
          const stats: Stats = { success: 5, skip: 2, fail: 1 };

          reportResults(stats);

          const output = logCalls.join('\n');
          assertMatch(output, /success.*5|5.*success|成功.*5|5.*成功/i);
        });

        it('T-14-01-02: stdout にスキップ数と失敗数が含まれる', () => {
          const stats: Stats = { success: 3, skip: 1, fail: 2 };

          reportResults(stats);

          const output = logCalls.join('\n');
          assertMatch(output, /1/);
          assertMatch(output, /2/);
        });
      });
    });
  });

  /** エッジケース: 全カウントが 0 でもスローせず出力する */
  describe('Given: 全カウントが 0 の stats', () => {
    let logStub: Stub;
    let logCalls: string[];

    // T-14-02-TF: stub console.log, collect call args
    beforeEach(() => {
      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(() => {
      logStub.restore();
    });

    describe('When: reportResults を呼び出す', () => {
      describe('Then: Task T-14-02 - ゼロ件でもエラーなし', () => {
        it('T-14-02-01: throw せずに stdout に出力される', () => {
          const stats: Stats = { success: 0, skip: 0, fail: 0 };

          reportResults(stats);

          assertNotEquals(logCalls.length, 0);
          assertNotEquals(logCalls.join(''), '');
        });
      });
    });
  });

  /** 正常系: fail が非ゼロのとき失敗件数を stdout に明示する */
  describe('Given: fail が非ゼロの stats', () => {
    let logStub: Stub;
    let logCalls: string[];

    beforeEach(() => {
      logCalls = [];
      logStub = stub(console, 'log', (...args: unknown[]) => {
        logCalls.push(args.map(String).join(' '));
      });
    });

    afterEach(() => {
      logStub.restore();
    });

    describe('When: reportResults を呼び出す', () => {
      describe('Then: Task T-14-03 - 失敗件数の明示 (R-009)', () => {
        it('T-14-03-01: stdout に失敗件数が明示される', () => {
          const stats: Stats = { success: 0, skip: 0, fail: 3 };

          reportResults(stats);

          const output = logCalls.join('\n');
          assertMatch(output, /fail.*3|3.*fail|失敗.*3|3.*失敗/i);
        });
      });
    });
  });
});

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
            '--system-prompt',
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

        it('-p と --system-prompt が分離されており systemPrompt が -p の引数になっていない', async () => {
          const captured = { value: [] as string[] };
          const mock = makeSuccessMock(new TextEncoder().encode('ok'), captured);
          (Deno as unknown as Record<string, unknown>).Command = mock;

          await runAI('claude-sonnet-4-6', 'You are a helper.', 'Summarize this');

          const pIdx = captured.value.indexOf('-p');
          const spIdx = captured.value.indexOf('--system-prompt');
          // -p は単独フラグ（直後が --system-prompt であること）
          assertEquals(captured.value[pIdx + 1], '--system-prompt');
          // --system-prompt の直後に systemPrompt の値があること
          assertEquals(captured.value[spIdx + 1], 'You are a helper.');
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
