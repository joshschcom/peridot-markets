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
- **App**: `/launch-token` opens with a chooser (Simple token, Bonding curve launch, ICO shown as "Coming later"). The simple path is `SimpleTokenForm` (name, symbol, supply, fixed decimals, optional image URI, risk acknowledgement) with a success card (token address, explorer links, "Later: add a Peridot market" hint). `/token/<address>` shows `PlainTokenPage` for simple tokens, and `/tokens` has a "Plain" filter with cards tagged Plain. Demo mode keeps simple tokens in the browser mock (`plainTokens`). Screenshots: `docs/ui/simple-token-*.png`.
- **Which type is which**: the chooser compares the three types side by side (price, who can buy, what the creator pays, what happens at the end; the ICO column is marked "Coming later"). Every token card and token page carries a type badge: Simple, Curve or ICO (`TypeBadge` in `LaunchpadFrame.tsx`). The list filter for simple tokens is "Simple".
- **Tests**: 5 factory unit tests (`cargo test -p launchpad-factory plain`), `app/src/lib/launchpad/plain.test.ts`, and two Playwright flows in `tests/e2e/launchpad-flows.spec.ts`.
