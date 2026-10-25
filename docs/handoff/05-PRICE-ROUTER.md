# 05 Oracle agent: `price-router`

**Addresses (from 11-ADDRESSES.md):** Reflector mainnet Stellar-assets feed `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` (keys `Asset::Stellar(token)`), external CEX/DEX feed `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` (keys `Asset::Other(symbol)`, already used by Peridot mainnet); testnet `CAVLP5DH...` and `CCYOZJCO...`. `PriceConfig::ReflectorOnly` takes the feed address plus the `Asset` key, so a token can use whichever feed covers it. Read `decimals()`/`resolution()` live.

**Peridot already has a price router.** `peridot-contracts/contracts/price-router` on the reference branch (`leveraged-fix`) is Reflector-compatible (`lastprice`, `decimals`, `resolution`), treats every source as untrusted, bounds sources against executable Aquarius pool quotes (`estimate_swap`, observations, `set_ratio_bps`), supports peg ceilings (yXLM to XLM), and was built because Reflector lacks yXLM and PYUSD. It is imported into `core/price-router` (timelock 60s only). **Read its module docs and `configure` / `set_source` / `set_upstream` / `set_symbol_asset` / `set_push_guard` first, then decide:** if it can already express the three modes below per token, the factory deploys one instance per group and configures it, and your work is the factory wiring, the `check` view (add it in a thin wrapper if missing) and tests. Only write new code for what it cannot express, as a wrapper crate that forwards to it. Do not rewrite it.

**Phase 1: `ReflectorOnly`. Phase 3: `ReflectorWithAquariusGuard` and `AquariusOnly`.** Location for any new wrapper: `peridot-markets/contracts/price-router-ext`. Phase 1 must be live on mainnet with mainnet Reflector feeds. Include `upgrade(admin, hash)` with immediate effect, no timelock.

Read `00-DROPOFF.md` sections 0 to 7 first. The Peridottroller has **one oracle address per controller** and calls the Reflector interface. You build a contract that implements that interface and lets the group owner choose, **per market**, how the price is derived. The factory deploys one router per group and calls `controller.set_oracle(router)`. No change to audited code.

## What the controller calls (verified)

- `set_oracle` is a **staged** admin parameter (delay 60s in the hackathon core copy). Confirm whether the first oracle set on a fresh controller applies immediately; tell the lead, because `create_group` depends on it.

- On `set_oracle`: `decimals()` and `resolution()` as sanity checks.
- On pricing: `lastprice(asset: Asset) -> Option<PriceData>` via `try_invoke_contract`. `Asset` is `Other(symbol)` if the controller has an asset symbol set for the token, else `Stellar(token)`.
- Staleness: the controller treats the price as stale if `pd.timestamp + k * resolution < now` (`k` set by `set_oracle_asset_symbol`/`set_oracle_max_age_multiplier`).
- **If `lastprice` returns None, the controller falls back to an admin fallback price if one exists.** The factory never sets fallback prices, so None means "price unavailable", which blocks borrows and liquidations for that market. That is our circuit breaker.

Copy `Asset` and `PriceData` from `../Peridot-Soroban/peridot-contracts/contracts/simple-peridottroller/src/reflector.rs` exactly (`contracttype` layout must match).

## Interface

```rust
fn __constructor(admin: Address, quote_decimals: u32 /* 14 */, resolution: u32 /* 300 */);
fn decimals() -> u32;
fn resolution() -> u32;
fn lastprice(asset: Asset) -> Option<PriceData>;
fn set_asset_config(admin: Address, token: Address, cfg: PriceConfig);   // admin = factory
fn get_asset_config(token: Address) -> Option<PriceConfig>;
fn check(token: Address) -> PriceCheck;   // never panics; for the UI
```

```rust
pub enum PriceConfig {
    ReflectorOnly { oracle: Address, asset: Asset },
    ReflectorWithAquariusGuard { oracle: Address, asset: Asset, pool: Address, quote_token: Address, max_dev_bps: u32 },
    AquariusOnly { pool: Address, quote_token: Address },
}
pub struct PriceCheck {
    pub mode: Symbol, pub reflector_price: Option<i128>, pub aquarius_price: Option<i128>,
    pub deviation_bps: Option<u32>, pub status: Symbol /* "ok" | "stale" | "deviation" | "unavailable" */, pub timestamp: u64,
}
```

The router maps whatever `Asset` the controller passes to a **token**: `Stellar(token)` directly; for `Other(symbol)` keep a `symbol -> token` map populated by `set_asset_config`. Simplest: the factory never sets oracle asset symbols on group controllers, so the controller always passes `Stellar(token)`.

## Modes

- **ReflectorOnly**: forward to `oracle.lastprice(asset)` (or `x_last_price` if the quote must be USDC-denominated; match the units the controller expects: USD price at `decimals()`). Rescale to our decimals. Return Reflector's timestamp.
- **ReflectorWithAquariusGuard**: get the Reflector price; get the Aquarius quote = `pool.estimate_swap(in_idx, out_idx, one_unit_of_token)` converted to USD via the Reflector price of `quote_token`. If `|reflector - aquarius| / reflector > max_dev_bps`, return **None** and emit `PriceDeviation { token, reflector, aquarius, dev_bps }`. Otherwise return the Reflector price. The guard catches both a stale or wrong feed and pool manipulation.
- **AquariusOnly**: for tokens without a Reflector feed. Spot quote from the pool, valued via the Reflector price of `quote_token`, timestamp = ledger time. Spot is manipulable within a transaction: the factory restricts these markets (lower CF, borrow cap, no margin, see 00 §8). Use a larger probe size (for example 0.1% of pool reserves) rather than one unit, to make cheap manipulation more expensive, and document it.
- Optional if time: use Reflector `twap(asset, records)` instead of `lastprice` in ReflectorOnly mode (config flag).

Pool index mapping: read the pool's token list once and store `(in_idx, out_idx)` in the config at `set_asset_config` time.

## Step zero

Reflector testnet contract IDs (there are separate feeds for external CEX/DEX and Stellar assets; check Reflector docs), which assets are covered on testnet, and Reflector's `decimals` and `resolution`. If testnet USDC is not priced, price it via a symbol feed or treat USDC as 1 USD in a clearly labeled testnet-only `Fixed` mode (testnet builds only, behind a cargo feature, never on mainnet).

## Tests

Mock Reflector + mock Aquarius pool:
1. Each mode returns correctly scaled prices.
2. Guard returns None above `max_dev_bps` and emits the event; returns Reflector price below it.
3. Stale Reflector data passes timestamps through so the controller marks it stale.
4. Integration: real `simple-peridottroller` wasm with `set_oracle(router)`; supply, borrow, and borrow blocked when the guard trips.

## Deliver

Wasm hash, SPECS.md section (modes, scaling, failure behaviour), a testnet tx where the guard blocks a borrow (great demo moment), and a list of Reflector-covered assets for the wizard's price picker.
