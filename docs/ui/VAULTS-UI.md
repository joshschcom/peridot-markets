# Vaults, Aquarius registry and custom tokens (UI)

Branch `vaults-ui`. Page `/vaults`, plus changes to the add-market form (`MarketConfigEditor`, used by the launch wizard and the group control panel).

## What is live, demo and coming soon

| Venue | Status in the app | Submittable |
|---|---|---|
| Keep in Peridot | Live | yes (`YieldRoute::None`) |
| Blend fee vault | Live on mainnet | yes (`Blend`) |
| DeFindex vault | Live on mainnet | yes (`Defindex`) |
| Aquarius LP vault | Demo flow | no |
| XOXNO Lending | Coming soon, not active in this demo | no |
| Zenex perps vault | Coming soon, not active in this demo | no |

Single source: `app/src/lib/vaults/registry.ts` (`VAULT_OPTIONS`, `isSubmittable`, `statusLabel`). `MarketConfigEditor` step 4 shows the same list under the route select. Locked cards cannot be clicked.

## Files

- `app/src/lib/vaults/registry.ts` venue list and status helpers.
- `aquarius-pools.ts` pool model, API parser, on-chain discovery, merge and fallback chain, static verified list, demo data.
- `aquarius-chain.ts` RPC reader (router `get_pools`, pool `get_tokens`, `pool_type`, `get_fee_fraction`, `get_reserves`).
- `vault-plan.ts` "Create a vault for me" plan, validation and demo runner (`FACTORY_SUPPORTS_AQUARIUS_ROUTE = false`).
- `token-intake.ts`, `token-intake-client.ts` custom token parsing, SEP-41 reads, pricing decision.
- Components in `app/src/components/vaults/`, page in `app/src/app/vaults/page.tsx`, nav entry in `components/ui/AppShell.tsx`.
- Shared files touched: `components/markets/MarketConfigEditor.tsx`, `components/ui/AppShell.tsx`, `lib/peridot/mock.ts` (two demo tokens), `lib/peridot/factory.ts` (mock PDEMO in the feed check), `app/package.json` (test glob).

## Aquarius registry

Order: router `get_pools([USDC, counterparty])` on chain, merged with the AMM API (CORS open), merged with the verified list from `docs/handoff/11-ADDRESSES.md`; demo data when `NEXT_PUBLIC_USE_MOCKS=true`. The page never shows an empty list: a failed or slow (15 s) source gives a warning and the verified list. TVL is about twice the USDC reserve (labelled approximate). APR is not shown (the v2 API has no APR field and computing it needs a price feed). Mainnet works without a wallet; without `NEXT_PUBLIC_MAINNET_RPC_URL` the chain source is skipped and the API plus the verified list are used.

## "Create a vault for me": which case applies

**The contracts do not support it yet, so the flow is a labelled demo.** Evidence: `contracts/market-factory/src/lib.rs::add_market` rejects any `yield_route` other than `None | Defindex | Blend` with `FactoryError::Unsupported`, and `attach_yield` only handles those three. `core/aquarius-lp-vault` exists and is audited code, but nothing in the factory can deploy, initialize or bind it. The demo walks the exact plan, emits the same toast sequence as a real transaction (methods prefixed `demo_`, success text "Demo step recorded. No onchain transaction."), and stores the result in localStorage (`peridot:vault-demo:v1:<network>`). No wallet signature and no RPC write.

### Missing entrypoints (spec for Lead A)

1. `YieldRoute::Aquarius(AquariusRoute { pool: Address, underlying_index: u32, range: RangeMode, reserve_cut_bps: u32, reserve_cap_bps: u32 })` and `enum RangeMode { FullRange, Centered(u32 /* half_width_ticks */) }` in `peridot-interfaces`, accepted by `add_market` (still a `None` placeholder until attach).
2. `attach_yield` arm for `Aquarius`: check the pool reports `pool_type() == "concentrated"` and that `get_tokens()[underlying_index] == cfg.token`; require `idle_buffer_bps >= 3000` and a supply cap; deploy `aquarius-lp-vault` (new `WasmHashes.aquarius_lp_vault`) with a salt per market; `initialize(admin = factory, pool, underlying_index, oracle = group price router)`; `set_range_policy` (or full range); `set_reward_route` for AQUA to the underlying; deploy the loss reserve wrapper (`01-VAULT-AQUARIUS.md`, new work 2) and bind it; then `set_boosted_vault` + `bind_boosted_vault` on the market vault. Order as in `scripts/deploy_aquarius_lp_market_mainnet.sh`.
3. Factory allowlist `set_aquarius_pool_allowed(admin, pool, allowed)` and `is_aquarius_pool_allowed(pool)`, checked in step 2, so owners cannot point a vault at a hostile pool (same idea as `set_yield_vault_allowed`).
4. Getters for the app: `get_aquarius_route(group_id, market) -> Option<AquariusRoute + vault address>`.
5. App side after that: flip `FACTORY_SUPPORTS_AQUARIUS_ROUTE`, send `add_market`, `activate_market`, `attach_yield` through `writeFactory`, mirror `launch.ts` (`kind: 'yield'`), and add `Aquarius` to `encodeMarketConfig` in `lib/peridot/factory.ts`.

The registry and the vault option list work today without any of this.

## Custom token in add market

The add-market form (launch wizard market step and control panel) now has: a search box over every token in the Aquarius USDC registry, a "Token contract address" input that also accepts `CODE:ISSUER` (resolved with the SDK to its Stellar Asset Contract id for the current network) and `native`, and the existing "Verify token and price feed" button.

On verify the app reads `symbol()` and `decimals()` (required) and `name()` and `total_supply()` (optional: Stellar Asset Contracts have no `total_supply`, OpenZeppelin tokens such as launchpad tokens do; the panel says "Not reported by this token"). A contract that does not answer gets "not a Soroban token contract (SEP-41)". A `G...` account address gets its own message.

### Pricing, driven by what the contracts allow

- `ReflectorOnly`: allowed for any owner when the factory has approved the exact (token, oracle, asset) tuple (`set_price_feed_allowed`). The app looks the token up on both Reflector feeds with `findReflectorFeed` and `is_price_feed_allowed`. This is the only price source the form can submit.
- `AquariusOnly`: the factory accepts it only when the market owner is a curve registered with the launchpad (`add_market` calls `LaunchpadViewClient::is_curve(owner)`), and `update_price` refuses it. So a wallet owner cannot select it, even for a deep pool. The app still looks for a USDC pool through the router, reads its USDC reserve and compares it with the router's `MIN_DEPTH_USD = 500` per side guard, and says so, but marks the market blocked and explains: launch the token through the launchpad (graduation creates the market) or ask Peridot to approve a Reflector mapping.
- Neither available: "No price source available, market blocked" with both reasons. `validateMarketDraft` already refuses a draft without a price, so Continue stays blocked.

To let owners list any token with a deep pool, the factory needs an owner-callable `AquariusOnly` path, for example `set_aquarius_price_allowed(admin, token, pool, quote_token)` checked in `add_market` in place of the `is_curve` test, with the router still enforcing depth at read time. Collateral factor stays capped by `MAX_CF_AQUARIUS_ONLY` and margin stays off for those markets.

### Leverage and yield for the token

Leverage: the existing per-market "Allow leverage" toggle; any token that can be priced and has seven decimals can be switched on. A group still needs two to four leveraged markets and an approved Aquarius pool between them (`discoverMarginPools`). Yield: the panel lists what is configured for that token (DeFindex vault in the manifest, Blend fee vault) and the locked venues.

### Final submit calls (unchanged, no new contract methods)

`create_group`, `add_market(owner, group_id, MarketConfig{ token, price: ReflectorOnly{oracle, asset}, yield_route: None|Defindex|Blend, ... })`, `activate_market`, `attach_yield` (only when a route is chosen), then the optional rewards and margin steps. Control panel add-market uses the same `add_market`, `activate_market`, `attach_yield`.

### Demo only

Demo mode (`NEXT_PUBLIC_USE_MOCKS=true`) adds two mock tokens: `PDEMO` (`CADQOBYH...P5KR`, priced by the mock Reflector) and `NOFEED` (`CAEQSCIJ...TD2L`, no feed, shows the blocked path). Any other valid contract id errors as "not a token". The demo vault creation flow is demo on every network. Pool data in demo mode is fixed sample data.

## Tests

`npm test` covers the registry, pool parsing and fallback chain, the vault plan and demo store, and token intake (`src/lib/vaults/*.test.ts`). E2E: `tests/e2e/vaults-flows.spec.ts` (venues and locked options, registry filters, demo vault creation, 375px fit, custom token paste, error and blocked states, registry picker, wizard route picker).

## Screenshots

`vaults-desktop.png`, `vaults-desktop-light.png`, `vaults-mobile.png`, `vaults-add-market-custom-token.png` (demo mode; the sticky header repeats mid-page because the shots are full page).


## Vault factory and the Aquarius ladder vault (branch `vault-factory`)

### How a created vault plugs into a Peridot market: NO market-factory change needed

`contracts/market-factory` already attaches any allowlisted vault that looks like a DeFindex vault (`YieldRoute::Defindex { vault }` in `add_market`, then `attach_yield`, which calls `check_defindex`). The ladder vault is built to satisfy exactly that surface:

1. `get_assets() -> Vec<{ address: underlying, strategies: [{ address: vault, name, paused: false }] }>` (one asset, one unpaused strategy; `paused` is true while the vault is paused or killed).
2. `get_asset_amounts_per_shares(shares) -> Vec<i128>` with one entry, and `get_asset_amounts_per_shares(0)` returns `[0]` (the receipt-vault probes the shape with 0).
3. The receipt-vault surface the market calls: `balance(id)`, `total_supply()`, `deposit(amounts_desired, amounts_min, from, invest) -> Vec<i128>` (pulls exactly `token.transfer(from, vault, amount)`), `withdraw(shares, min_amounts_out, from) -> Vec<i128>`.
4. Peridot admin must call `market-factory.set_yield_vault_allowed(admin, vault, true)` for the created vault (the factory refuses unreviewed vaults, by design). On mainnet that is `peridot-mainnet-admin`: it goes on the lead's list, one call per demo vault. The vault itself accepts deposits from any wallet, so it is also usable stand-alone without a market.

A vault bound to a market (`bind_market(owner, market)`, set once) accepts deposits only from that market, which is how a market keeps strangers out of its vault. Unbound vaults are open to wallets (`deposit_underlying`).

### Files (vault-factory work)

- `contracts/vault-factory`: generic factory (`set_wasm(kind)`, `create_vault(owner, kind, salt, init_args)`, `list_vaults`, `vaults_of`, `get_vault`, `transfer_admin`, `upgrade`). `init_args[0]` must be the owner (enforced). The factory is not an admin of the vaults it deploys.
- `contracts/aquarius-vault`: the ladder vault. `contracts/mocks/mock-kind-vault`: test fixture.
- `app/src/lib/vaults/kinds/`: `types.ts` (VaultKind, FieldSpec), `schema.ts` (validation, encoding), `aquarius.ts` (the Aquarius kind), `index.ts` (`VAULT_KINDS`). **Sibling agents add a kind by creating `kinds/<id>.ts` and adding it to `VAULT_KINDS`.** The Create page, live validation, summary, preview and My vaults are driven by the schema.
- `app/src/lib/vaults/factory-client.ts`: `createVault`, `listMyVaults`, manifest lookups (`vault_factory`, `vault_kinds.<kind>` in the app manifests `app/src/lib/peridot/deployments/<network>.json`). Demo mode keeps vaults in localStorage.
- `app/src/components/vaults/CreateVault.tsx`, `LadderPreview.tsx` (preview renderer per `PreviewModel.type`), `MyVaults.tsx`.


### Aquarius ladder vault: what it does

Depositors give ONE token (the pool's `underlying`). The vault lays it across a ladder of adjacent Aquarius concentrated-liquidity ranges ("rungs", 1 to 7) around the price, earning swap fees and AQUA emissions. The owner chooses, at creation and within hard bounds enforced by the constructor: pool, deposit token, keeper, rung count, rung width and spacing (in tick spacings), weighting (flat, pyramid, wings), rebalance trigger, cooldown, performance fee (max 20%, can only go down), deposit cap, swap slippage cap (0.5% to 5%).

Maintenance is a keeper loop: call `rebalance(keeper)` while `needs_rebalance()` is true. Pool operations on concentrated liquidity cost about 40 to 85 million CPU instructions each, so one transaction can only do 3 withdrawals (unwind) or 1 guarded swap plus 2 deposits (fund). A full rebuild of a five rung ladder therefore takes 5 transactions (about 1 XLM of fees in total on testnet). Withdrawals pay from idle funds first and then burn at most 2 rungs (the ones holding the most underlying, which also avoids a swap), so one withdrawal can take roughly a third of the vault; larger exits go in parts, or the owner calls `set_wind_down(true)`, the keeper unwinds, and everyone leaves atomically.

### Trust model (summary; the full text is the header of `contracts/aquarius-vault/src/lib.rs`)

- No function lets the owner or keeper send depositor funds to an address of their choice. Outflows are share redemptions to the redeemer, pool operations on the configured pool, and `sweep_extra` for tokens that are not the pool pair (AQUA rewards, airdrops).
- No upgrade path (immutable). After creation the owner can only change keeper, cap, lower the fee, pause deposits and rebalances, start a wind-down, and bind the vault to one market once.
- Pause and wind-down never block withdrawals. The vault-factory is not an admin of any vault; its admin can only register wasm hashes for future vaults and upgrade the factory.
- NAV is marked at the pool's spot price: a manipulated pool price moves the share price. Mitigations: deposit cap, 0.5% to 5% slippage guard on every swap, dead shares on the first deposit (no donation inflation, tracked balances), withdrawals priced on the same NAV.
- Known limits: AQUA emissions stay in the vault and are only sweepable by the owner (routing them to depositors is future work); performance fee shares are minted on deposits, withdrawals and rebalances; share tokens are not transferable.

### Testnet record (network `testnet`)

- vault-factory `CAORI4VMNA655LG3JD4B253YW74VIJ6L4ZXCSFL6R54S75GR746X2JUE`, wasm sha256 `231f72c4ace3f355668dff53f08694f61a890748c7e8bcdeb27c584f88677a7d` (reproducible), admin `GBZ7C3N43KURCM3DWN4LOOKR5XWHNU6EZEJQT5VGRLHKUUQQYL7UXFMJ`.
- kind `aquarius` registered with wasm hash `804bb4e29cc13c7adf7ef6da31098bf569d2b468cdeb6bf50b722ae9aab482d6` (`aquarius-vault`, reproducible).
- Demo vault `CCLMKV7K4DCKHZRGUVYRQLRXGBKJJYLKLJW2AWOLMIGPCQHHY6WYSSY6` on the testnet XLM/USDT concentrated pool `CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I`, underlying XLM, 5 rungs.
- Real run, all on testnet: create_vault `d8a04c35bd2db44f09c0f75b17bee16c44075727640ec10c4f701db22963efc9`; deposit 60 XLM `7a8f115483318675fcbf89984ac382e09618f97cfaf905370541297b7a16682e`; rebalance steps `19ca0413ac...810577`, `77fd52182a...daf32` (see deployments/testnet.json `demo.aquarius_vault.txs` for full hashes), last rung `261ff2bfb4e7e5ab6cd10d635582839f9d4ae8596f7f56494288b865d2db6fc9`; 25% withdrawal `6d462c7eb74c53d621552eb23614446a1b1afa38e255eacae209285411a42313`; harvest `ed11634d7df5b2ed538833c8ae6b09cfbfdb7c04162a1d97d83b78d9df9a9af2`; wind-down `e73a7e3e663b03d283d027e202601a29536c97a53bbdcb9d9b76da32599122b6`; unwind `f2ecced45b4a39c108014f3fed024e0a5e009dfbbc1ec33a1e7bf7c9134062b7`; final withdrawal `93a1a2b12d8552cc3898df7c0cc61046772c59ffecea9539571e32dce0d4ac50`. A second vault `CBGQUG5IWPAUESUZXE4BGVUOH2WJ6ACSQZFY5TZ5G5QCAGBYWCMGZ6TN` ran a full cycle (60 XLM in, 59.83 XLM out after a ladder build and a full exit; wind-down `1217ac36...a21e43`, withdraw `e45237c5f5108f38bd659b357f52e4115ec5d983784a320874a3651ce221a7f0`). Earlier vaults from the debugging of wasm iterations (`CADQ6JXQ...`, `CB4MT3NM...`, `CC6BSANB...`, `CDBI36YD...`, `CA7UV5A6...`, `CA3KQ2M6...`, `CDODD7IC...`, `CAP6ME4D...`) are testnet leftovers with a few test XLM in older wasm builds and can be ignored.
- CLI: `NETWORK=testnet IDENTITY=<identity> node scripts/vault_run.mjs create|deposit|rebalance|withdraw|winddown|harvest|state ...`; `scripts/deploy_vault_factory.sh factory|kind`.

### How siblings add a vault kind (Zenex, XOXNO)

1. Contract crate with a constructor whose FIRST argument is the owner address and which validates every bound itself. Build it with `scripts/deploy_vault_factory.sh kind <kind_id> <wasm_name>` (uploads and calls `set_wasm`; needs the factory admin key).
2. `app/src/lib/vaults/kinds/<id>.ts`: a `VaultKind` (fields with labels, help, min/max, defaults; `encode` for argument order; optional `validate`, `preview`, `summary`, `risks`). Register it in `kinds/index.ts` (`VAULT_KINDS`) and add a unit test like `kinds.test.ts`.
3. Record the wasm hash in `app/src/lib/peridot/deployments/<network>.json` under `vault_kinds.<id>`; the form enables submit once the factory and the kind are present for the selected network.
