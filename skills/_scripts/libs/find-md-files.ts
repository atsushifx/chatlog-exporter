// src: skills/_scripts/libs/find-md-files.ts
// @(#): マークダウンファイル一覧取得共通ユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { expandGlob } from '@std/fs';

import type { GlobProvider } from '../types/providers.types.ts';
import { normalizePath } from './utils.ts';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

/** {@link findMdFiles} のオプション引数。 */
export interface FindMdFilesOptions {
  /** glob パターンでパス一覧を返す関数。未指定時は `expandGlob` を使用。 */
  glob?: GlobProvider;
}

// ─────────────────────────────────────────────
// 実装
// ─────────────────────────────────────────────

const _defaultGlob: GlobProvider = async (pattern: string): Promise<string[]> => {
  const _results: string[] = [];
  for await (const entry of expandGlob(pattern)) {
    _results.push(normalizePath(entry.path));
  }
  return _results;
};

/** `dir` 直下の `.md` ファイルパス一覧を返す。 */
const _findMdFlats = async (dir: string, glob: GlobProvider): Promise<string[]> => {
  return await glob(`${dir}/*.md`);
};

/** `dir` 直下のサブディレクトリパス一覧を返す。 */
const _findDirFlat = async (dir: string, glob: GlobProvider): Promise<string[]> => {
  return await glob(`${dir}/*/`);
};

/**
 * ディレクトリ `dir` 配下の .md ファイルパスを再帰的に収集し、辞書順ソートして返す。
 * 存在しないディレクトリを渡した場合は空配列を返す（例外なし）。
 *
 * @param dir - 走査対象のディレクトリパス
 * @param options - オプション（`glob` でテスト用モックを注入可能）
 * @returns 辞書順ソート済みの .md ファイルパス配列
 */
export const findMdFiles = async (
  dir: string,
  options?: FindMdFilesOptions,
): Promise<string[]> => {
  const _glob = options?.glob ?? _defaultGlob;
  const _all: string[] = [];
  const _queue = [dir];
  while (_queue.length > 0) {
    const current = _queue.shift()!;
    const [files, dirs] = await Promise.all([_findMdFlats(current, _glob), _findDirFlat(current, _glob)]);
    _all.push(...files);
    _queue.push(...dirs);
  }
  return _all.sort();
};
