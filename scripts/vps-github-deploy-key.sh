#!/usr/bin/env bash
#
# STAGE 2: GitHub Deploy Key の作成（VPS 上で実行）
#
# リポジトリ1つにつき専用の鍵を1つ作ります。
# 1つ漏れても、そのリポジトリだけに被害が限定されます。
#
#   点検: bash scripts/vps-github-deploy-key.sh <リポジトリ名>
#   作成: bash scripts/vps-github-deploy-key.sh <リポジトリ名> --apply
#
#   例:   bash scripts/vps-github-deploy-key.sh oh-my-nihon-wine --apply
#
# このスクリプトは GitHub に対して一切の変更を行いません。
# 公開鍵を表示するだけで、登録は NORIZO の承認後に行います。

set -euo pipefail

REPO="${1:-}"
APPLY=0
[ "${2:-}" = "--apply" ] && APPLY=1

OWNER="NORIZO0201"
SSH_DIR="$HOME/.ssh"
KEY="$SSH_DIR/deploy_${REPO}_ed25519"
ALIAS="github-${REPO}"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
ng()   { printf '  \033[31m✗\033[0m %s\n' "$1"; }

if [ -z "$REPO" ]; then
  ng "リポジトリ名を指定してください"
  echo "  例: bash $0 oh-my-nihon-wine"
  echo
  echo "  利用可能（docs/PROJECT_REGISTRY.md 参照）:"
  echo "    nihonwine-rebuild / craft-nihon-wine / nihoncheese-jp / sayaka-kitchen"
  echo "    oh-my-nihon-wine / nihon-wine-dis / cws-shopify-theme / cws-order-form"
  echo "    local-engine / norizo-dev-room"
  exit 1
fi

echo
echo "=== STAGE 2: Deploy Key / ${OWNER}/${REPO} ==="
echo

mkdir -p "$SSH_DIR"; chmod 700 "$SSH_DIR"

if [ -f "$KEY" ]; then
  ok "鍵は作成済み: $(basename "$KEY")"
elif [ "$APPLY" != "1" ]; then
  warn "鍵は未作成です（点検モードのため作成しません）"
  echo
  echo "  作成するには: bash $0 $REPO --apply"
  exit 0
else
  # パスフレーズ無し = 自動化のため。鍵はこのVPS内にのみ存在する
  ssh-keygen -t ed25519 -N "" -C "deploy-${REPO}@conoha-vps" -f "$KEY" >/dev/null
  chmod 600 "$KEY"
  ok "鍵を作成: $(basename "$KEY")"
fi

# ~/.ssh/config に専用ホスト別名を追加（リポジトリごとに鍵を確実に使い分ける）
CONFIG="$SSH_DIR/config"
if [ -f "$CONFIG" ] && grep -qE "^[[:space:]]*Host[[:space:]]+${ALIAS}$" "$CONFIG"; then
  ok "SSH設定済み: Host ${ALIAS}"
elif [ "$APPLY" = "1" ]; then
  [ -f "$CONFIG" ] && cp "$CONFIG" "$CONFIG.backup.$(date +%Y%m%d%H%M%S)"
  cat >> "$CONFIG" <<CONF

Host ${ALIAS}
    HostName        github.com
    User            git
    IdentityFile    ${KEY}
    IdentitiesOnly  yes
CONF
  chmod 600 "$CONFIG"
  ok "SSH設定を追記: Host ${ALIAS}"
else
  warn "SSH設定は未追加（点検モード）"
fi

echo
echo "------------------------------------------------------------"
echo " NORIZO へ: 以下の公開鍵を GitHub に登録してください"
echo "------------------------------------------------------------"
echo
echo "  登録先: https://github.com/${OWNER}/${REPO}/settings/keys/new"
echo "  Title : conoha-vps-${REPO}"
echo "  Key   : ↓ この1行をそのまま貼り付け"
echo
cat "$KEY.pub" 2>/dev/null | sed 's/^/    /' || echo "    （--apply で作成後に表示されます）"
echo
echo "  ⚠ 『Allow write access』は原則チェックしないでください（読み取り専用）"
echo "     VPS から push が必要なリポジトリの場合だけ、承認のうえチェックします"
echo
echo "------------------------------------------------------------"
echo " 登録後の疎通確認とクローン"
echo "------------------------------------------------------------"
echo
echo "  ssh -T ${ALIAS}"
echo "      → 'Hi ${OWNER}/${REPO}! You've successfully authenticated' と出れば成功"
echo
echo "  git clone ${ALIAS}:${OWNER}/${REPO}.git ~/workspace/${REPO}"
echo
