# Peridot Markets: contract specs

Owner: Lead A. Each contract agent writes only its own section. Contract IDs live in
`deployments/<network>.json` (written by `scripts/deploy.sh`, never by hand).

## Conventions

- Core lending contracts are Peridot's audited contracts (`core/`, imported from Peridot-Soroban@47858c1)
  with one change for the hackathon: upgrade and admin-parameter timelocks shortened from 24h to 60s.
- New contracts: `__constructor`, `#[contracterror]` enums, `require_auth` on privileged calls, events on every
  state change, TTL bumps on persistent keys, `upgrade(admin, new_wasm_hash)` with immediate effect.
- Scales: collateral factor, reserve factor, liquidation incentive, close factor in 1e6. Slippage 1e6.
- Compile-time admin: every core Wasm bakes in its permitted initial admin (`*_INIT_ADMIN`). Wasm built for a
  network uses INIT_ADMIN = that network's market-factory address, so the factory (as admin) is the only account
  that can initialize group contracts. See `scripts/build_core.sh` and "Factory" below.

## Factory

_Written by Lead A._

## Rewards

_Rewards agent (09)._

## Price router

_Price router agent (05)._

## Blend route

_Blend adapter agent (02)._

## DeFindex route

_DeFindex agent (04)._

## Margin

_Margin agent (06)._
