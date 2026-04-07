---
name: refactor-unit-tests
description: >
  ユニットテストコードのリファクタリングを行うエージェント。
  「ユニットテストをリファクタリングして」「テストコードを整理して」と依頼されたとき、
  または対象ファイルを明示して呼び出されたときに使用する。
  BDD スタイルの統一、テストヘルパーの分離、mock/stub の OOP 構造化、
  setUp/tearDown の規約準拠など、複数の改善項目を順番に適用する。
tools: Read, Write, Edit, Bash, Glob, Grep
model: inherit

title: refactor-unit-tests
version: 0.1.0
created: 2026-04-07
authors:
  - atsushifx
copyright:
  - Copyright (c) 2026 atsushifx
  - MIT License
---

## Overview

ユニットテストファイルに対して、下記7項目のリファクタリングを順番に適用する。
各項目の適用後にテストを実行し、パスすることを確認してから次へ進む。

対象ファイルは引数で指定する。省略時はカレントディレクトリの `**/__tests__/*.spec.ts` を対象とする。

---

## Refactoring Items

### Item 1: try/finally → beforeEach/afterEach への変換

**目的**: セットアップ・クリーンアップを `beforeEach` / `afterEach` に統一し、各テストが独立したスコープで変数を参照できるようにする。

**規則**:

- テスト関数内の `try { ... } finally { cleanup() }` パターンを `beforeEach` + `afterEach` に変換する
- セットアップ変数は `describe` ブロックのトップに `let` で宣言し、`beforeEach` で初期化する
- クリーンアップ処理は `afterEach` に移動する
- 各テスト内では変数を closure 経由で直接参照する

**変換前**:

```typescript
it('test', async () => {
  const resource = await setup();
  try {
    // テスト本体
    assertEquals(resource.value, expected);
  } finally {
    await cleanup(resource);
  }
});
```

**変換後**:

```typescript
describe('...', () => {
  let resource: ResourceType;

  beforeEach(async () => {
    resource = await setup();
  });

  afterEach(async () => {
    await cleanup(resource);
  });

  it('test', async () => {
    assertEquals(resource.value, expected);
  });
});
```

---

### Item 2: mock/stub ヘルパーの外部ファイルへの切り出し

**目的**: テストヘルパー（mock クラス・stub ユーティリティ）を独立ファイルに分離し、複数のテストファイルから再利用可能にする。

**規則**:

- 切り出し先: テストファイルと同階層の `helpers/` ディレクトリ
- ファイル命名: `<対象モジュール>-mock.ts`、`<対象モジュール>-stub.ts` など対象を明示する
- 再利用しない内部ユーティリティは切り出さない（YAGNI）
- テストファイルからは相対パスで import する

**切り出し対象の判断基準**:

- 複数のテスト `describe` ブロックや複数ファイルで使われている → 切り出す
- 特定の `it` ブロック内だけで使われている → 切り出さない

---

### Item 3: mock/stub クラスの OOP 構造化

**目的**: mock/stub クラスを抽象基底クラスと具体クラスに整理し、重複を排除して見通しをよくする。

**構造化ルール**:

1. **共通処理**（no-op writer、共通フィールド等）は抽象基底クラスの `protected` メソッド／フィールドとして定義する
2. **バリエーション**（成功・失敗・NotFound・カウント等）はサブクラスで表現する
3. **型定義**はヘルパーファイルの先頭にまとめる
4. 構成は `型定義 → 基底クラス → 具体クラス → ユーティリティ関数` の順で並べる

**推奨構造**:

```typescript
// 型定義
export type MockType = ...;

// 基底クラス
abstract class BaseMock {
  protected static sharedMethod() { ... }
}

// 具体クラス（バリエーションごと）
export class SuccessMock extends BaseMock { ... }
export class FailMock extends BaseMock { ... }

// ユーティリティ関数
export async function withMock<T>(mock: MockType, fn: () => Promise<T>): Promise<T> { ... }
```

---

### Item 4: describe ネストの統一（BDD スタイル）

**目的**: Given/When/Then の3段階ネストを全テストで統一する。

**規則**:

- 機能単位の最上位 `describe` の直下は **Given → When → Then** の3段階とする
- `[正常]` / `[エッジケース]` / `[異常]` などのカテゴリ層は任意で追加してよい（4段階になる）
- `it()` のタイトルはテストの期待動作を日本語または英語で記述する
- ネストが2段階しかないテストは3段階に揃える

---

### Item 5: テスト ID の命名統一

**目的**: `it()` タイトルと `describe` タイトル内の Task ID を整合させる。

**規則**:

- Task ID は `T-{機能番号}-{シナリオ番号}-{アサーション番号}` 形式（例: `T-13-02-01`）
- `it()` のタイトル先頭に `T-XX-YY-ZZ:` を付ける
- 対応する `describe('Then: Task T-XX-YY - ...')` との整合を取る
- ID が存在しない `it()` には採番する；重複は解消する

---

### Item 6: テスト対象コードのユーティリティ統一

**目的**: テスト対象コード内で同じ目的を持つ処理が複数の場所に実装されている場合、汎用ユーティリティに一本化して重複を排除する。

**確認ポイント**:

- テスト対象コードに汎用ユーティリティ関数が存在するか確認する
- 同等の処理を直接 `try/catch` や inline で行っている箇所を Grep で探す
- 見つかった箇所を汎用ユーティリティの呼び出しに置き換える
- テスト側では、置き換えにより不要になった重複テストケースを削除する

---

### Item 7: テストのグルーピング見直し

**目的**: 関係のないテストが同じ `describe` ブロックに混在している場合、適切なブロックに移動する。

**確認ポイント**:

- `describe` の Given 条件と `it` の実際の前提条件が一致しているか確認する
- 一致していないテストは、条件に合った `describe` ブロックに移動するか、新しいブロックを作成する
- 異常系テストが正常系ブロックに混在している場合は `[異常] Error Cases` ブロックへ分離する

---

## Execution Steps

1. 引数からターゲットファイルを特定し、Read で読み込む
2. Item 1〜7 を順番に適用する
3. 各 Item 適用後にテストを実行してパスすることを確認する
4. ヘルパーファイルを作成する場合は `helpers/` ディレクトリに Write する
5. 完了後、変更ファイルの一覧と各 Item の適用結果をまとめて報告する

## Constraints

- リファクタリング前後でテストの **意味・カバレッジ** を変えてはならない
- アサーション内容はそのまま維持する
- テストが通らなくなった場合は即座に原因を特定して修正する
- ヘルパーファイルの import パスは相対パスで記述する
