#!/usr/bin/env bash
# Build the audited core crates to Wasm, with the init admin baked in at compile time.
#
# The core crates compile the permitted initial admin into the Wasm (`*_INIT_ADMIN`), so the Wasm
# hash depends on the admin address. Every contract the market factory deploys must be built with
# INIT_ADMIN = the market-factory contract address of the target network.
#
#   INIT_ADMIN=C...   (required) market-factory address (or the fixed test address, see below)
#   OUT_LABEL=testnet (optional) output folder name under build/, default: first 8 chars of INIT_ADMIN
#
# Output: build/<label>/<crate>.wasm and build/<label>/MANIFEST.json (name, bytes, sha256 = wasm hash).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

: "${INIT_ADMIN:?set INIT_ADMIN to the market-factory address (or TEST_ADMIN for unit tests)}"
LABEL=${OUT_LABEL:-${INIT_ADMIN:0:8}}
OUT="$ROOT/build/$LABEL"
mkdir -p "$OUT"

for var in RECEIPT_VAULT_INIT_ADMIN SIMPLE_PERIDOTTROLLER_INIT_ADMIN JUMP_RATE_MODEL_INIT_ADMIN \
  SWAP_ADAPTER_INIT_ADMIN AQUARIUS_LP_VAULT_INIT_ADMIN PRICE_ROUTER_INIT_ADMIN \
  MARGIN_CONTROLLER_INIT_ADMIN PERIDOT_TOKEN_INIT_ADMIN; do
  export "$var=${!var:-$INIT_ADMIN}"
done

# crate:wasm file name
CRATES=(
  "receipt-vault:receipt_vault"
  "simple-peridottroller:simple_peridottroller"
  "jump-rate-model:jump_rate_model"
  "swap-adapter:swap_adapter"
  "price-router:price_router"
  "margin-controller:margin_controller"
  "aquarius-lp-vault:aquarius_lp_vault"
)
# Extra crates (new contracts, no init-admin guard): EXTRA_CRATES="reward-distributor:reward_distributor ..."
for extra in ${EXTRA_CRATES:-}; do CRATES+=("$extra"); done

sha() { shasum -a 256 "$1" | cut -d' ' -f1; }

entries=()
for pair in "${CRATES[@]}"; do
  crate=${pair%%:*}
  wasm=${pair##*:}
  echo "-> $crate"
  # --optimize=false: the CLI optimizer needs the additional-libs feature; run wasm-opt if installed.
  stellar contract build --package "$crate" --optimize=false --out-dir "$OUT/raw" >/dev/null
  src="$OUT/raw/$wasm.wasm"
  dst="$OUT/$wasm.wasm"
  if command -v wasm-opt >/dev/null 2>&1; then
    wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals \
      --enable-nontrapping-float-to-int "$src" -o "$dst"
  else
    cp "$src" "$dst"
  fi
  bytes=$(wc -c <"$dst" | tr -d ' ')
  entries+=("    {\"crate\": \"$crate\", \"file\": \"$wasm.wasm\", \"bytes\": $bytes, \"sha256\": \"$(sha "$dst")\"}")
  printf '   %s bytes, sha256 %s\n' "$bytes" "$(sha "$dst")"
done

core_commit=$(cat "$ROOT/core/CORE_COMMIT" 2>/dev/null || echo unknown)
{
  echo "{"
  echo "  \"init_admin\": \"$INIT_ADMIN\","
  echo "  \"core_commit\": \"$core_commit\","
  echo "  \"wasm\": ["
  (IFS=$',\n'; echo "${entries[*]}")
  echo "  ]"
  echo "}"
} >"$OUT/MANIFEST.json"
rm -rf "$OUT/raw"
echo "manifest: $OUT/MANIFEST.json"
