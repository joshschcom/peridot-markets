# Fable: trustline and transaction feedback follow-up

Requested by Joshua after testing the merged mainnet preview. Base main: a3d0b85. Pull latest main before branching; do not reuse the old ui-redesign tree without merging the wallet fixes.

## Ownership

Fable: components/ui, groups, launch and control presentation; app CSS. Lead B: app/src/lib/peridot, wallet signing, transport, trustline preparation, tests and integration. Post acknowledgement and branch name in COORDINATION.md before changing shared files. No contracts, core, deployments, root scripts, secrets or em dashes.

## Required UI changes

1. Each missing-trustline notice gets an **Add USDC trustline** action (generic token symbol). Wire to Lead B's verified classic-asset preparation/submission API, not a symbol-to-issuer guess. Show code, issuer, network, additional reserve and fee before the wallet prompt. Explain that the reserve is held by the network, not a protocol fee. After a confirmed transaction, refresh and remove the notice. Keep XLM actions usable. Enabling a lending market and creating an asset trustline are different steps.
2. Show a persistent transaction panel next to the action and visible on mobile: preparing, awaiting wallet, signature received, submitting, waiting for ledger, confirmed/failed/unresolved. Include elapsed time and a transaction explorer link as soon as a hash exists. Do not show success on signing or submission alone.
3. Keep confirmed receipts visible after balances refresh. Show a clear next action: after enter_market, Supply XLM; after supply, review leverage. Do not lose error or success state while optional price/yield reads refresh.
4. Recovery needs a visible **Check transaction status** action. A resolved prior attempt must show its hash and whether it failed on chain or expired unseen. Never encourage another submission while outcome is unresolved. A resolved attempt should offer **Refresh and review again**. A fresh click must still be required to sign.
5. Keep technical warnings separate: USDC trustline notice is asset-specific and must not look like an XLM transaction failure. Put the notice beside that asset's Manage panel as well as any summary.

## Focused QoL review

Check loading/retry states, disabled-button explanations, fee headroom for native XLM Max, persistent wallet/network context, duplicate-click protection, mobile visibility, copy/hash buttons, accessibility announcements, multi-step margin progress and failure recovery. Choose supplied XLM as the default margin asset when appropriate; never silently change an already reviewed trade. Review input changes during async quoting so a late quote cannot appear attached to new inputs. No automatic signatures, spending, pool/contract changes or extra token approvals.

## Current evidence and acceptance

Preview: https://peridot-markets-preview-8ipc1f9u1-peridot3.vercel.app
User says Albedo closes and app waits, then displays “The previous transaction failed. Refresh balances and review this action before trying again.” No app hash is visible. Public history for fresh GBTA…OOQD shows no new app transaction, including failed records. Do not claim this is an on-chain failure; Lead B is investigating the RPC/pending state.

Lead B is checking public RPC providers against Stellar docs and implementing verified trustline preparation. Existing main has explicit Safari signing clicks, 71 unit tests, 3 mock e2e flows, WebKit no-signature checks, locks and pending journals. Preserve them. Before merge run typecheck/build/e2e, verify failed/unknown/confirmed states and the trustline action, then send a narrow diff and brief report. Actual wallet acceptance remains pending.
