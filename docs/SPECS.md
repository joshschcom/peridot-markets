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

### Factory: final behaviour (phase 1)

Owner flow, one transaction per step (Soroban resource limits; measured per step: create_group 8.5M cpu, add_market 25M,
activate_market 24M with 82 ledger entries, update_risk 14M, against 400M cpu and 200 entries on mainnet):

1. `create_group(owner, name)`: deploys the group controller and price router, first oracle set applies immediately.
2. `add_market(owner, group, cfg)`: validates guardrails, deploys the receipt-vault and its own jump-rate model, initializes both.
3. `activate_market(owner, group, market)`: registers the price source, lists the market on the controller, sets the collateral factor
   (first set applies immediately), caps, reserve factor, idle buffer.
4. `attach_yield(owner, group, market)`: DeFindex (vault attached directly) or Blend (adapter deployed per market). Both need
   the vault on the Peridot allowlist (`set_yield_vault_allowed`).
5. Last: `set_rewards(owner, group, token)` once per group, then `set_reward_speeds`. Audited-core limitation: once a reward token
   is set no market can be added (`MarketsLockedByRewards`), because `receipt-vault.set_peridottroller` makes the controller call
   `accrue_user_market`, which calls back into the vault (re-entry). Add every market first.
6. Margin: the margin-factory (see "Margin") calls `wire_margin` / `link_margin_market` / `update_margin_params` on this contract.

Guardrails (constants in `contracts/market-factory/src/guardrails.rs`, mirrored in `GUARDRAILS` in the TS interfaces):

| Param | Rule | Error |
|---|---|---|
| Collateral factor | 1% to 75% (Reflector), 50% (AquariusOnly, phase 3) | CollateralFactorTooLow / TooHigh |
| Supply and borrow cap | both > 0 | CapRequired |
| Idle buffer | 10% to 100% | IdleBufferOutOfRange |
| Reserve factor | 0 to 50% | ReserveFactorTooHigh |
| Rates | within core limits, all zeros allowed | RatesOutOfRange |
| Price | phase 1: `ReflectorOnly` with an allowlisted oracle | PriceModeNotAllowed / OracleNotAllowed |
| Yield vault | allowlisted, single asset equal to the underlying, one unpaused strategy (DeFindex) | YieldVaultNotAllowed / InvalidYieldVault |
| Rewards | speed at most the core maximum | RewardSpeedTooHigh |
| Markets | one market per token per group, at most 16 | MarketAlreadyExists / TooManyMarkets |
| Fallback prices | never set | n/a |

Control panel: `update_risk` (caps and reserve factor immediate, collateral factor staged), `update_rates` (`jump-rate-model.set_params`,
immediate), `update_idle_buffer`, `update_price` (staged 60s by the factory), `pause_market` (the core auto-expires a pause after 72h),
`transfer_ownership` (new owner signs), `apply_pending(owner, group, market|None)` applies staged collateral factors and prices after 60s.
Admin: `set_wasm`, `set_oracle_allowed`, `set_yield_vault_allowed`, `set_allowlist_mode`, `set_creator_allowed`, `set_margin_factory`,
`upgrade` (immediate), `upgrade_group_contract` (new contracts, immediate), `propose_core_upgrade` / `execute_core_upgrade` (core, 60s).

TTL policy: new contracts bump instance TTL only below 100,000 ledgers (to 400,000), so creation never triggers a bump on testnet
(default TTL 120,960) or mainnet (2,073,600). The audited core bumps to 1,000,000 as imported.

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

`contracts/blend-vault-adapter` is a `YieldVault` over a Blend **fee vault** (script3/fee-vault, Blend's own integration
contract). One Peridot-administered fee vault wraps one Blend V2 pool with one reserve vault per asset; each market's adapter is
a single `user` inside it, so the fee vault take rate is Peridot revenue.

- **ABI.** `__constructor(admin, market, underlying, cfg: BlendAdapterConfig { fee_vault, blend_pool })` checks that
  `fee_vault.get_pool() == blend_pool` and that the fee vault has a reserve vault for `underlying`. All `YieldVault` calls match
  the trait. Added: `total_supply() -> i128` (the receipt-vault calls it on every boosted redemption, so every boosted vault must
  expose it; `mock-yield-vault` and the trait do not), plus getters `admin`, `keeper`, `config`. `invest` is ignored (always
  invests). Errors are a `#[contracterror]` enum (`NotMarket`, `Paused`, `SlippageExceeded`, `LiquidityShortfall`, ...).
- **Accounting.** Position value is `fee_vault.get_underlying_tokens(underlying, adapter)`; tokens sent straight to the adapter
  are ignored. `deposit` (only `from == market`) pulls exactly `token.transfer(market, this, amount)`, mints shares at
  `amount * total_shares / value_before` rounded down (first deposit 1:1, zero shares rejected), then supplies to the fee vault.
  `withdraw` pays `shares * value / total_shares` rounded down, enforces `min_amounts_out[0]`, and stays open while paused (`pause`
  blocks deposits only). `get_asset_amounts_per_shares` never panics (`[0]` on any read failure or zero shares).
- **Auth.** The fee vault's `user.require_auth()` is satisfied because the adapter is the direct caller. The pool's nested
  `submit(fee_vault, adapter, adapter, [Supply])` and its child `token.transfer(adapter, pool, amount)` need the adapter's
  authorization, so `deposit` calls `authorize_as_current_contract` with that nested tree (transfer is a CHILD of `submit`, unlike
  the Aquarius router). `withdraw` needs none. Tests run with enforced auth and a negative control.
- **Liquidity and emissions.** If Blend lacks liquidity, `withdraw` fails with `LiquidityShortfall` and changes nothing, which the
  receipt-vault surfaces as a withdraw shortfall; the market's idle buffer (`set_idle_cash_buffer_bps`) is what protects users.
  BLND emissions are claimable only by the fee vault admin (`claim_emissions` is admin only), never by depositors, so `harvest`
  returns 0 (keeper auth required) and `apy_hint_bps` is 0. The fee vault admin should be a Peridot key, not the market-factory
  (the factory has no passthrough for `claim_fees`, `claim_emissions` or `set_fee_mode`).
- **Verified.** Tests use the real fee-vault Wasm (`testdata/fee_vault.wasm`) behind a mock Blend pool and the real receipt-vault,
  controller and jump-rate Wasm. Mainnet Fixed V2 pool `CAJJZ...` has XLM, USDC and EURC reserves.

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


## Launchpad

Stage 1 (token, bonding curve, factory). Graduation (Aquarius pool, locked LP, market group) and the ICO are
not built; `graduate()` is a stub. Crates: `launchpad-token`, `launchpad-curve`, `launchpad-factory`.

- **Token** (`launchpad-token`): OpenZeppelin fungible `Base`, 7 decimals, the whole supply minted once in
  `__constructor(recipient, name, symbol, supply, metadata_uri)` to the curve. No mint, no admin, no freeze, no
  upgrade: it is the only immutable launchpad contract. Holder-only `burn`/`burn_from` exist because SEP-41
  requires them. `metadata_uri()` and `metadata()` expose the optional image URI.
- **Curve formula** (`launchpad-curve`, one per launch): `(virtual_quote + real_quote) * (virtual_token - sold) >= k`,
  `k = virtual_quote * virtual_token`. With `x = vq + real_quote`, `y = vt - sold`: a buy of net quote `n` delivers
  `y - ceil(k / (x + n))` tokens, a sell of `t` tokens pays `x - ceil(k / (y + t))` quote. Rounding always favours
  the curve, so `sold <= vt * real_quote / (vq + real_quote)` at all times and `x * y - k < max(x, y)`. All math is
  checked `u128`; every reserve, supply and target is bounded by 1e19 base units so no product overflows.
  Constructor: `(token, quote_token, creator, factory, treasury, params: CurveParams)` (Soroban allows 10 arguments
  at most, so the numeric parameters travel in `CurveParams`: `virtual_quote`, `virtual_token`, `curve_supply`,
  `lp_supply`, `graduation_target`, `trade_fee_bps` (max 500, default 100), `creator_fee_share_bps` (max 5000),
  `creator_cap_bps` (max 2000, default 500)). It reverts unless `token.balance(curve) >= curve_supply + lp_supply`.
- **Fees and slippage**: fee = `ceil(gross * bps / 10000)` on the quote leg of every trade, accrued in two counters
  (treasury, creator share) and paid by the permissionless `claim_fees()`; there is no other outflow of quote except
  sellers. Held quote always equals `real_quote + unclaimed fees`. `min_tokens_out` and `min_quote_out` must be
  positive. Dust trades (zero output) revert.
- **Target and phases**: `Trading -> Graduatable -> Graduated`. A buy that would cross `graduation_target` is
  CLAMPED (partial fill): only the quote needed to land exactly on the target is charged, the rest stays with the
  buyer. Buys stop in `Graduatable`; sells keep working so holders are never locked in while a graduation is
  pending, and a sell that takes `real_quote` under the target moves the phase back to `Trading` (known grief
  vector: a holder can delay graduation by selling a little, at the cost of the fee and price impact; stage 2 may
  make `Graduatable` sticky). The constructor guarantees the target is reachable within `curve_supply`.
- **Anti-rug**: creator buys capped cumulatively (default 5% of `curve_supply`, sells do not reset it; the cap is
  per address, not a Sybil defence); parameters immutable; no withdrawal path before graduation. Trust assumption
  to state in the app: every curve is upgradeable by the factory admin (`upgrade_launch`), as the house rule
  requires, so "no withdrawal" holds as long as that admin does not ship a malicious Wasm.
- **Factory** (`launchpad-factory`): `launch_curve(creator, name, symbol, LaunchParams{quote_token, preset,
  metadata_uri, creator_buy, min_tokens_out}) -> (token, curve)`. The creator picks only a preset (Fast 25k,
  Standard 85k, Slow 250k XLM target; 1.073B virtual tokens, 800M curve, 200M LP, 1% fee), the rest is fixed by the
  admin-set preset per quote token (`set_default_presets`, `set_preset`, validated with the curve's own guardrails).
  Chicken and egg: the curve address is pre-computed from the counter salt (`deployed_address()`), the token is
  deployed first minting to it, then the curve with the real token address. Name 1..32 and symbol 2..12 ASCII
  characters, at most 100 launches per creator, optional launch fee to the treasury, optional atomic first buy.
  Views: `list_launches(start, limit<=50)`, `launches_of(creator)`, `get_launch(token)`, `get_preset`, `config`.

## XOXNO as a graduation venue

_XOXNO research agent. Read-only research on 25 Oct 2026: mainnet RPC reads and simulations (`--send=no`), the public repos `XOXNO/rs-lending-xlm` (commit `30d5990`) and `XOXNO/xoxno-contract-sdk` 0.3.0, and Aquarius docs. Nothing was sent to the network._

### Verdict

| Question | Answer |
|---|---|
| What is `CCVENFSVCBYDHVOACFZXMNNYVOZ3LKXPZYU5LUI4N7KTXOKRVYD7F3TR`? | XOXNO's **swap aggregator router**, not a pool, lending market or launchpad |
| Can XOXNO be the graduation venue (trading pool)? | **No.** XOXNO runs no AMM. Its router routes into other AMMs, Aquarius included |
| Can XOXNO list the graduated token in its lending market? | **Not permissionlessly.** Listing is owner-only (governance timelock) and the token needs an oracle feed |
| Is "launcher chooses Aquarius or XOXNO" feasible? | **Not today.** Define a `GraduationVenue` enum, implement only `Aquarius`. A real choice exists between Aquarius pool types |
| Default venue | **Aquarius** (permissionless pool creation, verified on mainnet below). XOXNO is a routing and later-listing partner |

### 1. What `CCVENFSV...` is

- Identification. XOXNO's repo `rs-lending-xlm` lists it as `aggregator` in `configs/networks.json` and as "Swap aggregator router (`execute_strategy`)" in `skills/xoxno-lending/addresses.md`. The same config records `aggregator_wasm_hash = 18eb766e87ed578892828cbb8c14817731dd8e570cf3861771fb944b85c352e8`, which equals the wasm hash the contract runs now (stellar.expert API `/explorer/public/contract/<id>`).
- Interface (`stellar contract info interface`, mainnet): `execute_strategy(sender: Address, total_in: i128, swap_xdr: Bytes) -> i128`, `add_referral`, `set_static_fee`, `add_to_whitelist`, `claim_referral_fees`, `claim_admin_fees`, `sweep_balance`, `upgrade`, `transfer_ownership` and `accept_ownership`. No pool or market creation.
- What it does (`contracts/swap-aggregator/README.md`): runs multi-hop, multi-venue routes built off-chain and passed as bytes. Venues: Aquarius, Comet, Phoenix, Soroswap, Sushi (`src/venues/`), including Aquarius LP mint and burn.
- Live state (read-only invokes): `admin()` and `get_owner()` = `GAVWFZK5BGCGBWH4O2CXAHXVRIYVAMGCTZJ24IPLVNLT2WQ2LJBDEEBP`, which `networks.json` calls the revenue `accumulator`; `static_fee_bps()` = 5; `referral_counter()` = 1; 5 fee-whitelisted tokens (USDT0, USDC, XLM, EURC, PYUSD). Created 18 Jul 2026, 133 direct invocations and 1635 sub-invocations, 3 wasm versions (so two upgrades by the owner).
- The static fee applies only when the route carries an active `referral_id` (README, "Fees"). A Peridot referral id is therefore a plain integration step (the owner calls `add_referral`).
- Relation to the lending contracts in 11-ADDRESSES.md: the lending controller `CAUCMIN5...` stores the router (`set_swap_aggregator`, governance op `SetSwapAggregator`) and uses it for `multiply`, `swap_collateral`, `swap_debt` and `repay_debt_with_collateral`. The controller treats the router as untrusted and checks balance deltas. Lending governance has no router-upgrade operation: the router owner key controls its upgrades (`docs/reference/endpoints.md`, "Swap aggregator").
- A contract can call it, but the route is an off-chain product: XOXNO's quote server (`https://stellar-swap.xoxno.com`, `GET /api/v1/quote`) returns the `swap_xdr`. A permissionless on-chain `graduate()` cannot build one, so the router only fits keeper or UI flows (for example swapping fees into AQUA, see section 4).

### 2. What XOXNO offers a launchpad

| Form | Exists? | Evidence |
|---|---|---|
| (a) Trading venue with locked LP | No. XOXNO is a lender plus a router | Controller `CAUCMIN5...` exports lending verbs only (`supply`, `borrow`, `multiply`, ...); the router has no pool creation |
| (b) Permissionless lending market for a new token | No | `create_liquidity_pool(hub_id, asset, params: MarketParamsRaw)`, `add_asset_to_spoke(SpokeAssetArgs)`, `edit_asset_in_spoke` are `#[only_owner]`; `create_hub` and `add_spoke` are owner or governance-guardian only (`contracts/controller/src/lib.rs`, `contracts/governance/README.md`) |

Lending listing detail (all from `rs-lending-xlm`):

- Owner is the governance contract `CC44PEQW7HSEPKAZ5ZRPH2JS5M5KVJXCUBLJ2ZX4E3WCDKMNFILHC2AD` (its `controller()` returns `CAUCMIN5...`). Changes go through `propose`, then `execute` after the timelock. `get_min_delay()` on mainnet returned `12` (the README counts it in ledgers; ask the team what delay proposals actually use).
- Oracle gate: the price aggregator accepts `ProviderRef::{Reflector, RedStone, Xoxno, Chainlink}` only (`common/src/types/composable_oracle.rs`). Setting a feed is the owner-proposed `ConfigureAssetOracle` operation, validated by live probes with a sanity band. A brand-new token has no such feed, which is the same gap Peridot solves with `AquariusOnly` pricing.
- Parameters a listing needs: `SpokeAssetArgs { asset, hub_id, spoke_id, ltv, threshold, bonus, liquidation_fees, supply_cap, borrow_cap, can_collateral, can_borrow, frozen, paused, no_seize }` (controller interface).
- Isolation: a market is `HubAssetKey { hub_id, asset }`; hubs isolate books and a spoke is an account's risk profile (SDK README, 11-ADDRESSES.md). Mainnet spokes 5 and 8 already list Aquarius LP tokens (`XLMAQUA_LP`, `AQUAUSDC_LP`, in hub 3: `skills/xoxno-lending/addresses.md`), so there is precedent for XOXNO governance to list Aquarius-based assets after the fact.
- SDK: `xoxno-contract-sdk = "0.3"` needs `soroban-sdk = "28"`, Rust 1.91+, stellar-cli 25.2+ (its `Cargo.toml` and README). This workspace is on soroban-sdk 25, so any direct XOXNO call from a launchpad contract needs its own workspace (same rule as `03-VAULT-XOXNO.md`). Graduation itself needs no XOXNO dependency.

### 3. Aquarius pool creation (answers the open item in 12-LAUNCHPAD.md)

Router `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK` (`version()` = 220, `get_emergency_mode()` = false) exports pool creation. Signatures from `stellar contract info interface`:

```rust
fn init_standard_pool(user: Address, tokens: Vec<Address>, fee_fraction: u32) -> (BytesN<32>, Address);
fn init_stableswap_pool(user: Address, tokens: Vec<Address>, fee_fraction: u32) -> (BytesN<32>, Address);
fn init_concentrated_pool(user: Address, tokens: Vec<Address>, fee: u32) -> (BytesN<32>, Address);   // (pool_index, pool)
fn share_id(tokens: Vec<Address>, pool_index: BytesN<32>) -> Address;                                // LP share token
fn deposit(user: Address, tokens: Vec<Address>, pool_index: BytesN<32>, desired_amounts: Vec<u128>, min_shares: u128) -> (Vec<u128>, u128);
```

Verified by simulation on mainnet (identity `dev`, `--send=no`):

| Check | Result |
|---|---|
| Creation payment | `get_init_pool_payment_token()` = AQUA `CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK`; `get_standard_pool_payment_amount()`, `get_stable_pool_payment_amount()` and `get_conc_pool_payment_amount()` each return `3000000000000` = **300,000 AQUA** (7 decimals), sent to `get_init_pool_payment_address()` = `CCAHNRWJ4YX3BCXSBQLVT44HEJCDYEJS75CBBY7PP4GKJMS2E55O54FH`. Docs agree: "300,000 AQUA deployment cost" (docs.aqua.network/user-guides/pools/creating-a-pool). At the stellar.expert price of 0.000286 USD that is about 86 USD, but it is paid in AQUA |
| Payer | `user` pays: the simulation reaches `AQUA.transfer(user, CCAHNRWJ..., 3000000000000)` and fails only because the `dev` account has no AQUA trustline. If the curve contract is `user`, the curve must hold 300,000 AQUA |
| Existing pair | `init_standard_pool(XLM/USDC, 30)` returns the existing `(9ac7a9cd..., CARCLMAP...)` with no payment, so a repeat call is harmless |
| Token order | Sorted ascending by contract id is required: `[USDC, PERI]` reaches the AQUA transfer, `[PERI, USDC]` fails with contract error 2002 (inferred as "unsorted tokens"). Sort in the adapter |
| Standard pool fees | 10, 30 and 100 bps accepted (reach the AQUA transfer); 50 and 1000 rejected with error 302 |
| Concentrated pool | Fee tiers 10 / 30 / 100 with tick spacing 20 / 60 / 200; the first deposit sets the starting price from the amount ratio; positions are keyed by owner + tick range, with no NFT (docs.aqua.network/developers/concentrated-liquidity). `init_concentrated_pool` also hits the AQUA transfer |
| Permission | Permissionless. Docs: "Pool creation is permissionless ... Whitelisting is not required to create the pool, but it is required to receive protocol emissions" (docs.aqua.network/for-projects/for-projects) |
| Minimum liquidity | None found in the interface or docs. Test on the testnet router `CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD` |
| LP lock | Standard pool shares are a SEP-41 token (`share_id` returns e.g. `CDLJFX3H3V4WJ4SYNBWUUFKMIYCZVZ3BMHSD6C53RKR7YBLYPBHFLF6X`, exporting `transfer` and `burn`). **Burning the shares, or sending them to a contract with no withdraw path, locks liquidity permanently.** There is no native lock feature. Concentrated positions have no token: lock means the curve contract holds the position and exposes no `withdraw_position` path (keep fee claims available) |
| Admin switches | Pools export `kill_swap`, `kill_deposit`, `kill_claim` and `set_emergency_mode`; the router has `commit_upgrade` / `apply_upgrade` and `set_privileged_addrs`. Locked LP is only as safe as these keys |
| Footprint | Not measurable from a read-only identity (simulation stops at the AQUA transfer). Qualitatively: deploys a pool and a share token, one AQUA transfer, two token transfers for the first deposit, then the lock. Run `stellar contract invoke ... --cost` on testnet; keep the `graduate_pool()` / `graduate_market()` split from 12-LAUNCHPAD.md |

Auth for a contract caller: the curve is `user` for `init_standard_pool` and `deposit`. Authorize the AQUA transfer and both deposit transfers with `authorize_as_current_contract`, with the transfer entries at the **root** of the auth tree; the pools do not `require_auth` on swap or deposit (project memory, "Aquarius auth tree shape"). Verify the exact tree with a testnet simulation, since the mainnet check above could not get past the AQUA transfer.

### 4. Recommendation

**Default and only implemented venue: an Aquarius standard (constant product) pool, fee 30 bps, shares burned.** Reasons: permissionless creation is verified on mainnet, the Aquarius pricing and swap path already exists in Peridot (`AquariusOnly`, swap adapter, 11-ADDRESSES.md), and a constant-product pool needs no price range. Use concentrated only if a team wants range control; it needs tick math and an initial range.

Funding decision for Lead A: the creating contract pays 300,000 AQUA. Options, in order of preference: (1) the factory charges a launch fee in XLM or USDC and a keeper swaps it to AQUA (XOXNO's router or Aquarius `swap_chained`; an XLM/AQUA pool exists) and pre-funds the curve; (2) the Peridot treasury pre-funds AQUA per launch; (3) the curve swaps part of the raise at graduation (not recommended: price impact and a larger transaction).

`GraduationVenue` and the adapter, minimal interface:

```rust
#[contracttype] pub enum GraduationVenue { Aquarius(AquariusPoolKind) /* Xoxno reserved, not implemented */ }
#[contracttype] pub enum AquariusPoolKind { Standard30, Concentrated30 }

pub trait VenueAdapter {
    /// Sorts tokens, pays the creation fee, creates the pool, seeds it, locks the LP.
    fn create_pool_and_lock(
        env: Env, token: Address, quote: Address,
        token_amount: i128, quote_amount: i128, fee_bps: u32,
    ) -> GraduatedPool;   // { pool: Address, pool_index: BytesN<32>, share_token: Address, locked_shares: u128 }
    fn creation_fee(env: Env) -> (Address, u128);   // (AQUA, 3000000000000) read live from the router
}
```

`pool` and `pool_index` feed `set_pool_binding` for the price router. The curve stores `GraduationVenue` at construction; an `Xoxno` variant must revert until XOXNO exposes something to call.

Where XOXNO fits (neutral, all optional):

| Role | What it needs | Effort |
|---|---|---|
| Day-one routability of the graduated token | XOXNO's quote server indexes Aquarius pools; confirm the new pair appears | 0 h, ask |
| Swap UI on the token page via XOXNO's quote server and router, with a Peridot referral id | Frontend call to `GET /api/v1/quote`, `execute_strategy` via wallet; the XOXNO owner calls `add_referral` | 4 to 6 h |
| Keeper swap of launch fees to AQUA | `execute_strategy` with a quoted route | 2 h |
| Lending listing of the token or its LP in XOXNO | XOXNO governance proposal plus an oracle feed | External, their decision |

Effort for the venue work: Aquarius adapter (sort, fee payment, creation, deposit, burn, testnet verification) **8 to 12 h**; `GraduationVenue` plumbing and tests 2 h; XOXNO graduation adapter **0 h** (nothing to call).

### 5. Risks

- **Thin new pool as collateral.** A freshly seeded pool is cheap to move. Keep the launchpad preset (collateral factor 25%, caps sized from pool depth, borrow cap 10% of supply cap, idle buffer 50%), require a minimum graduation target so depth is non-trivial, and rely on `max_pool_divergence_bps` against the quote asset. Never price a borrowable market from spot alone.
- **Third-party admin keys.** Aquarius router upgrades and pool kill switches, and the XOXNO router owner key `GAVWFZK5...` (outside lending governance), can change the behavior of locked liquidity or routing. State this in the UI risk copy.
- **AQUA price exposure** on the 300,000 AQUA creation fee, plus a trustline and balance requirement on the payer.
- **Router drift.** The Aquarius router is at version 220 and the XOXNO aggregator has already been upgraded twice. Pin addresses from `11-ADDRESSES.md` and re-read `get_init_pool_payment_*` before each launch.
- **Compliance.** Unchanged from 12-LAUNCHPAD.md; XOXNO involvement does not alter it.

### 6. Questions for the XOXNO team at the event

1. Is there a path to a permissionless or isolated listing for new tokens (a separate hub, supply-only, capped), or is governance listing always required? What are the listing criteria for an Aquarius-based asset (depth, age, holders)?
2. Can the `Xoxno` or `Reflector` provider price a token from its Aquarius pool (TWAP), so graduated tokens could be listed without a CEX feed?
3. Referral id terms for the swap router: fee share, who can call `add_referral`, and whether a Peridot id can be created.
4. Do the quote server's venue indexers pick up newly created Aquarius pools automatically, and how fast?
5. What delay does governance actually use for proposals (`get_min_delay` returns 12)? Is there a fast path for listing LP tokens?
6. Is there a plan for an XOXNO-run AMM or a pool-creation hook the launchpad could call?
7. Router upgrade policy: will the owner key move under governance, and is there notice before upgrades?

### Sources

- Router interface and live reads: `stellar contract info interface --id CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK --network mainnet-public`
- Aggregator and lending: https://github.com/XOXNO/rs-lending-xlm (`contracts/swap-aggregator/README.md`, `configs/networks.json`, `docs/reference/endpoints.md`, `contracts/governance/README.md`, `contracts/price-aggregator/README.md`, `skills/xoxno-lending/addresses.md`, `skills/xoxno-swap-aggregator/SKILL.md`)
- SDK: https://github.com/XOXNO/xoxno-contract-sdk (`crates/xoxno-contract-sdk/README.md`, `Cargo.toml`)
- Aquarius: https://docs.aqua.network/user-guides/pools/creating-a-pool, https://docs.aqua.network/for-projects/for-projects, https://docs.aqua.network/developers/concentrated-liquidity, https://docs.aqua.network/developers/reference/router-and-pool-contracts
- Contract metadata: https://api.stellar.expert/explorer/public/contract/CCVENFSVCBYDHVOACFZXMNNYVOZ3LKXPZYU5LUI4N7KTXOKRVYD7F3TR
