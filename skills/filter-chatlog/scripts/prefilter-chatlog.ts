#!/usr/bin/env -S deno run --allow-read --allow-write
// src: scripts/prefilter-chatlog.ts
// @(#): チャットログの高速事前フィルタスクリプト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
/**
 * prefilter_chatlog.ts — チャットログの高速事前フィルタスクリプト
 *
 * Claude API呼び出し前に、正規表現・テキストパターンで
 * 明らかなノイズファイルを削除候補として絞り込む。
 *
 * 対象パターン:
 *   1. ファイル名パターン  : say-ok, command-message-* 等
 *   2. Git操作ログのみ    : ===== GIT LOGS/DIFF ===== で始まるUser入力
 *   3. スキル呼び出し     : ---\nname: commit-message-generator 等のYAML先頭
 *   4. 定型APIプロンプト  : idd-framework の補助呼び出し（100-150文字生成等）
 *   5. スラッシュコマンド : /export-log, /deckrd 等のみのUser入力
 *   6. システムタグのみ   : <system-reminder> 等
 *   7. 短すぎる応答      : Assistantが100文字未満（1ターン限定）
 *
 * 使い方:
 *   deno run --allow-read --allow-write scripts/prefilter_chatlog.ts
 *   deno run --allow-read --allow-write scripts/prefilter_chatlog.ts codex 2026-01
 *   deno run --allow-read --allow-write scripts/prefilter_chatlog.ts --dry-run
 *   deno run --allow-read --allow-write scripts/prefilter_chatlog.ts --report
 *   deno run --allow-read --allow-write scripts/prefilter_chatlog.ts --input ./temp/chatlog
 */

import { logger } from '../../_scripts/libs/logger.ts';

// ─────────────────────────────────────────────
// ノイズ判定パターン定義
// ─────────────────────────────────────────────

/** ファイル名に含まれていれば即除外 */
export const NOISE_FILENAME_PATTERNS: RegExp[] = [
  /you-are-a-topic-and-tag-extraction-assistant/,
  /say-ok-and-nothing-else/,
  /command-message-claude-idd-framework/,
  /command-message-deckrd-deckrd/,
  /command-message-deckrd-coder/,
];

/** User本文の先頭がこれにマッチすれば除外（`i` フラグで大文字小文字無視） */
const NOISE_USER_PREFIX_PATTERNS: { pattern: RegExp; label: string }[] = [
  // Git操作ログ（GIT LOGS / GIT DIFF / END DIFF）
  { pattern: /^={3,}\s*git\s+(logs?|diff|diffs?)\s*={3,}/i, label: 'Git操作ログのみ' },

  // スキル呼び出し（YAML先頭 ---\nname: で始まるもの）
  { pattern: /^---\s*\nname\s*:/i, label: 'スキル呼び出し(YAML)' },

  // idd-framework 定型APIプロンプト
  {
    pattern: /^以下のタイトルに対して、\d+-\d+文字程度の.*?説明を.*?生成してください/s,
    label: '定型プロンプト(タイトル説明生成)',
  },
  {
    pattern: /^以下の情報から、最適なcommit種別.*?json形式で返してください/is,
    label: '定型プロンプト(commit/issue/branch判定)',
  },
  {
    pattern: /^以下のjson形式パラメータから、github\s+issue下書きをmarkdown形式で生成してください/i,
    label: '定型プロンプト(GitHub Issue生成)',
  },
  { pattern: /^based on the issue title\b/i, label: '定型プロンプト(branch名生成)' },
  { pattern: /^translate the following text to english for use in/i, label: '定型プロンプト(英語翻訳)' },
  { pattern: /^summarize the following.*?in \d+ words/i, label: '定型プロンプト(要約生成)' },

  // deckrd 実装指示
  { pattern: /^implement the following plan\b/i, label: 'deckrd実装指示' },
  { pattern: /^以下のプランを実装/i, label: 'deckrd実装指示(日本語)' },

  // プロンプトテスト系
  { pattern: /^={3,}\s*prompt\s*={3,}/i, label: 'プロンプトテスト' },
  { pattern: /^you are a (topic and tag extraction assistant|log curator)\b/i, label: 'システムプロンプト転写' },

  // スラッシュコマンド転写
  {
    pattern: /^\/(export-log|filter-chatlog|commit|idd|deckrd|clear|help|set-frontmatter|classify-chatlog)\b/,
    label: 'スラッシュコマンドのみ',
  },
];

/** User本文の全体がこれにマッチすれば除外 */
const NOISE_USER_EXACT_PATTERNS: { pattern: RegExp; label: string }[] = [
  // Windowsパスのみ（1行）
  { pattern: /^[A-Za-z]:\\[^\n]{0,300}$/, label: 'Windowsパスのみ' },
  // Unixパスのみ（1行）
  { pattern: /^(?:docs|temp|scripts|src|tests?|\.github)\/[^\n]{0,300}$/, label: 'Unixパスのみ' },
];

/** システムタグのみと判断するプレフィックス正規表現 */
const SYSTEM_TAG_PATTERN =
  /^<(system-reminder|command-name|command-message|local-command-stdout|ide_opened_file|ide_selection)\b/;

/** Assistantの応答が短すぎる場合の閾値（文字数） */
export const MIN_ASSISTANT_CHARS = 100;

// ─────────────────────────────────────────────
// Frontmatter パーサー
// ─────────────────────────────────────────────

export function loadFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const normalized = text.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) { return { meta: {}, body: normalized }; }

  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) { return { meta: {}, body: normalized }; }

  const fmText = normalized.slice(4, end);
  const body = normalized.slice(end + 5);

  const meta: Record<string, string> = {};
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(': ');
    if (idx > 0 && !line.startsWith(' ')) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
    }
  }
  return { meta, body };
}

// ─────────────────────────────────────────────
// 会話ターン解析
// ─────────────────────────────────────────────

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export function parseConversation(body: string): Turn[] {
  const turns: Turn[] = [];
  const pattern = /^### (User|Assistant)\s*$/gm;
  const matches = [...body.matchAll(pattern)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const role = m[1].toLowerCase() as 'user' | 'assistant';
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const text = body.slice(start, end).trim();
    if (text) { turns.push({ role, text }); }
  }
  return turns;
}

// ─────────────────────────────────────────────
// 個別判定ロジック
// ─────────────────────────────────────────────

export function checkFilename(filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const pat of NOISE_FILENAME_PATTERNS) {
    if (pat.test(lower)) { return `ファイル名パターン: ${pat}`; }
  }
  return null;
}

export function checkUserContent(turns: Turn[]): string | null {
  const userTurns = turns.filter((t) => t.role === 'user');
  if (userTurns.length === 0) { return 'Userターンが存在しない'; }

  // 全Userターンがシステムタグのみ
  if (userTurns.every((t) => SYSTEM_TAG_PATTERN.test(t.text))) {
    return '全UserターンがシステムTagのみ';
  }

  // 全Userターンが /コマンドのみ
  if (userTurns.every((t) => t.text.trim().split('\n').every((l) => l.trim().startsWith('/')))) {
    return '全Userターンが/コマンドのみ';
  }

  // 1ターンのみの詳細チェック
  if (userTurns.length === 1) {
    const text = userTurns[0].text;

    // 前方一致パターン
    for (const { pattern, label } of NOISE_USER_PREFIX_PATTERNS) {
      if (pattern.test(text)) { return label; }
    }

    // 完全一致パターン
    for (const { pattern, label } of NOISE_USER_EXACT_PATTERNS) {
      if (pattern.test(text.trim())) { return label; }
    }

    // システムタグのみ
    if (SYSTEM_TAG_PATTERN.test(text)) { return 'UserがシステムTagのみ'; }
  }

  return null;
}

export function checkAssistantContent(turns: Turn[]): string | null {
  const userTurns = turns.filter((t) => t.role === 'user');
  const assistantTurns = turns.filter((t) => t.role === 'assistant');

  if (userTurns.length === 1 && assistantTurns.length > 0) {
    const total = assistantTurns.reduce((sum, t) => sum + t.text.length, 0);
    if (total < MIN_ASSISTANT_CHARS) {
      return `Assistant応答が短すぎる (${total} < ${MIN_ASSISTANT_CHARS} 文字)`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// メイン判定関数
// ─────────────────────────────────────────────

export function classifyFile(filename: string, text: string): { isNoise: boolean; reason: string } {
  // 1. ファイル名チェック
  const filenameReason = checkFilename(filename);
  if (filenameReason) { return { isNoise: true, reason: filenameReason }; }

  // 2. frontmatter + body 読み込み
  const { body } = loadFrontmatter(text);

  // 3. 会話ターン解析
  const turns = parseConversation(body);

  // 4. User本文チェック
  const userReason = checkUserContent(turns);
  if (userReason) { return { isNoise: true, reason: userReason }; }

  // 5. Assistant応答の長さチェック
  const assistantReason = checkAssistantContent(turns);
  if (assistantReason) { return { isNoise: true, reason: assistantReason }; }

  return { isNoise: false, reason: '' };
}

// ─────────────────────────────────────────────
// ファイル列挙
// ─────────────────────────────────────────────

export async function findMdFiles(baseDir: string, agent: string, period?: string): Promise<string[]> {
  const results: string[] = [];

  const agentDir = `${baseDir}/${agent}`;

  if (period) {
    const yyyy = period.slice(0, 4);
    // YYYY/YYYY-MM 構造（codex等）
    const withYear = `${agentDir}/${yyyy}/${period}`;
    // YYYY-MM 直下構造（claude等）
    const flat = `${agentDir}/${period}`;

    let targetDir: string;
    try {
      const stat = await Deno.stat(withYear);
      targetDir = stat.isDirectory ? withYear : flat;
    } catch {
      targetDir = flat;
    }
    await collectMdFiles(targetDir, results);
  } else {
    await collectMdFiles(agentDir, results);
  }

  return results.sort();
}

async function collectMdFiles(dir: string, results: string[]): Promise<void> {
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const e of Deno.readDir(dir)) {
      entries.push(e);
    }
  } catch {
    return;
  }

  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = `${dir}/${e.name}`;
    if (e.isDirectory) {
      await collectMdFiles(fullPath, results);
    } else if (e.isFile && e.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
}

// ─────────────────────────────────────────────
// 引数解析
// ─────────────────────────────────────────────

interface Args {
  agent: string;
  period?: string;
  inputDir: string;
  dryRun: boolean;
  report: boolean;
}

export function parseArgs(args: string[]): Args {
  let agent = 'claude';
  let period: string | undefined;
  let inputDir = './temp/chatlog';
  let dryRun = false;
  let report = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--report') {
      report = true;
    } else if (arg === '--input' && i + 1 < args.length) {
      inputDir = args[++i];
    } else if (arg.startsWith('--input=')) {
      inputDir = arg.slice('--input='.length);
    } else if (arg.startsWith('-')) {
      console.error(`不明なオプション: ${arg}`);
      Deno.exit(1);
    } else if (/^\d{4}-\d{2}$/.test(arg)) {
      period = arg;
    } else {
      agent = arg;
    }
  }

  return { agent, period, inputDir, dryRun: dryRun || report, report };
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

export async function main(args: string[] = Deno.args): Promise<void> {
  const { agent, period, inputDir, dryRun, report } = parseArgs(args);

  try {
    const stat = await Deno.stat(inputDir);
    if (!stat.isDirectory) { throw new Error(); }
  } catch {
    logger.error(`エラー: 入力ディレクトリが見つかりません: ${inputDir}`);
    Deno.exit(1);
  }

  const files = await findMdFiles(inputDir, agent, period);
  logger.info(`対象ファイル数: ${files.length}`);
  if (dryRun) {
    logger.info(`${report ? 'report' : 'dry-run'} モード: ファイルは削除しません`);
  }

  const counts = { noise: 0, keep: 0, error: 0 };

  for (const filePath of files) {
    const filename = filePath.replace(/\\/g, '/').split('/').pop()!;

    let text: string;
    try {
      text = await Deno.readTextFile(filePath);
    } catch (e) {
      logger.error(`  error (${filename}): ${e}`);
      counts.error++;
      continue;
    }

    const { isNoise, reason } = classifyFile(filename, text);

    if (isNoise) {
      counts.noise++;
      if (report) {
        logger.log(`NOISE\t${reason}\t${filePath}`);
      } else if (dryRun) {
        logger.log(filePath);
      } else {
        try {
          await Deno.remove(filePath);
          logger.info(`deleted: ${filePath}`);
        } catch (e) {
          logger.error(`  削除失敗: ${filename}: ${e}`);
          counts.error++;
          counts.noise--;
        }
      }
    } else {
      counts.keep++;
    }
  }

  const suffix = dryRun ? ` (${report ? 'report' : 'dry-run'})` : '';
  logger.info(`\n完了${suffix}: noise=${counts.noise} keep=${counts.keep} error=${counts.error}`);
}

if (import.meta.main) {
  await main();
}
