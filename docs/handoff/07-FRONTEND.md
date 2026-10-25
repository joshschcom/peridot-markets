# 07 Frontend agent: `app/` (launch wizard, groups, Control Panel)

Location: `peridot-markets/app`. Read `00-DROPOFF.md` sections 0 to 7 first.

## Setup

- The lead's first commit copies `../Peridot-Soroban/peridot-dashboard` into `app/` (Next.js 15, React 19, Tailwind 4, `@stellar/stellar-sdk` 13, Freighter, `src/utils/stellar.ts`). Extend it; keep its wallet connection.
- **Mainnet is the primary network** (phase 1 submission runs on mainnet). Testnet is supported for development via `NEXT_PUBLIC_NETWORK`. Mainnet RPC URL comes from env (use a reliable provider; document it).
- `src/lib/peridot/`: TypeScript bindings via `stellar contract bindings typescript` for market-factory, margin-factory, price-router, reward-distributor, receipt-vault, margin-controller, one YieldVault. Addresses from `deployments/<network>.json`. `mock.ts` implements the same interfaces so pages work from hour one (`NEXT_PUBLIC_USE_MOCKS`).
- Every write: simulate, show human-readable errors (map factory `#[contracterror]` codes, especially guardrails), then a progress item with a stellar.expert link.
- Design: Peridot system. `#0E1310` background, `#2C3B33` surfaces and borders, `#3DD68C` accent, `#1F6B48` secondary, Arial, left-aligned headings, few numbers per card, large hero stats. Works at 375px.
- Copy: plain language, jargon only in tooltips, "loss reserve" never "guaranteed", no em dashes. Mainnet banner: "Beta. New contracts are unaudited. Caps apply."
- Partners (DeFindex, Blend, Aquarius, Zenex, XOXNO, Reflector): neutral one-line factual descriptions, live APY where readable, docs link, no ranking language.

## Phase 1 pages (must ship on mainnet)

### `/launch` wizard
1. **Group**: name, description.
2. **Markets** (add as many as wanted; each an expandable card):
   - Token by address, auto symbol/decimals, SEP-41 check, Reflector feed availability.
   - **Interest rate**: presets `Stable`, `Volatile`, `Zero borrow rate`, `Custom` (base, slope, kink, jump) with a curve chart (recharts). Show the borrow APR at 0%, 50%, 80%, 100% utilization. Zero is allowed.
   - **Risk**: collateral factor (max per guardrail), supply cap, borrow cap, reserve factor.
   - **Kept liquid**: 10% to 100% with a one-line explanation.
   - **Where idle liquidity goes**: `Keep in Peridot`, `DeFindex vault` (filtered by asset), `Blend` (Peridot fee vault for that asset if present). Later phases light up `Aquarius LP vault`, `Zenex perps vault` (USDC only; risk line: earns perps fees, shares can lose value, Zenex withdrawals take at least 1 hour) and `XOXNO Lending`; show them as "coming in this build" only if not yet deployed.
   - **Price**: phase 1 shows Reflector only (with feed status). Phase 3 adds `Reflector + Aquarius check` and `Aquarius only`.
   - **Leverage**: toggle.
   - **Rewards**: supply and borrow emissions in tokens per day (only if rewards are set for the group).
3. **Rewards (group)**: choose reward token (or skip), amount to fund now, runway estimate. Warn that the token cannot be changed later for this group.
4. **Leverage (group)**: max leverage 1x to 5x, slippage, liquidation incentive and fee; effective max per asset `min(group_max, 1/(1-CF))`. Phase 3 adds per-asset caps and open/close fees.
5. **Review and launch**: summary, client-side guardrail checks, then the tx sequence (`create_group`, `add_market` x N, `attach_yield` x N, `set_rewards` + `fund` + speeds, `enable_margin`). Resume from localStorage on failure (wrap storage in try/catch).

### `/groups/[id]`
Markets table: asset, supply APY, borrow APY, reward APR, route badge + route APY, liquid %, utilization, price status. Row drawer: supply, withdraw, borrow, repay; vault panel (`get_state` or DeFindex reads per 04); price panel (`price_router.check`). Rewards card: accrued, claim. Leverage tab: open long/short, positions with health factor and liquidation price, close.

### `/groups/[id]/control` (owner only)
Editors per market and group, each with current vs new value and Save. Collateral factor and price changes are **staged for 60s** by the core: show a countdown, then call `apply_pending` automatically (and show a manual Apply button). Editors: risk, rates (including setting borrow to 0), kept liquid, price, rewards (speeds, fund, withdraw unallocated), leverage (group config, per-market toggle, pools), pause, **Add market** (same card as the wizard), transfer ownership. **History** from factory and margin-factory events. Phase 2+: keeper card (mode, last harvest; phase 4: paid until, extend).

### `/groups` and `/`
List of groups (owner's first) with "Launch your market" CTA. Landing hero: one-liner, three bullets (launch, route, leverage and rewards), CTA.

## Later phases

- Phase 2: Aquarius route option in wizard and Control Panel, vault panel with loss reserve and coverage ratio, keeper card with self-host instructions link.
- Phase 3: price modes, per-asset leverage, trading fees, Zenex route with pending-order status in the vault panel.
- Phase 4: XOXNO route, hosted keeper purchase (`fund_keeper`), switch yield route.

## Deliver

Live URL (Vercel) on mainnet, set in README; screenshots into `docs/assets/`; `.env.example` documented. Test every phase on a fresh Freighter account before tagging.
