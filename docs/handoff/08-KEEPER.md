# 08 Keeper agent: multi-tenant keeper, hosted or self-hosted

**Phase 2: self-hosted mode (harvest, idle cash), running against mainnet. Phase 4: Peridot-hosted on DigitalOcean + `fund_keeper` subscription.** Location: `peridot-markets/keeper`. The liquidator for margin groups is set up in phase 1 by the margin agent (06); in phase 4 fold it into this package so one service reads all groups from the factory.

Read `00-DROPOFF.md` sections 0 to 7 first.

**Start from what exists:** `peridot-contracts/scripts/run_aquarius_vault_keeper.sh` on the reference branch already runs the Aquarius cycle (refresh the vault's oracle NAV ratio, recenter a concentrated range when needed, harvest on an interval with retry, refresh the market's cached boosted value), and `run_boosted_market_keeper_mainnet.sh` covers boosted markets. Port that exact call sequence into the TypeScript keeper, per vault, rather than inventing a new one. The liquidator and rebalance bot live in `peridot-bots/` on `main`.

You build one keeper codebase that runs in two modes:

- **Peridot-hosted**: Peridot runs it on our DigitalOcean account. Group owners pay a subscription on-chain (`fund_keeper` in the factory). The hosted keeper serves every group whose `keeper_mode == PeridotHosted` and `keeper_paid_until > now`.
- **Self-hosted**: anyone runs the same code with their own key and pays nothing to Peridot (only their own network fees). The owner sets `KeeperMode::SelfHosted(their_address)` and the factory calls `set_keeper` on the group's vaults.

## Location and stack

`keeper/` (new package, TypeScript, Node 20). Reuse `SorobanClient` patterns from `../Peridot-Soroban/peridot-bots/liquidator/src/contracts.ts` (copy, do not import across packages). Files: `config.ts`, `registry.ts` (reads groups from the factory), `jobs/harvest.ts`, `jobs/rebalance.ts`, `jobs/idleCash.ts` (port of `rebalanceBot.ts` logic per market), `index.ts`.

## Behaviour

Loop every `POLL_MS`:
1. **Registry**: hosted mode reads `list_groups` from the factory and keeps groups that are `PeridotHosted` and paid. Self-hosted mode takes `GROUP_IDS` (or `VAULTS`) from env and checks that `KEEPER_SECRET`'s address is the configured keeper.
2. **Harvest** for each vault: read `get_state`; for Aquarius read pending AQUA; if above `MIN_HARVEST_USD` (priced via the group's price router or Reflector), quote the swap, apply `MAX_SLIPPAGE_BPS`, call `harvest(keeper, min_out)`.
3. **Rebalance** (Aquarius CL only): if price is outside or near the range edge, call `rebalance`.
4. **Zenex sync** (phase 3): for each `zenex` vault call `sync(keeper)` every few minutes; Zenex's own keepers fill the orders.
5. **Idle cash**: per market, if idle cash exceeds 2x the target buffer, call the market's `rebalance_idle_cash` (permissionless in receipt-vault; verify).
5. Log one JSON line per action with group, vault, tx hash; expose `/health` and `/status` (JSON: groups served, last run, last tx per vault) on `PORT`.

Safety: simulate every tx first; skip if fee estimate exceeds `MAX_FEE_XLM`; backoff on errors per vault; never hold user funds; the keeper key only needs XLM for fees.

## Hosted deployment (DigitalOcean)

- `Dockerfile` (multi-stage, non-root user) and `docker-compose.yml`.
- `.do/app.yaml` for DigitalOcean App Platform as a **worker** component with an HTTP health check, env vars declared as secrets (`KEEPER_SECRET`, `NETWORK`, `RPC_URL`, `FACTORY_ID`). Alternative: `deploy/droplet.md` with a systemd unit (Peridot already runs services with systemd).
- Never commit secrets. Joshua provides the DigitalOcean access token and keeper key at deploy time; write `deploy/README.md` with the exact `doctl apps create --spec .do/app.yaml` steps.
- The hosted keeper's public address is set in the factory with `set_keeper_pricing(..., hosted_keeper)`, so `set_keeper_mode(PeridotHosted)` wires vaults to it.

## Self-host package

- `docs/KEEPER.md`: what the keeper does, cost (only network fees), how to run: `docker run -e KEEPER_SECRET=... -e GROUP_IDS=3 -e NETWORK=testnet ghcr.io/peridotfinance/peridot-keeper` or `npm ci && npm start`, and how to switch the group to self-hosted in the Control Panel.
- GitHub Actions workflow to build and push the image to GHCR on the branch (optional if time).

## Subscription logic (factory side, coordinate with the lead)

`fund_keeper(payer, group_id, token, periods)`: transfers `price_per_30d * periods` from payer to Peridot's treasury, extends `keeper_paid_until` from `max(now, paid_until)`. Accepted token: USDC (or XLM via SAC). Emits `KeeperFunded`. If it expires, the hosted keeper stops serving the group, and the UI shows "Keeper inactive" with an extend button. Keep pricing a placeholder value on testnet.

## Tests

Unit tests for registry filtering (paid vs unpaid, hosted vs self-hosted) and harvest decision thresholds with mocked RPC. A testnet run harvesting at least one Aquarius vault, tx hash into DEMO.md.

## Deliver

Running hosted keeper (URL of `/status`), Docker image, KEEPER.md, SPECS.md section "Keeper".
