#!/usr/bin/env bash
#
# STAGE 1: NORIZO AI WORK FACTORY - VPS 基盤構築
#
# 既定は「点検モード（読み取りのみ）」です。何も変更しません。
#
#   点検:  sudo bash scripts/vps-bootstrap.sh
#   実行:  sudo bash scripts/vps-bootstrap.sh --apply
#
# ファイアウォール・swap は --apply だけでは実行されません（NORIZO の承認が必要）。
#   sudo bash scripts/vps-bootstrap.sh --apply --with-swap
#   sudo bash scripts/vps-bootstrap.sh --apply --with-firewall
#
# このスクリプトは冪等です。何度実行しても同じ結果になります。
# 再起動は一切行いません。必要な場合は最後に案内だけ出します。

set -euo pipefail

WORK_USER="${WORK_USER:-norizo}"
SWAP_SIZE="${SWAP_SIZE:-4G}"
SWAP_FILE="/swapfile"
APPLY=0; WITH_SWAP=0; WITH_FIREWALL=0

for a in "$@"; do
  case "$a" in
    --apply)         APPLY=1 ;;
    --with-swap)     WITH_SWAP=1 ;;
    --with-firewall) WITH_FIREWALL=1 ;;
    *) echo "不明なオプション: $a"; exit 1 ;;
  esac
done

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
ng()   { printf '  \033[31m✗\033[0m %s\n' "$1"; }
todo() { printf '  \033[36m→\033[0m %s\n' "$1"; }
head_() { printf '\n\033[1m[%s] %s\033[0m\n' "$1" "$2"; }

run() {  # run <説明> <コマンド...>
  local desc="$1"; shift
  if [ "$APPLY" = "1" ]; then
    if "$@" >/tmp/bootstrap.log 2>&1; then ok "$desc"; else ng "$desc（失敗。/tmp/bootstrap.log を確認）"; return 1; fi
  else
    todo "$desc"
  fi
}

echo
echo "=============================================="
echo " NORIZO AI WORK FACTORY / STAGE 1"
[ "$APPLY" = "1" ] && echo " モード: 実行" || echo " モード: 点検のみ（変更しません）"
echo "=============================================="

# --- 0. 前提確認 ---------------------------------------------------------
head_ 0 "前提確認"
[ "$(id -u)" = "0" ] || { ng "root で実行してください（sudo）"; exit 1; }
ok "root 権限あり"
. /etc/os-release
if [ "${ID:-}" = "ubuntu" ]; then ok "OS: $PRETTY_NAME"; else warn "想定は Ubuntu です（現在: ${PRETTY_NAME:-不明}）"; fi
echo "  CPU: $(nproc) コア / RAM: $(free -g | awk '/^Mem:/{print $2}') GB / 空き: $(df -h / | awk 'NR==2{print $4}')"

# --- 1. 作業ユーザー -----------------------------------------------------
head_ 1 "作業ユーザー（$WORK_USER）"
if id "$WORK_USER" >/dev/null 2>&1; then
  ok "$WORK_USER は作成済み"
else
  run "$WORK_USER を作成" useradd -m -s /bin/bash "$WORK_USER"
fi
if [ "$APPLY" = "1" ] && id "$WORK_USER" >/dev/null 2>&1; then
  usermod -aG sudo "$WORK_USER" && ok "sudo グループに所属"
  install -d -m 700 -o "$WORK_USER" -g "$WORK_USER" "/home/$WORK_USER/.ssh"
  if [ -f /root/.ssh/authorized_keys ] && [ ! -s "/home/$WORK_USER/.ssh/authorized_keys" ]; then
    install -m 600 -o "$WORK_USER" -g "$WORK_USER" /root/.ssh/authorized_keys "/home/$WORK_USER/.ssh/authorized_keys"
    ok "SSH公開鍵を $WORK_USER へ複製（root の鍵はそのまま）"
  else
    ok "SSH公開鍵は設定済みか、複製元なし"
  fi
else
  todo "sudo 所属・SSH公開鍵の複製"
fi

# --- 2. パッケージ -------------------------------------------------------
head_ 2 "基本パッケージ"
PKGS="git tmux jq ripgrep curl ca-certificates gnupg build-essential python3 python3-pip python3-venv unzip htop"
MISSING=""
for p in $PKGS; do dpkg -s "$p" >/dev/null 2>&1 || MISSING="$MISSING $p"; done
if [ -z "$MISSING" ]; then
  ok "すべて導入済み"
else
  warn "未導入:$MISSING"
  run "apt update" apt-get update -qq
  run "パッケージ導入:$MISSING" env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $MISSING
fi

# --- 3. Docker -----------------------------------------------------------
head_ 3 "Docker Engine + Compose"
if command -v docker >/dev/null 2>&1; then
  ok "導入済み: $(docker --version)"
  docker compose version >/dev/null 2>&1 && ok "Compose: $(docker compose version --short)" || warn "Compose プラグインなし"
else
  warn "Docker 未導入"
  if [ "$APPLY" = "1" ]; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
      docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    ok "Docker を導入"
  else
    todo "Docker公式リポジトリを追加して導入"
  fi
fi
if [ "$APPLY" = "1" ] && id "$WORK_USER" >/dev/null 2>&1 && getent group docker >/dev/null; then
  usermod -aG docker "$WORK_USER" && ok "$WORK_USER を docker グループへ追加"
fi

# --- 4. Node.js / pnpm ---------------------------------------------------
head_ 4 "Node.js LTS + pnpm"
if command -v node >/dev/null 2>&1; then
  ok "Node: $(node --version)"
else
  warn "Node 未導入"
  if [ "$APPLY" = "1" ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
    ok "Node.js 22 LTS を導入"
  else
    todo "NodeSource から Node.js 22 LTS を導入"
  fi
fi
if command -v pnpm >/dev/null 2>&1; then ok "pnpm: $(pnpm --version)"; else run "pnpm を導入" npm install -g pnpm; fi

# --- 5. swap（要承認） ---------------------------------------------------
head_ 5 "swap $SWAP_SIZE"
CUR_SWAP=$(free -m | awk '/^Swap:/{print $2}')
if [ "${CUR_SWAP:-0}" -gt 0 ]; then
  ok "swap 設定済み（${CUR_SWAP} MB）"
elif [ "$WITH_SWAP" != "1" ]; then
  warn "swap なし。--with-swap を付けると作成します（NORIZO の承認が必要）"
elif [ "$APPLY" != "1" ]; then
  todo "$SWAP_FILE を $SWAP_SIZE で作成"
else
  fallocate -l "$SWAP_SIZE" "$SWAP_FILE"
  chmod 600 "$SWAP_FILE"; mkswap "$SWAP_FILE" >/dev/null; swapon "$SWAP_FILE"
  grep -q "^$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
  sysctl -q -w vm.swappiness=10
  grep -q "^vm.swappiness" /etc/sysctl.conf || echo "vm.swappiness=10" >> /etc/sysctl.conf
  ok "swap $SWAP_SIZE を作成し永続化"
fi

# --- 6. fail2ban / UFW（要承認） -----------------------------------------
head_ 6 "fail2ban / UFW（ファイアウォール）"
if [ "$WITH_FIREWALL" != "1" ]; then
  warn "--with-firewall が無いため変更しません（NORIZO の承認が必要）"
  command -v ufw >/dev/null 2>&1 && echo "    現在のUFW: $(ufw status | head -1)" || echo "    UFW 未導入"
  command -v fail2ban-server >/dev/null 2>&1 && ok "fail2ban 導入済み" || warn "fail2ban 未導入"
elif [ "$APPLY" != "1" ]; then
  todo "fail2ban 導入 / UFW で 22番のみ許可して有効化"
else
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban ufw
  systemctl enable --now fail2ban >/dev/null 2>&1 && ok "fail2ban 稼働"
  # 先に22番を許可してから有効化する（順序を誤るとSSHが切れる）
  ufw allow 22/tcp >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw --force enable >/dev/null
  ok "UFW 有効化（22番のみ許可）"
  ufw status numbered | sed 's/^/    /'
fi

# --- 7. 作業ディレクトリ -------------------------------------------------
head_ 7 "作業ディレクトリ"
DEV_ROOT="/home/$WORK_USER/workspace"
if [ -d "$DEV_ROOT" ]; then
  ok "$DEV_ROOT あり"
else
  run "$DEV_ROOT を作成" install -d -m 755 -o "$WORK_USER" -g "$WORK_USER" "$DEV_ROOT"
fi

# --- まとめ --------------------------------------------------------------
echo
echo "=============================================="
if [ "$APPLY" = "1" ]; then
  echo " STAGE 1 実行完了"
  echo
  echo " 次にやること:"
  echo "   1. 別ターミナルで ssh $WORK_USER@<このVPS> が通るか確認"
  echo "      （※ 確認できるまで今のSSH接続を切らないでください）"
  echo "   2. docker グループ反映のため $WORK_USER は再ログインが必要"
  echo "   3. STAGE 2（GitHub Deploy Key）へ"
else
  echo " 点検のみ完了。何も変更していません。"
  echo
  echo " 実行するには:"
  echo "   sudo bash \$0 --apply"
  echo " swap / ファイアウォールも含めるには（NORIZO の承認後）:"
  echo "   sudo bash \$0 --apply --with-swap --with-firewall"
fi
echo "=============================================="
echo
