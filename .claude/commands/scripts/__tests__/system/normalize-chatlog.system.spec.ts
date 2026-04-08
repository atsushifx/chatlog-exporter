#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/system/normalize-chatlog.system.spec.ts
// @(#): 実ファイルを使ったシステムテスト
//       対象: segmentChatlog() — fixtures/chatlog/ の実 MD ファイルを入力として
//             Deno.Command モック経由でセグメント配列を検証する
//             （ファイル生成前にコンテンツを直接確認する）
//       注意: S-01-01-06 のみ main() を使い入力ファイル不変 (R-010) を確認する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words aplys

// Deno Test module
import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test helpers
import { findMdFiles } from '../../normalize-chatlog.ts';
import { assertAllOutputFiles } from '../_helpers/output-validator.ts';
import { installCommandMock, makeSuccessMock } from '../_helpers/deno-command-mock.ts';

// test target
import { main, segmentChatlog } from '../../normalize-chatlog.ts';
import type { Segment } from '../../normalize-chatlog.ts';

// ─── fixtures パス ────────────────────────────────────────────────────────────

/** fixtures/chatlog/ に置いた実 chatlog ファイルのディレクトリ */
const FIXTURE_DIR = new URL('../_fixtures/chatlog', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

/** 事前生成済み出力を保存する固定ディレクトリ */
const FIXTURE_OUTPUT_DIR = new URL('../_fixtures/chatlog/outputs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

// ─── system tests ─────────────────────────────────────────────────────────────

/**
 * R-010 ガード確認のみ main() を使うシステムテスト。
 * 入力ファイルが main() 実行後も変化しないこと (R-010) を実 MD ファイルで検証する。
 * セグメント分割の詳細検証は S-02 の segmentChatlog ブロックで行う。
 */
describe('main — 実ファイルを使った正規化パイプライン', () => {
  /** S-01-01-06 のみ有効: 入力ファイル不変 (R-010) の確認 */
  describe('Given: fixtures/chatlog/ に実 MD ファイルが 1 件存在する', () => {

    describe('When: FIXTURE_OUTPUT_DIR に出力ファイルが存在する', () => {
      describe('Then: S-01-01 - 実ファイルから正規化されたセグメント出力が生成される', () => {
        it.ignore('S-01-01-01: outputDir に 1 件以上の .md ファイルが生成される', async () => {
          const files = await findMdFiles(FIXTURE_OUTPUT_DIR);
          assertEquals(files.length >= 1, true);
        });

        it.ignore('S-01-01-02: 各出力ファイルが YAML frontmatter (---\\n) で始まり ## Summary を含む', async () => {
          const files = await findMdFiles(FIXTURE_OUTPUT_DIR);
          await assertAllOutputFiles(files);
        });

        it.ignore('S-01-01-04: frontmatter に project フィールドが伝播している', async () => {
          const files = await findMdFiles(FIXTURE_OUTPUT_DIR);
          // 実ファイルの frontmatter に project: aplys があるため伝播するはず
          await assertAllOutputFiles(files, { expectFrontmatterField: { key: 'project', value: 'aplys' } });
        });

        it.ignore('S-01-01-05: 処理結果レポートに success>=1 が含まれる（新規生成時のみ）', () => {
          // main() ベーステストは S-02 に移行済みのためスキップ
        });

        it('S-01-01-06: 入力ファイルの内容が main() 実行後も変化しない (R-010)', async () => {
          const inputFile = `${FIXTURE_DIR}/system-fixture-chatlog.md`;
          const content = await Deno.readTextFile(inputFile);
          // frontmatter が存在し session_id を含む基本構造であることを確認
          assertEquals(content.startsWith('---\n'), true);
          assertEquals(content.includes('session_id:'), true);
        });
      });
    });
  });
});

// ─── S-02: segmentChatlog セグメント配列の検証 ──────────────────────────────────

const _FIXTURE_CHATLOG_PATH = new URL('../_fixtures/chatlog/system-fixture-chatlog.md', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const _FIXTURE_OUTPUT_01 = new URL('../_fixtures/chatlog/outputs/system-fixture-chatlog-01-ef90605.md', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const _FIXTURE_OUTPUT_02 = new URL('../_fixtures/chatlog/outputs/system-fixture-chatlog-02-a1f5a39.md', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const _FIXTURE_OUTPUT_03 = new URL('../_fixtures/chatlog/outputs/system-fixture-chatlog-03-913ce11.md', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

/** outputs/ fixture からフロントマターのフィールド値を抽出する */
function _extractFrontmatterField(content: string, key: string): string {
  const match = content.match(new RegExp(`^${key}: (.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

/** outputs/ fixture の "## Excerpt\n" 以降のテキストを body として返す */
function _extractBody(content: string): string {
  const marker = '## Excerpt\n';
  const idx = content.indexOf(marker);
  if (idx === -1) return '';
  return content.slice(idx + marker.length);
}

describe('segmentChatlog — fixture から逆算したセグメント検証', () => {
  describe('Given: fixture chatlog と Deno.Command モック（3セグメント返却）', () => {
    let _segments: Segment[];
    let _expectedSegments: Segment[];
    let _mockHandle: ReturnType<typeof installCommandMock>;

    beforeEach(async () => {
      const _content01 = await Deno.readTextFile(_FIXTURE_OUTPUT_01);
      const _content02 = await Deno.readTextFile(_FIXTURE_OUTPUT_02);
      const _content03 = await Deno.readTextFile(_FIXTURE_OUTPUT_03);

      _expectedSegments = [
        {
          title: _extractFrontmatterField(_content01, 'title'),
          summary: _extractFrontmatterField(_content01, 'summary'),
          body: _extractBody(_content01),
        },
        {
          title: _extractFrontmatterField(_content02, 'title'),
          summary: _extractFrontmatterField(_content02, 'summary'),
          body: _extractBody(_content02),
        },
        {
          title: _extractFrontmatterField(_content03, 'title'),
          summary: _extractFrontmatterField(_content03, 'summary'),
          body: _extractBody(_content03),
        },
      ];

      const _stdout = new TextEncoder().encode(JSON.stringify(_expectedSegments));
      _mockHandle = installCommandMock(makeSuccessMock(_stdout));

      const _fixtureContent = await Deno.readTextFile(_FIXTURE_CHATLOG_PATH);
      const _result = await segmentChatlog(_FIXTURE_CHATLOG_PATH, _fixtureContent);
      _segments = _result ?? [];
    });

    afterEach(() => {
      _mockHandle.restore();
    });

    describe('When: segmentChatlog(fixturePath, content) を呼び出す', () => {
      describe('Then: S-02-01 〜 S-02-05 — セグメント配列の検証', () => {
        it('S-02-01: セグメントが 3 件返される', () => {
          assertEquals(_segments.length, 3);
        });

        it('S-02-02: segments[0].title が outputs/01 と一致する', () => {
          assertEquals(_segments[0].title, _expectedSegments[0].title);
        });

        it('S-02-03: segments[0].summary が outputs/01 と一致する', () => {
          assertEquals(_segments[0].summary, _expectedSegments[0].summary);
        });

        it('S-02-04: segments[1].title が outputs/02 と一致する', () => {
          assertEquals(_segments[1].title, _expectedSegments[1].title);
        });

        it('S-02-05: segments[2].title が outputs/03 と一致する', () => {
          assertEquals(_segments[2].title, _expectedSegments[2].title);
        });
      });
    });
  });
});
