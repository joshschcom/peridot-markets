#!/usr/bin/env bash
# Reproducible build of the xoxno-vault Wasm with the protocol admin and XOXNO controller baked in.
#   NETWORK=testnet|mainnet  (required)
#   INIT_ADMIN=G...|C...     (optional override of the baked protocol admin / upgrade authority)
# Output: build/xoxno-<network>/xoxno_vault.wasm and prints its sha256 (the Wasm hash).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
NETWORK=${NETWORK:?set NETWORK=testnet|mainnet}
case "$NETWORK" in
  testnet)
    CONTROLLER=CCXRWJ6SIU2WPFEGLFGJVITPL57QAYIMIO6OAM2NBGNDQSSCK2FFV3F3
    ADMIN=${INIT_ADMIN:-GBZ7C3N43KURCM3DWN4LOOKR5XWHNU6EZEJQT5VGRLHKUUQQYL7UXFMJ} ;;
  mainnet)
    CONTROLLER=CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX
    ADMIN=${INIT_ADMIN:?mainnet needs INIT_ADMIN (upgrade authority)} ;;
  *) echo "bad NETWORK" >&2; exit 1 ;;
esac
OUT="$ROOT/build/xoxno-$NETWORK"
mkdir -p "$OUT"
export XOXNO_VAULT_INIT_ADMIN="$ADMIN" XOXNO_VAULT_CONTROLLER="$CONTROLLER"
stellar contract build --package xoxno-vault --optimize=false --out-dir "$OUT/raw" >/dev/null
if command -v wasm-opt >/dev/null 2>&1; then
  wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals \
    --enable-nontrapping-float-to-int "$OUT/raw/xoxno_vault.wasm" -o "$OUT/xoxno_vault.wasm"
else
  cp "$OUT/raw/xoxno_vault.wasm" "$OUT/xoxno_vault.wasm"
fi
echo "admin=$ADMIN controller=$CONTROLLER"
shasum -a 256 "$OUT/xoxno_vault.wasm"
