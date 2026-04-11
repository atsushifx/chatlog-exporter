// src: scripts/__tests__/functional/export-chatlog.parse-codex-session.functional.spec.ts
// @(#): parseCodexSession の機能テスト
//       対象: parseCodexSession
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words sess

// -- import --

import { assertEquals, assertNotEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

import { parseCodexSession, parsePeriod } from '../../export-chatlog.ts';
import type { PeriodRange } from '../../export-chatlog.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

const ALL_PERIOD: PeriodRange = parsePeriod(undefined);

async function _writeJsonl(filePath: string, lines: unknown[]): Promise<void> {
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  await Deno.writeTextFile(filePath, content);
}

// ─── parseCodexSession ────────────────────────────────────────────────────────

describe('parseCodexSession', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-EC-PX-01: 正常パース ────────────────────────────────────────────────

  describe('Given: session_meta + user + assistant エントリのJSONL', () => {
    describe('When: parseCodexSession(filePath, allPeriod) を呼び出す', () => {
      let filePath: string;

      beforeEach(async () => {
        filePath = `${tempDir}/codex-session.jsonl`;
        await _writeJsonl(filePath, [
          {
            timestamp: '2026-03-15T11:00:00.000Z',
            type: 'session_meta',
            payload: { id: 'codex-sess-0001', cwd: '/home/user/projects/my-codex-app', model: 'o4-mini' },
          },
          {
            timestamp: '2026-03-15T11:00:01.000Z',
            type: 'response_item',
            payload: {
              role: 'user',
              content: [{ type: 'input_text', text: 'コードレビューをお願いします' }],
            },
          },
          {
            timestamp: '2026-03-15T11:00:10.000Z',
            type: 'response_item',
            payload: {
              role: 'assistant',
              content: [{ type: 'output_text', text: 'コードを確認しました。いくつか改善点があります。' }],
            },
          },
        ]);
      });

      describe('Then: T-EC-PX-01 - 正常にパースされる', () => {
        it('T-EC-PX-01-01: null でない ExportedSession を返す', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertNotEquals(result, null);
        });

        it('T-EC-PX-01-02: meta.sessionId が "codex-sess-0001"', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.sessionId, 'codex-sess-0001');
        });

        it('T-EC-PX-01-03: meta.date が "2026-03-15"', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.date, '2026-03-15');
        });

        it('T-EC-PX-01-04: meta.project が "my-codex-app"', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.project, 'my-codex-app');
        });

        it('T-EC-PX-01-05: turns の件数が 2', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result!.turns.length, 2);
        });

        it('T-EC-PX-01-06: firstUserText が "コードレビューをお願いします"', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.firstUserText, 'コードレビューをお願いします');
        });
      });
    });
  });

  // ─── T-EC-PX-02: session_meta なし → null ─────────────────────────────────

  describe('Given: session_meta エントリが存在しないJSONL', () => {
    describe('When: parseCodexSession(filePath, allPeriod) を呼び出す', () => {
      let filePath: string;

      beforeEach(async () => {
        filePath = `${tempDir}/no-meta.jsonl`;
        await _writeJsonl(filePath, [
          {
            timestamp: '2026-03-15T11:00:01.000Z',
            type: 'response_item',
            payload: {
              role: 'user',
              content: [{ type: 'input_text', text: '質問です' }],
            },
          },
          {
            timestamp: '2026-03-15T11:00:10.000Z',
            type: 'response_item',
            payload: {
              role: 'assistant',
              content: [{ type: 'output_text', text: '回答です。' }],
            },
          },
        ]);
      });

      describe('Then: T-EC-PX-02 - null を返す', () => {
        it('T-EC-PX-02-01: null を返す', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result, null);
        });
      });
    });
  });

  // ─── T-EC-PX-03: 期間外 → null ─────────────────────────────────────────────

  describe('Given: session_meta の timestamp が期間外のJSONL', () => {
    describe('When: parsePeriod("2026-03") の期間でフィルタする', () => {
      let filePath: string;
      let marchRange: PeriodRange;

      beforeEach(async () => {
        filePath = `${tempDir}/outside-period.jsonl`;
        marchRange = parsePeriod('2026-03');
        await _writeJsonl(filePath, [
          {
            timestamp: '2026-02-15T11:00:00.000Z', // 期間外: 2月
            type: 'session_meta',
            payload: { id: 'codex-sess-outside', cwd: '/home/user/projects/my-app', model: 'o4-mini' },
          },
          {
            timestamp: '2026-02-15T11:00:01.000Z',
            type: 'response_item',
            payload: {
              role: 'user',
              content: [{ type: 'input_text', text: '期間外の質問です' }],
            },
          },
          {
            timestamp: '2026-02-15T11:00:10.000Z',
            type: 'response_item',
            payload: {
              role: 'assistant',
              content: [{ type: 'output_text', text: '期間外の回答です。' }],
            },
          },
        ]);
      });

      describe('Then: T-EC-PX-03 - null を返す', () => {
        it('T-EC-PX-03-01: null を返す', async () => {
          const result = await parseCodexSession(filePath, marchRange);
          assertEquals(result, null);
        });
      });
    });
  });

  // ─── T-EC-PX-04: AGENTS.md instructions 除外 ──────────────────────────────

  describe('Given: user ターンが "# AGENTS.md instructions" で始まるJSONL', () => {
    describe('When: parseCodexSession(filePath, allPeriod) を呼び出す', () => {
      let filePath: string;

      beforeEach(async () => {
        filePath = `${tempDir}/agents-md.jsonl`;
        await _writeJsonl(filePath, [
          {
            timestamp: '2026-03-15T11:00:00.000Z',
            type: 'session_meta',
            payload: { id: 'codex-sess-agents', cwd: '/home/user/projects/my-app', model: 'o4-mini' },
          },
          {
            timestamp: '2026-03-15T11:00:01.000Z',
            type: 'response_item',
            payload: {
              role: 'user',
              content: [{ type: 'input_text', text: '# AGENTS.md instructions\nここは除外されます' }],
            },
          },
          {
            timestamp: '2026-03-15T11:00:02.000Z',
            type: 'response_item',
            payload: {
              role: 'user',
              content: [{ type: 'input_text', text: '実際の質問です' }],
            },
          },
          {
            timestamp: '2026-03-15T11:00:10.000Z',
            type: 'response_item',
            payload: {
              role: 'assistant',
              content: [{ type: 'output_text', text: '実際の回答です。' }],
            },
          },
        ]);
      });

      describe('Then: T-EC-PX-04 - AGENTS.md ターンが除外される', () => {
        it('T-EC-PX-04-01: turns の件数が 2（AGENTS.md 除外後）', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result!.turns.length, 2);
        });

        it('T-EC-PX-04-02: firstUserText が "実際の質問です"', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.firstUserText, '実際の質問です');
        });
      });
    });
  });

  // ─── T-EC-PX-05: projectFilter 不一致 → null ──────────────────────────────

  describe('Given: cwd が "other-app" のJSONL', () => {
    describe('When: projectFilter="my-app" で呼び出す', () => {
      let filePath: string;

      beforeEach(async () => {
        filePath = `${tempDir}/other-project.jsonl`;
        await _writeJsonl(filePath, [
          {
            timestamp: '2026-03-15T11:00:00.000Z',
            type: 'session_meta',
            payload: { id: 'codex-sess-other', cwd: '/home/user/projects/other-app', model: 'o4-mini' },
          },
          {
            timestamp: '2026-03-15T11:00:01.000Z',
            type: 'response_item',
            payload: {
              role: 'user',
              content: [{ type: 'input_text', text: '別プロジェクトの質問です' }],
            },
          },
          {
            timestamp: '2026-03-15T11:00:10.000Z',
            type: 'response_item',
            payload: {
              role: 'assistant',
              content: [{ type: 'output_text', text: '回答です。' }],
            },
          },
        ]);
      });

      describe('Then: T-EC-PX-05 - null を返す', () => {
        it('T-EC-PX-05-01: null を返す', async () => {
          const result = await parseCodexSession(filePath, ALL_PERIOD, 'my-app');
          assertEquals(result, null);
        });
      });
    });
  });

  // ─── T-EC-PX-06: ファイル不存在 → null ────────────────────────────────────

  describe('Given: 存在しないファイルパス', () => {
    describe('When: parseCodexSession(nonExistentPath, allPeriod) を呼び出す', () => {
      describe('Then: T-EC-PX-06 - null を返す', () => {
        it('T-EC-PX-06-01: null を返す', async () => {
          const result = await parseCodexSession(`${tempDir}/no-such-file.jsonl`, ALL_PERIOD);
          assertEquals(result, null);
        });
      });
    });
  });
});
