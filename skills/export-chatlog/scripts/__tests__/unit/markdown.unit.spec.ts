// src: scripts/__tests__/unit/markdown.unit.spec.ts
// @(#): Markdown レンダリング関数のユニットテスト
//       対象: renderMarkdown
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// cspell:words sess

// -- import --

// BDD modules
import { assertEquals, assertStringIncludes } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { renderMarkdown } from '../../../../export-chatlog/scripts/libs/session-writer.ts';
import type { SessionMeta, Turn } from '../../../../export-chatlog/scripts/types/session.types.ts';

function _makeMeta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    sessionId: 'sess-001',
    date: '2026-03-15',
    project: 'my-app',
    slug: 'test-slug',
    firstUserText: '質問です',
    ...overrides,
  };
}

const _basicTurns: Turn[] = [
  { role: 'user', text: 'ユーザーの質問' },
  { role: 'assistant', text: 'AIの回答' },
];

/**
 * `renderMarkdown` のユニットテストスイート。
 *
 * セッションメタ情報と会話ターン一覧から Markdown 文字列を生成する関数の動作を検証する。
 * YAML フロントマターの正確性（session_id・date・project・slug）・
 * 会話セクション（### User / ### Assistant）の生成・slug 空文字時の省略・
 * 改行正規化（3 連続 → 2 連続）の各ケースをカバーする。
 *
 * @see renderMarkdown
 */
describe('renderMarkdown', () => {
  describe('Given: 基本的な meta と 1ターン', () => {
    describe('When: renderMarkdown(meta, turns) を呼び出す', () => {
      describe('Then: T-EC-RM-01 - frontmatter が正しく出力される', () => {
        it('T-EC-RM-01-01: frontmatter が --- で囲まれている', () => {
          const result = renderMarkdown(_makeMeta(), _basicTurns);
          assertStringIncludes(result, '---\n');
        });

        it('T-EC-RM-01-02: "session_id: sess-001" が含まれる', () => {
          const result = renderMarkdown(_makeMeta({ sessionId: 'sess-001' }), _basicTurns);
          assertStringIncludes(result, 'session_id: sess-001');
        });

        it('T-EC-RM-01-03: "date: 2026-03-15" が含まれる', () => {
          const result = renderMarkdown(_makeMeta({ date: '2026-03-15' }), _basicTurns);
          assertStringIncludes(result, 'date: 2026-03-15');
        });

        it('T-EC-RM-01-04: "project: my-app" が含まれる', () => {
          const result = renderMarkdown(_makeMeta({ project: 'my-app' }), _basicTurns);
          assertStringIncludes(result, 'project: my-app');
        });

        it('T-EC-RM-01-05: slug が空でない場合 "slug: test-slug" が含まれる', () => {
          const result = renderMarkdown(_makeMeta({ slug: 'test-slug' }), _basicTurns);
          assertStringIncludes(result, 'slug: test-slug');
        });

        it('T-EC-RM-01-06: slug が空の場合 "slug:" 行が含まれない', () => {
          const result = renderMarkdown(_makeMeta({ slug: '' }), _basicTurns);
          assertEquals(result.includes('slug:'), false);
        });
      });
    });
  });

  describe('Given: user + assistant ターン', () => {
    describe('When: renderMarkdown(meta, turns) を呼び出す', () => {
      describe('Then: T-EC-RM-02 - 会話セクションが正しく出力される', () => {
        it('T-EC-RM-02-01: "### User" セクションが含まれる', () => {
          const result = renderMarkdown(_makeMeta(), _basicTurns);
          assertStringIncludes(result, '### User');
        });

        it('T-EC-RM-02-02: "### Assistant" セクションが含まれる', () => {
          const result = renderMarkdown(_makeMeta(), _basicTurns);
          assertStringIncludes(result, '### Assistant');
        });

        it('T-EC-RM-02-03: firstUserText "質問です" が # 見出しとして含まれる', () => {
          const result = renderMarkdown(_makeMeta({ firstUserText: '質問です' }), _basicTurns);
          assertStringIncludes(result, '# 質問です');
        });

        it('T-EC-RM-02-04: ターン内の3連続改行が2連続改行に正規化される', () => {
          const turns: Turn[] = [{ role: 'user', text: 'line1\n\n\nline2' }];
          const result = renderMarkdown(_makeMeta(), turns);
          assertEquals(result.includes('\n\n\n'), false);
        });

        it('T-EC-RM-02-05: 空ターン配列でも "## 会話ログ" セクションが含まれる', () => {
          const result = renderMarkdown(_makeMeta(), []);
          assertStringIncludes(result, '## 会話ログ');
        });
      });
    });
  });
});
