# 06 Margin agent: `margin-factory` (phase 1) and `margin-controller-custom` (phase 3)

Location: `peridot-markets/contracts/margin-factory` and `peridot-markets/contracts/margin-controller-custom`. Read `00-DROPOFF.md` sections 0 to 7 first.

## Goal

A group owner can add **leveraged margin trading** to the markets they choose and customize it: max leverage, which assets are tradable, slippage, liquidation incentive and protocol fee, and from phase 3 **per-asset max leverage and trading fees**. The owner changes all of it later in the Control Panel.

## What the audited margin-controller offers (verified in `../Peridot-Soroban/peridot-contracts/contracts/margin-controller`, copied to `core/margin-controller`)

- `initialize(admin, peridottroller, swap_adapter, max_leverage)`; `max_leverage` integer 1..=10 (`MAX_LEVERAGE_CAP`), **one value per instance**.
- `set_market(admin, asset, vault)` (which assets are tradable), `set_params(admin, max_leverage)`, `set_max_slippage_bps(admin, bps)` (1e6 scale, default 5%, cap 50%), `set_liquidate_repay_bps`, `set_swap_adapter`.
- `open_position_v2`, `close_position_v2`, `liquidate_position_v2`, `get_position`, `get_user_positions`, `get_health_factor`.
- Liquidation bonus default 8%. Controller side: `set_margin_liquidation_ctrl`, `set_liquidation_incentive`, `set_liquidation_fee`; receipt-vault side: `set_margin_controller`, `init_margin_borrow_state`.
- Past audit fixes: use the **v2** open/close/liquidate paths only.
- Exact wiring order: `../Peridot-Soroban/peridot-contracts/scripts/deploy_margin_controller_testnet.sh`. Replicate it on-chain.
- No open/close fee exists in the audited contract.

**Existing mainnet margin (prior work):** margin controller `CC2MVMWNUSEBJ5ITIKTKTLL3URUPYPGRQB6SWX2HAKEKKXDMYF4EYP5C` with swap adapter `CCEMGF23WSRRR3C343LQ7SVQWGCNEQ2OA7I5VD7FY7FD4HJAYNQFV7BW` and the XLM/USDC Aquarius pool `CBBMQBNH...`; testnet V3 controller `CAKKHUGH...` (global max leverage 5). On `leveraged-fix` read `scripts/deploy_margin_mainnet.sh`, `activate_margin_mainnet.sh`, `canary_margin_mainnet.sh` and `contracts/margin-controller/FEE_ACCOUNTING.md`: that branch's margin-controller already has fee accounting, so check it before writing `margin-controller-custom`; per-asset caps may be the only missing piece.

## Phase 1: `margin-factory` with the audited margin-controller

```rust
fn __constructor(admin: Address, market_factory: Address, wasm_audited: BytesN<32>, wasm_custom: Option<BytesN<32>>, default_swap_adapter: Address);
// called by the group owner; market-factory confirms ownership via a view (get_group) or acts as caller
fn enable_margin(owner: Address, group_id: u32, cfg: GroupMarginConfig) -> Address;
fn update_margin(owner, group_id, cfg: GroupMarginConfig);           // leverage, slippage, incentive, fee
fn set_market_margin(owner, group_id, market: Address, enabled: bool);
fn get_margin(group_id) -> Option<MarginInfo>;                       // address, variant, cfg, enabled markets
fn upgrade(admin, new_wasm_hash); fn set_wasm(admin, audited, custom);
fn upgrade_group_margin(admin, group_id, new_wasm_hash);             // custom: immediate; audited: its built-in path
```

The market factory is admin of the group controller and receipt-vaults, so wiring that touches them (`set_margin_liquidation_ctrl`, `set_margin_controller`, liquidation incentive and fee) must go through the market factory. Agree with the lead on one of: (a) market-factory exposes an internal-only `wire_margin(group_id, margin_controller)` callable only by the margin factory, or (b) margin-factory is a module inside market-factory. Pick (a) unless Wasm size forces (b). Decide in the first hour.

**Swap adapter and pools:** margin swaps and liquidations route through `swap-adapter` with a pool allowlist. Deploy **one swap-adapter per group** from the core Wasm (factory as admin) so the owner can allow the Aquarius/Soroswap pools their markets need, isolated from other groups. Add `set_pool_allowed(owner, group_id, pool, allowed)`.

Guardrails: group max leverage 1..=5; liquidation incentive 102%..115%; slippage at most 10%; a market can be margin-enabled only if a pool for it is allowlisted; AquariusOnly-priced markets cannot be margin-enabled. UI shows effective max per asset: `min(group_max, 1 / (1 - CF))`.

**Liquidations are required on mainnet.** Configure the existing liquidator (`../Peridot-Soroban/peridot-bots/liquidator`) for the demo group in phase 1 (copy it into `peridot-markets/keeper/liquidator` or run it from the reference repo with a config file; document which). Phase 4: make it read all groups from the factory.

## Phase 3: `margin-controller-custom`

Fork `core/margin-controller` (the hackathon copy, already 60s timelock) into `contracts/margin-controller-custom` with **additive** changes only:
- `MaxLeverage(asset)` per-asset cap, checked in the v2 open path in addition to the global cap.
- `open_fee_bps` and `close_fee_bps` (1e6 scale, max 1%) charged on position notional in the collateral asset, sent to a `fee_recipient` (group owner, with an optional Peridot protocol share).
- Plain immediate `upgrade(admin, hash)` replacing the two-step path.
- Keep every v2 audit fix intact. Write the full diff to `docs/PRIOR_WORK.md` under "margin-controller-custom vs audited".

`GroupMarginConfig.variant = Custom` makes `enable_margin` deploy the custom Wasm. Add `set_asset_leverage(owner, group_id, asset, max)` and `set_trading_fees(owner, group_id, open_bps, close_bps, recipient)`. Existing groups stay on what they have; switching variants for a group with open positions is out of scope.

## Frontend helper

`app/src/lib/peridot/margin.ts`: open, close, positions, health factor, effective max leverage per asset, liquidation price estimate, fee preview (phase 3).

## Tests

1. Phase 1: enable margin on a fresh group (core Wasm), open 2x long, close; guardrails reject leverage 6, incentive 120%, market without pool.
2. Liquidation of an underwater position via the liquidator path.
3. Phase 3: per-asset cap rejects 3x when the asset cap is 2x; fees charged and sent; all audited v2 tests still pass on the fork.

## Deliver

SPECS.md "Margin" section, mainnet txs (enable margin, open, close; phase 3 fee-charged open).
