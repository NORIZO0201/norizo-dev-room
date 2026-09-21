# Worker 運用の約束ごと

これは **雛形（テンプレート）** です。`<>` の箇所を実際の値に置き換えてから配置します。

## Claude Code と Worker の役割分担

```
Claude Code = Workerを「作る・直す・改善する」担当
Worker      = 実際に「働き続ける」担当
```

Claude Code が動いていなくても、Worker は動き続けなければなりません。
**Claude Code 自身を常駐クローラーにしないでください。**（設計書4章）

## 収集先を守るための必須ルール（設計書13章）

| ルール | systemd 側の担保 | Worker 実装側の責任 |
|---|---|---|
| ブロックされたら自動回避せず停止 | `RestartPreventExitStatus=75` | **終了コード 75 で終了する** |
| 暴走を止める | `StartLimitBurst=3` / 10分 | 失敗時にバックオフ |
| VPS全体を巻き込まない | `MemoryMax` / `CPUQuota` | — |
| 収集先に同時刻集中しない | `RandomizedDelaySec` | 低並列・適切な間隔 |
| 何度流しても壊れない | — | **冪等に作る**・チェックポイント再開 |
| 取得元を必ず残す | — | provenance を記録 |

### 終了コード 75 の意味

403 / CAPTCHA / 不審なブロックを検知したら、Worker は **終了コード 75** で終了してください。
systemd は再起動せず停止し、NORIZO の判断を待ちます。

> CAPTCHA の自動回避は行いません。これは設計方針であり、例外を作りません。

## 秘密情報の置き場所

`EnvironmentFile=/etc/norizo/<名前>.env` から読みます。

```bash
sudo install -d -m 700 /etc/norizo
sudo install -m 600 /dev/null /etc/norizo/omnw-worker.env
sudo nano /etc/norizo/omnw-worker.env   # ← ここに Supabase キー等を書く
```

- **`.service` ファイルに直接書かない**（`systemctl cat` で誰でも読めてしまう）
- **リポジトリにコミットしない**
- 権限は `600`、所有者は root

## 状態確認によく使うコマンド

```bash
systemctl status omnw-worker            # 今動いているか
journalctl -u omnw-worker -f            # ログを流し見
journalctl -u omnw-worker --since today # 今日のログ
systemctl list-timers                   # 次はいつ走るか
```
