// src: scripts/__tests__/unit/normalize-chatlog.input-dir.unit.spec.ts
// @(#): 入力ディレクトリ解決のユニットテスト
//       対象: resolveInputDir, validateInputDir
//       テスト種別: 正常系 / 異常系 / エッジケース
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

// Deno Test module
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// test target
import {
  resolveInputDir,
  validateInputDir,
} from '../../normalize-chatlog.ts';

// ─── resolveInputDir 単体テスト ────────────────────────────────────────────────

/**
 * resolveInputDir の単体テスト。
 * 純粋関数として、FS副作用なしにパス解決結果 (ResolveResult) を返すことを検証する。
 */
describe('Given: resolveInputDir (純粋関数)', () => {
  // ─── T-01: --dir 指定 ──────────────────────────────────────────────────────

  describe('When: --dir オプションが指定される', () => {
    /** 正常系: --dir 指定時に { ok: true, dir: <指定値> } が返る */
    it('Then: [正常] - { ok: true, dir: <指定値> } を返す', () => {
      const result = resolveInputDir({ dir: '/some/path' });

      assertEquals(result, { ok: true, dir: '/some/path' });
    });
  });

  // ─── T-02: --agent + --yearMonth 指定 ─────────────────────────────────────

  describe('When: --agent と --yearMonth が指定される', () => {
    /** 正常系: temp/chatlog/<agent>/<year>/<yearMonth> のパスが返る */
    it('Then: [正常] - { ok: true, dir: "temp/chatlog/<agent>/<year>/<yearMonth>" } を返す', () => {
      const result = resolveInputDir({ agent: 'claude', yearMonth: '2026-03' });

      assertEquals(result, { ok: true, dir: 'temp/chatlog/claude/2026/2026-03' });
    });
  });

  // ─── T-03: --dir と --agent/--yearMonth の優先順位 ────────────────────────

  describe('When: --dir と --agent/--yearMonth が両方指定される', () => {
    /** エッジケース: --dir が --agent/--yearMonth より優先される */
    it('Then: [エッジケース] - --dir が優先されて { ok: true, dir: <dir値> } を返す', () => {
      const result = resolveInputDir({ dir: '/explicit/dir', agent: 'claude', yearMonth: '2026-03' });

      assertEquals(result, { ok: true, dir: '/explicit/dir' });
    });
  });

  // ─── T-04: 引数なし ────────────────────────────────────────────────────────

  describe('When: 引数が空オブジェクト {}', () => {
    /** 異常系: 必須オプションなしで { ok: false, error: ... } が返る */
    it('Then: [異常] - { ok: false, error: エラーメッセージ } を返す', () => {
      const result = resolveInputDir({});

      assertEquals(result, {
        ok: false,
        error: '--dir or (--agent and --year-month) must be specified',
      });
    });
  });

  // ─── T-05: --agent のみ指定（yearMonth なし） ─────────────────────────────

  describe('When: --agent のみ指定（--yearMonth なし）', () => {
    /** 異常系: --yearMonth が欠けているため { ok: false, error: ... } が返る */
    it('Then: [異常] - { ok: false, error: エラーメッセージ } を返す', () => {
      const result = resolveInputDir({ agent: 'claude' });

      assertEquals(result, {
        ok: false,
        error: '--dir or (--agent and --year-month) must be specified',
      });
    });
  });

  // ─── T-06: --yearMonth のみ指定（agent なし） ─────────────────────────────

  describe('When: --yearMonth のみ指定（--agent なし）', () => {
    /** 異常系: --agent が欠けているため { ok: false, error: ... } が返る */
    it('Then: [異常] - { ok: false, error: エラーメッセージ } を返す', () => {
      const result = resolveInputDir({ yearMonth: '2026-03' });

      assertEquals(result, {
        ok: false,
        error: '--dir or (--agent and --year-month) must be specified',
      });
    });
  });

  // ─── T-07: yearMonth から year の正しい抽出 ───────────────────────────────

  describe('When: yearMonth="2026-03" が指定される', () => {
    /** エッジケース: yearMonth の先頭4文字が year として抽出されパスに反映される */
    it('Then: [エッジケース] - dir パスに "2026/2026-03" が含まれる', () => {
      const result = resolveInputDir({ agent: 'claude', yearMonth: '2026-03' });

      if (!result.ok) { throw new Error('Expected ok: true'); }
      assertEquals(result.dir.includes('2026/2026-03'), true);
    });
  });
});

// ─── validateInputDir 単体テスト ──────────────────────────────────────────────

describe('Given: validateInputDir (statFn注入)', () => {
  describe('When: statFn が成功（例外なし）', () => {
    it('Then: [正常] - true を返す', () => {
      const statFn = (_path: string) => ({ isDirectory: true });
      const result = validateInputDir('/any/path', statFn);

      assertEquals(result, true);
    });
  });

  describe('When: statFn が例外をスロー', () => {
    it('Then: [異常] - false を返す', () => {
      const statFn = (_path: string): unknown => {
        throw new Deno.errors.NotFound('not found');
      };
      const result = validateInputDir('/nonexistent/path', statFn);

      assertEquals(result, false);
    });
  });

  describe('When: statFn が undefined として渡される', () => {
    it('Then: [エッジケース] - Deno.statSync をデフォルトとして使用し、存在するディレクトリには true を返す', () => {
      // undefined を明示的に渡す（falsyフォールバックのテスト）
      // 実際のFS（カレントディレクトリ "."）を使う
      const result = validateInputDir('.', undefined);

      assertEquals(result, true);
    });
  });

  describe('When: statFn が undefined として渡され、存在しないパス', () => {
    it('Then: [エッジケース] - Deno.statSync をデフォルトとして使用し、存在しないパスには false を返す', () => {
      const result = validateInputDir('/nonexistent/path/xyz', undefined);

      assertEquals(result, false);
    });
  });
});
