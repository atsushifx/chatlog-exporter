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

// -- external --
import { ChatlogError } from '../../_scripts/classes/ChatlogError.class.ts';
import { isKnownAgent } from '../../_scripts/constants/agents.constants.ts';
import { logger } from '../../_scripts/libs/logger.ts';

// -- internal --
import { DEFAULT_EXPORT_CONFIG } from './constants/defaults.constants.ts';
import {
  SESSION_SKIP_KEYWORDS,
  SESSION_SKIP_KEYWORDS_HEAD_LINES,
  SHORT_AFFIRMATION_MAX_LEN,
  SKIP_EXACT,
  SKIP_PREFIXES,
} from './constants/skip-rules.constants.ts';
import { exportChatGPT, findChatGPTFiles, parseChatGPTConversation } from './exporter/chatgpt-exporter.ts';
import { exportClaude, findClaudeSessions, parseClaudeSession } from './exporter/claude-exporter.ts';
import { exportCodex, findCodexSessions, parseCodexSession } from './exporter/codex-exporter.ts';
import type { ExportConfig } from './types/export-config.types.ts';
import type { PeriodRange } from './types/filter.types.ts';
import type { ExportedSession, SessionMeta, Turn } from './types/session.types.ts';

export { findClaudeSessions, parseClaudeSession };
export { findCodexSessions, parseCodexSession };
export { findChatGPTFiles, parseChatGPTConversation };
export type { ExportedSession };
export type { PeriodRange };

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
 * ISO8601 タイムスタンプをローカル時刻の年・月（0始まり）・日に分解する内部ヘルパー。
 *
 * UTC タイムスタンプを `new Date()` でパースした後、ローカル時刻の
 * `getFullYear()` / `getMonth()` / `getDate()` で年月日を取得する。
 * これにより JST+9 環境でも UTC と日付がズレない（例: `2025-12-31T15:00:00Z` → `2026-01-01`）。
 *
 * パース失敗（NaN）の場合は `null` を返す。
 *
 * @param iso ISO8601 形式のタイムスタンプ文字列（例: "2025-12-31T15:00:00Z"）
 * @returns `{ y, m0, d }` ローカル年・月(0始まり)・日。パース失敗時は `null`
 */
function _isoToLocalParts(iso: string): { y: number; m0: number; d: number } | null {
  const _date = new Date(iso);
  if (isNaN(_date.getTime())) { return null; }
  return { y: _date.getFullYear(), m0: _date.getMonth(), d: _date.getDate() };
}

/**
 * ISO8601 タイムスタンプ文字列を YYYY-MM-DD 形式の日付文字列（ローカル時刻基準）に変換する。
 *
 * `SessionMeta.date` の生成および出力パスの年月ディレクトリ名の確定に使用する。
 * JST+9 環境では UTC 文字列からローカル日付を正しく取得するため、
 * `_isoToLocalParts()` を介してローカル年月日を取得する。
 * パース失敗時はエクスポートを中断せず 'unknown' を返してフォールバックする。
 *
 * @param iso ISO8601 形式のタイムスタンプ文字列（例: "2025-12-31T15:00:00Z"）
 * @returns YYYY-MM-DD 形式の日付文字列（ローカル時刻基準）。パース失敗時は 'unknown'
 */
export function isoToDate(iso: string): string {
  const p = _isoToLocalParts(iso);
  if (!p) { return 'unknown'; }
  return `${p.y}-${String(p.m0 + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
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

/**
 * セッションの最初のユーザーテキストの先頭行に SESSION_SKIP_KEYWORDS のいずれかが
 * 含まれるか判定する（大文字小文字不問）。
 *
 * 以下の 2 段階でチェックする:
 * 1. 先頭 SESSION_SKIP_KEYWORDS_HEAD_LINES 行中の `name:`/`title:` の value にキーワードが含まれるか
 * 2. 先頭 SESSION_SKIP_KEYWORDS_HEAD_LINES 行のテキスト本文にキーワードが直接含まれるか
 *
 * マッチした場合、セッション全体をエクスポート対象から除外すべきと判断する。
 * サブエージェント呼び出し（commit-message-generator 等）のような
 * 再利用価値のないセッションを除外するために使用する。
 *
 * @param firstUserText セッションの最初のユーザーメッセージテキスト
 * @returns スキップすべき場合 true
 * @see SESSION_SKIP_KEYWORDS
 */
export function isSkippableSession(firstUserText: string): boolean {
  const headLines = firstUserText.split('\n').slice(0, SESSION_SKIP_KEYWORDS_HEAD_LINES);
  // チェック1: name:/title: の value にキーワードが含まれるか
  const hasYamlKeyword = headLines.some((line) => {
    const match = line.match(/^(?:name|title)\s*:\s*(.+)$/i);
    if (!match) { return false; }
    const value = match[1].toLowerCase();
    return SESSION_SKIP_KEYWORDS.some((keyword) => value.includes(keyword.toLowerCase()));
  });
  if (hasYamlKeyword) { return true; }
  // チェック2: 本文テキストにキーワードが直接含まれるか（大文字小文字不問）
  const headText = headLines.join('\n').toLowerCase();
  return SESSION_SKIP_KEYWORDS.some((keyword) => headText.includes(keyword.toLowerCase()));
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
  throw new ChatlogError('InvalidPeriod', `期間の形式が不正です（例: 2026-03 または 2026）: ${period}`);
}

/**
 * ISO8601 タイムスタンプが指定した期間範囲内にあるかを判定する。
 *
 * `PeriodRange` は半開区間 [startMs, endMs) であり、startMs の値を含み
 * endMs の値を含まない。
 * タイムスタンプを `_isoToLocalParts()` でローカル年月日に変換した後、
 * ローカル日付の 00:00:00 ミリ秒値として `PeriodRange` と比較する。
 * これにより UTC タイムスタンプでも JST 環境のローカル日付基準でフィルタリングできる。
 * パース失敗時は `false` を返す。
 *
 * `parseClaudeSession` および `parseCodexSession` が各エントリの
 * タイムスタンプ照合に使用する。
 *
 * @param isoTimestamp 判定対象の ISO8601 タイムスタンプ文字列
 * @param range `parsePeriod()` が生成した半開区間フィルタ
 * @returns タイムスタンプが範囲内（startMs ≤ localDayMs < endMs）の場合 `true`
 */
export function inPeriod(isoTimestamp: string, range: PeriodRange): boolean {
  const p = _isoToLocalParts(isoTimestamp);
  if (!p) { return false; }
  const localDayMs = new Date(p.y, p.m0, p.d).getTime();
  return localDayMs >= range.startMs && localDayMs < range.endMs;
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
  const _lines: string[] = [];
  _lines.push('---');
  _lines.push(`session_id: ${meta.sessionId}`);
  _lines.push(`date: ${meta.date}`);
  _lines.push(`project: ${meta.project}`);
  if (meta.slug) { _lines.push(`slug: ${meta.slug}`); }
  _lines.push('---');
  _lines.push('');
  _lines.push(`# ${meta.firstUserText.replace(/\n/g, ' ').slice(0, 100)}`);
  _lines.push('');
  _lines.push('## 会話ログ');
  _lines.push('');
  for (const turn of turns) {
    const label = turn.role === 'user' ? 'User' : 'Assistant';
    _lines.push(`### ${label}`);
    _lines.push('');
    _lines.push(turn.text.trim().replace(/\n{3,}/g, '\n\n'));
    _lines.push('');
  }
  return _lines.join('\n');
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
 * - `--base <dir>` または `--base=<dir>`: 入力ベースディレクトリ（baseDir）を設定
 * - `--input <dir>` または `--input=<dir>`: ChatGPT エクスポートディレクトリ（inputDir）を設定
 * - `KNOWN_AGENTS` に含まれる文字列: エージェント名として認識（"claude", "codex", "chatgpt"）
 * - `/^\d{4}-\d{2}$/` または `/^\d{4}$/` にマッチする文字列: 期間として認識
 * - `/` を含む位置引数（`\` → `/` 正規化後): ChatGPT エクスポートディレクトリ（inputDir）として認識
 *
 * 未知のオプション（`--` で始まる認識外の文字列）または
 * 未知の位置引数（エージェント名・期間・パス以外）が指定された場合は
 * `console.error` にエラーメッセージを出力して `Deno.exit(1)` を呼ぶ。
 *
 * `DEFAULT_EXPORT_CONFIG` をベースとしてスプレッドコピーし、
 * 指定された引数で上書きした `ExportConfig` を返す。
 *
 * @param args CLI 引数の配列（通常は `Deno.args` または `main()` の `argv` パラメータ）
 * @returns 解析済みの `ExportConfig`
 */
export function parseArgs(args: string[]): ExportConfig {
  const _config: ExportConfig = { ...DEFAULT_EXPORT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' && i + 1 < args.length) {
      _config.outputDir = args[++i];
    } else if (arg.startsWith('--output=')) {
      _config.outputDir = arg.slice('--output='.length);
    } else if (arg === '--base' && i + 1 < args.length) {
      _config.baseDir = args[++i];
    } else if (arg.startsWith('--base=')) {
      _config.baseDir = arg.slice('--base='.length);
    } else if (arg === '--input' && i + 1 < args.length) {
      _config.inputDir = args[++i];
    } else if (arg.startsWith('--input=')) {
      _config.inputDir = arg.slice('--input='.length);
    } else if (arg.startsWith('-')) {
      throw new ChatlogError('InvalidArgs', `不明なオプション: ${arg}`);
    } else if (isKnownAgent(arg)) {
      _config.agent = arg;
    } else if (/^\d{4}-\d{2}$/.test(arg) || /^\d{4}$/.test(arg)) {
      _config.period = arg;
    } else {
      const normalized = arg.replace(/\\/g, '/');
      if (normalized.includes('/')) {
        _config.inputDir = normalized;
      } else {
        throw new ChatlogError('InvalidArgs', `不明な引数: ${arg}`);
      }
    }
  }

  return _config;
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
  try {
    const config = parseArgs(argv ?? Deno.args);
    const { agent, period, outputDir } = config;

    logger.info(`対象 agent: ${agent}`);
    if (period) { logger.info(`対象期間: ${period}`); }

    let result: Awaited<ReturnType<typeof exportClaude>>;

    if (agent === 'claude') {
      result = await exportClaude(config);
    } else if (agent === 'codex') {
      result = await exportCodex(config);
    } else if (agent === 'chatgpt') {
      if (!config.inputDir && !config.baseDir) {
        throw new ChatlogError(
          'InvalidArgs',
          'chatgpt エージェントには入力ディレクトリを指定してください（位置引数または --input）',
        );
      }
      result = await exportChatGPT(config);
    } else {
      throw new ChatlogError('InvalidArgs', `未対応のエージェント: ${agent}`);
    }

    for (const outPath of result.outputPaths) {
      logger.log(outPath);
    }

    const total = result.exportedCount + result.skippedCount + result.errorCount;
    logger.info(
      `\n完了: ${total} 件処理（出力: ${result.exportedCount} / スキップ: ${result.skippedCount} / エラー: ${result.errorCount}）`,
    );
    logger.info(`出力先: ${outputDir}/${agent}/`);
  } catch (e) {
    if (e instanceof ChatlogError) {
      logger.error(e.message);
      Deno.exit(1);
    }
    throw e;
  }
}

if (import.meta.main) { await main(); }
