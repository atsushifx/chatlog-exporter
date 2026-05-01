// src: skills/classify-chatlog/scripts/__tests__/unit/ClassifyChatlogEntry.unit.spec.ts
// @(#): ClassifyChatlogEntry のユニットテスト
//       filePath・filename プロパティと ChatlogEntry 継承の確認
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- modules for test --
// test target
import { ClassifyChatlogEntry } from '../../classes/ClassifyChatlogEntry.class.ts';

// ─── T-CLE-01: filePath が正しく格納される ──────────────────────────────────

describe('Given: ClassifyChatlogEntry インスタンス', () => {
  describe('When: new ClassifyChatlogEntry(text, "/tmp/test/file.md") を呼び出す', () => {
    describe('Then: T-CLE-01 - filePath が正しく格納される', () => {
      it('T-CLE-01: filePath === "/tmp/test/file.md"', () => {
        const _entry = new ClassifyChatlogEntry('---\ntitle: test\n---\n本文', '/tmp/test/file.md');
        assertEquals(_entry.filePath, '/tmp/test/file.md');
      });
    });
  });
});

// ─── T-CLE-02: filename がパスなしのファイル名に正規化される ─────────────────

describe('Given: ClassifyChatlogEntry インスタンス（filePath に "/tmp/test/file.md"）', () => {
  describe('When: filename プロパティを参照する', () => {
    describe('Then: T-CLE-02 - filename がパスなしのファイル名になる', () => {
      it('T-CLE-02: filename === "file.md"', () => {
        const _entry = new ClassifyChatlogEntry('---\ntitle: test\n---\n本文', '/tmp/test/file.md');
        assertEquals(_entry.filename, 'file.md');
      });
    });
  });
});

// ─── T-CLE-03: frontmatter.get('title') が継承で使える ──────────────────────

describe('Given: ClassifyChatlogEntry インスタンス（frontmatter に title: テスト）', () => {
  describe('When: frontmatter.get("title") を呼び出す', () => {
    describe('Then: T-CLE-03 - frontmatter.get("title") === "テスト"', () => {
      it('T-CLE-03: frontmatter.get("title") が継承で使える', () => {
        const _entry = new ClassifyChatlogEntry('---\ntitle: テスト\n---\n本文', '/tmp/test/file.md');
        assertEquals(_entry.frontmatter.get('title'), 'テスト');
      });
    });
  });
});

// ─── T-CLE-04: renderEntry() が継承で使える（文字列を返す） ──────────────────

describe('Given: ClassifyChatlogEntry インスタンス', () => {
  describe('When: renderEntry() を呼び出す', () => {
    describe('Then: T-CLE-04 - renderEntry() の戻り値が string 型', () => {
      it('T-CLE-04: renderEntry() が string を返す', () => {
        const _entry = new ClassifyChatlogEntry('---\ntitle: test\n---\n本文', '/tmp/test/file.md');
        assertEquals(typeof _entry.renderEntry(), 'string');
      });
    });
  });
});
