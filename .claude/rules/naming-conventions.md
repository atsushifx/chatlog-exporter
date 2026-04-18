# 命名規則

## 内部関数

export しないプライベートなヘルパー関数は `_` プレフィックスで始める。

```typescript
// Good
function _buildTimestamp(): string { ... }
function _sha256Hex(input: string): Promise<string> { ... }

// Bad
function buildTimestamp(): string { ... }
```

## モジュールスコープの非 export シンボル

モジュールスコープで `export` しない定数・変数は `_` プレフィックスで始める。

```typescript
// Good
const _SYSTEM_PROMPT = `...`;
const _VALID_MODELS = new Set([...]);

// Bad
const SYSTEM_PROMPT = `...`;
const VALID_MODELS = new Set([...]);
```

## 関数内ローカル変数

関数内の「主要変数」には `_` プレフィックスを付ける。

### 主要変数（`_` を付ける）

以下のいずれかに該当する変数：

- 構築して返す、または次の関数に渡す中間結果（`_lines`, `_results`, `_config`, `_parsed`）
- 宣言後 2 回以上参照される変数
- ドメイン概念を表す意味のある名前（`_agentDir`, `_slug`, `_systemPrompt`）
- AI/CLI 実行の入出力（`_cmd`, `_process`, `_writer`, `_output`, `_raw`）

```typescript
// Good
const _lines: string[] = [];
const _config: ExportConfig = { ...DEFAULT_EXPORT_CONFIG };
const _slug = textToSlug(session.meta.firstUserText);

// Bad
const lines: string[] = [];
const config: ExportConfig = { ...DEFAULT_EXPORT_CONFIG };
```

### 一時補助変数（`_` を付けない）

以下のいずれかに該当する変数：

- 慣習的な 1 文字変数（`i`, `e`, `m`, `t`, `r`, `p`）
- `for` ループカウンタ・`for...of` のイテレーション変数（`entry`, `line`, `arg`, `turn`, `segment`）
- 宣言直後 1〜2 行でのみ使う計算補助値（`start`, `end` 等）
- コールバック引数（`turns.filter((t) => ...)` の `t`）

注: TypeScript の「未使用引数を示す慣習」としての `_` プレフィックスとは用途が異なる。
本プロジェクトでは関数パラメータに `_` を付けない。

## クロージャー内の変数・関数

関数内に定義されたクロージャー関数（ネスト関数・アロー関数変数）には `_` プレフィックスを付ける。

```typescript
// Good
const _readFile = async (path: string): Promise<string> => { ... };
async function _worker() { ... }

// Bad
const readFile = async (path: string): Promise<string> => { ... };
async function worker() { ... }
```

## 関数型エイリアス

コールバック・テスト用インジェクタブル依存として定義する関数型は `Provider` サフィックスで終わらせる（`Fn` は使わない）。

```typescript
// Good
export type HashProvider = () => string;
export type ListDirProvider = (dir: string) => Promise<string[]>;

// Bad
export type HashFn = () => string;
export type ListDirFn = (dir: string) => Promise<string[]>;
```
