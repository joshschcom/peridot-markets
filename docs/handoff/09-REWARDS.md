# 09 Rewards agent: `reward-distributor` (phase 1)

Location: `peridot-markets/contracts/reward-distributor`. Read `00-DROPOFF.md` sections 0 to 7 first.

## Goal

A group owner picks **their own reward token** (their project token, USDC, anything SEP-41) and sets **how much is emitted per second per market**, separately for suppliers and borrowers. They can change speeds later in the Control Panel and top up the reward balance.

## How the core does rewards (verified in `../Peridot-Soroban/.../simple-peridottroller/src/contract.rs`)

- `set_peridot_token(token)`: once per controller. Changing it later panics.
- `set_supply_speed(market, speed_per_sec)` and `set_borrow_speed(market, speed_per_sec)`, max `1_000_000_000_000` per second, market must be listed.
- `claim(user)`: accrues across the user's markets, then calls **`token.mint(user, amount)`** with the controller authorizing as current contract. If `mint` fails, the controller emits a claim-failed event and **keeps the user's accrued balance** (verified). On success it subtracts what was minted. It always tries to pay the **full accrued amount**.

Arbitrary tokens will not let our controller mint. So the "reward token" we register with the controller is a **distributor contract** that looks like a minter and pays out the real token from a funded balance.

## Interface

```rust
fn __constructor(admin: Address /* factory */, controller: Address, reward_token: Address);
// Called by the controller in claim(). Must pay `amount` exactly or fail (no partial payouts:
// the controller treats any success as fully paid).
fn mint(to: Address, amount: i128);          // controller.require_auth(); transfer reward_token from this to `to`
fn fund(from: Address, amount: i128);        // from.require_auth(); transfer in; emit Funded
fn withdraw_unallocated(admin: Address, to: Address, amount: i128); // factory only, on owner request
fn reward_token() -> Address;
fn controller() -> Address;
fn balance_available() -> i128;
fn total_paid() -> i128;
fn upgrade(admin: Address, new_wasm_hash: BytesN<32>);
// SEP-41 read compat in case the controller or UI reads them:
fn decimals() -> u32;   // forward to reward_token
fn symbol() -> String; fn name() -> String;
```

Events: `Funded { from, amount }`, `Paid { to, amount }`, `Withdrawn { to, amount }`.

## Factory integration (coordinate with the lead)

- `set_rewards(owner, group_id, reward_token)`: deploy distributor, `controller.set_peridot_token(distributor)`. One per group; the UI must make clear the choice is permanent for that group.
- `set_reward_speeds(owner, group_id, market, supply_per_sec, borrow_per_sec)`: forwards to the controller; also callable from `add_market` via `MarketConfig`.
- `withdraw_unallocated` is exposed to the owner through the factory. Document that withdrawing can leave accrued rewards unclaimable until refunded.

## Frontend data (give 07 a helper)

`app/src/lib/peridot/rewards.ts`: reward token info, balance available, emissions per day per market, **runway** (balance / total emissions per second), user accrued (`get_accrued`), claim. Speeds are in reward-token base units per second; the UI edits "tokens per day".

## Tests

1. Distributor pays on `claim` through the real controller Wasm built from `core/`.
2. Empty distributor: claim fails softly, accrued kept, refund then claim succeeds.
3. Non-controller `mint` rejected.
4. Speeds change mid-way, accrual matches.

## Deliver

Wasm hash, SPECS.md "Rewards" section, mainnet txs: fund, speed set, user claim.
