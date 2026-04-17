// src: scripts/exporter/__tests__/unit/chatgpt-text.unit.spec.ts
// @(#): ChatGPT テキスト抽出関数のユニットテスト
//       対象: extractChatGPTText
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { extractChatGPTText } from '../../chatgpt-exporter.ts';

// ─── extractChatGPTText ───────────────────────────────────────────────────────

/**
 * `extractChatGPTText` のユニットテストスイート。
 *
 * ChatGPT メッセージオブジェクトからテキストを抽出する関数の動作を検証する。
 * null メッセージ・text 型・非 text 型・混在 parts・空配列の各ケースをカバーする。
 *
 * @see extractChatGPTText
 */
describe('extractChatGPTText', () => {
  // ─── T-EC-GT-01-01: null メッセージ → '' ──────────────────────────────────

  describe('Given: null メッセージ', () => {
    it('T-EC-GT-01-01: null → ""', () => {
      assertEquals(extractChatGPTText(null), '');
    });
  });

  // ─── T-EC-GT-01-02: content_type: 'text', parts: ['hello', ' world'] → 'hello world' ─

  describe('Given: content_type="text", parts=["hello", " world"]', () => {
    it('T-EC-GT-01-02: parts を結合して返す', () => {
      const message = {
        id: 'msg-01',
        author: { role: 'user' },
        create_time: 1000,
        content: {
          content_type: 'text',
          parts: ['hello', ' world'],
        },
      };
      assertEquals(extractChatGPTText(message), 'hello world');
    });
  });

  // ─── T-EC-GT-01-03: content_type: 'code' → '' ─────────────────────────────

  describe('Given: content_type="code"', () => {
    it('T-EC-GT-01-03: "" を返す', () => {
      const message = {
        id: 'msg-02',
        author: { role: 'assistant' },
        create_time: 2000,
        content: {
          content_type: 'code',
          parts: ['print("hello")'],
        },
      };
      assertEquals(extractChatGPTText(message), '');
    });
  });

  // ─── T-EC-GT-01-04: parts に文字列以外の要素が混在 → 文字列部分のみ結合 ─

  describe('Given: parts に文字列以外の要素が混在', () => {
    it('T-EC-GT-01-04: 文字列部分のみ結合して返す', () => {
      const message = {
        id: 'msg-03',
        author: { role: 'user' },
        create_time: 3000,
        content: {
          content_type: 'text',
          parts: ['hello', 42, null, 'world'],
        },
      };
      assertEquals(extractChatGPTText(message), 'hello world');
    });
  });

  // ─── T-EC-GT-01-05: parts: [] → '' ────────────────────────────────────────

  describe('Given: parts=[] (空配列)', () => {
    it('T-EC-GT-01-05: "" を返す', () => {
      const message = {
        id: 'msg-04',
        author: { role: 'user' },
        create_time: 4000,
        content: {
          content_type: 'text',
          parts: [],
        },
      };
      assertEquals(extractChatGPTText(message), '');
    });
  });
});
