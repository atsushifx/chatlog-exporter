# コーディング規約

## 基本方針
- 正しさ > 速さ：動くコードより正しいコードを優先する
- 最小変更：依頼された範囲のみ変更し、不要なリファクタや改善を加えない
- 推測せず確認：既存コードを読んでから提案・変更する

## TypeScript
- `strict` モードを前提とする
- 型は明示的に書く（`any` 禁止）
- インポート/エクスポートは明示的に行う（`export *` 乱用禁止）

## テスト
- 新機能には必ずユニットテストを追加する
- テストは `skills/<module>/__tests__/` 配下に配置する
- テストファイル名: `<name>.<type>.spec.ts`（例: `backup.unit.spec.ts`）

@.claude/rules/naming-conventions.md
@.claude/rules/directory-structure.md
