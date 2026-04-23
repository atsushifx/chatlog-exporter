// src: skills/_scripts/libs/text-utils.ts
// @(#): テキスト処理ユーティリティ（null/undefined を空文字列にフォールバックする型変換）
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export const toStringWithNull = (v: unknown): string => v == null ? '' : typeof v === 'string' ? v : String(v);

export const toStringArrayWithNull = (v: unknown): string[] => Array.isArray(v) ? v.map(String) : [];
