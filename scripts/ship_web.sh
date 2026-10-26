#!/usr/bin/env bash
# Build the app for both networks on this machine and ship the result to the web droplet (fast path: the droplet has one CPU).
#   scripts/ship_web.sh [label]      run from any git worktree of this repo; the label is stored as the deployed commit
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="${1:-$(git -C "$ROOT" rev-parse --short HEAD)}"
IP="${WEB_IP:-165.22.89.201}"
KEY="${SSH_KEY:-$HOME/.ssh/peridot-keeper-droplet}"
SSHO="ssh -i $KEY -o IdentitiesOnly=yes"
cd "$ROOT/app"
TS=$(date +%s)
for t in mainnet testnet; do
  NEXT_DIST_DIR=.next-$t-$TS NEXT_PUBLIC_NETWORK=$t NEXT_PUBLIC_USE_MOCKS=false NEXT_PUBLIC_READ_ONLY=false \
  NEXT_PUBLIC_MAINNET_RPC_URL=https://soroban-rpc.mainnet.stellar.gateway.fm NEXT_PUBLIC_TESTNET_RPC_URL=https://soroban-testnet.stellar.org \
  NEXT_PUBLIC_TESTNET_APP_URL=https://test-markets.peridot.finance NEXT_TELEMETRY_DISABLED=1 npm run build > "${TMPDIR:-/tmp}/ship-build-$t.log" 2>&1 \
    || { echo "build $t failed"; tail -20 "${TMPDIR:-/tmp}/ship-build-$t.log"; exit 1; }
done
cd "$ROOT"
rsync -a --delete -e "$SSHO" --exclude node_modules --exclude '.next*' --exclude '.env*' --exclude test-results --exclude playwright-report --exclude tsconfig.tsbuildinfo app/ "root@$IP:/opt/peridot-web/app/"
rsync -a -e "$SSHO" "app/.next-mainnet-$TS" "app/.next-testnet-$TS" "root@$IP:/opt/peridot-web/app/"
$SSHO "root@$IP" "set -e; cd /opt/peridot-web/app; chown -R web:web .; OLDM=\$(grep ^NEXT_DIST_DIR /etc/peridot-web/mainnet.env | cut -d= -f2); OLDT=\$(grep ^NEXT_DIST_DIR /etc/peridot-web/testnet.env | cut -d= -f2); printf 'NEXT_DIST_DIR=.next-mainnet-$TS\nNEXT_TELEMETRY_DISABLED=1\nNODE_ENV=production\n' > /etc/peridot-web/mainnet.env; printf 'NEXT_DIST_DIR=.next-testnet-$TS\nNEXT_TELEMETRY_DISABLED=1\nNODE_ENV=production\n' > /etc/peridot-web/testnet.env; echo '$LABEL' > /etc/peridot-web/deployed-commit; systemctl restart peridot-web peridot-web-testnet; sleep 4; systemctl is-active peridot-web peridot-web-testnet; rm -rf \$OLDM \$OLDT"
rm -rf "app/.next-mainnet-$TS" "app/.next-testnet-$TS"
for u in https://markets.peridot.finance/ https://markets.peridot.finance/launch-token https://markets.peridot.finance/vaults https://markets.peridot.finance/llms.txt https://markets.peridot.finance/sitemap.xml https://test-markets.peridot.finance/launch-token; do echo "$u $(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$u")"; done
