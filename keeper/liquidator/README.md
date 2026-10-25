# Phase 1 liquidation service

`margin/` is the active group-aware worker for V3 margin liquidation, ordinary lending liquidation and boosted-value refresh. `lending-reference/` preserves the older ordinary lending bot for attribution. It is not a separate running service and must not receive mainnet keys.

The worker defaults to mainnet and dry-run. A dry-run status is simulation evidence only, not proof of active liquidation coverage. Group 1 has completed a read-only mainnet dry run. See [the recorded result](margin/mainnet-group1-dry-run.json); a funded, signing worker is not running.

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

The canonical deployment JSON must contain `network`, `factory`, `margin_factory`, `wasm.margin` (or `wasm.margin_audited`) , `wasm.controller` and `wasm.receipt_vault`. All Wasm hashes must match the deployed code. The worker resolves the selected group's controller and boosted markets from on-chain factory views. Live startup also requires a valid manifest admin address and rejects that address as the keeper signer; keyless dry runs may use its public address.

No admin idle-cash rebalance is attempted. That call is admin-only in the pinned core; a reviewed factory passthrough is required.

## Mainnet group 1 dry run

Copy [the public configuration](margin/mainnet-group1.env.example) to a private local environment file,
set a funded **public account address** for RPC account reads, and keep `DRY_RUN=true`.
No secret or PostgreSQL is needed for the dry run. The entry point resolves group 1
through both factories in `deployments/mainnet.json` and checks the deployed Wasm pins.
The example starts lending-event discovery at the verified group-creation ledger 65131405.

On 25 October at 17:00 UTC, the one-cycle run verified the group controller,
simulated XLM boosted-value refresh and both market interest updates at ledger 65132365,
and found zero margin positions. Lending discovery reached ledger 65132366 and found
one account. The combined service exited with status 1 because ordinary-lending repayment
caps and capital were not configured. No liquidation was possible to simulate, no transaction
was signed or sent, and these results do not establish live liquidation coverage.

Open positions at health factor 1,000,000 or below use `liquidate_position_v3`.
Atomic liquidation uses the controller's pair-level slippage and oracle limits;
`LIQUIDATION_SLIPPAGE_BPS` only controls recovery swaps for already-staged liquidations.
