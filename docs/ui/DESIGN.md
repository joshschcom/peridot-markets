# Peridot Markets UI design notes

Branch `ui-redesign`. Presentation layer only: `app/src/app/**`, `app/src/components/{ui,charts,launch,groups,control,markets}/**`, `app/public/**`. Nothing under `app/src/lib/peridot/**`, `app/src/wallet/**`, `app/src/components/peridot/**`, `app/scripts/**`, `app/tests/**`, `keeper/`, `contracts/`, `core/`, `scripts/` or `deployments/` was changed.

## Tokens (`app/src/app/globals.css`)

- Color: `--bg`, `--bg-elevated`, `--surface`, `--surface-2`, `--surface-3`, `--border`, `--border-strong`, `--text`, `--text-2`, `--text-3`, `--accent` (Peridot green), `--accent-strong`, `--accent-ink`, `--accent-text`, `--accent-soft`, plus `--info`, `--warn`, `--danger`, `--success` and their `-soft` washes.
- Chart roles: `--chart-grid`, `--chart-axis`, `--chart-text`, `--series-1` (supply, profit), `--series-2` (borrow), `--series-3` (buffer), `--series-neg` (loss, liquidation).
- Radius `--r-sm/md/lg/xl` (6/10/14/20px), shadows `--shadow-1/2`, focus ring `--focus`, layout `--content` (1200px), `--gutter`, `--header-h`.
- Type: Inter through `next/font/google` (`--font-inter`) with a system fallback; 14px base, headings 36/20/16/14, tabular numerals on tables, stats, meters and decimal inputs.
- Themes: dark is the default (`<html data-theme="dark">`). `data-theme="light"` switches every token. A pre-paint script in `layout.tsx` reads `localStorage['peridot:theme']` or `prefers-color-scheme`; the header toggle (`ThemeToggle`) writes it back. Both themes target WCAG AA on text and controls.

## Components (`app/src/components/ui`)

- `AppShell`: banner with the unchanged three-state risk copy (demo / read-only / "Beta. New contracts are unaudited. Caps apply."), sticky header with logo, nav, network badge ("Mainnet beta", "Testnet" or "Demo"), wallet provider select and wallet button (same calls as the previous shell), theme toggle, mobile nav row, footer with the pending-transaction check. The old `components/peridot/AppShell.tsx` is left untouched and is no longer imported.
- `primitives.tsx`: `Badge`, `Stat`, `Meter` (utilization and cap bars, auto tone at 75/90%), `Tooltip` (hover and focus, `role="tooltip"`), `Skeleton`, `Notice` (status/alert boxes with icon), `EmptyState`, `Tabs` (plain buttons, no ARIA tab roles so existing button queries keep working), `Stepper`, `Countdown` (60 second ring, renders "Applies in Ns" once), `KeyValue`.
- `Address.tsx`: truncated address with copy to clipboard and a stellar.expert link for real contract and account keys; `TxLink` for transaction hashes (demo hashes render as plain text).
- `format.ts`: display-only formatters (`fmtAmount` with grouping and bounded fraction digits, `fmtCompact`, `fmtPct`, `fmtScaledPct`, `fmtBps`, `shortAddress`, `runwayDays`, `fmtDate`). Exact math stays in `lib/peridot/amount.ts`.
- CSS vocabulary: `.card`, `.card-header`, `.status`, `.badge`, `.button` (`secondary`, `ghost`, `quiet`, `danger`, `sm`, `large`, `block`), `.field` / `.field-hint`, `.data-table` (stacks into cards under 760px via `data-label`), `.tabs`, `.stepper`, `.step-list`, `.tx-list`, `.history`, `.kv`, `.meter`, `.two-col` with `.sticky-aside`.

## Charts (`app/src/components/charts`)

All charts use recharts with CSS-variable colors, solid hairline grids, 2px lines, a legend for two series, a custom tooltip, an `aria-label` summary and a visually hidden table of key values.

- `RateCurveChart`: sweeps 0 to 100% utilization through the exported `rateApr()` from `lib/peridot/group-client` with the market's `rates` and `reserve_factor`, so borrow and supply APR match the dashboard numbers. A dashed marker shows current utilization when the market is live. A zero curve is drawn flat on a 0 to 1% axis with an explicit caption. Used in the group manage panel, the market editor (launch and add-market) and the Control Panel rate section (draft values).
- `PayoffChart`: PnL versus price move for the entered margin, leverage and side (PnL = leverage x margin x move, floored at minus the margin). Break-even, entry, "whole margin lost" (move of 1/leverage) and the liquidation line are annotated. The liquidation move comes from the exported `liquidationPriceEstimate()` applied to a normalized position; the maintenance ratio is `margin.status.maintenance_margin` when the margin factory reports it, otherwise 1 minus the collateral factor of the collateral asset, and the caption then says "estimated". Fees and slippage are excluded and the caption says so.
- `RunwayBar`: distributor balance divided by total emissions (`supply_reward_per_sec + borrow_reward_per_sec` over the group's markets); full at 30 days, with per-day emission and funded balance in the hint. Used on the group rewards card, the Control Panel rewards card and the launch rewards step (from draft values).
- `HealthGauge`: health factor with the same interpretation as before (null is pending, above 1e15 is no debt, otherwise 1e6 scaled); 1.0 is marked as the liquidation threshold.

## Pages

- Home: hero one-liner, live group cards (`GroupCards`: `listGroups` then `getMarketConfig` + `readMarket(..., null)` per group, loaded in parallel with per-card skeletons; one failing group does not hide the others), feature trio, partner strip.
- Groups: same cards with search.
- Group: header with badges and owner address, "Your position" card, markets table (supply and borrow APR, reward emissions, utilization, supply and borrow cap bars, collateral factor, yield route chip with the liquid buffer tooltip, price status), manage side panel with Supply / Withdraw / Borrow / Repay tabs, a visible two-step "Enable market then act" list, the rate curve and price/yield details; rewards card with runway; Leverage tab with the payoff chart, a leverage selector that shows the effective maximum (group limit, collateral factor bound, 2x note for pool-priced tokens), fee and slippage summary, position cards with health gauge and liquidation price.
- Launch: five stages exactly as before (Group, Markets, Leverage, Rewards, Review). Yield and price are visible numbered sub-steps inside each market editor rather than separate stages, because the transaction ordering and the Continue flow are unchanged. The review shows every transaction with what it does and its status (waiting, simulating, waiting for signature, confirming, confirmed) with explorer links.
- Control Panel: staged changes with a countdown ring and Apply button, leverage synchronization, per-market sections (risk and caps, interest rate with the curve, kept liquid, price source, reward emissions, pause and margin with the estimated effective leverage), add-market stepper, rewards with runway, group leverage, ownership, event history.

## Deliberately not touched

- Any hook, handler, validation, guardrail, transaction ordering or copy that states a risk. Components keep their state and effects verbatim; only JSX and classNames changed.
- Accessible names and texts used by `app/tests/e2e/mock-flows.spec.ts` (button names, labels, status strings), which also stay unique on the page.
- framer-motion is not used on the dashboard, wizard or control panel paths (the e2e suite installs fake timers); CSS transitions only.
- `app/playwright.config.ts` still targets port 3020. During this work another dev server occupied that port, so the suite was run with an identical config on port 3077 from a scratch directory; the config in the repo is unchanged.
