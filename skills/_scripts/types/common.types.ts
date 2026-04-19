// src: scripts/types/common.types.ts
// @(#): スクリプト共通型定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─────────────────────────────────────────────
// ファイルシステム系
// ─────────────────────────────────────────────

/** ディレクトリ内のファイル名一覧を返す関数の型。テスト用インジェクションに利用する。 */
export type ListDirProvider = (dir: string) => Promise<string[]>;

// ─────────────────────────────────────────────
// ハッシュ生成系
// ─────────────────────────────────────────────

/** `generateHash` のオプション引数。 */
export interface GenerateHashOptions {
  /** 返す16進数文字列の長さ。未指定時は `DEFAULT_HASH_LENGTH` を使用。 */
  length?: number;
  /** ランダム文字列の最大長。未指定時は `DEFAULT_MAX_RANDOM_LENGTH` を使用。 */
  maxRandomLength?: number;
}

/**
 * 短い16進数ハッシュ文字列を生成する関数の型。
 * テスト時のインジェクタブルな依存として利用する。
 */
export type HashProvider = () => string;

// ─────────────────────────────────────────────
// 並列処理系
// ─────────────────────────────────────────────

/** 非同期タスク関数の型。`withConcurrency` の入力として使用する。 */
export type Task<T> = () => Promise<T>;
