// src: scripts/__tests__/functional/parse-claude-session.functional.spec.ts
// @(#): parseClaudeSession の機能テスト
//       対象: parseClaudeSession
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words sess

// -- import --

// BDD spec modules
import { assertEquals, assertNotEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { parseClaudeSession, parsePeriod } from '../../export-chatlog.ts';
import type { PeriodRange } from '../../export-chatlog.ts';

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

const ALL_PERIOD: PeriodRange = parsePeriod(undefined);

async function _writeJsonl(filePath: string, lines: unknown[]): Promise<void> {
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  await Deno.writeTextFile(filePath, content);
}

// ─── parseClaudeSession ───────────────────────────────────────────────────────

/**
 * `parseClaudeSession` の機能テストスイート。
 *
 * 一時ディレクトリに JSONL ファイルを書き込み、実ファイル I/O を通じて
 * パース動作を検証する。ユニットテストでカバーできない以下の組み合わせ動作を対象とする:
 * - 正常系: user + assistant エントリから ExportedSession の各フィールドを正しく抽出
 * - スキップ対象のみ（全ユーザーメッセージが "yes"/"ok" 等）→ null
 * - 期間外タイムスタンプ → null
 * - ファイル不存在 → null
 * - 同一 message.id の assistant 複数エントリ → テキスト連結
 *
 * 各テストは `Deno.makeTempDir()` で独立した作業ディレクトリを使用し、
 * `afterEach` で自動クリーンアップする。
 *
 * @see parseClaudeSession
 * @see parsePeriod
 */
describe('parseClaudeSession', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await Deno.makeTempDir();
  });

  afterEach(async () => {
    await Deno.remove(tempDir, { recursive: true });
  });

  // ─── T-EC-PC-01: 正常パース ────────────────────────────────────────────────

  describe('Given: user + assistant 各1エントリのJSONL', () => {
    describe('When: parseClaudeSession(filePath, allPeriod) を呼び出す', () => {
      let filePath: string;

      beforeEach(async () => {
        filePath = `${tempDir}/session.jsonl`;
        await _writeJsonl(filePath, [
          {
            type: 'user',
            isMeta: false,
            sessionId: 'sess-0001-0001-0001-0001',
            timestamp: '2026-03-15T10:00:00.000Z',
            cwd: '/home/user/projects/my-app',
            message: { id: 'msg-u-001', content: [{ type: 'text', text: 'TDDについて説明してください' }] },
          },
          {
            type: 'assistant',
            isMeta: false,
            sessionId: 'sess-0001-0001-0001-0001',
            timestamp: '2026-03-15T10:00:05.000Z',
            message: { id: 'msg-a-001', content: [{ type: 'text', text: 'TDDはテストを先に書く開発手法です。' }] },
          },
        ]);
      });

      describe('Then: T-EC-PC-01 - 正常にパースされる', () => {
        it('T-EC-PC-01-01: null でない ExportedSession を返す', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertNotEquals(result, null);
        });

        it('T-EC-PC-01-02: meta.sessionId が "sess-0001-0001-0001-0001"', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.sessionId, 'sess-0001-0001-0001-0001');
        });

        it('T-EC-PC-01-03: meta.date が "2026-03-15"', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.date, '2026-03-15');
        });

        it('T-EC-PC-01-04: meta.project が "my-app"', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.project, 'my-app');
        });

        it('T-EC-PC-01-05: turns の件数が 2', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.turns.length, 2);
        });

        it('T-EC-PC-01-06: turns[0].role が "user"', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.turns[0].role, 'user');
        });

        it('T-EC-PC-01-07: turns[1].role が "assistant"', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.turns[1].role, 'assistant');
        });

        it('T-EC-PC-01-08: firstUserText が "TDDについて説明してください"', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.meta.firstUserText, 'TDDについて説明してください');
        });
      });
    });
  });

  // ─── T-EC-PC-02: スキップ対象のみ → null ───────────────────────────────────

  describe('Given: 全ユーザーメッセージがスキップ対象のJSONL', () => {
    describe('When: parseClaudeSession(filePath, allPeriod) を呼び出す', () => {
      let filePath: string;

      beforeEach(async () => {
        filePath = `${tempDir}/skipped.jsonl`;
        await _writeJsonl(filePath, [
          {
            type: 'user',
            isMeta: false,
            sessionId: 'sess-skip-0001',
            timestamp: '2026-03-15T10:00:00.000Z',
            cwd: '/home/user/projects/my-app',
            message: { id: 'msg-u-001', content: [{ type: 'text', text: 'yes' }] },
          },
          {
            type: 'user',
            isMeta: false,
            sessionId: 'sess-skip-0001',
            timestamp: '2026-03-15T10:00:01.000Z',
            cwd: '/home/user/projects/my-app',
            message: { id: 'msg-u-002', content: [{ type: 'text', text: 'ok' }] },
          },
          {
            type: 'assistant',
            isMeta: false,
            sessionId: 'sess-skip-0001',
            timestamp: '2026-03-15T10:00:05.000Z',
            message: { id: 'msg-a-001', content: [{ type: 'text', text: '了解しました。' }] },
          },
        ]);
      });

      describe('Then: T-EC-PC-02 - null を返す', () => {
        it('T-EC-PC-02-01: null を返す', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result, null);
        });
      });
    });
  });

  // ─── T-EC-PC-03: 期間外 → null ─────────────────────────────────────────────

  describe('Given: 期間外のタイムスタンプを持つJSONL', () => {
    describe('When: parsePeriod("2026-03") の期間でフィルタする', () => {
      let filePath: string;
      let marchRange: PeriodRange;

      beforeEach(async () => {
        filePath = `${tempDir}/outside-period.jsonl`;
        marchRange = parsePeriod('2026-03');
        await _writeJsonl(filePath, [
          {
            type: 'user',
            isMeta: false,
            sessionId: 'sess-outside-0001',
            timestamp: '2026-02-15T10:00:00.000Z', // 期間外: 2月
            cwd: '/home/user/projects/my-app',
            message: { id: 'msg-u-001', content: [{ type: 'text', text: '期間外のメッセージです' }] },
          },
          {
            type: 'assistant',
            isMeta: false,
            sessionId: 'sess-outside-0001',
            timestamp: '2026-02-15T10:00:05.000Z',
            message: { id: 'msg-a-001', content: [{ type: 'text', text: '期間外の回答です。' }] },
          },
        ]);
      });

      describe('Then: T-EC-PC-03 - null を返す', () => {
        it('T-EC-PC-03-01: null を返す', async () => {
          const result = await parseClaudeSession(filePath, marchRange);
          assertEquals(result, null);
        });
      });
    });
  });

  // ─── T-EC-PC-05: ファイル不存在 → null ────────────────────────────────────

  describe('Given: 存在しないファイルパス', () => {
    describe('When: parseClaudeSession(nonExistentPath, allPeriod) を呼び出す', () => {
      describe('Then: T-EC-PC-05 - null を返す', () => {
        it('T-EC-PC-05-01: null を返す', async () => {
          const result = await parseClaudeSession(`${tempDir}/no-such-file.jsonl`, ALL_PERIOD);
          assertEquals(result, null);
        });
      });
    });
  });

  // ─── T-EC-PC-06: 同一msgId の assistant を連結 ────────────────────────────

  describe('Given: 同一 msgId の assistant エントリが2件連続するJSONL', () => {
    describe('When: parseClaudeSession(filePath, allPeriod) を呼び出す', () => {
      let filePath: string;

      beforeEach(async () => {
        filePath = `${tempDir}/duplicate-assistant.jsonl`;
        await _writeJsonl(filePath, [
          {
            type: 'user',
            isMeta: false,
            sessionId: 'sess-dup-0001',
            timestamp: '2026-03-15T10:00:00.000Z',
            cwd: '/home/user/projects/my-app',
            message: { id: 'msg-u-001', content: [{ type: 'text', text: '詳しく説明してください' }] },
          },
          {
            type: 'assistant',
            isMeta: false,
            sessionId: 'sess-dup-0001',
            timestamp: '2026-03-15T10:00:05.000Z',
            message: { id: 'msg-a-001', content: [{ type: 'text', text: '前半の説明です。' }] },
          },
          {
            type: 'assistant',
            isMeta: false,
            sessionId: 'sess-dup-0001',
            timestamp: '2026-03-15T10:00:06.000Z',
            message: { id: 'msg-a-001', content: [{ type: 'text', text: '後半の説明です。' }] },
          },
        ]);
      });

      describe('Then: T-EC-PC-06 - assistant ターンが1件に連結される', () => {
        it('T-EC-PC-06-01: turns の件数が 2（user + assistant 連結）', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          assertEquals(result!.turns.length, 2);
        });

        it('T-EC-PC-06-02: turns[1].text に "前半" と "後半" が両方含まれる', async () => {
          const result = await parseClaudeSession(filePath, ALL_PERIOD);
          const assistantText = result!.turns[1].text;
          assertEquals(assistantText.includes('前半'), true);
          assertEquals(assistantText.includes('後半'), true);
        });
      });
    });
  });
});
