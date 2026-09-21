# deploy/ — VPS へ配置する設定ファイル

`docs/VPS_BUILD_PLAN.md` の STAGE 4〜6 で使います。
**ここにあるのは雛形です。そのまま本番投入せず、値を埋めてから配置してください。**

| パス | STAGE | 内容 |
|---|---|---|
| `steel/docker-compose.yml` | 4 | Steel Self-host（**127.0.0.1 限定**） |
| `steel/.env.example` | 4 | 同時ブラウザ数などの設定例 |
| `workers/omnw-worker.service.template` | 5 | OMNW 常駐Worker（systemd） |
| `workers/observation-node.service.template` | 6 | Observation Node（1回実行） |
| `workers/observation-node.timer.template` | 6 | Observation Node の定期実行 |

## 共通の約束

1. **秘密情報はこのディレクトリに書かない。** `/etc/norizo/*.env`（権限600・root所有）に置きます
2. **ポートは 127.0.0.1 に限定する。** 外部公開が必要になったら必ず事前報告
3. **`latest` タグで本番運用しない。** バージョンを固定してから配置
4. **1段階ずつ確認する。** STAGE 4 が安定してから STAGE 5 へ

## 配置前チェックリスト

- [ ] `<>` の箇所をすべて実際の値に置き換えた
- [ ] Dockerイメージのタグを固定した
- [ ] `/etc/norizo/*.env` を権限600で作成した
- [ ] メモリ上限が `docs/VPS_BUILD_PLAN.md` 2章の配分と一致している
- [ ] 外部から `curl http://<VPSのIP>:3000` が**タイムアウトする**ことを確認した
