// src: scripts/constants/agents.ts
// @(#): サポートエージェントリストの定数定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

/**
 * このツールが対応する AI エージェント名の一覧。
 *
 * `parseArgs()` が CLI の位置引数をエージェント名として認識するために参照する。
 * この配列に含まれない文字列が位置引数として渡された場合、
 * `parseArgs()` はエラーメッセージを出力して `Deno.exit(1)` を呼ぶ。
 *
 * 各エージェントのセッションデータは異なるパスに保存される:
 * - "claude": `~/.claude/projects/<project>/*.jsonl`
 * - "codex":  `~/.codex/sessions/YYYY/MM/DD/*.jsonl`
 *
 * @see parseArgs
 * @see DEFAULT_AGENT
 */
export const KNOWN_AGENTS = ['claude', 'codex'];
