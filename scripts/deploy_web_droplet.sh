#!/usr/bin/env bash
# Deploy the Peridot Markets web app (app/ of a git ref) to the web droplet. Safe to rerun.
#   scripts/deploy_web_droplet.sh <droplet-ip> [git-ref=origin/demo-merge] [--provision]
# --provision installs node, caddy, the web user, units and helper scripts first (idempotent).
# Needs: ssh key ~/.ssh/peridot-keeper-droplet (override with SSH_KEY=...), rsync, git.
set -euo pipefail
IP="${1:?usage: $0 <droplet-ip> [git-ref] [--provision]}"; REF="${2:-origin/demo-merge}"
[[ "$REF" == --* ]] && REF=origin/demo-merge
PROVISION=0; for a in "$@"; do [ "$a" = --provision ] && PROVISION=1; done
KEY="${SSH_KEY:-$HOME/.ssh/peridot-keeper-droplet}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
git fetch -q origin || true
COMMIT="$(git rev-parse "$REF^{commit}")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git archive "$COMMIT" app | tar -x -C "$TMP"
echo "Deploying $REF ($COMMIT) to $IP"
if [ "$PROVISION" = 1 ]; then
  rsync -a -e "${SSH[*]}" "$ROOT/scripts/web/" "root@$IP:/root/peridot-web-provision/"
  "${SSH[@]}" "root@$IP" 'bash /root/peridot-web-provision/provision.sh'
fi
rsync -a --delete -e "${SSH[*]}" \
  --exclude node_modules --exclude '.next*' --exclude '.env*' --exclude test-results --exclude playwright-report \
  "$TMP/app/" "root@$IP:/opt/peridot-web/app/"
"${SSH[@]}" "root@$IP" "chown -R web:web /opt/peridot-web/app && echo $COMMIT > /etc/peridot-web/deployed-commit && peridot-web-build"
for p in / /groups/1 /launch-token; do
  printf '%s -> ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' --max-time 30 "http://$IP$p"
done
echo "Deployed $COMMIT"
