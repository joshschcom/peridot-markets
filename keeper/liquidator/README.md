# Phase 1 liquidation service

`margin/` is the active group-aware worker for V3 margin liquidation, ordinary lending liquidation and boosted-value refresh. `lending-reference/` preserves the older ordinary lending bot for attribution. It is not a separate running service and must not receive mainnet keys.

The worker defaults to mainnet and dry-run. A dry-run status is simulation evidence only, not proof of active liquidation coverage. No HackMeridian group has been run on mainnet by this package yet.

See [keeper operations](../../docs/KEEPER.md), [source attribution](PRIOR_WORK.md), and the retained [V3 safety and recovery design](margin/README.md).

```sh
cd keeper/liquidator/margin
npm ci
npm run check
npm test
# Configure .env from .env.example, including GROUP_ID, RPC_URL, public account, borrower history and repayment caps.
set -a
. ./.env
set +a
npm start
```

The canonical deployment JSON must contain `network`, `factory`, `margin_factory`, `wasm.margin` (or `wasm.margin_audited`) , `wasm.controller` and `wasm.receipt_vault`. All Wasm hashes must match the deployed code. The worker resolves the selected group's controller and boosted markets from on-chain factory views.

No admin idle-cash rebalance is attempted. That call is admin-only in the pinned core; a reviewed factory passthrough is required.
