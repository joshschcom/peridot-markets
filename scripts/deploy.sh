#!/usr/bin/env bash
# Deploy Peridot Markets to a network, one explicit step at a time. Writes deployments/<network>.json.
#
#   NETWORK=testnet IDENTITY=peridot-testnet-admin scripts/deploy.sh <step>
#
# Steps, in order:
#   build-new        build + optimize the new contracts (not the audited core)
#   factories        deploy market-factory (and margin-factory when it exists), record addresses
#   build-core       build the audited core Wasm with INIT_ADMIN = the factories, optimized
#   upload           upload every Wasm, record hashes, call set_wasm on the factories
#   externals        allowlist Reflector feeds and yield vaults, register the swap adapter
#   all              the steps above in order
#
# Mainnet is refused unless CONFIRM_MAINNET=yes is set (it spends real XLM and uses the mainnet admin key).
# The admin key is a stellar-cli identity; this script never reads or prints secrets.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
NETWORK=${NETWORK:?set NETWORK=testnet|mainnet}
IDENTITY=${IDENTITY:?set IDENTITY=<stellar-cli identity>}
DEP=deployments/$NETWORK.json
DEPPY="python3 scripts/lib/dep.py $DEP"
CLI_NET=$NETWORK
if [[ "$NETWORK" == "mainnet" ]]; then
  CLI_NET=mainnet-public
  [[ "${CONFIRM_MAINNET:-}" == "yes" ]] || { echo "refusing mainnet without CONFIRM_MAINNET=yes" >&2; exit 1; }
fi
OUT=build/$NETWORK
mkdir -p "$OUT" deployments
ADMIN=$(stellar keys public-key "$IDENTITY")
TREASURY=${TREASURY:-$ADMIN}
inv() { stellar contract invoke --source-account "$IDENTITY" --network "$CLI_NET" "$@"; }

optimize() { # in.wasm out.wasm
  wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals \
    --enable-nontrapping-float-to-int --enable-reference-types "$1" -o "$2" 2>/dev/null \
    || wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals \
         --enable-nontrapping-float-to-int "$1" -o "$2"
}

NEW_CRATES=(market-factory:market_factory margin-factory:margin_factory price-router-ext:price_router_ext \
  reward-distributor:reward_distributor blend-vault-adapter:blend_vault_adapter)

step_build_new() {
  for pair in "${NEW_CRATES[@]}"; do
    crate=${pair%%:*}; wasm=${pair##*:}
    if [[ -n "${CRATES_ONLY:-}" && " $CRATES_ONLY " != *" $crate "* ]]; then continue; fi
    echo "-> $crate"
    stellar contract build --package "$crate" --optimize=false --out-dir "$OUT/raw" >/dev/null
    optimize "$OUT/raw/$wasm.wasm" "$OUT/$wasm.wasm"
    printf '   %s bytes\n' "$(wc -c <"$OUT/$wasm.wasm" | tr -d ' ')"
  done
}

deploy_one() { # wasm file, constructor args...
  local wasm=$1; shift
  stellar contract deploy --wasm "$wasm" --source-account "$IDENTITY" --network "$CLI_NET" -- "$@"
}

step_factories() {
  $DEPPY set network "\"$NETWORK\""
  $DEPPY set core_commit "\"$(cat core/CORE_COMMIT)\""
  $DEPPY set admin "\"$ADMIN\""
  local mf
  mf=$(deploy_one "$OUT/market_factory.wasm" --admin "$ADMIN" --treasury "$TREASURY")
  $DEPPY set factory "\"$mf\""
  echo "market-factory $mf"
  if [[ -f "$OUT/margin_factory.wasm" ]] && grep -q "__constructor" <(stellar contract info interface --wasm "$OUT/margin_factory.wasm" 2>/dev/null); then
    local xf
    xf=$(deploy_one "$OUT/margin_factory.wasm" --admin "$ADMIN" --market_factory "$mf")
    $DEPPY set margin_factory "\"$xf\""
    echo "margin-factory $xf"
  else
    echo "margin-factory not built yet, skipping"
  fi
}

step_build_core() {
  local mf xf
  mf=$($DEPPY get factory)
  xf=$($DEPPY get margin_factory 2>/dev/null || echo "$mf")
  INIT_ADMIN=$mf MARGIN_INIT_ADMIN=$xf OUT_LABEL=$NETWORK bash scripts/build_core.sh
}

upload_wasm() { stellar contract upload --wasm "$1" --source-account "$IDENTITY" --network "$CLI_NET"; }

step_upload() {
  local mf xf
  mf=$($DEPPY get factory)
  for pair in receipt_vault:receipt_vault simple_peridottroller:controller jump_rate_model:jump_rate swap_adapter:swap_adapter \
              margin_controller:margin price_router_ext:price_router reward_distributor:reward_distributor \
              blend_vault_adapter:blend_adapter; do
    f=${pair%%:*}; key=${pair##*:}
    file="$OUT/$f.wasm"; [[ -f "$file" ]] || { echo "skip $f (not built)"; continue; }
    h=$(upload_wasm "$file")
    $DEPPY set "wasm.$key" "\"$h\""
    echo "$key $h"
  done
  w() { $DEPPY get "wasm.$1"; }
  blend=$($DEPPY get wasm.blend_adapter 2>/dev/null || true)
  blend_json=null; [[ -n "$blend" ]] && blend_json="\"$blend\""
  inv --id "$mf" -- set_wasm --admin "$ADMIN" --wasm "{\"controller\":\"$(w controller)\",\"receipt_vault\":\"$(w receipt_vault)\",\"jump_rate\":\"$(w jump_rate)\",\"price_router\":\"$(w price_router)\",\"reward_distributor\":\"$(w reward_distributor)\",\"blend_adapter\":$blend_json,\"aquarius_vault\":null,\"aquarius_reserve\":null,\"zenex_adapter\":null,\"xoxno_adapter\":null}"
  if xf=$($DEPPY get margin_factory 2>/dev/null); then
    inv --id "$xf" -- set_wasm --admin "$ADMIN" --wasm "{\"audited\":\"$(w margin)\",\"custom\":null,\"swap_adapter\":\"$(w swap_adapter)\"}"
    inv --id "$mf" -- set_margin_factory --admin "$ADMIN" --margin_factory "$xf"
  fi
}

step_externals() {
  local mf xf
  mf=$($DEPPY get factory)
  while read -r oracle; do
    [[ -z "$oracle" ]] && continue
    inv --id "$mf" -- set_oracle_allowed --admin "$ADMIN" --oracle "$oracle" --allowed true
  done < <(external_oracles)
  # (token, oracle, asset key) price mappings: owners can only choose these
  while read -r token oracle sym; do
    [[ -z "$token" ]] && continue
    inv --id "$mf" -- set_price_feed_allowed --admin "$ADMIN" --token "$token" --oracle "$oracle" \
      --asset "{\"Other\":\"$sym\"}" --allowed true
  done < <(price_feed_mappings)
  while read -r vault; do
    [[ -z "$vault" ]] && continue
    inv --id "$mf" -- set_yield_vault_allowed --admin "$ADMIN" --vault "$vault" --allowed true
  done < <(allowed_yield_vaults)
  if xf=$($DEPPY get margin_factory 2>/dev/null); then
    inv --id "$xf" -- set_router --admin "$ADMIN" --router "$(aquarius_router)"
    if [[ "$NETWORK" == "mainnet" ]]; then
      # owners may only use pools Peridot trusts
      inv --id "$xf" -- set_pool_registry_enforced --admin "$ADMIN" --enforced true
      inv --id "$xf" -- set_pool_trusted --admin "$ADMIN" --pool CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV --trusted true
    fi
  fi
}
external_oracles() {
  if [[ "$NETWORK" == "testnet" ]]; then
    echo CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP   # Stellar assets
    echo CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63   # external CEX/DEX
  else
    echo CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M   # Stellar assets
    echo CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN   # external CEX/DEX
  fi
}
price_feed_mappings() { # token oracle symbol (external CEX/DEX feed prices by symbol)
  if [[ "$NETWORK" == "testnet" ]]; then
    echo CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63 XLM
    echo CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63 USDT
  else
    echo CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN XLM
    echo CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75 CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN USDC
    echo CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN EURC
  fi
}
allowed_yield_vaults() { # DeFindex vaults reviewed by Peridot; Blend fee vaults are added after they are deployed
  if [[ "$NETWORK" == "testnet" ]]; then
    echo CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6
  else
    echo CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK   # Peridot XLM DeFindex vault
  fi
}
aquarius_router() {
  if [[ "$NETWORK" == "testnet" ]]; then echo CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD
  else echo CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK; fi
}

case "${1:-}" in
  build-new) step_build_new ;;
  factories) step_factories ;;
  build-core) step_build_core ;;
  upload) step_upload ;;
  externals) step_externals ;;
  all) step_build_new; step_factories; step_build_core; step_upload; step_externals ;;
  *) sed -n 2,18p "$0"; exit 1 ;;
esac
