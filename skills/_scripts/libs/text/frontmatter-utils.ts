// src: skills/_scripts/libs/text/frontmatter-utils.ts
// @(#): Frontmatter パースユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { parse as parseYaml } from '@std/yaml';

export type FrontmatterResult = {
  meta: Record<string, unknown>;
  body: string;
  frontmatterEnd: number;
};

type BlockResult = {
  yamlText: string;
  frontmatterEnd: number;
};

/** 正規化済みテキストから frontmatter ブロックを抽出する。見つからない場合は null を返す。 */
const _extractBlock = (normalized: string): BlockResult | null => {
  const _lines = normalized.split('\n');
  if (_lines[0] !== '---') { return null; }

  const _closeIdx = _lines.indexOf('---', 1);
  // 閉じ --- の後に必ず改行が必要（末尾が --- で終わる場合は不正）
  if (_closeIdx === -1 || _closeIdx === _lines.length - 1) { return null; }

  const _yamlLines = _lines.slice(1, _closeIdx);
  return {
    yamlText: _yamlLines.join('\n'),
    frontmatterEnd: ['---', ..._yamlLines, '---', ''].join('\n').length,
  };
};

/** Markdown テキストから frontmatter を抽出してパースする。 */
export const extractFrontmatter = (text: string): FrontmatterResult => {
  const _normalized = text.replace(/\r\n/g, '\n');
  const _failure: FrontmatterResult = { meta: {}, body: text, frontmatterEnd: 0 };

  const _block = _extractBlock(_normalized);
  if (_block === null) { return _failure; }

  let _parsed: unknown;
  try {
    _parsed = parseYaml(_block.yamlText);
  } catch {
    return _failure;
  }

  const _meta = (_parsed !== null && _parsed !== undefined && typeof _parsed === 'object' && !Array.isArray(_parsed))
    ? (_parsed as Record<string, unknown>)
    : {};

  return {
    meta: _meta,
    body: _normalized.slice(_block.frontmatterEnd),
    frontmatterEnd: _block.frontmatterEnd,
  };
};
