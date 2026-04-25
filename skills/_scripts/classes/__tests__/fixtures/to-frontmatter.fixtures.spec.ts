// src: skills/_scripts/classes/__tests__/fixtures/to-frontmatter.fixtures.spec.ts
// @(#): ChatlogFrontmatter.toFrontmatter() fixtures テスト
//       fixtures-data/to-frontmatter/ 下の各ディレクトリをスキャンし
//       input.md を処理し、expected.md の期待値と照合する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { parse as parseYaml } from '@std/yaml';

// -- test target --
import { ChatlogFrontmatter } from '../../ChatlogFrontmatter.class.ts';

// ─────────────────────────────────────────────
// toFrontmatter — ファイルベース fixtures
// ─────────────────────────────────────────────

interface _FixtureConfig {
  fieldOrder: string[];
}

const FIXTURES_DIR = new URL('./fixtures-data/to-frontmatter', import.meta.url)
  .pathname
  .replace(/^\/([A-Z]:)/, '$1');

async function _collectFixtureDirs(rootDir: string): Promise<string[]> {
  const dirs: string[] = [];
  try {
    for await (const entry of Deno.readDir(rootDir)) {
      if (!entry.isDirectory) { continue; }
      const childAbs = `${rootDir}/${entry.name}`;
      try {
        await Deno.stat(`${childAbs}/input.md`);
        await Deno.stat(`${childAbs}/config.yaml`);
        dirs.push(entry.name);
      } catch {
        // input.md または config.yaml がなければスキップ
      }
    }
  } catch {
    // ディレクトリが存在しない場合はスキップ
  }
  return dirs.sort();
}

async function _loadFixture(
  dir: string,
): Promise<{ input: string; fieldOrder: string[]; expected: string }> {
  const input = await Deno.readTextFile(`${dir}/input.md`);
  const configRaw = await Deno.readTextFile(`${dir}/config.yaml`);
  const config = parseYaml(configRaw) as _FixtureConfig;
  const expected = await Deno.readTextFile(`${dir}/expected.md`);
  return { input, fieldOrder: config.fieldOrder, expected };
}

const _fixtureDirs = await _collectFixtureDirs(FIXTURES_DIR);
const _fixtures = await Promise.all(
  _fixtureDirs.map(async (relPath) => ({ relPath, ...await _loadFixture(`${FIXTURES_DIR}/${relPath}`) })),
);

describe('toFrontmatter', () => {
  describe('Given: fixtures-data/to-frontmatter/ 下の各 fixture ディレクトリ', () => {
    describe('When: toFrontmatter(fieldOrder) を呼び出す', () => {
      describe('Then: expected.md と一致する', () => {
        for (const { relPath: _relPath, input, fieldOrder, expected } of _fixtures) {
          it(`TF-CF-${_relPath}: toFrontmatter の出力が期待値と一致する`, () => {
            const fm = new ChatlogFrontmatter(input);
            const result = fm.toFrontmatter(fieldOrder);
            assertEquals(result, expected);
          });
        }
      });
    });
  });
});
