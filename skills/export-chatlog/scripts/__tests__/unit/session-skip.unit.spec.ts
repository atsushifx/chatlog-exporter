// src: scripts/__tests__/unit/session-skip.unit.spec.ts
// @(#): セッション単位スキップ判定関数のユニットテスト
//       対象: isSkippableSession
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { isSkippableSession } from '../../libs/skip-rules.ts';

// ─── isSkippableSession ───────────────────────────────────────────────────────

/**
 * `isSkippableSession` のユニットテストスイート。
 *
 * セッションの最初のユーザーテキストの先頭行にある `name:` または `title:` の
 * value に SESSION_SKIP_KEYWORDS のいずれかが含まれる場合に true を返すことを検証する。
 *
 * @see isSkippableSession
 * @see SESSION_SKIP_KEYWORDS
 */
describe('isSkippableSession', () => {
  describe('Given: name: の value にスキップキーワードを含む YAML 行', () => {
    describe('When: isSkippableSession("name: commit-message-generator\\n...") を呼び出す', () => {
      it('T-SS-01: Then: [正常] - true を返す（セッションをスキップ）', () => {
        const text = 'name: commit-message-generator\ndescription: ...';
        assertEquals(isSkippableSession(text), true);
      });
    });
  });

  describe('Given: name: の value に大文字を含むスキップキーワード', () => {
    describe('When: isSkippableSession("name: Commit Message Generator\\n...") を呼び出す', () => {
      it('T-SS-02: Then: [正常] - true を返す（大文字小文字不問）', () => {
        const text = 'name: Commit Message Generator\ndescription: ...';
        assertEquals(isSkippableSession(text), true);
      });
    });
  });

  describe('Given: title: の value にスキップキーワードを含む YAML 行', () => {
    describe('When: isSkippableSession("title: Git Commit Message Generator\\n...") を呼び出す', () => {
      it('T-SS-03: Then: [正常] - true を返す（セッションをスキップ）', () => {
        const text = 'title: Git Commit Message Generator\ndescription: AI agent';
        assertEquals(isSkippableSession(text), true);
      });
    });
  });

  describe('Given: name: の value がスキップキーワードを含まない YAML 行', () => {
    describe('When: isSkippableSession("name: my-agent\\n...") を呼び出す', () => {
      it('T-SS-04: Then: [正常] - false を返す（スキップ対象外）', () => {
        const text = 'name: my-agent\ndescription: ...';
        assertEquals(isSkippableSession(text), false);
      });
    });
  });

  describe('Given: name: キーを含まない通常テキスト', () => {
    describe('When: isSkippableSession("mcpの設定を...") を呼び出す', () => {
      it('T-SS-05: Then: [正常] - false を返す（スキップ対象外）', () => {
        assertEquals(isSkippableSession('mcpの設定をしてください'), false);
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: isSkippableSession("") を呼び出す', () => {
      it('T-SS-06: Then: [エッジケース] - false を返す', () => {
        assertEquals(isSkippableSession(''), false);
      });
    });
  });

  describe('Given: name: の value にスキップキーワードを含む行が 11 行目にある', () => {
    describe('When: isSkippableSession(text) を呼び出す', () => {
      it('T-SS-07: Then: [エッジケース] - false を返す（先頭 10 行対象外）', () => {
        const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
        lines.push('name: commit-message-generator');
        const text = lines.join('\n');
        assertEquals(isSkippableSession(text), false);
      });
    });
  });

  describe('Given: YAML コメント行のあとに name: の value が commit-message のテキスト', () => {
    describe('When: isSkippableSession("# Claude Code 必須要素\\nname: commit-message\\n...") を呼び出す', () => {
      it('T-SS-08: Then: [正常] - true を返す（value が commit-message にマッチ）', () => {
        const text = '# Claude Code 必須要素\nname: commit-message\ndescription: ...';
        assertEquals(isSkippableSession(text), true);
      });
    });
  });

  describe('Given: name:/title: がなく本文に "commit message generator" を含むテキストを渡す', () => {
    describe('When: isSkippableSession(text) を呼び出す', () => {
      it('T-SS-09: Then: [正常] - true を返す（セッションをスキップ）', () => {
        const text =
          '// Copyright (c) 2025 atsushifx\n//\nYou are a Git commit message generator.\n- Analyze the provided logs and diff.';
        assertEquals(isSkippableSession(text), true);
      });
    });
  });
});
