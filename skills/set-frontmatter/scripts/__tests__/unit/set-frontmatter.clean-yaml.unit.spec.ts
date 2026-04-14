// src: scripts/__tests__/unit/set-frontmatter.clean-yaml.unit.spec.ts
// @(#): cleanYaml のユニットテスト
//       コードフェンス除去・先頭テキスト除去の検証
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals, assertNotMatch } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import { cleanYaml } from '../../set-frontmatter.ts';

// ─── コードフェンスなし ───────────────────────────────────────────────────────

describe('cleanYaml', () => {
  describe('Given: コードフェンスのない正常な YAML', () => {
    describe('When: cleanYaml(raw, "title") を呼び出す', () => {
      describe('Then: T-SF-CY-01 - trim されてそのまま返る', () => {
        const raw = 'title: テスト\nsummary: 概要\n';

        it('T-SF-CY-01-01: "title: テスト" で始まる', () => {
          const result = cleanYaml(raw, 'title');

          assertEquals(result.startsWith('title: テスト'), true);
        });

        it('T-SF-CY-01-02: "summary: 概要" が含まれる', () => {
          const result = cleanYaml(raw, 'title');

          assertEquals(result.includes('summary: 概要'), true);
        });
      });
    });
  });

  // ─── コードフェンス付き YAML ─────────────────────────────────────────────

  describe('Given: ```yaml フェンスで囲まれた YAML', () => {
    describe('When: cleanYaml(raw, "title") を呼び出す', () => {
      describe('Then: T-SF-CY-02 - コードフェンス行が除去される', () => {
        const raw = '```yaml\ntitle: テスト\nsummary: 概要\n```';

        it('T-SF-CY-02-01: ``` 行が含まれない', () => {
          const result = cleanYaml(raw, 'title');

          assertNotMatch(result, /```/);
        });

        it('T-SF-CY-02-02: "title: テスト" で始まる', () => {
          const result = cleanYaml(raw, 'title');

          assertEquals(result.startsWith('title: テスト'), true);
        });
      });
    });
  });

  // ─── 前文テキスト + YAML ─────────────────────────────────────────────────

  describe('Given: YAML の前に説明テキストがある場合', () => {
    describe('When: cleanYaml(raw, "title") を呼び出す', () => {
      describe('Then: T-SF-CY-03 - title: 行以降のみ返る', () => {
        const raw = 'ここは説明文です。\n以下が YAML です。\ntitle: テスト\nsummary: 概要';

        it('T-SF-CY-03-01: "title: テスト" で始まる', () => {
          const result = cleanYaml(raw, 'title');

          assertEquals(result.startsWith('title: テスト'), true);
        });

        it('T-SF-CY-03-02: 説明文が含まれない', () => {
          const result = cleanYaml(raw, 'title');

          assertNotMatch(result, /説明文/);
        });
      });
    });
  });

  // ─── firstField='type' の場合 ────────────────────────────────────────────

  describe('Given: firstField が "type" の場合', () => {
    describe('When: cleanYaml(raw, "type") を呼び出す', () => {
      describe('Then: T-SF-CY-04 - type: 行以降のみ返る', () => {
        const raw = '前文\ntype: research\ncategory: development';

        it('T-SF-CY-04-01: "type: research" で始まる', () => {
          const result = cleanYaml(raw, 'type');

          assertEquals(result.startsWith('type: research'), true);
        });

        it('T-SF-CY-04-02: "category: development" が含まれる', () => {
          const result = cleanYaml(raw, 'type');

          assertEquals(result.includes('category: development'), true);
        });
      });
    });
  });

  // ─── コードフェンス + 前文テキストの組み合わせ ───────────────────────────

  describe('Given: コードフェンスと前文テキストが両方ある場合', () => {
    describe('When: cleanYaml(raw, "title") を呼び出す', () => {
      describe('Then: T-SF-CY-05 - フェンスと前文が除去される', () => {
        const raw = '以下の YAML を出力します:\n```yaml\ntitle: テスト\nsummary: 概要\n```\n以上です。';

        it('T-SF-CY-05-01: "title: テスト" で始まる', () => {
          const result = cleanYaml(raw, 'title');

          assertEquals(result.startsWith('title: テスト'), true);
        });

        it('T-SF-CY-05-02: ``` が含まれない', () => {
          const result = cleanYaml(raw, 'title');

          assertNotMatch(result, /```/);
        });
      });
    });
  });
});
