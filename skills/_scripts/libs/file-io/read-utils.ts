// src: skills/_scripts/libs/file-io/read-utils.ts
// @(#): ファイル読み込みユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { normalizeLine } from '../text/line-utils.ts';

/** ファイルを読み込み、行末文字を LF に正規化して返す。 */
export const readTextFile = async (path: string): Promise<string> => {
  return normalizeLine(await Deno.readTextFile(path));
};
