// src: skills/_scripts/libs/utils.ts
// @(#): 汎用ユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { EnvProvider } from '../types/providers.types.ts';

/** パス区切り文字をスラッシュに統一する（Windows バックスラッシュ → `/`）。 */
export function normalizePath(path: string): string {
  return path.replaceAll('\\', '/');
}

/** ホームディレクトリを表す文字列を返す。 */
export function homeDir(env: EnvProvider = Deno.env.get): string {
  const _home = env('HOME');
  if (_home !== undefined) { return normalizePath(_home); }
  const _profile = env('USERPROFILE');
  if (_profile !== undefined) { return normalizePath(_profile); }
  return '~';
}
