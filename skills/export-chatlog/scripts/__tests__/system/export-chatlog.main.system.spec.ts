// src: scripts/__tests__/system/export-chatlog.main.system.spec.ts
// @(#): export-chatlog main() のシステムテスト（実プロセス起動による終了コード検証）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

const SCRIPT_PATH = new URL('../../export-chatlog.ts', import.meta.url).pathname;

async function runExport(args: string[]): Promise<number> {
  const _cmd = new Deno.Command(Deno.execPath(), {
    args: ['run', '--allow-read', '--allow-write', '--allow-run', SCRIPT_PATH, ...args],
    stdout: 'null',
    stderr: 'null',
  });
  const { code } = await _cmd.output();
  return code;
}

// ─── T-EC-SYS-01: 不明なオプション → exit(1) ─────────────────────────────────

describe('main - エラー終了コード', () => {
  describe('Given: 不明なオプション "--unknown-flag" を指定', () => {
    describe('When: export-chatlog をサブプロセスで実行する', () => {
      describe('Then: T-EC-SYS-01 - プロセスが終了コード 1 で終了する', () => {
        it('T-EC-SYS-01-01: 終了コードが 1 である', async () => {
          const code = await runExport(['claude', '--unknown-flag']);
          assertEquals(code, 1);
        });
      });
    });
  });
});
