// src: scripts/__tests__/unit/classify-chatlog.parseArgs.unit.spec.ts
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
import { parseArgs } from '../../classify-chatlog.ts';

// ─── デフォルト値の確認 ───────────────────────────────────────────────────────

describe('parseArgs', () => {
  describe('Given: 引数なしの空配列', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: T-CL-PA-01 - デフォルト値が適用される', () => {
        it('T-CL-PA-01-01: agent が "chatgpt" になる', () => {
          const result = parseArgs([]);

          assertEquals(result.agent, 'chatgpt');
        });

        it('T-CL-PA-01-02: dryRun が false になる', () => {
          const result = parseArgs([]);

          assertEquals(result.dryRun, false);
        });

        it('T-CL-PA-01-03: inputDir が "./temp/chatlog" になる', () => {
          const result = parseArgs([]);

          assertEquals(result.inputDir, './temp/chatlog');
        });

        it('T-CL-PA-01-04: dicsDir が "./assets/dics" になる', () => {
          const result = parseArgs([]);

          assertEquals(result.dicsDir, './assets/dics');
        });

        it('T-CL-PA-01-05: period が undefined になる', () => {
          const result = parseArgs([]);

          assertEquals(result.period, undefined);
        });
      });
    });
  });

  // ─── agent 引数の解析 ─────────────────────────────────────────────────────

  describe('Given: ["claude"] を渡す', () => {
    describe('When: parseArgs(["claude"]) を呼び出す', () => {
      describe('Then: T-CL-PA-02 - agent=claude', () => {
        it('T-CL-PA-02-01: agent が "claude" になる', () => {
          const result = parseArgs(['claude']);

          assertEquals(result.agent, 'claude');
        });
      });
    });
  });

  // ─── period の解析 ────────────────────────────────────────────────────────

  describe('Given: ["2026-03"] を渡す', () => {
    describe('When: parseArgs(["2026-03"]) を呼び出す', () => {
      describe('Then: T-CL-PA-03 - period=2026-03', () => {
        it('T-CL-PA-03-01: period が "2026-03" になる', () => {
          const result = parseArgs(['2026-03']);

          assertEquals(result.period, '2026-03');
        });
      });
    });
  });

  // ─── --dry-run フラグの解析 ───────────────────────────────────────────────

  describe('Given: ["--dry-run"] を渡す', () => {
    describe('When: parseArgs(["--dry-run"]) を呼び出す', () => {
      describe('Then: T-CL-PA-04 - dryRun=true', () => {
        it('T-CL-PA-04-01: dryRun が true になる', () => {
          const result = parseArgs(['--dry-run']);

          assertEquals(result.dryRun, true);
        });
      });
    });
  });

  // ─── --input オプション（スペース区切り）の解析 ───────────────────────────

  describe('Given: ["--input", "/path/to/input"] を渡す', () => {
    describe('When: parseArgs(["--input", "/path/to/input"]) を呼び出す', () => {
      describe('Then: T-CL-PA-05 - inputDir=/path/to/input', () => {
        it('T-CL-PA-05-01: inputDir が "/path/to/input" になる', () => {
          const result = parseArgs(['--input', '/path/to/input']);

          assertEquals(result.inputDir, '/path/to/input');
        });
      });
    });
  });

  // ─── --input=value 形式の解析 ─────────────────────────────────────────────

  describe('Given: ["--input=/path/to/input"] を渡す', () => {
    describe('When: parseArgs(["--input=/path/to/input"]) を呼び出す', () => {
      describe('Then: T-CL-PA-06 - --input=value 形式のパース', () => {
        it('T-CL-PA-06-01: inputDir が "/path/to/input" になる', () => {
          const result = parseArgs(['--input=/path/to/input']);

          assertEquals(result.inputDir, '/path/to/input');
        });
      });
    });
  });

  // ─── --dics オプションの解析 ──────────────────────────────────────────────

  describe('Given: ["--dics", "/path/to/dics"] を渡す', () => {
    describe('When: parseArgs(["--dics", "/path/to/dics"]) を呼び出す', () => {
      describe('Then: T-CL-PA-07 - dicsDir=/path/to/dics', () => {
        it('T-CL-PA-07-01: dicsDir が "/path/to/dics" になる', () => {
          const result = parseArgs(['--dics', '/path/to/dics']);

          assertEquals(result.dicsDir, '/path/to/dics');
        });
      });
    });
  });

  // ─── 複数オプションの組み合わせ ──────────────────────────────────────────

  describe('Given: claude 2026-03 --dry-run --input ./in --dics ./dics を渡す', () => {
    describe('When: parseArgs(args) を呼び出す', () => {
      describe('Then: T-CL-PA-08 - 複数オプション組み合わせ', () => {
        it('T-CL-PA-08-01: 全フィールドが正しく解析される', () => {
          const result = parseArgs([
            'claude',
            '2026-03',
            '--dry-run',
            '--input',
            './in',
            '--dics',
            './dics',
          ]);

          assertEquals(result.agent, 'claude');
          assertEquals(result.period, '2026-03');
          assertEquals(result.dryRun, true);
          assertEquals(result.inputDir, './in');
          assertEquals(result.dicsDir, './dics');
        });
      });
    });
  });

  // ─── 未知のオプションで Deno.exit(1) が呼ばれる ──────────────────────────

  describe('Given: 未知のオプション ["--unknown"]', () => {
    describe('When: parseArgs(["--unknown"]) を呼び出す', () => {
      describe('Then: T-CL-PA-09 - 未知オプション → Deno.exit(1)', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-CL-PA-09-01: Deno.exit(1) がちょうど1回呼ばれる', () => {
          parseArgs(['--unknown']);

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  // ─── 未知の位置引数で Deno.exit(1) が呼ばれる ────────────────────────────

  describe('Given: 未知の位置引数 ["invalid-arg"]', () => {
    describe('When: parseArgs(["invalid-arg"]) を呼び出す', () => {
      describe('Then: T-CL-PA-10 - 未知の位置引数 → Deno.exit(1)', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-CL-PA-10-01: Deno.exit(1) がちょうど1回呼ばれる', () => {
          parseArgs(['invalid-arg']);

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });
});
