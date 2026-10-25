# Peridot Margin Liquidation Keeper

This service indexes MarginController position lifecycle events and executes the
Perps V3 liquidation flow. Open positions with `get_health_factor <= 1_000_000`
enter through `liquidate_position_v3(liquidator, position_id)`. This atomic call
uses the contract's per-pair liquidation slippage and oracle limits. Simulation
and fee limits can reject it before signing if its resource cost is too high.

Already-started liquidations retain the resumable `swap_liquidation_v3` and
`finish_liquidation_v3` recovery path.

It also resumes abandoned staged liquidations after the takeover timeout,
resolves expired healthy swapped pending opens, expires unswapped pending opens,
and restores expired pre-swap closes. An unsigned resolution simulation that
specifically reports the core health rejection can select atomic liquidation for
an underwater swapped open. Unknown submitted outcomes never trigger fallback.

## Contract Requirements

The controller must expose:

- `get_position_counter`
- `preview_liquidation_v3`
- `position_created` and `position_removed` contract events

The keeper bootstraps all existing IDs from `1..=get_position_counter` on every
restart, then uses events to maintain its active set. `STATE_FILE` is a disposable
index, not the transaction journal. PostgreSQL retains signing intents separately.

## Testnet Setup

Use a dedicated Stellar account. It needs XLM for transaction fees but does not
need the full position debt: V3 liquidation swaps controller-held collateral to
repay the debt vault.

```bash
cp .env.example .env
npm ci
npm test
set -a; source .env; set +a
npm start
```

Start with `DRY_RUN=true`. Dry-run mode simulates `liquidate_position_v3` for an
eligible open position. Recovery of an existing staged liquidation simulates only
its next stage because no state is committed.
Set `RUN_ONCE=true` for a bootstrap/simulation smoke test that exits after one
polling cycle.

`LIQUIDATION_SLIPPAGE_BPS` applies to staged recovery only; the atomic entry uses
the onchain pair settings. In staged recovery it applies to the live Aquarius pool estimate. The
keeper refuses to swap when the pool estimate is below the contract's oracle
minimum and always passes the greater of the oracle floor and slippage-adjusted
pool quote.

## Docker

For the lower-cost Mainnet pilot candidate, see the
[single-droplet deployment package](deploy/droplet/README.md). It keeps PostgreSQL
on persistent disk with verified TLS, starts keyless/dry-run, and does not
provision a server or enable signing automatically.

```bash
docker build -t peridot-margin-liquidator .
docker run -d \
  --name peridot-margin-liquidator \
  --restart unless-stopped \
  --env-file .env \
  -v peridot-liquidator-data:/app/data \
  peridot-margin-liquidator
```

## systemd

Install Node.js 22 or newer, create an unprivileged `peridot` user, put secrets
in `/etc/peridot/margin-liquidator.env` with mode `0600`, and install
`margin-liquidator.service.example` as
`/etc/systemd/system/peridot-margin-liquidator.service`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now peridot-margin-liquidator
sudo journalctl -u peridot-margin-liquidator -f
```

## Operations

### Live Signing Gate

Both Mainnet and Testnet live signing require a dedicated funded key,
`EXPECTED_CONTROLLER_WASM_HASH` and `DATABASE_URL`. The group 1 worker has passed a one-cycle keyless mainnet dry run; no live
liquidation service or funded keeper identity is claimed.

- Use a dedicated PostgreSQL database/user and the direct database endpoint,
  not a transaction-pooling proxy. One persistent connection holds a PostgreSQL
  session advisory lock scoped to network + signing account. Another process
  using that account cannot acquire the lock, even for a different controller.
- TLS certificate verification is mandatory. `DATABASE_CA_FILE` optionally
  supplies a provider CA PEM (`DATABASE_CA_PEM` can supply it directly on App
  Platform instead); URL query parameters that could override TLS are
  rejected. Never use `sslmode=no-verify` or disable certificate verification.
- Default maximum total fee: `MAX_TRANSACTION_FEE_STROOPS=1000000` (0.1 XLM).
  Default rolling 24-hour fee reservation: `MAX_FEE_24H_STROOPS=10000000` (1 XLM).
  Each recorded intent counts its full padded maximum, including failed or
  uncertain transactions. Actual fee refunds do not immediately replenish it.
- The resource-fee allowance is padded by 25% + 10,000 stroops before caps are
  checked. `MIN_FEE_BALANCE_STROOPS=20000000` keeps 2 XLM spendable after the
  maximum fee, in addition to reserve and native selling liabilities.
- Network, controller WASM hash, method/arguments, source authorization root,
  source sequence and fee-account freshness are checked before signing. Admin
  calls, other beneficiaries, unconfigured fee vaults and separate restoration
  preambles are rejected. Deployer/treasury keys must not be used on Mainnet.

These pilot defaults deliberately stop signing when exhausted. Operators must
size the approved daily budget and alerting for expected liquidation traffic;
the defaults are not a promise of unlimited liquidation capacity.

### Uncertain Transactions and Recovery

The keeper commits the unsigned transaction hash, source sequence, deadline,
method and full fee reservation before signing. Neither secret keys nor signed
XDRs are stored in the journal. It sends once and confirms the exact envelope.
Lost responses, timeouts, rejected submissions, changed code/network, unavailable
database and on-chain failures stop signing; fatal errors escape the position
and fee loops. An error is not interpreted as permission to submit a replacement.

On restart, unresolved hashes are queried before position processing. A matching
successful RPC or historical Horizon envelope resolves the intent. `NOT_FOUND`,
expired time bounds or a consumed sequence alone do not clear it. A confirmed
failure remains an operator-review stop. There is no automatic failed/expired
intent retirement in this release: inspect the exact hash and independently
reconcile inclusion and sequence before designing an explicit recovery action.
Never delete rows, switch to an empty database, or reset its contents to restart.
Back up the journal; restoration from an older backup requires reconciliation
against account history before signing can be re-enabled.

Database loss releases the session lock, but any committed pending intent blocks
a replacement worker. Use the same canonical database for all instances and
retain it across releases. A single-node database can cause signing downtime;
continuous liquidation availability needs an appropriate HA/standby strategy.

Tests:

```bash
npm test
# Requires local initdb/pg_ctl. Creates and removes an isolated Unix-socket DB.
PG_INTEGRATION_TEST=true npm test
```

Unit tests cover fee/reserve limits, altered auth/body/network/code, wrong
sequence, lost responses, confirmation mismatch, history fallback, no replay and
fatal propagation. Real PostgreSQL tests cover lock exclusion, durable restart,
rolling fee caps and connection loss. These do not substitute for isolated
Testnet transaction testing and security scan clearance before Mainnet signing.

### Optional V3 Fee Distribution

Only enable this after deploying the reviewed fee-capable controller. Existing
deployments do not expose these new methods; an empty configuration (default)
performs no fee calls.

```bash
FEE_DISTRIBUTION_VAULTS=<RECEIPT_VAULT_ID>,<ANOTHER_RECEIPT_VAULT_ID>
FEE_DISTRIBUTION_INTERVAL_MS=300000
MIN_FEE_UNDERLYING=10000
MIN_FEE_PTOKENS=10000
DRY_RUN=true
```

Use ReceiptVault addresses, not token addresses. The keeper reads
`get_undistributed_margin_fees(vault)` and submits `distribute_margin_fees(vault)`
when either raw-unit threshold is met. These independent thresholds are dust
limits, not estimates of income versus transaction fees. The existing submission
client simulates only in dry-run mode. No account other than the keeper needs to
sign; it cannot choose reward recipients.

Position processing runs first. Pre-submission simulation failures are logged
separately and retried no sooner than the next configured interval. Fatal signing
or journal failures stop the process instead of retrying.
Free-margin providers participate at distribution time, not at the original trade
time. A keeper outage delays rewards but does not hold up user closes. Fees are
reserved on-chain, so restarting does not require reconstructing fee events.
Alert on `margin fee distribution failed` and growing pending inventory.

### General Operations

- Run one active process per signing key to avoid account-sequence collisions.
- A standby keeper should use a different funded key; it can take over after
  the on-chain timeout.
- Use a private authenticated RPC provider for mainnet.
- Keep `HORIZON_URL` configured as an account-sequence fallback. Contract reads,
  simulations, events, and submissions still use `RPC_URL`.
- Store the secret in a server secret manager, never in Git or a Docker image.
- Alert on `position processing failed`, `pool quote ... below oracle floor`,
  low keeper XLM, and repeated transaction timeouts.
- RPC event history is bounded. The persistent cursor plus bootstrap counter
  makes recovery independent of retaining the full event history.

## Scheduled fee budget and alerts

Every startup simulates each scheduled interest and boosted-refresh job without
signing. The `scheduled fee budget estimate` log and `/status.feeBudget` report
padded fee reservations for 24 hours, plus 25% planning headroom and one maximum-fee
operation. This is a startup estimate, not a fee guarantee. Live startup rejects
insufficient daily or per-transaction limits before any worker transaction. Dry runs
remain available and warn when limits are insufficient. Limits are never raised automatically.

For group 1 at 17:42 UTC on 25 October, three jobs at 120-second intervals required
an estimated 62,938,253 stroops per day for refresh reservations, or 79,672,817 with
planning headroom. The configured 10,000,000-stroop daily limit was insufficient.
The absolute floor is 21,846,300 stroops even with zero resource cost, including the
initial run. Any increase requires the operator's approved spending budget. Funding
the account does not change the configured daily cap. Additional liquidations,
recoveries, restarts or other workers sharing this signer consume more budget.

Before enabling signing, run the dry run and review `feeBudget.sufficient`,
`requiredWithHeadroomStroops` and `maxJobFeeStroops`. Configure an external monitor
to alert on an insufficient startup estimate, a stopped process, a missing heartbeat
or `/health` returning 503. Monitor the journal's rolling `SUM(max_fee)` for the
signer's scope and alert before it reaches 80% of `MAX_FEE_24H_STROOPS`. Failed and
unknown transactions still count. At exhaustion the worker stops signing and exits;
do not clear journal rows, switch signer identities or restart to bypass the cap.
Review the estimate, remaining budget and accrued transaction evidence before resuming.

`sync_pairs` remains a permissionless Control Panel recovery action, not an automatic
keeper job. After `apply_pending`, operators must complete that separate transaction
or use the app's Sync leverage limits action from another wallet/browser. No automatic
synchronization coverage is claimed.
