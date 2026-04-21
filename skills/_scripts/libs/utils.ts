// src: skills/_scripts/libs/utils.ts
// @(#): 汎用ユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { EnvProvider } from '../types/providers.types.ts';

/** パス区切り文字をスラッシュに統一する（Windows バックスラッシュ → `/`）。 */
export const normalizePath = (path: string): string => {
  return path.replaceAll('\\', '/');
};

/** ホームディレクトリを表す文字列を返す。 */
export const homeDir = (env: EnvProvider = Deno.env.get): string => {
  const _home = env('HOME');
  if (_home !== undefined) { return normalizePath(_home); }
  const _profile = env('USERPROFILE');
  if (_profile !== undefined) { return normalizePath(_profile); }
  return '~';
};

/** 行末文字を LF（`\n`）に統一する（CRLF `\r\n`、CR `\r` → `\n`）。 */
export const normalizeLine = (content: string): string => {
  return content.replace(/\r\n?/g, '\n');
};

/** ファイルパスからディレクトリ部分を返す（末尾スラッシュなし）。 */
export const getDirectory = (path: string): string => {
  return normalizePath(path).split('/').slice(0, -1).join('/');
};

/** ファイルパスからファイル名部分を返す。 */
export const getFileName = (path: string): string => {
  return normalizePath(path).split('/').pop() ?? '';
};

/** `normalizePath` で正規化後に `/` を含む場合 `true` を返す（ディレクトリパス判定）。 */
export const isDirectoryArg = (arg: string): boolean => {
  return normalizePath(arg).includes('/');
};

/**
 * テキストからファイル名用の URL セーフなスラッグ文字列を生成する。
 * 英小文字・数字・ハイフンのみからなる 3〜50 文字のスラッグ、または `fallback` を返す。
 */
export const textToSlug = (text: string, fallback = 'session'): string => {
  let s = text.trim().split('\n\n')[0].slice(0, 200);
  s = s.split('\n')[0].trim();
  s = s.normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
  s = s.replace(/[^a-zA-Z0-9]+/g, '-').trim().toLowerCase();
  s = s.replace(/-{2,}/g, '-').replace(/^-|-$/g, '').slice(0, 50).replace(/-$/, '');
  return s.length >= 3 ? s : fallback;
};
