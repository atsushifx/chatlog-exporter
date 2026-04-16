#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env
// src: scripts/export-chatlog.ts
// @(#): AIエージェントのセッション履歴をMarkdownにエクスポートする
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
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
// 定数（import + re-export）
// ─────────────────────────────────────────────

import { SHORT_AFFIRMATION_MAX_LEN, SKIP_EXACT, SKIP_PREFIXES } from './constants/skip-rules.constants.ts';
import { KNOWN_AGENTS } from './constants/agents.constants.ts';
import { DEFAULT_EXPORT_CONFIG } from './constants/defaults.constants.ts';

export { SHORT_AFFIRMATION_MAX_LEN, SKIP_EXACT, SKIP_PREFIXES } from './constants/skip-rules.constants.ts';
export { KNOWN_AGENTS } from './constants/agents.constants.ts';
export { DEFAULT_AGENT, DEFAULT_EXPORT_CONFIG, DEFAULT_OUTPUT_DIR } from './constants/defaults.constants.ts';

// ─────────────────────────────────────────────
// 型定義（import + re-export）
// ─────────────────────────────────────────────

import type { Turn, SessionMeta, ExportedSession } from './types/session.types.ts';
import type { PeriodRange } from './types/filter.types.ts';
import type { ClaudeEntry, CodexEntry } from './types/entries.types.ts';
import type { ExportConfig } from './types/export-config.types.ts';

export type { Turn, SessionMeta, ExportedSession } from './types/session.types.ts';
export type { PeriodRange } from './types/filter.types.ts';
export type { ClaudeEntry, CodexEntry } from './types/entries.types.ts';
export type { ExportConfig } from './types/export-config.types.ts';

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * 実行環境のホームディレクトリパスを返す。
 *
 * Windows 環境では `USERPROFILE`、Unix 環境では `HOME` 環境変数を参照する。
 * Claude の `~/.claude/projects/` および Codex の `~/.codex/sessions/` の
 * 起点パスとして `findClaudeSessions`・`findCodexSessions` が使用する。
 *
 * @returns ホームディレクトリの絶対パス。環境変数が未設定の場合は空文字列
 */
export function homeDir(): string {
  return Deno.env.get('USERPROFILE') ?? Deno.env.get('HOME') ?? '';
}

/**
 * ISO8601 タイムスタンプ文字列を YYYY-MM-DD 形式の日付文字列に変換する。
 *
 * `SessionMeta.date` の生成および出力パスの年月ディレクトリ名の確定に使用する。
 * パース失敗時はエクスポートを中断せず 'unknown' を返してフォールバックする。
 *
 * @param iso ISO8601 形式のタイムスタンプ文字列（例: "2026-03-15T10:00:00.000Z"）
 * @returns YYYY-MM-DD 形式の日付文字列。パース失敗時は 'unknown'
 */
export function isoToDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return 'unknown';
  }
}

/**
 * ISO8601 タイムスタンプ文字列をエポックミリ秒に変換する。
 *
 * `inPeriod()` が `PeriodRange` との比較に使用する。
 * パース失敗時は NaN を返す（`Date.prototype.getTime` の仕様による）。
 *
 * @param iso ISO8601 形式のタイムスタンプ文字列（例: "2026-03-15T10:00:00.000Z"）
 * @returns エポックミリ秒の数値。パース失敗時は NaN
 */
export function isoToMs(iso: string): number {
  try {
    return new Date(iso).getTime();
  } catch {
    return 0;
  }
}

/**
 * テキストからファイル名用の URL セーフなスラッグ文字列を生成する。
 *
 * 変換手順:
 * 1. テキストの先頭 200 文字を取得し、最初の空行（段落区切り）前の先頭行のみを使用
 * 2. NFKD 正規化後に ASCII 範囲外（0x20-0x7E 外）を除去（日本語等を取り除く）
 * 3. 英数字以外の連続文字を単一ハイフンに置換し、先頭・末尾のハイフンを除去
 * 4. 50 文字に切り詰め、末尾のハイフンを除去
 * 5. 生成結果が 3 文字未満の場合は `fallback` を返す
 *
 * `writeSession` が `firstUserText` からファイル名のスラッグ部分を生成する際に使用する。
 *
 * @param text スラッグ化の元テキスト（通常は `SessionMeta.firstUserText`）
 * @param fallback 有効なスラッグが生成できない場合のデフォルト値（デフォルト: "session"）
 * @returns 英小文字・数字・ハイフンのみからなる 3〜50 文字のスラッグ、または `fallback`
 */
export function textToSlug(text: string, fallback = 'session'): string {
  let s = text.trim().split('\n\n')[0].slice(0, 200);
  s = s.split('\n')[0].trim();
  // ASCII のみ残す
  s = s.normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
  s = s.replace(/[^a-zA-Z0-9]+/g, '-').trim().toLowerCase();
  s = s.replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 50).replace(/-$/, '');
  return s.length >= 3 ? s : fallback;
}

/**
 * テキストが短文肯定応答かどうかを判定する。
 *
 * テキストの長さが `SHORT_AFFIRMATION_MAX_LEN` 以下かつ
 * `SKIP_EXACT` に含まれる場合に `true` を返す。
 * 大文字小文字を区別しない（`toLowerCase()` で正規化して照合）。
 *
 * `isSkippable()` から呼ばれるサブ判定関数。
 *
 * @param text 判定対象のテキスト
 * @returns 短文肯定応答と判定される場合 `true`
 * @see isSkippable
 * @see SKIP_EXACT
 * @see SHORT_AFFIRMATION_MAX_LEN
 */
export function isShortAffirmation(text: string): boolean {
  return text.length <= SHORT_AFFIRMATION_MAX_LEN && SKIP_EXACT.has(text.trim().toLowerCase());
}

/**
 * ユーザー入力テキストをチャットログから除外すべきか判定する。
 *
 * 以下のいずれかに該当する場合に `true` を返す:
 * 1. 空文字列
 * 2. `SKIP_PREFIXES` に定義されたプレフィックスで始まる
 *    （CLIコマンド "/clear" 等、システムメッセージ "<system-reminder" 等）
 * 3. `isShortAffirmation()` が `true` を返す（"yes", "はい", "ok" 等の短文肯定）
 *
 * `parseClaudeSession` および `parseCodexSession` が各ターンの
 * フィルタリングに使用する。
 *
 * @param text 判定対象のユーザー入力テキスト
 * @returns スキップすべき場合 `true`、実質的な会話であれば `false`
 * @see isShortAffirmation
 * @see SKIP_PREFIXES
 */
export function isSkippable(text: string): boolean {
  if (!text) { return true; }
  if (SKIP_PREFIXES.some((p) => text.startsWith(p))) { return true; }
  if (isShortAffirmation(text)) { return true; }
  return false;
}

// ─────────────────────────────────────────────
// 期間フィルタ
// ─────────────────────────────────────────────

/**
 * CLI の期間文字列を `PeriodRange`（ミリ秒の半開区間）に変換する。
 *
 * 受け付けるフォーマット:
 * - `undefined` — 全期間 `{ startMs: 0, endMs: Infinity }`
 * - `"YYYY-MM"` — 指定月の 1 日 00:00:00 から翌月 1 日 00:00:00 まで（ローカル時刻基準）
 * - `"YYYY"` — 指定年の 1 月 1 日 00:00:00 から翌年 1 月 1 日 00:00:00 まで（ローカル時刻基準）
 *
 * いずれにも一致しない場合は `Error` をスローする。
 * `main()` がこのエラーをキャッチして `Deno.exit(1)` で終了する。
 *
 * @param period "YYYY-MM"、"YYYY"、または undefined
 * @returns フィルタ用の半開区間 `PeriodRange`
 * @throws {Error} period が上記フォーマットに一致しない場合
 */
export function parsePeriod(period: string | undefined): PeriodRange {
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

/**
 * ISO8601 タイムスタンプが指定した期間範囲内にあるかを判定する。
 *
 * `PeriodRange` は半開区間 [startMs, endMs) であり、startMs の値を含み
 * endMs の値を含まない。`isoToMs()` でミリ秒変換してから比較する。
 *
 * `parseClaudeSession` および `parseCodexSession` が各エントリの
 * タイムスタンプ照合に使用する。
 *
 * @param isoTimestamp 判定対象の ISO8601 タイムスタンプ文字列
 * @param range `parsePeriod()` が生成した半開区間フィルタ
 * @returns タイムスタンプが範囲内（startMs ≤ ms < endMs）の場合 `true`
 */
export function inPeriod(isoTimestamp: string, range: PeriodRange): boolean {
  const ms = isoToMs(isoTimestamp);
  return ms >= range.startMs && ms < range.endMs;
}

// ─────────────────────────────────────────────
// 出力パス生成
// ─────────────────────────────────────────────

/**
 * セッションの Markdown ファイル出力パスを生成する。
 *
 * 生成されるパス形式:
 * `{outputBase}/{agent}/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}-{slug}-{sessionId8}.md`
 *
 * - `sessionId8`: sessionId からハイフンを除去した先頭 8 文字（一意性のサフィックス）
 * - `YYYY` / `YYYY-MM`: meta.date から抽出した年・年月
 * - `slug`: `textToSlug()` が生成した URL セーフな文字列
 *
 * `writeSession` が呼び出し、Markdown ファイルの書き出し先パスを確定する。
 *
 * @param outputBase 出力ベースディレクトリ（`ExportConfig.outputDir`）
 * @param agent エージェント名（"claude" または "codex"）。パスの第 1 セグメントになる
 * @param meta セッションメタ情報（sessionId・date を使用する）
 * @param slug `textToSlug()` が生成したスラッグ文字列
 * @returns ファイル出力先の絶対パス文字列
 */
export function buildOutputPath(
  outputBase: string,
  agent: string,
  meta: SessionMeta,
  slug: string,
): string {
  const yearMonth = meta.date.slice(0, 7); // YYYY-MM
  const year = meta.date.slice(0, 4); // YYYY
  const sessionId8 = meta.sessionId.replace(/-/g, '').slice(0, 8);
  const filename = `${meta.date}-${slug}-${sessionId8}.md`;
  return `${outputBase}/${agent}/${year}/${yearMonth}/${filename}`;
}

// ─────────────────────────────────────────────
// Markdown レンダリング
// ─────────────────────────────────────────────

/**
 * セッションメタ情報と会話ターン一覧から Markdown 文字列を生成する。
 *
 * 生成される Markdown の構造:
 * 1. YAML フロントマター（session_id, date, project, slug）
 * 2. firstUserText を H1 見出しとして出力（最大 100 文字、改行はスペースに変換）
 * 3. `## 会話ログ` セクション配下に各ターンを `### User` / `### Assistant` で出力
 *
 * ターン内の 3 連続以上の改行は 2 連続に正規化する（過剰な空行を除去）。
 * `slug` が空文字列の場合はフロントマターの `slug:` 行を省略する。
 *
 * `writeSession` から呼ばれ、書き出すファイルの内容文字列を生成する。
 *
 * @param meta セッションのメタ情報
 * @param turns スキップフィルタ済みの会話ターン一覧
 * @returns Markdown 形式の文字列
 */
export function renderMarkdown(meta: SessionMeta, turns: Turn[]): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`session_id: ${meta.sessionId}`);
  lines.push(`date: ${meta.date}`);
  lines.push(`project: ${meta.project}`);
  if (meta.slug) { lines.push(`slug: ${meta.slug}`); }
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
    lines.push(turn.text.trim().replace(/\n{3,}/g, '\n\n'));
    lines.push('');
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// ファイル書き出し
// ─────────────────────────────────────────────

/**
 * エクスポートセッションを Markdown ファイルとして書き出す。
 *
 * `textToSlug()` で firstUserText からスラッグを生成し、`buildOutputPath()` で
 * 出力パスを確定後、`renderMarkdown()` で Markdown 文字列を生成して書き込む。
 * 出力先ディレクトリが存在しない場合は `Deno.mkdir({ recursive: true })` で
 * 自動生成する（深いネストにも対応）。
 *
 * `main()` がセッションごとにこの関数を呼び、返却パスを `console.log` に出力する。
 *
 * @param outputBase 出力ベースディレクトリ（`ExportConfig.outputDir`）
 * @param agent エージェント名（"claude" または "codex"）。パスの第 1 セグメントになる
 * @param session パース済みセッションデータ（meta + turns）
 * @returns 書き出した Markdown ファイルの絶対パス
 */
export async function writeSession(
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

/**
 * Claude JSONL エントリの `message.content` フィールドからユーザーテキストを抽出する。
 *
 * content の型に応じて以下のように処理する:
 * - **文字列**: `<local-command-stdout` で始まる場合は空文字列を返す。それ以外はそのまま返す
 * - **配列**: 各アイテムを走査し、`type === "text"` かつ以下のプレフィックスを持たない
 *   テキストのみをスペース連結して返す。
 *   除外プレフィックス: `<ide_opened_file`, `<ide_selection`, `<local-command-caveat`,
 *   `<local-command-stdout`, `<system-reminder`。`type === "tool_result"` は無条件スキップ
 * - **その他**（null/undefined 含む）: 空文字列を返す
 *
 * `parseClaudeSession` が user エントリから会話テキストを取り出す際に使用する。
 *
 * @param content `ClaudeEntry.message.content` の値（型不明のため `unknown`）
 * @returns 抽出されたユーザーテキスト。抽出不能または除外対象の場合は空文字列
 */
export function extractClaudeUserText(content: unknown): string {
  if (typeof content === 'string') {
    const text = content.trim();
    if (/^<local-command-stdout\b/.test(text)) { return ''; }
    return text;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item !== 'object' || !item) { continue; }
      const it = item as Record<string, unknown>;
      if (it.type === 'tool_result') { continue; }
      if (it.type === 'text' && typeof it.text === 'string') {
        const t = it.text;
        if (
          /^<(ide_opened_file|ide_selection|local-command-caveat|local-command-stdout|system-reminder)\b/.test(t)
        ) { continue; }
        parts.push(t);
      }
    }
    return parts.join(' ').trim();
  }
  return '';
}

/**
 * Claude JSONL エントリの `message.content` フィールドからアシスタントテキストを抽出する。
 *
 * content の型に応じて以下のように処理する:
 * - **文字列**: そのままトリムして返す
 * - **配列**: `type === "text"` のアイテムのテキストを改行連結して返す。
 *   `type === "tool_use"` 等の非テキストアイテムはスキップ
 * - **その他**（null/undefined 含む）: 空文字列を返す
 *
 * ユーザーテキスト抽出（`extractClaudeUserText`）と異なり、
 * アシスタント応答のシステムメッセージ除外は行わない。
 * `parseClaudeSession` が assistant エントリから会話テキストを取り出す際に使用する。
 *
 * @param content `ClaudeEntry.message.content` の値（型不明のため `unknown`）
 * @returns 抽出されたアシスタントテキスト。抽出不能の場合は空文字列
 */
export function extractClaudeAssistantText(content: unknown): string {
  if (typeof content === 'string') { return content.trim(); }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item !== 'object' || !item) { continue; }
      const it = item as Record<string, unknown>;
      if (it.type === 'text' && typeof it.text === 'string') {
        parts.push(it.text);
      }
    }
    return parts.join('\n').trim();
  }
  return '';
}

/**
 * Claude JSONL ファイルを読み込み、指定期間内の会話セッションを抽出する。
 *
 * 処理フロー:
 * 1. ファイルを行単位で読み込み、各行を JSON パース（失敗行はスキップ）
 * 2. `inPeriod()` で期間外エントリを除外
 * 3. 最初の意味あるユーザーエントリ（`isMeta === false` かつ `isSkippable() === false`）を確定
 * 4. 全エントリを走査してターンを構築。同一 `message.id` を持つ連続 assistant エントリは
 *    テキスト連結（Claude のストリーミング断片を統合するため）
 *
 * 以下のいずれかの場合に `null` を返す:
 * - ファイル読み込み失敗
 * - 期間内エントリが 0 件
 * - 意味あるユーザーエントリが見つからない（全てスキップ対象）
 * - 抽出ターン数が 0 件
 *
 * @param filePath Claude JSONL ファイルの絶対パス
 * @param range `parsePeriod()` が生成した期間フィルタ
 * @returns パース結果の `ExportedSession`、スキップ対象の場合は `null`
 */
export async function parseClaudeSession(
  filePath: string,
  range: PeriodRange,
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
    if (!e.timestamp) { return false; }
    return inPeriod(e.timestamp, range);
  });
  if (filtered.length === 0) { return null; }

  // 最初の意味あるユーザーエントリを探す
  let firstEntry: ClaudeEntry | null = null;
  for (const e of filtered) {
    if (e.type !== 'user' || e.isMeta) { continue; }
    const text = extractClaudeUserText(e.message?.content);
    if (!text || isSkippable(text)) { continue; }
    firstEntry = e;
    break;
  }
  if (!firstEntry) { return null; }

  const cwd = firstEntry.cwd ?? '';
  const project = cwd ? cwd.replace(/\\/g, '/').split('/').pop()! : 'unknown';

  // 会話ターン抽出
  const turns: Turn[] = [];
  let lastAssistantMsgId = '';
  let lastAssistantIdx = -1;

  for (const e of filtered) {
    if (e.type === 'user') {
      if (e.isMeta) { continue; }
      const text = extractClaudeUserText(e.message?.content);
      if (!text || isSkippable(text)) { continue; }
      turns.push({ role: 'user', text });
      lastAssistantMsgId = '';
    } else if (e.type === 'assistant') {
      if (e.isMeta) { continue; }
      const msgId = e.message?.id ?? '';
      const text = extractClaudeAssistantText(e.message?.content);
      if (!text) { continue; }
      if (msgId && msgId === lastAssistantMsgId && lastAssistantIdx >= 0) {
        turns[lastAssistantIdx].text += text;
      } else {
        turns.push({ role: 'assistant', text });
        lastAssistantIdx = turns.length - 1;
        lastAssistantMsgId = msgId;
      }
    }
  }
  if (turns.length === 0) { return null; }

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

/**
 * `~/.claude/projects/` 配下の全 JSONL セッションファイルパスを収集する。
 *
 * プロジェクトディレクトリを列挙し、各プロジェクト配下を `walkFiles()` で再帰走査する。
 * `subagents/` サブディレクトリ内のファイルはサブエージェントのセッションのため除外する。
 * ホームディレクトリが `homeDir()` から取得できない場合や
 * projects ディレクトリが存在しない場合は空配列を返す（エラーなし）。
 *
 * @param _period 期間フィルタ（現在は未使用。パーサー側でフィルタリングするため）
 * @returns ソート済みの JSONL ファイルパス配列
 */
export async function findClaudeSessions(
  _period: PeriodRange,
): Promise<string[]> {
  const projectsDir = `${homeDir()}/.claude/projects`;
  const results: string[] = [];

  let projectDirs: Deno.DirEntry[];
  try {
    projectDirs = [];
    for await (const e of Deno.readDir(projectsDir)) {
      if (e.isDirectory) { projectDirs.push(e); }
    }
  } catch {
    return results;
  }

  for (const pd of projectDirs) {
    const pdPath = `${projectsDir}/${pd.name}`;
    for await (const entry of walkFiles(pdPath, '.jsonl')) {
      // subagents/ は除外
      if (entry.includes('/subagents/') || entry.includes('\\subagents\\')) { continue; }
      results.push(entry);
    }
  }

  return results.sort();
}

// ─────────────────────────────────────────────
// Codex パーサー
// ─────────────────────────────────────────────

/**
 * Codex JSONL ファイルを読み込み、指定期間内の会話セッションを抽出する。
 *
 * Claude と異なり、Codex の JSONL は以下の構造を持つ:
 * - `session_meta` エントリ: セッション ID・cwd・モデル名を保持（期間判定もここで行う）
 * - `response_item` エントリ: 会話ターン本体（role: "user" | "assistant"）
 *
 * user ターンの以下のコンテンツは除外する（Codex が自動注入するシステム情報）:
 * - `"# AGENTS.md instructions"` で始まるテキスト
 * - `"<permissions instructions>"` で始まるテキスト
 * - `"<environment_context>"` で始まるテキスト
 *
 * 以下のいずれかの場合に `null` を返す:
 * - ファイル読み込み失敗
 * - `session_meta` エントリが存在しない
 * - session_meta のタイムスタンプが期間外
 * - 意味あるユーザーターンが見つからない
 *
 * @param filePath Codex JSONL ファイルの絶対パス
 * @param range `parsePeriod()` が生成した期間フィルタ
 * @returns パース結果の `ExportedSession`、スキップ対象の場合は `null`
 */
export async function parseCodexSession(
  filePath: string,
  range: PeriodRange,
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
  if (!metaEntry) { return null; }

  const sessionId = metaEntry.payload.id ?? 'unknown';
  const cwd = metaEntry.payload.cwd ?? '';
  const project = cwd ? cwd.replace(/\\/g, '/').split('/').pop()! : 'unknown';
  const sessionTimestamp = metaEntry.timestamp;

  // 期間チェック（session_meta の timestamp で判定）
  if (!inPeriod(sessionTimestamp, range)) { return null; }

  // 会話ターン抽出（response_item の role=user/assistant）
  const turns: Turn[] = [];
  for (const e of entries) {
    if (e.type !== 'response_item') { continue; }
    const role = e.payload.role;
    if (role !== 'user' && role !== 'assistant') { continue; }

    const content = e.payload.content ?? [];
    const textType = role === 'user' ? 'input_text' : 'output_text';
    const parts: string[] = [];
    for (const c of content) {
      if (c.type === textType && c.text) {
        parts.push(c.text);
      }
    }
    const text = parts.join('\n').trim();
    if (!text) { continue; }
    if (role === 'user' && isSkippable(text)) { continue; }

    // user の AGENTS.md/permissions/environment_context は除外
    if (
      role === 'user' && (
        text.startsWith('# AGENTS.md instructions')
        || text.startsWith('<permissions instructions>')
        || text.startsWith('<environment_context>')
      )
    ) { continue; }

    turns.push({ role: role as 'user' | 'assistant', text });
  }

  // 意味あるユーザーターンがなければスキップ
  const firstUserTurn = turns.find((t) => t.role === 'user');
  if (!firstUserTurn) { return null; }

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

/**
 * `~/.codex/sessions/` 配下の全 JSONL セッションファイルパスを収集する。
 *
 * `walkFiles()` で `~/.codex/sessions/YYYY/MM/DD/*.jsonl` 形式の
 * ディレクトリツリーを再帰走査する。
 * sessions ディレクトリが存在しない場合は空配列を返す（エラーなし）。
 *
 * @param _period 期間フィルタ（現在は未使用。パーサー側でフィルタリングするため）
 * @returns ソート済みの JSONL ファイルパス配列
 */
export async function findCodexSessions(
  _period: PeriodRange,
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

/**
 * 指定ディレクトリを再帰的に走査し、指定拡張子のファイルパスを順次 yield する非同期ジェネレータ。
 *
 * 各ディレクトリ内のエントリを `localeCompare` でソートして出力するため、
 * 結果は辞書順で安定している（OS によるファイルシステムの順序に依存しない）。
 * ディレクトリの読み込みエラー（存在しない・権限エラー等）は黙認し、
 * 該当ディレクトリをスキップして処理を継続する。
 *
 * `findClaudeSessions` および `findCodexSessions` が内部的に使用する。
 *
 * @param dir 走査するディレクトリの絶対パス
 * @param ext 収集対象のファイル拡張子（例: ".jsonl"）
 * @yields 指定拡張子を持つファイルの絶対パス（辞書順）
 */
export async function* walkFiles(dir: string, ext: string): AsyncGenerator<string> {
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

/**
 * CLI 引数配列を解析して `ExportConfig` を生成する。
 *
 * 認識する引数:
 * - `--output <dir>` または `--output=<dir>`: 出力ベースディレクトリを設定
 * - `--base <dir>` または `--base=<dir>`: 入力ベースディレクトリを設定
 * - `KNOWN_AGENTS` に含まれる文字列: エージェント名として認識（"claude", "codex"）
 * - `/^\d{4}-\d{2}$/` または `/^\d{4}$/` にマッチする文字列: 期間として認識
 *
 * 未知のオプション（`--` で始まる認識外の文字列）または
 * 未知の位置引数（エージェント名・期間以外）が指定された場合は
 * `console.error` にエラーメッセージを出力して `Deno.exit(1)` を呼ぶ。
 *
 * `DEFAULT_EXPORT_CONFIG` をベースとしてスプレッドコピーし、
 * 指定された引数で上書きした `ExportConfig` を返す。
 *
 * @param args CLI 引数の配列（通常は `Deno.args` または `main()` の `argv` パラメータ）
 * @returns 解析済みの `ExportConfig`
 */
export function parseArgs(args: string[]): ExportConfig {
  const config: ExportConfig = { ...DEFAULT_EXPORT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' && i + 1 < args.length) {
      config.outputDir = args[++i];
    } else if (arg.startsWith('--output=')) {
      config.outputDir = arg.slice('--output='.length);
    } else if (arg === '--base' && i + 1 < args.length) {
      config.baseDir = args[++i];
    } else if (arg.startsWith('--base=')) {
      config.baseDir = arg.slice('--base='.length);
    } else if (arg.startsWith('-')) {
      console.error(`不明なオプション: ${arg}`);
      Deno.exit(1);
    } else if (KNOWN_AGENTS.includes(arg)) {
      config.agent = arg;
    } else if (/^\d{4}-\d{2}$/.test(arg) || /^\d{4}$/.test(arg)) {
      config.period = arg;
    } else {
      console.error(`不明な引数: ${arg}`);
      Deno.exit(1);
    }
  }

  return config;
}

// ─────────────────────────────────────────────
// メイン
// ─────────────────────────────────────────────

/**
 * export-chatlog スクリプトのエントリポイント。
 *
 * 処理フロー:
 * 1. `parseArgs()` で argv を解析して `ExportConfig` を取得
 * 2. `parsePeriod()` で期間フィルタ `PeriodRange` を生成
 * 3. `agent` に応じて `findClaudeSessions` / `findCodexSessions` で
 *    セッションファイル一覧を収集
 * 4. 各ファイルに対して対応する `parse*Session()` でパースし、
 *    有効なセッションを `writeSession()` で Markdown として書き出す
 * 5. 生成した Markdown ファイルパスを `console.log` に出力し、
 *    進行状況・エラーを `console.error` に出力する
 *
 * `argv` 省略時は `Deno.args` を使用する（`import.meta.main` からの呼び出し用）。
 * テストでは `argv` にモック引数を渡して実行できる。
 *
 * @param argv CLI 引数の配列。省略時は `Deno.args` を使用
 */
export async function main(argv?: string[]): Promise<void> {
  const { agent, period, outputDir } = parseArgs(argv ?? Deno.args);

  let range: PeriodRange;
  try {
    range = parsePeriod(period);
  } catch (e) {
    console.error(`エラー: ${e}`);
    Deno.exit(1);
  }

  console.error(`対象 agent: ${agent}`);
  if (period) { console.error(`対象期間: ${period}`); }

  let sessionFiles: string[];
  let parseSession: (f: string) => Promise<ExportedSession | null>;

  if (agent === 'claude') {
    sessionFiles = await findClaudeSessions(range);
    parseSession = (f) => parseClaudeSession(f, range);
  } else if (agent === 'codex') {
    sessionFiles = await findCodexSessions(range);
    parseSession = (f) => parseCodexSession(f, range);
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

if (import.meta.main) { await main(); }
