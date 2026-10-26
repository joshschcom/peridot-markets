# 12 Launchpad agent: bonding-curve launches and ICOs that graduate into a Peridot market

**Phase 3 (bonding curve + graduation), phase 4 (ICO).** Location: `peridot-markets/contracts/launchpad-*` and `app/src/app/launch-token/`. Read `00-DROPOFF.md` sections 0 to 7 and `11-ADDRESSES.md` (Aquarius) first. Nothing like this exists in Peridot's repos yet: everything here is new work. Include `upgrade(admin, hash)` with immediate effect on every new contract.

## Why it matters for judging

It closes the loop of the intake goal "lending and borrowing markets no matter how new the project is": a project launches its token on Peridot, and when the launch completes, the token **graduates** into an Aquarius pool **and** its own isolated Peridot market group, with no listing step. One flow from day zero to a money market. The demo line: "Launch a token, and it gets a lending market the moment it graduates."

## Contracts

### `launchpad-token` (template)
- OpenZeppelin fungible token (workspace dep), fixed supply minted once at construction to the launch contract. **No mint function after construction, no admin, no freeze.** Metadata: name, symbol, decimals 7, optional image URI in a `metadata` map.

### `launchpad-curve` (one per launch, phase 3)
Pump-style bonding curve on virtual reserves, quoted in XLM (native SAC; USDC as an option behind a flag).
- Constructor: `token`, `quote_token`, `virtual_quote`, `virtual_token`, `curve_supply` (for example 80% of supply), `lp_supply` (for example 20%), `graduation_target` (quote raised), `trade_fee_bps` (default 100), `creator`, `factory`, `treasury`.
- `buy(user, quote_in, min_tokens_out) -> i128` and `sell(user, tokens_in, min_quote_out) -> i128`, constant product on `(virtual_quote + real_quote) * (virtual_token - sold) = k`. Fee to treasury (optionally split with the creator). Slippage bounds required.
- `quote_buy`, `quote_sell`, `get_state` (price, progress to graduation, market cap, holders count if cheap).
- When `real_quote >= graduation_target`: trading stops, `graduate()` becomes callable by anyone.
- Anti-rug guardrails: creator buy at launch capped (for example 5% of curve supply); no owner withdrawal of raised funds before graduation; constants fixed at construction.

### `launchpad-factory` (one, phase 3)
- `launch_curve(creator, name, symbol, params) -> (token, curve)`: deploys token + curve with `deploy_v2`; params checked against guardrails; optional launch fee.
- `launch_ico(creator, ...)` (phase 4, below).
- `list_launches(start, limit)`, `launches_of(creator)`.

### Graduation (the key integration)
`graduate()` on the curve, permissionless:
1. Create an Aquarius pool for `token / quote` through the Aquarius router and deposit `lp_supply` tokens plus the raised quote (minus fees). **Verify the router's pool-creation function and fee options first** with `stellar contract info interface --id <router> --network <net>` (look for `init_standard_pool` / `init_concentrated_pool` or similar; signatures in Aquarius docs, "Router & pool contracts"). Use a constant-product pool if concentrated creation is not exposed.
2. Lock the LP: send the LP shares to a burn/lock contract with no withdraw path. State it in the UI ("liquidity locked permanently").
3. Call the **market factory**: `create_group(owner = creator, name = symbol)` and `add_market` for the new token **and** the quote asset, using the launchpad preset: price `AquariusOnly` through the group's price router (the token has no Reflector feed), collateral factor 25%, supply cap sized from pool depth, borrow cap 10% of supply cap, no margin, idle buffer 50%, stable rate preset for the quote asset. The owner can tighten later; loosening stays inside factory guardrails. If `AquariusOnly` (phase 3, 05) is not live yet, add the token market with borrowing paused and only the quote market active, and say so in the UI.
4. Emit `Graduated { token, pool, group_id }`. The token page links to its new market.

Graduation must fit Soroban resource limits: split into `graduate_pool()` and `graduate_market()` if one transaction is too large, both permissionless.

### `launchpad-ico` (phase 4)
Fixed-price sale for projects that prefer a regular ICO.
- Params: `price`, `soft_cap`, `hard_cap`, `start`, `end`, `min_buy`, `max_buy_per_wallet`, `quote_token`, `lp_share_bps` of raise for the pool, optional vesting (`cliff`, `duration`) for buyers and a separate one for the team allocation.
- `contribute(user, amount)`, `claim(user)` after a successful sale (respects vesting), `refund(user)` if soft cap is not met by `end`, `finalize()` permissionless after `end`: on success runs the same graduation (pool + locked LP + market group), sends the rest of the raise to the creator per the configured split.
- Optional allowlist (Merkle root) and per-wallet caps.

## Frontend (`app/`)

- `/launch-token`: choose **Bonding curve** or **ICO**, token details, curve preset (Fast, Standard, Slow graduation target) or ICO terms, review, deploy.
- `/token/[address]`: price chart from events, buy/sell panel with slippage, progress bar to graduation, holders and trades, after graduation a card "Lending market live" linking to `/groups/[id]`.
- `/tokens`: new, trending (by volume), graduated.
- Risk copy, plain and visible: "New tokens are highly risky. Prices can go to zero. Peridot does not vet projects."

## Compliance note (Joshua decides)

Offering tokens to the public is regulated in the EU (MiCA) and elsewhere. For the hackathon: mainnet launches only by the team's own demo token, a clear disclaimer, no marketing of any third-party sale. Record "legal review before opening public launches (MiCA white paper and CASP questions)" as a next step in the README roadmap.

## Tests

1. Curve buy/sell math matches the closed form; fee accounting; slippage bounds.
2. Graduation at target: pool created, LP locked, group and markets created with the launchpad preset.
3. Creator cap enforced; no mint after construction.
4. ICO: soft cap miss refunds everyone; success claims respect vesting; finalize graduates.

## Deliver

Mainnet: one demo token launched on the curve with team funds, bought up to a small graduation target, graduated into an Aquarius pool and a Peridot market group, with all txs in DEMO.md. SPECS.md "Launchpad" section with curve formula, fees, graduation steps and the launchpad market preset.

## Simple token (no curve, no ICO)

For creators who do not want a raise or a bonding curve: `launchpad-factory.create_plain_token(creator, name, symbol, supply, metadata_uri) -> Address`.

- **What it does**: deploys one immutable `launchpad-token` (the same Wasm as curve launches) and mints the whole supply to `creator` in one transaction. No curve, no ICO, no launch fee (only network fees). `supply` is in WHOLE tokens (1 to 1e12); decimals are fixed at 7 because the token template and the Peridot market guardrails use 7-decimal assets, so the token can be listed in a market later.
- **Why inside the factory, not a new contract**: the factory is upgradeable by its admin (`upgrade(admin, hash)`), and the new code only adds storage keys (`PlainCount`, `PlainToken(id)`, `PlainIndex(token)`, `PlainCreator(addr)`) appended after the existing ones, so the testnet factory was upgraded in place. The curve registry, the existing demo tokens and every curve are untouched, and no stack redeploy was needed. It reuses the stored token Wasm hash, so no `set_wasm` was needed either.
- **Registry**: separate from curve launches so `LaunchInfo` (which requires a curve) keeps its shape. Views: `plain_token_count`, `list_plain_tokens(start, limit<=50)`, `plain_tokens_of(creator)`, `get_plain_token(token)`. Event `plain_token_created(id, creator; token, symbol, supply)`. Name and symbol use the curve rules, at most 100 per creator, honours `set_paused`. Error `InvalidSupply = 17`.
- **Testnet**: factory upgraded to Wasm `71944f62ff68f4f93e0a98fe111b7b51ca256677ffd778f206812815a91be511` (tx `e89a956e...aec3d`); first token SIMPL `CDZ2IJSAFRCZRAZX3UFAIZQ5LB53IADDNJUCWFKFGMBQS6S3EMOSCQB2`, created by tx `26184e1b2a0052073620883b473ea7831f9d9db9ef38fc10c062071fb15ad795`. Recorded under `demo.launchpad.plain` in `deployments/testnet.json`. Mainnet is untouched (the launchpad is not deployed there).
- **App**: `/launch-token` opens with a chooser (Simple token, Bonding curve launch, ICO enabled as a fixed-price sale). The simple path is `SimpleTokenForm` (name, symbol, supply, fixed decimals, optional image URI, risk acknowledgement) with a success card (token address, explorer links, "Later: add a Peridot market" hint). `/token/<address>` shows `PlainTokenPage` for simple tokens, and `/tokens` has a "Plain" filter with cards tagged Plain. Demo mode keeps simple tokens in the browser mock (`plainTokens`). Screenshots: `docs/ui/simple-token-*.png`.
- **Which type is which**: the chooser compares the three types side by side (price, who can buy, what the creator pays, what happens at the end; the ICO column explains the soft cap, hard cap and full refunds). Every token card and token page carries a type badge: Simple, Curve or ICO (`TypeBadge` in `LaunchpadFrame.tsx`). The list filter for simple tokens is "Simple".
- **Tests**: 5 factory unit tests (`cargo test -p launchpad-factory plain`), `app/src/lib/launchpad/plain.test.ts`, and two Playwright flows in `tests/e2e/launchpad-flows.spec.ts`.


## ICO delivery (2026-10-26, testnet only)

This implementation follows `docs/ICO-TASK.md`, which supersedes the broader phase-4 wishlist above. It uses the allowed simple settlement rule: the creator withdraws a successful raise and unsold tokens; a failed sale returns every buyer's full contribution and lets the creator reclaim the supply. Aquarius seeding, market graduation, vesting and allowlists are outside this version. No mainnet transaction was submitted.

- Contract: `contracts/launchpad-ico`, SDK 25.3, one escrow per launch. Exact-input purchases, cumulative optional wallet cap, bounded arithmetic, permissionless finalization, independent one-time claims/refunds, creator settlement. Compile-time admin can pause only new purchases. `upgrade(admin, hash)` permanently locks after the first buy, preventing an upgrade from taking buyer funds.
- Factory: upgraded in place. `IcoWasm`, `IcoCount`, `IcoRecord`, `IcoIndex` and `IcoCreator` are appended keys. Existing simple and curve records retain their encoding. `set_ico_wasm` only changes future deployments. The actual Wasm deployment test verifies full escrow funding and coexistence with simple/curve launches.
- App: `/launch-token` enables ICO with a validated form and sale preview. `/token/<token>` shows price, funding progress, start/end countdown, buy preview, claim/refund, finalization and creator withdrawal. `/tokens` adds an ICO filter and badges. All signing paths use the existing wallet transaction pipeline and enforce testnet. Mainnet app mode is read-only testnet data.
- Demo: the browser mock includes Orbit Collective and supports creation, purchases, settlement and balances. Explicit start/end clock controls allow recording either result without waiting or a wallet. Amount math uses bigint and follows contract rounding.
- Build: `NETWORK=testnet IDENTITY=peridot-testnet-admin CRATES_ONLY='launchpad-ico launchpad-factory' bash scripts/deploy.sh build-new`. The script bakes the selected admin into the ICO Wasm. The checked-in factory test fixture is the optimized deployed ICO Wasm.
- Smoke script: `python3 scripts/demo_ico_testnet.py launch`, then `python3 scripts/demo_ico_testnet.py settle` after the deadlines. Network is hardwired to testnet; existing Stellar identities sign without exporting secrets. Records are written through `scripts/lib/dep.py`.

### Deployment and real testnet evidence

Both sales used 1,000 tokens, price 1 XLM per token, hard cap 100 XLM, wallet cap 60 XLM and a ten-minute window. Each of the two accounts bought 10 XLM. Success used a 10 XLM soft cap; failure used 50 XLM. Both buyers claimed 10 tokens from the success sale and recovered exactly 10 XLM from the failed sale. The creator withdrew 20 XLM plus 980 tokens from success, and all 1,000 tokens from failure. Both quote escrow balances were verified zero after settlement.

| Contract | Testnet ID |
| --- | --- |

| Existing launchpad factory | `CBYQC54BS5HIWEO6KQNVGZ6XRNOTG3OMT6UZYBUD2NESGHBQMALGSBWC` |
| Success token | `CBCRTZ4KF7XXLUR3ZUWO5DAZ6SSC733KIOGHOXU4Y47LKNCKIXXC6RTO` |
| Success ico | `CBFXZCYSLPZMWOC5QTEW2TPJWGCWJOIO2KCNENRRTAYO4SKKIAPITP3J` |
| Refund token | `CBDRBDB2ILY674BFCORPRLWMPU7R7FOGZTC7FOB3TVR37LN6B5O2H3S6` |
| Refund ico | `CAI22V7WJGKBDLH3YECIAHQ3TKQ24ZNVOITOQQ7NGXR4M4GL7WG26IUO` |

| Wasm | SHA-256 / installed hash |
| --- | --- |
| launchpad_ico | `516dfcd5fab8c1abd28ccfa911f201463d11b4d9157919259b204c66fbdab306` |
| launchpad_factory | `b371a8c37cb6a9cabd74b28c899f86114efa7a85e955042085f78c3261ee6d62` |
| launchpad_token | `aab4c9e060086d8928459dd4efe16c1ecc381b3eb9abdf55d363b9914965a550` |

| Operation | Testnet transaction hash |
| --- | --- |
| Factory upgrade | `867875896d22e9be7aad402923f13ca8f64645dca32a074200d87688d6853361` |
| Factory register | `e4419bf67dcaa38e24c4535196e208fd38b22a89da67d5c410e8cf17de77affb` |
| Success create | `0a79551daad3ffb6e8a40c6001e02e8224a7f1783df97933a0700d9a4dbb2407` |
| Success buy_1 | `a75947d3262b11c38c0ea123c6aed192ce60e636786cc692827347b5f880f48a` |
| Success buy_2 | `6cfb53a66441424956cbcd61ead0fe9e3d0b0f2500b556f91a3db021c4020ce1` |
| Success finalize | `e724d89a1efa26a1d666a39ce32a409f17c98aa0244efadfa89755b498b636f9` |
| Success claim_1 | `13be0402df9838c4751e804f4d61074c1ca688e66b9e610a48f2653d3e25831a` |
| Success claim_2 | `a3730883b578af202134fb23838c1a0d1a3a293dfddf5acfe80539f9eabf6401` |
| Success withdraw | `46789aeff2276f6368712f72e7f4b254056c9254956b7b2c6d35dbaf6730982f` |
| Refund create | `b56f54f683cf534b7ab9aa6a9b3375ae91b9102c2e8139060424745fab3541a3` |
| Refund buy_1 | `f804e614d47a66ffa42289e6544466ed962b0ff48b652e4bec09b9f1a78af0a0` |
| Refund buy_2 | `b07d0a6f3c32b8aa168fa9b654172159c9d5fd3dcc1b063338166968da67841b` |
| Refund finalize | `1a2549043f2efa15fc22c3ce05370e15fbcdac0c6cf73a52c07e755cc91f4577` |
| Refund refund_1 | `cea4e092965043a64779babc686ea8c3a19cc2b10b6db70826f1c2c4bc89b0ce` |
| Refund refund_2 | `ae6afe6964b8147789ac8f58e59d7bf267fb8e726f7787a928f1d0c825e19979` |
| Refund withdraw | `67e167e05d6d4fa575151b2b947baa8c5d5f990ffa7870ff911a14702b38d3b0` |

The second creation initially timed out (`82031ea0f01f9a057806ed9e384eb502d4101abb3940fbc81d577ee9dc2b2d45`). RPC returned NOT_FOUND and the registry contained only the first ICO before retrying. The recorded second creation above used a higher testnet inclusion fee. No duplicate ICO was created.

### Verification and remaining scope

- Workspace `cargo test`: 923 passed, zero failures, five existing ignored tests. An expanded ICO-only run additionally covers three new cases (11 ICO tests total), including failed transfers rolling back, refund authorization, permanent upgrade locking after refunds, and conservation across 80 rounded buys.
- `npm run typecheck`, `npm test` (202 tests) and `npm run build`: pass. The production build uses network access for the existing Google Fonts dependency.
- Browser verification and final screenshots are recorded after the final rerun. Cold Next.js route compilation exceeded the original five-second assertions; the suite now allows 90 seconds for assertions, 240 seconds per flow and 360 seconds for the cold development server startup. The observed cold token-route compilation took 55 seconds; the existing group route took 72 seconds, and the initial root compilation took 258 seconds.
- Real app decoders: `NEXT_PUBLIC_NETWORK=testnet NEXT_PUBLIC_USE_MOCKS=false npx tsx scripts/verify-ico-testnet.ts` reads the same registry and state methods used in the UI, checks bigint/u32 decoding and verifies existing curve tokens are not mistaken for ICOs.
- Screenshots: `docs/ui/ico-desktop-dark.png`, `ico-desktop-light.png`, `ico-mobile-dark.png`, `ico-create-mobile.png`.
- Required ICO scope is implemented. Optional Aquarius seeding, lending market graduation, vesting and allowlists are not included. No mainnet deployment or transactions. No keeper changes or changes to the reference Soroban repository.

Shared files changed: root Cargo workspace and lockfile; launchpad factory sources, tests and Wasm fixture; `scripts/deploy.sh`; testnet Wasm artifacts and `deployments/testnet.json`; launchpad client error/config/mock support, chooser/list/router/styles and launch page metadata; Playwright config and launchpad specs; this handoff and `docs/SPECS.md`. New dedicated files contain the ICO crate, app flow, testnet smoke and read-verification scripts, and ICO tests/screenshots.
