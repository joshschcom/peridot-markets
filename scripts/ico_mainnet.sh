#!/usr/bin/env bash
# ICO support on Stellar MAINNET: upload the ICO and new launchpad-factory Wasm, upgrade the live factory in place,
# register the ICO Wasm. Run only with the owner's explicit go-ahead:
#   CONFIRM_MAINNET=yes IDENTITY=peridot-mainnet-admin scripts/ico_mainnet.sh <preflight|upload|upgrade|verify>
# Simulated cost 2026-10-26: ICO upload 22.51 XLM + factory upload 49.28 XLM (about 72 XLM, admin needs ~77).
# Rollback of the factory: upgrade(admin, e7c070ce...) restores the code only (new ICO records stay in storage).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
[[ "${CONFIRM_MAINNET:-}" == "yes" ]] || { echo "refusing without CONFIRM_MAINNET=yes" >&2; exit 1; }
IDENTITY=${IDENTITY:?set IDENTITY=peridot-mainnet-admin}
NET=${NET:-mainnet-gateway}; FEE=${INCLUSION_FEE:-2000}
DEPPY="python3 scripts/lib/dep.py deployments/mainnet.json"
LF=$($DEPPY get launchpad_factory); ADMIN=$(stellar keys public-key "$IDENTITY")
ICO_SHA=7596bd473fa4d036b65a5b05ea2a65e273ca14a9f6ca1822f397b245b0b82284
FAC_SHA=b371a8c37cb6a9cabd74b28c899f86114efa7a85e955042085f78c3261ee6d62
inv() { stellar contract invoke --source-account "$IDENTITY" --network "$NET" --inclusion-fee "$FEE" "$@"; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
case "${1:-}" in
  preflight)
    [[ "$(shasum -a 256 build/mainnet/launchpad_ico.wasm | cut -d' ' -f1)" == "$ICO_SHA" ]]
    [[ "$(shasum -a 256 build/mainnet/launchpad_factory_v2.wasm | cut -d' ' -f1)" == "$FAC_SHA" ]]
    inv --id "$LF" --send=no -- launch_count; inv --id "$LF" --send=no -- list_launches --start 0 --limit 5 ;;
  upload)
    stellar contract upload --wasm build/mainnet/launchpad_ico.wasm --source-account "$IDENTITY" --network "$NET" --inclusion-fee "$FEE"
    stellar contract upload --wasm build/mainnet/launchpad_factory_v2.wasm --source-account "$IDENTITY" --network "$NET" --inclusion-fee "$FEE" ;;
  upgrade)
    inv --id "$LF" -- upgrade --admin "$ADMIN" --new_wasm_hash "$FAC_SHA"
    inv --id "$LF" -- set_ico_wasm --admin "$ADMIN" --hash "$ICO_SHA" ;;
  verify)
    inv --id "$LF" --send=no -- launch_count; inv --id "$LF" --send=no -- ico_count
    inv --id "$LF" --send=no -- list_launches --start 0 --limit 5
    inv --id "$LF" --send=no -- create_ico --creator "$ADMIN" --name "Peridot ICO" --symbol PICO --metadata_uri "" --params \
      "{\"quote_token\":\"$($DEPPY get external.xlm)\",\"supply\":\"100000000000\",\"price\":\"1000000\",\"soft_cap\":\"100000000\",\"hard_cap\":\"1000000000\",\"start\":\"$(( $(date +%s) + 600 ))\",\"end\":\"$(( $(date +%s) + 7200 ))\",\"buyer_cap\":\"0\"}" ;;
  *) sed -n 2,8p "$0"; exit 1 ;;
esac
