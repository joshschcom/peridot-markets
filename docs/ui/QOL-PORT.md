# Quality-of-life port from the older Peridot EVM app

Branch `qol-port` (based on `main` 537ca0a). Four small pieces were adapted from the older Peridot frontend, PeridotFinance/PeridotV2Full at the pinned commit `86ae3795f3ca011bef156f2d9ed8fe900410dc11` (`frontend/defi-platform`). That code is prior work (see `docs/PRIOR_WORK.md`). Nothing was pasted: the EVM, Privy, wagmi, Biconomy, react-query and framer-motion dependencies were dropped, the logic was rewritten for Stellar and the group controller, and every surface was restyled with the design tokens in `app/src/app/globals.css`. All new CSS lives in `app/src/components/ui/qol.css` so parallel branches do not touch `globals.css`.

No new npm dependencies. Dark and light themes, 375 px without horizontal scroll, no em dashes, no emojis.

## What was adapted from where

| Piece | Old file (86ae3795) | New files | Kept | Dropped or changed |
|---|---|---|---|---|
| Risk disclaimer | `components/RiskDisclaimerModal.tsx` | `components/ui/RiskDisclaimer.tsx`, `lib/ui/risk-disclaimer.ts` (+ test) | Modal with a checkbox gate and a localStorage flag | Wallet-connected gate (now shown on first visit), click-outside and Escape dismissal (acceptance is the only way out), shadcn Card/Checkbox/Button, Tailwind gradients. Added: focus trap, body scroll lock, version string that re-shows the text when it changes, pre-accept script for tests. Text rewritten for Peridot Markets on Stellar. The old text had no jurisdiction clause, so there is one checkbox only. |
| Error boundary | `components/ErrorBoundary.tsx` | `components/ui/ErrorBoundary.tsx` (`ErrorBoundary`, `ErrorCard`, `PageErrorBoundary`), `app/error.tsx`, `app/not-found.tsx`, `components/groups/GroupGuard.tsx` | Class boundary with `getDerivedStateFromError` | The console groups with user agent, viewport and stacks (nothing is reported or logged in production), the bare "Refresh Page" fallback. Added: card with Try again, Reload, Home and collapsed technical details (message and digest only), remount on route change, Next route error and not-found pages, a clean "Group not found" state for unknown group ids. |
| Transaction toasts | `components/steallar/TxToast.tsx` | `lib/ui-events.ts`, `components/ui/Toast.tsx` (`ToastProvider`, `useToast`), `lib/ui/humanize-tx-error.ts` (+ test) | Toast fed by an app-wide event stream, success and error beats, collapsed details | `window` CustomEvents (now a typed in-memory bus), framer-motion, the owl mascot, the "Add money" onramp button, terminal-only behaviour (every status is shown now). Error copy ideas from `lib/tx-errors.ts` and `lib/errorFormatter.ts` were rewritten for Soroban diagnostics, SAC codes, Peridot core panics, Wallets Kit rejections and `TransactionResult` XDR codes. |
| Recent transactions | `components/steallar/TransactionStrip.tsx` | `components/ui/RecentTransactions.tsx`, `lib/ui/recent-transactions.ts` (+ test) | A compact list of recent activity with status and time | Backend fetch, react-query, demo rows, points pills, "See all" pagination. Now the last 10 hashes per network from localStorage with explorer links and a Clear button, in a header popover. |
| Account health | `hooks/use-borrowing-power.ts`, `hooks/use-borrow-balance.ts` | `lib/health/account-health.ts` (+ test), `components/groups/AccountHealth.tsx` | Collateral, debt, available borrowing power, utilization and a three-step risk tier | wagmi multicalls, per-asset config prices, Comptroller `getAccountLiquidity` with the EVM error tuple. The Stellar group controller is authoritative: `account_liquidity(user)` and `get_price_usd(token)` read through the existing `readContract`. |

## Wiring (exact edits to shared files)

- `app/src/lib/peridot/rpc.ts` (Lead B's file, one hunk): import `emitTx, nextTxId` from `../ui-events`; in `submitContract` two lines create `txId` and wrap `input.onProgress` so every `TxProgress` is also sent to `emitTx({ id, method, contractId, ...progress })`, then `submitContractLocked` is called with that wrapper. The caller's callback and the transaction path are unchanged. `ui-events.ts` has no imports, so there is no cycle into `lib/peridot`.
- `app/src/app/layout.tsx`: `<WalletProvider><ToastProvider><AppShell><PageErrorBoundary>{children}</PageErrorBoundary></AppShell><RiskDisclaimer /></ToastProvider></WalletProvider>` plus three imports.
- `app/src/components/ui/AppShell.tsx`: one import and `<RecentTransactions />` on the line after `<ThemeToggle />`.
- `app/src/components/groups/GroupDashboard.tsx`: one import and `<AccountHealth group={group} markets={markets}/>` inside the "Your position" card, before the existing "Health:" paragraph.
- `app/src/app/groups/[id]/page.tsx`: the dashboard is wrapped in `<GroupGuard id={id}>`.
- `app/package.json`: the unit test glob gained `src/lib/ui/*.test.ts src/lib/health/*.test.ts`.
- `app/tests/e2e/mock-flows.spec.ts`: setup only, a `test.beforeEach` that pre-accepts the disclaimer with `page.addInitScript(disclaimerPreAcceptScript)`. Assertions are untouched.

## Behaviour notes

- Toasts: bottom-right stack on desktop, top of the viewport under 760 px, `aria-live="polite"`, at most five, one toast per transaction id that follows checking, waiting for your signature, submitting, confirming, confirmed (auto-dismiss after 6 s, explorer link), failed (persistent, humanized sentence, raw error collapsed under "Technical details") and confirmation unavailable (persistent, warn).
- `humanizeTxError(raw)` maps supply and borrow caps, paused markets, the stale boosted-health cache ("refresh the market first"), `exceeded_limit` footprint timing ("try again in a few seconds"), missing trustlines, SAC balance errors, insufficient collateral, market liquidity, wallet rejections, blocked pop-ups, expiry, RPC rate limits, archived entries, stale prices and `Transaction rejected: <xdr>` result codes (`txTooLate`, `txInsufficientBalance`, `txBadSeq`, `txSorobanInvalid`, ...). Anything else passes through unchanged. Mapping `Error(Contract, #N)` factory codes to text still needs the originating contract id and stays with Lead B (QA finding 6).
- Demo mode (`NEXT_PUBLIC_USE_MOCKS=true`) never reaches `submitContract`, so toasts and the recent list do not fire in the e2e suite or in the demo. In development builds `window.__peridotEmitTx(event)` drives the provider from a console or script for QA.
- Account health: USD figures from the controller carry the token decimals (`usd = units * price / scale`), so dollars are `value / 10^decimals`; the component uses the decimals shared by the held markets and notes when they differ. `(0, u128::MAX)` from `account_liquidity` is the controller's "indeterminate" sentinel and renders as "Unavailable", never as a shortfall. States: No position, Safe (under 75% of the borrow limit), Watch (75% and above), At risk (shortfall, liquidatable). In demo mode values are computed from the mock market views with 1 USD per token and no RPC read.
- Group not found: `GroupGuard` renders the dashboard at once and checks `getGroup` in parallel; both calls hit `readContractRaw` in the same tick and coalesce into one RPC request. Invalid ids, the mock "Group not found." and `Error(Contract, #4)` naming the factory contract switch to the clean state. `.panel.empty-state p` now wraps long raw errors (the 375 px overflow from QA).
- Error boundary: `PageErrorBoundary` is keyed on the pathname, so a crash on one route does not follow the user to the next. Nothing is sent anywhere; in development the error is logged to the console only.

## localStorage keys

| Key | Value | Used by |
|---|---|---|
| `peridot:risk-ack` | disclaimer version string, currently `2026-10-26` | `RiskDisclaimer`; tests pre-accept it with `disclaimerPreAcceptScript` from `lib/ui/risk-disclaimer.ts` |
| `peridot:recent-tx:<network>` | JSON array of up to 10 `{hash, status, at, method, contractId}` | `ToastProvider`, `RecentTransactions` |

Existing keys are untouched (`peridot:theme`, `peridot:pending:<network>:<address>`, `peridot:group-portfolio:v1`).

## Merging with other branches

- `launchpad-ui` adds `app/tests/e2e/launchpad-flows.spec.ts` and also edits the test glob in `app/package.json` and `AppShell.tsx` (nav entry). After merging, add the same two-line setup to the launchpad spec, otherwise the disclaimer overlay blocks its clicks:
  `import {disclaimerPreAcceptScript} from '../../src/lib/ui/risk-disclaimer';`
  `test.beforeEach(async({page})=>{await page.addInitScript(disclaimerPreAcceptScript);});`
- `qa-wallet` edits `rpc.ts` (429 retry) and four buttons in `GroupDashboard.tsx`; this branch touches `rpc.ts` only in the import block (line 4) and `submitContract` (lines 119 to 121), and `GroupDashboard.tsx` in one import (line 20) and one JSX line (line 115). `AppShell.tsx`: import on line 10, `<RecentTransactions />` on line 44.
- A dev server started with a new `NEXT_DIST_DIR` rewrites `app/tsconfig.json` (`include` gains `<distDir>/types/**/*.ts`); revert that file before committing, as the repo already does for `.next-e2e`.

## How to test

```
cd app && npm ci
npm run typecheck && npm test && npm run build
npm run test:e2e        # starts its own mock server on 3020 unless one is running
```

For a manual look at the toasts without a wallet, run `NEXT_DIST_DIR=.next-dev NEXT_PUBLIC_USE_MOCKS=true npm run dev`, open a group page and in the console run
`__peridotEmitTx({id:'x', status:'error', method:'supply', message:'Simulation failed: HostError ... "supply cap exceeded"'})`.

Screenshots: `docs/ui/qol-disclaimer-dark.png`, `qol-disclaimer-light.png`, `qol-disclaimer-mobile.png`, `qol-toasts-dark.png`, `qol-toasts-light.png`, `qol-toasts-mobile.png`, `qol-recent-tx.png`, `qol-recent-tx-mobile.png`, `qol-health-dark.png`, `qol-health-light.png`, `qol-health-mobile.png`, `qol-group-not-found.png`, `qol-group-not-found-mobile.png`, `qol-not-found.png`.
