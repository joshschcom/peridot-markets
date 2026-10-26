#!/usr/bin/env bash
# Launchpad on Stellar MAINNET, one explicit step at a time. Records everything in deployments/mainnet.json.
#
#   CONFIRM_MAINNET=yes IDENTITY=peridot-mainnet-admin scripts/launchpad_mainnet.sh <step>
#
# Scope authorised by Joshua: deploy launchpad-token/-curve/-factory, launch ONE demo token, upgrade the mainnet
# market-factory in place (upgrade(admin, hash)) and register the AquariusOnly-capable price-router-ext Wasm so that
# graduation works. Nothing else. The admin is the market-factory admin (compile-time admin baking does not apply to
# the launchpad crates: the factory takes admin and treasury as constructor arguments).
#
# Steps, in order (the order matters: uploads first, the riskiest call (market-factory upgrade) before anything
# depends on it, the demo launch last):
#   build       build + optimize token, curve, launchpad factory, market factory, price-router-ext
#   upload      upload the five Wasm, record hashes
#   mf-upgrade  market-factory upgrade(admin, new hash), then read-back checks (rollback hash is the old one)
#   lp-deploy   deploy the launchpad factory (admin, treasury = admin)
#   lp-config   set_wasm, presets, set_graduation, set_quote_price
#   mf-wire     set_launchpad(launchpad factory) + set_wasm (same hashes, new price_router)  [needs lp-deploy]
#   demo        launch ONE demo token (creator buy within the 5% cap)
#   verify      read-only checks
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
[[ "${CONFIRM_MAINNET:-}" == "yes" ]] || { echo "refusing without CONFIRM_MAINNET=yes" >&2; exit 1; }
IDENTITY=${IDENTITY:?set IDENTITY=peridot-mainnet-admin}
NET=${NET:-mainnet-gateway}          # mainnet-public (mainnet.sorobanrpc.com) times out; the gateway worked
FEE=${INCLUSION_FEE:-2000}           # mainnet quotes 200 stroops, the CLI default of 100 is refused
DEP=deployments/mainnet.json
DEPPY="python3 scripts/lib/dep.py $DEP"
OUT=build/mainnet
mkdir -p "$OUT"
ADMIN=$(stellar keys public-key "$IDENTITY")
MF=$($DEPPY get factory)
XLM=$($DEPPY get external.xlm)
ROUTER=$($DEPPY get external.aquarius_router)
REFLECTOR_EXT=$($DEPPY get external.reflector_external)
OLD_MF_HASH=a5442caecfd0d66637b6f8bf903807f674a3fd7b148b1c06518e7de5052f4769   # live market-factory, built from 0849a6a
inv() { stellar contract invoke --source-account "$IDENTITY" --network "$NET" --inclusion-fee "$FEE" "$@"; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

optimize() { wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals \
  --enable-nontrapping-float-to-int --enable-reference-types "$1" -o "$2"; }

step_build() {
  for pair in launchpad-token:launchpad_token launchpad-curve:launchpad_curve launchpad-factory:launchpad_factory \
              market-factory:market_factory price-router-ext:price_router_ext; do
    c=${pair%%:*}; w=${pair##*:}
    stellar contract build --package "$c" --optimize=false --out-dir "$OUT/raw" >/dev/null
    optimize "$OUT/raw/$w.wasm" "$OUT/$w.wasm"
    echo "$w $(wc -c <"$OUT/$w.wasm" | tr -d ' ') bytes sha256 $(shasum -a 256 "$OUT/$w.wasm" | cut -d' ' -f1)"
  done
}

step_upload() {
  for pair in launchpad_token:launchpad_token launchpad_curve:launchpad_curve launchpad_factory:launchpad_factory \
              market_factory:market_factory_v2 price_router_ext:price_router_ext; do
    f=${pair%%:*}; key=${pair##*:}
    if existing=$($DEPPY get "wasm.$key" 2>/dev/null) && [[ -n "$existing" ]]; then echo "skip $key (recorded $existing)"; continue; fi
    h=$(stellar contract upload --wasm "$OUT/$f.wasm" --source-account "$IDENTITY" --network "$NET" --inclusion-fee "$FEE")
    $DEPPY set "wasm.$key" "\"$h\""
    $DEPPY set "launchpad_log.upload_$key" "{\"hash\":\"$h\",\"at_utc\":\"$(now)\"}"
    echo "$key $h"
  done
}

step_mf_upgrade() {
  local h; h=$($DEPPY get wasm.market_factory_v2)
  echo "group_count before: $(inv --id "$MF" --send=no -- group_count)"
  inv --id "$MF" -- upgrade --admin "$ADMIN" --new_wasm_hash "$h"
  $DEPPY set launchpad_log.market_factory_upgrade "{\"new_hash\":\"$h\",\"old_hash\":\"$OLD_MF_HASH\",\"at_utc\":\"$(now)\"}"
  echo "group_count after: $(inv --id "$MF" --send=no -- group_count)"
  inv --id "$MF" --send=no -- get_wasm
  inv --id "$MF" --send=no -- get_launchpad
}

step_lp_deploy() {
  if existing=$($DEPPY get launchpad_factory 2>/dev/null) && [[ -n "$existing" ]]; then
    echo "launchpad factory already recorded ($existing); refusing to deploy a second one" >&2; exit 1
  fi
  local lf; lf=$(stellar contract deploy --wasm-hash "$($DEPPY get wasm.launchpad_factory)" \
    --source-account "$IDENTITY" --network "$NET" --inclusion-fee "$FEE" -- --admin "$ADMIN" --treasury "$ADMIN")
  $DEPPY set launchpad_factory "\"$lf\""
  $DEPPY set launchpad_log.factory_deploy "{\"id\":\"$lf\",\"at_utc\":\"$(now)\"}"
  echo "launchpad factory $lf"
}

step_lp_config() {
  local lf; lf=$($DEPPY get launchpad_factory)
  inv --id "$lf" -- set_wasm --admin "$ADMIN" --token_hash "$($DEPPY get wasm.launchpad_token)" --curve_hash "$($DEPPY get wasm.launchpad_curve)"
  inv --id "$lf" -- set_default_presets --admin "$ADMIN" --quote_token "$XLM"
  # Fast = the demo preset: 500 XLM graduation target, virtual quote = target * 30 / 85, same as the testnet demo.
  inv --id "$lf" -- set_preset --admin "$ADMIN" --quote_token "$XLM" --preset 0 --cfg \
    '{"virtual_quote":"1764705882","virtual_token":"10730000000000000","curve_supply":"8000000000000000","lp_supply":"2000000000000000","graduation_target":"5000000000","trade_fee_bps":100,"creator_fee_share_bps":0,"creator_cap_bps":500}'
  inv --id "$lf" -- set_graduation --admin "$ADMIN" --router "$ROUTER" --market_factory "$MF"
  inv --id "$lf" -- set_quote_price --admin "$ADMIN" --quote_token "$XLM" \
    --price "{\"ReflectorOnly\":{\"asset\":{\"Other\":\"XLM\"},\"oracle\":\"$REFLECTOR_EXT\"}}"
}

step_mf_wire() {
  local lf; lf=$($DEPPY get launchpad_factory)
  inv --id "$MF" -- set_launchpad --admin "$ADMIN" --launchpad "$lf"
  # set_wasm replaces the whole struct: re-pass every live hash, change only price_router.
  w() { $DEPPY get "wasm.$1"; }
  live=$(inv --id "$MF" --send=no -- get_wasm)
  for k in controller receipt_vault jump_rate reward_distributor blend_adapter; do
    [[ "$live" == *"\"$k\":\"$(w $k)\""* ]] || { echo "live get_wasm differs for $k, refusing set_wasm" >&2; exit 1; }
  done
  inv --id "$MF" -- set_wasm --admin "$ADMIN" --wasm "{\"controller\":\"$(w controller)\",\"receipt_vault\":\"$(w receipt_vault)\",\"jump_rate\":\"$(w jump_rate)\",\"price_router\":\"$(w price_router_ext)\",\"reward_distributor\":\"$(w reward_distributor)\",\"blend_adapter\":\"$(w blend_adapter)\",\"aquarius_vault\":null,\"aquarius_reserve\":null,\"zenex_adapter\":null,\"xoxno_adapter\":null}"
  if [[ "$($DEPPY get wasm.price_router)" != "$(w price_router_ext)" ]]; then
    $DEPPY set wasm.price_router_legacy "\"$($DEPPY get wasm.price_router)\""
  fi
  $DEPPY set wasm.price_router "\"$(w price_router_ext)\""
  $DEPPY set launchpad_log.mf_wire "{\"launchpad\":\"$lf\",\"price_router_hash\":\"$(w price_router_ext)\",\"at_utc\":\"$(now)\"}"
}

step_demo() {
  local lf; lf=$($DEPPY get launchpad_factory)
  if $DEPPY get launchpad_demo.curve >/dev/null 2>&1; then echo "demo token already recorded, refusing a second launch" >&2; exit 1; fi
  # Idempotency: if a previous attempt succeeded but its output was lost, look at list_launches before retrying.
  [[ "$(inv --id "$lf" --send=no -- launch_count)" == "0" ]] || { echo "launch_count != 0: inspect list_launches first" >&2; exit 1; }
  local creator_buy=${CREATOR_BUY:-50000000}   # 5 XLM (7 decimals); well inside the 5% cap
  out=$(inv --id "$lf" -- launch_curve --creator "$ADMIN" --name "Peridot Demo" --symbol PDEMO --params \
    "{\"quote_token\":\"$XLM\",\"preset\":0,\"metadata_uri\":\"\",\"creator_buy\":\"$creator_buy\",\"min_tokens_out\":\"1\"}")
  echo "$out"
  inv --id "$lf" --send=no -- list_launches --start 0 --limit 1
}

step_verify() {
  local lf; lf=$($DEPPY get launchpad_factory)
  inv --id "$lf" --send=no -- config
  inv --id "$lf" --send=no -- graduation_targets
  inv --id "$MF" --send=no -- get_launchpad
  inv --id "$MF" --send=no -- get_wasm
  inv --id "$lf" --send=no -- list_launches --start 0 --limit 5
}

case "${1:-}" in
  build) step_build ;; upload) step_upload ;; mf-upgrade) step_mf_upgrade ;; lp-deploy) step_lp_deploy ;;
  lp-config) step_lp_config ;; mf-wire) step_mf_wire ;; demo) step_demo ;; verify) step_verify ;;
  *) sed -n 2,22p "$0"; exit 1 ;;
esac
