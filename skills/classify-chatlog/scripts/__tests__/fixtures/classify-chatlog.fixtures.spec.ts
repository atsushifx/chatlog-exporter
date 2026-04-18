// src: scripts/__tests__/fixtures/classify-chatlog.fixtures.spec.ts
// @(#): classify-chatlog fixturesテスト（実 claude CLI 使用）
//       fixtures-data/ 下の各ディレクトリを再帰スキャンし
//       input.md を実際の claude CLI で分類し、output.yaml の期待値と照合する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { parse as parseYaml } from '@std/yaml';

// test target
import { processChunk } from '../../classify-chatlog.ts';
import type { FileMeta, Stats } from '../../types/classify.types.ts';

// helpers
import type { LoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';
import { makeLoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';

// ─── フィクスチャパス ──────────────────────────────────────────────────────────

const FIXTURES_DIR = new URL('./fixtures-data', import.meta.url)
  .pathname
  .replace(/^\/([A-Z]:)/, '$1'); // Windows: /C:/... → C:/...

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface FixtureOutput {
  expected_project?: string;
  known_projects: string[];
  confidence_min: number;
}

// ─── claude CLI の存在確認 ────────────────────────────────────────────────────

async function _isClaudeAvailable(): Promise<boolean> {
  try {
    const cmd = new Deno.Command('claude', { args: ['--version'], stdout: 'null', stderr: 'null' });
    const result = await cmd.output();
    return result.success;
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

/** projects.dic からプロジェクトリストを読み込む */
async function _loadProjectsDic(): Promise<string[]> {
  const content = await Deno.readTextFile(`${FIXTURES_DIR}/projects.dic`);
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line !== 'misc');
}

/**
 * FIXTURES_DIR 直下のサブディレクトリを収集する。
 * input.md を持つディレクトリのみを対象とする。
 */
async function _collectFixtureDirs(rootDir: string): Promise<string[]> {
  const dirs: string[] = [];
  for await (const entry of Deno.readDir(rootDir)) {
    if (!entry.isDirectory) { continue; }
    const childAbs = `${rootDir}/${entry.name}`;
    try {
      await Deno.stat(`${childAbs}/input.md`);
      dirs.push(entry.name);
    } catch {
      // input.md がなければスキップ
    }
  }
  return dirs.sort();
}

// ─── ファイル駆動 fixtures tests ──────────────────────────────────────────────

const _fixtureDirs = await _collectFixtureDirs(FIXTURES_DIR);
const _projects = await _loadProjectsDic();

for (const _relPath of _fixtureDirs) {
  const _fixtureDir = `${FIXTURES_DIR}/${_relPath}`;
  const _inputPath = `${_fixtureDir}/input.md`;
  const _expectedOutput = await _loadOutput(_fixtureDir);

  describe(`processChunk — classify-chatlog/${_relPath}`, () => {
    describe(`Given: ${_relPath}/input.md と projects.dic`, () => {
      let _tempDir: string;
      let _stats: Stats;
      let _inputContent: string;
      let _loggerStub: LoggerStub;

      beforeEach(async () => {
        _tempDir = await Deno.makeTempDir();
        _stats = { moved: 0, skipped: 0, error: 0 };
        _inputContent = await Deno.readTextFile(_inputPath);

        // input.md を tempdir にコピー
        await Deno.writeTextFile(`${_tempDir}/input.md`, _inputContent);
        _loggerStub = makeLoggerStub();
      });

      afterEach(async () => {
        _loggerStub.restore();
        await Deno.remove(_tempDir, { recursive: true });
      });

      describe('When: processChunk(chunkMetas, projects, false, stats) を呼び出す', () => {
        it(`SF-CL-${_relPath}-project: 分類結果が known_projects に含まれる`, async () => {
          if (!_claudeAvailable) {
            console.warn('  [SKIP] claude CLI が利用できないためスキップ');
            return;
          }

          const _fileMeta: FileMeta = {
            filePath: `${_tempDir}/input.md`,
            filename: 'input.md',
            existingProject: '',
            title: '',
            category: '',
            topics: [],
            tags: [],
            fullText: _inputContent,
          };

          // フロントマターからメタデータを取得（簡易パース）
          const _fm = _extractFrontmatterFields(_inputContent);
          _fileMeta.title = _fm.title;
          _fileMeta.category = _fm.category;
          _fileMeta.topics = _fm.topics;
          _fileMeta.tags = _fm.tags;

          await processChunk([_fileMeta], _projects, false, _stats);

          // classify / moved ログがキャプチャされていることを確認
          assertEquals(
            _loggerStub.infoLogs.some((l) => l.includes('classify:')),
            true,
            'classify ログが infoLogs に記録されていない',
          );
          assertEquals(
            _loggerStub.infoLogs.some((l) => l.includes('moved:')),
            true,
            'moved ログが infoLogs に記録されていない',
          );

          // 移動先ディレクトリを確認してプロジェクト名を取得
          const _movedProject = await _findMovedProject(_tempDir);

          if (_expectedOutput.expected_project !== undefined) {
            assertEquals(
              _movedProject,
              _expectedOutput.expected_project,
              `分類先 "${_movedProject}" が期待値 "${_expectedOutput.expected_project}" と一致しない`,
            );
          } else {
            assertEquals(
              _expectedOutput.known_projects.includes(_movedProject),
              true,
              `分類先 "${_movedProject}" が known_projects に含まれていない`,
            );
          }
        });
      });
    });
  });
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

/** フロントマターから title/category/topics/tags を簡易抽出する */
function _extractFrontmatterFields(text: string): {
  title: string;
  category: string;
  topics: string[];
  tags: string[];
} {
  const result = { title: '', category: '', topics: [] as string[], tags: [] as string[] };
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) { return result; }
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) { return result; }

  const fmLines = normalized.slice(4, end).split('\n');
  let currentList: string[] | null = null;

  for (const line of fmLines) {
    const listMatch = line.match(/^\s{2}- (.+)$/);
    if (listMatch && currentList) {
      currentList.push(listMatch[1].trim());
      continue;
    }
    currentList = null;
    if (line.startsWith('title:')) { result.title = line.slice('title:'.length).trim(); }
    else if (line.startsWith('category:')) { result.category = line.slice('category:'.length).trim(); }
    else if (line === 'topics:') { currentList = result.topics; }
    else if (line === 'tags:') { currentList = result.tags; }
  }
  return result;
}

/**
 * tempDir 内に作成されたサブディレクトリを探し、移動先プロジェクト名を返す。
 * ファイルが移動されていない場合は "misc" を返す。
 */
async function _findMovedProject(tempDir: string): Promise<string> {
  try {
    for await (const entry of Deno.readDir(tempDir)) {
      if (entry.isDirectory) {
        return entry.name;
      }
    }
  } catch {
    // エラー時はフォールバック
  }
  return 'misc';
}
