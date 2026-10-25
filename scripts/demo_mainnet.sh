#!/usr/bin/env bash
# Mainnet demo group "Meridian" (beta, small caps): USDC and XLM markets.
#   CONFIRM_MAINNET=yes scripts/demo_mainnet.sh group | markets | yield | rewards <token> | summary
# Group owner and payer: identity peridot-mainnet-admin. Records ids in deployments/mainnet.json.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
[[ "${CONFIRM_MAINNET:-}" == "yes" ]] || { echo "refusing mainnet without CONFIRM_MAINNET=yes" >&2; exit 1; }
export STELLAR_INCLUSION_FEE=${STELLAR_INCLUSION_FEE:-2000}
DEP=deployments/mainnet.json
g() { python3 scripts/lib/dep.py $DEP get "$1"; }
s() { python3 scripts/lib/dep.py $DEP set "$1" "$2"; }
ID=peridot-mainnet-admin
MF=$(g factory); OWNER=$(stellar keys public-key $ID)
XLM=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA
USDC=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
REFL_EXT=CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN
DEFINDEX_XLM=CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK
call() { stellar contract invoke --id "$MF" --source-account $ID --network mainnet-public -- "$@"; }
price() { echo "{\"ReflectorOnly\":{\"oracle\":\"$REFL_EXT\",\"asset\":{\"Other\":\"$1\"}}}"; }
cfg() { # token symbol cf supply_cap borrow_cap route rates
  echo "{\"token\":\"$1\",\"collateral_factor\":\"$3\",\"supply_cap\":\"$4\",\"borrow_cap\":\"$5\",\"reserve_factor\":\"100000\",\"rates\":$7,\"idle_buffer_bps\":2000,\"yield_route\":$6,\"price\":$(price $2),\"margin_enabled\":false,\"supply_reward_per_sec\":\"0\",\"borrow_reward_per_sec\":\"0\"}"
}
STABLE='{"base":"0","multiplier":"80000","jump":"2000000","kink":"900000"}'
ZERO='{"base":"0","multiplier":"0","jump":"0","kink":"0"}'
GROUP=$(g demo.group_id 2>/dev/null || echo 0)
last() { tail -1 | tr -d '"'; }
case "${1:-}" in
  group)  GROUP=$(call create_group --owner "$OWNER" --name Meridian | last); s demo.group_id "$GROUP"; echo "group $GROUP" ;;
  markets)
    # 10,000 USDC supply cap / 5,000 borrow cap; 100,000 XLM / 50,000 XLM (7 decimals)
    if ! g demo.markets.USDC >/dev/null 2>&1; then
    m=$(call add_market --owner "$OWNER" --group_id "$GROUP" --cfg "$(cfg $USDC USDC 750000 100000000000 50000000000 '"None"' "$STABLE")" | last)
    call activate_market --owner "$OWNER" --group_id "$GROUP" --market "$m"; s demo.markets.USDC "\"$m\""
    fi
    m=$(call add_market --owner "$OWNER" --group_id "$GROUP" --cfg "$(cfg $XLM XLM 700000 1000000000000 500000000000 "{\"Defindex\":{\"vault\":\"$DEFINDEX_XLM\"}}" "$ZERO")" | last)
    call activate_market --owner "$OWNER" --group_id "$GROUP" --market "$m"; s demo.markets.XLM "\"$m\""
    echo "markets: USDC $(g demo.markets.USDC) XLM $(g demo.markets.XLM)" ;;
  yield)  call attach_yield --owner "$OWNER" --group_id "$GROUP" --market "$(g demo.markets.XLM)" ;;
  rewards)
    d=$(call set_rewards --owner "$OWNER" --group_id "$GROUP" --reward_token "$2" | last); s demo.reward_distributor "\"$d\""; echo "distributor $d" ;;
  summary) call get_group --group_id "$GROUP" ;;
  *) sed -n 2,5p "$0"; exit 1 ;;
esac
