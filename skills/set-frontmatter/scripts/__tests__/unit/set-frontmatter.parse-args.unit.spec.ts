// src: scripts/__tests__/unit/set-frontmatter.parse-args.unit.spec.ts
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
import { DEFAULT_CONCURRENCY, parseArgs } from '../../set-frontmatter.ts';

// ─── デフォルト値の確認 ───────────────────────────────────────────────────────

describe('parseArgs', () => {
  describe('Given: 最小引数 ["/path/to/dir"]', () => {
    describe('When: parseArgs(["/path/to/dir"]) を呼び出す', () => {
      describe('Then: T-SF-PA-01 - デフォルト値が適用される', () => {
        it('T-SF-PA-01-01: targetDir が "/path/to/dir" になる', () => {
          const result = parseArgs(['/path/to/dir']);

          assertEquals(result.targetDir, '/path/to/dir');
        });

        it('T-SF-PA-01-02: dicsDir が "./assets/dics" になる', () => {
          const result = parseArgs(['/path/to/dir']);

          assertEquals(result.dicsDir, './assets/dics');
        });

        it('T-SF-PA-01-03: dryRun が false になる', () => {
          const result = parseArgs(['/path/to/dir']);

          assertEquals(result.dryRun, false);
        });

        it('T-SF-PA-01-04: review が true になる', () => {
          const result = parseArgs(['/path/to/dir']);

          assertEquals(result.review, true);
        });

        it('T-SF-PA-01-05: concurrency が DEFAULT_CONCURRENCY になる', () => {
          const result = parseArgs(['/path/to/dir']);

          assertEquals(result.concurrency, DEFAULT_CONCURRENCY);
        });
      });
    });
  });

  // ─── --dry-run フラグの解析 ───────────────────────────────────────────────

  describe('Given: ["/path", "--dry-run"] を渡す', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-02 - dryRun=true', () => {
        it('T-SF-PA-02-01: dryRun が true になる', () => {
          const result = parseArgs(['/path', '--dry-run']);

          assertEquals(result.dryRun, true);
        });
      });
    });
  });

  // ─── --no-review フラグの解析 ─────────────────────────────────────────────

  describe('Given: ["/path", "--no-review"] を渡す', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-03 - review=false', () => {
        it('T-SF-PA-03-01: review が false になる', () => {
          const result = parseArgs(['/path', '--no-review']);

          assertEquals(result.review, false);
        });
      });
    });
  });

  // ─── --dics オプション（スペース区切り）の解析 ───────────────────────────

  describe('Given: ["/path", "--dics", "/dics"] を渡す', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-04 - dicsDir=/dics', () => {
        it('T-SF-PA-04-01: dicsDir が "/dics" になる', () => {
          const result = parseArgs(['/path', '--dics', '/dics']);

          assertEquals(result.dicsDir, '/dics');
        });
      });
    });
  });

  // ─── --dics=value 形式の解析 ─────────────────────────────────────────────

  describe('Given: ["/path", "--dics=/dics"] を渡す', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-05 - --dics=value 形式のパース', () => {
        it('T-SF-PA-05-01: dicsDir が "/dics" になる', () => {
          const result = parseArgs(['/path', '--dics=/dics']);

          assertEquals(result.dicsDir, '/dics');
        });
      });
    });
  });

  // ─── --concurrency オプション（スペース区切り）の解析 ────────────────────

  describe('Given: ["/path", "--concurrency", "8"] を渡す', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-06 - concurrency=8', () => {
        it('T-SF-PA-06-01: concurrency が 8 になる', () => {
          const result = parseArgs(['/path', '--concurrency', '8']);

          assertEquals(result.concurrency, 8);
        });
      });
    });
  });

  // ─── --concurrency=value 形式の解析 ──────────────────────────────────────

  describe('Given: ["/path", "--concurrency=8"] を渡す', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-07 - --concurrency=value 形式のパース', () => {
        it('T-SF-PA-07-01: concurrency が 8 になる', () => {
          const result = parseArgs(['/path', '--concurrency=8']);

          assertEquals(result.concurrency, 8);
        });
      });
    });
  });

  // ─── --concurrency に無効値を渡した場合のフォールバック ──────────────────

  describe('Given: ["/path", "--concurrency=invalid"] を渡す', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-08 - 無効値 → デフォルトにフォールバック', () => {
        it('T-SF-PA-08-01: concurrency が DEFAULT_CONCURRENCY になる', () => {
          const result = parseArgs(['/path', '--concurrency=invalid']);

          assertEquals(result.concurrency, DEFAULT_CONCURRENCY);
        });
      });
    });
  });

  // ─── 複数オプションの組み合わせ ──────────────────────────────────────────

  describe('Given: 全オプションを組み合わせた引数', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-09 - 複数オプション組み合わせ', () => {
        it('T-SF-PA-09-01: 全フィールドが正しく解析される', () => {
          const result = parseArgs([
            '/path/to/dir',
            '--dry-run',
            '--no-review',
            '--dics',
            '/dics',
            '--concurrency',
            '2',
          ]);

          assertEquals(result.targetDir, '/path/to/dir');
          assertEquals(result.dryRun, true);
          assertEquals(result.review, false);
          assertEquals(result.dicsDir, '/dics');
          assertEquals(result.concurrency, 2);
        });
      });
    });
  });

  // ─── targetDir なし（空配列）で Deno.exit(1) が呼ばれる ──────────────────

  describe('Given: 空配列 []', () => {
    describe('When: parseArgs([]) を呼び出す', () => {
      describe('Then: T-SF-PA-10 - targetDir なし → Deno.exit(1)', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-SF-PA-10-01: Deno.exit(1) がちょうど1回呼ばれる', () => {
          parseArgs([]);

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  // ─── 未知のオプションで Deno.exit(1) が呼ばれる ──────────────────────────

  describe('Given: 未知のオプション ["/path", "--unknown"]', () => {
    describe('When: parseArgs を呼び出す', () => {
      describe('Then: T-SF-PA-11 - 未知オプション → Deno.exit(1)', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        beforeEach(() => {
          exitStub = stub(Deno, 'exit');
        });
        afterEach(() => {
          exitStub.restore();
        });

        it('T-SF-PA-11-01: Deno.exit(1) がちょうど1回呼ばれる', () => {
          parseArgs(['/path', '--unknown']);

          assertEquals(exitStub.calls.length, 1);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });
});
