# プロジェクト対応表（混線防止の正本）

Updated: 2026-09-21 JST

## このファイルの目的

**プロジェクトを取り違えないための唯一の参照先です。**

Claude Code は作業を始める前に必ずこの表を確認し、
「どのリポジトリを触るのか」「どこにデプロイされるのか」を **NORIZO に宣言してから** 作業を開始します。

---

## 対応表

| プロジェクト | GitHubリポジトリ | Vercelプロジェクト | 本番ドメイン | 公開 |
|---|---|---|---|---|
| **日本ワイン.jp** | `NORIZO0201/nihonwine-rebuild` | `nihonwine-rebuild` | `nihonwine.jp` | private |
| **Craft Nihon Wine** | `NORIZO0201/craft-nihon-wine` | `craft-nihon-wine` | `craft-nihon-wine.jp` | private |
| **日本チーズ.jp** | `NORIZO0201/nihoncheese-jp` | `nihoncheese-jp` | `nihoncheese.jp` | private |
| **SAYAKA KITCHEN** | `NORIZO0201/sayaka-kitchen` | `sayaka-kitchen` | `sayaka-kitchen.com` | private |
| **OMNW**<br>(Oh My Nihon Wine) | `NORIZO0201/oh-my-nihon-wine` | `oh-my-nihon-wine` | `oh-my-nihon-wine.jp` | private |
| **DIS** | `NORIZO0201/nihon-wine-dis` | `nihon-wine-dis` | 要確認 | private |
| **CWS**（テーマ） | `NORIZO0201/cws-shopify-theme` | （Shopifyテーマ/Vercel無し） | Shopifyストア | private |
| **CWS**（注文フォーム） | `NORIZO0201/cws-order-form` | `cws-order-form` | 要確認 | private |
| **CWS**（監査） | 要確認 | `cws-shopify-audit` | 要確認 | — |
| **LOCAL ENGINE** | `NORIZO0201/local-engine` | （Vercelプロジェクト無し） | 要確認 | private |
| **CSLS** | **要確認**（下記参照） | 要確認 | 要確認 | — |
| **DEV ROOM**（開発基盤） | `NORIZO0201/norizo-dev-room` | `norizo-dev-room` | （Vercel既定URL） | **public** |

### 対応が未確定のリポジトリ / プロジェクト

以下は、どのプロジェクトに属するか **推測で決めずに保留** しています。NORIZO の確認が必要です。

| 項目 | 状況 |
|---|---|
| `NORIZO0201/vdor-2027` | Vercelに `vdor-2027` あり。どのプロジェクト区分か要確認 |
| `NORIZO0201/matsue-shinjiko-onsen-analytics` | Vercelプロジェクト無し。CSLS に該当するか要確認 |
| `matsue-ppt-download-test`（Vercel） | 対応するGitHubリポジトリ不明。テスト用なら削除候補（要確認） |
| **CSLS** | 対応するリポジトリが特定できず。正式名称と実体を教えてください |

---

## ⚠️ 特記事項：`norizo-dev-room` は public です

このリポジトリだけが **公開（public）** です。
インターネット上の誰でも中身を読めます。

**したがって、このリポジトリには以下を絶対に書かないでください。**

- ConoHa VPS の IPアドレス
- APIキー・パスワード・トークン
- 顧客情報・売上などの事業データ
- 他プロジェクトの内部URL

> private 化を検討する場合は、NORIZO の判断が必要です（Vercel連携の再設定が発生します）。

---

## 混線を防ぐ仕組み（運用ルール）

### 1. 作業開始前の宣言（必須）

Claude Code は作業前に必ずこう宣言します。

> 「**日本ワイン.jp**（`nihonwine-rebuild`）を対象に作業します。デプロイ先は Vercel `nihonwine-rebuild` / `nihonwine.jp` です。これで合っていますか？」

NORIZO が違うと言ったら、作業を開始しません。

### 2. 1セッション = 1プロジェクト

**1つの会話で複数プロジェクトを同時に触らない。**
別プロジェクトの作業は、新しいセッションを立ち上げて行います。

### 3. 環境変数を流用しない

プロジェクト間で環境変数・DB接続先・APIキーを使い回さない。
それぞれの Vercel プロジェクトの環境変数に、そのプロジェクト専用の値を設定します。

### 4. 略称は必ずこの表で正式名に変換する

「OMNW」「DIS」「CWS」などの略称が出たら、**推測せずこの表を引く**。
表に無い略称が出たら、**NORIZO に確認する**。

---

## この表の更新ルール

- 新しいプロジェクト・リポジトリ・ドメインが増えたら、**その場でこの表に追記する**
- 「要確認」の項目が判明したら、その場で埋める
- この表と実態がずれていたら、**実態ではなくこの表を先に直す**
