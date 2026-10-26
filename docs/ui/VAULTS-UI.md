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
