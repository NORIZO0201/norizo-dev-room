#!/usr/bin/env bash
#
# Mac 側 ConoHa VPS SSH セットアップ
#
# 既定は「監査モード（読み取りのみ）」です。何も変更しません。
# 実際に設定を書き込むには --apply を付けて実行します。
#
#   監査:   bash scripts/mac-setup-ssh.sh
#   適用:   CONOHA_HOST=<IP> CONOHA_USER=<ユーザー名> bash scripts/mac-setup-ssh.sh --apply
#
# 注意: ConoHa の IP アドレスは引数/環境変数でのみ渡します。
#       このリポジトリは public のため、IP を書き込まないでください。

set -euo pipefail

ALIAS="conoha-dev"
SSH_DIR="$HOME/.ssh"
SSH_CONFIG="$SSH_DIR/config"
KEY="$SSH_DIR/id_ed25519"
APPLY=0
[ "${1:-}" = "--apply" ] && APPLY=1

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
ng()   { printf '  \033[31m✗\033[0m %s\n' "$1"; }

echo
echo "=== PHASE 3: Mac 側 SSH 設定 ==="
echo

# --- 1. 環境確認 ---------------------------------------------------------
echo "[1] 実行環境"
if [ "$(uname)" != "Darwin" ]; then
  ng "macOS ではありません（uname=$(uname)）。このスクリプトは Mac 専用です。"
  exit 1
fi
ok "macOS $(sw_vers -productVersion)"
command -v ssh >/dev/null && ok "ssh: $(ssh -V 2>&1)" || { ng "ssh コマンドがありません"; exit 1; }
echo

# --- 2. 鍵の確認 ---------------------------------------------------------
echo "[2] SSH 鍵"
if [ -f "$KEY" ]; then
  ok "秘密鍵あり: ~/.ssh/id_ed25519"
  perm=$(stat -f '%Lp' "$KEY")
  if [ "$perm" = "600" ]; then
    ok "パーミッション 600（正常）"
  else
    warn "パーミッションが $perm です。600 であるべきです"
    [ "$APPLY" = "1" ] && { chmod 600 "$KEY"; ok "600 に修正しました"; }
  fi
  [ -f "$KEY.pub" ] && ok "公開鍵あり: ~/.ssh/id_ed25519.pub" || warn "公開鍵が見つかりません"
  # フィンガープリントのみ表示（鍵そのものは絶対に表示しない）
  [ -f "$KEY.pub" ] && echo "    指紋: $(ssh-keygen -lf "$KEY.pub" | awk '{print $2}')"
else
  ng "~/.ssh/id_ed25519 がありません。ConoHa 登録鍵の場所を確認してください"
  exit 1
fi
echo

# --- 3. ssh-agent --------------------------------------------------------
echo "[3] ssh-agent"
if ssh-add -l >/dev/null 2>&1; then
  ok "ssh-agent に鍵が登録済み（$(ssh-add -l | wc -l | tr -d ' ') 件）"
else
  warn "ssh-agent に鍵が未登録（初回接続時にパスフレーズを聞かれます）"
fi
echo

# --- 4. ~/.ssh/config ----------------------------------------------------
echo "[4] ~/.ssh/config"
mkdir -p "$SSH_DIR"; chmod 700 "$SSH_DIR"

if [ -f "$SSH_CONFIG" ] && grep -qE "^[[:space:]]*Host[[:space:]].*\b${ALIAS}\b" "$SSH_CONFIG"; then
  ok "Host ${ALIAS} は設定済みです（変更しません）"
  echo
  echo "=== 次は PHASE 4: 接続テスト ==="
  echo "    ssh ${ALIAS} 'hostname && uptime'"
  echo
  exit 0
fi

warn "Host ${ALIAS} は未設定です"

if [ "$APPLY" != "1" ]; then
  echo
  echo "--- 監査モードのため、ここで終了します（何も変更していません）---"
  echo
  echo "適用するには、ConoHa の IP とユーザー名を指定して再実行してください:"
  echo "  CONOHA_HOST=<IPアドレス> CONOHA_USER=<ユーザー名> bash $0 --apply"
  echo
  exit 0
fi

HOST="${CONOHA_HOST:-}"
USER_NAME="${CONOHA_USER:-}"
[ -z "$HOST" ] && { ng "CONOHA_HOST が未指定です"; exit 1; }
[ -z "$USER_NAME" ] && { ng "CONOHA_USER が未指定です"; exit 1; }

# バックアップ（元に戻せるようにする）
if [ -f "$SSH_CONFIG" ]; then
  BACKUP="$SSH_CONFIG.backup.$(date +%Y%m%d%H%M%S)"
  cp "$SSH_CONFIG" "$BACKUP"
  ok "バックアップ作成: $(basename "$BACKUP")"
fi

# 追記のみ。既存設定は一切書き換えない。
cat >> "$SSH_CONFIG" <<CONF

# --- ConoHa DEV VPS (added by norizo-dev-room/scripts/mac-setup-ssh.sh) ---
Host ${ALIAS}
    HostName            ${HOST}
    User                ${USER_NAME}
    IdentityFile        ${KEY}
    IdentitiesOnly      yes
    AddKeysToAgent      yes
    UseKeychain         yes
    ServerAliveInterval 60
    ServerAliveCountMax 3
CONF

chmod 600 "$SSH_CONFIG"
ok "Host ${ALIAS} を追記しました（既存設定は変更していません）"
echo
echo "=== 次は PHASE 4: 接続テスト ==="
echo "    ssh ${ALIAS} 'hostname && uptime'"
echo
