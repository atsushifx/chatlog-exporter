// src: skills/_scripts/libs/text/string-utils.ts
// @(#): 基本文字列ユーティリティ（型変換・エスケープ・クォート）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export const toStringWithNull = (v: unknown): string => v == null ? '' : typeof v === 'string' ? v : String(v);

export const toStringArrayWithNull = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];

/** `"` で囲む前処理として `\` → `\\`、`"` → `\"` にエスケープする。 */
export const escapeString = (s: string): string => s.replace(/[\\"]/g, (c) => '\\' + c);

/** 文字列を指定のクォート文字（`"`, `'`, `` ` ``）で囲む。quote を省略すると `'` を使用する。`"` の場合は内部の `\` と `"` をエスケープする。 */
export const quoteString = (s: string, quote: string = "'"): string => {
  if (quote !== '"' && quote !== "'" && quote !== '`') {
    throw new Error(`Invalid quote character: ${quote}`);
  }
  const _inner = quote === '"' ? escapeString(s) : s;
  return `${quote}${_inner}${quote}`;
};
