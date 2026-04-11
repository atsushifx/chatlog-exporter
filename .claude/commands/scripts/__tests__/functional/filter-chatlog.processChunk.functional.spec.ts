// src: scripts/__tests__/functional/filter-chatlog.processChunk.functional.spec.ts
// @(#): processChunk の機能テスト
//       Deno.Command モック + 実 tempdir を使用したチャンク処理の検証
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { stub } from '@std/testing/mock';

// test target
import { DISCARD_THRESHOLD, processChunk } from '../../filter-chatlog.ts';
import type { Stats } from '../../filter-chatlog.ts';

// helpers
import {
  installCommandMock,
  makeFailMock,
  makeNotFoundMock,
  makeSuccessMock,
} from '../_helpers/deno-command-mock.ts';
import type { CommandMockHandle } from '../_helpers/deno-command-mock.ts';

// ─── テスト用ヘルパー ──────────────────────────────────────────────────────────

let tempDir: string;
let commandHandle: CommandMockHandle;

function _makeStats(): Stats {
  return { kept: 0, discarded: 0, skipped: 0, error: 0 };
}

async function _createTempFile(name: string): Promise<string> {
  const filePath = `${tempDir}/${name}`;
  const content = '---\ntitle: テスト\n---\n### User\n質問\n\n### Assistant\n回答\n';
  await Deno.writeTextFile(filePath, content);
  return filePath;
}

beforeEach(async () => {
  tempDir = await Deno.makeTempDir();
});

afterEach(async () => {
  commandHandle?.restore();
  await Deno.remove(tempDir, { recursive: true });
});

// ─── T-FL-PCK-01: DISCARD (dryRun=true) → 削除なし、stats.discarded++ ─────────

describe('processChunk', () => {
  describe('Given: DISCARD 判定を返す Claude モックと dryRun=true', () => {
    describe('When: processChunk([file], true, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-01 - ファイルが削除されず stats.discarded が増える', () => {
        it('T-FL-PCK-01-01: ファイルが残っている', async () => {
          const filePath = await _createTempFile('a.md');
          const response = JSON.stringify([
            { file: 'a.md', decision: 'DISCARD', confidence: DISCARD_THRESHOLD, reason: 'trivial' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          const errStub = stub(console, 'error', () => {});
          const logStub = stub(console, 'log', () => {});
          const stats = _makeStats();

          await processChunk([filePath], true, stats);
          errStub.restore();
          logStub.restore();

          const stat = await Deno.stat(filePath);
          assertEquals(stat.isFile, true);
        });

        it('T-FL-PCK-01-02: stats.discarded が 1 になる', async () => {
          const filePath = await _createTempFile('a.md');
          const response = JSON.stringify([
            { file: 'a.md', decision: 'DISCARD', confidence: DISCARD_THRESHOLD, reason: 'trivial' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          const errStub = stub(console, 'error', () => {});
          const logStub = stub(console, 'log', () => {});
          const stats = _makeStats();

          await processChunk([filePath], true, stats);
          errStub.restore();
          logStub.restore();

          assertEquals(stats.discarded, 1);
        });
      });
    });
  });

  // ─── T-FL-PCK-02: DISCARD (dryRun=false) → 削除される ──────────────────────

  describe('Given: DISCARD 判定を返す Claude モックと dryRun=false', () => {
    describe('When: processChunk([file], false, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-02 - ファイルが削除され stats.discarded が増える', () => {
        it('T-FL-PCK-02-01: ファイルが削除される', async () => {
          const filePath = await _createTempFile('b.md');
          const response = JSON.stringify([
            { file: 'b.md', decision: 'DISCARD', confidence: DISCARD_THRESHOLD, reason: 'trivial' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          const errStub = stub(console, 'error', () => {});
          const logStub = stub(console, 'log', () => {});
          const stats = _makeStats();

          await processChunk([filePath], false, stats);
          errStub.restore();
          logStub.restore();

          let fileExists = true;
          try {
            await Deno.stat(filePath);
          } catch {
            fileExists = false;
          }
          assertEquals(fileExists, false);
        });

        it('T-FL-PCK-02-02: stats.discarded が 1 になる', async () => {
          const filePath = await _createTempFile('c.md');
          const response = JSON.stringify([
            { file: 'c.md', decision: 'DISCARD', confidence: DISCARD_THRESHOLD, reason: 'trivial' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          const errStub = stub(console, 'error', () => {});
          const logStub = stub(console, 'log', () => {});
          const stats = _makeStats();

          await processChunk([filePath], false, stats);
          errStub.restore();
          logStub.restore();

          assertEquals(stats.discarded, 1);
        });
      });
    });
  });

  // ─── T-FL-PCK-03: KEEP 判定 → ファイル残る ──────────────────────────────────

  describe('Given: KEEP 判定を返す Claude モック', () => {
    describe('When: processChunk([file], false, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-03 - ファイルが残り stats.kept が増える', () => {
        it('T-FL-PCK-03-01: stats.kept が 1 になる', async () => {
          const filePath = await _createTempFile('d.md');
          const response = JSON.stringify([
            { file: 'd.md', decision: 'KEEP', confidence: 0.9, reason: 'valuable' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          const errStub = stub(console, 'error', () => {});
          const stats = _makeStats();

          await processChunk([filePath], false, stats);
          errStub.restore();

          assertEquals(stats.kept, 1);
        });
      });
    });
  });

  // ─── T-FL-PCK-04: confidence < 0.7 → KEEP 扱い ───────────────────────────

  describe('Given: DISCARD 判定だが confidence が 0.7 未満', () => {
    describe('When: processChunk([file], false, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-04 - KEEP 扱いで stats.kept が増える', () => {
        it('T-FL-PCK-04-01: confidence=0.6 の DISCARD → stats.kept が 1 になる', async () => {
          const filePath = await _createTempFile('e.md');
          const response = JSON.stringify([
            { file: 'e.md', decision: 'DISCARD', confidence: 0.6, reason: 'low conf' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          const errStub = stub(console, 'error', () => {});
          const stats = _makeStats();

          await processChunk([filePath], false, stats);
          errStub.restore();

          assertEquals(stats.kept, 1);
          assertEquals(stats.discarded, 0);
        });
      });
    });
  });

  // ─── T-FL-PCK-05: Claude CLI エラー → 全件 KEEP 扱い ────────────────────────

  describe('Given: Claude CLI が失敗するモック', () => {
    describe('When: processChunk([file1, file2], false, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-05 - 全件 KEEP 扱いで stats.kept が増える', () => {
        it('T-FL-PCK-05-01: stats.kept が 2 になる（全件 KEEP）', async () => {
          const file1 = await _createTempFile('f1.md');
          const file2 = await _createTempFile('f2.md');
          commandHandle = installCommandMock(makeFailMock(1));
          const errStub = stub(console, 'error', () => {});
          const stats = _makeStats();

          await processChunk([file1, file2], false, stats);
          errStub.restore();

          assertEquals(stats.kept, 2);
        });
      });
    });
  });

  // ─── T-FL-PCK-06: JSON パース失敗 → 全件 KEEP 扱い ──────────────────────────

  describe('Given: JSON でないテキストを返す Claude モック', () => {
    describe('When: processChunk([file], false, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-06 - 全件 KEEP 扱いで stats.kept が増える', () => {
        it('T-FL-PCK-06-01: stats.kept が 1 になる', async () => {
          const filePath = await _createTempFile('g.md');
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode('これはJSONではありません')),
          );
          const errStub = stub(console, 'error', () => {});
          const stats = _makeStats();

          await processChunk([filePath], false, stats);
          errStub.restore();

          assertEquals(stats.kept, 1);
        });
      });
    });
  });

  // ─── T-FL-PCK-07: ファイル名不一致 → KEEP 扱い ──────────────────────────────

  describe('Given: 対象ファイルと異なるファイル名の結果を返す Claude モック', () => {
    describe('When: processChunk([file], false, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-07 - KEEP 扱いで stats.kept が増える', () => {
        it('T-FL-PCK-07-01: ファイル名不一致 → stats.kept が 1 になる', async () => {
          const filePath = await _createTempFile('h.md');
          // 対象は h.md だが結果は other.md
          const response = JSON.stringify([
            { file: 'other.md', decision: 'DISCARD', confidence: 0.9, reason: 'trivial' },
          ]);
          commandHandle = installCommandMock(
            makeSuccessMock(new TextEncoder().encode(response)),
          );
          const errStub = stub(console, 'error', () => {});
          const stats = _makeStats();

          await processChunk([filePath], false, stats);
          errStub.restore();

          assertEquals(stats.kept, 1);
        });
      });
    });
  });

  // ─── T-FL-PCK-08: Claude CLI 未インストール → KEEP 扱い ─────────────────────

  describe('Given: claude CLI が見つからないモック', () => {
    describe('When: processChunk([file], false, stats) を呼び出す', () => {
      describe('Then: T-FL-PCK-08 - KEEP 扱いで stats.kept が増える', () => {
        it('T-FL-PCK-08-01: NotFound エラー → stats.kept が 1 になる', async () => {
          const filePath = await _createTempFile('i.md');
          commandHandle = installCommandMock(makeNotFoundMock());
          const errStub = stub(console, 'error', () => {});
          const stats = _makeStats();

          await processChunk([filePath], false, stats);
          errStub.restore();

          assertEquals(stats.kept, 1);
        });
      });
    });
  });
});
