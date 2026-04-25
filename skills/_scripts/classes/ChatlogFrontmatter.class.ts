// src: skills/_scripts/classes/ChatlogFrontmatter.class.ts
// @(#): Chatlog フロントマタークラス
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { parse as parseYaml } from '@std/yaml';
import { escapeString, toStringWithNull } from '../libs/text/string-utils.ts';

const _DEFAULT_FIELD_ORDER: string[] = [
  'title',
  'date',
  'session_id',
  'project',
  'slug',
  'type',
  'category',
  'summary',
  'topics',
  'tags',
];

export class ChatlogFrontmatter {
  private _entries: Record<string, string | string[]>;

  constructor(text: string) {
    this._entries = this._parseFrontmatter(text);
  }

  private _toStringOrArray(v: unknown): string | string[] {
    if (Array.isArray(v)) {
      return v.map((item) => item instanceof Date ? item.toISOString().slice(0, 10) : toStringWithNull(item));
    }
    if (v instanceof Date) { return v.toISOString().slice(0, 10); }
    return toStringWithNull(v);
  }

  private _parseFrontmatter(text: string): Record<string, string | string[]> {
    const _normalized = text.replace(/\r\n/g, '\n');
    const _lines = _normalized.split('\n');
    if (_lines[0] !== '---') { return {}; }

    const _closeIdx = _lines.indexOf('---', 1);
    if (_closeIdx === -1 || _closeIdx === _lines.length - 1) { return {}; }

    const _yamlText = _lines.slice(1, _closeIdx).join('\n');
    let _parsed: unknown;
    try {
      _parsed = parseYaml(_yamlText);
    } catch {
      return {};
    }

    if (_parsed === null || _parsed === undefined || typeof _parsed !== 'object' || Array.isArray(_parsed)) {
      return {};
    }

    const _result: Record<string, string | string[]> = {};
    for (const key of Object.keys(_parsed as Record<string, unknown>)) {
      _result[key] = this._toStringOrArray((_parsed as Record<string, unknown>)[key]);
    }
    return _result;
  }

  get(key: string): string | string[] | undefined {
    return this._entries[key];
  }

  set(key: string, value: string | string[]): void {
    this._entries[key] = value;
  }

  remove(key: string): void {
    delete this._entries[key];
  }

  toFrontmatter(fieldOrder: string[] = _DEFAULT_FIELD_ORDER): string {
    const _lines: string[] = ['---'];
    const _seen = new Set<string>();
    for (const field of fieldOrder) {
      if (_seen.has(field)) { continue; }
      _seen.add(field);
      const value = this._entries[field];
      if (value === undefined) { continue; }
      if (typeof value === 'string') {
        if (value === '') { continue; }
        _lines.push(`${field}: "${escapeString(value)}"`);
      } else {
        if (value.length === 0) { continue; }
        _lines.push(`${field}:`);
        for (const item of value) {
          _lines.push(`  - "${escapeString(item)}"`);
        }
      }
    }
    if (_lines.length === 1) {
      _lines.push('');
    }
    _lines.push('---');
    return _lines.join('\n') + '\n';
  }
}
