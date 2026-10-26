# Keeper and liquidation operations

Phase 1 includes a group-aware service for ordinary lending and margin V3 liquidation and boosted-value refresh for attached Blend and DeFindex markets. It is not yet deployed or approved for live signing. Aquarius harvesting, range management and hosted subscriptions belong to later phases.

## What is included

- `keeper/liquidator/margin`: V3 discovery, health checks, staged liquidation, abandoned-stage recovery, bounded fees and a durable PostgreSQL signing journal.
- A public `/status` endpoint and `/health` readiness check. Dry runs report `mode: simulation-only` and `liveSigning: false`.
- Permissionless `update_interest()` on every selected group receipt vault, normally every two minutes, before liquidation health reads. The same pinned receipt whitelist, serialized account journal and fee budget apply. Failed or stale accrual coverage blocks liquidation scans; simulation does not accrue onchain interest.
- Sequential refresh of each discovered boosted receipt vault, normally every two minutes. Live failures or stale refreshes make health fail. Dry-run refreshes do not update on-chain caches.
- Ordinary lending discovery and liquidation use the same guarded transaction client, account lock and fee journal. The attributed original remains under `keeper/liquidator/lending-reference` for comparison only.

The factory owns receipt-vault admin authority. `rebalance_idle_cash(admin)` is not permissionless, so this worker does not attempt it. Lead A must expose a reviewed factory path before automatic idle rebalancing can be added.

## Prepare an isolated run

Requirements: Node 22 or newer, a verified deployment manifest, RPC access, a group with audited margin enabled, and a funded public Stellar account for simulation. No secret is needed for a dry run. A deployed V3 controller must expose `get_position_counter`, lifecycle events and `preview_liquidation_v3`.

```sh
cd keeper/liquidator/margin
npm ci
npm run check
npm test
cp .env.example .env
```

Set these variables in the local ignored `.env`:

| Variable | Value |
|---|---|
| `NETWORK` | `mainnet` by default; `testnet` for development |
| `GROUP_ID` | Explicit numeric group ID |
| `DEPLOYMENTS_FILE` | Absolute path to `deployments/mainnet.json` or `testnet.json` |
| `RPC_URL` | HTTPS RPC provider for the selected network |
| `LIQUIDATOR_PUBLIC_KEY` | A funded public account for reads and simulation |
| `DRY_RUN` | `true` until live operation is reviewed and approved |
| `LENDING_START_LEDGER` | Ledger at or before group creation, required on first startup unless a complete snapshot is supplied |
| `LENDING_BOOTSTRAP_FILE` | Optional absolute path to the complete borrower snapshot described below |
| `LENDING_REPAY_CAPS_JSON` | JSON map of repay market IDs to positive raw-unit integer strings; empty configuration keeps health failing |
| `LENDING_MIN_PROFIT_BPS` | Minimum net valuation surplus, default `100` (1%), range `1..10000` |
| `LENDING_COST_BUFFER_USD_MICRO` | Additional estimated cost buffer in USD millionths, default `100000` ($0.10); must be positive |
| `RUN_ONCE` | `true` for one discovery/simulation cycle |
| `INTEREST_REFRESH_INTERVAL_MS` | Default `120000`, constrained to `30000..180000`; bounds periodic interest-accrual signing |
| `BOOSTED_REFRESH_INTERVAL_MS` | Default `120000`, constrained to `30000..180000` |
| `PORT`, `HOST` | Default `8787`, `127.0.0.1` |

The manifest needs valid factory IDs and pinned `wasm.margin` (or `wasm.margin_audited`) , `wasm.controller`, `wasm.receipt_vault` and `wasm.price_router`. It must match `NETWORK`. The worker verifies RPC network, resolves `get_group` and `get_margin`, checks their controller agreement and verifies deployed Wasm hashes before starting.

```sh
set -a
. ./.env
set +a
npm start
```

Inspect `http://127.0.0.1:8787/status`. Health remains 503 until a complete cycle succeeds, and becomes unhealthy after stale cycles, refresh failures or fatal signing errors. Status contains group/contract IDs, mode, last cycle and last transaction; it never exposes RPC credentials, database URLs or secrets.

Factory discovery occurs at startup and its market, controller and boosted-vault bindings are checked before each cycle and live submission. A changed binding stops the worker with a fatal status so a supervisor can restart and rediscover it. Restart after adding a market, changing a route or replacing the group's margin controller. A restart retains the durable journal and bootstraps positions from the on-chain counter. One service instance serves one explicitly selected group in phase 1.

## Enable live signing only after approval

Joshua must approve mainnet spending before `DRY_RUN=false` is used. Use a dedicated keeper account, never an admin or treasury key. Required live settings are `LIQUIDATOR_SECRET`, `DATABASE_URL` and a controller code hash resolved from the approved manifest. `DATABASE_CA_FILE` or `DATABASE_CA_PEM` can provide the PostgreSQL CA certificate. TLS certificate verification is mandatory.

Keep the inherited limits unless Joshua approves a different budget:

| Setting | Default |
|---|---|
| Maximum transaction fee | 0.1 XLM |
| Rolling 24-hour fee reservation | 1 XLM |
| Spendable balance retained after maximum fee | 2 XLM plus account reserve and liabilities |

Interest accrual, boosted refresh, ordinary lending and margin liquidation share one journal, one account lock and one daily budget. The allowance includes the padded maximum fee for every signed intent. Interest accrual on every market plus boosted refresh every two minutes can consume the default daily budget, so size and approve the operating budget from observed simulations before declaring continuous coverage.

Live approval must explicitly include the interest-accrual fee duties and cadence. Code preparation does not authorize a running signer or additional funds. Interest is periodically accrued, so health checks remain subject to the configured cadence between updates.

Every live transaction simulates first, checks network and code hash, validates the prepared invocation and rejects every nested source-account authorization, reserves its fee and commits its unsigned hash before signing. Unknown outcomes stop signing. Never delete journal records or switch to an empty database to bypass an unresolved transaction. Reconcile the exact hash first.

The reviewed worker methods authorize the keeper account only at the invoked root. Ordinary repayment uses the existing vault token allowance; margin repayment spends controller-owned funds. No nested keeper-account token transfers are required. A simulated nested source authorization stops signing even when its root is the expected controller call.

## Ordinary lending capital and borrower history

Ordinary liquidation calls the group lending controller's `liquidate(borrower, repay_market, collateral_market, repay_amount, liquidator)`. The receipt vault uses the underlying token's `transfer_from` with the repay vault as spender. Before live coverage, Joshua must separately approve the keeper inventory and a finite token allowance for each intended repay vault. This worker never funds accounts, grants allowances, replenishes inventory or redeems seized shares. It keeps the collateral receipt shares received from liquidation.

`LENDING_REPAY_CAPS_JSON` sets a per-transaction cap, for example `'{"<verified repay market ID>":"1000000"}'`. Amounts are raw integer token units; account for each asset's decimals. The actual repayment is also bounded by borrower debt, the controller close-factor preview, keeper balance, current token allowance and available collateral. The cap is not a daily capital budget. Finite approved inventory and allowances bound cumulative token expenditure, while the journal independently bounds transaction fees. An underwater borrower without an executable plan makes health fail.

Before selecting an ordinary liquidation, the worker values the net seized shares after the actual protocol fee. It reads the factory-resolved, Wasm-pinned price router's `check` and `decimals`, requires fresh successful prices, reads each token's own decimals and the receipt exchange rate, and uses conservative integer rounding. The required net value includes the repayment value, `LENDING_MIN_PROFIT_BPS` and `LENDING_COST_BUFFER_USD_MICRO`. The live transport repeats the check after simulation and before writing an intent or signing. Missing prices or fee metadata fail closed. A missing reserve recipient zeroes the fee only because the audited controller does so too.

These thresholds are operator valuation and cost buffers. They do not guarantee realized profit: oracle prices, protocol settings and exchange rates can move before execution; seized receipts may be illiquid, and the controller ABI has no atomic minimum-net-proceeds argument. Size the cost buffer from observed transaction fees and conversion costs before approval. The worker retains seized shares and does not sell them.

The receipt ABI has no enumerable global borrower view. On first startup, supply `LENDING_START_LEDGER` at or before the group's creation ledger, within the RPC provider's retained event history. The operator must verify that ledger against the creation transaction. If earlier history is unavailable, supply a complete externally indexed snapshot:

```json
{
  "complete": true,
  "network": "mainnet",
  "factory": "<verified factory contract ID>",
  "group_id": 1,
  "lending_controller": "<verified group lending controller ID>",
  "as_of_ledger": 123456,
  "borrowers": ["<borrower public account or contract address>"]
}
```

The snapshot is an explicit operator attestation, not independently proven completeness. Its ledger must still be inside the provider's retained event window so the worker can index every later ledger. An empty snapshot is valid only if verified to cover a group with no prior borrowers. The worker rejects mismatched group/network state and fails on unavailable history instead of silently starting at the latest ledger.

Borrow and repay events are paginated across the controller and every market, up to 1,000 ledgers per cycle. A checkpoint advances only after every contract's full window succeeds. Margin lifecycle indexing also requires the event service's indexed ledger to cover the requested end ledger and rejects repeated cursors; a lagging response cannot silently advance its checkpoint. Liquidation waits until discovery catches up. State is written atomically under persistent `data/`; keep that volume across restarts. Healthy borrowers with debt, and zero-debt borrowers, remain indexed. At most 25 accounts are checked per cycle in round-robin order; the index is bounded to 10,000 addresses and fails closed beyond that limit. These limits and RPC throughput determine coverage latency. Do not claim continuous coverage from a backfilling or degraded `/status` response.

For containers, a first-start snapshot must be mounted read-only and `LENDING_BOOTSTRAP_FILE` set to the mounted path. Never delete the borrower checkpoint to bypass a history error. Restore a trusted checkpoint or build a fresh complete snapshot.

## Container run

```sh
cd keeper/liquidator/margin
# Set DEPLOYMENTS_FILE to an absolute manifest path in .env.
docker compose up --build -d
curl --fail http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/status
```

The container runs as an unprivileged user. The manifest is mounted read-only and `.env` is excluded from the image. Use a provider-managed secret store in hosted environments. If a private PostgreSQL CA file is needed in the container, mount that file read-only and set `DATABASE_CA_FILE` to its container path.

The inherited droplet examples under `margin/deploy/droplet` are prior-work reference material. They do not configure this new group-aware entry point automatically.

## Evidence needed before a phase tag

1. Testnet group discovery, one ordinary lending liquidation and at least one full V3 liquidation with every confirmed stage hash.
2. A restart test with pending stages and durable transaction reconciliation.
3. Actual boosted-cache refresh hashes at a cadence under five minutes.
4. Read-only Claude review of the changed signing and journal boundaries.
5. Mainnet approval, configured key/budget/database and live `/status` evidence.

No live signing, funding or deployment has been performed by this package yet. See [DEMO.md](DEMO.md) for confirmed evidence and [liquidator prior work](../keeper/liquidator/PRIOR_WORK.md) for attribution.

## Mainnet audit, 26 October 2026 (read-only)

Method: market-factory and receipt-vault views simulated, receipt-vault ledger entries read directly (`LastUpdateTime`, `BoostedHealthCache`), droplet `journalctl`/`systemctl`/`/status` read, keeper balance and fees from Horizon. No transaction was sent and nothing on the droplet was changed.

Groups (market-factory `group_count` = 3), all with the pinned receipt-vault wasm `8cc9f723...` and controller wasm `dabe8d1c...`:

| Group | Markets | Boosted | Cache age | Last `update_interest` | Blocks borrows now | Covered by |
|---|---|---|---|---|---|---|
| 1 Meridian | USDC `CCZHYR...`, XLM `CCK7R2...` | XLM (DeFindex) | about 70 s | about 60 s | no | group-1 service: both `update_interest`, XLM `refresh_boosted_underlying` |
| 2 Rewards | `CARDJE...` | none | n/a | about 20 h | no (interest is also accrued inside every user action) | nothing |
| 3 BlendDemo | `CCUQUY...` | Blend adapter | about 11.4 h (41,000 s) | about 19 h | YES, borrow fails closed after 5 min | nothing |

Group-1 service (`peridot-keeper-group1`, commit `bcb7f83`, uptime 5.5 h): last hour 58 `update_interest` + 29 `refresh_boosted_underlying` confirmed, 0 failed, 0 warn/error log lines. Horizon: 87 transactions, 0.102 XLM charged in that hour (about 11.8k stroops each, 2000 inclusion fee), about 2.45 XLM/day. Keeper `GAFJVD...2S3W` holds 29.41 XLM. The journal reservation (padded, `feeBudget`) is 7.06 XLM/day of the 10 XLM cap, so reservations are about 3x real spend.

Margin discovery: `get_position_counter` is 0, `activePositions` 0, event checkpoint current. Lending: `indexedThrough` is within 30 ledgers of head, 1 borrower indexed, `discoveryLag` 0. `/status` says "Lending discovery or capital configuration is incomplete" and `/health` is permanently 503 only because `LENDING_REPAY_CAPS_JSON='{}'` (no repay inventory or allowance approved), not because of backfill. Consequently no ordinary lending liquidation can ever run, by design. The scheduled jobs themselves are healthy.

Other upkeep: not covered by any running keeper. Reward-distributor top-ups (`fund` is manual). Aquarius vault `rebalance` and `harvest`, XOXNO `harvest` and Zenex `sync`/`harvest` are owner-or-vault-keeper-gated (not permissionless), have no mainnet runner, and the factory `rebalance_idle_cash` is admin-only. A user-created group or market gets no keeper today. `/health` of the group-1 service cannot go green until repay caps are set.

Code finding: current `main` pins price router `14c83a90...` in `deployments/mainnet.json` while all three live groups still use `e04a63e0...`. `group-main.mjs` verifies the router hash, so starting it from current `main` would fail for group 1. The droplet runs the older `bcb7f83` manifest.

## Local validation

On 25 October 2026, `npm run check` passed and `PG_INTEGRATION_TEST=true npm test` passed all 62 tests with no skips. PostgreSQL ran in an isolated temporary directory over a Unix socket; no production database or signing credentials were used. Startup with missing group/manifest configuration exited with a redacted error. These checks do not replace testnet/mainnet execution evidence.

Supplemental review on 25 October 2026 reproduced and fixed unrestricted nested source authorization, stale group topology, lagging margin event checkpoints and gross-only ordinary liquidation valuation. `npm run check` and the revised `PG_INTEGRATION_TEST=true npm test` passed all 71 tests with no skips, including the nested-auth exploit regression, net-value checks, interest refresh whitelist and isolated PostgreSQL journal. No live operation was enabled.
