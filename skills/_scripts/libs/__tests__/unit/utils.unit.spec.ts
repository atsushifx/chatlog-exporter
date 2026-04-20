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
import { getDirectory, getFileName, homeDir, normalizeLine, normalizePath, textToSlug } from '../../../libs/utils.ts';

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

// ─────────────────────────────────────────────
// normalizeLine
// ─────────────────────────────────────────────

describe('normalizeLine', () => {
  describe('Given: CRLF のみの文字列', () => {
    describe('When: normalizeLine を実行する', () => {
      describe('Then: T-LIB-U-07-01 - \\r\\n が \\n に変換される', () => {
        it('T-LIB-U-07-01: CRLF が LF に変換される', () => {
          assertEquals(normalizeLine('line1\r\nline2\r\nline3'), 'line1\nline2\nline3');
        });
      });
    });
  });

  describe('Given: 単独 CR のみの文字列', () => {
    describe('When: normalizeLine を実行する', () => {
      describe('Then: T-LIB-U-07-02 - \\r が \\n に変換される', () => {
        it('T-LIB-U-07-02: 単独 CR が LF に変換される', () => {
          assertEquals(normalizeLine('line1\rline2\rline3'), 'line1\nline2\nline3');
        });
      });
    });
  });

  describe('Given: CRLF・CR・LF が混在する文字列', () => {
    describe('When: normalizeLine を実行する', () => {
      describe('Then: T-LIB-U-07-03 - 全ての行末が \\n に統一される', () => {
        it('T-LIB-U-07-03: CRLF・CR・LF 混在が全て LF に変換される', () => {
          assertEquals(normalizeLine('line1\r\nline2\rline3\nline4'), 'line1\nline2\nline3\nline4');
        });
      });
    });
  });

  describe('Given: LF のみの文字列（変換不要）', () => {
    describe('When: normalizeLine を実行する', () => {
      describe('Then: T-LIB-U-07-04 - 入力と同一の文字列が返る', () => {
        it('T-LIB-U-07-04: LF のみの文字列は変更されない', () => {
          assertEquals(normalizeLine('line1\nline2\nline3'), 'line1\nline2\nline3');
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: normalizeLine を実行する', () => {
      describe('Then: T-LIB-U-07-05 - 空文字列が返る', () => {
        it('T-LIB-U-07-05: 空文字列は空文字列のまま返る', () => {
          assertEquals(normalizeLine(''), '');
        });
      });
    });
  });
});

// ─────────────────────────────────────────────
// getDirectory
// ─────────────────────────────────────────────

describe('getDirectory', () => {
  describe('Given: Unix スタイルの絶対パス', () => {
    describe('When: getDirectory を実行する', () => {
      describe('Then: T-LIB-U-08-01 - ファイル名を除いたディレクトリパスが返る', () => {
        it('T-LIB-U-08-01: /home/user/file.md から /home/user が返る', () => {
          assertEquals(getDirectory('/home/user/file.md'), '/home/user');
        });
      });
    });
  });

  describe('Given: Windows バックスラッシュパス', () => {
    describe('When: getDirectory を実行する', () => {
      describe('Then: T-LIB-U-08-02 - バックスラッシュをスラッシュに統一したディレクトリパスが返る', () => {
        it('T-LIB-U-08-02: C:\\Users\\foo\\file.md から C:/Users/foo が返る', () => {
          assertEquals(getDirectory('C:\\Users\\foo\\file.md'), 'C:/Users/foo');
        });
      });
    });
  });

  describe('Given: バックスラッシュとスラッシュが混在するパス', () => {
    describe('When: getDirectory を実行する', () => {
      describe('Then: T-LIB-U-08-03 - 混在セパレータを統一したディレクトリパスが返る', () => {
        it('T-LIB-U-08-03: C:\\dir/sub\\file.md から C:/dir/sub が返る', () => {
          assertEquals(getDirectory('C:\\dir/sub\\file.md'), 'C:/dir/sub');
        });
      });
    });
  });

  describe('Given: セパレータなしのファイル名のみのパス', () => {
    describe('When: getDirectory を実行する', () => {
      describe('Then: T-LIB-U-08-04 - 空文字列が返る', () => {
        it('T-LIB-U-08-04: file.md（セパレータなし）から空文字列が返る', () => {
          assertEquals(getDirectory('file.md'), '');
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: getDirectory を実行する', () => {
      describe('Then: T-LIB-U-08-05 - 空文字列が返る', () => {
        it('T-LIB-U-08-05: 空文字列から空文字列が返る', () => {
          assertEquals(getDirectory(''), '');
        });
      });
    });
  });
});

// ─────────────────────────────────────────────
// getFileName
// ─────────────────────────────────────────────

describe('getFileName', () => {
  describe('Given: Unix パス /home/user/file.md', () => {
    describe('When: getFileName を実行する', () => {
      describe('Then: T-LIB-U-09-01 - file.md が返る', () => {
        it('T-LIB-U-09-01: Unix パスからファイル名が返る', () => {
          assertEquals(getFileName('/home/user/file.md'), 'file.md');
        });
      });
    });
  });

  describe('Given: Windows バックスラッシュパス C:\\Users\\foo\\file.md', () => {
    describe('When: getFileName を実行する', () => {
      describe('Then: T-LIB-U-09-02 - file.md が返る', () => {
        it('T-LIB-U-09-02: Windows バックスラッシュパスからファイル名が返る', () => {
          assertEquals(getFileName('C:\\Users\\foo\\file.md'), 'file.md');
        });
      });
    });
  });

  describe('Given: 混在パス C:\\dir/sub\\file.md', () => {
    describe('When: getFileName を実行する', () => {
      describe('Then: T-LIB-U-09-03 - file.md が返る', () => {
        it('T-LIB-U-09-03: 混在パスからファイル名が返る', () => {
          assertEquals(getFileName('C:\\dir/sub\\file.md'), 'file.md');
        });
      });
    });
  });

  describe('Given: セパレータなし file.md', () => {
    describe('When: getFileName を実行する', () => {
      describe('Then: T-LIB-U-09-04 - file.md が返る', () => {
        it('T-LIB-U-09-04: セパレータなしパスからファイル名がそのまま返る', () => {
          assertEquals(getFileName('file.md'), 'file.md');
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: getFileName を実行する', () => {
      describe('Then: T-LIB-U-09-05 - 空文字列が返る', () => {
        it('T-LIB-U-09-05: 空文字列から空文字列が返る', () => {
          assertEquals(getFileName(''), '');
        });
      });
    });
  });
});

// ─────────────────────────────────────────────
// textToSlug
// ─────────────────────────────────────────────

describe('textToSlug', () => {
  describe('Given: 通常の英語テキスト', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-01 - 英小文字・ハイフンのスラッグが返る', () => {
        it('T-LIB-U-10-01: 英語テキストがスラッグに変換される', () => {
          assertEquals(textToSlug('Hello World'), 'hello-world');
        });
      });
    });
  });

  describe('Given: 特殊文字・記号を含むテキスト', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-02 - 特殊文字がハイフンに変換される', () => {
        it('T-LIB-U-10-02: 特殊文字がハイフンに置換されスラッグが返る', () => {
          assertEquals(textToSlug('Hello, World! foo@bar'), 'hello-world-foo-bar');
        });
      });
    });
  });

  describe('Given: 日本語のみのテキスト', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-03 - fallback が返る', () => {
        it('T-LIB-U-10-03: ASCII 非対応テキストは fallback を返す', () => {
          assertEquals(textToSlug('こんにちは'), 'session');
        });
      });
    });
  });

  describe('Given: 変換後 3 文字未満になるテキスト', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-04 - fallback が返る', () => {
        it('T-LIB-U-10-04: 変換結果が短すぎる場合は fallback を返す', () => {
          assertEquals(textToSlug('ab'), 'session');
        });
      });
    });
  });

  describe('Given: 空文字列', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-05 - fallback が返る', () => {
        it('T-LIB-U-10-05: 空文字列は fallback を返す', () => {
          assertEquals(textToSlug(''), 'session');
        });
      });
    });
  });

  describe('Given: カスタム fallback 指定', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-06 - 指定した fallback が返る', () => {
        it('T-LIB-U-10-06: 空文字列でカスタム fallback を返す', () => {
          assertEquals(textToSlug('', 'custom-fallback'), 'custom-fallback');
        });
      });
    });
  });

  describe('Given: 50 文字を超えるテキスト', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-07 - 50 文字に切り詰められる', () => {
        it('T-LIB-U-10-07: 長いテキストは 50 文字以下のスラッグになる', () => {
          const long = 'this is a very long text that should be truncated to fifty characters maximum';
          const result = textToSlug(long);
          assertEquals(result.length <= 50, true);
        });
      });
    });
  });

  describe('Given: 複数段落（\\n\\n 区切り）テキスト', () => {
    describe('When: textToSlug を実行する', () => {
      describe('Then: T-LIB-U-10-08 - 第 1 段落のみが使われる', () => {
        it('T-LIB-U-10-08: 2 段落目以降は無視されスラッグが返る', () => {
          assertEquals(textToSlug('first paragraph\n\nsecond paragraph'), 'first-paragraph');
        });
      });
    });
  });
});
