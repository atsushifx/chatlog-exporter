// src: scripts/__tests__/functional/filter-chatlog.prefilterFiles.functional.spec.ts
// @(#): prefilterFiles の機能テスト
//       実 tempdir を使用した事前フィルタリングの検証
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { stub } from '@std/testing/mock';

// test target
import { prefilterFiles } from '../../filter-chatlog.ts';

// ─── 共通セットアップ ──────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await Deno.makeTempDir();
});

afterEach(async () => {
  await Deno.remove(tempDir, { recursive: true });
});

// ─── 正常な会話コンテンツ ──────────────────────────────────────────────────────

function _makeValidContent(): string {
  const userText = 'u'.repeat(500);
  const assistantText = 'a'.repeat(500);
  return `---\ntitle: テスト\n---\n### User\n${userText}\n\n### Assistant\n${assistantText}\n`;
}

// ─── T-FL-PFF-01: 除外ファイル名 → スキップ ─────────────────────────────────

describe('prefilterFiles', () => {
  describe('Given: 除外パターンのファイル名を持つファイル', () => {
    describe('When: prefilterFiles([file]) を呼び出す', () => {
      describe('Then: T-FL-PFF-01 - ファイルがスキップされる', () => {
        it('T-FL-PFF-01-01: say-ok-and-nothing-else.md は通過しない', async () => {
          const filePath = `${tempDir}/say-ok-and-nothing-else.md`;
          await Deno.writeTextFile(filePath, _makeValidContent());
          const errStub = stub(console, 'error', () => {});

          const result = await prefilterFiles([filePath]);
          errStub.restore();

          assertEquals(result.length, 0);
        });
      });
    });
  });

  // ─── T-FL-PFF-02: 本文なし → スキップ ──────────────────────────────────────

  describe('Given: frontmatter のみで本文がないファイル', () => {
    describe('When: prefilterFiles([file]) を呼び出す', () => {
      describe('Then: T-FL-PFF-02 - ファイルがスキップされる', () => {
        it('T-FL-PFF-02-01: body が空のファイルは通過しない', async () => {
          const filePath = `${tempDir}/empty-body.md`;
          await Deno.writeTextFile(filePath, '---\ntitle: テスト\n---\n');
          const errStub = stub(console, 'error', () => {});

          const result = await prefilterFiles([filePath]);
          errStub.restore();

          assertEquals(result.length, 0);
        });
      });
    });
  });

  // ─── T-FL-PFF-03: 短すぎる本文 → スキップ ──────────────────────────────────

  describe('Given: 本文が短すぎるファイル', () => {
    describe('When: prefilterFiles([file]) を呼び出す', () => {
      describe('Then: T-FL-PFF-03 - ファイルがスキップされる', () => {
        it('T-FL-PFF-03-01: 短い本文のファイルは通過しない', async () => {
          const filePath = `${tempDir}/short.md`;
          await Deno.writeTextFile(filePath, '---\ntitle: テスト\n---\n短い本文\n');
          const errStub = stub(console, 'error', () => {});

          const result = await prefilterFiles([filePath]);
          errStub.restore();

          assertEquals(result.length, 0);
        });
      });
    });
  });

  // ─── T-FL-PFF-04: 正常ファイル → 通過 ──────────────────────────────────────

  describe('Given: 正常なコンテンツを持つファイル', () => {
    describe('When: prefilterFiles([file]) を呼び出す', () => {
      describe('Then: T-FL-PFF-04 - ファイルが通過する', () => {
        it('T-FL-PFF-04-01: 正常なファイルは通過する', async () => {
          const filePath = `${tempDir}/normal.md`;
          await Deno.writeTextFile(filePath, _makeValidContent());
          const errStub = stub(console, 'error', () => {});

          const result = await prefilterFiles([filePath]);
          errStub.restore();

          assertEquals(result.length, 1);
          assertEquals(result[0], filePath);
        });

        it('T-FL-PFF-04-02: 複数ファイルのうち正常なものだけ通過する', async () => {
          const validPath = `${tempDir}/valid.md`;
          const shortPath = `${tempDir}/short.md`;
          await Deno.writeTextFile(validPath, _makeValidContent());
          await Deno.writeTextFile(shortPath, '---\ntitle: 短い\n---\n短い本文\n');
          const errStub = stub(console, 'error', () => {});

          const result = await prefilterFiles([validPath, shortPath]);
          errStub.restore();

          assertEquals(result.length, 1);
          assertEquals(result[0], validPath);
        });
      });
    });
  });
});
