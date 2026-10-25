# 03 Vault agent: `xoxno-vault-adapter`

**Addresses (from 11-ADDRESSES.md):** mainnet controller `CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX`, testnet controller `CCXRWJ6SIU2WPFEGLFGJVITPL57QAYIMIO6OAM2NBGNDQSSCK2FFV3F3`; hubs 1 to 3; mainnet spokes include 1 Blue Chip and 4 Stables and FX (pick with `find_market`/`can_supply`). Use `LendingAddresses::mainnet(&env)`/`testnet(&env)`.

**Phase 4.** Location: `peridot-markets/adapters/xoxno-vault-adapter` (own workspace). Build against the SDK fixture in parallel any time, deploy to mainnet only after phases 1 to 3 are tagged. Include `upgrade(admin, hash)` with immediate effect, no timelock.

Read `00-DROPOFF.md` sections 0 to 7 first. You implement the `YieldVault` interface (00 §6.1) on top of **XOXNO Lending on Stellar**. The founder of XOXNO is a judge: use XOXNO's official SDK and follow its documented ownership and auth rules exactly.

## The SDK

- `xoxno-contract-sdk = "0.3"` (repo: https://github.com/XOXNO/xoxno-contract-sdk, protocol: https://github.com/XOXNO/rs-lending-xlm)
- **Requires soroban-sdk 28 and Rust 1.91+, built with stellar-cli 25.2+.** Peridot's main workspace is on soroban-sdk 25, so put this adapter in its **own workspace**: `adapters/xoxno-vault-adapter/` with its own `Cargo.toml` and `rust-toolchain.toml`. Do not upgrade the main workspace.
- It includes embedded protocol WASM and a `testutils` fixture (`LendingFixture`, `MarketConfig`) for local tests.
- Network addresses: `LendingAddresses::testnet(&env)` and `LendingAddresses::mainnet(&env)`.
- Read `crates/xoxno-contract-sdk/README.md` and the examples `simple-deposit`, `lending-vault` and `account-basics` before writing code. `examples/lending-vault` is closest to what you build.

Key concepts from the SDK README:
- **Hub** = isolated group of markets; **Market** = `HubAssetKey { asset, hub_id }`; **Spoke** = an account's risk profile (`spoke_id`).
- `XoxnoLending` acts as the current contract: the adapter owns the account (`u64` id + position NFT).
- Units: WAD 1e18 for USD/prices, RAY 1e27 for rates, BPS for LTV.
- Their README warns that a public entrypoint spending the contract's funds must authenticate a stored owner or policy, not an arbitrary caller address. Our policy: only the stored `market` (receipt-vault) can deposit or withdraw. Spell this out in code comments and SPECS.

Wrapper calls you will use (verified in `src/lending/facade.rs`):

```rust
XoxnoLending::new(&env, &addresses)
  .resolve_account(stored: Option<u64>) -> u64       // NEW_ACCOUNT if none
  .open_account(spoke_id, &market, amount) -> u64
  .supply(account_id, &market, amount) -> u64
  .withdraw(account_id, &market, amount) -> Withdrawal { amount, account_closed }
  .withdraw_all(account_id, &market) -> Withdrawal
  .position(account_id) -> Position { collateral, debt }
  .supply_rate(...), .liquidity(...), .can_supply(...)   // check exact signatures
```

The adapter never borrows. It is supply-only.

## Crate

Constructor: `__constructor(admin, market, underlying, cfg: XoxnoAdapterConfig { lending: LendingAddresses, hub_id: u32, spoke_id: u32 })`.

- `deposit`: only `from == Market`; pull exact amount (check balance delta, as the SDK examples do); `open_account` on first deposit else `supply`; store account id; mint shares against `total_value()` before deposit.
- `withdraw(shares)`: compute underlying_out pro rata; `withdraw(account, market, amount)`; if `account_closed` forget the id; transfer to `from`; check balance deltas.
- `get_asset_amounts_per_shares`: from `position(account).collateral` for our `HubAssetKey`. Must not panic when no account exists (return 0).
- `harvest`: return 0 (interest accrues in the position), unless XOXNO has claimable incentives; document.
- `get_state.apy_hint_bps`: convert `supply_rate` (RAY) to bps if cheap.
- Handle XOXNO liquidity limits like Blend: clear error, market idle buffer protects users.

## Cross-workspace interface

Because this crate cannot depend on `peridot-interfaces` (sdk mismatch), **copy** the `YieldVault` signatures and `VaultState` struct exactly. The lead's integration test calls this adapter's wasm from the main workspace through the generic interface; make sure `#[contracttype]` field names and order match 00 §6.1 byte for byte.

## Tests

1. With `LendingFixture`: deposit, accrue, withdraw, close and reopen account.
2. Non-market deposit rejected.
3. Wasm-level test from the main workspace with `receipt-vault` via `set_boosted_vault` (the lead can own this one).

## Deliver

Adapter wasm hash (built with stellar-cli 25.2+), hub/spoke ids used on testnet, SPECS.md section, one testnet supply and one withdraw tx in DEMO.md. Mainnet stretch: one small real supply into XOXNO from a Peridot-owned demo group.
