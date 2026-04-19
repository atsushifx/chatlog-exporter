// src: scripts/exporter/__tests__/unit/strip-user-instructions.unit.spec.ts
// @(#): _stripUserInstructions 関数のユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { stripUserInstructions } from '../../codex-exporter.ts';

// ─── _stripUserInstructions tests ────────────────────────────────────────────

/**
 * `_stripUserInstructions` のユニットテストスイート。
 *
 * テストケース:
 * - T-SUI-01: <user_instructions> のみのテキスト → 空文字列を返す
 * - T-SUI-02: <user_instructions> + 本文テキスト → user_instructions を除いた本文のみ返す
 * - T-SUI-03: <user_instructions> を含まないテキスト → テキストが変更されない
 * - T-SUI-04: 複数の <user_instructions> ブロック → 全ブロックが除去される
 *
 * @see _stripUserInstructions
 */
describe('_stripUserInstructions', () => {
  // ─── T-SUI-01: <user_instructions> のみのテキスト ─────────────────────────────

  describe('Given: <user_instructions>...</user_instructions> のみを含むテキストを渡す', () => {
    describe('When: _stripUserInstructions(text) を呼び出す', () => {
      it('Then: [正常] - 空文字列を返す', () => {
        const text = '<user_instructions>\nPlease provide all answers in Japanese\n</user_instructions>';
        const result = stripUserInstructions(text);
        assertEquals(result, '');
      });
    });
  });

  // ─── T-SUI-02: <user_instructions> + 本文テキスト ────────────────────────────

  describe('Given: <user_instructions> ブロックと本文テキストを含むテキストを渡す', () => {
    describe('When: _stripUserInstructions(text) を呼び出す', () => {
      it('Then: [正常] - user_instructions 部分を除いた本文のみ返す', () => {
        const text =
          '<user_instructions>\nPlease provide all answers in Japanese\n</user_instructions>\n\nコードレビューをお願いします';
        const result = stripUserInstructions(text);
        assertEquals(result, 'コードレビューをお願いします');
      });
    });
  });

  // ─── T-SUI-03: <user_instructions> を含まないテキスト ────────────────────────

  describe('Given: <user_instructions> を含まないテキストを渡す', () => {
    describe('When: _stripUserInstructions(text) を呼び出す', () => {
      it('Then: [正常] - テキストが変更されず元の値を返す', () => {
        const text = 'コードレビューをお願いします';
        const result = stripUserInstructions(text);
        assertEquals(result, text);
      });
    });
  });

  // ─── T-SUI-04: 複数の <user_instructions> ブロック ───────────────────────────

  describe('Given: 複数の <user_instructions> ブロックを含むテキストを渡す', () => {
    describe('When: _stripUserInstructions(text) を呼び出す', () => {
      it('Then: [正常] - 全ブロックが除去されて本文のみ返す', () => {
        const text = [
          '<user_instructions>',
          'Please provide all answers in Japanese',
          '</user_instructions>',
          '',
          'コードレビューをお願いします',
          '',
          '<user_instructions>',
          'Always use TypeScript',
          '</user_instructions>',
        ].join('\n');
        const result = stripUserInstructions(text);
        assertEquals(result, 'コードレビューをお願いします');
      });
    });
  });

  // ─── T-SUI-05: インライン形式（スペース区切り）のみ ──────────────────────────

  describe('Given: インライン形式の <user_instructions> のみを含むテキストを渡す', () => {
    describe('When: _stripUserInstructions(text) を呼び出す', () => {
      it('Then: [正常] - 空文字列を返す', () => {
        const text = '<user_instructions>  Please provide all answers in Japanese  </user_instructions>';
        const result = stripUserInstructions(text);
        assertEquals(result, '');
      });
    });
  });

  // ─── T-SUI-06: インライン形式 + 本文 ─────────────────────────────────────────

  describe('Given: インライン形式の <user_instructions> と本文テキストを含むテキストを渡す', () => {
    describe('When: _stripUserInstructions(text) を呼び出す', () => {
      it('Then: [正常] - user_instructions 部分を除いた本文のみ返す', () => {
        const text =
          '<user_instructions>  Please provide all answers in Japanese  </user_instructions>\n\nコードレビューをお願いします';
        const result = stripUserInstructions(text);
        assertEquals(result, 'コードレビューをお願いします');
      });
    });
  });
});
