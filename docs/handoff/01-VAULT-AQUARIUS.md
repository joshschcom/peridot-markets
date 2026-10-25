# 01 Vault agent: Aquarius route (existing `aquarius-lp-vault` + new loss reserve)

**Phase 2.** Read `00-DROPOFF.md` sections 0 to 7 and `11-ADDRESSES.md` (Aquarius and "Peridot existing deployments") first.

**Do not build an Aquarius vault from scratch.** Peridot already has one: `peridot-contracts/contracts/aquarius-lp-vault` on the `leveraged-fix` branch (about 10k lines, tests included, mainnet pilot live). It is imported unchanged into `core/aquarius-lp-vault` (only its upgrade timelock is set to 60s, see 00 §0). Your job is to plug it into the factory and add the **loss reserve**, which it does not have.

## What the existing vault already does (read `src/contract.rs`, `src/pool.rs`, `src/oracle.rs`)

- Sits behind a `receipt-vault` boosted hook: `deposit(amounts_desired, amounts_min, from, invest) -> i128`, `withdraw(withdraw_shares, min_amounts_out, from) -> Vec<i128>`, `get_asset_amounts_per_shares(shares)`. `deposit` accepts only the bound receipt vault (`from != receipt_vault` panics) and relies on the receipt vault pre-authorizing the token transfer.
- `initialize(admin, pool, underlying_index: u32, oracle)`: the pool must report `pool_type() == "concentrated"`; `underlying_index` (0 or 1) says which side of the pair the market's underlying is.
- Range: `full_range_bounds` for stable pairs (USDC/EURC, PYUSD/USDC) or `centered_range` with `set_range_policy(admin, half_width_ticks, rebalance_margin_ticks, rebalance_cooldown, max_rebalance_divergence_bps, ...)`; keeper-callable `rebalance(caller)`. Mainnet pilot uses a 40-tick half-width.
- `harvest(caller)`: claims AQUA and sells it along a configured reward route (AQUA/USDC pool `CA6GAFOJ...`, AQUA/PYUSD pool `CADFWSBB...`). Getters: `get_last_harvest`, `get_reward_route`, `get_reward_min_rate`, `get_position_amounts`, `get_ticks`, `get_idle`, `get_params`.
- Oracle NAV and a pool-divergence check (`max_pool_divergence_bps`, 2% default on mainnet; testnet needed 1500 because the testnet pool sits about 7% off Reflector). Point `oracle` at the group's price router.
- Build flags: keep default features. `hybrid-rewards` and `lp-receipt-prototype` refuse to compile for wasm on purpose.
- Mainnet pilot (prior work, do not touch): XLM/yXLM and PYUSD/USDC strategies listed in 11. Known-good mainnet pools: USDC/EURC concentrated 0.3% `CDTSE6RL...`, XLM/yXLM concentrated 0.1% `CADMDTCQ...`, PYUSD/USDC concentrated 0.1% `CAPIOQNU...`. Use `get_pools(tokens)` on the router to discover others; the Aquarius API listing is incomplete.

## New work 1: factory integration (phase 2 core)

- `YieldRoute::Aquarius { pool, underlying_index, range: RangeMode /* FullRange | Centered { half_width_ticks } */, reserve_cut_bps, reserve_cap_bps }`.
- `attach_yield` for this route: deploy `core/aquarius-lp-vault` (and the reserve wrapper below), `initialize` it with the group price router as oracle, set range policy and reward route, bind it to the market, `set_boosted_vault` + `bind_boosted_vault`. Copy the call order from `scripts/deploy_aquarius_lp_market_mainnet.sh` and `rollout_aquarius_stable40_mainnet.sh` on the reference branch.
- Guardrails: pool must be concentrated (the vault enforces it); stable pairs default to `FullRange`; market `idle_buffer_bps` at least 30% (the pilot uses 30%); supply cap required.
- Wizard pool picker: only pools from `get_pools` whose `pool_type` is `concentrated`, showing fee tier and TVL.

## New work 2: the loss reserve (the hackathon feature)

Preferred: a new wrapper crate `contracts/aquarius-loss-reserve` that is the market's boosted vault and holds the inner vault's shares. It implements the `YieldVault` interface (00 §6.1) towards the market and is **bound as the receipt vault** of the inner `aquarius-lp-vault`.

- Check first how the inner vault binds its receipt vault (`bind`, `bound_receipt_vault`, `get_receipt_vault`) and whether it calls back into the receipt vault (it exposes `get_ptoken_balance`, `get_exchange_rate`, `borrow` and similar receipt-shaped functions). If it calls back into receipt-vault functions the wrapper cannot reasonably serve, fall back to option B and tell the lead.
- Wrapper storage: `principal`, `reserve` (underlying held by the wrapper, never deployed), `reserve_cut_bps` (default 3000), `reserve_cap_bps` (default 1000 of principal).
- `deposit`: pull from the market, forward to the inner vault (authorize the exact transfer as current contract, as receipt-vault does), mint wrapper shares, `principal += amount`.
- `withdraw`: redeem inner shares pro rata, add pro-rata `cover`, pay the market, `principal -= pro-rata`.
- `total_value = inner_value + min(max(0, principal - inner_value), reserve)`.
- `harvest(keeper)`: call the inner `harvest` (the wrapper is its caller), measure underlying received, move `reserve_cut_bps` of it into `reserve` up to the cap, redeposit the rest. If the inner harvest pays straight into the inner position instead of the caller, compute the gain from `get_asset_amounts_per_shares` before and after, and fund the reserve by redeeming that slice.
- Option B (only if A is blocked): an additive `loss_reserve` module in a copy named `contracts/aquarius-lp-vault-reserve`, with the diff documented line by line in `docs/PRIOR_WORK.md`.

## Tests

Use `core/mocks/mock-aquarius-pool` and `mock-depth-fixture` plus the inner vault's own test helpers.
1. Market to wrapper to inner vault round trip.
2. IL scenario: funded reserve returns principal; empty reserve returns LP value.
3. Harvest split and cap.
4. Non-market deposit rejected; non-keeper harvest rejected.

## Deliver

Mainnet: one group market routed through the wrapper on USDC/EURC (`CDTSE6RL...`) or PYUSD/USDC (`CAPIOQNU...`), seeded with team funds and small caps, one real harvest tx with AQUA. SPECS.md "Aquarius route" section (what is existing vs new). CL range management on volatile pairs (centered mode with keeper rebalancing) is already in the inner vault: expose it in the factory in phase 4 if time remains.
