#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/unit/normalize-chatlog.unit.spec.ts
// @(#): 純粋関数・副作用なし関数のユニットテスト
//       対象: withConcurrency, cleanYaml, parseFrontmatter, generateLogId,
//             parseArgs, parseJsonArray, generateSegmentFile, attachFrontmatter, reportResults
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words aaabbbb

// Deno Test module
import { assertEquals, assertMatch, assertNotEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import {
  attachFrontmatter,
  cleanYaml,
  generateLogId,
  generateSegmentFile,
  parseArgs,
  parseFrontmatter,
  parseJsonArray,
  reportResults,
  withConcurrency,
} from '../../normalize-chatlog.ts';
import type { Stats } from '../../normalize-chatlog.ts';

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
    describe('When: cleanYaml(raw, "title") を呼び出す', () => {
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
    describe('When: cleanYaml("", "title") を呼び出す', () => {
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
    describe('When: parseFrontmatter(text) を呼び出す', () => {
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
    describe('When: parseFrontmatter(text) を呼び出す', () => {
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
    describe('When: parseFrontmatter(text) を呼び出す', () => {
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
    describe('When: generateLogId(filePath, agentName, title, index) を呼び出す', () => {
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
    describe('When: index=0 と index=1 でそれぞれ generateLogId を呼び出す', () => {
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

// ─── parseArgs tests ──────────────────────────────────────────────────────────

/**
 * parseArgs のユニットテスト。
 * CLI 引数配列を解析して { dir, agent, yearMonth, dryRun, concurrency, output } を返す関数の
 * 正常系・デフォルト値・エラー終了・パス正規化を検証する。
 */
describe('parseArgs', () => {
  /** 正常系: --dir・--agent・--year-month・--dry-run・--concurrency・--output を正しくパースする */
  describe('Given: --dir オプションを含む引数配列', () => {
    describe('When: parseArgs(["--dir", "/some/path"]) を呼び出す', () => {
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
    describe('When: parseArgs(["--agent","claude","--year-month","2026-03","--dry-run","--concurrency","8","--output","./out"]) を呼び出す', () => {
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
    describe('When: parseArgs([]) を呼び出す', () => {
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
    describe('When: parseArgs(["--unknown"]) を呼び出す', () => {
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
    describe('When: parseArgs(["--dir", "temp\\\\chatlog\\\\claude"]) を呼び出す', () => {
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-01: --dir 値のバックスラッシュがスラッシュに正規化される', () => {
          const result = parseArgs(['--dir', 'temp\\chatlog\\claude']);

          assertEquals(result.dir, 'temp/chatlog/claude');
        });
      });
    });

    describe('When: parseArgs(["temp/chatlog/claude/2026/2026-03"]) を呼び出す', () => {
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-02: / を含む位置引数が args.dir に設定される', () => {
          const result = parseArgs(['temp/chatlog/claude/2026/2026-03']);

          assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
        });
      });
    });

    describe('When: parseArgs(["temp\\\\chatlog\\\\claude\\\\2026\\\\2026-03"]) を呼び出す', () => {
      describe('Then: Task T-08-04 - パス正規化と自動 --dir 判定', () => {
        it('T-08-04-03: \\ を含む位置引数がスラッシュ正規化されて args.dir に設定される', () => {
          const result = parseArgs(['temp\\chatlog\\claude\\2026\\2026-03']);

          assertEquals(result.dir, 'temp/chatlog/claude/2026/2026-03');
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
    describe('When: parseJsonArray を呼び出す', () => {
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
    describe('When: parseJsonArray を呼び出す', () => {
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
    describe('When: parseJsonArray を呼び出す', () => {
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
    describe('When: parseJsonArray を呼び出す', () => {
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
  describe('Given: { title: "Fix CI pipeline", summary: "Fix CI pipeline", body: "### User\\nHow do I fix CI?" } を持つセグメントオブジェクト', () => {
    describe('When: generateSegmentFile を呼び出す', () => {
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
  describe('Given: { title: "Debug session", summary: "Debug session", body: "### User\\nHow do I..." } を持つセグメントオブジェクト', () => {
    describe('When: generateSegmentFile を呼び出す', () => {
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
    describe('When: generateSegmentFile を呼び出す', () => {
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
    describe('When: attachFrontmatter(content, sourceMeta, segmentMeta) を呼び出す', () => {
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
    describe('When: attachFrontmatter(content, {}, segmentMeta) を呼び出す', () => {
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
    describe('When: attachFrontmatter(content, sourceMeta, segmentMeta) を呼び出す', () => {
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
