#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
/**
 * export_chatlog.ts — AIエージェントのセッション履歴をMarkdownにエクスポートする
 *
 * 使い方:
 *   deno run --allow-read --allow-write --allow-env export_chatlog.ts \
 *     [agent] [YYYY-MM|YYYY] [project] --output DIR
 *
 * 対応エージェント:
 *   claude  — ~/.claude/projects/ 以下のJSONL
 *   codex   — ~/.codex/sessions/YYYY/MM/DD/ 以下のJSONL
 */

// ─────────────────────────────────────────────
// 定数
// ─────────────────────────────────────────────

const SHORT_AFFIRMATION_MAX_LEN = 20;

const SKIP_EXACT = new Set([
  'y', 'yes', 'はい', 'うん', 'ok', 'sure', 'yep', 'yeah',
  '進めて', 'やって', 'do it', 'doit', 'go', 'go ahead', 'proceed',
  'それで', 'それでいい', 'それでお願いします', 'お願いします', 'いいよ', 'いいです', '大丈夫',
  'ありがとう', 'ありがとうございます', 'thanks', 'thx',
]);

const SKIP_PREFIXES = [
  '/clear', '/help', '/reset', '/exit', '/quit',
  '<system-reminder', '<command-name', '<command-message',
  '[Request interrupted', 'Tool loaded.', 'Unknown skill:',
  "Say 'OK' and nothing else.",
];

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

interface SessionMeta {
  sessionId: string;
  date: string;       // YYYY-MM-DD
  project: string;
  slug: string;
  firstUserText: string;
}

interface ExportedSession {
  meta: SessionMeta;
  turns: Turn[];
}

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

function homeDir(): string {
  return Deno.env.get('USERPROFILE') ?? Deno.env.get('HOME') ?? '';
}

function isoToDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return 'unknown';
  }
}

function isoToMs(iso: string): number {
  try {
    return new Date(iso).getTime();
  } catch {
    return 0;
  }
}

function textToSlug(text: string, fallback = 'session'): string {
  let s = text.trim().split('\n\n')[0].slice(0, 200);
  s = s.split('\n')[0].trim();
  // ASCII のみ残す
  s = s.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  s = s.replace(/[^a-zA-Z0-9]+/g, '-').trim().toLowerCase();
  s = s.replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 50).replace(/-$/, '');
  return s.length >= 3 ? s : fallback;
}

function isShortAffirmation(text: string): boolean {
  return text.length <= SHORT_AFFIRMATION_MAX_LEN && SKIP_EXACT.has(text.trim().toLowerCase());
}

function isSkippable(text: string): boolean {
  if (!text) return true;
  if (SKIP_PREFIXES.some((p) => text.startsWith(p))) return true;
  if (isShortAffirmation(text)) return true;
  return false;
}

// ─────────────────────────────────────────────
// 期間フィルタ
// ─────────────────────────────────────────────

interface PeriodRange {
  startMs: number;
  endMs: number;
}

function parsePeriod(period: string | undefined): PeriodRange {
  if (!period) {
    return { startMs: 0, endMs: Infinity };
  }
  const ymMatch = period.match(/^(\d{4})-(\d{2})$/);
  const yMatch = period.match(/^(\d{4})$/);
  if (ymMatch) {
    const year = parseInt(ymMatch[1]);
    const month = parseInt(ymMatch[2]);
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 1).getTime();
    return { startMs: start, endMs: end };
  } else if (yMatch) {
    const year = parseInt(yMatch[1]);
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year + 1, 0, 1).getTime();
    return { startMs: start, endMs: end };
  }
  throw new Error(`期間の形式が不正です（例: 2026-03 または 2026）: ${period}`);
}

function inPeriod(isoTimestamp: string, range: PeriodRange): boolean {
  const ms = isoToMs(isoTimestamp);
  return ms >= range.startMs && ms < range.endMs;
}

// ─────────────────────────────────────────────
// 出力パス生成
// ─────────────────────────────────────────────

function buildOutputPath(
  outputBase: string,
  agent: string,
  meta: SessionMeta,
  slug: string,
): string {
  const yearMonth = meta.date.slice(0, 7);   // YYYY-MM
  const year = meta.date.slice(0, 4);         // YYYY
  const sessionId8 = meta.sessionId.replace(/-/g, '').slice(0, 8);
  const filename = `${meta.date}-${slug}-${sessionId8}.md`;
  return `${outputBase}/${agent}/${year}/${yearMonth}/${meta.project}/${filename}`;
}

// ─────────────────────────────────────────────
// Markdown レンダリング
// ─────────────────────────────────────────────

function renderMarkdown(meta: SessionMeta, turns: Turn[]): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`session_id: ${meta.sessionId}`);
  lines.push(`date: ${meta.date}`);
  lines.push(`project: ${meta.project}`);
  if (meta.slug) lines.push(`slug: ${meta.slug}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${meta.firstUserText.replace(/\n/g, ' ').slice(0, 100)}`);
  lines.push('');
  lines.push('## 会話ログ');
  lines.push('');
  for (const turn of turns) {
    const label = turn.role === 'user' ? 'User' : 'Assistant';
    lines.push(`### ${label}`);
    lines.push('');
    lines.push(turn.text.trim());
    lines.push('');
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// ファイル書き出し
// ─────────────────────────────────────────────

async function writeSession(
  outputBase: string,
  agent: string,
  session: ExportedSession,
): Promise<string> {
  const slug = textToSlug(session.meta.firstUserText, session.meta.slug || 'session');
  const outPath = buildOutputPath(outputBase, agent, session.meta, slug);
  const content = renderMarkdown(session.meta, session.turns);

  const dir = outPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(outPath, content);
  return outPath;
}

// ─────────────────────────────────────────────
// Claude パーサー
// ─────────────────────────────────────────────

interface ClaudeEntry {
  type: string;
  isMeta?: boolean;
  sessionId?: string;
  timestamp?: string;
  slug?: string;
  cwd?: string;
  message?: {
    id?: string;
    content?: unknown;
  };
}

function extractClaudeUserText(content: unknown): string {
  if (typeof content === 'string') {
    const text = content.trim();
    if (/^<local-command-stdout\b/.test(text)) return '';
    return text;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item !== 'object' || !item) continue;
      const it = item as Record<string, unknown>;
      if (it.type === 'tool_result') continue;
      if (it.type === 'text' && typeof it.text === 'string') {
        const t = it.text;
        if (/^<(ide_opened_file|ide_selection|local-command-caveat|local-command-stdout|system-reminder)\b/.test(t)) continue;
        parts.push(t);
      }
    }
    return parts.join(' ').trim();
  }
  return '';
}

function extractClaudeAssistantText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item !== 'object' || !item) continue;
      const it = item as Record<string, unknown>;
      if (it.type === 'text' && typeof it.text === 'string') {
        parts.push(it.text);
      }
    }
    return parts.join('\n').trim();
  }
  return '';
}

async function parseClaudeSession(
  filePath: string,
  range: PeriodRange,
  projectFilter?: string,
): Promise<ExportedSession | null> {
  let lines: string[];
  try {
    const text = await Deno.readTextFile(filePath);
    lines = text.split('\n').filter((l) => l.trim());
  } catch {
    return null;
  }

  const entries: ClaudeEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip
    }
  }

  // 期間内エントリに絞る
  const filtered = entries.filter((e) => {
    if (!e.timestamp) return false;
    return inPeriod(e.timestamp, range);
  });
  if (filtered.length === 0) return null;

  // 最初の意味あるユーザーエントリを探す
  let firstEntry: ClaudeEntry | null = null;
  for (const e of filtered) {
    if (e.type !== 'user' || e.isMeta) continue;
    const text = extractClaudeUserText(e.message?.content);
    if (!text || isSkippable(text)) continue;
    firstEntry = e;
    break;
  }
  if (!firstEntry) return null;

  const cwd = firstEntry.cwd ?? '';
  const project = cwd ? cwd.replace(/\\/g, '/').split('/').pop()! : 'unknown';

  if (projectFilter && !project.toLowerCase().includes(projectFilter.toLowerCase())) {
    return null;
  }

  // 会話ターン抽出
  const turns: Turn[] = [];
  let lastAssistantMsgId = '';
  let lastAssistantIdx = -1;

  for (const e of filtered) {
    if (e.type === 'user') {
      if (e.isMeta) continue;
      const text = extractClaudeUserText(e.message?.content);
      if (!text || isSkippable(text)) continue;
      turns.push({ role: 'user', text });
      lastAssistantMsgId = '';
    } else if (e.type === 'assistant') {
      if (e.isMeta) continue;
      const msgId = e.message?.id ?? '';
      const text = extractClaudeAssistantText(e.message?.content);
      if (!text) continue;
      if (msgId && msgId === lastAssistantMsgId && lastAssistantIdx >= 0) {
        turns[lastAssistantIdx].text += text;
      } else {
        turns.push({ role: 'assistant', text });
        lastAssistantIdx = turns.length - 1;
        lastAssistantMsgId = msgId;
      }
    }
  }
  if (turns.length === 0) return null;

  const firstUserText = extractClaudeUserText(firstEntry.message?.content);
  const meta: SessionMeta = {
    sessionId: firstEntry.sessionId ?? 'unknown',
    date: isoToDate(firstEntry.timestamp ?? ''),
    project,
    slug: firstEntry.slug ?? '',
    firstUserText,
  };

  return { meta, turns };
}

async function findClaudeSessions(
  period: PeriodRange,
  projectFilter?: string,
): Promise<string[]> {
  const projectsDir = `${homeDir()}/.claude/projects`;
  const results: string[] = [];

  let projectDirs: Deno.DirEntry[];
  try {
    projectDirs = [];
    for await (const e of Deno.readDir(projectsDir)) {
      if (e.isDirectory) projectDirs.push(e);
    }
  } catch {
    return results;
  }

  for (const pd of projectDirs) {
    // プロジェクトフィルタ（ディレクトリ名末尾がプロジェクト名）
    if (projectFilter) {
      const dirName = pd.name.toLowerCase();
      const projName = dirName.includes('-') ? dirName.split('-').pop()! : dirName;
      if (!projName.includes(projectFilter.toLowerCase()) &&
          !dirName.includes(projectFilter.toLowerCase().replace(' ', '-'))) {
        continue;
      }
    }
    const pdPath = `${projectsDir}/${pd.name}`;
    for await (const entry of walkFiles(pdPath, '.jsonl')) {
      // subagents/ は除外
      if (entry.includes('/subagents/') || entry.includes('\\subagents\\')) continue;
      results.push(entry);
    }
  }

  return results.sort();
}

// ─────────────────────────────────────────────
// Codex パーサー
// ─────────────────────────────────────────────

interface CodexEntry {
  timestamp: string;
  type: string;
  payload: {
    id?: string;
    cwd?: string;
    type?: string;
    role?: string;
    content?: Array<{ type: string; text?: string }>;
  };
}

async function parseCodexSession(
  filePath: string,
  range: PeriodRange,
  projectFilter?: string,
): Promise<ExportedSession | null> {
  let lines: string[];
  try {
    const text = await Deno.readTextFile(filePath);
    lines = text.split('\n').filter((l) => l.trim());
  } catch {
    return null;
  }

  const entries: CodexEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip
    }
  }

  // session_meta からセッション情報を取得
  const metaEntry = entries.find((e) => e.type === 'session_meta');
  if (!metaEntry) return null;

  const sessionId = metaEntry.payload.id ?? 'unknown';
  const cwd = metaEntry.payload.cwd ?? '';
  const project = cwd ? cwd.replace(/\\/g, '/').split('/').pop()! : 'unknown';
  const sessionTimestamp = metaEntry.timestamp;

  // 期間チェック（session_meta の timestamp で判定）
  if (!inPeriod(sessionTimestamp, range)) return null;

  if (projectFilter && !project.toLowerCase().includes(projectFilter.toLowerCase())) {
    return null;
  }

  // 会話ターン抽出（response_item の role=user/assistant）
  const turns: Turn[] = [];
  for (const e of entries) {
    if (e.type !== 'response_item') continue;
    const role = e.payload.role;
    if (role !== 'user' && role !== 'assistant') continue;

    const content = e.payload.content ?? [];
    const textType = role === 'user' ? 'input_text' : 'output_text';
    const parts: string[] = [];
    for (const c of content) {
      if (c.type === textType && c.text) {
        parts.push(c.text);
      }
    }
    const text = parts.join('\n').trim();
    if (!text) continue;
    if (role === 'user' && isSkippable(text)) continue;

    // user の AGENTS.md/permissions/environment_context は除外
    if (role === 'user' && (
      text.startsWith('# AGENTS.md instructions') ||
      text.startsWith('<permissions instructions>') ||
      text.startsWith('<environment_context>')
    )) continue;

    turns.push({ role: role as 'user' | 'assistant', text });
  }

  // 意味あるユーザーターンがなければスキップ
  const firstUserTurn = turns.find((t) => t.role === 'user');
  if (!firstUserTurn) return null;

  const date = isoToDate(sessionTimestamp);
  const meta: SessionMeta = {
    sessionId,
    date,
    project,
    slug: '',
    firstUserText: firstUserTurn.text,
  };

  return { meta, turns };
}

async function findCodexSessions(
  period: PeriodRange,
): Promise<string[]> {
  const sessionsDir = `${homeDir()}/.codex/sessions`;
  const results: string[] = [];

  // sessions/YYYY/MM/DD/*.jsonl
  for await (const f of walkFiles(sessionsDir, '.jsonl')) {
    results.push(f);
  }

  return results.sort();
}

// ─────────────────────────────────────────────
// 汎用ファイル走査
// ─────────────────────────────────────────────

async function* walkFiles(dir: string, ext: string): AsyncGenerator<string> {
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
      yield* walkFiles(fullPath, ext);
    } else if (e.isFile && e.name.endsWith(ext)) {
      yield fullPath;
    }
  }
}

// ─────────────────────────────────────────────
// 引数解析
// ─────────────────────────────────────────────

const KNOWN_AGENTS = ['claude', 'codex'];

interface Args {
  agent: string;
  period?: string;
  project?: string;
  outputDir: string;
}

function parseArgs(args: string[]): Args {
  let agent: string | undefined;
  let period: string | undefined;
  let project: string | undefined;
  let outputDir = './temp/chatlog';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (arg.startsWith('--output=')) {
      outputDir = arg.slice('--output='.length);
    } else if (arg.startsWith('-')) {
      console.error(`不明なオプション: ${arg}`);
      Deno.exit(1);
    } else if (KNOWN_AGENTS.includes(arg)) {
      agent = arg;
    } else if (/^\d{4}-\d{2}$/.test(arg) || /^\d{4}$/.test(arg)) {
      period = arg;
    } else {
      project = arg;
    }
  }

  return { agent: agent ?? 'claude', period, project, outputDir };
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

async function main(): Promise<void> {
  const { agent, period, project, outputDir } = parseArgs(Deno.args);

  let range: PeriodRange;
  try {
    range = parsePeriod(period);
  } catch (e) {
    console.error(`エラー: ${e}`);
    Deno.exit(1);
  }

  console.error(`対象 agent: ${agent}`);
  if (period) console.error(`対象期間: ${period}`);
  if (project) console.error(`プロジェクトフィルタ: ${project}`);

  let sessionFiles: string[];
  let parseSession: (f: string) => Promise<ExportedSession | null>;

  if (agent === 'claude') {
    sessionFiles = await findClaudeSessions(range, project);
    parseSession = (f) => parseClaudeSession(f, range, project);
  } else if (agent === 'codex') {
    sessionFiles = await findCodexSessions(range);
    parseSession = (f) => parseCodexSession(f, range, project);
  } else {
    console.error(`未対応のエージェント: ${agent}`);
    Deno.exit(1);
  }

  console.error(`セッションファイル数: ${sessionFiles.length}`);

  let exported = 0;
  let skipped = 0;

  for (const file of sessionFiles) {
    try {
      const session = await parseSession(file);
      if (!session) {
        skipped++;
        continue;
      }
      const outPath = await writeSession(outputDir, agent, session);
      exported++;
      console.log(outPath);
    } catch (e) {
      console.error(`警告: ${file} の処理中にエラー: ${e}`);
      skipped++;
    }
  }

  console.error(`\n完了: ${exported} ファイルを ${outputDir}/${agent}/ に書き出しました（${skipped} 件スキップ）`);
}

await main();
