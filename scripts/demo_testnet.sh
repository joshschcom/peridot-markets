#!/usr/bin/env bash
# Testnet demo group "Meridian": USDT (no yield route) and XLM (Blend), rewards, margin. Run steps in order:
#   scripts/demo_testnet.sh group | markets | yield | rewards | margin | all
# Uses the factories recorded in deployments/testnet.json. Group owner: identity peridot-testnet-owner.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
DEP=deployments/testnet.json
g() { python3 scripts/lib/dep.py $DEP get "$1"; }
s() { python3 scripts/lib/dep.py $DEP set "$1" "$2"; }
MF=$(g factory); XF=$(g margin_factory)
OWNER_ID=${OWNER_ID:-peridot-testnet-owner}; ADMIN_ID=${ADMIN_ID:-peridot-testnet-admin}
OWNER=$(stellar keys public-key $OWNER_ID); ADMIN=$(stellar keys public-key $ADMIN_ID)
XLM=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
USDT=CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY
REFL_EXT=CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63
AQUA_ROUTER=CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD
POOL=CCMNSENXDBNJSY72BDIPH5CCXLLHBKZ4LXTRKDLKZN4UI2NJFQLWTLD6
POOL_ID=9ac7a9cde23ac2ada11105eeaa42e43c2ea8332ca0aa8f41f58d7160274d718e
call() { local id=$1 src=$2; shift 2; stellar contract invoke --id "$id" --source-account "$src" --network testnet -- "$@"; }
owner() { call "$MF" $OWNER_ID "$@"; }
GROUP=$(python3 scripts/lib/dep.py $DEP get demo.group_id 2>/dev/null || echo 0)

price() { echo "{\"ReflectorOnly\":{\"oracle\":\"$REFL_EXT\",\"asset\":{\"Other\":\"$1\"}}}"; }
market_cfg() { # token symbol cf route rates_json
  echo "{\"token\":\"$1\",\"collateral_factor\":\"$3\",\"supply_cap\":\"100000000000000\",\"borrow_cap\":\"50000000000000\",\"reserve_factor\":\"100000\",\"rates\":$5,\"idle_buffer_bps\":2000,\"yield_route\":$4,\"price\":$(price $2),\"margin_enabled\":true,\"supply_reward_per_sec\":\"0\",\"borrow_reward_per_sec\":\"0\"}"
}
STABLE='{"base":"0","multiplier":"80000","jump":"2000000","kink":"900000"}'
ZERO='{"base":"0","multiplier":"0","jump":"0","kink":"0"}'

case "${1:-}" in
  group)
    GROUP=$(owner create_group --owner "$OWNER" --name Meridian | tail -1 | tr -d '"')
    s demo.group_id "$GROUP"; echo "group $GROUP"
    ;;
  markets)
    usdt=$(owner add_market --owner "$OWNER" --group_id "$GROUP" --cfg "$(market_cfg $USDT USDC 900000 '"None"' "$STABLE")" | tail -1 | tr -d '"')
    owner activate_market --owner "$OWNER" --group_id "$GROUP" --market "$usdt"
    s demo.markets.USDT "\"$usdt\""
    xlm=$(owner add_market --owner "$OWNER" --group_id "$GROUP" --cfg "$(market_cfg $XLM XLM 700000 "${XLM_ROUTE:-\"None\"}" "$ZERO")" | tail -1 | tr -d '"')
    owner activate_market --owner "$OWNER" --group_id "$GROUP" --market "$xlm"
    s demo.markets.XLM "\"$xlm\""
    echo "USDT market $usdt  XLM market $xlm"
    ;;
  yield)
    owner attach_yield --owner "$OWNER" --group_id "$GROUP" --market "$(g demo.markets.XLM)"
    ;;
  rewards)
    dist=$(owner set_rewards --owner "$OWNER" --group_id "$GROUP" --reward_token "$USDT" | tail -1 | tr -d '"')
    s demo.reward_distributor "\"$dist\""; echo "distributor $dist"
    ;;
  *) sed -n 2,5p "$0"; exit 1 ;;
esac
