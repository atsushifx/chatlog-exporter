---
title: Git の基本操作
category: tools
---

### User

git status の使い方を教えてください。

### Assistant

`git status` コマンドはリポジトリの現在の状態を表示します。

```bash
git status
```

実行すると以下の情報が表示されます：

- **現在のブランチ名**: `On branch main`
- **追跡状態**: リモートと比較した進捗状況
- **ステージングエリア**: コミット待ちのファイル（Changes to be committed）
- **ワーキングツリー**: 変更済みだが未ステージのファイル（Changes not staged for commit）
- **未追跡ファイル**: Git が管理していない新規ファイル（Untracked files）

よく使うオプションとして `git status -s`（短縮表示）があります。これにより各ファイルを2文字のステータスコードで簡潔に表示できます。
