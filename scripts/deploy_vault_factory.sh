#!/usr/bin/env bash
# Build, deploy and record the vault-factory, then register vault kinds.
#
#   NETWORK=testnet IDENTITY=peridot-testnet-admin scripts/deploy_vault_factory.sh factory
#   NETWORK=testnet IDENTITY=... scripts/deploy_vault_factory.sh kind aquarius aquarius_vault   # upload + set_wasm
#
# Records into deployments/<network>.json: vault_factory, vault_kinds.<kind> (wasm hash). Never prints secrets.
# Mainnet requires CONFIRM_MAINNET=yes. ADMIN_ADDR overrides the factory admin (default: the IDENTITY key).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
NETWORK=${NETWORK:?set NETWORK=testnet|mainnet}
IDENTITY=${IDENTITY:?set IDENTITY}
CLI_NET=$NETWORK
if [[ "$NETWORK" == "mainnet" ]]; then
  CLI_NET=mainnet-public
  [[ "${CONFIRM_MAINNET:-}" == "yes" ]] || { echo "refusing mainnet without CONFIRM_MAINNET=yes" >&2; exit 1; }
fi
DEP=deployments/$NETWORK.json
DEPPY="python3 scripts/lib/dep.py $DEP"
OUT=build/$NETWORK; mkdir -p "$OUT"
ME=$(stellar keys public-key "$IDENTITY")
ADMIN_ADDR=${ADMIN_ADDR:-$ME}

build() { # crate wasm
  stellar contract build --package "$1" --optimize=false --out-dir "$OUT/raw" >/dev/null
  wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals --enable-nontrapping-float-to-int \
    "$OUT/raw/$2.wasm" -o "$OUT/$2.wasm"
  echo "built $2.wasm $(wc -c <"$OUT/$2.wasm" | tr -d ' ') bytes sha256 $(shasum -a 256 "$OUT/$2.wasm" | cut -d' ' -f1)" >&2
}

case "${1:?step: factory | kind <kind> <crate_wasm_name>}" in
  factory)
    build vault-factory vault_factory
    id=$(stellar contract deploy --wasm "$OUT/vault_factory.wasm" --source-account "$IDENTITY" --network "$CLI_NET" -- --admin "$ADMIN_ADDR")
    $DEPPY set vault_factory "\"$id\""
    $DEPPY set wasm.vault_factory "\"$(shasum -a 256 "$OUT/vault_factory.wasm" | cut -d' ' -f1)\""
    echo "vault-factory $id"
    ;;
  kind)
    kind=$2; wasm=$3
    crate=${wasm//_/-}
    build "$crate" "$wasm"
    hash=$(stellar contract upload --wasm "$OUT/$wasm.wasm" --source-account "$IDENTITY" --network "$CLI_NET")
    $DEPPY set "vault_kinds.$kind" "\"$hash\""
    fid=$($DEPPY get vault_factory)
    stellar contract invoke --id "$fid" --source-account "$IDENTITY" --network "$CLI_NET" -- \
      set_wasm --admin "$ME" --kind "$kind" --hash "$hash" >/dev/null
    echo "kind $kind -> $hash"
    ;;
  *) echo "unknown step" >&2; exit 1 ;;
esac
