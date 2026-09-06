// src: scripts/__tests__/unit/filter/build-abort-skip-message.unit.spec.ts
// @(#): build-abort-skip-message.ts のユニットテスト
//       対象: buildAbortSkipMessage
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─── BDD modules
import { assertEquals, assertStringIncludes } from '@std/assert';
import { describe, it } from '@std/testing/bdd';

// ─── Test target
import { buildAbortSkipMessage } from '../../../modules/filter/build-abort-skip-message.ts';

// ─── Helpers
import { ChatlogError } from '../../../../../_cle-libs/classes/ChatlogError.class.ts';

// ─── Tests

/**
 * `buildAbortSkipMessage` のユニットテストスイート。
 *
 * `runChunked` の戻り値から中断理由を取り出し、未実行チャンクの警告文言に
 * 反映することを検証する。レートリミット以外の中断理由（設定不備・接続失敗等）が
 * 「レートリミット」と誤って報告されないことが本スイートの主眼。
 *
 * テスト ID 範囲: T-FL-BASM-01 〜 T-FL-BASM-05
 *
 * @see buildAbortSkipMessage
 */
describe('buildAbortSkipMessage', () => {
  describe('When: 正常系', () => {
    it('[Normal] T-FL-BASM-01: InvalidEndpoint で中断 → エンドポイント設定の不備を理由に報告する', () => {
      const chunkResults = [new ChatlogError('AiError', 'InvalidEndpoint')];

      const result = buildAbortSkipMessage(chunkResults, 2);

      assertStringIncludes(result, 'エンドポイント設定の不備のため');
      assertStringIncludes(result, '2 件');
      assertEquals(result.includes('レートリミット'), false);
    });

    it('[Normal] T-FL-BASM-02: RateLimit で中断 → 既存のレートリミット文言を維持する', () => {
      const chunkResults = [new ChatlogError('AiError', 'RateLimit')];

      const result = buildAbortSkipMessage(chunkResults, 2);

      assertEquals(result, 'レートリミットのため 2 件のチャンク未実行ファイルの実行を取りやめました（次回再判定対象）');
    });

    it('[Normal] T-FL-BASM-03: BackendUnavailable で中断 → 接続失敗を理由に報告する', () => {
      const chunkResults = [new ChatlogError('AiError', 'BackendUnavailable')];

      const result = buildAbortSkipMessage(chunkResults, 1);

      assertStringIncludes(result, 'AI バックエンドへの接続失敗のため');
    });
  });

  describe('When: エッジケース', () => {
    it('[Edge] T-FL-BASM-04: 中断側より前に続行側エラーが並ぶ → 続行側を理由に採らない', () => {
      const chunkResults = [
        new ChatlogError('InvalidFormat', 'JsonParse'),
        new ChatlogError('AiError', 'InvalidEndpoint'),
      ];

      const result = buildAbortSkipMessage(chunkResults, 1);

      assertStringIncludes(result, 'エンドポイント設定の不備のため');
    });

    it('[Edge] T-FL-BASM-05: 中断側エラーがない（穴のみ・undefined のみ） → 中立な既定文言を使う', () => {
      const chunkResults: (ChatlogError | undefined)[] = [undefined];
      // インデックス 1 は穴（未代入）のまま残す
      chunkResults[2] = undefined;

      const result = buildAbortSkipMessage(chunkResults, 3);

      assertStringIncludes(result, 'AI 実行の中断のため');
      assertEquals(result.includes('レートリミット'), false);
    });
  });
});
