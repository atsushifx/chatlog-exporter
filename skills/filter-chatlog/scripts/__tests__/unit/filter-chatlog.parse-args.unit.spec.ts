// src: scripts/__tests__/unit/filter-chatlog.parseArgs.unit.spec.ts
// @(#): parseArgs のユニットテスト
//       CLI 引数解析: デフォルト値・各オプション・エラー終了
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import { parseArgs } from '../../../../filter-chatlog/scripts/filter-chatlog.ts';

// ─── T-FL-PA-01: デフォルト値 ─────────────────────────────────────────────────

describe('parseArgs', () => {
  describe('Given: 引数なしの空配列', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: T-FL-PA-01 - デフォルト値が適用される', () => {
        it('T-FL-PA-01-01: agent が "claude" になる', () => {
          const result = parseArgs([]);

          assertEquals(result.agent, 'claude');
        });

        it('T-FL-PA-01-02: dryRun が false になる', () => {
          const result = parseArgs([]);

          assertEquals(result.dryRun, false);
        });

        it('T-FL-PA-01-03: inputDir が "./temp/chatlog" になる', () => {
          const result = parseArgs([]);

          assertEquals(result.inputDir, './temp/chatlog');
        });

        it('T-FL-PA-01-04: period が undefined になる', () => {
          const result = parseArgs([]);

          assertEquals(result.period, undefined);
        });

        it('T-FL-PA-01-05: project が undefined になる', () => {
          const result = parseArgs([]);

          assertEquals(result.project, undefined);
        });
      });
    });
  });

  // ─── T-FL-PA-02: agent 引数 ──────────────────────────────────────────────────

  describe('Given: ["chatgpt"] を渡す', () => {
    describe('When: parseArgs(["chatgpt"]) を呼び出す', () => {
      describe('Then: T-FL-PA-02 - agent=chatgpt', () => {
        it('T-FL-PA-02-01: agent が "chatgpt" になる', () => {
          const result = parseArgs(['chatgpt']);

          assertEquals(result.agent, 'chatgpt');
        });
      });
    });
  });

  // ─── T-FL-PA-03: period の解析 ───────────────────────────────────────────────

  describe('Given: ["2026-03"] を渡す', () => {
    describe('When: parseArgs(["2026-03"]) を呼び出す', () => {
      describe('Then: T-FL-PA-03 - period=2026-03', () => {
        it('T-FL-PA-03-01: period が "2026-03" になる', () => {
          const result = parseArgs(['2026-03']);

          assertEquals(result.period, '2026-03');
        });
      });
    });
  });

  // ─── T-FL-PA-04: project の解析 ──────────────────────────────────────────────

  describe('Given: ["2026-03", "my-project"] を渡す', () => {
    describe('When: parseArgs(["2026-03", "my-project"]) を呼び出す', () => {
      describe('Then: T-FL-PA-04 - project=my-project', () => {
        it('T-FL-PA-04-01: project が "my-project" になる', () => {
          const result = parseArgs(['2026-03', 'my-project']);

          assertEquals(result.project, 'my-project');
        });

        it('T-FL-PA-04-02: period が "2026-03" になる', () => {
          const result = parseArgs(['2026-03', 'my-project']);

          assertEquals(result.period, '2026-03');
        });
      });
    });
  });

  // ─── T-FL-PA-05: --dry-run フラグ ────────────────────────────────────────────

  describe('Given: ["--dry-run"] を渡す', () => {
    describe('When: parseArgs(["--dry-run"]) を呼び出す', () => {
      describe('Then: T-FL-PA-05 - dryRun=true', () => {
        it('T-FL-PA-05-01: dryRun が true になる', () => {
          const result = parseArgs(['--dry-run']);

          assertEquals(result.dryRun, true);
        });
      });
    });
  });

  // ─── T-FL-PA-06: --input <path> オプション ───────────────────────────────────

  describe('Given: ["--input", "/path/to/input"] を渡す', () => {
    describe('When: parseArgs(["--input", "/path/to/input"]) を呼び出す', () => {
      describe('Then: T-FL-PA-06 - inputDir=/path/to/input', () => {
        it('T-FL-PA-06-01: inputDir が "/path/to/input" になる', () => {
          const result = parseArgs(['--input', '/path/to/input']);

          assertEquals(result.inputDir, '/path/to/input');
        });
      });
    });
  });

  // ─── T-FL-PA-07: --input=value 形式 ──────────────────────────────────────────

  describe('Given: ["--input=/path/to/input"] を渡す', () => {
    describe('When: parseArgs(["--input=/path/to/input"]) を呼び出す', () => {
      describe('Then: T-FL-PA-07 - --input=value 形式のパース', () => {
        it('T-FL-PA-07-01: inputDir が "/path/to/input" になる', () => {
          const result = parseArgs(['--input=/path/to/input']);

          assertEquals(result.inputDir, '/path/to/input');
        });
      });
    });
  });

  // ─── T-FL-PA-08: 複数オプション組み合わせ ────────────────────────────────────

  describe('Given: claude 2026-03 my-proj --dry-run --input ./in を渡す', () => {
    describe('When: parseArgs(args) を呼び出す', () => {
      describe('Then: T-FL-PA-08 - 複数オプション組み合わせ', () => {
        it('T-FL-PA-08-01: 全フィールドが正しく解析される', () => {
          const result = parseArgs([
            'claude',
            '2026-03',
            'my-proj',
            '--dry-run',
            '--input',
            './in',
          ]);

          assertEquals(result.agent, 'claude');
          assertEquals(result.period, '2026-03');
          assertEquals(result.project, 'my-proj');
          assertEquals(result.dryRun, true);
          assertEquals(result.inputDir, './in');
        });
      });
    });
  });

  // ─── T-FL-PA-09: 未知オプションで Deno.exit(1) が呼ばれる ───────────────────

  describe('Given: 未知のオプション ["--unknown"]', () => {
    describe('When: parseArgs(["--unknown"]) を呼び出す', () => {
      describe('Then: T-FL-PA-09 - 未知オプション → Deno.exit(1)', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-FL-PA-09-01: Deno.exit(1) がちょうど1回呼ばれる', () => {
          parseArgs(['--unknown']);

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });
});
