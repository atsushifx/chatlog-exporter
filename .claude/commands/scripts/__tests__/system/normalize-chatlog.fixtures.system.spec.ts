#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/system/normalize-chatlog.fixtures.system.spec.ts
// @(#): ファイル駆動システムテスト
//       対象: segmentChatlog() — _fixtures/runai/ 下の各ディレクトリを自動スキャンし
//             input.md を入力、output-<N>.md を期待セグメントとして照合する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test helpers
import { installCommandMock, makeSuccessMock } from '../_helpers/deno-command-mock.ts';

// test target
import {
  attachFrontmatter,
  generateOutputFileName,
  generateSegmentFile,
  parseFrontmatter,
  segmentChatlog,
} from '../../normalize-chatlog.ts';
import type { Segment } from '../../normalize-chatlog.ts';

// ─── フロントマター検証対象フィールド ────────────────────────────────────────

const FRONTMATTER_KEYS = ['title', 'log_id', 'summary'] as const;

// ─── fixtures ルートパス ──────────────────────────────────────────────────────

const RUNAI_FIXTURES_DIR = new URL('../_fixtures/runai', import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  '$1',
);

// ─── helpers ─────────────────────────────────────────────────────────────────

/** output-<N>.md のフロントマターからフィールド値を抽出する */
function _extractFrontmatterField(content: string, key: string): string {
  const match = content.match(new RegExp(`^${key}: (.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

/** output-<N>.md の "## Excerpt\n" 以降を body として返す。先頭の空行を除去する */
function _extractBody(content: string): string {
  const marker = '## Excerpt\n';
  const idx = content.indexOf(marker);
  if (idx === -1) return '';
  return content.slice(idx + marker.length).replace(/^\n+/, '');
}

/** output-<N>.md から Segment を構築する */
async function _loadOutputSegment(filePath: string): Promise<Segment> {
  const content = await Deno.readTextFile(filePath);
  return {
    title: _extractFrontmatterField(content, 'title'),
    summary: _extractFrontmatterField(content, 'summary'),
    body: _extractBody(content),
  };
}

/** output-<N>.md の生テキストをそのまま返す */
async function _loadOutputRaw(filePath: string): Promise<string> {
  return await Deno.readTextFile(filePath);
}

/**
 * Segment と sourceMeta から attachFrontmatter + generateSegmentFile で
 * 期待される出力テキストを生成する。
 * hashFn に () => 'XXXXXXX' を渡すことで fixture の log_id と完全一致する。
 */
async function _buildExpectedOutput(
  segment: Segment,
  sourceMeta: Record<string, string>,
  inputPath: string,
  index: number,
): Promise<string> {
  const log_id = (await generateOutputFileName(inputPath, index, () => 'XXXXXXX')).replace(/\.md$/, '');
  const segmentContent = generateSegmentFile(segment);
  return attachFrontmatter(segmentContent, sourceMeta, {
    title: segment.title,
    log_id,
    summary: segment.summary,
  });
}

/**
 * fixtures ディレクトリ下の output-<N>.md を番号順に収集して返す。
 * N は 1 から始まる整数とする。
 */
async function _collectOutputFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    if (entry.isFile && /^output-\d+\.md$/.test(entry.name)) {
      files.push(`${dir}/${entry.name}`);
    }
  }
  return files.sort((a, b) => {
    const _numA = parseInt(a.match(/output-(\d+)\.md$/)![1]);
    const _numB = parseInt(b.match(/output-(\d+)\.md$/)![1]);
    return _numA - _numB;
  });
}

/** _fixtures/runai/ 下のサブディレクトリ名を収集して返す */
async function _collectFixtureDirs(rootDir: string): Promise<string[]> {
  const dirs: string[] = [];
  for await (const entry of Deno.readDir(rootDir)) {
    if (entry.isDirectory) {
      dirs.push(entry.name);
    }
  }
  return dirs.sort();
}

// ─── ファイル駆動 system fixtures tests ──────────────────────────────────────

const _fixtureDirs = await _collectFixtureDirs(RUNAI_FIXTURES_DIR);

for (const _dirName of _fixtureDirs) {
  const _fixtureDir = `${RUNAI_FIXTURES_DIR}/${_dirName}`;
  const _inputPath = `${_fixtureDir}/input.md`;
  const _outputFiles = await _collectOutputFiles(_fixtureDir);

  describe(`segmentChatlog — runai/${_dirName}`, () => {
    describe(`Given: ${_dirName}/input.md と ${_outputFiles.length} 件の output fixture`, () => {
      let _segments: Segment[];
      let _expectedSegments: Segment[];
      let _expectedRaws: string[];
      let _sourceMeta: Record<string, string>;
      let _mockHandle: ReturnType<typeof installCommandMock>;

      beforeEach(async () => {
        _expectedSegments = await Promise.all(_outputFiles.map(_loadOutputSegment));
        _expectedRaws = await Promise.all(_outputFiles.map(_loadOutputRaw));

        const _stdout = new TextEncoder().encode(JSON.stringify(_expectedSegments));
        _mockHandle = installCommandMock(makeSuccessMock(_stdout));

        const _inputContent = await Deno.readTextFile(_inputPath);
        _sourceMeta = parseFrontmatter(_inputContent).meta;
        const _result = await segmentChatlog(_inputPath, _inputContent);
        _segments = _result ?? [];
      });

      afterEach(() => {
        _mockHandle.restore();
      });

      describe('When: segmentChatlog(inputPath, content) を呼び出す', () => {
        it(`SF-${_dirName}-count: セグメント数が output fixture 件数と一致する`, () => {
          assertEquals(_segments.length, _expectedSegments.length);
        });

        for (let _i = 0; _i < _outputFiles.length; _i++) {
          const _idx = _i;
          const _n = _idx + 1;

          it(`SF-${_dirName}-${_n}-title: segments[${_idx}].title が output-${_n} と一致する`, () => {
            assertEquals(_segments[_idx].title, _expectedSegments[_idx].title);
          });

          it(`SF-${_dirName}-${_n}-summary: segments[${_idx}].summary が output-${_n} と一致する`, () => {
            assertEquals(_segments[_idx].summary, _expectedSegments[_idx].summary);
          });

          it(`SF-${_dirName}-${_n}-body: segments[${_idx}].body が output-${_n} の Excerpt と一致する`, () => {
            assertEquals(_segments[_idx].body, _expectedSegments[_idx].body);
          });

          it(`SF-${_dirName}-${_n}-output: 生成した本文が output-${_n}.md と完全一致する`, async () => {
            const _actual = await _buildExpectedOutput(_segments[_idx], _sourceMeta, _inputPath, _idx);
            assertEquals(_actual, _expectedRaws[_idx]);
          });

          for (const _key of FRONTMATTER_KEYS) {
            it(`SF-${_dirName}-${_n}-frontmatter-${_key}: フロントマターの ${_key} が output-${_n} と一致する`, async () => {
              const _actual = await _buildExpectedOutput(_segments[_idx], _sourceMeta, _inputPath, _idx);
              const { meta: _actualMeta } = parseFrontmatter(_actual);
              const { meta: _expectedMeta } = parseFrontmatter(_expectedRaws[_idx]);
              assertEquals(_actualMeta[_key], _expectedMeta[_key]);
            });
          }
        }
      });
    });
  });
}
