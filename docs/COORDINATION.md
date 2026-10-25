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

[A] READY: scaffold
- Time 2026-10-25 13:05 WET. Lead B can import `app/` now. Everything is committed locally in `../peridot-markets` (commits 3833c42, 206cf00, 411f6e5 and the one after this entry). Push is pending the GitHub repo.
- Interfaces for B: `contracts/peridot-interfaces/ts/index.ts` (types, `GUARDRAILS`), market-factory signatures in `docs/SPECS.md` "Factory". The factory ABI will be generated into TS bindings once the Wasm exists.

**[A] 2026-10-25 13:05 WET: design decisions (supersede wording in 00/06)**
- Two admin addresses: market-factory is admin of everything in a group except `margin-controller` and `swap-adapter`, whose admin is margin-factory (compile-time `INIT_ADMIN`/`MARGIN_INIT_ADMIN`). `wire_margin`, `link_margin_market`, `update_margin_params` on market-factory are callable only by the margin-factory (06 option a).
- Factory constructors take no Wasm hashes; `set_wasm` after deploy. `WasmHashes.swap_adapter` moved to `MarginWasmHashes`.
- `close factor` and `liquidation incentive` always stage for 60s on the controller (defaults exist), so margin config changes of `liquidation_incentive` need `apply_pending` after 60s. The UI should show "applies in 60s" for those, like CF and oracle changes after the first set. `liquidation fee` is immediate.

[B] 2026-10-25T13:22+00:00 READY: dashboard base imported as 6c671e0, exact source SHA 47858c1a13c2588970395faa2212e7b68bd33060. Frontend pages and mock/client integration underway; mainnet default with explicit mock mode. Current factory get_market_record and withdraw_unallocated discovered and being wired into Control. No live transaction attempted.

[B] 2026-10-25T13:22+00:00 SECURITY INTERFACE REQUEST: External Reflector Asset::Other(symbol) must be bound to a trusted token address. A malicious SEP-41 can name itself USDC; symbol equality alone must not establish price coverage. Frontend only allows external symbol lookup if deployments.external.<symbol-lowercase> matches token; otherwise requires Asset::Stellar(token). Please enforce matching onchain trusted symbol mappings too and include xlm/usdc mappings in manifests. Also apply_pending currently iterates market CF/price only, not controller liquidation incentive: need group pending incentive ETA/apply path for margin settings.

**[A] 2026-10-25 14:30 WET: market-factory landed (local commits), interface notes for B**
- Market creation is now THREE owner transactions, because Soroban caps a transaction at 100 ledger entries (one combined tx measured 126): `add_market(owner, group, cfg)` deploys and initializes the receipt-vault and its own jump-rate model, `activate_market(owner, group, market)` lists it on the controller (price, CF, idle buffer), `attach_yield(owner, group, market)` attaches the yield route. `group.markets` contains only activated markets; `get_market_record(group, market)` has `active`, pending changes and the adapter. Measured per tx: create_group 8.5M cpu, add_market 25M, activate_market 24M (82 entries), update_risk 14M, all far below the 400M limit.
- **Audited-core limitation (needs Joshua's decision, see below):** once a group has a reward token (`set_rewards`), no new market can be added: `receipt-vault.set_peridottroller` makes the controller call `accrue_user_market`, which calls back into the vault ("Contract re-entry is not allowed"). The factory returns `MarketsLockedByRewards`. UI order for a group: add every market first, then enable rewards last. Reward speeds are set with `set_reward_speeds` after `set_rewards` (`MarketConfig.supply_reward_per_sec`/`borrow_reward_per_sec` must be 0 at creation). Fix would be a ~5 line change in `core/receipt-vault` (pass a zero `AccrualHint` in `set_peridottroller`); not applied, core is unchanged beyond the timelocks.
- Users must `enter_market(user, market)` on the group controller before rewards accrue and before borrowing (deposit does not enter automatically). Borrowing requires the borrowed market to be entered as well.
- Rewards: the audited controller pays claims with `distributor.balance(controller)` then `distributor.transfer(controller, user, payable)` (partial payout when underfunded, remainder stays accrued), not `mint`. `RewardDistributor` trait now lists `balance`, `transfer`, `admin`, `total_funded`, `total_withdrawn` too.
- Allowlists (Peridot admin): `set_oracle_allowed(oracle)` for Reflector feeds and `set_yield_vault_allowed(vault)` for DeFindex/Blend vaults; the wizard should only offer allowlisted ones (`is_oracle_allowed`, `is_yield_vault_allowed`). Price-config changes and CF changes are staged 60s and applied with `apply_pending(owner, group, market|None)`; caps, reserve factor, rates (`jump-rate-model.set_params`), idle buffer apply immediately. `pause_market` auto-expires after 72h in the core.
- Errors: `FactoryError` codes in `contracts/market-factory/src/errors.rs` (guardrail errors 20..31, flow errors 40..50).
