# 10 Vault agent: `zenex-vault-adapter` (phase 3)

**Phase 3.** Location: `peridot-markets/contracts/zenex-vault-adapter`. Mainnet only (Zenex lists no testnet deployment), so develop against mocks and do one small mainnet test (min deposit is 10 USDC). Include `upgrade(admin, hash)` with immediate effect. Read `00-DROPOFF.md` sections 0 to 7 and `11-ADDRESSES.md` (Zenex section) first.

## Why

Zenex is Zenith Protocols' perpetual futures exchange on Stellar; Zenith also builds Blend and its founder is a judge. Each Zenex market has a **strategy vault** that is the counterparty to traders: LPs earn trading, impact, liquidation and borrowing fees and absorb trader PnL. For a Peridot USDC market this is a higher-yield, higher-risk route than Blend. Present it neutrally: "earns Zenex perps fees; vault shares can lose value; withdrawals wait at least 1 hour."

## How the Zenex vault works (verified in zenex-docs)

LPs do **not** call the vault. They create **vault orders on the market contract**, and a keeper fills them later with a signed price report:

```rust
// market contract (XLM-USD: CAOZCITW...)
fn create_vault_order(e: Env, user: Address, kind: u32 /* 0 deposit, 1 redeem */, amount: i128, min_out: i128) -> u32 /* order id */
fn cancel_vault_order(e: Env, user: Address, id: u32) -> i128
fn get_vault_order(e: Env, user: Address, id: u32) -> VaultOrder   // { kind, amount, min_out, exec_fee, created_at }
fn execute_vault_order(e: Env, keeper: Address, user: Address, id: u32, price: Bytes) -> i128   // permissionless, needs a price report
fn get_config(e: Env) -> Config        // exec_fee, min_deposit, redeem_lock, fees, caps
fn get_market_data(e: Env) -> MarketData
fn get_status(e: Env) -> u32           // Active, OnIce, Delisted, Frozen, Retired
// strategy vault (CB2MX4WX..., SEP-41 share token, OpenZeppelin fungible)
fn balance(account: Address) -> i128
fn total_assets() -> i128              // raw USDC balance, before trader PnL
fn preview_redeem(shares: i128, net_pnl: i128) -> i128
fn preview_deposit(assets: i128, net_pnl: i128) -> i128
```

- **Deposit:** `create_vault_order(user, 0, amount, min_out)` escrows `amount + exec_fee` USDC from `user` in the market. A keeper fills in a later ledger: 0.1% vault fee, shares minted to `user`. A fill below `min_out` rejects and refunds principal (the keeper keeps the exec fee).
- **Redeem:** `create_vault_order(user, 1, shares, min_out)` escrows the shares plus `exec_fee`. Fill only after `redeem_lock` (1 hour), and only if liquidity, utilization and pending-PnL gates pass; otherwise the order rests. 0.25% redeem fee.
- Share pricing marks against pending trader PnL (`effective_assets = total_assets - net_pnl`), so `total_assets / total_supply` overstates the redeemable value while traders are in profit.
- Read `technical/market/vault-orders.md`, `technical/vault/share-pricing.md` and `technical/units.md` in https://github.com/zenith-protocols/zenex-docs before coding. Share decimals = USDC decimals + `decimals_offset` from the vault.

## The problem: Peridot's boosted hook is synchronous

`receipt-vault` calls `deposit` and expects the money gone, and calls `withdraw` and expects USDC back **in the same transaction**. Zenex settles both in a later ledger, after a keeper fill, and redeems wait at least an hour. So the adapter is an **async buffer**:

```
receipt-vault  <->  zenex-vault-adapter  [local USDC buffer | pending orders | Zenex shares]  <->  Zenex market + vault
```

- `deposit(amounts_desired, ..., from = market)`: pull USDC into the adapter's **local buffer** only. Mint adapter shares against `total_value()`. No Zenex call here.
- `withdraw(shares, ..., from = market)`: pay **only from the local buffer**. If the buffer is short, fail with `LiquidityShortfall` so receipt-vault reports "withdraw liquidity shortfall" (the market's own idle buffer is the first line of defense).
- `sync(keeper)` (keeper only, called by Peridot's keeper every few minutes):
  - buffer above `target_buffer_bps` of total value and no pending deposit: `create_vault_order(this, 0, excess, min_out)` with `min_out` from `preview_deposit` minus slippage bps.
  - buffer below `min_buffer_bps` and no pending redeem: `create_vault_order(this, 1, shares_needed, min_out)`.
  - track order ids; clear them when `get_vault_order` traps `VaultOrderNotFound` (filled or rejected); detect rejection by comparing balances.
- We rely on **Zenex's own keepers** to call `execute_vault_order` (they earn the exec fee and a 10% keeper share). Do not build a price-report fetcher unless time allows.
- `total_value() = local_buffer + pending_deposit_escrow + zenex_share_value - pending_redeem_haircut`, where `zenex_share_value = preview_redeem(shares, net_pnl_estimate)` net of the 0.25% redeem fee. If no cheap `net_pnl` read exists, use `net_pnl = 0` and apply a configurable `valuation_haircut_bps` (default 200). Never overstate: the market's collateral value depends on this number.
- The adapter pays `exec_fee` from its buffer; account for it as a cost.
- `get_state()`: kind `"zenex"`, plus pending order ids, buffer, share balance, last fill time.

## Guardrails (factory side, coordinate with the lead)

- `YieldRoute::Zenex { market: Address, vault: Address, target_buffer_bps: u32, min_buffer_bps: u32 }`. Only for markets whose underlying equals the Zenex settlement token (USDC).
- Market `idle_buffer_bps` at least 50% when routed to Zenex, adapter `target_buffer_bps` at least 20%: at most about 40% of a market's deposits sit in Zenex.
- Respect Zenex limits: min deposit 10 USDC, vault cap 100,000 USDC (fill traps above it), market status must be `Active` for new deposits.
- UI: a risk line on the route card ("Earns Zenex perps fees. Vault shares can lose value. Withdrawals from Zenex take at least 1 hour; the market keeps a liquid buffer.").

## Tests

Mock market + mock strategy vault implementing the functions above (with a mock keeper fill), then:
1. Deposit lands in buffer; `sync` creates a deposit order; mock fill mints shares; `total_value` stays consistent.
2. Withdraw within buffer works; beyond buffer fails with `LiquidityShortfall`.
3. Low buffer triggers a redeem order; fill restores buffer after the lock.
4. Rejected fill refunds and clears the pending order.
5. Integration with `receipt-vault` via `set_boosted_vault`.

## Deliver

Adapter Wasm hash, SPECS.md "Zenex route" section, one mainnet deposit order tx and its fill tx (10 to 20 USDC from a Peridot-owned demo group) in DEMO.md.
