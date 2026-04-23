// src: skills/_scripts/libs/text/markdown-utils.ts
// @(#): Markdown パースユーティリティ
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

/** コードフェンス（\`\`\`）を除去し、指定フィールドから始まる YAML 文字列を返す。 */
export const cleanYaml = (raw: string, firstField: string): string => {
  if (raw === '') { return ''; }
  const _lines = raw.split('\n').filter((l) => !l.startsWith('```'));
  const firstIndex = _lines.findIndex((l) => l.startsWith(`${firstField}:`));
  return (firstIndex >= 0 ? _lines.slice(firstIndex) : _lines).join('\n').trim();
};

/** Markdown 本文から User/Assistant の会話ターンを抽出する。 */
export const parseConversation = (body: string): Turn[] => {
  const _turns: Turn[] = [];
  const pattern = /^### (User|Assistant)\s*$/gm;
  const matches = [...body.matchAll(pattern)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const role = m[1].toLowerCase() as 'user' | 'assistant';
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const text = body.slice(start, end).trim();
    if (text) { _turns.push({ role, text }); }
  }
  return _turns;
};
