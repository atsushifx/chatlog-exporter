// src: scripts/libs/__tests__/unit/backup.unit.spec.ts
// @(#): backupOldPath のユニットテスト
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { assertRejects } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

import { backupOldPath } from '../../../libs/backup.ts';

// ─────────────────────────────────────────────
// backupOldPath
// ─────────────────────────────────────────────

/**
 * `backupOldPath` のユニットテストスイート。
 *
 * Fake の listDir を使い、Deno ファイルシステムに依存せず
 * エラー処理ロジックをカバーする。
 *
 * @see backupOldPath
 */
describe('backupOldPath', () => {
  // ─── グループ05: バックアップスロット上限超過 ──────────────────────────────

  describe('Given: バックアップスロット 99 まで全て埋まっている', () => {
    describe('When: backupOldPath を呼ぶ', () => {
      describe('Then: T-LIB-B-05 - Error をスローする', () => {
        it('T-LIB-B-05-01: "too many backups" を含む Error がスローされる', async () => {
          // arrange
          const outputPath = '/fake/output.md';

          // フェイクの listDir: スロット 01〜99 が全て使用中を返す
          // deno-lint-ignore require-await
          const fakeListDir = async (_dir: string): Promise<string[]> => {
            return Array.from({ length: 99 }, (_, i) => `output.old-${String(i + 1).padStart(2, '0')}.md`);
          };

          // フェイクの stat: ファイルが存在するように見せる
          const origStat = Deno.stat;
          // deno-lint-ignore no-explicit-any
          (Deno as any).stat = (_path: string) => ({ isFile: true });

          try {
            // act & assert
            await assertRejects(
              () => backupOldPath(outputPath, fakeListDir),
              Error,
              'too many backups',
            );
          } finally {
            // deno-lint-ignore no-explicit-any
            (Deno as any).stat = origStat;
          }
        });
      });
    });
  });
});
