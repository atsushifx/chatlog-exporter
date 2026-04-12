// src: scripts/__tests__/e2e/export-chatlog.main.e2e.spec.ts
// @(#): export-chatlog main() の E2E テスト
//       main() 経由でのセッションエクスポートフロー（実ファイルシステム使用）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words sess

import { assertEquals, assertStringIncludes } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import type { Stub } from '@std/testing/mock';
import { stub } from '@std/testing/mock';

import { main } from '../../../../export-chatlog/scripts/export-chatlog.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

/** JSONL エントリを文字列化してファイルに書き込む */
async function _writeJsonl(filePath: string, lines: unknown[]): Promise<void> {
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  await Deno.writeTextFile(filePath, content);
}

/** Claude セッション JSONL のエントリを生成する */
function _claudeEntry(
  type: 'user' | 'assistant',
  sessionId: string,
  timestamp: string,
  text: string,
  cwd = '/home/user/projects/my-app',
): unknown {
  if (type === 'user') {
    return {
      type: 'user',
      isMeta: false,
      sessionId,
      timestamp,
      cwd,
      message: { id: `msg-u-${Date.now()}`, content: [{ type: 'text', text }] },
    };
  }
  return {
    type: 'assistant',
    isMeta: false,
    sessionId,
    timestamp,
    message: { id: `msg-a-${Date.now()}`, content: [{ type: 'text', text }] },
  };
}

/** Codex セッション JSONL のエントリを生成する */
function _codexEntry(
  type: 'session_meta' | 'response_item',
  timestamp: string,
  opts: Record<string, unknown> = {},
): unknown {
  if (type === 'session_meta') {
    return {
      timestamp,
      type: 'session_meta',
      payload: {
        id: opts.id ?? 'codex-e2e-sess-001',
        cwd: opts.cwd ?? '/home/user/projects/my-codex-app',
        model: 'o4-mini',
      },
    };
  }
  return {
    timestamp,
    type: 'response_item',
    payload: {
      role: opts.role ?? 'user',
      content: [{ type: opts.role === 'assistant' ? 'output_text' : 'input_text', text: opts.text ?? '' }],
    },
  };
}

// ─── E2E テスト ───────────────────────────────────────────────────────────────

describe('main (export-chatlog)', () => {
  let tempDir: string;
  let outputDir: string;
  let envStub: Stub<typeof Deno.env, [key: string], string | undefined>;
  let errStub: Stub;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
    outputDir = `${tempDir}/output`;
    // homeDir() を tempDir に向ける
    envStub = stub(Deno.env, 'get', (key: string) => {
      if (key === 'USERPROFILE' || key === 'HOME') { return tempDir; }
      return undefined;
    });
    // console.error を抑制
    errStub = stub(console, 'error', () => {});
  });

  afterEach(async () => {
    envStub.restore();
    errStub.restore();
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-EC-E2E-01: claude agent 正常実行 ─────────────────────────────────

  describe('Given: ~/.claude/projects/ に有効な claude セッションJSONL', () => {
    describe('When: main(["claude", "--output", outputDir]) を呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects/C--home-user-projects-my-app`;
        await Deno.mkdir(projectsDir, { recursive: true });
        await _writeJsonl(`${projectsDir}/session.jsonl`, [
          _claudeEntry('user', 'sess-e2e-0001', '2026-03-15T10:00:00.000Z', 'E2Eテストの質問です'),
          _claudeEntry('assistant', 'sess-e2e-0001', '2026-03-15T10:00:05.000Z', 'E2Eテストの回答です。'),
        ]);
      });

      describe('Then: T-EC-E2E-01 - ファイルが outputDir に生成される', () => {
        it('T-EC-E2E-01-01: outputDir に .md ファイルが生成される', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['claude', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.length >= 1, true);
        });

        it('T-EC-E2E-01-02: console.log に生成パスが出力される', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['claude', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.some((p) => p.endsWith('.md')), true);
        });
      });
    });
  });

  // ─── T-EC-E2E-02: codex agent 正常実行 ──────────────────────────────────

  describe('Given: ~/.codex/sessions/ に有効な codex セッションJSONL', () => {
    describe('When: main(["codex", "--output", outputDir]) を呼び出す', () => {
      beforeEach(async () => {
        const sessionsDir = `${tempDir}/.codex/sessions/2026/03/15`;
        await Deno.mkdir(sessionsDir, { recursive: true });
        await _writeJsonl(`${sessionsDir}/codex-session.jsonl`, [
          _codexEntry('session_meta', '2026-03-15T11:00:00.000Z', {
            id: 'codex-e2e-001',
            cwd: '/home/user/projects/my-codex-app',
          }),
          _codexEntry('response_item', '2026-03-15T11:00:01.000Z', {
            role: 'user',
            text: 'Codex E2Eテストの質問です',
          }),
          _codexEntry('response_item', '2026-03-15T11:00:10.000Z', {
            role: 'assistant',
            text: 'Codex E2Eテストの回答です。',
          }),
        ]);
      });

      describe('Then: T-EC-E2E-02 - ファイルが outputDir に生成される', () => {
        it('T-EC-E2E-02-01: outputDir に .md ファイルが生成される', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['codex', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.some((p) => p.endsWith('.md')), true);
        });
      });
    });
  });

  // ─── T-EC-E2E-03: 期間フィルタ ───────────────────────────────────────────

  describe('Given: 範囲内と範囲外のJSONLが混在', () => {
    beforeEach(async () => {
      const projectsDir = `${tempDir}/.claude/projects/C--home-user-projects-filter-app`;
      await Deno.mkdir(projectsDir, { recursive: true });
      // 範囲内: 2026-03
      await _writeJsonl(`${projectsDir}/march.jsonl`, [
        _claudeEntry(
          'user',
          'sess-march',
          '2026-03-15T10:00:00.000Z',
          '3月の質問',
          '/home/user/projects/filter-app',
        ),
        _claudeEntry('assistant', 'sess-march', '2026-03-15T10:00:05.000Z', '3月の回答'),
      ]);
      // 範囲外: 2026-02
      await _writeJsonl(`${projectsDir}/feb.jsonl`, [
        _claudeEntry(
          'user',
          'sess-feb',
          '2026-02-15T10:00:00.000Z',
          '2月の質問',
          '/home/user/projects/filter-app',
        ),
        _claudeEntry('assistant', 'sess-feb', '2026-02-15T10:00:05.000Z', '2月の回答'),
      ]);
    });

    describe('When: period="2026-03" でフィルタする', () => {
      describe('Then: T-EC-E2E-03-01 - 範囲内セッションのみエクスポートされる', () => {
        it('T-EC-E2E-03-01: ファイルが1件生成される', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['claude', '2026-03', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.length, 1);
        });
      });
    });

    describe('When: period="2026-04" でフィルタする（全件範囲外）', () => {
      describe('Then: T-EC-E2E-03-02 - ファイルが生成されない', () => {
        it('T-EC-E2E-03-02: ファイルが0件', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['claude', '2026-04', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.length, 0);
        });
      });
    });
  });

  // ─── T-EC-E2E-04: projectFilter ──────────────────────────────────────────

  describe('Given: "my-app" と "other-app" のプロジェクトがある', () => {
    beforeEach(async () => {
      const projectsDir = `${tempDir}/.claude/projects`;
      await Deno.mkdir(`${projectsDir}/C--home-user-projects-my-app`, { recursive: true });
      await Deno.mkdir(`${projectsDir}/C--home-user-projects-other-app`, { recursive: true });
      await _writeJsonl(`${projectsDir}/C--home-user-projects-my-app/session.jsonl`, [
        _claudeEntry(
          'user',
          'sess-my-app',
          '2026-03-15T10:00:00.000Z',
          'my-appの質問',
          '/home/user/projects/my-app',
        ),
        _claudeEntry('assistant', 'sess-my-app', '2026-03-15T10:00:05.000Z', 'my-appの回答'),
      ]);
      await _writeJsonl(`${projectsDir}/C--home-user-projects-other-app/session.jsonl`, [
        _claudeEntry(
          'user',
          'sess-other',
          '2026-03-15T10:00:00.000Z',
          'other-appの質問',
          '/home/user/projects/other-app',
        ),
        _claudeEntry('assistant', 'sess-other', '2026-03-15T10:00:05.000Z', 'other-appの回答'),
      ]);
    });

    describe('When: projectFilter="my-app" で呼び出す', () => {
      describe('Then: T-EC-E2E-04-01 - my-app のセッションのみエクスポート', () => {
        it('T-EC-E2E-04-01: 1件のファイルが生成される', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['claude', 'my-app', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.length, 1);
        });
      });

      describe('When: projectFilter="nonexistent-project" で呼び出す', () => {
        describe('Then: T-EC-E2E-04-02 - ファイルが生成されない', () => {
          it('T-EC-E2E-04-02: 0件のファイルが生成される', async () => {
            const logPaths: string[] = [];
            const logStub = stub(console, 'log', (path: unknown) => {
              logPaths.push(String(path));
            });
            await main(['claude', 'nonexistent-project', '--output', outputDir]);
            logStub.restore();

            assertEquals(logPaths.length, 0);
          });
        });
      });
    });
  });

  // ─── T-EC-E2E-05: 不正な period → Deno.exit(1) ────────────────────────
  // parseArgs では YYYY-MM / YYYY 以外の引数は project として扱われる。
  // parsePeriod で Error が出るのは、期間パターンに「似ているが」無効なケース（例: "9999-99"）ではなく、
  // むしろ正規表現に一切マッチしない値は project 扱いになる。
  // そのため、不正な --unknown フラグを渡して Deno.exit(1) を確認する。

  describe('Given: 不明なオプション "--unknown-flag" を指定', () => {
    describe('When: main(["claude", "--unknown-flag", "--output", outputDir]) を呼び出す', () => {
      describe('Then: T-EC-E2E-05 - Deno.exit(1) が呼ばれる', () => {
        it('T-EC-E2E-05-01: Deno.exit(1) が呼ばれる', async () => {
          const exitStub = stub(Deno, 'exit');
          try {
            await main(['claude', '--unknown-flag', '--output', outputDir]);
          } finally {
            exitStub.restore();
          }
          assertEquals(exitStub.calls.length >= 1, true);
          assertEquals(exitStub.calls[0].args[0], 1);
        });
      });
    });
  });

  // ─── T-EC-E2E-06: 出力ディレクトリ構造 ──────────────────────────────────

  describe('Given: claude セッションと outputDir が指定される', () => {
    describe('When: main(["claude", "--output", outputDir]) を呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects/C--home-user-projects-struct-app`;
        await Deno.mkdir(projectsDir, { recursive: true });
        await _writeJsonl(`${projectsDir}/session.jsonl`, [
          _claudeEntry(
            'user',
            'sess-struct',
            '2026-03-15T10:00:00.000Z',
            'ディレクトリ構造テスト',
            '/home/user/projects/struct-app',
          ),
          _claudeEntry('assistant', 'sess-struct', '2026-03-15T10:00:05.000Z', '構造確認の回答'),
        ]);
      });

      describe('Then: T-EC-E2E-06 - outputDir/claude/YYYY/YYYY-MM/project/ 構造が生成される', () => {
        it('T-EC-E2E-06-01: 出力パスに "claude/2026/2026-03" が含まれる', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['claude', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.length >= 1, true);
          assertStringIncludes(logPaths[0], 'claude');
          assertStringIncludes(logPaths[0], '2026');
          assertStringIncludes(logPaths[0], '2026-03');
        });
      });
    });
  });

  // ─── T-EC-E2E-07: スキップ対象のみJSONL → console.error にスキップログ ───

  describe('Given: 全ユーザーメッセージがスキップ対象のJSONL', () => {
    describe('When: main(["claude", "--output", outputDir]) を呼び出す', () => {
      beforeEach(async () => {
        const projectsDir = `${tempDir}/.claude/projects/C--home-user-projects-skip-app`;
        await Deno.mkdir(projectsDir, { recursive: true });
        await _writeJsonl(`${projectsDir}/all-skipped.jsonl`, [
          _claudeEntry(
            'user',
            'sess-skip',
            '2026-03-15T10:00:00.000Z',
            'yes',
            '/home/user/projects/skip-app',
          ),
          _claudeEntry('assistant', 'sess-skip', '2026-03-15T10:00:05.000Z', '了解しました。'),
        ]);
      });

      describe('Then: T-EC-E2E-07 - ファイルが生成されない', () => {
        it('T-EC-E2E-07-01: ログパスが 0 件（スキップされた）', async () => {
          const logPaths: string[] = [];
          const logStub = stub(console, 'log', (path: unknown) => {
            logPaths.push(String(path));
          });
          await main(['claude', '--output', outputDir]);
          logStub.restore();

          assertEquals(logPaths.length, 0);
        });
      });
    });
  });
});
