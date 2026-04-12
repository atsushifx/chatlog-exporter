// src: scripts/__tests__/system/export-chatlog.fixtures.system.spec.ts
// @(#): export-chatlog システムテスト（実 JSONL パーサー使用）
//       _fixtures/export-chatlog/ 下の各ディレクトリを再帰スキャンし
//       input.jsonl を parseClaudeSession / parseCodexSession でパースして
//       output.yaml の期待値と照合する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';
import { parse as parseYaml } from '@std/yaml';

<<<<<<< HEAD:.claude/commands/scripts/__tests__/system/export-chatlog.fixtures.system.spec.ts
import { parseClaudeSession, parseCodexSession, parsePeriod } from '../../../../export-chatlog/scripts/export-chatlog.ts';
import type { PeriodRange } from '../../../../export-chatlog/scripts/export-chatlog.ts';
||||||| parent of 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):.claude/commands/scripts/__tests__/system/export-chatlog.fixtures.system.spec.ts
=======
import { parseClaudeSession, parseCodexSession, parsePeriod } from '../../export-chatlog.ts';
import type { PeriodRange } from '../../export-chatlog.ts';
>>>>>>> 6671f79 (test(helpers): move helpers to skills/_scripts and update imports):skills/normalize-chatlog/scripts/__tests__/system/export-chatlog.fixtures.system.spec.ts

// ─── フィクスチャパス ──────────────────────────────────────────────────────────

const FIXTURES_DIR = new URL('../_fixtures/export-chatlog', import.meta.url)
  .pathname
  .replace(/^\/([A-Z]:)/, '$1'); // Windows: /C:/... → C:/...

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const ALL_PERIOD: PeriodRange = parsePeriod(undefined);

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface FixtureOutput {
  sessionId: string;
  date: string;
  project: string;
  turnCount: number;
  firstUserText: string;
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

/**
 * agentType ディレクトリ（"claude-sessions" または "codex-sessions"）配下の
 * サブディレクトリを収集する
 */
async function _collectSessionDirs(agentDir: string): Promise<string[]> {
  const dirs: string[] = [];
  try {
    for await (const entry of Deno.readDir(agentDir)) {
      if (!entry.isDirectory) { continue; }
      const childAbs = `${agentDir}/${entry.name}`;
      // input.jsonl があるディレクトリのみを対象にする
      try {
        await Deno.stat(`${childAbs}/input.jsonl`);
        dirs.push(entry.name);
      } catch {
        // input.jsonl がなければスキップ
      }
    }
  } catch {
    // ディレクトリが存在しない場合はスキップ
  }
  return dirs.sort();
}

/** output.yaml が存在する場合に読み込む（edge 系は null） */
async function _loadOutputOrNull(dir: string): Promise<FixtureOutput | null> {
  try {
    const content = await Deno.readTextFile(`${dir}/output.yaml`);
    return parseYaml(content) as FixtureOutput;
  } catch {
    return null;
  }
}

// ─── Claude セッション fixture テスト ────────────────────────────────────────

const _claudeFixturesDir = `${FIXTURES_DIR}/claude-sessions`;
const _claudeFixtureDirs = await _collectSessionDirs(_claudeFixturesDir);

for (const _relPath of _claudeFixtureDirs) {
  const _fixtureDir = `${_claudeFixturesDir}/${_relPath}`;
  const _inputPath = `${_fixtureDir}/input.jsonl`;
  const _expectedOutput = await _loadOutputOrNull(_fixtureDir);
  const _isEdge = _relPath.includes('edge');

  describe(`parseClaudeSession — claude-sessions/${_relPath}`, () => {
    describe(`Given: claude-sessions/${_relPath}/input.jsonl`, () => {
      describe('When: parseClaudeSession(inputPath, allPeriod) を呼び出す', () => {
        if (_isEdge) {
          // edge 系: null が返ることを確認
          it(`SF-EC-claude-${_relPath}-null: null を返す`, async () => {
            const result = await parseClaudeSession(_inputPath, ALL_PERIOD);
            assertEquals(result, null);
          });
        } else if (_expectedOutput) {
          // 正常系: output.yaml と照合
          it(`SF-EC-claude-${_relPath}-sessionId: meta.sessionId が一致する`, async () => {
            const result = await parseClaudeSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.sessionId, _expectedOutput.sessionId);
          });

          it(`SF-EC-claude-${_relPath}-date: meta.date が一致する`, async () => {
            const result = await parseClaudeSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.date, _expectedOutput.date);
          });

          it(`SF-EC-claude-${_relPath}-project: meta.project が一致する`, async () => {
            const result = await parseClaudeSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.project, _expectedOutput.project);
          });

          it(`SF-EC-claude-${_relPath}-turnCount: turns の件数が一致する`, async () => {
            const result = await parseClaudeSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.turns.length, _expectedOutput.turnCount);
          });

          it(`SF-EC-claude-${_relPath}-firstUserText: firstUserText が一致する`, async () => {
            const result = await parseClaudeSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.firstUserText, _expectedOutput.firstUserText);
          });
        }
      });
    });
  });
}

// ─── Codex セッション fixture テスト ─────────────────────────────────────────

const _codexFixturesDir = `${FIXTURES_DIR}/codex-sessions`;
const _codexFixtureDirs = await _collectSessionDirs(_codexFixturesDir);

for (const _relPath of _codexFixtureDirs) {
  const _fixtureDir = `${_codexFixturesDir}/${_relPath}`;
  const _inputPath = `${_fixtureDir}/input.jsonl`;
  const _expectedOutput = await _loadOutputOrNull(_fixtureDir);
  const _isEdge = _relPath.includes('edge');

  describe(`parseCodexSession — codex-sessions/${_relPath}`, () => {
    describe(`Given: codex-sessions/${_relPath}/input.jsonl`, () => {
      describe('When: parseCodexSession(inputPath, allPeriod) を呼び出す', () => {
        if (_isEdge) {
          // edge 系: null が返ることを確認
          it(`SF-EC-codex-${_relPath}-null: null を返す`, async () => {
            const result = await parseCodexSession(_inputPath, ALL_PERIOD);
            assertEquals(result, null);
          });
        } else if (_expectedOutput) {
          // 正常系: output.yaml と照合
          it(`SF-EC-codex-${_relPath}-sessionId: meta.sessionId が一致する`, async () => {
            const result = await parseCodexSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.sessionId, _expectedOutput.sessionId);
          });

          it(`SF-EC-codex-${_relPath}-date: meta.date が一致する`, async () => {
            const result = await parseCodexSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.date, _expectedOutput.date);
          });

          it(`SF-EC-codex-${_relPath}-project: meta.project が一致する`, async () => {
            const result = await parseCodexSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.project, _expectedOutput.project);
          });

          it(`SF-EC-codex-${_relPath}-turnCount: turns の件数が一致する`, async () => {
            const result = await parseCodexSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.turns.length, _expectedOutput.turnCount);
          });

          it(`SF-EC-codex-${_relPath}-firstUserText: firstUserText が一致する`, async () => {
            const result = await parseCodexSession(_inputPath, ALL_PERIOD);
            assertEquals(result!.meta.firstUserText, _expectedOutput.firstUserText);
          });
        }
      });
    });
  });
}
