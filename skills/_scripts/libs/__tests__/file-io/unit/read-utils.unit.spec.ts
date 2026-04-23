// src: skills/_scripts/libs/__tests__/file-io/unit/read-utils.unit.spec.ts
// @(#): readTextFile ユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// -- BDD modules --
import { assertEquals, assertRejects } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// -- test target --
import { readTextFile } from '../../../file-io/read-utils.ts';

// ─────────────────────────────────────────────
// readTextFile
// ─────────────────────────────────────────────

describe('readTextFile', () => {
  describe('Given: LF 改行のテキストファイルが存在する', () => {
    describe('When: readTextFile を実行する', () => {
      describe('Then: T-LIB-U-RF-01 - LF 正規化した文字列が返る', () => {
        it('T-LIB-U-RF-01: 存在するファイルを読み込み LF 正規化した文字列を返す', async () => {
          const _tmpPath = await Deno.makeTempFile({ prefix: 'utils-test-rf01-' });
          try {
            const _content = 'line1\nline2\nline3';
            await Deno.writeTextFile(_tmpPath, _content);
            const _result = await readTextFile(_tmpPath);
            assertEquals(_result, _content);
          } finally {
            await Deno.remove(_tmpPath);
          }
        });
      });
    });
  });

  describe('Given: CRLF 改行のテキストファイルが存在する', () => {
    describe('When: readTextFile を実行する', () => {
      describe('Then: T-LIB-U-RF-02 - CRLF が LF に正規化された文字列が返る', () => {
        it('T-LIB-U-RF-02: CRLF ファイルを読み込むと LF に正規化される', async () => {
          const _tmpPath = await Deno.makeTempFile({ prefix: 'utils-test-rf02-' });
          try {
            await Deno.writeTextFile(_tmpPath, 'line1\r\nline2\r\nline3');
            const _result = await readTextFile(_tmpPath);
            assertEquals(_result, 'line1\nline2\nline3');
          } finally {
            await Deno.remove(_tmpPath);
          }
        });
      });
    });
  });

  describe('Given: 存在しないファイルパスを渡す', () => {
    describe('When: readTextFile を実行する', () => {
      describe('Then: T-LIB-U-RF-03 - Deno.errors.NotFound がスローされる', () => {
        it('T-LIB-U-RF-03: 存在しないファイルパスを渡すと Deno.errors.NotFound がスローされる', async () => {
          const _tmpPath = await Deno.makeTempFile({ prefix: 'utils-test-rf03-' });
          await Deno.remove(_tmpPath);
          await assertRejects(
            () => readTextFile(_tmpPath),
            Deno.errors.NotFound,
          );
        });
      });
    });
  });
});
