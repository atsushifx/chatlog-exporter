// src: skills/_scripts/libs/file-io/path-utils.ts
// @(#): パスユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { EnvProvider } from '../../types/providers.types.ts';

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

/** ファイルパスからディレクトリ部分を返す（末尾スラッシュなし）。 */
export const getDirectory = (path: string): string => {
  return normalizePath(path).split('/').slice(0, -1).join('/');
};

/** ファイルパスからファイル名部分を返す。 */
export const getFileName = (path: string): string => {
  return normalizePath(path).split('/').pop() ?? '';
};
