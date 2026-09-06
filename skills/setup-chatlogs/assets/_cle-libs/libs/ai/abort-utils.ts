// src: skills/_cle-libs/libs/ai/abort-utils.ts
// @(#): AI 一括処理の中断判定ユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─── Shared libraries
// functions
import { ChatlogError } from '../../classes/ChatlogError.class.ts';

/**
 * llama 経路で一括処理を中断すべき subindex と、ユーザーに提示する中断理由のラベル。
 *
 * DR-18 決定 2 の中断側 subindex 一覧をこのファイルが単独所有する（DR-16 決定 1）。
 * 判定と表示で一覧が二重化しないよう、`_ABORT_SUBINDEXES` はこの表から導出する。
 */
const _ABORT_REASON_LABELS: Readonly<Record<string, string>> = {
  RateLimit: 'レートリミット',
  InvalidEndpoint: 'エンドポイント設定の不備',
  BackendUnavailable: 'AI バックエンドへの接続失敗',
  ResponseFormatRejected: 'レスポンス形式の拒否',
};

/** llama 経路で一括処理を中断すべき subindex。 */
const _ABORT_SUBINDEXES: readonly string[] = Object.keys(_ABORT_REASON_LABELS);

/**
 * 与えられた値が llama 経路で一括処理を中断すべき `ChatlogError` かどうかを判定する。
 *
 * @param e - 判定対象の値（catch 節で受け取る `unknown` を想定）
 * @returns `kind==='AiError'` かつ `subindex` が `_ABORT_SUBINDEXES` に含まれる `ChatlogError` なら `true`、それ以外は `false`
 */
export const isAbortingAiError = (e: unknown): boolean =>
  e instanceof ChatlogError && e.kind === 'AiError' && _ABORT_SUBINDEXES.includes(e.subindex);

/**
 * 中断側 `ChatlogError` から、ユーザーに提示する中断理由のラベルを返す。
 *
 * 中断理由は `ChatlogError.subindex` が保持しているため、呼び出し元は捕捉した例外を
 * そのまま渡せばよい。中断側でない値には `undefined` を返すので、呼び出し元は
 * バックエンド中立な既定文言へフォールバックできる。
 *
 * `instanceof` の再判定は `isAbortingAiError` と重複するが、`e.subindex` を参照するための
 * 型ナローイングに必要なため残している。
 *
 * @param e - 判定対象の値（catch 節や `runChunked` の戻り値で受け取る `unknown` を想定）
 * @returns 中断側の `ChatlogError` なら理由ラベル、それ以外は `undefined`
 */
export const describeAbortReason = (e: unknown): string | undefined =>
  e instanceof ChatlogError && isAbortingAiError(e) ? _ABORT_REASON_LABELS[e.subindex] : undefined;
