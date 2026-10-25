# CORE_DIFF: changes to the audited core

Reference: PeridotFinance/Peridot-Soroban branch `leveraged-fix` @ `47858c1a13c2588970395faa2212e7b68bd33060`
(12 Oct 2026). OpenZeppelin stellar-contracts pinned at `3f81125` (v0.7.1), copied unmodified.

## What was imported

Crates copied unmodified in commit "import audited core": `receipt-vault`, `simple-peridottroller`,
`jump-rate-model`, `margin-controller`, `swap-adapter`, `aquarius-lp-vault`, `price-router`,
`mocks/mock-token`, `mocks/mock-aquarius-pool`, `mocks/mock-depth-fixture`. Two more crates are copied because
the audited tests depend on them: `peridot-token` (dev-dependency of `simple-peridottroller`) and
`lp-receipt-vault` (dev-dependency of `aquarius-lp-vault`). Neither is deployed by this project.
`Cargo.lock` is the reference lockfile. The root `Cargo.toml` is workspace plumbing only.

Not imported: smart-account crates, `lp-lending-vault`, `lp-peridottroller`, `mock-lending-vault`,
`flash-loan-receiver`, `peridot-token` deployment.

## The only code change: timelock constants (24h to 60s)

Changed in the second commit, nothing else:

| File | Constant | Audited | Hackathon |
|---|---|---|---|
| `core/simple-peridottroller/src/constants.rs` | `UPGRADE_TIMELOCK_SECS` | `24 * 60 * 60` | `60` |
| `core/simple-peridottroller/src/constants.rs` | `ADMIN_PARAM_CHANGE_DELAY_SECS` | `24 * 60 * 60` | `60` |
| `core/receipt-vault/src/constants.rs` | `UPGRADE_TIMELOCK_SECS` | `24 * 60 * 60` | `60` |
| `core/margin-controller/src/constants.rs` | `UPGRADE_TIMELOCK_SECS` | `24 * 60 * 60` | `60` |
| `core/swap-adapter/src/lib.rs` | `UPGRADE_TIMELOCK_SECS` | `24 * 60 * 60` | `60` |
| `core/jump-rate-model/src/lib.rs` | `UPGRADE_TIMELOCK_SECS` | `24 * 60 * 60` | `60` |
| `core/aquarius-lp-vault/src/constants.rs` | `UPGRADE_TIMELOCK_SECS` | `24 * 60 * 60` | `60` |
| `core/price-router/src/lib.rs` | `UPGRADE_TIMELOCK_SECS` | `24 * 60 * 60` | `60` |

`peridot-token/src/lib.rs` also has an `UPGRADE_TIMELOCK_SECS` of 24h; it is a test-only dependency here and is left
as imported. `swap-adapter` `MAX_DEADLINE_SECONDS` (a swap deadline, not a timelock) is untouched.
No core test hardcoded a 24h warp; no test needed editing.

## Test status

`cargo test --workspace` on the hackathon copy: all green (aquarius-lp-vault 120, margin-controller 110,
price-router 45, receipt-vault 182, simple-peridottroller 127, swap-adapter 32, jump-rate-model 13,
lp-receipt-vault 22, others small; ignored tests are the reference's own intentional ignores).

## Build note (compile-time admin)

The core Wasm bakes in its permitted initial admin via `*_INIT_ADMIN` environment variables at compile time
(`option_env!`/`env!`). That is how the audited code is built, not a change we made. Consequence for the factory:
Wasm for a network must be built with `INIT_ADMIN` = that network's market-factory address. See `scripts/build_core.sh`.

## Exact diff

```diff
diff --git a/core/aquarius-lp-vault/src/constants.rs b/core/aquarius-lp-vault/src/constants.rs
index 08b807f..f3d7761 100644
--- a/core/aquarius-lp-vault/src/constants.rs
+++ b/core/aquarius-lp-vault/src/constants.rs
@@ -54,3 +54,3 @@ pub const MIN_DEPLOY_AMOUNT: u128 = 10_000u128;
 /// Upgrade timelock, matching the other Peridot contracts.
-pub const UPGRADE_TIMELOCK_SECS: u64 = 24 * 60 * 60;
+pub const UPGRADE_TIMELOCK_SECS: u64 = 60;
 
diff --git a/core/jump-rate-model/src/lib.rs b/core/jump-rate-model/src/lib.rs
index eaad4f6..f520a0f 100644
--- a/core/jump-rate-model/src/lib.rs
+++ b/core/jump-rate-model/src/lib.rs
@@ -9,3 +9,3 @@ const TTL_THRESHOLD: u32 = 500_000;
 const TTL_EXTEND_TO: u32 = 1_000_000;
-const UPGRADE_TIMELOCK_SECS: u64 = 24 * 60 * 60;
+const UPGRADE_TIMELOCK_SECS: u64 = 60;
 
diff --git a/core/margin-controller/src/constants.rs b/core/margin-controller/src/constants.rs
index 7550050..44533bd 100644
--- a/core/margin-controller/src/constants.rs
+++ b/core/margin-controller/src/constants.rs
@@ -28,3 +28,3 @@ pub const TTL_THRESHOLD: u32 = 500_000;
 pub const TTL_EXTEND_TO: u32 = 1_000_000;
-pub const UPGRADE_TIMELOCK_SECS: u64 = 24 * 60 * 60;
+pub const UPGRADE_TIMELOCK_SECS: u64 = 60;
 pub const BPS_SCALE: u128 = 10_000u128;
diff --git a/core/price-router/src/lib.rs b/core/price-router/src/lib.rs
index 2d03ebe..6d0a513 100644
--- a/core/price-router/src/lib.rs
+++ b/core/price-router/src/lib.rs
@@ -39,3 +39,3 @@ const BPS: u128 = 10_000u128;
 /// Upgrade timelock, matching the other Peridot contracts.
-const UPGRADE_TIMELOCK_SECS: u64 = 24 * 60 * 60;
+const UPGRADE_TIMELOCK_SECS: u64 = 60;
 
diff --git a/core/receipt-vault/src/constants.rs b/core/receipt-vault/src/constants.rs
index bb17c6a..503772a 100644
--- a/core/receipt-vault/src/constants.rs
+++ b/core/receipt-vault/src/constants.rs
@@ -4,3 +4,3 @@ pub const PTOKEN_DECIMALS: u32 = 6;
 pub const MAX_YEARLY_RATE_SCALED: u128 = 10_000_000u128; // 1000% APY cap to prevent overflow
-pub const UPGRADE_TIMELOCK_SECS: u64 = 24 * 60 * 60;
+pub const UPGRADE_TIMELOCK_SECS: u64 = 60;
 // DeFindex rejects deposits that cannot mint a non-zero share. Keep dust in
diff --git a/core/simple-peridottroller/src/constants.rs b/core/simple-peridottroller/src/constants.rs
index 551cd39..e6dc771 100644
--- a/core/simple-peridottroller/src/constants.rs
+++ b/core/simple-peridottroller/src/constants.rs
@@ -17,3 +17,3 @@ pub const MAX_FALLBACK_SCALE: u128 = 1_000_000_000_000_000_000u128; // 1e18
 pub const MAX_PAUSE_DURATION_SECS: u64 = 72 * 60 * 60;
-pub const UPGRADE_TIMELOCK_SECS: u64 = 24 * 60 * 60;
-pub const ADMIN_PARAM_CHANGE_DELAY_SECS: u64 = 24 * 60 * 60;
+pub const UPGRADE_TIMELOCK_SECS: u64 = 60;
+pub const ADMIN_PARAM_CHANGE_DELAY_SECS: u64 = 60;
diff --git a/core/swap-adapter/src/lib.rs b/core/swap-adapter/src/lib.rs
index b16c8ec..2339ce9 100644
--- a/core/swap-adapter/src/lib.rs
+++ b/core/swap-adapter/src/lib.rs
@@ -474,3 +474,3 @@ const TTL_THRESHOLD: u32 = 500_000;
 const TTL_EXTEND_TO: u32 = 1_000_000;
-const UPGRADE_TIMELOCK_SECS: u64 = 24 * 60 * 60;
+const UPGRADE_TIMELOCK_SECS: u64 = 60;
 
```
