# Coordination board

Append-only, newest at the bottom. Prefix every entry with `[A]` (Lead A, contracts) or `[B]` (Lead B, app and ops)
and the Lisbon time. Status lines: `READY: scaffold`, `READY: testnet phase-N`, `READY: mainnet phase-N`.
Interface change requests, blockers and second-opinion summaries go here too.

---

[B] 2026-10-25T12:47+00:00 START: Lead B read all required handoffs and awaits [A] READY: scaffold. Verified reference SHA 47858c1a13c2588970395faa2212e7b68bd33060. Intake milestones received. User supplied newer frontend PeridotFinance/PeridotV2Full, cloned at /private/tmp/peridot-v2full-reference, SHA 86ae3795f3ca011bef156f2d9ed8fe900410dc11. Studying it as additional prior work.

[B] 2026-10-25T12:47+00:00 INTERFACE REQUEST: Actual core margin is staged V3 only; handoff V2 is stale. See core/margin-controller/src/storage.rs:223 and contract.rs:631,868. Please align factory/TS mocks to actual ABI, including pending operation recovery.

[B] 2026-10-25T12:47+00:00 INTERFACE REQUEST: Core reward claim uses reward-token balance(controller) and transfer(controller,user,payable), not mint. See core/simple-peridottroller/src/contract.rs:3040-3114. Mint-only distributor is incompatible; please expose compatible custody balance/transfer semantics.

[B] 2026-10-25T12:47+00:00 INTERFACE REQUEST: Control needs get_pending with values and ledger ETA plus typed history events. Same-address set_oracle returns immediately, so router config updates need factory-level staging. Initial oracle/CF assignments are immediate; later CF changes stage. Core CF minimum is 1%.

[B] 2026-10-25T12:47+00:00 INTERFACE REQUEST: Margin requires 7-decimal assets; actual slippage setter is set_max_slippage_scaled (1e6). Pool setup requires set_pool_allowed AND set_pool_binding. Existing core already has margin fee methods (1e4 basis points).

[B] 2026-10-25T12:47+00:00 INTERFACE REQUEST: rebalance_idle_cash is admin-only, so keeper needs factory passthrough. refresh_boosted_underlying is permissionless and needed in phase 1 under the five-minute stale-cache limit for Blend/DeFindex. See core/receipt-vault/src/contract.rs:1451-1470.

[B] 2026-10-25T12:47+00:00 OPS: origin/main peridot-bots/liquidator is ordinary lending only (SHA fe8d562051195dbc0af667367514b479de36fc8d). Matching V3 margin bot lives in leveraged-fix peridot-contracts/bots/margin-liquidator. Both imports will be disclosed.

**[A] 2026-10-25 12:55 WET: READY: scaffold (local, not yet pushed)**
- Repo: `../peridot-markets` (local). GitHub remote `PeridotFinance/peridot-markets` does not exist yet or is not visible to `joshschcom`; Joshua to create it (see KICKOFF-PROMPTS step 3). Until then both leads share the local clone, same rules.
- Reference core: Peridot-Soroban `leveraged-fix` @ `47858c1a13c2588970395faa2212e7b68bd33060`. All core tests green with 60s timelocks (see `core/CORE_DIFF.md`).
- Layout note: one Cargo workspace at the repo root (`Cargo.toml`) with members `core/*`, `core/mocks/*`, `contracts/*`. `openzeppelin-stellar-contracts/` is copied in (excluded from the workspace).
- Interfaces: `contracts/peridot-interfaces` (Rust) and `contracts/peridot-interfaces/ts/index.ts`. **Deviation from 00 section 6:** `#[contracttype]` enums cannot have named-field variants, so `PriceConfig` and `YieldRoute` variants are tuple variants holding a payload struct (e.g. `PriceConfig::ReflectorOnly(ReflectorOnlyCfg { oracle, asset })`, `YieldRoute::Blend(BlendRoute { fee_vault })`). The TS mirror uses `{ tag, values: [payload] }` like generated bindings.
- **Build constraint that shapes deployment:** every core Wasm bakes in its permitted initial admin at compile time (`*_INIT_ADMIN`). Wasm for a network must be built with `INIT_ADMIN` = that network's market-factory address (`scripts/build_core.sh`). Deploy order per network: deploy market-factory, build core Wasm with its address, upload, `set_wasm`. Unit tests use the fixed address `TEST_ADMIN_ADDRESS` and the committed Wasm in `build/test/`.
- Staged controller params (verified in `set_oracle`, `set_market_cf`): the FIRST oracle and the FIRST market CF on a fresh controller apply immediately. Later changes stage for 60s and need the same call repeated after the delay (what `apply_pending` does). So `create_group` and `add_market` do not need to wait.
- Mocks available: `core/mocks/mock-token`, `mock-aquarius-pool`, `mock-depth-fixture`, `contracts/mocks/mock-reflector`, `contracts/mocks/mock-yield-vault`.
