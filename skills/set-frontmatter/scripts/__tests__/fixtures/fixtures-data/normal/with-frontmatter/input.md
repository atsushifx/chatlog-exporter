---
session_id: sess-001
date: 2026-03-15
project: chatlog-exporter
slug: deno-testing-design
---

# Deno テストフレームワーク設計

テストフレームワークの設計を行った。
BDD スタイルの describe/it 構文を採用する方針を決定した。
@std/testing/bdd モジュールを使用して、Given-When-Then 形式のテストを記述する。

テストファイルの命名規則は `<target>.<subject>.<type>.spec.ts` とする。
