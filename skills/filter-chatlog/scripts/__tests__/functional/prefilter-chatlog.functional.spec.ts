// src: scripts/__tests__/functional/prefilter-chatlog.functional.spec.ts
// @(#): prefilter-chatlog.ts の機能テスト
//       findMdFiles / classifyFile — 実 tempdir を使用
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.

import { assertEquals } from '@std/assert';
import { afterEach, beforeEach, describe, it } from '@std/testing/bdd';

// test target
import { classifyFile, findMdFiles } from '../../prefilter-chatlog.ts';

// ─── 共通セットアップ ──────────────────────────────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await Deno.makeTempDir();
});

afterEach(async () => {
  await Deno.remove(tempDir, { recursive: true });
});

// ─── ヘルパー ──────────────────────────────────────────────────────────────────

function _makeValidContent(): string {
  const userText = 'u'.repeat(300);
  const assistantText = 'a'.repeat(300);
  return `---\ntitle: テスト\n---\n### User\n${userText}\n\n### Assistant\n${assistantText}\n`;
}

async function _makeTestDirs(agent: string, yearMonth: string): Promise<string> {
  const yyyy = yearMonth.slice(0, 4);
  const dir = `${tempDir}/${agent}/${yyyy}/${yearMonth}`;
  await Deno.mkdir(dir, { recursive: true });
  return dir;
}

// ─────────────────────────────────────────────────────────────────────────────
// findMdFiles
// ─────────────────────────────────────────────────────────────────────────────

describe('findMdFiles (prefilter)', () => {
  // ─── T-PF-FM-01: baseDir/agent/YYYY/YYYY-MM/ 構造 → 収集・ソート ─────────────

  describe('Given: tempDir/claude/2026/2026-03/ に .md ファイル 2 件', () => {
    describe('When: findMdFiles(tempDir, "claude") を呼び出す', () => {
      describe('Then: T-PF-FM-01 - 2 件のファイルパスがソート済みで返される', () => {
        it('T-PF-FM-01-01: 2 件のファイルパスが返される', async () => {
          const dir = await _makeTestDirs('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/chat-a.md`, '# A');
          await Deno.writeTextFile(`${dir}/chat-b.md`, '# B');

          const result = await findMdFiles(tempDir, 'claude');

          assertEquals(result.length, 2);
        });

        it('T-PF-FM-01-02: ソート済みで返される', async () => {
          const dir = await _makeTestDirs('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/chat-b.md`, '# B');
          await Deno.writeTextFile(`${dir}/chat-a.md`, '# A');

          const result = await findMdFiles(tempDir, 'claude');

          assertEquals(result[0].endsWith('chat-a.md'), true);
          assertEquals(result[1].endsWith('chat-b.md'), true);
        });
      });
    });
  });

  // ─── T-PF-FM-02: period 指定 → YYYY/YYYY-MM 構造優先 ────────────────────────

  describe('Given: 2026-03 と 2026-04 に各 1 件', () => {
    describe('When: findMdFiles(tempDir, "claude", "2026-03") を呼び出す', () => {
      describe('Then: T-PF-FM-02 - 2026-03 のファイルのみ返される', () => {
        it('T-PF-FM-02-01: 1 件のみ返される', async () => {
          const dir03 = await _makeTestDirs('claude', '2026-03');
          const dir04 = await _makeTestDirs('claude', '2026-04');
          await Deno.writeTextFile(`${dir03}/chat.md`, '# March');
          await Deno.writeTextFile(`${dir04}/chat.md`, '# April');

          const result = await findMdFiles(tempDir, 'claude', '2026-03');

          assertEquals(result.length, 1);
          assertEquals(result[0].includes('2026-03'), true);
        });
      });
    });
  });

  // ─── T-PF-FM-03: period 指定 — フラット構造フォールバック ────────────────────

  describe('Given: YYYY/YYYY-MM 構造がなく tempDir/claude/2026-03/ のフラット構造', () => {
    describe('When: findMdFiles(tempDir, "claude", "2026-03") を呼び出す', () => {
      describe('Then: T-PF-FM-03 - フラット構造からも .md が返される', () => {
        it('T-PF-FM-03-01: フラット構造でも .md ファイルが返される', async () => {
          const flatDir = `${tempDir}/claude/2026-03`;
          await Deno.mkdir(flatDir, { recursive: true });
          await Deno.writeTextFile(`${flatDir}/chat.md`, '# Flat');

          const result = await findMdFiles(tempDir, 'claude', '2026-03');

          assertEquals(result.length, 1);
        });
      });
    });
  });

  // ─── T-PF-FM-04: period 未指定 → agent 配下を全件収集 ───────────────────────

  describe('Given: 2026-03 と 2026-04 に各 1 件（period 指定なし）', () => {
    describe('When: findMdFiles(tempDir, "claude") を呼び出す', () => {
      describe('Then: T-PF-FM-04 - 2 件全て返される', () => {
        it('T-PF-FM-04-01: 2 件全て返される', async () => {
          const dir03 = await _makeTestDirs('claude', '2026-03');
          const dir04 = await _makeTestDirs('claude', '2026-04');
          await Deno.writeTextFile(`${dir03}/chat.md`, '# March');
          await Deno.writeTextFile(`${dir04}/chat.md`, '# April');

          const result = await findMdFiles(tempDir, 'claude');

          assertEquals(result.length, 2);
        });
      });
    });
  });

  // ─── T-PF-FM-05: 存在しない agent ディレクトリ → 空配列 ─────────────────────

  describe('Given: tempDir/claude/ が存在しない', () => {
    describe('When: findMdFiles(tempDir, "claude") を呼び出す', () => {
      describe('Then: T-PF-FM-05 - 空配列が返される（エラーなし）', () => {
        it('T-PF-FM-05-01: 空配列が返される', async () => {
          const result = await findMdFiles(tempDir, 'claude');

          assertEquals(result.length, 0);
        });
      });
    });
  });

  // ─── T-PF-FM-06: .md 以外のファイルは除外 ────────────────────────────────────

  describe('Given: .md 1 件と .txt 1 件が混在', () => {
    describe('When: findMdFiles(tempDir, "claude") を呼び出す', () => {
      describe('Then: T-PF-FM-06 - .md のみ返される', () => {
        it('T-PF-FM-06-01: 1 件のみ（.md のみ）返される', async () => {
          const dir = await _makeTestDirs('claude', '2026-03');
          await Deno.writeTextFile(`${dir}/chat.md`, '# MD');
          await Deno.writeTextFile(`${dir}/note.txt`, 'text');

          const result = await findMdFiles(tempDir, 'claude');

          assertEquals(result.length, 1);
          assertEquals(result[0].endsWith('.md'), true);
        });
      });
    });
  });

  // ─── T-PF-FM-07: agent 指定 → 別 agent のファイルは除外 ─────────────────────

  describe('Given: tempDir/claude/ と tempDir/codex/ に各 1 件', () => {
    describe('When: findMdFiles(tempDir, "claude") を呼び出す', () => {
      describe('Then: T-PF-FM-07 - claude 配下の 1 件のみ返される', () => {
        it('T-PF-FM-07-01: claude 配下の 1 件のみが返される', async () => {
          const claudeDir = await _makeTestDirs('claude', '2026-03');
          const codexDir = await _makeTestDirs('codex', '2026-03');
          await Deno.writeTextFile(`${claudeDir}/claude-chat.md`, '# Claude');
          await Deno.writeTextFile(`${codexDir}/codex-chat.md`, '# Codex');

          const result = await findMdFiles(tempDir, 'claude');

          assertEquals(result.length, 1);
          assertEquals(result[0].includes('claude'), true);
        });
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyFile
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyFile', () => {
  // ─── T-PF-CL-01: ファイル名パターン一致 → isNoise=true ──────────────────────

  describe('Given: "say-ok-and-nothing-else.md" と有効な内容テキスト', () => {
    describe('When: classifyFile(filename, text) を呼び出す', () => {
      describe('Then: T-PF-CL-01 - isNoise=true が返される', () => {
        it('T-PF-CL-01-01: isNoise が true になる', () => {
          const { isNoise } = classifyFile('say-ok-and-nothing-else.md', _makeValidContent());

          assertEquals(isNoise, true);
        });

        it('T-PF-CL-01-02: reason に "ファイル名パターン:" が含まれる', () => {
          const { reason } = classifyFile('say-ok-and-nothing-else.md', _makeValidContent());

          assertEquals(reason.includes('ファイル名パターン:'), true);
        });
      });
    });
  });

  // ─── T-PF-CL-02: 通常ファイル名 + User がシステムタグのみ → isNoise=true ─────

  describe('Given: 通常ファイル名 + <system-reminder> のみの User ターン', () => {
    describe('When: classifyFile(filename, text) を呼び出す', () => {
      describe('Then: T-PF-CL-02 - isNoise=true が返される', () => {
        it('T-PF-CL-02-01: isNoise が true になる', () => {
          const text = '### User\n<system-reminder>システムメッセージ</system-reminder>\n\n### Assistant\n'
            + 'a'.repeat(200) + '\n';
          const { isNoise } = classifyFile('normal-file.md', text);

          assertEquals(isNoise, true);
        });
      });
    });
  });

  // ─── T-PF-CL-03: 通常ファイル名 + User 正常 + Assistant 短い → isNoise=true ─

  describe('Given: 通常ファイル名 + 1 件 User ターン + 30 文字の Assistant ターン', () => {
    describe('When: classifyFile(filename, text) を呼び出す', () => {
      describe('Then: T-PF-CL-03 - isNoise=true が返される', () => {
        it('T-PF-CL-03-01: isNoise が true になる', () => {
          const text = '### User\n' + 'u'.repeat(200) + '\n\n### Assistant\n短い\n';
          const { isNoise } = classifyFile('normal-file.md', text);

          assertEquals(isNoise, true);
        });

        it('T-PF-CL-03-02: reason に "短すぎる" が含まれる', () => {
          const text = '### User\n' + 'u'.repeat(200) + '\n\n### Assistant\n短い\n';
          const { reason } = classifyFile('normal-file.md', text);

          assertEquals(reason.includes('短すぎる'), true);
        });
      });
    });
  });

  // ─── T-PF-CL-04: 全て正常 → isNoise=false ──────────────────────────────────

  describe('Given: 通常ファイル名 + 十分な User/Assistant ターン', () => {
    describe('When: classifyFile(filename, text) を呼び出す', () => {
      describe('Then: T-PF-CL-04 - isNoise=false が返される', () => {
        it('T-PF-CL-04-01: isNoise が false になる', () => {
          const { isNoise } = classifyFile('valid-chat.md', _makeValidContent());

          assertEquals(isNoise, false);
        });

        it('T-PF-CL-04-02: reason が空文字列になる', () => {
          const { reason } = classifyFile('valid-chat.md', _makeValidContent());

          assertEquals(reason, '');
        });
      });
    });
  });

  // ─── T-PF-CL-05: frontmatter 付き正常ファイル → isNoise=false ───────────────

  describe('Given: frontmatter の title に /export-log が含まれるが body は正常な会話', () => {
    describe('When: classifyFile(filename, text) を呼び出す', () => {
      describe('Then: T-PF-CL-05 - isNoise=false が返される（frontmatter は会話解析対象外）', () => {
        it('T-PF-CL-05-01: isNoise が false になる', () => {
          const { isNoise } = classifyFile('valid-chat.md', _makeValidContent());

          assertEquals(isNoise, false);
        });
      });
    });
  });

  // ─── T-PF-CL-06: ファイル名パターン一致 → checkUserContent まで到達しない ────

  describe('Given: ファイル名が除外パターン一致 かつ User がシステムタグのみ', () => {
    describe('When: classifyFile(filename, text) を呼び出す', () => {
      describe('Then: T-PF-CL-06 - reason が "ファイル名パターン:" のみを含む', () => {
        it('T-PF-CL-06-01: reason が "ファイル名パターン:" を含む（checkUserContent の reason ではない）', () => {
          const text = '### User\n<system-reminder>msg</system-reminder>\n\n### Assistant\n'
            + 'a'.repeat(200) + '\n';
          const { reason } = classifyFile('say-ok-and-nothing-else.md', text);

          assertEquals(reason.includes('ファイル名パターン:'), true);
        });
      });
    });
  });
});
