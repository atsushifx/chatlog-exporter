// src: scripts/exporter/__tests__/unit/traverse-conversation.unit.spec.ts
// @(#): ChatGPT 会話トラバース関数のユニットテスト
//       対象: traverseConversation
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { traverseConversation } from '../../chatgpt-exporter.ts';
import type { ChatGPTMappingNode } from '../../types/chatgpt-entry.types.ts';

// ─── traverseConversation ─────────────────────────────────────────────────────
// traverseConversation の責務:
//   mapping を currentNodeId から leaf→root で辿り、root→leaf 順に並べ直したうえで、
//   以下をすべて除外した ChatGPTMessage[] を返す:
//     - message === null
//     - message.weight === 0（0.0 含む）
//     - author.role === 'system' または 'tool'
//   フィルタはこの関数内に閉じており、parseChatGPTConversation への副作用はない。

/**
 * `traverseConversation` のユニットテストスイート。
 *
 * ChatGPT mapping を currentNodeId から root まで遡り、root→leaf 順のメッセージ列を返す関数を検証する。
 * 線形チェーン・weight=0 除外・system/tool role 除外・null メッセージ除外・存在しないノード ID の各ケースをカバーする。
 *
 * @see traverseConversation
 */
describe('traverseConversation', () => {
  // ─── T-EC-GT-02-01: 3ノード線形チェーン（system 除外）→ 2メッセージ ──────

  describe('Given: 3ノードの線形チェーン（system + user + assistant）', () => {
    it('T-EC-GT-02-01: system を除外した root→leaf 順の2メッセージを返す', () => {
      const mapping: Record<string, ChatGPTMappingNode> = {
        'node-1': {
          id: 'node-1',
          message: {
            id: 'msg-1',
            author: { role: 'system' },
            create_time: 1000,
            content: { content_type: 'text', parts: ['system message'] },
          },
          parent: null,
          children: ['node-2'],
        },
        'node-2': {
          id: 'node-2',
          message: {
            id: 'msg-2',
            author: { role: 'user' },
            create_time: 2000,
            content: { content_type: 'text', parts: ['hello'] },
          },
          parent: 'node-1',
          children: ['node-3'],
        },
        'node-3': {
          id: 'node-3',
          message: {
            id: 'msg-3',
            author: { role: 'assistant' },
            create_time: 3000,
            content: { content_type: 'text', parts: ['world'] },
          },
          parent: 'node-2',
          children: [],
        },
      };
      // system は除外されるため結果は 2 件（user + assistant）
      const result = traverseConversation(mapping, 'node-3');
      assertEquals(result.length, 2);
      assertEquals(result[0].author.role, 'user');
      assertEquals(result[1].author.role, 'assistant');
    });
  });

  // ─── T-EC-GT-02-02: weight: 0.0 ノード含む → そのノードを除外 ─────────

  describe('Given: weight=0.0 のノードを含む', () => {
    it('T-EC-GT-02-02: weight=0.0 ノードを除外する', () => {
      const mapping: Record<string, ChatGPTMappingNode> = {
        'root': {
          id: 'root',
          message: {
            id: 'msg-root',
            author: { role: 'user' },
            create_time: 1000,
            content: { content_type: 'text', parts: ['first'] },
            weight: 1.0,
          },
          parent: null,
          children: ['mid'],
        },
        'mid': {
          id: 'mid',
          message: {
            id: 'msg-mid',
            author: { role: 'assistant' },
            create_time: 2000,
            content: { content_type: 'text', parts: ['zero weight'] },
            weight: 0.0,
          },
          parent: 'root',
          children: ['leaf'],
        },
        'leaf': {
          id: 'leaf',
          message: {
            id: 'msg-leaf',
            author: { role: 'user' },
            create_time: 3000,
            content: { content_type: 'text', parts: ['second'] },
            weight: 1.0,
          },
          parent: 'mid',
          children: [],
        },
      };
      const result = traverseConversation(mapping, 'leaf');
      assertEquals(result.length, 2);
      assertEquals(result[0].id, 'msg-root');
      assertEquals(result[1].id, 'msg-leaf');
    });
  });

  // ─── T-EC-GT-02-03: role: 'system' ノード含む → 除外 ─────────────────

  describe('Given: role="system" のノードを含む', () => {
    it('T-EC-GT-02-03: system ノードを除外する', () => {
      const mapping: Record<string, ChatGPTMappingNode> = {
        'sys': {
          id: 'sys',
          message: {
            id: 'msg-sys',
            author: { role: 'system' },
            create_time: 1000,
            content: { content_type: 'text', parts: ['sys msg'] },
          },
          parent: null,
          children: ['user-node'],
        },
        'user-node': {
          id: 'user-node',
          message: {
            id: 'msg-user',
            author: { role: 'user' },
            create_time: 2000,
            content: { content_type: 'text', parts: ['hello'] },
          },
          parent: 'sys',
          children: [],
        },
      };
      const result = traverseConversation(mapping, 'user-node');
      assertEquals(result.length, 1);
      assertEquals(result[0].author.role, 'user');
    });
  });

  // ─── T-EC-GT-02-04: role: 'tool' ノード含む → 除外 ───────────────────

  describe('Given: role="tool" のノードを含む', () => {
    it('T-EC-GT-02-04: tool ノードを除外する', () => {
      const mapping: Record<string, ChatGPTMappingNode> = {
        'user-1': {
          id: 'user-1',
          message: {
            id: 'msg-user-1',
            author: { role: 'user' },
            create_time: 1000,
            content: { content_type: 'text', parts: ['question'] },
          },
          parent: null,
          children: ['tool-node'],
        },
        'tool-node': {
          id: 'tool-node',
          message: {
            id: 'msg-tool',
            author: { role: 'tool' },
            create_time: 2000,
            content: { content_type: 'text', parts: ['tool result'] },
          },
          parent: 'user-1',
          children: ['assist'],
        },
        'assist': {
          id: 'assist',
          message: {
            id: 'msg-assist',
            author: { role: 'assistant' },
            create_time: 3000,
            content: { content_type: 'text', parts: ['answer'] },
          },
          parent: 'tool-node',
          children: [],
        },
      };
      const result = traverseConversation(mapping, 'assist');
      assertEquals(result.length, 2);
      assertEquals(result[0].author.role, 'user');
      assertEquals(result[1].author.role, 'assistant');
    });
  });

  // ─── T-EC-GT-02-05: message: null ノード含む → 除外 ──────────────────

  describe('Given: message=null のノードを含む', () => {
    it('T-EC-GT-02-05: message=null ノードを除外する', () => {
      const mapping: Record<string, ChatGPTMappingNode> = {
        'null-node': {
          id: 'null-node',
          message: null,
          parent: null,
          children: ['real-node'],
        },
        'real-node': {
          id: 'real-node',
          message: {
            id: 'msg-real',
            author: { role: 'user' },
            create_time: 1000,
            content: { content_type: 'text', parts: ['hello'] },
          },
          parent: 'null-node',
          children: [],
        },
      };
      const result = traverseConversation(mapping, 'real-node');
      assertEquals(result.length, 1);
      assertEquals(result[0].id, 'msg-real');
    });
  });

  // ─── T-EC-GT-02-06: 存在しない currentNodeId → [] ────────────────────

  describe('Given: 存在しない currentNodeId', () => {
    it('T-EC-GT-02-06: 空配列を返す', () => {
      const mapping: Record<string, ChatGPTMappingNode> = {
        'node-1': {
          id: 'node-1',
          message: {
            id: 'msg-1',
            author: { role: 'user' },
            create_time: 1000,
            content: { content_type: 'text', parts: ['hello'] },
          },
          parent: null,
          children: [],
        },
      };
      const result = traverseConversation(mapping, 'non-existent-id');
      assertEquals(result.length, 0);
    });
  });

  // ─── T-EC-GT-02-07: weight=undefined のノード → 除外しない ──────────

  describe('Given: weight フィールドが未設定（undefined）のノードを含む', () => {
    it('T-EC-GT-02-07: weight=undefined のノードを結果に含める', () => {
      const mapping: Record<string, ChatGPTMappingNode> = {
        'node-1': {
          id: 'node-1',
          message: {
            id: 'msg-1',
            author: { role: 'user' },
            create_time: 1000,
            content: { content_type: 'text', parts: ['hello'] },
            // weight を意図的に省略（undefined）
            // → msg.weight === 0 は false → 除外されない
          },
          parent: null,
          children: [],
        },
      };
      const result = traverseConversation(mapping, 'node-1');
      assertEquals(result.length, 1);
      assertEquals(result[0].id, 'msg-1');
    });
  });
});
