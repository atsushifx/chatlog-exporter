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
