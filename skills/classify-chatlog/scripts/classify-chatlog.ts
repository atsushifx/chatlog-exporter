#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
// src: scripts/classify-chatlog.ts
// @(#): チャットログをプロジェクト別サブディレクトリに分類する
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
/**
 * classify_chatlog.ts — チャットログをプロジェクト別サブディレクトリに分類する
 *
 * 使い方:
 *   deno run --allow-read --allow-run --allow-write classify_chatlog.ts \
 *     [agent] [YYYY-MM] [--dry-run] --input DIR --dics DIR
 */

// -- external --
import { isKnownAgent } from '../../_scripts/constants/agents.constants.ts';
import { runChunked } from '../../_scripts/libs/concurrency.ts';
import { findEntries } from '../../_scripts/libs/find-entries.ts';
import { parseJsonArray } from '../../_scripts/libs/json-utils.ts';
import { runAI } from '../../_scripts/libs/run-ai.ts';
import { getDirectory, isDirectoryArg, normalizeLine, normalizePath } from '../../_scripts/libs/utils.ts';
// instances
import { logger } from '../../_scripts/libs/logger.ts';
// constants
import { DEFAULT_AI_MODEL } from '../../_scripts/constants/common.constants.ts';
import { DEFAULT_CHUNK_SIZE, DEFAULT_CONCURRENCY } from '../../_scripts/constants/concurrency.constants.ts';
// classes
import { ChatlogError } from '../../_scripts/classes/ChatlogError.class.ts';

// -- internal --
import { FALLBACK_PROJECT, MIN_CLASSIFIABLE_LENGTH } from './constants/classify.constants.ts';
import type { ClassifyConfig, ClassifyResult, FileMeta, FrontmatterData, Stats } from './types/classify.types.ts';

const _VALID_MODELS = new Set([
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
  'opus',
  'sonnet',
  'haiku',
]);

// ─────────────────────────────────────────────
// 辞書読み込み
// ─────────────────────────────────────────────

export const loadProjects = async (dicsDir: string): Promise<string[]> => {
  const dicPath = `${dicsDir}/projects.dic`;
  let text: string;
  try {
    text = await Deno.readTextFile(dicPath);
  } catch {
    logger.warn(`projects.dic が見つかりません: ${dicPath}`);
    return [];
  }
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line !== FALLBACK_PROJECT);
};

// ─────────────────────────────────────────────
// フロントマター解析
// ─────────────────────────────────────────────

export const parseFrontmatter = (text: string): FrontmatterData => {
  const empty: FrontmatterData = {
    project: '',
    title: '',
    category: '',
    topics: [],
    tags: [],
    frontmatterEnd: 0,
  };

  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) { return empty; }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) { return empty; }

  const fmText = normalized.slice(4, end);
  const frontmatterEnd = end + 5; // '\n---\n' の後

  const lines = fmText.split('\n');
  const result: FrontmatterData = { project: '', title: '', category: '', topics: [], tags: [], frontmatterEnd };

  let currentList: string[] | null = null;

  for (const line of lines) {
    const listMatch = line.match(/^\s{2}- (.+)$/);
    if (listMatch && currentList) {
      currentList.push(listMatch[1].trim());
      continue;
    }

    currentList = null;

    if (line.startsWith('title:')) {
      result.title = line.slice('title:'.length).trim();
    } else if (line.startsWith('category:')) {
      result.category = line.slice('category:'.length).trim();
    } else if (line.startsWith('project:')) {
      result.project = line.slice('project:'.length).trim();
    } else if (line === 'topics:') {
      currentList = result.topics;
    } else if (line === 'tags:') {
      currentList = result.tags;
    }
  }

  return result;
};

// ─────────────────────────────────────────────
// フロントマターへ project フィールドを追加
// ─────────────────────────────────────────────

export const insertProjectField = (text: string, project: string): string => {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) { return text; }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) { return text; }

  const fmText = normalized.slice(4, end);
  const lines = fmText.split('\n');

  const newLines: string[] = [];
  let inserted = false;
  for (const line of lines) {
    newLines.push(line);
    if (!inserted && line.startsWith('date:')) {
      newLines.push(`project: ${project}`);
      inserted = true;
    }
  }
  if (!inserted) {
    newLines.unshift(`project: ${project}`);
  }

  return `---\n${newLines.join('\n')}\n---\n${normalized.slice(end + 5)}`;
};

// ─────────────────────────────────────────────
// ファイルメタデータ読み込み
// ─────────────────────────────────────────────

export const loadFileMeta = async (filePath: string): Promise<FileMeta | null> => {
  let text: string;
  try {
    text = await Deno.readTextFile(filePath);
  } catch {
    return null;
  }

  const filename = normalizePath(filePath).split('/').pop()!;
  const fm = parseFrontmatter(text);

  return {
    filePath,
    filename,
    existingProject: fm.project,
    title: fm.title,
    category: fm.category,
    topics: fm.topics,
    tags: fm.tags,
    fullText: text,
  };
};

// ─────────────────────────────────────────────
// バッチプロンプト構築
// ─────────────────────────────────────────────

export const buildClassifyPrompt = (files: FileMeta[], projects: string[]): string => {
  const _projectList = [...projects, FALLBACK_PROJECT].join(', ');
  const header = `Projects: ${_projectList}\n\n`;

  const _parts = files.map((f, i) => {
    const topicsStr = f.topics.length > 0 ? f.topics.join(', ') : '(none)';
    const tagsStr = f.tags.length > 0 ? f.tags.join(', ') : '(none)';
    const hasMeta = f.title || f.category || f.topics.length > 0 || f.tags.length > 0;
    const _lines = [
      `=== FILE ${i + 1}: ${f.filename} ===`,
      `title: ${f.title || '(no title)'}`,
      `category: ${f.category || '(none)'}`,
      `topics: ${topicsStr}`,
      `tags: ${tagsStr}`,
    ];
    if (!hasMeta) {
      const snippet = f.fullText.slice(0, 500).trim();
      _lines.push(`body: ${snippet}`);
    }
    return _lines.join('\n');
  });

  return header + _parts.join('\n\n');
};

export const buildSystemPrompt = (projects: string[]): string => {
  const _projectList = [...projects, FALLBACK_PROJECT].join(', ');
  return `Output ONLY a JSON array. No markdown, no explanation, no text before or after the array.
[{"file":"<filename>","project":"<project_name>","confidence":0.0,"reason":"..."},...]

Choose project ONLY from this list: ${_projectList}
If no project matches well, use "${FALLBACK_PROJECT}".
If the file has no metadata AND the body is fewer than 3 lines, assign "${FALLBACK_PROJECT}" unconditionally.
Base your decision on: title, category, topics, tags.`;
};

// ─────────────────────────────────────────────
// ファイル移動とフロントマター更新
// ─────────────────────────────────────────────

export const classifyFile = async (
  fileMeta: FileMeta,
  project: string,
  dryRun: boolean,
  stats: Stats,
): Promise<void> => {
  const srcPath = fileMeta.filePath;
  const srcDir = getDirectory(srcPath);
  const dstDir = `${srcDir}/${project}`;
  const dstPath = `${dstDir}/${fileMeta.filename}`;

  if (dryRun) {
    logger.info(`[dry-run] ${fileMeta.filename} → ${project}/`);
    stats.moved++;
    return;
  }

  try {
    await Deno.mkdir(dstDir, { recursive: true });
    await Deno.rename(srcPath, dstPath);

    // フロントマターに project フィールドを追加
    const newText = insertProjectField(fileMeta.fullText, project);
    await Deno.writeTextFile(dstPath, normalizeLine(newText));

    logger.info(`moved: ${fileMeta.filename} → ${project}/`);
    stats.moved++;
  } catch (e) {
    logger.error(`  移動失敗: ${fileMeta.filename}: ${e}`);
    stats.error++;
  }
};

// ─────────────────────────────────────────────
// チャンク処理
// ─────────────────────────────────────────────

export const processChunk = async (
  chunkMetas: FileMeta[],
  projects: string[],
  dryRun: boolean,
  stats: Stats,
  model: string,
): Promise<void> => {
  // フロントマターなし かつ 本文が短すぎるファイルは Claude に渡さず misc に直接分類
  const classifiable: FileMeta[] = [];
  for (const f of chunkMetas) {
    const hasMeta = f.title || f.category || f.topics.length > 0 || f.tags.length > 0;
    if (!hasMeta && f.fullText.trim().length < MIN_CLASSIFIABLE_LENGTH) {
      logger.warn(
        `[skip-ai: too-short] classify: ${f.filename} → ${FALLBACK_PROJECT} (本文が短すぎるため AI をスキップ)`,
      );
      await classifyFile(f, FALLBACK_PROJECT, dryRun, stats);
    } else {
      classifiable.push(f);
    }
  }
  if (classifiable.length === 0) { return; }

  const _batchPrompt = buildClassifyPrompt(classifiable, projects);
  const _systemPrompt = buildSystemPrompt(projects);

  let rawResult: string;
  try {
    rawResult = await runAI(_systemPrompt, _batchPrompt, { model });
  } catch (e) {
    logger.warn(`  claude CLI 実行失敗。チャンク内ファイルをすべて ${FALLBACK_PROJECT} 扱い`);
    logger.warn(`  error: ${e}`);
    for (const f of classifiable) {
      await classifyFile(f, FALLBACK_PROJECT, dryRun, stats);
    }
    return;
  }

  const parsed = parseJsonArray<ClassifyResult>(rawResult);
  if (!parsed) {
    logger.warn(`  JSON パース失敗。チャンク内ファイルをすべて ${FALLBACK_PROJECT} 扱い`);
    logger.warn(`  raw output: ${rawResult.slice(0, 200)}`);
    for (const f of classifiable) {
      await classifyFile(f, FALLBACK_PROJECT, dryRun, stats);
    }
    return;
  }

  for (const fileMeta of classifiable) {
    const result = parsed.find((r) => r.file === fileMeta.filename);
    const project = result?.project ?? FALLBACK_PROJECT;
    logger.info(`  classify: ${fileMeta.filename} → ${project} (conf=${result?.confidence ?? 0})`);
    await classifyFile(fileMeta, project, dryRun, stats);
  }
};

// ─────────────────────────────────────────────
// 引数解析
// ─────────────────────────────────────────────

export const parseArgs = (args: string[]): ClassifyConfig => {
  const _config: Record<string, string | boolean> = {};

  const _optKeys: Record<string, keyof ClassifyConfig> = {
    '--input': 'inputDir',
    '--dics': 'dicsDir',
    '--model': 'model',
  };

  const _optFlags: Record<string, keyof ClassifyConfig> = {
    '--dry-run': 'dryRun',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    const _flagAttr = _optFlags[arg];
    if (_flagAttr !== undefined) {
      _config[_flagAttr] = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const _eqIdx = arg.indexOf('=');
      const _hasEq = _eqIdx !== -1;
      const _key = _hasEq ? arg.slice(0, _eqIdx) : arg;
      const _value = _hasEq ? arg.slice(_eqIdx + 1) : undefined;

      const _attr = _optKeys[_key];
      if (_attr !== undefined) {
        if (_hasEq) {
          _config[_attr] = _value!;
        } else {
          if (i + 1 >= args.length) { throw new ChatlogError('InvalidArgs', `値が不足しています: ${_key}`); }
          _config[_attr] = args[++i];
        }
        continue;
      }

      throw new ChatlogError('InvalidArgs', `不明なオプション: ${arg}`);
    }

    // 通常パラメータ
    if (/^\d{4}-\d{2}$/.test(arg)) { // YYYY-MM
      _config['period'] = arg;
    } else if (isKnownAgent(arg)) { // agent
      _config['agent'] = arg;
    } else if (isDirectoryArg(arg)) { // directory path
      _config['inputDir'] = arg;
    } else {
      throw new ChatlogError('InvalidArgs', `不明な引数: ${arg}`);
    }
  }

  const _model = (_config['model'] ?? DEFAULT_AI_MODEL) as string;
  if (!_VALID_MODELS.has(_model)) {
    throw new ChatlogError('InvalidArgs', `不正なモデル名: ${_model}`);
  }
  return {
    agent: (_config['agent'] ?? 'chatgpt') as string,
    period: _config['period'] as string | undefined,
    dryRun: (_config['dryRun'] ?? false) as boolean,
    inputDir: (_config['inputDir'] ?? './temp/chatlog') as string,
    dicsDir: (_config['dicsDir'] ?? './assets/dics') as string,
    model: _model,
  };
};

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

export const main = async (argv?: string[]): Promise<void> => {
  try {
    const _config = parseArgs(argv ?? Deno.args);

    // 入力ディレクトリ確認
    const agentDir = `${_config.inputDir}/${_config.agent}`;
    try {
      const stat = await Deno.stat(agentDir);
      if (!stat.isDirectory) {
        throw new ChatlogError('InputNotFound', `入力ディレクトリが見つかりません: ${agentDir}`);
      }
    } catch (e) {
      if (e instanceof ChatlogError) { throw e; }
      throw new ChatlogError('InputNotFound', `入力ディレクトリが見つかりません: ${agentDir}`);
    }

    // プロジェクト辞書読み込み
    const projects = await loadProjects(_config.dicsDir);
    if (projects.length === 0) {
      logger.warn('projects.dic にプロジェクトが定義されていません。すべて misc に分類されます。');
    }

    logger.info(`対象 agent: ${_config.agent}`);
    if (_config.period) { logger.info(`対象期間: ${_config.period}`); }
    if (_config.dryRun) { logger.info('dry-run モード: ファイルは移動しません'); }
    logger.info(`プロジェクト候補: ${projects.join(', ')}`);

    // ファイル列挙
    const allFiles = await findEntries(
      [agentDir],
      '.md',
      _config.period ? { include: [_config.period] } : undefined,
    );
    if (allFiles.length === 0) {
      logger.info('対象ファイルなし');
      logger.info('完了: moved=0 skipped=0 error=0');
      return;
    }

    // メタデータ読み込みとスキップ判定
    const targetMetas: FileMeta[] = [];
    const stats: Stats = { moved: 0, skipped: 0, error: 0 };

    for (const filePath of allFiles) {
      const meta = await loadFileMeta(filePath);
      if (!meta) {
        stats.error++;
        continue;
      }
      if (meta.existingProject) {
        logger.info(`  skipped (既にプロジェクト設定済み: ${meta.existingProject}): ${meta.filename}`);
        stats.skipped++;
        continue;
      }
      targetMetas.push(meta);
    }

    logger.info(`\n対象ファイル数: ${targetMetas.length} (スキップ: ${stats.skipped})`);

    if (targetMetas.length === 0) {
      logger.info(`\n完了: moved=${stats.moved} skipped=${stats.skipped} error=${stats.error}`);
      return;
    }

    // チャンク分割して並列処理
    await runChunked(
      targetMetas,
      DEFAULT_CHUNK_SIZE,
      (chunk) => processChunk(chunk, projects, _config.dryRun, stats, _config.model),
      DEFAULT_CONCURRENCY,
    );

    // サマリー
    const drySuffix = _config.dryRun ? ' (dry-run)' : '';
    logger.info(
      `\n完了${drySuffix}: moved=${stats.moved} skipped=${stats.skipped} error=${stats.error}`,
    );
  } catch (e) {
    if (e instanceof ChatlogError) {
      logger.error(e.message);
      Deno.exit(1);
    }
    throw e;
  }
};

if (import.meta.main) { await main(); }
