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

## Zenex vault kind (branch `zenex-vault`)

Kind `zenex` in `app/src/lib/vaults/kinds/zenex.ts` (fields, bounds that mirror the constructor, `init_args` = `(owner, market, underlying, cfg struct as a sorted ScMap)`, preview rows, summary, risks). It appears in the Create vault form and in the venue list as "Testnet, customizable". It is not a market-wizard route (`factoryRoute: null`): create the vault on `/vaults`, then the Peridot admin allow-lists it and the market uses it through the DeFindex route. Testnet runs against a MOCK Zenex; Zenex itself is mainnet only. Screenshots: `docs/ui/zenex-venues.png`, `zenex-create.png`, `zenex-created.png`. Mainnet txs: none submitted (upload would cost about 35 XLM).


## XOXNO vault kind (branch `xoxno-vault`)

`app/src/lib/vaults/kinds/xoxno.ts` adds the `xoxno` kind to the VaultKind registry (fields, bounds, `init_args` order, summary, preview), so it appears in Create a vault. The yield venue list shows XOXNO as "Testnet, customizable" (`statusNote` in `registry.ts`): not selectable as a market route in the launch wizard (`factoryRoute: null`) until Peridot admin allowlists a created vault; honest note on the card. The real testnet vault works (see SPECS "XOXNO vault"); in-app deposit and withdraw are not built, use `node scripts/xoxno_vault.mjs deposit|withdraw|show`. Tests: `src/lib/vaults/kinds/xoxno.test.ts`, e2e in `tests/e2e/vaults-flows.spec.ts`. Screenshots: `docs/ui/xoxno-create-vault.png`, `xoxno-create-vault-result.png`, `xoxno-venue-list.png`.

### XOXNO vault: mainnet runbook (EXECUTED 2026-10-26, see deployments/mainnet.json `xoxno_vault` for tx hashes; demo vault CCXPXDV3...HCDC holds 3 XLM)

Real mainnet XOXNO exists (controller `CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX`, pool `CBXRNDQMAJFG4VUKMKFEMFS75UUXE2SPSNV4LEEFCSNBCN66PYRWBKXO`, hub 1 spoke 1 lists native XLM, unpaused). Build: `NETWORK=mainnet INIT_ADMIN=GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH scripts/build_xoxno_vault.sh` gives `61d1443a708a10691ad6cf955584cf43cb4fd9465e4c40e927ad1673bb63bc23` (22775 bytes; testnet build with the testnet controller and admin: `b00478fe9d698cb901ae3fccd6ed8fe336beb59e46f984875bbcb4a0bac84342`). The hash depends on the checkout path only through nothing but the two baked strings (Codex confirmed the two builds differ only there), and on the pinned toolchain. Codex review verdict GO for a 5 XLM demo (two passes, findings fixed or documented).

Sequence (sequential, from `peridot-mainnet-vaults`, after the vault-factory agent's txs): 1 upload wasm (`stellar contract upload`), 2 factory admin `set_wasm(admin, xoxno, hash)` (needs the factory admin key), 3 `NETWORK=mainnet CONFIRM_MAINNET=yes node scripts/xoxno_vault.mjs create --identity peridot-mainnet-vaults --asset CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA --hub 1 --spoke 1 --cap 10 --min 1 --fee 1000`, 4 `deposit --amount 5`, 5 `withdraw` part of it. Simulated cost on 2026-10-26: wasm upload alone is about 30.95 XLM (rent for a 22.8 KB code entry), so the total is about 33 to 37 XLM plus 5 XLM principal that comes back.

### Zenex mainnet status (branch `zenex-vault-mainnet`)

Zenex wasm uploaded on mainnet by `peridot-mainnet-vaults` (tx `259c9419...c64d`, 32.39 XLM), hash `99a3fc7e0275a209f44a50256d822ccfcad4da0d2824979ec7f08dc32abff399`, reproducible, baked admin `GC3FLITV...7CXH`. A `create_contract` simulation with the real Zenex market and vault ids succeeds (constructor checks pass against the live protocol). No vault instance and no USDC deposit yet. Admin commands: `scripts/zenex_vault_mainnet.sh admin-cmds` (set_wasm on the mainnet vault factory once it exists, then `set_yield_vault_allowed` on the market factory per vault). `scripts/zenex_vault_mainnet.sh create` simulates by default; `SEND=yes` submits.


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
- kind `aquarius` registered with wasm hash `77ead300da294e48c04199d9e873d70283f59ea9309ee9ef92944fbf5345dd76` (`aquarius-vault`, reproducible; this build contains the fixes from two Codex second-opinion passes, see below).
- Real run on the final wasm, all on testnet, vault `CBWUPVVIIN3ZGQYRF3FYAP4FKAIKX5WFAZKZWST3WSQ2I73JBSYNUWTD` (testnet XLM/USDT concentrated pool `CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I`, underlying XLM, 5 rungs): deposit 40 XLM `4c437611e02c4a7d7f85c686e7e46aa3d0f05b0bac4806383e4d1b8191f5d24c`; ladder built in three rebalance transactions `70e1d52a2c0266285c857b9ddbf2fe9eedd197e95d74742003162840ec4b15f3`, `a97de7dc743292f5a7a8a8dd83b645ba98a4565313bf0f1c5cbeebd7bd6f4032`, `35410cc7d9e6a5d9dcf4c2036b1ab90a8517de02fd8e2b5c24e6b26a72076605` (swap plus 5 pool deposits); deposit 5 XLM into the live ladder `8ddb7f8efbdbf220de9a23c19f97e64bcaf112be452bcbb9d64123c5ede50502`; 25% withdrawal `08bc9c41dd8e1f861f8637eb256409fe9ca078d0b1a0b8fcb59ced71e53f0976`; wind-down `1b5abdebac428ac4fd56dd86b9f78f59c372efd5794a43ad76758356c407b5ae`; two unwind steps `79027846f2...7ff889`, `53aa47244b...f6182`; final withdrawal `2d72ba2e02336fb061330ec1d1c70c7d449931227f5fdca907f6304209b5d1d5`. Net: 45 XLM in, 44.91 XLM out (pool fees of the ladder swap and exit swap; the testnet pool is thin, so the swap impact is large). Full hashes: `deployments/testnet.json` `demo.aquarius_vault`.
- Earlier wasm iterations left test vaults on testnet that can be ignored (`CCLMKV7K...`, `CBGQUG5I...`, `CADXEUCF...`, `CAOITD53...` and older).
- CLI: `NETWORK=testnet IDENTITY=<identity> node scripts/vault_run.mjs create|deposit|rebalance|withdraw|winddown|harvest|state ...`; `scripts/deploy_vault_factory.sh factory|kind`.

### How siblings add a vault kind (Zenex, XOXNO)

1. Contract crate with a constructor whose FIRST argument is the owner address and which validates every bound itself. Build it with `scripts/deploy_vault_factory.sh kind <kind_id> <wasm_name>` (uploads and calls `set_wasm`; needs the factory admin key).
2. `app/src/lib/vaults/kinds/<id>.ts`: a `VaultKind` (fields with labels, help, min/max, defaults; `encode` for argument order; optional `validate`, `preview`, `summary`, `risks`). Register it in `kinds/index.ts` (`VAULT_KINDS`) and add a unit test like `kinds.test.ts`.
3. Record the wasm hash in `app/src/lib/peridot/deployments/<network>.json` under `vault_kinds.<id>`; the form enables submit once the factory and the kind are present for the selected network.

### Second opinion (Codex) before mainnet

A read-only Codex review of the first build found: accrued fees counted twice in NAV (the pool's `estimate_withdraw_position` already includes them, verified against the live mainnet pool), exhausted rungs breaking later unwinds (pool error 2018 on a zero-liquidity withdrawal), wind-down not clearing a pending funding plan, the redeemer not bearing their own conversion loss, a stale cached NAV used as a quote, and spot-price manipulability. All but the last were fixed in the final wasm and re-run on testnet. A second pass on the fixes found one more P1 (deposits must wait while the ladder is staged, because the other token then sits idle valued at spot), fixed in the final wasm and re-run on testnet (that last fix was not reviewed again). Spot-price manipulability remains a documented limit: deposit cap, 0.5% to 5% swap guard, deposits refused while the price is outside the ladder, and a small demo cap; in-kind exits are also priced at spot (not price-free).
