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

_Final text written by Lead A. The signatures below are the contract other agents code against._

Admin model (decided 25 Oct, because core Wasm bakes its initial admin at compile time):

- **market-factory (MF)** is the admin of every contract in a group: controller, receipt-vaults, jump-rate-model,
  price router, reward distributor, yield adapters. Core Wasm is built with `INIT_ADMIN` = MF address.
- **margin-factory (XF)** is the admin of each group's `margin-controller` and `swap-adapter`. Those two Wasm are
  built with `MARGIN_INIT_ADMIN` = XF address. XF deploys and initializes them, runs `set_market`, `set_params`,
  `set_max_slippage_bps`, pool allowlists, upgrades. Anything that must touch the group controller or a receipt-vault
  (admin = MF) goes through MF, which exposes it to XF only:
- Neither factory takes Wasm hashes in its constructor (they depend on the factory address). Hashes are set after
  deploy with `set_wasm`; `create_group` / `enable_margin` revert with `WasmNotSet` until then.
- Unit tests: register the contract that must act as MF at `TEST_ADMIN_ADDRESS` and XF at
  `TEST_MARGIN_FACTORY_ADDRESS` (both in `peridot-interfaces`) with `env.register_at(...)`, and use the Wasm in
  `build/test/` (built by `scripts/build_core.sh`) through `soroban_sdk::contractimport!`.

MF signatures other agents rely on (all `Result<_, FactoryError>`; auth in comments):

```rust
fn __constructor(admin: Address, treasury: Address);
fn set_wasm(admin: Address, wasm: WasmHashes);
fn set_margin_factory(admin: Address, margin_factory: Address);
fn create_group(owner: Address, name: Symbol) -> u32;            // owner auth
fn get_group(group_id: u32) -> Group;
fn get_market_config(group_id: u32, market: Address) -> MarketConfig;
fn market_token(group_id: u32, market: Address) -> Address;      // underlying of a market (receipt-vault)
// XF only (caller == stored margin_factory, caller.require_auth()):
fn wire_margin(caller: Address, group_id: u32, margin_controller: Address,
               liquidation_incentive: u128, liquidation_fee: u128);
   // controller.set_margin_liquidation_ctrl(mc, true); set_liquidation_incentive (STAGED 60s: close factor and
   // liquidation incentive always stage because initialize sets defaults); set_liquidation_fee (immediate);
   // Group.margin_controller = Some(mc); emits MarginEnabled
fn link_margin_market(caller: Address, group_id: u32, market: Address, margin_controller: Option<Address>);
   // receipt_vault.set_margin_controller(MF, margin_controller)
fn update_margin_params(caller: Address, group_id: u32, liquidation_incentive: u128, liquidation_fee: u128);
```

Price router, reward distributor, adapters are deployed by MF with `deploy_v2(hash, ctor_args)` and admin = MF:
`price router __constructor(admin, quote_decimals, resolution)`, `reward distributor __constructor(admin, controller,
reward_token)`, `blend adapter __constructor(admin, market, underlying, cfg)`.

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
