#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/normalize-chatlog.spec.ts
// @(#): チャットログを分轄、正規化するスクリプトのユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words aaabbbb

// Deno Test module
import { assertEquals, assertMatch, assertNotEquals, assertRejects } from '@std/assert';
import { after, afterEach, before, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test helpers
import {
  makeCountingMock,
  makeFailMock,
  makeNotFoundMock,
  makeSuccessMock,
} from './_helpers/deno-command-mock.ts';

// test target
import {
  attachFrontmatter,
  cleanYaml,
  collectMdFiles,
  findMdFiles,
  generateLogId,
  generateSegmentFile,
  main,
  parseArgs,
  parseFrontmatter,
  parseJsonArray,
  reportResults,
  resolveInputDir,
  runAI,
  segmentChatlog,
  withConcurrency,
  writeOutput,
} from '../normalize-chatlog.ts';
import type { Stats } from '../normalize-chatlog.ts';

/**
 * withConcurrency のユニットテスト。
 * 指定した最大並列数でタスクを並行実行し、入力順に結果を返す関数の正常系・エッジケースを検証する。
 */
describe('withConcurrency', () => {
  /** 正常系: 並列数内のタスクを全件処理し、入力インデックス順に結果を返す */
  describe('[正常] Normal Cases', () => {
    /**
     * Task T-01-01: 並列実行の基本動作。
     * タスク数が並列数以下のとき全件処理され、完了順に関わらず入力インデックス順に結果が返ることを確認する。
     */
    describe('Given: タスク配列と並列数が与えられる', () => {
      describe('When: withConcurrency(tasks, concurrency) を呼び出す', () => {
        describe('Then: Task T-01-01 - 並列実行の基本動作', () => {
          it('T-01-01-01: Given 4タスク並列数4, When withConcurrency, Then 全4件が入力順に返る', async () => {
            const tasks = [
              () => Promise.resolve(1),
              () => Promise.resolve(2),
              () => Promise.resolve(3),
              () => Promise.resolve(4),
            ];

            const result = await withConcurrency(tasks, 4);

            assertEquals(result, [1, 2, 3, 4]);
          });

          it('T-01-01-02: Given 6タスク(遅延時間が異なる)並列数2, When withConcurrency, Then 完了順に関わらず入力インデックス順に返る', async () => {
            const tasks = [0, 1, 2, 3, 4, 5].map((i) => () =>
              new Promise<number>((resolve) => setTimeout(() => resolve(i), (6 - i) * 10))
            );

            const result = await withConcurrency(tasks, 2);

            assertEquals(result, [0, 1, 2, 3, 4, 5]);
          });
        });
      });
    });
  });

  /** エッジケース: 空配列・並列数超過など境界条件でも正常動作する */
  describe('[エッジケース] Edge Cases', () => {
    /**
     * Task T-01-02: エッジケースの処理。
     * 空配列や並列数がタスク数を超える場合でもエラーなく正常に動作することを確認する。
     */
    describe('Given: 空配列または並列数がタスク数を超えるケース', () => {
      describe('When: withConcurrency(tasks, concurrency) を呼び出す', () => {
        describe('Then: Task T-01-02 - エッジケースの処理', () => {
          it('T-01-02-01: Given 空のタスク配列と並列数4, When withConcurrency, Then エラーなく空配列が返される', async () => {
            const tasks: (() => Promise<never>)[] = [];

            const result = await withConcurrency(tasks, 4);

            assertEquals(result, []);
          });

          it('T-01-02-02: Given 2タスクと並列数10, When withConcurrency, Then 両タスクが完了し結果が返される', async () => {
            const tasks = [
              () => Promise.resolve('a'),
              () => Promise.resolve('b'),
            ];

            const result = await withConcurrency(tasks, 10);

            assertEquals(result, ['a', 'b']);
          });
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
    /**
     * When: 非ゼロ終了コードを返すモックで runAI を呼び出す。
     */
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
    /**
     * When: spawn が Deno.errors.NotFound をスローするモックで runAI を呼び出す。
     */
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
    /**
     * When: 前後に空白・改行を含む stdout を返すモックで runAI を呼び出す。
     */
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

// ─── cleanYaml tests ──────────────────────────────────────────────────────────

/**
 * cleanYaml のユニットテスト。
 * AI が返す生テキストからコードフェンス・前置テキスト・末尾改行を除去し、
 * パース可能なクリーンな YAML 文字列を返す関数の正常系・エッジケースを検証する。
 */
describe('cleanYaml', () => {
  /** 正常系: コードフェンスや前置テキストを除去してクリーンな YAML を返す */
  describe('Given: ```yaml...``` コードフェンスで囲まれた YAML 文字列', () => {
    /**
     * When: コードフェンスに囲まれた YAML 文字列を cleanYaml に渡す。
     */
    describe('When: cleanYaml(raw, "title") を呼び出す', () => {
      /**
       * Task T-03-01: コードフェンスの除去。
       * 開始・終了フェンス行の除去と、firstField より前の余分な行の除去を確認する。
       */
      describe('Then: Task T-03-01 - コードフェンスの除去', () => {
        it('開始フェンス行と終了フェンス行を除去して YAML コンテンツだけを返す', () => {
          const raw = '```yaml\ntitle: foo\ndate: 2026-04-05\n```';

          const result = cleanYaml(raw, 'title');

          assertEquals(result, 'title: foo\ndate: 2026-04-05');
        });

        it('firstField より前の非 YAML 行をすべて除去する', () => {
          const raw = 'Here is the YAML:\ntitle: foo\ndate: 2026-04-05';

          const result = cleanYaml(raw, 'title');

          assertEquals(result, 'title: foo\ndate: 2026-04-05');
        });
      });
    });
  });

  /** エッジケース: フェンスなし・末尾改行のみの入力でも正しく trim する */
  describe('Given: フェンスも余分な行もなく末尾に改行がある YAML 文字列', () => {
    /**
     * When: フェンスなしで末尾改行のみを含む YAML 文字列を cleanYaml に渡す。
     */
    describe('When: cleanYaml(raw, "title") を呼び出す', () => {
      /**
       * Task T-03-02: エッジケースの処理（末尾改行のみ）。
       * 余分な行もフェンスもなく末尾改行だけある場合に、trim された YAML が返ることを確認する。
       */
      describe('Then: Task T-03-02 - エッジケースの処理', () => {
        it('末尾の改行をトリムしてクリーンな YAML コンテンツを返す', () => {
          const raw = 'title: foo\ndate: 2026-04-05\n';

          const result = cleanYaml(raw, 'title');

          assertEquals(result, 'title: foo\ndate: 2026-04-05');
        });
      });
    });
  });

  /** エッジケース: 空文字列入力でスローされず空文字列を返す */
  describe('Given: raw が空文字列', () => {
    /**
     * When: 空文字列を cleanYaml に渡す。
     */
    describe('When: cleanYaml("", "title") を呼び出す', () => {
      /**
       * Task T-03-03: エッジケースの処理（空文字列）。
       * 空文字列を渡してもスローされず、空文字列がそのまま返ることを確認する。
       */
      describe('Then: Task T-03-03 - エッジケースの処理（空文字列）', () => {
        it('例外をスローせず空文字列を返す', () => {
          const result = cleanYaml('', 'title');

          assertEquals(result, '');
        });
      });
    });
  });
});

// ─── parseFrontmatter tests ───────────────────────────────────────────────────

/**
 * parseFrontmatter のユニットテスト。
 * Markdown テキストの先頭にある `---` 区切りのフロントマターを解析し、
 * meta オブジェクトと fullBody 文字列に分解する関数の正常系・異常系を検証する。
 */
describe('parseFrontmatter', () => {
  /** 正常系: `---` で囲まれたフロントマターを meta と fullBody に分解する */
  describe('Given: フロントマターブロックを含む Markdown テキスト', () => {
    /**
     * When: フロントマターと本文を含む Markdown テキストを parseFrontmatter に渡す。
     */
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      /**
       * Task T-04-01: フロントマターありのファイル。
       * meta に YAML フィールドが正しく格納され、fullBody に閉じ `---` 以降のテキストが含まれることを確認する。
       */
      describe('Then: Task T-04-01 - フロントマターありのファイル', () => {
        it('meta に project と date フィールドが含まれる', () => {
          const text = '---\nproject: ci-platform\ndate: 2026-03-01\n---\n# Body';

          const { meta } = parseFrontmatter(text);

          assertEquals(meta, { project: 'ci-platform', date: '2026-03-01' });
        });

        it('fullBody に閉じ --- 以降のテキストが含まれる', () => {
          const text = '---\nproject: ci-platform\ndate: 2026-03-01\n---\n# Body';

          const { fullBody } = parseFrontmatter(text);

          assertEquals(fullBody, '\n# Body');
        });
      });
    });
  });

  /** 正常系: フロントマターなしの場合は meta を空にして fullBody を元テキスト全体とする */
  describe('Given: --- で始まらない Markdown テキスト', () => {
    /**
     * When: フロントマターのない Markdown テキストを parseFrontmatter に渡す。
     */
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      /**
       * Task T-04-02: フロントマターなしのファイル。
       * meta が空レコードとなり、fullBody が元のテキスト全体と等しいことを確認する。
       */
      describe('Then: Task T-04-02 - フロントマターなしのファイル', () => {
        it('meta が空のレコードである', () => {
          const text = '# No Frontmatter\n\nSome content.';

          const { meta } = parseFrontmatter(text);

          assertEquals(meta, {});
        });

        it('fullBody が元のテキスト全体と等しい', () => {
          const text = '# No Frontmatter\n\nSome content.';

          const { fullBody } = parseFrontmatter(text);

          assertEquals(fullBody, text);
        });
      });
    });
  });

  /** 異常系: 開き `---` はあるが閉じ `---` がない不正なフロントマターは無視する */
  describe('Given: --- で始まるが閉じ --- がない Markdown テキスト', () => {
    /**
     * When: 閉じ `---` がない不完全なフロントマターを含むテキストを parseFrontmatter に渡す。
     */
    describe('When: parseFrontmatter(text) を呼び出す', () => {
      /**
       * Task T-04-03: 不正なフロントマター。
       * 閉じ `---` がない場合は meta を空にして fullBody に元テキスト全体を返すことを確認する。
       */
      describe('Then: Task T-04-03 - 不正なフロントマター', () => {
        it('meta が空で fullBody が元のテキスト全体を含む', () => {
          const text = '---\nproject: ci-platform\n';

          const { meta, fullBody } = parseFrontmatter(text);

          assertEquals(meta, {});
          assertEquals(fullBody, text);
        });
      });
    });
  });
});

// ─── generateLogId tests ──────────────────────────────────────────────────────

/**
 * generateLogId のユニットテスト。
 * ファイルパス・エージェント名・タイトル・インデックスから
 * `<date>-<agent>-<title-slug>-<hash7>` 形式の一意な ID を生成する関数の
 * 正常系・決定論的動作・スラッグ正規化を検証する。
 */
describe('generateLogId', () => {
  /** 正常系: `<date>-<agent>-<title-slug>-<hash7>` 形式の ID を生成する */
  describe('Given: 標準的な chatlog ファイルパス・エージェント名・タイトル・インデックス', () => {
    /**
     * When: 標準的なパス・エージェント名・タイトル・インデックスを渡して generateLogId を呼び出す。
     */
    describe('When: generateLogId(filePath, agentName, title, index) を呼び出す', () => {
      /**
       * Task T-05-01: 標準的な log_id 生成。
       * 返値が `YYYYMMDD-agent-slug-hash7` 形式に一致し、スラッグが小文字ハイフン区切りになることを確認する。
       */
      describe('Then: Task T-05-01 - 標準的な log_id 生成', () => {
        it('<date>-<agent>-<title-slug>-<hash7> 形式の ID を返す', async () => {
          const filePath = 'temp/chatlog/claude/2026/2026-03/test.md';
          const agentName = 'claude';
          const title = 'CI/CD Pipeline Fix';
          const index = 0;

          const result = await generateLogId(filePath, agentName, title, index);

          assertMatch(result, /^\d{8}-claude-[a-z0-9-]+-[0-9a-f]{7}$/);
        });

        it('タイトルスラッグが小文字ハイフン区切りになる', async () => {
          const filePath = 'temp/chatlog/claude/2026/2026-03/test.md';
          const agentName = 'claude';
          const title = 'Deno/TypeScript Setup & Config';
          const index = 0;

          const result = await generateLogId(filePath, agentName, title, index);

          // Format: YYYYMMDD-agentName-<slug>-<hash7>
          // Verify the slug segment (between agentName and hash7) contains only lowercase
          // alphanumeric chars and hyphens — no uppercase, `/`, `&`, or spaces
          assertMatch(result, /^\d{8}-[^-]+-[a-z0-9][a-z0-9-]*[a-z0-9]-[0-9a-f]{7}$/);
        });
      });
    });
  });

  /** 正常系: index が異なれば hash7 が変わり、同一入力では常に同一 ID を返す（決定論的） */
  describe('Given: 同一の filePath・agentName・title で index だけ異なる', () => {
    /**
     * When: index=0 と index=1 でそれぞれ generateLogId を呼び出す。
     */
    describe('When: index=0 と index=1 でそれぞれ generateLogId を呼び出す', () => {
      /**
       * Task T-05-02: ハッシュの安定性とインデックス差別化。
       * 同一入力では常に同じ ID を返し（決定論的）、index が異なれば hash7 が異なることを確認する。
       */
      describe('Then: Task T-05-02 - ハッシュの安定性とインデックス差別化', () => {
        it('index が異なれば hash7 が異なる', async () => {
          const filePath = 'temp/chatlog/claude/2026/2026-03/test.md';
          const agentName = 'claude';
          const title = 'CI/CD Pipeline Fix';

          const id0 = await generateLogId(filePath, agentName, title, 0);
          const id1 = await generateLogId(filePath, agentName, title, 1);

          const hash0 = id0.split('-').at(-1);
          const hash1 = id1.split('-').at(-1);
          assertNotEquals(hash0, hash1);
        });

        it('同一入力は常に同一の log_id を返す（決定論的）', async () => {
          const filePath = 'temp/chatlog/claude/2026/2026-03/test.md';
          const agentName = 'claude';
          const title = 'CI/CD Pipeline Fix';
          const index = 0;

          const first = await generateLogId(filePath, agentName, title, index);
          const second = await generateLogId(filePath, agentName, title, index);

          assertEquals(first, second);
        });
      });
    });
  });
});

// ─── findMdFiles / collectMdFiles tests ──────────────────────────────────────

/**
 * findMdFiles / collectMdFiles のユニットテスト。
 * ディレクトリを再帰的に走査して .md ファイルを辞書順で収集する関数の
 * 正常系・フィルタリング・エラー耐性を検証する。
 */
describe('findMdFiles', () => {
  /** 正常系: サブディレクトリを再帰的に走査して .md ファイルを辞書順で収集する */
  describe('Given: 異なる深さに3つの.mdファイルを持つディレクトリツリー', () => {
    /**
     * When: 再帰的なディレクトリツリーに対して findMdFiles を呼び出す。
     */
    describe('When: findMdFiles(dir) を呼び出す', () => {
      /**
       * Task T-06-01: 再帰的MD収集。
       * 全 .md ファイルが収集され、返却配列が辞書順にソートされていることを確認する。
       */
      describe('Then: Task T-06-01 - 再帰的MD収集', () => {
        let dir: string;
        beforeEach(() => {
          dir = Deno.makeTempDirSync();
        });
        afterEach(() => {
          Deno.removeSync(dir, { recursive: true });
        });

        it('T-06-01-01: 全3つのファイルパスが返される', () => {
          Deno.mkdirSync(`${dir}/sub1`);
          Deno.mkdirSync(`${dir}/sub1/sub2`);
          Deno.writeTextFileSync(`${dir}/a.md`, '');
          Deno.writeTextFileSync(`${dir}/sub1/b.md`, '');
          Deno.writeTextFileSync(`${dir}/sub1/sub2/c.md`, '');

          const result = findMdFiles(dir);

          assertEquals(result.length, 3);
        });

        it('T-06-01-02: 返却配列が辞書順にソートされている', () => {
          Deno.writeTextFileSync(`${dir}/c.md`, '');
          Deno.writeTextFileSync(`${dir}/a.md`, '');
          Deno.writeTextFileSync(`${dir}/b.md`, '');

          const result = findMdFiles(dir);

          const sorted = [...result].sort();
          assertEquals(result, sorted);
        });
      });
    });
  });

  /** 正常系: .md 以外の拡張子と空ディレクトリはスキップし .md のみを返す */
  describe('Given: .md、.txt、.yamlファイルを含むディレクトリ', () => {
    /**
     * When: .md・.txt・.yaml 混在のディレクトリに対して collectMdFiles を呼び出す。
     */
    describe('When: collectMdFiles(dir, results) を呼び出す', () => {
      /**
       * Task T-06-02: 非MDファイルと空ディレクトリ。
       * .md 以外の拡張子はスキップされ、.md が0件の場合は空配列が返ることを確認する。
       */
      describe('Then: Task T-06-02 - 非MDファイルと空ディレクトリ', () => {
        let dir: string;
        beforeEach(() => {
          dir = Deno.makeTempDirSync();
        });
        afterEach(() => {
          Deno.removeSync(dir, { recursive: true });
        });

        it('T-06-02-01: .mdファイルのみが結果に含まれる', () => {
          Deno.writeTextFileSync(`${dir}/a.md`, '');
          Deno.writeTextFileSync(`${dir}/b.txt`, '');
          Deno.writeTextFileSync(`${dir}/c.yaml`, '');

          const results: string[] = [];
          collectMdFiles(dir, results);

          assertEquals(results.length, 1);
          assertEquals(results[0].endsWith('.md'), true);
        });

        it('T-06-02-02: .mdファイルが0件のディレクトリで空配列を返す', () => {
          Deno.writeTextFileSync(`${dir}/b.txt`, '');
          Deno.writeTextFileSync(`${dir}/c.yaml`, '');

          const result = findMdFiles(dir);

          assertEquals(result, []);
        });
      });
    });
  });

  /** エッジケース: 存在しないパスはエラーをスローせず空のまま返す */
  describe('Given: ファイルシステムに存在しないパス', () => {
    /**
     * When: 存在しないパスを collectMdFiles に渡す。
     */
    describe('When: collectMdFiles(nonExistentPath, results) を呼び出す', () => {
      /**
       * Task T-06-03: 存在しないディレクトリ。
       * 存在しないパスを渡してもエラーがスローされず、results が空のまま返ることを確認する。
       */
      describe('Then: Task T-06-03 - 存在しないディレクトリ', () => {
        it('T-06-03-01: エラーがスローされず results が空のままである', () => {
          const nonExistentPath = '/this/path/does/not/exist/at/all/9999';

          const results: string[] = [];
          collectMdFiles(nonExistentPath, results);

          assertEquals(results, []);
        });
      });
    });
  });
});

// ─── resolveInputDir tests ────────────────────────────────────────────────────

/**
 * resolveInputDir のユニットテスト。
 * --dir・--agent/--year-month オプションから入力ディレクトリパスを解決し、
 * 存在しない場合は Deno.exit(1) を呼び出す関数の正常系・異常系を検証する。
 */
describe('resolveInputDir', () => {
  /** 正常系: 存在する --dir パスをそのまま返す */
  describe('Given: 存在する --dir パスが与えられる', () => {
    /**
     * When: 実在する一時ディレクトリを { dir } として resolveInputDir に渡す。
     */
    describe('When: resolveInputDir({ dir }) を呼び出す', () => {
      /**
       * Task T-07-01: --dir オプションによる解決。
       * 存在するパスが指定された場合、そのまま返されることを確認する。
       */
      describe('Then: Task T-07-01 - --dir オプションによる解決', () => {
        let dir: string;
        beforeEach(() => {
          dir = Deno.makeTempDirSync();
        });
        afterEach(() => {
          Deno.removeSync(dir, { recursive: true });
        });

        it('T-07-01-01: 存在する --dir パスをそのまま返す', () => {
          const result = resolveInputDir({ dir });

          assertEquals(result, dir);
        });
      });
    });
  });

  /** 異常系: 存在しないパスが指定された場合は Deno.exit(1) を呼び出す */
  describe('Given: 存在しない --dir パスが与えられる', () => {
    /**
     * When: 存在しないパスを { dir } として resolveInputDir に渡す。
     */
    describe('When: resolveInputDir({ dir: "/nonexistent/path/xyz" }) を呼び出す', () => {
      /**
       * Task T-07-03: 存在しないパスでのエラー終了。
       * 解決先パスが存在しない場合、Deno.exit(1) が呼ばれることを確認する。
       */
      describe('Then: Task T-07-03 - 存在しないパスでのエラー終了', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-07-03-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ dir: '/nonexistent/path/xyz' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  /** 異常系: 必須オプションが一切ない場合は Deno.exit(1) を呼び出す */
  describe('Given: --dir も --agent/--yearMonth も与えられない', () => {
    /**
     * When: 空オブジェクトを resolveInputDir に渡す。
     */
    describe('When: resolveInputDir({}) を呼び出す', () => {
      /**
       * Task T-07-04: 必須オプションの欠落。
       * --dir も --agent/--yearMonth も指定されない場合、Deno.exit(1) が呼ばれることを確認する。
       */
      describe('Then: Task T-07-04 - 必須オプションの欠落', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-07-04-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({});

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  /** 異常系: --agent/--year-month で解決されたパスが存在しない場合は Deno.exit(1) を呼び出す */
  describe('Given: agent="claude", yearMonth="1999-01" が与えられ解決先パスが存在しない', () => {
    /**
     * When: 解決先ディレクトリが存在しない agent/yearMonth を resolveInputDir に渡す。
     */
    describe('When: resolveInputDir({ agent: "claude", yearMonth: "1999-01" }) を呼び出す', () => {
      /**
       * Task T-07-05: 存在しないパスでのエラー終了（--agent/--year-month 経由）。
       * --agent/--year-month から構築したパスが存在しない場合、Deno.exit(1) が呼ばれることを確認する。
       */
      describe('Then: Task T-07-05 - 存在しないパスでのエラー終了（--agent/--year-month 経由）', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-07-05-01: Deno.exit(1) が呼ばれる', () => {
          resolveInputDir({ agent: 'claude', yearMonth: '1999-01' });

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  /** 正常系: --agent/--year-month で `temp/chatlog/<agent>/<year>/<yearMonth>` を解決して返す */
  describe('Given: agent="claude", yearMonth="2026-03" が与えられ対応パスが存在する', () => {
    /**
     * When: 実在するディレクトリを事前に作成した agent/yearMonth を resolveInputDir に渡す。
     */
    describe('When: resolveInputDir({ agent, yearMonth }) を呼び出す', () => {
      /**
       * Task T-07-02: --agent/--year-month による解決。
       * `temp/chatlog/<agent>/<year>/<yearMonth>` のパスが正しく構築・返却されることを確認する。
       */
      describe('Then: Task T-07-02 - --agent/--year-month による解決', () => {
        const AGENT = 'claude';
        const YEAR_MONTH_2026 = '2026-03';
        const DIR_2026 = `temp/chatlog/${AGENT}/2026/${YEAR_MONTH_2026}`;
        const YEAR_MONTH_2025 = '2025-11';
        const DIR_2025 = `temp/chatlog/${AGENT}/2025/${YEAR_MONTH_2025}`;

        before(async () => {
          await Deno.mkdir(DIR_2026, { recursive: true });
          await Deno.mkdir(DIR_2025, { recursive: true });
        });

        after(async () => {
          await Deno.remove(`temp/chatlog/${AGENT}/2026`, { recursive: true });
          await Deno.remove(`temp/chatlog/${AGENT}/2025`, { recursive: true });
        });

        it('T-07-02-01: temp/chatlog/<agent>/<year>/<yearMonth> のパスを返す', () => {
          const result = resolveInputDir({ agent: AGENT, yearMonth: YEAR_MONTH_2026 });

          assertEquals(result, DIR_2026);
        });

        it('T-07-02-02: yearMonth="2025-11" のとき返却パスが "2025/2025-11" のサブパスを含む', () => {
          const result = resolveInputDir({ agent: AGENT, yearMonth: YEAR_MONTH_2025 });

          assertEquals(result.includes('2025/2025-11'), true);
        });
      });
    });
  });
});

// ─── parseArgs tests ──────────────────────────────────────────────────────────

/**
 * parseArgs のユニットテスト。
 * CLI 引数配列を解析して { dir, agent, yearMonth, dryRun, concurrency, output } を返す関数の
 * 正常系・デフォルト値・エラー終了・パス正規化を検証する。
 */
describe('parseArgs', () => {
  /** 正常系: --dir・--agent・--year-month・--dry-run・--concurrency・--output を正しくパースする */
  describe('Given: --dir オプションを含む引数配列', () => {
    /**
     * When: --dir フラグと値を含む配列を parseArgs に渡す。
     */
    describe('When: parseArgs(["--dir", "/some/path"]) を呼び出す', () => {
      /**
       * Task T-08-01: 全オプションのパース（--dir 単体）。
       * args.dir が指定した値になることを確認する。
       */
      describe('Then: Task T-08-01 - 全オプションのパース', () => {
        it('T-08-01-01: args.dir が "/some/path" になる', () => {
          const result = parseArgs(['--dir', '/some/path']);

          assertEquals(result.dir, '/some/path');
        });
      });
    });
  });

  /** 正常系: 複数オプションが混在しても全フィールドを正しく解析する */
  describe('Given: --agent・--year-month・--dry-run・--concurrency・--output を含む引数配列', () => {
    /**
     * When: 複数のフラグと値を混在した配列を parseArgs に渡す。
     */
    describe('When: parseArgs(["--agent","claude","--year-month","2026-03","--dry-run","--concurrency","8","--output","./out"]) を呼び出す', () => {
      /**
       * Task T-08-01: 全オプションのパース（複数フラグ混在）。
       * agent・yearMonth・dryRun・concurrency・output の各フィールドが正しく設定されることを確認する。
       */
      describe('Then: Task T-08-01 - 全オプションのパース', () => {
        let result: ReturnType<typeof parseArgs>;
        beforeEach(() => {
          result = parseArgs([
            '--agent',
            'claude',
            '--year-month',
            '2026-03',
            '--dry-run',
            '--concurrency',
            '8',
            '--output',
            './out',
          ]);
        });

        it('T-08-01-02a: args.agent が "claude" になる', () => {
          assertEquals(result.agent, 'claude');
        });

        it('T-08-01-02b: args.yearMonth が "2026-03" になる', () => {
          assertEquals(result.yearMonth, '2026-03');
        });

        it('T-08-01-02c: args.dryRun が true になる', () => {
          assertEquals(result.dryRun, true);
        });

        it('T-08-01-02d: args.concurrency が 8 になる', () => {
          assertEquals(result.concurrency, 8);
        });

        it('T-08-01-02e: args.output が "./out" になる', () => {
          assertEquals(result.output, './out');
        });
      });
    });
  });

  /** 正常系: 省略時はデフォルト値 (concurrency=4, dryRun=false) が適用される */
  describe('Given: --concurrency・--dry-run を含まない引数配列', () => {
    /**
     * When: 空の引数配列を parseArgs に渡す。
     */
    describe('When: parseArgs([]) を呼び出す', () => {
      /**
       * Task T-08-02: デフォルト値の適用。
       * --concurrency が省略されたとき 4 に、--dry-run が省略されたとき false になることを確認する。
       */
      describe('Then: Task T-08-02 - デフォルト値の適用', () => {
        let result: ReturnType<typeof parseArgs>;
        beforeEach(() => {
          result = parseArgs([]);
        });

        it('T-08-02-01: args.concurrency が 4 になる', () => {
          assertEquals(result.concurrency, 4);
        });

        it('T-08-02-02: args.dryRun が false になる', () => {
          assertEquals(result.dryRun, false);
        });
      });
    });
  });

  /** 異常系: 未知のオプションは Deno.exit(1) を呼び出してエラー終了する */
  describe('Given: 未知のオプションを含む引数配列', () => {
    /**
     * When: 未定義の --unknown フラグを含む配列を parseArgs に渡す。
     */
    describe('When: parseArgs(["--unknown"]) を呼び出す', () => {
      /**
       * Task T-08-03: 未知オプションでのエラー終了。
       * 未知のフラグが渡されたとき、Deno.exit(1) が呼ばれることを確認する。
       */
      describe('Then: Task T-08-03 - 未知オプションでのエラー終了', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-08-03-01: Deno.exit(1) が呼ばれる', () => {
          parseArgs(['--unknown']);

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  /** 正常系: バックスラッシュをスラッシュへ正規化し、位置引数をパスとして auto-detect する */
  describe('Given: パス区切り文字の正規化または自動 --dir 判定が必要な引数配列', () => {
    /**
     * When: バックスラッシュを含む --dir 値を parseArgs に渡す。
     */
    describe('When: parseArgs(["--dir", "temp\\\\chatlog\\\\claude"]) を呼び出す', () => {
      /**
       * Task T-08-04: パス正規化と自動 --dir 判定（--dir のバックスラッシュ）。
       * --dir 値のバックスラッシュがスラッシュに正規化されることを確認する。
       */
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-01: --dir 値のバックスラッシュがスラッシュに正規化される', () => {
          const result = parseArgs(['--dir', 'temp\\chatlog\\claude']);

          assertEquals(result.dir, 'temp/chatlog/claude');
        });
      });
    });

    /**
     * When: スラッシュを含む位置引数を parseArgs に渡す。
     */
    describe('When: parseArgs(["temp/chatlog/claude/2026/2026-03"]) を呼び出す', () => {
      /**
       * Task T-08-04: パス正規化と自動 --dir 判定（位置引数のスラッシュ）。
       * `/` を含む位置引数が args.dir に自動設定されることを確認する。
       */
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-02: / を含む位置引数が args.dir に設定される', () => {
          const result = parseArgs(['temp/chatlog/claude/2026/2026-03']);

          assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
        });
      });
    });

    /**
     * When: バックスラッシュを含む位置引数を parseArgs に渡す。
     */
    describe('When: parseArgs(["temp\\\\chatlog\\\\claude\\\\2026\\\\2026-03"]) を呼び出す', () => {
      /**
       * Task T-08-04: パス正規化と自動 --dir 判定（位置引数のバックスラッシュ）。
       * `\` を含む位置引数がスラッシュに正規化されて args.dir に設定されることを確認する。
       */
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-03: \\ を含む位置引数がスラッシュ正規化されて args.dir に設定される', () => {
          const result = parseArgs(['temp\\chatlog\\claude\\2026\\2026-03']);

          assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
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
    /**
     * When: 有効な JSON セグメント配列を返すモックで segmentChatlog を呼び出す。
     */
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
    /**
     * When: エラーまたは非 JSON を返すモックで segmentChatlog を呼び出す。
     */
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
    /**
     * When: 15件のセグメントを返すモックで segmentChatlog を呼び出す。
     */
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

// ─── parseJsonArray tests ─────────────────────────────────────────────────────

/**
 * parseJsonArray のユニットテスト。
 * 生テキストから JSON 配列を抽出する関数の
 * 直接パース・フォールバック抽出（非貪欲・貪欲）・エラー耐性を検証する。
 */
describe('parseJsonArray', () => {
  /** 正常系: `[` 始まりの JSON 配列を直接パースして返す */
  describe('Given: `[` で始まる有効な JSON 配列文字列', () => {
    /**
     * When: `[` で始まる JSON 配列文字列を parseJsonArray に渡す。
     */
    describe('When: parseJsonArray を呼び出す', () => {
      /**
       * Task T-10-01: 直接 JSON 配列パース。
       * `[` で始まる文字列が直接パースされ、正しい配列として返ることを確認する。
       */
      describe('Then: Task T-10-01 - 直接 JSON 配列パース', () => {
        it('T-10-01-01: 1 オブジェクトを含む配列が返される', () => {
          const rawDirect = '[{"title":"T1","summary":"S1","body":"B1"}]';

          const result = parseJsonArray(rawDirect);

          assertEquals(Array.isArray(result), true);
          assertEquals((result as unknown[]).length, 1);
          assertEquals((result as { title: string }[])[0].title, 'T1');
        });
      });
    });
  });

  /** 正常系: 前置テキストがあっても正規表現フォールバックで JSON 配列を抽出する */
  describe('Given: 前置テキストを含む文字列（非貪欲マッチで JSON 配列を抽出可能）', () => {
    /**
     * When: 前置テキストの後ろに JSON 配列がある文字列を parseJsonArray に渡す。
     */
    describe('When: parseJsonArray を呼び出す', () => {
      /**
       * Task T-10-02: テキスト混在時のフォールバック抽出（非貪欲マッチ）。
       * 前置テキストがあっても非貪欲マッチで JSON 配列が正しく抽出されることを確認する。
       */
      describe('Then: Task T-10-02 - テキスト混在時のフォールバック抽出', () => {
        it('T-10-02-01: 配列が抽出されて返される', () => {
          const rawWithPrefix = 'Here is the result:\n[{"title":"T"}]';

          const result = parseJsonArray(rawWithPrefix);

          assertEquals(Array.isArray(result), true);
          assertEquals((result as unknown[]).length, 1);
          assertEquals((result as { title: string }[])[0].title, 'T');
        });
      });
    });
  });

  /** 正常系: 非貪欲マッチが失敗した場合は貪欲マッチで配列全体を抽出する */
  describe('Given: 非貪欲マッチでは不完全な配列しか取れない文字列（貪欲マッチが必要）', () => {
    /**
     * When: 後続テキストが含まれる JSON 配列文字列を parseJsonArray に渡す。
     */
    describe('When: parseJsonArray を呼び出す', () => {
      /**
       * Task T-10-02: テキスト混在時のフォールバック抽出（貪欲マッチ）。
       * 非貪欲マッチが失敗した場合、貪欲マッチで配列全体が正しく抽出されることを確認する。
       */
      describe('Then: Task T-10-02 - テキスト混在時のフォールバック抽出', () => {
        it('T-10-02-02: 貪欲マッチの結果 length 2 の配列が返される', () => {
          const rawGreedy = 'result: [{"title":"A"},{"title":"B"}] and more text';

          const result = parseJsonArray(rawGreedy);

          assertEquals(Array.isArray(result), true);
          assertEquals((result as unknown[]).length, 2);
          assertEquals((result as { title: string }[])[0].title, 'A');
          assertEquals((result as { title: string }[])[1].title, 'B');
        });
      });
    });
  });

  /** 異常系: JSON 配列が見つからない入力はスローせず null を返す */
  describe('Given: 有効な JSON 配列を含まないプレーンテキスト', () => {
    /**
     * When: JSON 配列を含まないテキストや空文字列を parseJsonArray に渡す。
     */
    describe('When: parseJsonArray を呼び出す', () => {
      /**
       * Task T-10-03: パース不可能な入力。
       * JSON 配列が見つからない、または空文字列を渡してもスローされず null が返ることを確認する。
       */
      describe('Then: Task T-10-03 - パース不可能な入力', () => {
        it('T-10-03-01: null が返される', () => {
          const rawPlain = 'This is plain text with no JSON array';

          const result = parseJsonArray(rawPlain);

          assertEquals(result, null);
        });

        it('T-10-03-02: 空文字列でスローされずに null が返される', () => {
          const rawEmpty = '';

          const result = parseJsonArray(rawEmpty);

          assertEquals(result, null);
        });
      });
    });
  });
});

// ─── generateSegmentFile tests ────────────────────────────────────────────────

/**
 * generateSegmentFile のユニットテスト。
 * セグメントオブジェクト `{title, summary, body}` から Markdown ファイルコンテンツを生成する関数の
 * 正常系・エッジケースを検証する。
 */
describe('generateSegmentFile', () => {
  /** 正常系: summary フィールドが `## Summary` セクションとして出力される */
  describe('Given: { title: "Fix CI pipeline", summary: "Fix CI pipeline", body: "### User\nHow do I fix CI?" } を持つセグメントオブジェクト', () => {
    /**
     * When: summary を持つセグメントオブジェクトを generateSegmentFile に渡す。
     */
    describe('When: generateSegmentFile を呼び出す', () => {
      /**
       * Task T-11-01: セグメントファイルの MD コンテンツ生成（summary セクション）。
       * 返却文字列に `## Summary\n<summary>` が含まれることを確認する。
       */
      describe('Then: Task T-11-01 - セグメントファイルの MD コンテンツ生成', () => {
        it('T-11-01-01: 返却文字列に `## Summary\\nFix CI pipeline` が含まれる', () => {
          const seg = { title: 'Fix CI pipeline', summary: 'Fix CI pipeline', body: '### User\nHow do I fix CI?' };

          const result = generateSegmentFile(seg);

          assertEquals(result.includes('## Summary\nFix CI pipeline'), true);
        });
      });
    });
  });

  /** 正常系: body フィールドが `## Excerpt` セクションとして出力される */
  describe('Given: { title: "Debug session", summary: "Debug session", body: "### User\nHow do I..." } を持つセグメントオブジェクト', () => {
    /**
     * When: body を持つセグメントオブジェクトを generateSegmentFile に渡す。
     */
    describe('When: generateSegmentFile を呼び出す', () => {
      /**
       * Task T-11-01: セグメントファイルの MD コンテンツ生成（body セクション）。
       * 返却文字列に `## Excerpt\n<body>` が含まれることを確認する。
       */
      describe('Then: Task T-11-01 - セグメントファイルの MD コンテンツ生成', () => {
        it('T-11-01-02: 返却文字列に `## Excerpt\\n### User\\nHow do I...` が含まれる', () => {
          const seg = { title: 'Debug session', summary: 'Debug session', body: '### User\nHow do I...' };

          const result = generateSegmentFile(seg);

          assertEquals(result.includes('## Excerpt\n### User\nHow do I...'), true);
        });
      });
    });
  });

  /** エッジケース: 全フィールドが空でも `## Summary` と `## Excerpt` 見出しを含む文字列を返す */
  describe('Given: { title: "", summary: "", body: "" } を持つセグメント', () => {
    /**
     * When: 全フィールドが空文字列のセグメントを generateSegmentFile に渡す。
     */
    describe('When: generateSegmentFile を呼び出す', () => {
      /**
       * Task T-11-02: 空フィールド。
       * 全フィールドが空でも `## Summary` と `## Excerpt` の両見出しが返ることを確認する。
       */
      describe('Then: Task T-11-02 - 空フィールド', () => {
        it('T-11-02-01: 返却文字列に `## Summary` と `## Excerpt` の両セクション見出しが含まれる', () => {
          const seg = { title: '', summary: '', body: '' };

          const result = generateSegmentFile(seg);

          assertEquals(result.includes('## Summary'), true);
          assertEquals(result.includes('## Excerpt'), true);
        });
      });
    });
  });
});

// ─── attachFrontmatter tests ──────────────────────────────────────────────────

/**
 * attachFrontmatter のユニットテスト。
 * sourceMeta とセグメントメタデータを合成して `---` デリミタ付きフロントマターを
 * コンテンツの先頭に付加する関数の正常系・エッジケースを検証する。
 */
describe('attachFrontmatter', () => {
  /** 正常系: sourceMeta の project フィールドを引き継ぎ、AI 生成フィールドを付加する */
  describe('Given: project を含む sourceMeta と title・log_id・summary を含む segmentMeta', () => {
    /**
     * When: project を持つ sourceMeta と segmentMeta を attachFrontmatter に渡す。
     */
    describe('When: attachFrontmatter(content, sourceMeta, segmentMeta) を呼び出す', () => {
      /**
       * Task T-12-01: ソースメタデータ引き継ぎによるフロントマター合成 (R-007)。
       * project フィールドが引き継がれ、title・log_id・summary が付加されることを確認する。
       */
      describe('Then: Task T-12-01 - ソースメタデータ引き継ぎによるフロントマター合成', () => {
        it('T-12-01-01: 出力フロントマターに project: ci-platform が含まれる', () => {
          const sourceMeta = { project: 'ci-platform', date: '2026-03-01' };
          const segmentMeta = { title: 'Fix CI', log_id: 'abc1234', summary: 'CI fix' };
          const content = '## Summary\nFix CI';

          const result = attachFrontmatter(content, sourceMeta, segmentMeta);

          assertEquals(result.includes('project: ci-platform'), true);
        });

        it('T-12-01-02: 出力フロントマターに title・log_id・summary が含まれる', () => {
          const sourceMeta = { project: 'ci-platform' };
          const segmentMeta = { title: 'Fix CI', log_id: 'abc1234', summary: 'CI fix' };
          const content = '## Summary\nFix CI';

          const result = attachFrontmatter(content, sourceMeta, segmentMeta);

          assertEquals(result.includes('title: Fix CI'), true);
          assertEquals(result.includes('log_id: abc1234'), true);
          assertEquals(result.includes('summary: CI fix'), true);
        });
      });
    });
  });

  /** エッジケース: sourceMeta が空の場合は AI 生成フィールドのみを含む */
  describe('Given: 空の sourceMeta と title・log_id・summary を含む segmentMeta', () => {
    /**
     * When: 空の sourceMeta を attachFrontmatter に渡す。
     */
    describe('When: attachFrontmatter(content, {}, segmentMeta) を呼び出す', () => {
      /**
       * Task T-12-02: ソースフロントマターなし。
       * sourceMeta が空の場合、AI 生成フィールドのみがフロントマターに含まれることを確認する。
       */
      describe('Then: Task T-12-02 - ソースフロントマターなし', () => {
        it('T-12-02-01: 出力フロントマターが AI 生成フィールド（title・log_id・summary）のみを含む', () => {
          const sourceMeta = {};
          const segmentMeta = { title: 'Topic', log_id: 'aaabbbb', summary: 'Summary' };
          const content = '## Summary\nTopic content';

          const result = attachFrontmatter(content, sourceMeta, segmentMeta);

          assertEquals(result.includes('title: Topic'), true);
          assertEquals(result.includes('log_id: aaabbbb'), true);
          assertEquals(result.includes('summary: Summary'), true);
          assertEquals(result.includes('project:'), false);
        });
      });
    });
  });

  /** 正常系: 出力が `---` デリミタで囲まれた有効な Markdown フロントマターになる */
  describe('Given: 任意の sourceMeta と segmentMeta', () => {
    /**
     * When: 任意の meta を attachFrontmatter に渡す。
     */
    describe('When: attachFrontmatter(content, sourceMeta, segmentMeta) を呼び出す', () => {
      /**
       * Task T-12-03: フロントマターデリミタ。
       * 出力が `---\n` で始まり、コンテンツが重複なく付加されることを確認する。
       */
      describe('Then: Task T-12-03 - フロントマターデリミタ', () => {
        it('T-12-03-01: 出力が `---\\n` で始まりフロントマターブロックが `\\n---\\n` で終わる', () => {
          const sourceMeta = { project: 'test' };
          const segmentMeta = { title: 'T', log_id: 'x', summary: 'S' };
          const content = '## Summary\ntext';

          const result = attachFrontmatter(content, sourceMeta, segmentMeta);

          assertEquals(result.startsWith('---\n'), true);
          assertEquals(result.includes('\n---\n'), true);
        });

        it('T-12-03-02: コンテンツボディがフロントマターブロックの後に重複なく続く', () => {
          const sourceMeta = {};
          const segmentMeta = { title: 'T', log_id: 'x', summary: 'S' };
          const content = '## Summary\ntext';

          const result = attachFrontmatter(content, sourceMeta, segmentMeta);

          const contentOccurrences = result.split('## Summary\ntext').length - 1;
          assertEquals(contentOccurrences, 1);
        });
      });
    });
  });
});

/**
 * writeOutput のユニットテスト。
 * アトミックなファイル書き込み、既存ファイルのスキップ、ドライランモードを検証する。
 */
describe('writeOutput', () => {
  /** 正常系: 存在しない出力パスにアトミックにファイルを書き込む */
  describe('Given: 存在しない出力パスと dryRun=false', () => {
    let tmpDir: string;
    let stats: Stats;
    const content = '---\ntitle: test\n---\n## Summary\nbody';

    beforeEach(async () => {
      tmpDir = await Deno.makeTempDir();
      stats = { success: 0, skip: 0, fail: 0 };
    });

    afterEach(async () => {
      await Deno.remove(tmpDir, { recursive: true });
    });

    describe('When: writeOutput を呼び出す', () => {
      describe('Then: Task T-13-01 - アトミックなファイル書き込み', () => {
        it('T-13-01-01: ファイルが作成され stats.success がインクリメントされる', async () => {
          const outputPath = `${tmpDir}/entry.md`;

          await writeOutput(outputPath, content, false, stats);

          const written = await Deno.readTextFile(outputPath);
          assertEquals(written, content);
          assertEquals(stats.success, 1);
        });

        it('T-13-01-02: .tmp ファイルが最終的に存在せず出力ファイルが作成される', async () => {
          const outputPath = `${tmpDir}/entry.md`;
          const tmpPath = outputPath + '.tmp';

          await writeOutput(outputPath, content, false, stats);

          // Final output file must exist
          const written = await Deno.readTextFile(outputPath);
          assertEquals(written, content);
          // .tmp file must not remain
          let tmpExists = false;
          try {
            await Deno.stat(tmpPath);
            tmpExists = true;
          } catch {
            tmpExists = false;
          }
          assertEquals(tmpExists, false);
          assertEquals(stats.success, 1);
        });
      });
    });
  });

  /** エッジケース: すでに存在するファイルはスキップされる */
  describe('Given: すでに存在する出力パス', () => {
    let tmpDir: string;
    let stats: Stats;

    beforeEach(async () => {
      tmpDir = await Deno.makeTempDir();
      stats = { success: 0, skip: 0, fail: 0 };
      await Deno.writeTextFile(`${tmpDir}/existing.md`, 'existing content');
    });

    afterEach(async () => {
      await Deno.remove(tmpDir, { recursive: true });
    });

    describe('When: writeOutput を呼び出す', () => {
      describe('Then: Task T-13-02 - 既存出力のスキップ (R-011)', () => {
        it('T-13-02-01: stats.skip がインクリメントされ既存ファイルが上書きされない', async () => {
          const outputPath = `${tmpDir}/existing.md`;

          await writeOutput(outputPath, 'new content', false, stats);

          const fileContent = await Deno.readTextFile(outputPath);
          assertEquals(fileContent, 'existing content');
          assertEquals(stats.skip, 1);
          assertEquals(stats.success, 0);
        });
      });
    });
  });

  /** 正常系: dryRun=true のときファイルを作成しない */
  describe('Given: dryRun=true と存在しない出力パス', () => {
    let tmpDir: string;
    let stats: Stats;

    beforeEach(async () => {
      tmpDir = await Deno.makeTempDir();
      stats = { success: 0, skip: 0, fail: 0 };
    });

    afterEach(async () => {
      await Deno.remove(tmpDir, { recursive: true });
    });

    describe('When: writeOutput を呼び出す', () => {
      describe('Then: Task T-13-03 - ドライランモード', () => {
        it('T-13-03-01: ファイルが作成されない', async () => {
          const dryPath = `${tmpDir}/dry.md`;

          await writeOutput(dryPath, '## Summary\nbody', true, stats);

          let fileExists = false;
          try {
            Deno.statSync(dryPath);
            fileExists = true;
          } catch {
            fileExists = false;
          }
          assertEquals(fileExists, false);
          assertEquals(stats.success, 0);
        });
      });
    });
  });

  /** 異常系: R-010 ガード — temp/chatlog/ 配下への書き込みはエラーをスローする */
  describe('[異常] Error Cases', () => {
    describe('Given: temp/chatlog/ 配下の入力パスを出力先に指定する', () => {
      describe('When: writeOutput(inputPath, content, false, stats) を呼び出す', () => {
        describe('Then: Task T-13-04 - R-010 ガードによるエラー', () => {
          it('T-13-04-01: temp/chatlog/ 配下のパスへの書き込みが行われない (R-010)', async () => {
            const stats: Stats = { success: 0, skip: 0, fail: 0 };
            const inputPath = 'temp/chatlog/claude/2026/2026-03/sample.md';

            await assertRejects(
              async () => {
                await writeOutput(inputPath, 'overwrite', false, stats);
              },
              Error,
              'R-010',
            );
          });
        });
      });
    });
  });
});

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
