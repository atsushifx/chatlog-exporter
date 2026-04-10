#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/__tests__/system/normalize-chatlog.fixtures-segments.system.spec.ts
// @(#): ファイル駆動システムテスト
//       対象: segmentChatlog() — _fixtures/runai-segments/ 下の各ディレクトリを自動スキャンし
//             input.md を入力、output.yaml の count を期待セグメント数として照合する
//       責務: セグメント数のみ検証する
//             セグメントフィールド・markdown 生成・フロントマター検証は別テストで行う
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals } from '@std/assert';
import { parse as parseYaml } from '@std/yaml';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test helpers
import { installCommandMock, makeSuccessMock } from '../_helpers/deno-command-mock.ts';

// test target
import { segmentChatlog } from '../../normalize-chatlog.ts';
import type { Segment } from '../../normalize-chatlog.ts';

// ─── fixtures ルートパス ──────────────────────────────────────────────────────

const RUNAI_FIXTURES_DIR = new URL('../_fixtures/runai-segments', import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  '$1',
);

// ─── helpers ─────────────────────────────────────────────────────────────────

/** output.yaml から期待セグメント数を読み込む */
async function _loadExpectedCount(dir: string): Promise<number> {
  const content = await Deno.readTextFile(`${dir}/output.yaml`);
  const { count } = parseYaml(content) as { count: number };
  return count;
}

/** _fixtures/runai-segments/ 下のサブディレクトリ名を収集して返す */
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
  const _expectedCount = await _loadExpectedCount(_fixtureDir);

  describe(`segmentChatlog — runai-segments/${_dirName}`, () => {
    describe(`Given: ${_dirName}/input.md と output.yaml (count: ${_expectedCount})`, () => {
      let _segments: Segment[];
      let _mockHandle: ReturnType<typeof installCommandMock>;

      beforeEach(async () => {
        const _mockSegments = Array.from({ length: _expectedCount }, () => ({
          title: '',
          summary: '',
          body: '',
        }));
        const _stdout = new TextEncoder().encode(JSON.stringify(_mockSegments));
        _mockHandle = installCommandMock(makeSuccessMock(_stdout));

        const _inputContent = await Deno.readTextFile(_inputPath);
        const _result = await segmentChatlog(_inputPath, _inputContent);
        _segments = _result ?? [];
      });

      afterEach(() => {
        _mockHandle.restore();
      });

      describe('When: segmentChatlog(inputPath, content) を呼び出す', () => {
        it(`SF-${_dirName}-count: セグメント数が output.yaml の count と一致する`, () => {
          assertEquals(_segments.length, _expectedCount);
        });
      });
    });
  });
}
