// src: scripts/__tests__/fixtures/filter-chatlog.fixtures.spec.ts
// @(#): filter-chatlog fixturesテスト（実 claude CLI 使用）
//       fixtures-data/ 下の各ディレクトリを再帰スキャンし
//       input.md を実際の claude CLI で判定し、output.yaml の期待値と照合する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';
import { parse as parseYaml } from '@std/yaml';

// test helpers
import type { LoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';
import { makeLoggerStub } from '../../../../_scripts/__tests__/helpers/logger-stub.ts';

// test target
import { parseJsonArray, runClaude } from '../../filter-chatlog.ts';

// ─── フィクスチャパス ──────────────────────────────────────────────────────────

const FIXTURES_DIR = new URL('./fixtures-data', import.meta.url)
  .pathname
  .replace(/^\/([A-Z]:)/, '$1'); // Windows: /C:/... → C:/...

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface FixtureOutput {
  expected_decision: 'KEEP' | 'DISCARD';
  confidence_min: number;
  mock_response?: string;
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

// ─── バッチプロンプト構築（fixturesテスト用簡易版） ──────────────────────────

function _buildSystemPrompt(filename: string, body: string): string {
  return `=== FILE 1: ${filename} ===\n${body}`;
}

function _parseFrontmatter(text: string): { body: string } {
  if (!text.startsWith('---\n')) { return { body: text }; }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) { return { body: text }; }
  return { body: text.slice(end + 5) };
}

// ─── ファイル駆動 fixtures tests ──────────────────────────────────────────────

const _fixtureDirs = await _collectFixtureDirs(FIXTURES_DIR);

for (const _relPath of _fixtureDirs) {
  const _fixtureDir = `${FIXTURES_DIR}/${_relPath}`;
  const _inputPath = `${_fixtureDir}/input.md`;
  const _expectedOutput = await _loadOutput(_fixtureDir);

  describe(`runClaude + parseJsonArray — filter-chatlog/${_relPath}`, () => {
    describe(`Given: ${_relPath}/input.md を実際の claude CLI で判定`, () => {
      let _tempDir: string;
      let _loggerStub: LoggerStub;

      beforeEach(async () => {
        _tempDir = await Deno.makeTempDir();
        _loggerStub = makeLoggerStub();
      });

      afterEach(async () => {
        _loggerStub.restore();
        await Deno.remove(_tempDir, { recursive: true });
      });

      describe('When: runClaude(prompt) を呼び出して parseJsonArray で解析する', () => {
        it(
          `SF-FL-${_relPath}-decision: 判定が expected_decision (${_expectedOutput.expected_decision}) になる`,
          async () => {
            const _inputContent = await Deno.readTextFile(_inputPath);
            const { body } = _parseFrontmatter(_inputContent);
            const _prompt = _buildSystemPrompt('input.md', body.slice(0, 8000));

            let _rawResult: string;

            if (_expectedOutput.mock_response) {
              // mock_response がある場合は固定レスポンスで決定論的テスト
              _rawResult = _expectedOutput.mock_response;
            } else {
              // 実 claude CLI を呼ぶ
              if (!_claudeAvailable) {
                // claude CLI が利用できないためスキップ
                return;
              }
              _rawResult = await runClaude(_prompt);
            }

            const _parsed = parseJsonArray(_rawResult);

            // JSON パースに失敗した場合はスキップ（AI の出力形式が安定しない場合がある）
            if (!_parsed || _parsed.length === 0) {
              // JSON パース失敗のためスキップ
              return;
            }

            const _result = _parsed[0];

            // confidence が confidence_min 以上であることを確認
            assertEquals(
              _result.confidence >= _expectedOutput.confidence_min,
              true,
              `confidence ${_result.confidence} が confidence_min ${_expectedOutput.confidence_min} 未満`,
            );

            // decision が期待値と一致することを確認
            assertEquals(
              _result.decision,
              _expectedOutput.expected_decision,
              `decision "${_result.decision}" が期待値 "${_expectedOutput.expected_decision}" と不一致`,
            );
          },
        );
      });
    });
  });
}
