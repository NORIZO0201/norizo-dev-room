# Steel Self-host（VPS内部限定）

## 誰が使うのか

**VPS上で動くWorkerだけ**が使います。VercelのDEV ROOMからは使いません。

```
[VPS内]  OMNW Worker ──→ http://127.0.0.1:3000  ──→ Steel ──→ Chromium
[Vercel] DEV ROOM    ──→ Steel Cloud（従来どおり）
```

## Worker 側の環境変数

VPS上のWorkerには次を設定します（`api/providers/steel.mjs` が読みます）。

```
BROWSER_PROVIDER=steel-selfhost
STEEL_SELFHOST_API_BASE=http://127.0.0.1:3000/v1
STEEL_SELFHOST_CDP_BASE=ws://127.0.0.1:9223
# STEEL_SELFHOST_API_KEY は内部限定運用では不要（空のままで可）
```

## Vercel 側は変更しません

VercelのDEV ROOMは `BROWSER_PROVIDER=steel-cloud` のままです。
`127.0.0.1` はVercelから見ると「Vercel自身」であって、VPSではありません。
DEV ROOM もSelf-hostへ寄せたくなった場合は、`docs/VPS_BUILD_PLAN.md` STAGE 4 の
選択肢C（Cloudflare Tunnel）を検討します。**ポートを直接開ける選択肢Bは取りません。**

## 動作確認

```bash
curl -fsS http://127.0.0.1:3000/v1/health     # VPS上で実行 → 応答あり
curl --max-time 5 http://<VPSのIP>:3000/v1/health   # 外部から実行 → タイムアウトが正しい
```

2つ目が応答してしまう場合は公開設定が誤っています。**直ちに停止して報告してください。**

## メモリが厳しい時

1. `STEEL_MAX_SESSIONS` を 3 → 2 に下げる
2. `SESSION_TIMEOUT` を短くして放置セッションを早く回収する
3. それでも駄目なら Steel を停止（Workerは待機状態になる）
