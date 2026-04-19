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
import { ChatlogError } from '../../_scripts/classes/ChatlogError.class.ts';
import { isKnownAgent } from '../../_scripts/constants/agents.constants.ts';
import { DEFAULT_CHUNK_SIZE, DEFAULT_CONCURRENCY } from '../../_scripts/constants/concurrency.constants.ts';
import { runChunked } from '../../_scripts/libs/concurrency.ts';
import { logger } from '../../_scripts/libs/logger.ts';
import { normalizePath } from '../../_scripts/libs/utils.ts';

// -- internal --
import { FALLBACK_PROJECT, MIN_CLASSIFIABLE_LENGTH } from './constants/classify.constants.ts';
import type { ClassifyConfig, ClassifyResult, FileMeta, FrontmatterData, Stats } from './types/classify.types.ts';

// ─────────────────────────────────────────────
// 辞書読み込み
// ─────────────────────────────────────────────

export async function loadProjects(dicsDir: string): Promise<string[]> {
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
}

// ─────────────────────────────────────────────
// フロントマター解析
// ─────────────────────────────────────────────

export function parseFrontmatter(text: string): FrontmatterData {
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
}

// ─────────────────────────────────────────────
// フロントマターへ project フィールドを追加
// ─────────────────────────────────────────────

export function insertProjectField(text: string, project: string): string {
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
}

// ─────────────────────────────────────────────
// ファイルメタデータ読み込み
// ─────────────────────────────────────────────

export async function loadFileMeta(filePath: string): Promise<FileMeta | null> {
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
}

// ─────────────────────────────────────────────
// ファイル列挙（直下の .md のみ）
// ─────────────────────────────────────────────

export async function findMdFilesFlat(
  inputDir: string,
  agent: string,
  period?: string,
): Promise<string[]> {
  const agentDir = `${inputDir}/${agent}`;
  const results: string[] = [];

  if (agent === 'chatgpt') {
    // chatgpt: inputDir/chatgpt/YYYY/YYYY-MM/*.md
    await collectChatGptFiles(agentDir, period, results);
  } else {
    // claude など: inputDir/agent/YYYY-MM/*.md
    await collectClaudeFiles(agentDir, period, results);
  }

  return results.sort();
}

export async function collectChatGptFiles(
  agentDir: string,
  period: string | undefined,
  results: string[],
): Promise<void> {
  let yearDirs: string[];
  try {
    yearDirs = [];
    for await (const entry of Deno.readDir(agentDir)) {
      if (entry.isDirectory && /^\d{4}$/.test(entry.name)) {
        yearDirs.push(`${agentDir}/${entry.name}`);
      }
    }
  } catch {
    return;
  }

  for (const yearDir of yearDirs.sort()) {
    let monthDirs: string[];
    try {
      monthDirs = [];
      for await (const entry of Deno.readDir(yearDir)) {
        if (entry.isDirectory && /^\d{4}-\d{2}$/.test(entry.name)) {
          if (!period || entry.name === period) {
            monthDirs.push(`${yearDir}/${entry.name}`);
          }
        }
      }
    } catch {
      continue;
    }

    for (const monthDir of monthDirs.sort()) {
      await collectDirectMdFiles(monthDir, results);
    }
  }
}

export async function collectClaudeFiles(
  agentDir: string,
  period: string | undefined,
  results: string[],
): Promise<void> {
  let monthDirs: string[];
  try {
    monthDirs = [];
    for await (const entry of Deno.readDir(agentDir)) {
      if (entry.isDirectory && /^\d{4}-\d{2}$/.test(entry.name)) {
        if (!period || entry.name === period) {
          monthDirs.push(`${agentDir}/${entry.name}`);
        }
      }
    }
  } catch {
    return;
  }

  for (const monthDir of monthDirs.sort()) {
    await collectDirectMdFiles(monthDir, results);
  }
}

export async function collectDirectMdFiles(dir: string, results: string[]): Promise<void> {
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.isFile && entry.name.endsWith('.md')) {
        results.push(`${dir}/${entry.name}`);
      }
    }
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}

// ─────────────────────────────────────────────
// バッチプロンプト構築
// ─────────────────────────────────────────────

export function buildClassifyPrompt(files: FileMeta[], projects: string[]): string {
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
}

export function buildSystemPrompt(projects: string[]): string {
  const _projectList = [...projects, FALLBACK_PROJECT].join(', ');
  return `Output ONLY a JSON array. No markdown, no explanation, no text before or after the array.
[{"file":"<filename>","project":"<project_name>","confidence":0.0,"reason":"..."},...]

Choose project ONLY from this list: ${_projectList}
If no project matches well, use "${FALLBACK_PROJECT}".
Base your decision on: title, category, topics, tags.`;
}

// ─────────────────────────────────────────────
// JSON 配列パース（filter_chatlog.ts から流用）
// ─────────────────────────────────────────────

export function parseJsonArray(raw: string): ClassifyResult[] | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data) && data.length > 0) {
        return data as ClassifyResult[];
      }
    } catch {
      // fall through
    }
  }

  const pattern = /\[[\s\S]*?\]/g;
  for (const m of raw.matchAll(pattern)) {
    try {
      const data = JSON.parse(m[0]);
      if (Array.isArray(data) && data.length > 0) {
        return data as ClassifyResult[];
      }
    } catch {
      // 次の候補へ
    }
  }

  const greedyMatch = raw.match(/\[[\s\S]*\]/);
  if (greedyMatch) {
    try {
      const data = JSON.parse(greedyMatch[0]);
      if (Array.isArray(data) && data.length > 0) {
        return data as ClassifyResult[];
      }
    } catch {
      // fall through
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// Claude CLI 呼び出し
// ─────────────────────────────────────────────

export async function runClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const cmd = new Deno.Command('claude', {
    args: ['-p', systemPrompt, '--output-format', 'text'],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'null',
  });

  const process = cmd.spawn();

  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(userPrompt));
  await writer.close();

  const output = await process.output();
  if (!output.success) {
    throw new ChatlogError('CliError', `claude CLI がエラーで終了しました (code=${output.code})`);
  }

  return new TextDecoder().decode(output.stdout);
}

// ─────────────────────────────────────────────
// ファイル移動とフロントマター更新
// ─────────────────────────────────────────────

export async function classifyFile(
  fileMeta: FileMeta,
  project: string,
  dryRun: boolean,
  stats: Stats,
): Promise<void> {
  const srcPath = fileMeta.filePath;
  const srcDir = normalizePath(srcPath).split('/').slice(0, -1).join('/');
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
    await Deno.writeTextFile(dstPath, newText);

    logger.info(`moved: ${fileMeta.filename} → ${project}/`);
    stats.moved++;
  } catch (e) {
    logger.error(`  移動失敗: ${fileMeta.filename}: ${e}`);
    stats.error++;
  }
}

// ─────────────────────────────────────────────
// チャンク処理
// ─────────────────────────────────────────────

export async function processChunk(
  chunkMetas: FileMeta[],
  projects: string[],
  dryRun: boolean,
  stats: Stats,
): Promise<void> {
  // フロントマターなし かつ 本文が短すぎるファイルは Claude に渡さず misc に直接分類
  const classifiable: FileMeta[] = [];
  for (const f of chunkMetas) {
    const hasMeta = f.title || f.category || f.topics.length > 0 || f.tags.length > 0;
    if (!hasMeta && f.fullText.trim().length < MIN_CLASSIFIABLE_LENGTH) {
      logger.info(`  classify: ${f.filename} → ${FALLBACK_PROJECT} (本文が短すぎるため直接分類)`);
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
    rawResult = await runClaude(_systemPrompt, _batchPrompt);
  } catch (e) {
    logger.warn(`  警告: claude CLI 実行失敗。チャンク内ファイルをすべて ${FALLBACK_PROJECT} 扱い`);
    logger.warn(`  error: ${e}`);
    for (const f of classifiable) {
      await classifyFile(f, FALLBACK_PROJECT, dryRun, stats);
    }
    return;
  }

  const parsed = parseJsonArray(rawResult);
  if (!parsed) {
    logger.warn(`  警告: JSON パース失敗。チャンク内ファイルをすべて ${FALLBACK_PROJECT} 扱い`);
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
}

// ─────────────────────────────────────────────
// 引数解析
// ─────────────────────────────────────────────

export function parseArgs(args: string[]): ClassifyConfig {
  let agent: string | undefined;
  let period: string | undefined;
  let dryRun = false;
  let inputDir = './temp/chatlog';
  let dicsDir = './assets/dics';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--input' && i + 1 < args.length) {
      inputDir = args[++i];
    } else if (arg.startsWith('--input=')) {
      inputDir = arg.slice('--input='.length);
    } else if (arg === '--dics' && i + 1 < args.length) {
      dicsDir = args[++i];
    } else if (arg.startsWith('--dics=')) {
      dicsDir = arg.slice('--dics='.length);
    } else if (arg.startsWith('-')) {
      throw new ChatlogError('InvalidArgs', `不明なオプション: ${arg}`);
    } else if (/^\d{4}-\d{2}$/.test(arg)) {
      period = arg;
    } else if (isKnownAgent(arg)) {
      agent = arg;
    } else {
      throw new ChatlogError('InvalidArgs', `不明な引数: ${arg}`);
    }
  }

  return { agent: agent ?? 'chatgpt', period, dryRun, inputDir, dicsDir };
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

export async function main(argv?: string[]): Promise<void> {
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
      logger.warn('警告: projects.dic にプロジェクトが定義されていません。すべて misc に分類されます。');
    }

    logger.info(`対象 agent: ${_config.agent}`);
    if (_config.period) { logger.info(`対象期間: ${_config.period}`); }
    if (_config.dryRun) { logger.info('dry-run モード: ファイルは移動しません'); }
    logger.info(`プロジェクト候補: ${projects.join(', ')}`);

    // ファイル列挙
    const allFiles = await findMdFilesFlat(_config.inputDir, _config.agent, _config.period);
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
      (chunk) => processChunk(chunk, projects, _config.dryRun, stats),
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
}

if (import.meta.main) { await main(); }
