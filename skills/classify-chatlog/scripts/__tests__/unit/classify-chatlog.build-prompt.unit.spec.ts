// src: scripts/__tests__/unit/classify-chatlog.buildPrompt.unit.spec.ts
// @(#): buildClassifyPrompt / buildSystemPrompt のユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertStringIncludes } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import {
  buildClassifyPrompt,
  buildSystemPrompt,
  FALLBACK_PROJECT,
} from '../../classify-chatlog.ts';
import type { FileMeta } from '../../classify-chatlog.ts';

// ─── テスト用 FileMeta ヘルパー ───────────────────────────────────────────────

function makeFileMeta(overrides: Partial<FileMeta> = {}): FileMeta {
  return {
    filePath: 'test/path/file.md',
    filename: 'file.md',
    existingProject: '',
    title: 'Test Title',
    category: 'development',
    topics: [],
    tags: [],
    fullText: '',
    ...overrides,
  };
}

// ─── buildClassifyPrompt ──────────────────────────────────────────────────────

describe('buildClassifyPrompt', () => {
  describe('Given: 2件の FileMeta と ["app1", "app2"] のプロジェクトリスト', () => {
    describe('When: buildClassifyPrompt(files, projects) を呼び出す', () => {
      describe('Then: T-CL-BCP-01 - 複数ファイルのプロンプト生成', () => {
        it('T-CL-BCP-01-01: "Projects: app1, app2, misc" ヘッダーが含まれる', () => {
          const files = [
            makeFileMeta({ filename: 'a.md' }),
            makeFileMeta({ filename: 'b.md' }),
          ];

          const result = buildClassifyPrompt(files, ['app1', 'app2']);

          assertStringIncludes(result, 'Projects: app1, app2, misc');
        });

        it('T-CL-BCP-01-02: FILE 1 のセクションが含まれる', () => {
          const files = [
            makeFileMeta({ filename: 'a.md' }),
            makeFileMeta({ filename: 'b.md' }),
          ];

          const result = buildClassifyPrompt(files, ['app1', 'app2']);

          assertStringIncludes(result, '=== FILE 1: a.md ===');
        });

        it('T-CL-BCP-01-03: FILE 2 のセクションが含まれる', () => {
          const files = [
            makeFileMeta({ filename: 'a.md' }),
            makeFileMeta({ filename: 'b.md' }),
          ];

          const result = buildClassifyPrompt(files, ['app1', 'app2']);

          assertStringIncludes(result, '=== FILE 2: b.md ===');
        });
      });
    });
  });

  describe('Given: topics/tags が空の FileMeta', () => {
    describe('When: buildClassifyPrompt([fileMeta], projects) を呼び出す', () => {
      describe('Then: T-CL-BCP-02 - topics/tags が空のとき (none) が出力される', () => {
        it('T-CL-BCP-02-01: topics として "(none)" が含まれる', () => {
          const files = [makeFileMeta({ topics: [], tags: [] })];

          const result = buildClassifyPrompt(files, ['app1']);

          assertStringIncludes(result, 'topics: (none)');
        });

        it('T-CL-BCP-02-02: tags として "(none)" が含まれる', () => {
          const files = [makeFileMeta({ topics: [], tags: [] })];

          const result = buildClassifyPrompt(files, ['app1']);

          assertStringIncludes(result, 'tags: (none)');
        });
      });
    });
  });

  describe('Given: フロントマターなし（title/category/topics/tags が空）の FileMeta', () => {
    describe('When: buildClassifyPrompt([fileMeta], projects) を呼び出す', () => {
      describe('Then: T-CL-BCP-04 - 本文スニペットが追加される', () => {
        it('T-CL-BCP-04-01: "body:" フィールドが含まれる', () => {
          const files = [
            makeFileMeta({
              title: '',
              category: '',
              topics: [],
              tags: [],
              fullText: 'Deno でファイル入出力を実装した。readTextFile と writeTextFile の使い方を確認した。',
            }),
          ];

          const result = buildClassifyPrompt(files, ['app1']);

          assertStringIncludes(result, 'body:');
        });

        it('T-CL-BCP-04-02: 本文が 500 文字以内にトリムされて含まれる', () => {
          const longBody = 'a'.repeat(600);
          const files = [
            makeFileMeta({
              title: '',
              category: '',
              topics: [],
              tags: [],
              fullText: longBody,
            }),
          ];

          const result = buildClassifyPrompt(files, ['app1']);

          assertStringIncludes(result, `body: ${'a'.repeat(500)}`);
        });
      });
    });
  });

  describe('Given: フロントマターあり（title が存在する）の FileMeta', () => {
    describe('When: buildClassifyPrompt([fileMeta], projects) を呼び出す', () => {
      describe('Then: T-CL-BCP-05 - 本文スニペットは追加されない', () => {
        it('T-CL-BCP-05-01: "body:" フィールドが含まれない', () => {
          const files = [
            makeFileMeta({
              title: 'テストタイトル',
              category: '',
              topics: [],
              tags: [],
              fullText: '本文テキスト',
            }),
          ];

          const result = buildClassifyPrompt(files, ['app1']);

          // body: が含まれないことを確認（indexOf で -1）
          const hasBody = result.includes('body:');
          if (hasBody) {
            throw new Error('body: フィールドが含まれているが、含まれてはいけない');
          }
        });
      });
    });
  });

  describe('Given: topics/tags が存在する FileMeta', () => {
    describe('When: buildClassifyPrompt([fileMeta], projects) を呼び出す', () => {
      describe('Then: T-CL-BCP-03 - topics/tags がカンマ区切りで出力される', () => {
        it('T-CL-BCP-03-01: topics がカンマ区切りで含まれる', () => {
          const files = [makeFileMeta({ topics: ['API', '設計'], tags: ['ts'] })];

          const result = buildClassifyPrompt(files, ['app1']);

          assertStringIncludes(result, 'topics: API, 設計');
        });

        it('T-CL-BCP-03-02: tags がカンマ区切りで含まれる', () => {
          const files = [makeFileMeta({ topics: ['API'], tags: ['ts', 'deno'] })];

          const result = buildClassifyPrompt(files, ['app1']);

          assertStringIncludes(result, 'tags: ts, deno');
        });
      });
    });
  });
});

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  describe('Given: ["app1", "app2"] のプロジェクトリスト', () => {
    describe('When: buildSystemPrompt(projects) を呼び出す', () => {
      describe('Then: T-CL-BSP-01 - プロジェクトリストと misc フォールバックが含まれる', () => {
        it('T-CL-BSP-01-01: "app1, app2, misc" のリストが含まれる', () => {
          const result = buildSystemPrompt(['app1', 'app2']);

          assertStringIncludes(result, 'app1, app2, misc');
        });

        it(`T-CL-BSP-01-02: "${FALLBACK_PROJECT}" フォールバックの指示が含まれる`, () => {
          const result = buildSystemPrompt(['app1', 'app2']);

          assertStringIncludes(result, `"${FALLBACK_PROJECT}"`);
        });
      });
    });
  });

  describe('Given: 任意のプロジェクトリスト', () => {
    describe('When: buildSystemPrompt(projects) を呼び出す', () => {
      describe('Then: T-CL-BSP-02 - 出力形式の指示が含まれる', () => {
        it('T-CL-BSP-02-01: "Output ONLY a JSON array" の指示が含まれる', () => {
          const result = buildSystemPrompt(['app1']);

          assertStringIncludes(result, 'Output ONLY a JSON array');
        });

        it('T-CL-BSP-02-02: JSON スキーマのフィールド "file" が含まれる', () => {
          const result = buildSystemPrompt(['app1']);

          assertStringIncludes(result, '"file"');
        });
      });
    });
  });
});
