#!/usr/bin/env bash
# Refresh the boosted-vault health cache of every yield-routed market (permissionless, about 0.002 XLM each).
# Borrowing on DeFindex/Blend-routed markets reverts when the cache is older than 5 minutes, so run this right
# before a borrow demo, or let the keeper do it (keeper/liquidator does `refresh_boosted_underlying`).
#   scripts/refresh_boosted_mainnet.sh [identity]     default identity: peridot-mainnet-admin
set -euo pipefail
ID=${1:-peridot-mainnet-admin}
export STELLAR_INCLUSION_FEE=${STELLAR_INCLUSION_FEE:-2000}
NET=${NETWORK_NAME:-mainnet-gateway}
for m in $(python3 "$(dirname "$0")/lib/dep.py" "$(dirname "$0")/../deployments/mainnet.json" get demo.markets.XLM | tr -d '"') $(python3 "$(dirname "$0")/lib/dep.py" "$(dirname "$0")/../deployments/mainnet.json" get demo.blend_market | tr -d '"'); do
  printf '%s ' "$m"
  stellar contract invoke --id "$m" --source-account "$ID" --network "$NET" -- refresh_boosted_underlying 2>&1 | grep -E "stellar.expert|rror" | tail -1 | cut -c1-90
done
