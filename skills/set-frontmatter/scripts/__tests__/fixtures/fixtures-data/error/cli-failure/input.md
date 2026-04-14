# Deno テストの実装

本日は Deno のテストフレームワーク @std/testing/bdd について検討した。
describe/it 形式で BDD スタイルのテストを書く方針。
TypeScript で型安全に実装できる点が優れている。

テスト実行は `deno task test` コマンドで行う。
各テストファイルは `__tests__/` ディレクトリ配下に配置する。
