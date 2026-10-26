#!/usr/bin/env bash
# Part 1: full testnet journeys with a locally held test key (friendbot, max 5 accounts, keys in qa/.secrets, git-ignored).
# Takes ~50 minutes (60 s staged delays, a 30 min pending-open expiry wait, 5.5 min cache-staleness waits).
set -euo pipefail
cd "$(dirname "$0")/.."
export QA_NETWORK=testnet
run() { echo "== $*"; npx tsx "$@"; }
run qa/flows/01-setup.ts            # accounts + mock USDT
run qa/flows/10-launch.ts validate  # wizard validation edge cases
run qa/flows/10-launch.ts X         # launch wizard: 2 markets, leverage, rewards last
run qa/flows/10-launch.ts Y         # launch: 1 market (control-panel playground)
run qa/flows/10-launch.ts W         # launch: DeFindex route
run qa/flows/05-pool-align.ts       # SETUP: moves the shared testnet XLM/USDT pool inside the 10% oracle band (otherwise begin_open panics)
run qa/flows/20-group.ts            # group page: enter/supply/borrow/repay/withdraw/claim, rejected signature
run qa/flows/21-repro-footprint.ts  # reward-index footprint failure reproduction
run qa/flows/22-yield.ts            # DeFindex-routed market
run qa/flows/23-yield-borrow-stale.ts
run qa/flows/30-margin.ts           # 2x long open/close + interrupted-open recovery
(run qa/flows/31-expired-open.ts &) ; sleep 1   # 31 min wait, runs in parallel with the next steps (own account)
run qa/flows/40-control.ts          # control panel (no margin)
run qa/flows/41-control-margin.ts   # control panel with leverage: apply_pending + sync_pairs, staged incentive
run qa/flows/42-repro-pairs.ts
run qa/flows/43-repro-collateral-cf.ts
run qa/flows/10-launch.ts Z
run qa/flows/24-margin-yield.ts
npx tsx qa/make-report.ts
