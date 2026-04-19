// src: skills/_scripts/libs/__tests__/unit/utils.unit.spec.ts
// @(#): utils ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- test target --
import { homeDir, normalizePath } from '../../../libs/utils.ts';

// ─────────────────────────────────────────────
// homeDir
// ─────────────────────────────────────────────

describe('homeDir', () => {
  describe('Given: HOME 環境変数が設定されている', () => {
    describe('When: homeDir を実行する', () => {
      describe('Then: T-LIB-U-06-01 - HOME の値が返る', () => {
        it('T-LIB-U-06-01: HOME が設定されている場合はその値を返す', () => {
          const _env = (name: string): string | undefined => {
            if (name === 'HOME') { return '/home/testuser'; }
            return undefined;
          };
          assertEquals(homeDir(_env), '/home/testuser');
        });
      });
    });
  });

  describe('Given: HOME 未設定・USERPROFILE が設定されている', () => {
    describe('When: homeDir を実行する', () => {
      describe('Then: T-LIB-U-06-02 - USERPROFILE の値が返る', () => {
        it('T-LIB-U-06-02: HOME 未設定で USERPROFILE が設定されている場合はその値を返す', () => {
          const _env = (name: string): string | undefined => {
            if (name === 'USERPROFILE') { return 'C:/Users/testuser'; }
            return undefined;
          };
          assertEquals(homeDir(_env), 'C:/Users/testuser');
        });
      });
    });
  });

  describe('Given: HOME・USERPROFILE ともに未設定', () => {
    describe('When: homeDir を実行する', () => {
      describe('Then: T-LIB-U-06-03 - "~" が返る', () => {
        it('T-LIB-U-06-03: どちらも未設定の場合は "~" を返す', () => {
          const _env = (_name: string): string | undefined => undefined;
          assertEquals(homeDir(_env), '~');
        });
      });
    });
  });

  describe('Given: HOME 未設定・USERPROFILE がバックスラッシュパス', () => {
    describe('When: homeDir を実行する', () => {
      describe('Then: T-LIB-U-06-04 - バックスラッシュがスラッシュに正規化される', () => {
        it('T-LIB-U-06-04: USERPROFILE が Windows バックスラッシュパスの場合はスラッシュに変換して返す', () => {
          const _env = (name: string): string | undefined => {
            if (name === 'USERPROFILE') { return 'C:\\Users\\testuser'; }
            return undefined;
          };
          assertEquals(homeDir(_env), 'C:/Users/testuser');
        });
      });
    });
  });
});

// ─────────────────────────────────────────────
// normalizePath
// ─────────────────────────────────────────────

describe('normalizePath', () => {
  describe('Given: バックスラッシュのみのパス', () => {
    describe('When: normalizePath を実行する', () => {
      describe('Then: T-LIB-U-01 - 全てスラッシュに変換される', () => {
        it('T-LIB-U-01-01: バックスラッシュが全てスラッシュに変換される', () => {
          assertEquals(normalizePath('C:\\Users\\foo\\bar'), 'C:/Users/foo/bar');
        });
      });
    });
  });

  describe('Given: バックスラッシュとスラッシュが混在するパス', () => {
    describe('When: normalizePath を実行する', () => {
      describe('Then: T-LIB-U-02 - 全てスラッシュに統一される', () => {
        it('T-LIB-U-02-01: 混在した区切り文字が全てスラッシュに統一される', () => {
          assertEquals(normalizePath('C:\\dir/sub\\file.md'), 'C:/dir/sub/file.md');
        });
      });
    });
  });

  describe('Given: スラッシュのみのパス（変換不要）', () => {
    describe('When: normalizePath を実行する', () => {
      describe('Then: T-LIB-U-03 - 入力と同一の文字列が返る', () => {
        it('T-LIB-U-03-01: スラッシュ済みパスは変更されない', () => {
          assertEquals(normalizePath('/home/user/file.md'), '/home/user/file.md');
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: normalizePath を実行する', () => {
      describe('Then: T-LIB-U-04 - 空文字列が返る', () => {
        it('T-LIB-U-04-01: 空文字列は空文字列のまま返る', () => {
          assertEquals(normalizePath(''), '');
        });
      });
    });
  });

  describe('Given: Windows ドライブレター付きパス', () => {
    describe('When: normalizePath を実行する', () => {
      describe('Then: T-LIB-U-05 - ドライブレターを保持しスラッシュに変換される', () => {
        it('T-LIB-U-05-01: C:\\Users\\foo が C:/Users/foo に変換される', () => {
          assertEquals(normalizePath('C:\\Users\\foo'), 'C:/Users/foo');
        });
      });
    });
  });
});
