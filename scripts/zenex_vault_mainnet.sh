#!/usr/bin/env bash
# Zenex vault on MAINNET (Zenex is real on mainnet only; testnet uses a mock). Never deposits USDC.
#   scripts/zenex_vault_mainnet.sh upload            # upload the reproducible wasm (done once, hash recorded)
#   scripts/zenex_vault_mainnet.sh admin-cmds        # print the commands the factory admin runs
#   SEND=yes scripts/zenex_vault_mainnet.sh create   # create_vault through the vault factory (owner = peridot-mainnet-vaults)
# Wasm: ZENEX_VAULT_INIT_ADMIN=GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH (Peridot mainnet admin) baked in.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd); cd "$ROOT"
DEP=deployments/mainnet.json
IDENTITY=${IDENTITY:-peridot-mainnet-vaults}
ADMIN=GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH
HASH=$(python3 scripts/lib/dep.py $DEP get wasm.zenex_vault)
ME=$(stellar keys public-key "$IDENTITY")
ZMARKET=CAOZCITWHWAXH5FRU4EULQ5EN2HMTCHICRNC4R5ZAOVD7XHCCQSJ42IB
ZVAULT=CB2MX4WXJHOHCTDTN5DCFC7G3TLFLOYLCRCINPK7G2A3EUVW2AYVA56N
USDC=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
VF=$(python3 scripts/lib/dep.py $DEP get vault_factory 2>/dev/null || true)
addr() { echo "{\"address\":\"$1\"}"; }; u32() { echo "{\"u32\":$1}"; }
args() { # owner market keeper cap(raw 7 decimals)
  local cfg="{\"map\":[{\"key\":{\"symbol\":\"cap\"},\"val\":{\"i128\":\"$4\"}},{\"key\":{\"symbol\":\"haircut_bps\"},\"val\":$(u32 200)},{\"key\":{\"symbol\":\"keeper\"},\"val\":$(addr $3)},{\"key\":{\"symbol\":\"min_buffer_bps\"},\"val\":$(u32 1000)},{\"key\":{\"symbol\":\"slippage_bps\"},\"val\":$(u32 100)},{\"key\":{\"symbol\":\"target_buffer_bps\"},\"val\":$(u32 3000)},{\"key\":{\"symbol\":\"zenex_market\"},\"val\":$(addr $ZMARKET)},{\"key\":{\"symbol\":\"zenex_vault\"},\"val\":$(addr $ZVAULT)}]}"
  echo "[$(addr $1),$(addr $2),$(addr $USDC),$cfg]"
}
case "${1:?upload | admin-cmds | create}" in
  upload)
    ZENEX_VAULT_INIT_ADMIN=$ADMIN stellar contract build --package zenex-vault --optimize=false --out-dir build/mainnet/raw >/dev/null
    wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-mutable-globals --enable-nontrapping-float-to-int build/mainnet/raw/zenex_vault.wasm -o build/mainnet/zenex_vault.wasm
    [[ "$(shasum -a 256 build/mainnet/zenex_vault.wasm | cut -d' ' -f1)" == "$HASH" ]] || { echo "wasm hash differs from deployments/mainnet.json" >&2; exit 1; }
    stellar contract upload --wasm build/mainnet/zenex_vault.wasm --source-account "$IDENTITY" --network mainnet-public ;;
  admin-cmds)
    echo "# 1. register the kind (vault factory admin)"
    echo "stellar contract invoke --id ${VF:-<MAINNET_VAULT_FACTORY>} --source-account peridot-mainnet-admin --network mainnet-public -- set_wasm --admin $ADMIN --kind zenex --hash $HASH"
    echo "# 2. after create_vault: allow-list the new vault for the market factory (CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S)"
    echo "stellar contract invoke --id CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S --source-account peridot-mainnet-admin --network mainnet-public -- set_yield_vault_allowed --admin $ADMIN --vault <NEW_VAULT> --allowed true" ;;
  create)
    [[ -n "$VF" ]] || { echo "no vault_factory in $DEP yet" >&2; exit 1; }
    # demo vault: owner = keeper = the vaults key, market = owner (unbound; deposits stay refused until bind_market), cap 1000 USDC
    A=$(args "$ME" "$ME" "$ME" 10000000000)
    SALT=$(printf '%064x' "$(date +%s)")
    FLAGS=(--id "$VF" --source-account "$IDENTITY" --network mainnet-gateway --inclusion-fee 2000)
    [[ "${SEND:-}" == "yes" ]] || FLAGS+=(--send=no)
    stellar contract invoke "${FLAGS[@]}" -- create_vault --owner "$ME" --kind zenex --salt "$SALT" --init_args "$A" ;;
esac
