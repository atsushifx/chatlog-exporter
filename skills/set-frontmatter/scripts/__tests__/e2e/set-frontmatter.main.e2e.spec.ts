// src: scripts/__tests__/e2e/set-frontmatter.main.e2e.spec.ts
// @(#): main() の E2E テスト
//       main() 経由でのフロントマター付加フロー（Deno.Command モック・実 tempdir）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

// test target
import { main } from '../../set-frontmatter.ts';

// helpers
import type { CommandMockHandle } from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import {
  installCommandMock,
  makeSuccessMock,
} from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import type { LoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';
import { makeLoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';

// ─── テスト用一時ディレクトリセットアップ ─────────────────────────────────────

const _enc = new TextEncoder();

/**
 * dics + prompts ディレクトリを作成し、最低限のファイルを配置する。
 * loadDics は dicsDir の末尾 "dics" を "prompts" に置換して promptsDir を決定するため、
 * baseDir/dics の形式でディレクトリを作成する。
 */
async function _makeDicsDir(): Promise<string> {
  const baseDir = await Deno.makeTempDir();
  const dicsDir = `${baseDir}/dics`;
  const promptsDir = `${baseDir}/prompts`;
  await Deno.mkdir(dicsDir, { recursive: true });
  await Deno.mkdir(promptsDir, { recursive: true });

  // 辞書ファイル（最低限の内容）
  await Deno.writeTextFile(
    `${dicsDir}/types.dic`,
    'research:\n  def: 調査\n  desc: 調査\n  rules:\n    when: []\n    not: []\n',
  );
  await Deno.writeTextFile(
    `${dicsDir}/category.dic`,
    'development:\n  def: 開発\n  desc: 開発\n  rules:\n    when: []\n    not: []\n',
  );
  await Deno.writeTextFile(
    `${dicsDir}/topics.dic`,
    'development:\n  def: 開発\n  desc: 開発\n  rules:\n    when: []\n    not: []\n',
  );
  await Deno.writeTextFile(`${dicsDir}/tags.dic`, '"lang:typescript":\n  def: TypeScript\n');

  // プロンプトファイル
  await Deno.writeTextFile(`${promptsDir}/type.yaml`, 'system: "type"\nuser: "${type_list} ${body}"\n');
  await Deno.writeTextFile(
    `${promptsDir}/category.yaml`,
    'system: "category"\nuser: "${category_list} ${focus_guide} ${body}"\n',
  );
  await Deno.writeTextFile(
    `${promptsDir}/meta.yaml`,
    'system: "meta"\nuser: "${log_type} ${log_category} ${topic_list} ${tags_list} ${body}"\n',
  );
  await Deno.writeTextFile(
    `${promptsDir}/review.yaml`,
    'system: "review"\nuser: "${type_list} ${topic_list} ${category_list} ${tags_list} ${result_type} ${result_category} ${result_yaml}"\n',
  );

  return dicsDir;
}

/** .md ファイルを持つ targetDir を作成する */
async function _makeTargetDir(content?: string): Promise<string> {
  const targetDir = await Deno.makeTempDir();
  const mdContent = content ?? '# テスト\n本文テキスト';
  await Deno.writeTextFile(`${targetDir}/test.md`, mdContent);
  return targetDir;
}

// ─── T-SF-E2E-01: dry-run → ファイル変更なし ─────────────────────────────────

describe('main - dry-run モード', () => {
  describe('Given: 1件の .md ファイルと dry-run フラグ', () => {
    describe('When: main([dir, "--dry-run", "--dics", dicsDir]) を呼び出す', () => {
      describe('Then: T-SF-E2E-01 - ファイルが変更されない', () => {
        let targetDir: string;
        let dicsDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          targetDir = await _makeTargetDir();
          dicsDir = await _makeDicsDir();

          // 各フェーズの応答を順番に返す（全呼び出しで成功）
          const callIdx = 0;
          const phaseResponses = [
            'research',
            'development',
            'title: テスト\nsummary: 概要',
            'validity: pass',
          ];
          commandHandle = installCommandMock(
            makeSuccessMock(_enc.encode(phaseResponses.join('\n')), { value: [] }),
          );
          void callIdx;

          loggerStub = makeLoggerStub();
        });

        afterEach(async () => {
          commandHandle.restore();
          loggerStub.restore();
          await Deno.remove(targetDir, { recursive: true }).catch(() => {});
          // dicsDir は baseDir/dics なので親ディレクトリを削除
          await Deno.remove(dicsDir.replace(/[/\\]dics$/, ''), { recursive: true }).catch(() => {});
        });

        it('T-SF-E2E-01-01: ファイルの内容が変更されない', async () => {
          const originalContent = await Deno.readTextFile(`${targetDir}/test.md`);

          await main([targetDir, '--dry-run', '--no-review', '--dics', dicsDir]);

          const updatedContent = await Deno.readTextFile(`${targetDir}/test.md`);
          assertEquals(updatedContent, originalContent);
        });

        it('T-SF-E2E-01-02: "DRY RUN" がログに出力される', async () => {
          await main([targetDir, '--dry-run', '--no-review', '--dics', dicsDir]);

          assertEquals(loggerStub.logLogs.some((l) => l.includes('DRY RUN')), true);
        });
      });
    });
  });
});

// ─── T-SF-E2E-02: --no-review → Phase 3.5 スキップ ───────────────────────────

describe('main - --no-review モード', () => {
  describe('Given: 1件の .md ファイルと --no-review フラグ', () => {
    describe('When: main([dir, "--no-review", "--dics", dicsDir]) を呼び出す', () => {
      describe('Then: T-SF-E2E-02 - Phase 3.5 スキップのログが出力される', () => {
        let targetDir: string;
        let dicsDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          targetDir = await _makeTargetDir();
          dicsDir = await _makeDicsDir();
          commandHandle = installCommandMock(
            makeSuccessMock(_enc.encode('research')),
          );
          loggerStub = makeLoggerStub();
        });

        afterEach(async () => {
          commandHandle.restore();
          loggerStub.restore();
          await Deno.remove(targetDir, { recursive: true }).catch(() => {});
          // dicsDir は baseDir/dics なので親ディレクトリを削除
          await Deno.remove(dicsDir.replace(/[/\\]dics$/, ''), { recursive: true }).catch(() => {});
        });

        it('T-SF-E2E-02-01: "--no-review" または "スキップ" がログに含まれる', async () => {
          await main([targetDir, '--dry-run', '--no-review', '--dics', dicsDir]);

          assertEquals(
            loggerStub.infoLogs.some((l) =>
              l.includes('no-review') || l.includes('スキップ') || l.includes('Phase 3.5')
            ),
            true,
          );
        });
      });
    });
  });
});

// ─── T-SF-E2E-03: 存在しない targetDir → Deno.exit(1) ────────────────────────

describe('main - 存在しない targetDir', () => {
  describe('Given: 存在しないディレクトリパス', () => {
    describe('When: main(["/nonexistent", "--dics", dicsDir]) を呼び出す', () => {
      describe('Then: T-SF-E2E-03 - Deno.exit(1) が呼ばれる', () => {
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        let loggerStub: LoggerStub;
        let dicsDir: string;

        beforeEach(async () => {
          dicsDir = await _makeDicsDir();
          exitStub = stub(Deno, 'exit');
          loggerStub = makeLoggerStub();
        });

        afterEach(async () => {
          exitStub.restore();
          loggerStub.restore();
          // dicsDir は baseDir/dics なので親ディレクトリを削除
          await Deno.remove(dicsDir.replace(/[/\\]dics$/, ''), { recursive: true }).catch(() => {});
        });

        it('T-SF-E2E-03-01: Deno.exit(1) が最初に呼ばれる', async () => {
          await main(['/nonexistent/path/does/not/exist', '--dics', dicsDir]);

          assertEquals(exitStub.calls.length >= 1, true);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });
});

// ─── T-SF-E2E-04: .md ファイルが0件 → Deno.exit(0) ──────────────────────────

describe('main - 対象ファイルなし', () => {
  describe('Given: .md ファイルが存在しない空ディレクトリ', () => {
    describe('When: main([emptyDir, "--dics", dicsDir]) を呼び出す', () => {
      describe('Then: T-SF-E2E-04 - Deno.exit(0) が呼ばれる', () => {
        let emptyDir: string;
        let dicsDir: string;
        let exitStub: Stub<typeof Deno, [code?: number], never>;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          emptyDir = await Deno.makeTempDir();
          dicsDir = await _makeDicsDir();
          exitStub = stub(Deno, 'exit');
          loggerStub = makeLoggerStub();
        });

        afterEach(async () => {
          exitStub.restore();
          loggerStub.restore();
          await Deno.remove(emptyDir, { recursive: true }).catch(() => {});
          // dicsDir は baseDir/dics なので親ディレクトリを削除
          await Deno.remove(dicsDir.replace(/[/\\]dics$/, ''), { recursive: true }).catch(() => {});
        });

        it('T-SF-E2E-04-01: Deno.exit(0) が呼ばれる', async () => {
          await main([emptyDir, '--dics', dicsDir]);

          assertEquals(exitStub.calls.length >= 1, true);
          assertEquals(exitStub.calls[0].args[0], 0);
        });
      });
    });
  });
});

// ─── T-SF-E2E-05: yaml 生成失敗 → stats.fail が出力される ───────────────────

describe('main - yaml 生成失敗', () => {
  describe('Given: Claude CLI がすべて成功するが yaml が空になるモック', () => {
    describe('When: main([dir, "--no-review", "--dics", dicsDir]) を呼び出す', () => {
      describe('Then: T-SF-E2E-05 - fail=1 のサマリーが出力される', () => {
        let targetDir: string;
        let dicsDir: string;
        let commandHandle: CommandMockHandle;
        let loggerStub: LoggerStub;

        beforeEach(async () => {
          targetDir = await _makeTargetDir();
          dicsDir = await _makeDicsDir();
          // 全フェーズで空文字を返す（title: なし → cleanYaml で空になる）
          commandHandle = installCommandMock(
            makeSuccessMock(_enc.encode('')),
          );
          loggerStub = makeLoggerStub();
        });

        afterEach(async () => {
          commandHandle.restore();
          loggerStub.restore();
          await Deno.remove(targetDir, { recursive: true }).catch(() => {});
          // dicsDir は baseDir/dics なので親ディレクトリを削除
          await Deno.remove(dicsDir.replace(/[/\\]dics$/, ''), { recursive: true }).catch(() => {});
        });

        it('T-SF-E2E-05-01: "fail=1" がサマリーに出力される', async () => {
          await main([targetDir, '--no-review', '--dics', dicsDir]);

          assertEquals(loggerStub.infoLogs.some((l) => l.includes('fail=1')), true);
        });
      });
    });
  });
});
