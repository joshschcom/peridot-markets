# Launchpad pages

Branch `launchpad-ui`. New pages for the token launchpad (bonding curve, graduation into an Aquarius pool and a lending group), built on the redesigned UI kit. Testnet only during the beta: mainnet launches need a legal review and a 300,000 AQUA pool fee.

## Files

- Pages: `app/src/app/tokens/page.tsx`, `app/src/app/launch-token/page.tsx`, `app/src/app/token/[address]/page.tsx` (thin wrappers around client components).
- Components: `app/src/components/launchpad/` (`TokenList`, `LaunchTokenForm`, `TokenPage`, `TradePanel`, `GraduationPanel`, `CurveChart`, `LaunchpadFrame` with the Testnet badge, mainnet notice, risk copy and transaction status, `LpAddress` with testnet explorer links, `launchpad.css`).
- Client: `app/src/lib/launchpad/` (`config.ts`, `types.ts`, `math.ts`, `errors.ts`, `testnet-rpc.ts`, `client.ts`, `mock.ts`, tests).
- Outside the new folders: one nav entry in `app/src/components/ui/AppShell.tsx` ("Launchpad"), the unit test glob in `app/package.json`, one new e2e spec `app/tests/e2e/launchpad-flows.spec.ts`.

## Network behaviour

`launchpadMode()` in `lib/launchpad/config.ts` decides once per build:

| App setting | Mode | Reads | Writes |
|---|---|---|---|
| `NEXT_PUBLIC_USE_MOCKS=true` | `mock` | browser-local simulation (`mock.ts`, key `peridot:launchpad:mock:v1:<network>`) | simulated, "Demo action saved" |
| `NEXT_PUBLIC_NETWORK=testnet` | `live` | shared `readContract` (paced, coalesced) | shared `submitContract` (wallet lock, pending recovery); disabled by `NEXT_PUBLIC_READ_ONLY=true` |
| `NEXT_PUBLIC_NETWORK=mainnet` | `remote` | own read-only client pinned to the testnet RPC (`testnet-rpc.ts`) | none; notice with a button to `NEXT_PUBLIC_TESTNET_APP_URL` (disabled with a hint when unset) |

Addresses come from `LAUNCHPAD_TESTNET` in `config.ts`, which mirrors `launchpad_factory`, `factory` (market factory) and `demo.launchpad.*` of `deployments/testnet.json`. The launchpad never calls `getDeployments()`, because the app-side testnet manifest is still a stub. Every page shows a "Testnet" badge; mock mode adds "Demo", a read-only testnet build adds "Read-only". Explorer links on these pages always point at the testnet explorer, even on a mainnet build.

## Pages

- `/tokens`: `launch_count` plus `list_launches` in pages of 50, then `get_state` and `get_config` per token in parallel (cards fill in progressively; one failing curve hides nothing else). Card: name, symbol, price, market cap (price times sold) with FDV, progress meter to the target, phase badge (Trading, Graduatable, Graduating, Graduated), creator, date. Filters All / New / Graduated. Skeleton, error and empty states.
- `/launch-token`: three stages (Token, Curve, Review). Name and symbol validation mirrors the factory (`check_text`: 1 to 32 characters from letters, digits, space, dot, hyphen, underscore, no outer spaces; symbol 2 to 12 letters or digits), image URI at most 256 bytes. Presets Fast, Standard, Slow with the target read live from `get_preset(XLM, preset)` (on testnet Fast is currently 500 XLM, Standard 85,000, Slow 250,000). Optional creator buy, validated client side against the creator cap (5% of the curve supply) with the exact curve math, slippage default 1%. The review states the single transaction `launch_curve(creator, name, symbol, LaunchParams{quote_token, preset, metadata_uri, creator_buy, min_tokens_out})`, the launch fee from `config()` if set, the risk copy, and needs an explicit acknowledgement. Success links to `/token/<token>`.
- `/token/[address]`: resolves a token or curve address (`get_launch`, falling back to `get_config().token`). Header with token, curve and creator addresses (copy, testnet explorer), stats (price, market cap and FDV, raised and target, tokens sold), progress meter, bonding-curve chart (price against tokens sold from `k / (vt - sold)^2`, filled up to the current point, graduation marker), trade panel (Buy and Sell tabs, live `quote_buy` / `quote_sell` debounced 350 ms, fee, average price and impact, clamp notice "Your buy will be partly filled to land exactly on the target", slippage, client-side min-out, Max, balances, creator cap note), graduation panel, recent trades and lifecycle events from `getEvents`, "About" with the preset and trust note.
- Graduation panel: before the target it explains the six steps. In `Graduatable` or `Graduating` it shows a `Stepper` driven by `get_graduation().step`, the facts (XLM and tokens into the pool, `graduation_cost()`), the next step with its description and one button `graduate(payer)`. Step 1 shows the payer's AQUA balance, the trustline issuer parsed from the SAC `name()` and how to get testnet AQUA on Aquarius (swap XLM to AQUA; the demo run got about 1,660 AQUA for 50 XLM); the button is disabled with a precise reason (no wallet, wrong network, read-only, no trustline, balance below the fee). After `Graduated`: pool address, "Liquidity locked permanently" (LP shares sit on the all-zero account), amounts seeded, "Lending market live" with both market addresses and a link to `/groups/<id>` (on a mainnet build the link goes to the testnet app when configured), the group owner from `market_factory.get_group`, and "Claim your group" for the creator while `claimed` is false.

## Prices and math

The contract's `price` is scaled by 1e7, which truncates launch prices of a few stroops per token (the Fast preset starts at 1.6 stroops). The app therefore derives prices from the same reserves at a 1e-14 scale (`finePrice`) for display and the chart; everything that feeds a transaction (quotes, min-out, creator cap) is exact bigint math ported from `launchpad-curve/src/math.rs` and pinned to live testnet quotes in `math.test.ts` (for example 100 XLM on the untouched PDEMO curve yields 119,054,805,087,788 base units, and `soldAtTarget` of the Fast preset equals the graduated PGRAD curve's `sold`).

## Events

Testnet RPC `getEvents` works for curve events: the scan starts from a ledger estimated from the launch timestamp and pages with the RPC cursor (about 10,000 ledgers per page, at most 8 pages, flagged "Older events not scanned" when cut). Buys and sells become the trades table, everything else (`state_changed`, `pool_created`, `group_created`, `market_added`, `market_activated`, `graduated`, `group_claimed`, `upgraded`) the lifecycle list. Holder counts need an indexer and are not shown.

## Errors

`errors.ts` maps `Error(Contract, #N)` by the contract that actually failed. The host prints its diagnostic log newest first and every outer frame re-emits the same code while escalating, so the innermost frame is the LAST error entry (verified with a testnet simulation of `launch_curve` with an over-cap creator buy: factory, factory, then the new curve as a "Failed Diagnostic Event"). Curve codes (12 slippage, 13 trading closed, 15 creator cap, 22 pool not fresh), factory codes (5 name, 6 symbol, 10 launch not found), SAC codes (10 balance, 13 trustline) and the OpenZeppelin token's 100 (balance) read differently; `launch_curve` treats an unknown innermost contract as the new curve, and `graduate` returns the raw host message when the market factory, router, pool or AQUA fail, since their enums are not mapped.

## Demo data (mock mode)

Three launches: PGRAD (graduated, created by the demo wallet, group unclaimed so the claim flow is demoable), MOON (Standard preset, 40% to target, other creator), FOX (Fast preset, at the target, ready to graduate). The demo wallet holds 100,000 XLM and 5 AQUA. The e2e spec launches a token with a creator buy, trades it, drives MOON over its target with a clamped buy, runs the six graduation steps and claims the PGRAD group.

## Screenshots

`launchpad-tokens-desktop.png`, `launchpad-tokens-desktop-light.png`, `launchpad-tokens-mobile.png`, `launchpad-launch-curve-desktop.png`, `launchpad-launch-review-desktop.png`, `launchpad-launch-curve-mobile.png`, `launchpad-token-trading-desktop.png`, `launchpad-token-trading-mobile.png`, `launchpad-token-graduatable-desktop.png`, `launchpad-token-graduated-desktop.png`, `launchpad-token-graduated-desktop-light.png`, `launchpad-token-graduated-mobile.png` (mock mode), `launchpad-token-pgrad-testnet-readonly.png` (real testnet data for PGRAD through `NEXT_PUBLIC_NETWORK=testnet NEXT_PUBLIC_READ_ONLY=true`), `launchpad-tokens-mainnet-readonly.png` (mainnet build showing the testnet notice and read-only testnet data).

## Known limits

- Group links from graduated tokens use the app's network-selected market factory; on a testnet build they work once the testnet manifest is synced into `app/src/lib/peridot/deployments/testnet.json`.
- Holder counts are not shown (no indexer).
- With four nav links the mobile nav row scrolls horizontally at 375 px and its network badge sits off-screen until scrolled; a one-line padding change in `.mobile-nav a` (globals.css) would restore the fit.
