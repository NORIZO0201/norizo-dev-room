# NORIZO AI WORK FACTORY / VPS 構築計画

Updated: 2026-09-21 JST
対象: ConoHa VPS 3.0（Ubuntu 24.04 LTS / 6 vCPU / 12 GB RAM / SSD 100 GB）
関連: `docs/DEV_ROOM_ARCHITECTURE.md`（設計の正本） / `docs/OPERATIONS_ARCHITECTURE.md`（運用ルール）

---

## 0. このVPSの位置づけ

```
GitHub    = コードの正本
Supabase  = データ・状態の正本
ConoHa VPS = 24時間稼働する実行工場（AI WORK FACTORY）
Vercel    = 本番Webの配信
```

**このVPSは本番Webを配信しません。** 本番Webは全てVercel上にあります。
VPSが落ちてもお客様向けサイトは止まりません。この切り分けを崩さないでください。

---

## 1. Claude Code を VPS に入れる判断を更新します

前回、私は「現時点では入れない」と推奨しました。
その理由は **「今すぐ入れないと困ることが無い」** という前提でした。

今回「このVPSを AI WORK FACTORY として使う」と明示されたことで、
`DEV_ROOM_ARCHITECTURE.md` の以下の方針が現実の要件になりました。

> Move long-running and heavy resident jobs out of ChatGPT / local interactive sessions.
> Claude Code builds, repairs and improves the workers.

**→ 前提が変わったので、推奨を「入れる」に変更します。**

ただし、次の3つの歯止めを必ず守ります。

| 歯止め | 内容 | 理由 |
|---|---|---|
| **DEV専用を維持** | このVPSで本番Webを配信しない | VPS障害が売上に直結しない状態を保つ |
| **root で動かさない** | 専用の作業ユーザー（例: `norizo`）で実行 | 事故時の被害範囲を限定 |
| **Claude Code は「作る人」、Workerが「働く人」** | 常駐処理はsystemd/Dockerのワーカーが担当。Claude Codeは開発・修理担当 | Claude Codeが止まっても収集・処理が続く |

---

## 2. リソース配分（12 GB RAM / 6 vCPU の割り当て設計）

Chromium は1インスタンスあたり 0.5〜1 GB を消費します。無計画に動かすとメモリ不足でVPSごと不安定になるため、先に上限を決めます。

| 用途 | RAM | vCPU | 備考 |
|---|---|---|---|
| OS + Docker基盤 | 2 GB | 1 | |
| Steel Self-host（ブラウザ） | 4 GB | 2 | **同時ブラウザ数 最大3** に制限 |
| OMNW 常駐Worker | 3 GB | 1.5 | 低並列・礼儀正しい収集 |
| Observation Node | 2 GB | 1 | 定期バッチ |
| 予備（ビルド・Claude Code作業用） | 1 GB | 0.5 | |
| **合計** | **12 GB** | **6** | |

**swap を 4 GB 作成します。** 瞬間的なメモリ超過でプロセスが強制終了されるのを防ぐためです。

---

## 3. 構築ステージ（6段階・各段階で承認）

一度に全部作りません。**1段階ずつ動作確認してから次へ進みます。**

### STAGE 1 — 基盤（OS・ユーザー・Docker・Node）

| 作業 | 承認 |
|---|---|
| 作業ユーザー `norizo` 作成 + SSH公開鍵配置 | 報告 |
| `apt update && apt upgrade` | 報告 |
| 基本パッケージ（git / tmux / jq / ripgrep / build-essential / python3） | 報告 |
| Docker Engine + Docker Compose | 報告 |
| Node.js LTS + pnpm | 報告 |
| swap 4 GB 作成 | **要承認**（ディスク変更） |
| fail2ban 導入 | **要承認** |
| UFW 有効化（22番のみ許可） | **要承認**（ファイアウォール変更） |
| 再起動 | **要承認** |

→ スクリプト: `scripts/vps-bootstrap.sh`（既定は確認のみ。`--apply` で実行）

### STAGE 2 — GitHub 直結

VPS から GitHub のコードを取得できるようにします。

**方式：リポジトリ単位の Deploy Key（推奨）**

| 方式 | 長所 | 短所 | 採否 |
|---|---|---|---|
| **Deploy Key（リポジトリ単位）** | 1つ漏れても**そのリポジトリだけ**に被害限定。既定は読み取り専用 | リポジトリごとに登録が必要 | **✅ 採用** |
| Personal Access Token | 登録1回で済む | 漏れると**全リポジトリ**が危険。権限が広すぎる | ❌ |
| NORIZO個人のSSH鍵をコピー | 手軽 | **個人の鍵をサーバーに置く＝最悪の選択** | ❌ 禁止 |

**書き込み権限は、VPSが実際にpushするリポジトリにだけ付けます。** 既定は読み取り専用です。

| 作業 | 承認 |
|---|---|
| VPS上で Deploy Key を生成（リポジトリごと） | 報告 |
| GitHub側に公開鍵を登録 | **要承認**（外部サービス設定変更） |
| `git clone` 疎通テスト | 不要（読み取り） |

### STAGE 3 — Claude Code

| 作業 | 承認 |
|---|---|
| Claude Code インストール（`norizo` ユーザーとして） | 報告 |
| 認証（ブラウザ認証が必要。NORIZOが実施） | NORIZO操作 |
| `.mcp.json` の承認（conoha-vps-mcp） | NORIZO操作 |

### STAGE 4 — Steel Self-host

**重要な設計判断：Steel は外部公開しません。**

| 方式 | 内容 | 判定 |
|---|---|---|
| **A. 127.0.0.1 限定（内部のみ）** | VPS上のWorkerだけがSteelを使う。**ポート開放・TLS・認証が一切不要** | **✅ 採用** |
| B. 公開HTTPS + APIキー | Vercel上のDEV ROOMからも使える | ⏸ 保留。ブラウザ自動操作を世界に公開することになる |
| C. Cloudflare Tunnel | ポートを開けずに外部公開 | ⏸ Bが必要になった時の第一候補 |

**なぜ A か：** Steelを一番使うのはVPS上のWorkerです。Workerから使う限りポートを開ける必要がありません。
ファイアウォールを触らず、TLS証明書も要らず、追加費用もゼロで始められます。

> Vercel上のDEV ROOMは当面 `BROWSER_PROVIDER=steel-cloud` のままにします。
> DEV ROOM自体をSelf-hostに切り替えたくなった時点で、C（Cloudflare Tunnel）を検討します。

| 作業 | 承認 |
|---|---|
| `deploy/steel/docker-compose.yml` で起動 | 報告 |
| ポート開放 | **やりません**（127.0.0.1のみ） |

### STAGE 5 — OMNW 常駐Worker

`DEV_ROOM_ARCHITECTURE.md` の Priority A（CruX work offload）が対象です。

対象処理：OMNW Discovery / Recognition / Master / M0→M5 / 重複排除 / 公式ソース検証 など。

**Workerの原則（設計書 13章より）**

- 低並列・適切な間隔・バックオフ（収集先サイトを守る）
- API / RSS / sitemap / 構造化データ を優先し、ブラウザ操作は最後の手段
- robots.txt と利用規約を尊重。CAPTCHA回避は行わない
- 403 / CAPTCHA / ブロックを検知したら**停止して人間の確認を待つ**
- 全観測に取得元（provenance）を記録
- 冪等（同じ処理を2回流しても壊れない）・チェックポイント再開可能

| 作業 | 承認 |
|---|---|
| systemd ユニット雛形の配置 | 報告 |
| 実処理の実装 | **要確認**（下記「確認事項」参照） |
| Supabase 接続情報の設定 | **要承認**（本番データに触れるため） |

### STAGE 6 — LOCAL ENGINE Observation Node

設計書5章の観測レーン（JAPAN WINE / TOURISM / LOCAL COMMERCE / FOOD・FISHERIES / RETAIL）を、
定期バッチとして動かします。

データ原則（設計書12章）：
```
Entity → Observation → Change → Relationship → Confidence → Intelligence
```
**同じ対象を何ヶ月・何年も繰り返し観測すること**が価値であり、一度に大量取得することではありません。

| 作業 | 承認 |
|---|---|
| systemd timer 雛形の配置 | 報告 |
| 収集対象サイトの確定 | **要確認**（法務・倫理の判断を含む） |
| 本番データ投入 | **要承認** |

---

## 4. ポートとファイアウォール

| ポート | 用途 | 公開範囲 | 備考 |
|---|---|---|---|
| 22 | SSH | インターネット（要IP制限検討） | 唯一の外部公開 |
| 3000 | Steel API | **127.0.0.1 のみ** | 外部から到達不可 |
| 9222 | Steel CDP | **127.0.0.1 のみ** | 外部から到達不可 |

**この構成では、ファイアウォールに新しい穴を開けません。**

---

## 5. 障害時の復旧

| 症状 | 対処 |
|---|---|
| Workerが落ちた | systemd が自動再起動（`Restart=always`）。3回失敗したら停止し通知 |
| メモリ不足でVPSが重い | Steelの同時ブラウザ数を減らす → それでも駄目なら Steel を停止 |
| 収集先から403/CAPTCHA | **Workerを自動停止**し、NORIZOの判断を待つ（自動回避はしない） |
| ディスク満杯 | Dockerイメージ・ログを整理（削除前に内容確認・要承認） |
| VPSごと壊れた | ConoHaのスナップショットから復旧。**STAGE 1完了時点でスナップショットを取得**（要承認・課金の可能性あり） |

---

## 6. NORIZO に確認が必要な事項

勝手に決めず、確認させてください。

1. **STAGE 5 の OMNW Worker は、具体的にどの処理から動かしますか？**
   設計書には Discovery / Recognition / Master / M0→M5 と並んでいますが、
   最初の1つを決めていただければ、そこから作ります。

2. **Supabase の接続情報をVPSに置くことの可否**
   Workerがデータを書き込むには必須ですが、**本番データに触れる**ため確認が必要です。
   （書き込み権限を絞った専用キーを作ることを推奨します）

3. **Observation Node の収集対象サイト**
   どのサイトから観測を始めるか。利用規約の確認が必要なため、対象を確定させてください。

4. **ConoHaスナップショットの取得**
   STAGE 1完了時点で取得を推奨しますが、**ConoHaのプランによっては課金が発生**します。

5. **SSHのIP制限**
   22番をNORIZOの自宅/事務所IPだけに絞ると安全性が上がりますが、
   外出先から繋がらなくなります。固定IPがあるかどうか教えてください。

---

## 7. 実行できる人

| STAGE | 実行者 | この Web セッションから |
|---|---|---|
| STAGE 1〜6 の**実行** | Mac版 Claude Code（SSH経由） | ❌ 不可（SSHなし・ConoHa到達不可） |
| 計画・スクリプト・設定ファイルの**作成** | Web版（このセッション） | ✅ 実施済み |

Mac でこう言っていただければ、STAGE 1 から進みます。

> 「norizo-dev-room の docs/VPS_BUILD_PLAN.md を読んで、STAGE 1 を実行して」
