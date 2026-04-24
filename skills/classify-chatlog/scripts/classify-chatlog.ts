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
import { isValidModel } from '../../_scripts/libs/ai/model-utils.ts';
import { runAI } from '../../_scripts/libs/ai/run-ai.ts';
import { findEntries } from '../../_scripts/libs/file-io/find-entries.ts';
import { getDirectory, normalizePath } from '../../_scripts/libs/file-io/path-utils.ts';
import { readTextFile } from '../../_scripts/libs/file-io/read-utils.ts';
import { parseArgsToConfig } from '../../_scripts/libs/io/parse-args.ts';
import { runChunked } from '../../_scripts/libs/parallel/concurrency.ts';
import { parseFrontmatterEntries } from '../../_scripts/libs/text/frontmatter-utils.ts';
import { parseJsonArray } from '../../_scripts/libs/text/json-utils.ts';
import { normalizeLine } from '../../_scripts/libs/text/line-utils.ts';
// instances
import { logger } from '../../_scripts/libs/io/logger.ts';
// constants
import { DEFAULT_CHUNK_SIZE, DEFAULT_CONCURRENCY } from '../../_scripts/constants/defaults.constants.ts';
// classes
import { ChatlogError } from '../../_scripts/classes/ChatlogError.class.ts';

// -- internal --
import {
  DEFAULT_CLASSIFY_CONFIG,
  FALLBACK_PROJECT,
  MIN_CLASSIFIABLE_LENGTH,
} from './constants/classify.constants.ts';
import type {
  ClassifyConfig,
  ClassifyFileMeta,
  ClassifyResult,
  ClassifyStats,
  ParsedConfig,
} from './types/classify.types.ts';

// ─────────────────────────────────────────────
// 辞書読み込み
// ─────────────────────────────────────────────

export const loadProjects = async (dicsDir: string): Promise<string[]> => {
  const dicPath = `${dicsDir}/projects.dic`;
  let text: string;
  try {
    text = await readTextFile(dicPath);
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
// フロントマターへ project フィールドを追加
// ─────────────────────────────────────────────

export const insertProjectField = (text: string, project: string): string => {
  const _normalized = text.replace(/\r\n/g, '\n');
  const _lines = _normalized.split('\n');
  if (_lines[0] !== '---') { return text; }

  const _closeIdx = _lines.indexOf('---', 1);
  if (_closeIdx === -1) { return text; }

  const _fmLines = _lines.slice(1, _closeIdx);
  const _newFmLines: string[] = [];
  let _inserted = false;
  for (const line of _fmLines) {
    _newFmLines.push(line);
    if (!_inserted && line.startsWith('date:')) {
      _newFmLines.push(`project: ${project}`);
      _inserted = true;
    }
  }
  if (!_inserted) { _newFmLines.unshift(`project: ${project}`); }

  const _bodyLines = _lines.slice(_closeIdx + 1);
  return ['---', ..._newFmLines, '---', ..._bodyLines].join('\n');
};

// ─────────────────────────────────────────────
// ファイルメタデータ読み込み
// ─────────────────────────────────────────────

export const loadClassifyFileMeta = async (filePath: string): Promise<ClassifyFileMeta | null> => {
  let text: string;
  try {
    text = await readTextFile(filePath);
  } catch {
    return null;
  }

  const filename = normalizePath(filePath).split('/').pop()!;
  const { meta } = parseFrontmatterEntries(text);

  return {
    filePath,
    filename,
    existingProject: typeof meta['project'] === 'string' ? meta['project'] : '',
    title: typeof meta['title'] === 'string' ? meta['title'] : '',
    category: typeof meta['category'] === 'string' ? meta['category'] : '',
    topics: Array.isArray(meta['topics']) ? meta['topics'] as string[] : [],
    tags: Array.isArray(meta['tags']) ? meta['tags'] as string[] : [],
    fullText: text,
  };
};

// ─────────────────────────────────────────────
// バッチプロンプト構築
// ─────────────────────────────────────────────

export const buildClassifyPrompt = (files: ClassifyFileMeta[], projects: string[]): string => {
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
  fileMeta: ClassifyFileMeta,
  project: string,
  dryRun: boolean,
  stats: ClassifyStats,
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
  chunkMetas: ClassifyFileMeta[],
  projects: string[],
  dryRun: boolean,
  stats: ClassifyStats,
  model: string,
): Promise<void> => {
  // フロントマターなし かつ 本文が短すぎるファイルは Claude に渡さず misc に直接分類
  const classifiable: ClassifyFileMeta[] = [];
  for (const f of chunkMetas) {
    const hasMeta = f.title || f.category || f.topics.length > 0 || f.tags.length > 0;
    if (!hasMeta && f.fullText.trim().length < MIN_CLASSIFIABLE_LENGTH) {
      logger.warn(`[skip-ai: too-short] ${f.filename} (content is too short.`);
      logger.info(`  classify: ${f.filename} → fallback:${FALLBACK_PROJECT}`);
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

const _OPT_KEYS: Record<string, keyof ClassifyConfig> = {
  '--input': 'inputDir',
  '--dics': 'dicsDir',
  '--model': 'model',
};

const _OPT_FLAGS: Record<string, keyof ClassifyConfig> = {
  '--dry-run': 'dryRun',
};

export const parseArgs = (args: string[]): ParsedConfig => {
  const _parsed = parseArgsToConfig<ClassifyConfig>(args, _OPT_KEYS, _OPT_FLAGS) as ParsedConfig;
  _parsed.model = _parsed.model ?? DEFAULT_CLASSIFY_CONFIG.model;
  if (!isValidModel(_parsed.model)) {
    throw new ChatlogError('InvalidArgs', `不正なモデル名: ${_parsed.model}`);
  }
  return _parsed;
};

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

export const main = async (argv?: string[]): Promise<void> => {
  try {
    const _parsed = parseArgs(argv ?? Deno.args);
    const _config: ClassifyConfig = { ...DEFAULT_CLASSIFY_CONFIG, ..._parsed };

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
    const targetMetas: ClassifyFileMeta[] = [];
    const stats: ClassifyStats = { moved: 0, skipped: 0, error: 0 };

    for (const filePath of allFiles) {
      const meta = await loadClassifyFileMeta(filePath);
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
