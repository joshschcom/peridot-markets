# 02 Vault agent: `blend-vault-adapter`

**Addresses (from 11-ADDRESSES.md):** fee vault targets Blend **V2** pools (`blend-contract-sdk 2.22`). Mainnet Fixed V2 pool `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`, testnet V2 pool `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF`. The V1 Fixed address `CDVQV...` in older notes is legacy. Fee vault constructor: `__constructor(admin, pool, is_apr_capped: bool, value: i128)`, value in 1e7 scale. Blend testnet pools use Blend's mock USDC `CAQCFV...`, not Circle's.

**Phase 1.** Location: `peridot-markets/contracts/blend-vault-adapter`. Must be live on **mainnet** for the phase 1 submission, using a Peridot-administered fee vault on the Blend Fixed pool. Include `upgrade(admin, hash)` with immediate effect, no timelock.

Read `00-DROPOFF.md` sections 0 to 7 first. You implement the `YieldVault` interface (00 §6.1) on top of a **Blend fee vault** (script3/fee-vault). The founder of Zenith Protocols, which runs Blend, is a judge: integrate Blend exactly as its docs intend.

## Why the fee vault and not the raw pool

The Blend fee vault is Blend's official integration contract for wallets and protocols. It wraps one Blend pool, tracks supplied interest per depositor in ERC4626 style, and lets its **admin earn a fee** (take rate or capped rate). Peridot deploys and administers its own fee vault on the Blend **Fixed pool**, so the fee becomes Peridot revenue and part of our sustainability model. This also replaces the old DeFindex hop for Blend exposure.

- Docs: https://docs.blend.capital/tech-docs/integrations/fee-vault and https://docs.blend.capital/tech-docs/integrations/integrate-pool
- Repo: https://github.com/script3/fee-vault

Relevant fee-vault functions (verified in `src/contract.rs`):

```rust
fn __constructor(...);                                     // check args in repo
fn add_reserve_vault(...);                                 // admin enables a reserve (asset)
fn set_fee_mode(...);                                      // take rate or capped rate
fn deposit(reserve: Address, user: Address, amount: i128) -> i128;    // user.require_auth()
fn withdraw(reserve: Address, user: Address, amount: i128) -> i128;   // amount in underlying
fn get_shares(reserve: Address, user: Address) -> i128;
fn get_underlying_tokens(reserve: Address, user: Address) -> i128;
fn claim_fees(...); fn claim_emissions(...);
```

Prefer one shared Peridot fee vault per Blend pool, with one reserve vault per asset. Each adapter instance (one per Peridot market) is a single `user` inside it.

## Step zero (first 45 minutes)

- Blend Fixed **V2** pool on mainnet: `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD` (the V1 `CDVQV...` is legacy; the fee vault needs V2). Find the Blend testnet deployment (Blend docs / blend-utils) and a testnet pool with a USDC (or XLM) reserve.
- Deploy a fee vault on testnet for that pool, `add_reserve_vault` for the asset, set take rate (for example 10%). Record the address in `external.blend_fee_vault`.
- Read the fee-vault constructor and auth requirements in the repo. Note that `deposit`/`withdraw` require `user.require_auth()`: the adapter is the user, so it authorizes as the current contract (`env.authorize_as_current_contract` for the nested token transfer into the Blend pool if needed; test this first, it is the most likely failure).

## Crate

`contracts/blend-vault-adapter`.

Constructor: `__constructor(admin, market, underlying, cfg: BlendAdapterConfig { fee_vault, blend_pool })`.

- `deposit`: only `from == Market`; pull underlying; call `fee_vault.deposit(underlying, this, amount)`; mint adapter shares against `total_value()` before deposit.
- `withdraw(shares)`: underlying_out = shares * total_value / total_shares; `fee_vault.withdraw(underlying, this, underlying_out)`; burn; transfer to `from`.
- `get_asset_amounts_per_shares`: from `fee_vault.get_underlying_tokens(underlying, this)`.
- `harvest`: claim BLND emissions if the fee vault exposes them to users (check; if emissions accrue to the fee-vault admin only, return 0 and document). If claimable, swap BLND to underlying via the Aquarius router (pool must exist) and redeposit.
- `get_state`: `apy_hint_bps` from the Blend pool supply rate if easy to read, else 0.
- Handle Blend withdraw limits gracefully: if the pool lacks liquidity, `withdraw` must fail with a clear error so receipt-vault surfaces "withdraw liquidity shortfall". The market's idle buffer is what protects users; say so in SPECS.

## Tests

Use Blend's testutils if available (the fee-vault repo has `testutils.rs`), otherwise a mock fee vault with the same signatures.
1. Deposit/withdraw round trip with interest accrual.
2. Fee vault take rate reduces user yield as configured.
3. Non-market deposit rejected.
4. Integration with real `receipt-vault` wasm via `set_boosted_vault`.

## Deliver

Adapter wasm hash, Peridot fee vault address (testnet, and mainnet in the stretch), SPECS.md section, one testnet deposit tx and one withdraw tx in DEMO.md.
