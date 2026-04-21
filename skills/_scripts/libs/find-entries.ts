// src: skills/_scripts/libs/find-entries.ts
// @(#): ディレクトリ一覧・ファイルエントリ収集ユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- external --
import { expandGlob } from '@std/fs';

// -- internal --
import type { GlobProvider } from '../types/providers.types.ts';
import { normalizePath } from './utils.ts';

// ─────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────

const _defaultGlob: GlobProvider = async (pattern: string): Promise<string[]> => {
  const _results: string[] = [];
  for await (const entry of expandGlob(pattern)) {
    _results.push(normalizePath(entry.path));
  }
  return _results;
};

// ─────────────────────────────────────────────
// Public interfaces
// ─────────────────────────────────────────────

/** findEntries のオプション */
export interface FindEntriesOptions {
  include?: string[];
  exclude?: string[];
  glob?: GlobProvider;
}

// ─────────────────────────────────────────────
// Public functions
// ─────────────────────────────────────────────

/**
 * 指定ディレクトリ直下のサブディレクトリパス一覧をソートして返す。
 * ディレクトリ不存在・権限エラー時は空配列を返す（例外なし）。
 */
export async function findDirectories(dir: string): Promise<string[]> {
  const _results: string[] = [];
  try {
    for await (const e of Deno.readDir(dir)) {
      if (e.isDirectory) {
        _results.push(`${dir}/${e.name}`);
      }
    }
  } catch {
    return [];
  }
  return _results.sort();
}

/**
 * ディレクトリパスの配列を対象に、指定拡張子のファイルを glob で一括収集する。
 * exclude に文字列を指定すると、パスにその文字列を含むエントリを除外する。
 * ソートして返す。dirs が空配列なら空配列を返す。
 */
export async function findEntries(
  dirs: string[],
  ext: string,
  options?: FindEntriesOptions,
): Promise<string[]> {
  if (dirs.length === 0) { return []; }

  const _glob = options?.glob ?? _defaultGlob;
  const _include = options?.include ?? [];
  const _exclude = options?.exclude ?? [];
  const _results: string[] = [];

  for (const dir of dirs) {
    const _entries = await _glob(`${dir}/**/*${ext}`);
    for (const entry of _entries) {
      if (
        _include.every((inc) => entry.includes(inc))
        && _exclude.every((ex) => !entry.includes(ex))
      ) {
        _results.push(entry);
      }
    }
  }

  return _results.sort();
}
