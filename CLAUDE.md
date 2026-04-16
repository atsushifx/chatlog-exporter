# CLAUDE.md — chatlog-exporter

## プロジェクト概要
AIエージェント（Claude, ChatGPT 等）のセッション履歴をエクスポート・分類・編集し、Obsidian へのインポート用に整備するツール群。
Claude Code スキルとして実装されており、`/export-chatlog` 等のコマンドで呼び出す。

## 技術スタック
- **言語**: TypeScript（Deno ランタイム）
- **パッケージ管理**: JSR（`@std/yaml`, `@std/assert`, `@std/testing`）
- **フォーマッタ**: dprint（行幅 120、インデント 2 スペース、LF）
- **Git hooks**: lefthook（commitlint / betterleaks / secretlint）
- **外部 CLI**: claude, codex

## 主要コマンド
```bash
# テスト
deno task test              # 全テスト
deno task test:unit         # ユニットテストのみ
deno task test:module unit <module>  # 特定モジュール

# フォーマット
dprint fmt --check          # チェック
dprint fmt                  # 自動修正

# 環境セットアップ
bash scripts/setup-dev-env.sh
```

## プロジェクト構造
```
skills/
├── _scripts/          # 共通実装（types/, constants/, libs/）
├── classify-chatlog/  # プロジェクト別分類
├── export-chatlog/    # ログエクスポート
├── filter-chatlog/    # ノイズフィルタ
├── normalize-chatlog/ # 形式正規化
└── set-frontmatter/   # メタデータ付与
assets/dics/           # 辞書ファイル（category, tags 等）
assets/prompts/        # AI プロンプト
```

## 禁止事項
- `main` への直接 push
- テストなしの新機能追加
- `any` 型の使用
- `_scripts/` 配下の型・定数を実装ファイルに直書き
- 依頼範囲を超えたリファクタリング・機能追加

## ルール・規約
@.claude/rules/coding-guidelines.md
@.claude/rules/workflow.md
