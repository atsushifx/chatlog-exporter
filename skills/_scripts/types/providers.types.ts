// src: skills/_scripts/types/providers.types.ts
// @(#): テスト用依存性注入 Provider 型定義
//
// Copyright (c) 2026- atsushifx <https://github.com/atsushifx>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

// ─────────────────────────────────────────────
// 環境変数系
// ─────────────────────────────────────────────

/** 環境変数を取得する関数の型。テスト用インジェクションに利用する。 */
export type EnvProvider = (name: string) => string | undefined;

// ─────────────────────────────────────────────
// ファイルシステム系
// ─────────────────────────────────────────────

/** ディレクトリ内のファイル名一覧を返す関数の型。テスト用インジェクションに利用する。 */
export type ListDirProvider = (dir: string) => Promise<string[]>;

/** glob パターンでファイルパス一覧を返す関数の型。テスト用インジェクションに利用する。 */
export type GlobProvider = (pattern: string) => Promise<string[]>;

// ─────────────────────────────────────────────
// ハッシュ生成系
// ─────────────────────────────────────────────

/**
 * 短い16進数ハッシュ文字列を生成する関数の型。
 * テスト時のインジェクタブルな依存として利用する。
 */
export type HashProvider = () => string;
