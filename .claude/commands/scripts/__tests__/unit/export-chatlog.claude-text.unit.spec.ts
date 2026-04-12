// src: scripts/__tests__/unit/export-chatlog.claude-text.unit.spec.ts
// @(#): Claude テキスト抽出関数のユニットテスト
//       対象: extractClaudeUserText, extractClaudeAssistantText
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import {
  extractClaudeAssistantText,
  extractClaudeUserText,
} from '../../../../export-chatlog/scripts/export-chatlog.ts';

// ─── extractClaudeUserText ────────────────────────────────────────────────────

describe('extractClaudeUserText', () => {
  describe('Given: 文字列 content "こんにちは"', () => {
    it('T-EC-CT-01-01: "こんにちは" を返す', () => {
      assertEquals(extractClaudeUserText('こんにちは'), 'こんにちは');
    });
  });

  describe('Given: <local-command-stdout で始まる文字列', () => {
    it('T-EC-CT-01-02: "" を返す', () => {
      assertEquals(extractClaudeUserText('<local-command-stdout some content'), '');
    });
  });

  describe('Given: type="text" のアイテム配列', () => {
    it('T-EC-CT-01-03: テキストを結合して返す', () => {
      const content = [
        { type: 'text', text: 'hello' },
        { type: 'text', text: 'world' },
      ];
      assertEquals(extractClaudeUserText(content), 'hello world');
    });
  });

  describe('Given: type="tool_result" のみの配列', () => {
    it('T-EC-CT-01-04: "" を返す', () => {
      const content = [
        { type: 'tool_result', content: 'some result' },
      ];
      assertEquals(extractClaudeUserText(content), '');
    });
  });

  describe('Given: <system-reminder で始まる text アイテム', () => {
    it('T-EC-CT-01-05: そのアイテムをスキップして "" を返す', () => {
      const content = [
        { type: 'text', text: '<system-reminder some content' },
      ];
      assertEquals(extractClaudeUserText(content), '');
    });
  });

  describe('Given: <ide_opened_file で始まる text アイテム', () => {
    it('T-EC-CT-01-06: そのアイテムをスキップして "" を返す', () => {
      const content = [
        { type: 'text', text: '<ide_opened_file path="test.ts">' },
      ];
      assertEquals(extractClaudeUserText(content), '');
    });
  });

  describe('Given: null / undefined', () => {
    it('T-EC-CT-01-07: null の場合 "" を返す', () => {
      assertEquals(extractClaudeUserText(null), '');
    });

    it('T-EC-CT-01-08: undefined の場合 "" を返す', () => {
      assertEquals(extractClaudeUserText(undefined), '');
    });
  });
});

// ─── extractClaudeAssistantText ───────────────────────────────────────────────

describe('extractClaudeAssistantText', () => {
  describe('Given: 文字列 content "回答です"', () => {
    it('T-EC-CT-02-01: "回答です" を返す', () => {
      assertEquals(extractClaudeAssistantText('回答です'), '回答です');
    });
  });

  describe('Given: type="text" のアイテム配列', () => {
    it('T-EC-CT-02-02: テキストを改行結合して返す', () => {
      const content = [
        { type: 'text', text: '第1段落' },
        { type: 'text', text: '第2段落' },
      ];
      const result = extractClaudeAssistantText(content);
      assertEquals(result, '第1段落\n第2段落');
    });
  });

  describe('Given: type="tool_use" のみの配列', () => {
    it('T-EC-CT-02-03: "" を返す', () => {
      const content = [
        { type: 'tool_use', id: 'tu-001', name: 'bash', input: {} },
      ];
      assertEquals(extractClaudeAssistantText(content), '');
    });
  });

  describe('Given: null / undefined', () => {
    it('T-EC-CT-02-04: null の場合 "" を返す', () => {
      assertEquals(extractClaudeAssistantText(null), '');
    });

    it('T-EC-CT-02-05: undefined の場合 "" を返す', () => {
      assertEquals(extractClaudeAssistantText(undefined), '');
    });
  });
});
