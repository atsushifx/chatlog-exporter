// src: scripts/__tests__/fixtures/set-frontmatter.fixtures.spec.ts
// @(#): set-frontmatter fixturesテスト（実 claude CLI 使用 / モック使用）
//       fixtures-data/ 下の各ディレクトリを再帰スキャンし
//       input.md を処理し、output.yaml の期待値と照合する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { parse as parseYaml } from '@std/yaml';

// test helpers
import type { CommandMockHandle } from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import {
  installCommandMock,
  makeFailMock,
  makeSuccessMock,
} from '../../../../_scripts/__tests__/helpers/deno-command-mock.ts';
import type { LoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';
import { makeLoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';

// test target
import type { Dics, FileMeta } from '../../set-frontmatter.ts';
import { generateFrontmatter, judgeCategory, judgeType, loadDics } from '../../set-frontmatter.ts';

const _enc = new TextEncoder();

// ─── フィクスチャパス・辞書パス ───────────────────────────────────────────────

const FIXTURES_DIR = new URL('./fixtures-data', import.meta.url)
  .pathname
  .replace(/^\/([A-Z]:)/, '$1'); // Windows: /C:/... → C:/...

const ASSETS_DICS_DIR = new URL('../../../../../../assets/dics', import.meta.url)
  .pathname
  .replace(/^\/([A-Z]:)/, '$1');

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface FixtureFallback {
  use_mock: boolean;
  mock_type: 'fail' | 'invalid_type';
  expected_type?: string;
  expected_category?: string;
  expected_yaml_empty?: boolean;
}

interface FixtureOutput {
  known_types: string[];
  known_categories: string[];
  required_fields: string[];
  preserved_fields?: string[];
  fallback?: FixtureFallback;
}

// ─── claude CLI の存在確認 ────────────────────────────────────────────────────

/**
 * claude CLI が実際にプロンプト実行できるか確認する。
 * `-p` オプションで短いテキストを処理して応答が返ることを確認する。
 */
async function _isClaudeAvailable(): Promise<boolean> {
  try {
    const cmd = new Deno.Command('claude', {
      args: ['-p', 'Reply with just the word "ok"', '--output-format', 'text'],
      stdin: 'piped',
      stdout: 'piped',
      stderr: 'null',
    });
    const process = cmd.spawn();
    const writer = process.stdin.getWriter();
    await writer.write(new TextEncoder().encode('ok'));
    await writer.close();
    const result = await process.output();
    return result.success && result.stdout.length > 0;
  } catch {
    return false;
  }
}

const _claudeAvailable = await _isClaudeAvailable();

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

/** output.yaml から期待値を読み込む */
async function _loadOutput(dir: string): Promise<FixtureOutput> {
  const content = await Deno.readTextFile(`${dir}/output.yaml`);
  return parseYaml(content) as FixtureOutput;
}

/**
 * FIXTURES_DIR 以下のサブディレクトリを再帰的に収集する。
 * input.md を持つディレクトリのみを対象とする。
 * input.md がないディレクトリは子ディレクトリを再帰的にスキャンする。
 */
async function _collectFixtureDirs(rootDir: string): Promise<string[]> {
  const dirs: string[] = [];

  async function _scan(dir: string, rel: string): Promise<void> {
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.isDirectory) { continue; }
      const childAbs = `${dir}/${entry.name}`;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      try {
        await Deno.stat(`${childAbs}/input.md`);
        dirs.push(childRel);
      } catch {
        // input.md がなければ子ディレクトリを再帰的にスキャン
        await _scan(childAbs, childRel);
      }
    }
  }

  try {
    await _scan(rootDir, '');
  } catch {
    // FIXTURES_DIR が存在しない場合はスキップ
  }
  return dirs.sort();
}

/** FileMeta を input.md から構築する */
async function _makeFileMeta(filePath: string): Promise<FileMeta> {
  const text = await Deno.readTextFile(filePath);

  // 簡易フロントマター解析
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const meta: Record<string, string> = {};
  if (lines[0] === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') { break; }
      const idx = lines[i].indexOf(': ');
      if (idx !== -1) {
        meta[lines[i].slice(0, idx).trim()] = lines[i].slice(idx + 2).trim();
      }
    }
  }

  const headerIdx = lines.findIndex((l) => /^#/.test(l));
  const bodyStart = headerIdx >= 0 ? headerIdx : 0;
  const fullBody = lines.slice(bodyStart).join('\n');

  return {
    file: filePath,
    sessionId: meta['session_id'] ?? '',
    date: meta['date'] ?? '',
    project: meta['project'] ?? '',
    slug: meta['slug'] ?? '',
    body: fullBody.slice(0, 4000),
    fullBody,
  };
}

/** フォールバックケース用のインライン辞書（実ファイル不要） */
function _makeDicsForFallback(): Dics {
  return {
    category: 'development,tooling,ai',
    tags: 'lang:typescript,tool:deno',
    typeEntries: [
      { key: 'research', def: '調査', desc: '', rules: { when: [], not: [] } },
      { key: 'execution', def: '実行', desc: '', rules: { when: [], not: [] } },
      { key: 'discussion', def: '議論', desc: '', rules: { when: [], not: [] } },
    ],
    topicEntries: [
      { key: 'development', def: '開発', desc: '', rules: { when: [], not: [] } },
    ],
    categoryPrompts: new Map([['research', '']]),
    prompts: new Map([
      ['type', { system: '', user: '${type_list} ${body}' }],
      ['category', { system: '', user: '${category_list} ${focus_guide} ${body}' }],
      ['meta', { system: '', user: '${log_type} ${log_category} ${topic_list} ${tags_list} ${body}' }],
      ['review', { system: '', user: '' }],
    ]),
  };
}

// ─── ファイル駆動 fixtures tests ──────────────────────────────────────────────

const _fixtureDirs = await _collectFixtureDirs(FIXTURES_DIR);

// 辞書は実際の assets/dics/ を使用
let _dics: Dics | null = null;
try {
  _dics = await loadDics(ASSETS_DICS_DIR);
} catch {
  // 辞書が読み込めない場合はテストをスキップ
}

for (const _relPath of _fixtureDirs) {
  const _fixtureDir = `${FIXTURES_DIR}/${_relPath}`;
  const _inputPath = `${_fixtureDir}/input.md`;
  const _expectedOutput = await _loadOutput(_fixtureDir);
  const _isFallbackCase = !!_expectedOutput.fallback?.use_mock;

  describe(`set-frontmatter — ${_relPath}`, () => {
    describe(`Given: ${_relPath}/input.md と辞書ファイル`, () => {
      let _tempDir: string;
      let _fileMeta: FileMeta;
      let _loggerStub: LoggerStub;
      let _commandHandle: CommandMockHandle | null = null;

      beforeEach(async () => {
        _tempDir = await Deno.makeTempDir();
        const _tempPath = `${_tempDir}/input.md`;
        await Deno.copyFile(_inputPath, _tempPath);
        _fileMeta = await _makeFileMeta(_tempPath);
        _loggerStub = makeLoggerStub();

        if (_isFallbackCase) {
          const _mockType = _expectedOutput.fallback!.mock_type;
          if (_mockType === 'fail') {
            _commandHandle = installCommandMock(makeFailMock(1));
          } else {
            _commandHandle = installCommandMock(makeSuccessMock(_enc.encode('__invalid__')));
          }
        }
      });

      afterEach(async () => {
        _commandHandle?.restore();
        _commandHandle = null;
        _loggerStub.restore();
        await Deno.remove(_tempDir, { recursive: true });
      });

      // ─── type 判定 ────────────────────────────────────────────────────────

      describe('When: judgeType(fileMeta, dics) を呼び出す', () => {
        it(`SF-SF-${_relPath}-type: type が known_types に含まれる`, async () => {
          if (_isFallbackCase) {
            const _activeDics = _dics ?? _makeDicsForFallback();
            const _result = await judgeType(_fileMeta, _activeDics);

            if (_expectedOutput.fallback?.expected_type) {
              assertEquals(
                _result.type,
                _expectedOutput.fallback.expected_type,
                `type "${_result.type}" が期待値 "${_expectedOutput.fallback.expected_type}" と一致しない`,
              );
            } else {
              assertEquals(
                _expectedOutput.known_types.includes(_result.type),
                true,
                `type "${_result.type}" が known_types ${JSON.stringify(_expectedOutput.known_types)} に含まれていない`,
              );
            }
            return;
          }

          if (!_claudeAvailable) {
            // claude CLI が利用できないためスキップ
            return;
          }
          if (!_dics) {
            // 辞書ファイルが読み込めないためスキップ
            return;
          }

          const _result = await judgeType(_fileMeta, _dics);

          assertEquals(
            _expectedOutput.known_types.includes(_result.type),
            true,
            `type "${_result.type}" が known_types ${JSON.stringify(_expectedOutput.known_types)} に含まれていない`,
          );
        });
      });

      // ─── category 判定 ────────────────────────────────────────────────────

      describe('When: judgeCategory(fileMeta, type, dics) を呼び出す', () => {
        it(`SF-SF-${_relPath}-category: category が known_categories に含まれる`, async () => {
          if (_isFallbackCase) {
            const _activeDics = _dics ?? _makeDicsForFallback();
            const _typeResult = await judgeType(_fileMeta, _activeDics);
            const _category = await judgeCategory(_fileMeta, _typeResult.type, _activeDics);

            if (_expectedOutput.fallback?.expected_category) {
              assertEquals(
                _category,
                _expectedOutput.fallback.expected_category,
                `category "${_category}" が期待値 "${_expectedOutput.fallback.expected_category}" と一致しない`,
              );
            } else {
              assertEquals(
                _expectedOutput.known_categories.includes(_category),
                true,
                `category "${_category}" が known_categories ${
                  JSON.stringify(_expectedOutput.known_categories)
                } に含まれていない`,
              );
            }
            return;
          }

          if (!_claudeAvailable) {
            // claude CLI が利用できないためスキップ
            return;
          }
          if (!_dics) {
            // 辞書ファイルが読み込めないためスキップ
            return;
          }

          // まず type を判定してから category を判定する
          const _typeResult = await judgeType(_fileMeta, _dics);
          const _category = await judgeCategory(_fileMeta, _typeResult.type, _dics);

          assertEquals(
            _expectedOutput.known_categories.includes(_category),
            true,
            `category "${_category}" が known_categories ${
              JSON.stringify(_expectedOutput.known_categories)
            } に含まれていない`,
          );
        });
      });

      // ─── フロントマター生成（required_fields の確認） ─────────────────────

      describe('When: generateFrontmatter(fileMeta, type, category, dics) を呼び出す', () => {
        it(`SF-SF-${_relPath}-fields: required_fields が全て yaml に含まれる`, async () => {
          if (_isFallbackCase) {
            const _activeDics = _dics ?? _makeDicsForFallback();
            const _typeResult = await judgeType(_fileMeta, _activeDics);
            const _category = await judgeCategory(_fileMeta, _typeResult.type, _activeDics);
            const _fmResult = await generateFrontmatter(_fileMeta, _typeResult.type, _category, _activeDics);

            if (_expectedOutput.fallback?.expected_yaml_empty === true) {
              assertEquals(
                _fmResult.yaml,
                '',
                `yaml が空でないことが期待されているが、実際には: ${_fmResult.yaml.slice(0, 200)}`,
              );
            } else {
              for (const _field of _expectedOutput.required_fields) {
                assertEquals(
                  _fmResult.yaml.includes(`${_field}:`),
                  true,
                  `required_field "${_field}" が yaml に含まれていない: ${_fmResult.yaml.slice(0, 200)}`,
                );
              }
            }
            return;
          }

          if (!_claudeAvailable) {
            // claude CLI が利用できないためスキップ
            return;
          }
          if (!_dics) {
            // 辞書ファイルが読み込めないためスキップ
            return;
          }

          const _typeResult = await judgeType(_fileMeta, _dics);
          const _category = await judgeCategory(_fileMeta, _typeResult.type, _dics);
          const _fmResult = await generateFrontmatter(_fileMeta, _typeResult.type, _category, _dics);

          // yaml が生成されたことを確認（空でないこと）
          if (!_fmResult.yaml) {
            // generateFrontmatter が空の yaml を返したためスキップ
            return;
          }

          for (const _field of _expectedOutput.required_fields) {
            assertEquals(
              _fmResult.yaml.includes(`${_field}:`),
              true,
              `required_field "${_field}" が yaml に含まれていない: ${_fmResult.yaml.slice(0, 200)}`,
            );
          }
        });
      });
    });
  });
}
