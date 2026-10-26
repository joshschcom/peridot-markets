#!/usr/bin/env bash
# Runs ON the droplet as root (copied and invoked by deploy_web_droplet.sh --provision). Idempotent.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
SRC="$(cd "$(dirname "$0")" && pwd)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg rsync debian-keyring debian-archive-keyring apt-transport-https ufw unattended-upgrades
if ! command -v node >/dev/null || ! node -v | grep -qE '^v(22|24)\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
# The app lockfile is written by npm 11; npm 10 (bundled with node 22) rejects it in `npm ci`.
npm -v | grep -q '^11\.' || npm install -g npm@11 >/dev/null 2>&1
if ! command -v caddy >/dev/null; then
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy
fi
id web >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/web --shell /usr/sbin/nologin web
mkdir -p /opt/peridot-web/app /etc/peridot-web
chown -R web:web /opt/peridot-web /home/web
install -m 0755 "$SRC/peridot-set-domain" /usr/local/bin/peridot-set-domain
install -m 0755 "$SRC/peridot-web-build" /usr/local/bin/peridot-web-build
install -m 0644 "$SRC/peridot-web.service" /etc/systemd/system/peridot-web.service
install -m 0644 "$SRC/peridot-web-testnet.service" /etc/systemd/system/peridot-web-testnet.service
[ -f /etc/peridot-web/mainnet.env ] || printf 'NEXT_DIST_DIR=.next-mainnet\nNEXT_TELEMETRY_DISABLED=1\nNODE_ENV=production\n' > /etc/peridot-web/mainnet.env
[ -f /etc/peridot-web/testnet.env ] || printf 'NEXT_DIST_DIR=.next-testnet\nNEXT_TELEMETRY_DISABLED=1\nNODE_ENV=production\n' > /etc/peridot-web/testnet.env
systemctl daemon-reload
systemctl enable peridot-web peridot-web-testnet >/dev/null 2>&1
# Keep existing domain config if present, otherwise IP-only mode.
if [ -f /etc/peridot-web/hosts.env ]; then . /etc/peridot-web/hosts.env; fi
if [ -n "${MAIN_HOST:-}" ]; then /usr/local/bin/peridot-set-domain "$MAIN_HOST" "$TESTNET_HOST" --no-rebuild
else /usr/local/bin/peridot-set-domain --ip-only --no-rebuild; fi
systemctl enable caddy >/dev/null 2>&1
# Host firewall mirrors the DO cloud firewall.
ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
echo "provisioned"
