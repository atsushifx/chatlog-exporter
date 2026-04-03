#!/usr/bin/env -S deno run --allow-read --allow-run --allow-write
/**
 * filter_chatlog.ts — チャットログを claude CLI でバッチ判定し DISCARD ファイルを削除する
 *
 * 使い方:
 *   deno run --allow-read --allow-run filter_chatlog.ts [YYYY-MM] [project] [--dry-run] [--input DIR]
 */

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────

const CHUNK_SIZE = 10;
const CONCURRENCY = 4;
const DISCARD_THRESHOLD = 0.7;
const MAX_BODY_CHARS = 8000;

const SYSTEM_PROMPT = `Output ONLY a JSON array. No markdown, no explanation, no text before or after the array.
[{"file":"<filename>","decision":"KEEP or DISCARD","confidence":0.0,"reason":"..."},...]

KEEP: design decisions, reusable patterns, new concepts, architecture discussion
DISCARD: execution-only, trivial Q&A, no reusable insight, context-dependent`;

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface ClaudeResult {
  file: string;
  decision: 'KEEP' | 'DISCARD';
  confidence: number;
  reason: string;
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

// ─────────────────────────────────────────────
// Frontmatter パース
// ─────────────────────────────────────────────

function parseFrontmatter(text: string): { meta: Record<string, unknown>; body: string } {
  if (!text.startsWith('---\n')) {
    return { meta: {}, body: text };
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    return { meta: {}, body: text };
  }
  const body = text.slice(end + 5);
  return { meta: {}, body };
}

// ─────────────────────────────────────────────
// 会話ターン解析
// ─────────────────────────────────────────────

function parseConversation(body: string): Turn[] {
  const turns: Turn[] = [];
  const pattern = /^### (User|Assistant)\s*$/gm;
  const matches = [...body.matchAll(pattern)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const role = m[1].toLowerCase() as 'user' | 'assistant';
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const text = body.slice(start, end).trim();
    if (text) {
      turns.push({ role, text });
    }
  }
  return turns;
}

// ─────────────────────────────────────────────
// 内容ベース事前フィルタ（obsidian_filter.py 移植）
// ─────────────────────────────────────────────

const SYSTEM_PREFIXES = [
  '<system-reminder',
  '<command-name',
  '<command-message',
  '<local-command-stdout',
  '<ide_opened_file',
  '<ide_selection',
  '---\n',
];

const EXCLUDE_FILENAME_PATTERNS = [
  'you-are-a-topic-and-tag-extraction-assistant',
  'say-ok-and-nothing-else',
  'command-message-claude-idd-framework',
  'command-message-deckrd-deckrd',
];

function isSystemOnlyMessage(text: string): boolean {
  const stripped = text.trim();
  return SYSTEM_PREFIXES.some((prefix) => stripped.startsWith(prefix));
}

function isExcludedByFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return EXCLUDE_FILENAME_PATTERNS.some((pat) => lower.includes(pat));
}

function isExcludedByContent(
  body: string,
  minCharCount = 1000,
  minAssistantChars = 300,
): { excluded: boolean; reason: string } {
  if (body.length < minCharCount) {
    return { excluded: true, reason: `本文が短すぎる (${body.length} < ${minCharCount} 文字)` };
  }

  const turns = parseConversation(body);
  const userTurns = turns.filter((t) => t.role === 'user');
  const assistantTurns = turns.filter((t) => t.role === 'assistant');

  if (userTurns.length === 0) {
    return { excluded: true, reason: 'Userターンが存在しない' };
  }

  if (userTurns.length === 1) {
    if (isSystemOnlyMessage(userTurns[0].text)) {
      return { excluded: true, reason: 'Userメッセージがシステム/コマンドタグのみ' };
    }
    const totalAssistantChars = assistantTurns.reduce((sum, t) => sum + t.text.length, 0);
    if (totalAssistantChars < minAssistantChars) {
      return {
        excluded: true,
        reason: `Assistantの応答が短すぎる (${totalAssistantChars} < ${minAssistantChars} 文字)`,
      };
    }
  }

  return { excluded: false, reason: '' };
}

// ─────────────────────────────────────────────
// 本文テキスト抽出
// ─────────────────────────────────────────────

function extractBodyText(body: string, maxChars = MAX_BODY_CHARS): string {
  const turns = parseConversation(body);
  const parts = turns.map((t) => {
    const role = t.role === 'user' ? 'User' : 'Assistant';
    return `### ${role}\n${t.text}`;
  });
  return parts.join('\n\n').slice(0, maxChars);
}

// ─────────────────────────────────────────────
// ファイル列挙
// ─────────────────────────────────────────────

async function findMdFiles(
  baseDir: string,
  period?: string,
  project?: string,
): Promise<string[]> {
  let searchDir = baseDir;
  if (period && project) {
    searchDir = `${baseDir}/${period}/${project}`;
  } else if (period) {
    searchDir = `${baseDir}/${period}`;
  }

  const results: string[] = [];
  await collectMdFiles(searchDir, results);
  return results.sort();
}

async function collectMdFiles(dir: string, results: string[]): Promise<void> {
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const entry of Deno.readDir(dir)) {
      entries.push(entry);
    }
  } catch {
    return;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      await collectMdFiles(fullPath, results);
    } else if (entry.isFile && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
}

// ─────────────────────────────────────────────
// 事前フィルタ
// ─────────────────────────────────────────────

async function prefilterFiles(files: string[]): Promise<string[]> {
  const passed: string[] = [];
  let skipped = 0;

  for (const filePath of files) {
    const filename = filePath.split(/[/\\]/).pop()!;

    if (isExcludedByFilename(filename)) {
      console.error(`  skipped (ファイル名パターン): ${filename}`);
      skipped++;
      continue;
    }

    let text: string;
    try {
      text = await Deno.readTextFile(filePath);
    } catch {
      skipped++;
      continue;
    }

    const { body } = parseFrontmatter(text);
    if (!body.trim()) {
      skipped++;
      continue;
    }

    const { excluded, reason } = isExcludedByContent(body);
    if (excluded) {
      console.error(`  skipped (${reason}): ${filename}`);
      skipped++;
      continue;
    }

    const bodyText = extractBodyText(body);
    if (!bodyText.trim()) {
      skipped++;
      continue;
    }

    passed.push(filePath);
  }

  console.error(`事前フィルタ: 対象=${files.length} 通過=${passed.length} スキップ=${skipped}`);
  return passed;
}

// ─────────────────────────────────────────────
// バッチプロンプト構築
// ─────────────────────────────────────────────

async function buildBatchPrompt(files: string[]): Promise<string> {
  const parts: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const filename = filePath.split(/[/\\]/).pop()!;
    let text: string;
    try {
      text = await Deno.readTextFile(filePath);
    } catch {
      text = '';
    }
    const { body } = parseFrontmatter(text);
    const bodyText = extractBodyText(body, MAX_BODY_CHARS);

    parts.push(`=== FILE ${i + 1}: ${filename} ===\n${bodyText}`);
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────
// JSON 配列パース
// ─────────────────────────────────────────────

function parseJsonArray(raw: string): ClaudeResult[] | null {
  // ダイレクトパース（Claude が指示通り純粋な JSON を返した場合）
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data) && data.length > 0) {
        return data as ClaudeResult[];
      }
    } catch {
      // fall through
    }
  }

  // フォールバック: テキスト中の [...] 候補を非貪欲マッチで全て試す
  const pattern = /\[[\s\S]*?\]/g;
  for (const m of raw.matchAll(pattern)) {
    try {
      const data = JSON.parse(m[0]);
      if (Array.isArray(data) && data.length > 0) {
        return data as ClaudeResult[];
      }
    } catch {
      // 次の候補へ
    }
  }

  // 最後の手段: 貪欲マッチで最大の [...] を試す
  const greedyMatch = raw.match(/\[[\s\S]*\]/);
  if (greedyMatch) {
    try {
      const data = JSON.parse(greedyMatch[0]);
      if (Array.isArray(data) && data.length > 0) {
        return data as ClaudeResult[];
      }
    } catch {
      // fall through
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// 並列実行ヘルパー
// ─────────────────────────────────────────────

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

// ─────────────────────────────────────────────
// Claude CLI 呼び出し
// ─────────────────────────────────────────────

async function runClaude(prompt: string): Promise<string> {
  const cmd = new Deno.Command('claude', {
    args: ['-p', SYSTEM_PROMPT, '--output-format', 'text'],
    stdin: 'piped',
    stdout: 'piped',
    stderr: 'null',
  });

  const process = cmd.spawn();

  const writer = process.stdin.getWriter();
  await writer.write(new TextEncoder().encode(prompt));
  await writer.close();

  const output = await process.output();
  if (!output.success) {
    throw new Error(`claude CLI がエラーで終了しました (code=${output.code})`);
  }

  return new TextDecoder().decode(output.stdout);
}

// ─────────────────────────────────────────────
// チャンク処理
// ─────────────────────────────────────────────

interface Stats {
  kept: number;
  discarded: number;
  skipped: number;
  error: number;
}

async function processChunk(
  chunkFiles: string[],
  dryRun: boolean,
  stats: Stats,
): Promise<void> {
  const batchPrompt = await buildBatchPrompt(chunkFiles);

  let rawResult: string;
  try {
    rawResult = await runClaude(batchPrompt);
  } catch (e) {
    console.error(`  警告: claude CLI 実行失敗。チャンク内ファイルをすべて KEEP 扱い`);
    console.error(`  error: ${e}`);
    for (const f of chunkFiles) {
      console.error(`  kept (claude error): ${f.split(/[/\\]/).pop()}`);
      stats.kept++;
    }
    return;
  }

  const parsed = parseJsonArray(rawResult);
  if (!parsed) {
    console.error(`  警告: JSON パース失敗。チャンク内ファイルをすべて KEEP 扱い`);
    console.error(`  raw output: ${rawResult.slice(0, 200)}`);
    for (const f of chunkFiles) {
      console.error(`  kept (parse error): ${f.split(/[/\\]/).pop()}`);
      stats.kept++;
    }
    return;
  }

  for (const filePath of chunkFiles) {
    const filename = filePath.split(/[/\\]/).pop()!;
    const result = parsed.find((r) => r.file === filename);

    if (!result) {
      console.error(`  kept (not in result): ${filename}`);
      stats.kept++;
      continue;
    }

    const { decision, confidence, reason } = result;

    if (decision === 'DISCARD' && confidence >= DISCARD_THRESHOLD) {
      if (dryRun) {
        console.log(`[dry-run] DISCARD (conf=${confidence}): ${filePath}`);
        console.error(`  reason: ${reason}`);
        stats.discarded++;
      } else {
        console.log(`DISCARD (conf=${confidence}): ${filePath}`);
        console.error(`  reason: ${reason}`);
        try {
          await Deno.remove(filePath);
          stats.discarded++;
        } catch {
          console.error(`  削除失敗: ${filePath}`);
          stats.error++;
        }
      }
    } else {
      console.error(`  kept (decision=${decision}, conf=${confidence}): ${filename}`);
      stats.kept++;
    }
  }
}

// ─────────────────────────────────────────────
// 引数解析
// ─────────────────────────────────────────────

interface Args {
  period?: string;
  project?: string;
  dryRun: boolean;
  inputDir: string;
}

function parseArgs(args: string[]): Args {
  let period: string | undefined;
  let project: string | undefined;
  let dryRun = false;
  let inputDir = './temp/chatlog';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--input' && i + 1 < args.length) {
      inputDir = args[++i];
    } else if (arg.startsWith('--input=')) {
      inputDir = arg.slice('--input='.length);
    } else if (arg.startsWith('-')) {
      console.error(`不明なオプション: ${arg}`);
      Deno.exit(1);
    } else if (!period) {
      period = arg;
    } else if (!project) {
      project = arg;
    }
  }

  return { period, project, dryRun, inputDir };
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  const { period, project, dryRun, inputDir } = parseArgs(Deno.args);

  // 入力ディレクトリ確認
  try {
    const stat = await Deno.stat(inputDir);
    if (!stat.isDirectory) {
      console.error(`エラー: 入力ディレクトリが見つかりません: ${inputDir}`);
      Deno.exit(1);
    }
  } catch {
    console.error(`エラー: 入力ディレクトリが見つかりません: ${inputDir}`);
    Deno.exit(1);
  }

  // ファイル列挙
  const allFiles = await findMdFiles(inputDir, period, project);

  // 事前フィルタ
  const targetFiles = await prefilterFiles(allFiles);

  const total = targetFiles.length;
  if (total === 0) {
    console.error('対象ファイルなし');
    console.error('完了: kept=0 discarded=0 skipped=0 error=0');
    Deno.exit(0);
  }

  console.error(`判定対象ファイル数: ${total}`);
  if (dryRun) { console.error('dry-run モード: ファイルは削除しません'); }

  // チャンク分割して並列処理
  const stats: Stats = { kept: 0, discarded: 0, skipped: 0, error: 0 };

  const tasks: (() => Promise<void>)[] = [];
  for (let i = 0; i < targetFiles.length; i += CHUNK_SIZE) {
    const chunk = targetFiles.slice(i, i + CHUNK_SIZE);
    tasks.push(() => processChunk(chunk, dryRun, stats));
  }
  await withConcurrency(tasks, CONCURRENCY);

  // サマリー
  const drySuffix = dryRun ? ' (dry-run)' : '';
  console.error(
    `\n完了${drySuffix}: kept=${stats.kept} discarded=${stats.discarded} skipped=${stats.skipped} error=${stats.error}`,
  );
}

await main();
