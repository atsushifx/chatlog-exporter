// src: scripts/constants/classify.constants.ts
// @(#): classify-chatlog スクリプト固有の定数
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─────────────────────────────────────────────
// 処理制御定数
// ─────────────────────────────────────────────

/** 1バッチあたりの最大ファイル数。Claude CLI への一括リクエストサイズを制限する。 */
export const CHUNK_SIZE = 10;

/** 同時実行するチャンク処理の最大並列数。 */
export const CONCURRENCY = 4;

/** プロジェクトが特定できなかった場合に割り当てるフォールバックプロジェクト名。 */
export const FALLBACK_PROJECT = 'misc';

/** フロントマターなし時に分類を試みる最低本文長（文字数）。これ未満は misc に直接分類する。 */
export const MIN_CLASSIFIABLE_LENGTH = 50;

// ─────────────────────────────────────────────
// エージェント定義
// ─────────────────────────────────────────────

/** サポートする AI エージェント識別子の一覧。CLI 引数のバリデーションに使用する。 */
export const KNOWN_AGENTS = ['claude', 'chatgpt', 'codex'];
