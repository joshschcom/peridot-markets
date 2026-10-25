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

`contracts/reward-distributor`. One per group, deployed by the market-factory (admin = MF) with
`__constructor(admin, controller, reward_token)`, then registered once with `controller.set_peridot_token(distributor)`
(permanent for the group; the UI must say so). Wasm about 9.6 KB, 16 native tests against the real core Wasm.

- **What the core controller really calls (differs from the early handoff note).** `claim` does not call `mint`. For
  the configured reward token it reads `balance(controller)`, sets `payable = min(balance, accrued)`, and invokes
  `transfer(controller, user, payable)` with the controller authorizing as the current contract. A zero balance or a
  failed transfer is a soft failure (claim-failed event, accrued kept); on success it subtracts exactly `payable`, so
  partial payouts are correct and the rest stays claimable. `set_peridot_token` only stores the address, nothing is
  called on the token at set time. The distributor therefore exposes SEP-41-shaped `balance(id)` (the funded pool for
  the controller, 0 for everyone else) and `transfer(from, to, amount)` (`from` must be the controller; pays the real
  token or fails with no partial payout). `mint(to, amount)` is kept as a controller-auth alias for the trait client.
- **Funding and custody.** `fund(from, amount)` is open to anyone with auth (Funded event). `balance_available()` is
  the real token balance held by the contract, `total_paid()` / `total_funded()` / `total_withdrawn()` are running
  totals. Amounts <= 0 are rejected everywhere.
- **Admin (factory) only:** `withdraw_unallocated(admin, to, amount)` (Withdrawn event) and `upgrade(admin, hash)`
  (immediate). Withdrawing can leave accrued rewards unclaimable until the pool is refunded; the controller keeps
  the accrued balance meanwhile. Admin is checked against the stored admin and `require_auth` is called on it.
- **Views:** `reward_token`, `controller`, `admin`, `balance_available`, `total_paid`, and `decimals` / `symbol` /
  `name` forwarded to the real token. Speeds are reward-token base units per second per market, set on the
  controller (`set_supply_speed` / `set_borrow_speed`, max 1e12), not on the distributor; runway is
  `balance_available / sum(speeds)`.
- **Errors** (`RewardError`): AlreadyInitialized 1, NotInitialized 2, Unauthorized 3, InvalidAmount 4,
  InsufficientBalance 5, MathOverflow 6, InvalidAddress 7. Events: `funded`, `paid`, `withdrawn`, `upgraded`.

## Price router

Crate `contracts/price-router-ext` (Wasm `price_router_ext.wasm`, about 14 KB optimized). One instance per group,
deployed by the market-factory (`deploy_v2`), admin = market-factory, set as the group controller's oracle.

**Why standalone and not a wrapper around `core/price-router`:** the core router bakes its initial admin at compile
time (`INIT_ADMIN`), is configured with `initialize`/`set_source`/`set_upstream` around a single upstream feed, and has
a different ABI (no `set_asset_config`/`check`). The factory needs a constructor, one config per token with an oracle
address and asset key chosen by the group owner, and the `PriceRouter` trait. A direct Reflector reader is about 300
lines, adds no new audited surface to `core/`, and can be live today. The core router stays the tool for yXLM-style peg
and Aquarius-bounded sources.

ABI (the `PriceRouter` trait in `peridot-interfaces`, plus `admin()`). `set_asset_config` and `upgrade` return
`Result<(), RouterError>` instead of `()`: Ok encodes as void, so `PriceRouterClient` callers are unaffected, and
failures carry a typed code.

```rust
fn __constructor(admin: Address, quote_decimals: u32 /* <= 38, 14 */, resolution: u32 /* > 0, seconds, 300 */);
fn decimals() -> u32;                 // quote_decimals
fn resolution() -> u32;               // constructor value
fn lastprice(asset: Asset) -> Option<PriceData>;   // only Asset::Stellar(token); Other(_) -> None
fn set_asset_config(admin, token, cfg: PriceConfig) -> Result<(), RouterError>;   // admin == factory, auth
fn get_asset_config(token) -> Option<PriceConfig>;
fn check(token) -> PriceCheck;        // never panics
fn upgrade(admin, new_wasm_hash) -> Result<(), RouterError>;   // immediate
// RouterError: 1 NotAdmin, 2 UnsupportedMode, 3 InvalidOracle, 4 SelfOracle, 5 AssetNotOnFeed, 6 InvalidParams
```

- **Pricing (`ReflectorOnly(ReflectorOnlyCfg { oracle, asset })`):** the controller sends `Asset::Stellar(token)` (the
  factory never sets oracle asset symbols). The router reads `oracle.decimals()` and `oracle.lastprice(cfg.asset)` through
  `try_` clients, rescales the price from the feed's decimals to `decimals()` with checked arithmetic (scaling down
  rounds toward zero), and returns the feed's own timestamp. `asset` is `Other(symbol)` on the external CEX/DEX feed or
  `Stellar(token)` on the Stellar-assets feed. Missing config, a failed or trapping oracle, `None`, a non-positive price,
  an overflow or a result that rounds to zero all return `None`. The factory sets no fallback prices, so `None` means
  "price unavailable": borrows and liquidations for that market are blocked (the circuit breaker).
- **Staleness is the controller's call.** The router never filters by age. The controller rejects a price when
  `timestamp > now` or `timestamp + k * resolution < now` (k = 2 by default, `resolution` read from the router), and it
  may reuse its last good cached price inside that window, so a cleared or stale feed blocks borrows once the feed
  timestamp is older than 2 * resolution (600 s). `check(token)` applies the same rule: `mode` is "reflector" (or "none"
  without a config), `status` is "ok" | "stale" | "unavailable" ("deviation" is reserved for phase 3), `reflector_price`
  is the rescaled price and `timestamp` the feed timestamp.
- **Guardrails in `set_asset_config`:** admin only; the oracle must answer `decimals()` (<= 38) and `assets()`, must not
  be the router itself, and the asset key must be listed in the feed's `assets()`. Phase 3 modes
  (`ReflectorWithAquariusGuard`, `AquariusOnly`) are rejected with `UnsupportedMode` and resolve to unavailable; all mode
  handling sits in `price_for`, `validate` and `mode_symbol`, one `match` each. Events: `asset_cfg {token, mode, config}`
  and `upgraded {wasm_hash}`. Config entries and instance storage are TTL-bumped on writes and reads.
- **Controller facts verified against `core/simple-peridottroller`:** `set_oracle` calls `decimals()` (<= 38) and
  `resolution()` (non-zero); the first oracle on a fresh controller applies immediately, later changes stage for 60 s.
  Pricing calls `decimals`, `lastprice` and `resolution` via `try_invoke_contract` and treats the price as USD at
  `decimals()`.
- **Reflector facts (read on 25 Oct 2026):** all four feeds report `decimals` 14 and `resolution` 300, timestamps are in
  seconds. The mainnet Stellar-assets feed (52 assets) is quoted in Circle USDC (its `base()`), so USDC itself is not
  listed there: price USDC with `Other("USDC")` on the external feed (16 symbols: BTC ETH USDT XRP SOL USDC ADA AVAX DOT
  MATIC LINK DAI ATOM XLM UNI EURC; the testnet external feed lists the same). The mainnet Stellar feed covers native
  XLM, AQUA, EURC and PYUSD but not BLND or yXLM. The testnet Stellar feed lists only 9 assets and not the XLM, USDC or
  BLND testnet tokens from 11-ADDRESSES, so use the external feed with symbols on testnet. The wizard should call
  `assets()` on both feeds to build its price picker.

## Blend route

_Blend adapter agent (02)._

## DeFindex route

No new contract. A DeFindex vault is a SEP-41 share token plus `deposit`/`withdraw`, and the core receipt-vault
boosted hook calls it directly. Verified read-only on 25 Oct 2026 with `stellar contract info interface` and
`--send=no` simulations (no transactions). Vault Wasm hash per factory: mainnet `ae3409a4...`, testnet `f345228d...`.

### Verified vaults

All underlying assets match `11-ADDRESSES.md` (USDC `CCW67TSZ...`, XLM `CAS3J7GY...`, EURC `CDTKPWPL...` on mainnet).
Every vault is single-asset, 7 decimals, with the same function set. `11-ADDRESSES.md` and Peridot `addresses.md`
agree on every address (no disagreement). Each listed strategy contract exists and reports the matching `asset()`.

| Network | Vault | Address | Asset | Strategies | State on 25 Oct |
|---|---|---|---|---|---|
| mainnet | Peridot XLM | `CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK` | XLM | 1 (`CDPWNUW7...` XLM Blend Fixed, active) | fully invested, 41.8k XLM, share price 1.0002 |
| mainnet | Peridot USDC | `CAB4JOLSCNELJVDQKZLVGHKWJCLXFDBZZMITJAFL4GBGTHIKWO47PYFH` | USDC | 1 (`CDB2WMKQ...` USDC Blend Fixed, active) | fully invested, 7.5k USDC, share price 1.0354 |
| mainnet | Peridot EURC | `CBP2R5KYAWJCOCVDTSNTEVL3O6JBTWOOH7SZOX7DX5DLGVZCAMLBDZM3` | EURC | 1 (`CC5CE6MW...` EURC Blend Fixed, active) | fully invested, 2.8k EURC, share price 1.0193 |
| mainnet | Soroswap USDC | `CA2FIPJ7U6BG3N7EOZFI74XPJZOEOD4TYWXFVCIO5VDCHTVAGS6F4UKK` | USDC | 2, **both paused** | **do not attach**: 100% idle (40.1k USDC), share price 0.934 |
| mainnet | Soroswap EURC | `CCKTLDG6I2MMJCKFWXXBXMA42LJ3XN2IOW6M7TK6EWNPJTS736ETFF2N` | EURC | 2 (Yieldblox paused, Fixed active) | invested 1.9k EURC, share price 1.0278, third-party manager |
| testnet | DeFindex USDC | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` | Blend testnet mock USDC `CAQCFVLO...` (not Circle's `CBIELTK6...`) | 1 (`CALLOM5I...`) | 100% idle, manager is DeFindex |
| testnet | DeFindex XLM | `CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6` | XLM `CDLZFC3S...` | 1 (`CDVLOSPJ...`) | 100% idle, share price 1667 (donation inflated), manager is DeFindex |

Factories (same interface on both networks): mainnet `CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI`
(124 vaults, `defindex_fee` 5000 bps), testnet `CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32` (273 vaults,
`defindex_fee` 2000 bps). Strategies (verified): mainnet USDC `CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP`,
XLM `CDPWNUW7UMCSVO36VAJSQHQECISPJLCVPDASKHRC5SEROAAZDUQ5DG2Z`, EURC `CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI`;
testnet USDC (mock) `CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY`, XLM `CDVLOSPJPQOTB6ZCWO5VSGTOLGMKTXSFWYTUP572GTPNOWX4F76X3HPM`.
Peridot's three core receipt-vaults hold over 99.9% of the shares of their Peridot DeFindex vault (the rest is dust from
other small holders plus the 1000 locked `MINIMUM_LIQUIDITY` shares), so those vaults are effectively single-depositor today.

### Interface: what receipt-vault calls vs the deployed vault

| Call | Deployed signature | Receipt-vault usage | Difference |
|---|---|---|---|
| `deposit` | `(amounts_desired: Vec<i128>, amounts_min: Vec<i128>, from: Address, invest: bool) -> Result<(Vec<i128>, i128, Option<Vec<Option<AssetInvestmentAllocation>>>), ContractError>` | `invoke_contract` with `([amt], [amt], self, true)`; return decoded as opaque `Val` | None. The tuple return is never decoded, so it is tolerated; the effect is verified by comparing the market's own token cash before and after. `amounts_min == amounts_desired`, so any shortfall reverts. Only the underlying `transfer(self, vault, amt)` is pre-authorized. |
| `withdraw` | `(withdraw_shares: i128, min_amounts_out: Vec<i128>, from: Address) -> Result<Vec<i128>, ContractError>` | `try_call_contract` with `(shares, [needed_cash, 0, ...], self)`; return ignored, cash received measured by balance diff | None. `min_amounts_out.len()` must equal the asset count (else `WrongAmountsLength`); receipt-vault stores that count at bind time. |
| `get_asset_amounts_per_shares` | `(vault_shares: i128) -> Result<Vec<i128>, ContractError>` | `(0)` at bind (asset count), `(share_balance)` for NAV, `(total_supply)` for redemption sizing; element 0 is the underlying | None. `(0)` returns `[0]`. |
| `balance` | `(id: Address) -> i128` (SEP-41) | `balance(receipt_vault)` = shares held | None. |
| `total_supply` | `() -> i128` (SEP-41) | read in `redeem_from_boosted` | None. The boosted vault MUST also be a share token with `total_supply`. |
| `get_assets` | `() -> Result<Vec<AssetStrategySet{address, strategies: Vec<Strategy{address,name,paused}>}>, ContractError>` | not called | Needed by the factory check below. |
| `fetch_total_managed_funds` | `() -> Result<Vec<CurrentAssetInvestmentAllocation{asset, idle_amount, invested_amount, strategy_allocations: Vec<{amount,paused,strategy_address}>, total_amount}>, ContractError>` | not called | Frontend only. |

`11-ADDRESSES.md` section "Vault interface" is correct (verified against deployed spec and against
`paltalabs/defindex` `apps/contracts/vault`). Notes on receipt-vault and the controller:

- Receipt-vault does not check that the vault's asset equals the market underlying or that it is single-asset
  (`MAX_BOOSTED_ASSETS` is 16). The factory must.
- `set_boosted_vault` calls `get_asset_amounts_per_shares(0)` (panics if the contract is not DeFindex-shaped) and the
  controller's `bind_boosted_vault` (one vault per market within one controller; a vault owned by another market of
  that controller reverts with "boosted vault already assigned"). A different controller does not collide.
- Deposits below `MIN_BOOSTED_DEPLOY_AMOUNT` (10_000 stroops) are skipped.
- `refresh_boosted_underlying` is permissionless and must run at least every 5 minutes, otherwise account-health checks
  revert with "boosted health cache stale". `rebalance_idle_cash` is admin only (factory needs a keeper pass-through).
- A DeFindex failure on withdraw is fail-soft (event, then "withdraw liquidity shortfall"); on deposit it reverts the
  `rebalance_idle_cash` call.

### Behaviour that matters for a lending market

- **Withdraw** burns shares and pays the pro-rata share of `total_amount` in the underlying immediately, in the same
  transaction: idle funds first, then it unwinds strategies proportionally. No lockup, no cooldown, no withdraw fee.
  Fees are a performance fee on yield, locked out of `total_amount` on every deposit, withdraw and quote (`get_fees`
  returns `(vault_fee_bps, defindex_share_bps)`: Peridot vaults `[100, 5000]`, Soroswap `[2000, 2000]`, testnet `[100, 2000]`).
  The only limit is the strategy's own liquidity: a Blend strategy returns only what its pool can pay out, so a
  high-utilization pool can revert the unwind (strategy errors 142/412). Funds in a paused strategy are not
  available to users until the manager unpauses it or runs `rescue` (moves the funds to vault idle and pauses it).
- **`invest` flag.** Receipt-vault always passes `true`. DeFindex then splits the deposit "in the same proportion as the
  funds already invested" (`generate_investment_allocations`, source-confirmed). If `invested_amount == 0` (new vault or
  fully idle) nothing is invested and the deposit stays idle, earning 0, until the Manager or Rebalance Manager runs
  `rebalance([Invest(strategy, amount)])`. Paused strategies are skipped. Seen on chain: both testnet vaults and the
  mainnet Soroswap USDC vault are 100% idle. Idle funds still count in `total_amount`, so NAV and withdrawals work; only
  yield is missing.
- **First deposit.** 1000 shares are locked to the vault (`MINIMUM_LIQUIDITY`). Share price is `total_amount / total_supply`
  and moves with donations (testnet XLM vault: 1667). Seed a new vault before a market attaches to it.
- **Roles.** Manager (rebalance, pause, `set_manager`, `upgrade` if `upgradable`), Emergency Manager (pause, rescue),
  Rebalance Manager (Invest, Unwind, swaps), Fee Receiver. A third-party manager of a public vault can pause
  strategies or upgrade it. Peridot vaults: manager and fee receiver are `GDYDTMY46RNAUIIUVG6RPD2D3I3ES4J2SSXGCKIQP2OET4Q5PV75LSPL`.

### Attach validation (factory `attach_yield` with `YieldRoute::Defindex(DefindexRoute { vault })`)

Lead A must code all of these before `set_boosted_vault`, each with its own error:

1. `get_assets()` succeeds, has exactly 1 entry, and `get_assets()[0].address == market underlying`
   (`market_token(group_id, market)`).
2. That entry has at least 1 strategy and at least 1 with `paused == false`. Reject all-paused vaults (mainnet
   Soroswap USDC today).
3. `get_asset_amounts_per_shares(0)` returns a vector of length 1 (receipt-vault stores this as the asset count;
   `get_boosted_asset_count()` must read 1 after binding).
4. The vault has `total_supply() > 0` (seeded). Do not check share `decimals()` against the underlying: receipt-vault
   never uses it (only `balance`, `total_supply`, `get_asset_amounts_per_shares`), and DeFindex shares are 7 decimals.
5. `get_boosted_vault_owner(vault)` on the group controller is `None` (not bound to another market).
6. Trust gate, per group config: either the vault was created by the Peridot flow below, or `get_manager()` is in a
   factory-held allowlist, or the group owner explicitly flags "third-party vault" (UI shows manager and `upgradable`).
7. After `set_boosted_vault` call `refresh_boosted_underlying()` once and require `get_boosted_vault() == vault`.
   Before detaching (`set_boosted_vault` to the disabled address) redeem the market's shares to cash, otherwise they
   are orphaned.
8. Testnet: the `11-ADDRESSES.md` testnet USDC vault uses Blend's mock USDC `CAQCFVLO...`, not Circle testnet USDC
   `CBIELTK6...`, so rule 1 correctly rejects it for a Circle-USDC market. Use a market on that mock token, or own vault.

### Factory: creating a per-group vault

`create_defindex_vault` has no `require_auth` at the factory entrypoint (it deploys and initializes the vault Wasm; the
internal `create_vault_internal` was not audited here):

```
create_defindex_vault(
  roles: Map<u32, Address>,      // 0 EmergencyManager, 1 FeeReceiver, 2 Manager, 3 RebalanceManager (all four required)
  vault_fee: u32,                // bps, 0..=9000 (above 9000 reverts MaximumFeeExceeded 106)
  assets: Vec<AssetStrategySet>, // [{ address: UNDERLYING, strategies: [{ address: STRATEGY, name: String, paused: false }] }]
  soroswap_router: Address,      // required argument, used only for swaps between assets (irrelevant with one asset)
  name_symbol: Map<String, String>, // keys "name" and "symbol"
  upgradable: bool               // false recommended
) -> Address
```

`create_defindex_vault_deposit(caller, roles, vault_fee, assets, soroswap_router, name_symbol, upgradable, amounts)`
(caller auths, `amounts.len() == assets.len()`) creates the vault and makes the seed deposit in one transaction: use it
so the first share price is set by Peridot. The seed shares go to the caller. Strategy `name` is a free string; reuse the
existing ones (for example `usdc_blend_autocompound_fixed`). More mainnet strategies from the DeFindex docs: USDC
Etherfuse `CCBTSHPUVNKCT5V675AAVYNANHXBU26PTZK2QLS7ZLFNYRJZT5HW3VL6`, USDC K2 `CAOK66QTVE2QXWJPDXDX75ULFKUQDN43AXKYWOBZAERCPZOJL2UEBVJW`.

Lead A needs: a Soroswap router address per network (not in `11-ADDRESSES.md`; take it from the Soroswap deployment
list or from the existing vaults' constructor args), the role addresses, and seed funds. Roles: Manager and Emergency
Manager = Peridot ops key or multisig, Rebalance Manager = keeper key, Fee Receiver = Peridot treasury. If the
market-factory contract itself creates the vault, it cannot act as Manager or seed it, so create vaults from an ops key
in `scripts/deploy.sh` and pass the address to `attach_yield`. **After creation the Rebalance Manager must run
`rebalance(caller, [Invest(strategy, seed_amount)])` once**, otherwise every `invest=true` deposit from the market stays
idle and the market earns nothing. Keeper task: after each `rebalance_idle_cash`, if `idle_amount / total_amount` of the
vault is above a threshold, run `Invest`.

### Recommendation for phase 1

- Core Peridot markets keep their own three vaults (bound, fully invested, single depositor).
- New group markets: create **one vault per market** with the flow above (seed, one strategy, Invest once). Shares are
  accounted per holder, so a shared vault does not mix balances, but it does share (a) the strategy and Blend pool
  liquidity (one group's large exit can drain idle and push another group into "withdraw liquidity shortfall"), (b) the
  manager's pause and upgrade powers, (c) share-price noise from donations. A per-market vault isolates all three and lets
  each group show its own APY. Cost: one create, one seed, one Invest transaction.
- Short-time fallback: attach a Peridot XLM, USDC or EURC vault to a group market, only under a separate group controller
  (so `bind_boosted_vault` does not collide), with a shared-risk note in the UI. Never attach the Soroswap USDC vault.
  The Soroswap EURC vault works but is third-party managed (rule 6).
- Keeper runs `refresh_boosted_underlying` at most every 5 minutes for every DeFindex market.

### Frontend reads (no `kind` or `get_state` on DeFindex vaults)

All simulations, no auth. `V` = boosted vault, `M` = the market's receipt-vault.

| Need | Call | Result |
|---|---|---|
| Is a DeFindex route set | `M.get_boosted_vault()` | `Option<Address>` |
| Underlying and strategies | `V.get_assets()` | `[{address, strategies:[{address,name,paused}]}]` |
| Share price | `V.get_asset_amounts_per_shares(10_000_000)[0] / 1e7` (7-decimal vaults; use `10^decimals`) | underlying per share |
| Market's position | shares `V.balance(M)`, value `V.get_asset_amounts_per_shares(shares)[0]` | underlying held in the vault by this market |
| Vault TVL, idle vs invested | `V.fetch_total_managed_funds()[0]` (`idle_amount`, `invested_amount`, `total_amount`, per-strategy `amount`, `paused`) | idle share above 0 means yield not fully deployed |
| Fees and roles | `V.get_fees()` returns `[vault_fee_bps, defindex_share_bps]`; `V.get_manager()`, `V.get_fee_receiver()` | trust display |
| Market value used for health | `M.get_total_underlying()` | cash plus cached boosted value |

APY hint, in order of preference:
1. DeFindex API: `GET https://api.defindex.io/vault/{V}/apy?network=mainnet|testnet` returns `{ "apy": 19.4 }`, a
   percentage, 7-day annualized, net of vault fee, with compounding. The quickstart says requests carry
   `Authorization: Bearer sk_...` (key from the DeFindex Console) while the endpoint spec lists no security scheme: test
   unauthenticated first. Call it server side only (Next route handler), cache for minutes, never ship a key to the
   browser. Related: `/vault/{V}` (info, TVL), `/vault/{V}/balance`; docs at `docs.defindex.io/api-reference/vaults/*`. No JS
   SDK package is documented, only HTTP.
2. Fallback in app or keeper: store `(timestamp, share_price)` and annualize `(pps_now / pps_then)^(365d / dt) - 1`.
3. A new or fully idle vault shows APY 0: show "not yet invested" using `idle_amount / total_amount` instead.

### Risks

- A fresh vault earns nothing until `Invest` runs (above). Biggest functional trap for the demo.
- Strategy liquidity: Blend utilization can block large withdrawals. Keep `set_idle_cash_buffer_bps` above 0 for DeFindex
  markets (core uses 10%); withdrawals beyond cash plus unwindable funds fail with "withdraw liquidity shortfall".
- Paused or rescued strategies: funds go idle in the vault but stay in NAV. If a strategy is impaired,
  `get_asset_amounts_per_shares` falls and the market is marked down (a one-step drop above 10% is distrusted for
  redemption sizing, `BOOSTED_REDEMPTION_QUOTE_FLOOR_BPS`). Soroswap USDC share price 0.934 shows this can happen.
- Third-party managers can pause, upgrade (if `upgradable`) and change fees; fee changes reduce NAV.
- Donation manipulation of share price on small or new vaults: seed before attach.
- Testnet vaults are managed by DeFindex and 100% idle, so a testnet yield demo shows 0%. For real movement create an
  own testnet vault with the mock USDC strategy and run `Invest`.
- Public RPC returned HTTP 429 during verification: give the keeper and app a dedicated RPC.

## Margin

`contracts/margin-factory` (XF) adds leveraged trading to a group with the **audited `margin-controller`** (phase 1; `Custom` returns `VariantUnavailable` until phase 3). XF is admin of each group's `margin-controller` and `swap-adapter` and deploys both per group with `deploy_v2` (salt = group id, kind). Everything touching the group controller or a receipt-vault goes through MF (`wire_margin`, `link_margin_market`, `update_margin_params`, signatures in "Factory"). Owner calls take `(owner, group_id, ...)`, `owner.require_auth()`, then check `owner == MF.get_group(group_id).owner`.

**The core margin controller is the staged V3 flow, not V2.** Users open with `begin_open_position_v3`, `swap_open_position_v3`, `activate_open_position_v3`; close with `prepare_close_position_v3`, `swap_close_position_v3` (long) or `swap_close_short_position_v3` (short), `finish_close_position_v3`; liquidators use `liquidate_position_v3` (one call) or `begin/swap/finish_liquidation_v3`. Leverage, maintenance margin and the liquidation incentive of V3 are enforced **per (margin asset, base asset, side) pair** and default to 10x when a pair has no config, so XF writes a pair config (max leverage = group max, maintenance 5%) for every ordered pair of enabled markets, both sides. At most 4 margin markets per group (the controller keeps 32 pair configs).

ABI (`MarginError` is a `#[contracterror]`; every call reverts with it):

```rust
fn __constructor(admin: Address, market_factory: Address);
fn set_wasm(admin, wasm: MarginWasmHashes); fn set_router(admin, aquarius_router: Address);   // WasmNotSet / RouterNotSet until set
fn upgrade(admin, new_wasm_hash);                                  // immediate
fn propose_group_margin_upgrade(admin, group_id, hash); fn upgrade_group_margin(admin, group_id, hash);   // controller two-step (60s)
fn propose_group_sa_upgrade(admin, group_id, hash);     fn upgrade_group_sa(admin, group_id, hash);       // swap adapter two-step (60s)
fn set_pool_registry_enforced(admin, bool); fn set_pool_trusted(admin, pool, bool);   // optional: owners may only allow trusted pools
fn enable_margin(owner, group_id, cfg: GroupMarginConfig) -> Address;   // deploys + wires swap adapter and controller
fn update_margin(owner, group_id, cfg); fn apply_margin(owner, group_id);   // apply_margin applies a staged incentive after 60s
fn set_market_margin(owner, group_id, market, enabled: bool);
fn set_pool_allowed(owner, group_id, pool, allowed: bool);        // pool must trade two underlyings of the group
fn set_pool_binding(owner, group_id, pool_id: BytesN<32>, pool, allowed: bool);   // V3 routes only through (pool_id, pool)
fn get_margin(group_id) -> Option<MarginInfo>;
fn get_margin_status(group_id) -> Option<MarginStatus>;           // configured vs live incentive/fee, apply-after time, pair incentive, pools
fn effective_max_leverage(group_id, market) -> u128;              // min(group max, floor(1/(1-CF))), 0 if the market is not enabled
```

- **Guardrails** (`guardrails.rs`): group max leverage 1..=5; liquidation incentive 1_020_000..=1_100_000; slippage 1..=100_000; liquidation fee at most 500_000; market needs an allowlisted pool that trades its underlying, a 7-decimal underlying and a non-`AquariusOnly` price mode; disabling a market sets its pairs to 1x (blocks new opens, existing positions still close and liquidate).
- **Staging.** The group controller applies `liquidation_incentive` after 60s (first call stages, repeat applies) and the fee at once. `get_margin_status` returns the target in `cfg`, the live value in `applied_liquidation_incentive`, `incentive_applied` and `incentive_apply_after`; the UI shows "applies in 60s" and calls `apply_margin`. V3 pays liquidators the **pair** incentive (group incentive minus 1.0, capped at 10%), which XF sets on the margin controller immediately.
- **Admin.** Swap adapter needs both `set_pool_allowed` and `set_pool_binding` (Aquarius pool index) per pool; the margin controller is itself allowlisted on its adapter before it initializes. Audited controller and adapter upgrades are the built-in propose then execute path (60s).
- **Events**: `margin_enabled`, `margin_updated`, `market_margin_set`, `pool_allowed`, `pool_binding_set`, `upgraded`, `upgrade_proposed`, `wasm_set`, `pool_trust_set`.

