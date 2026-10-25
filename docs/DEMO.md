# Demo and verification evidence

Phase 1 contracts are deployed on mainnet. Lead A recorded real deployment, DeFindex/Blend supply and withdrawal, margin enablement, and funded reward-claim transactions in [DEMO-MAINNET.md](DEMO-MAINNET.md). Fresh Albedo frontend acceptance, app margin open/close and running liquidator coverage remain pending. Existing Peridot deployments and mock interactions do not substitute for these gates.

## Phase 1 acceptance

| Flow | Expected evidence | Status |
|---|---|---|
| Create Meridian group | Mainnet create_group hash and group ID | Deployer verified: [group 1 creation](https://stellar.expert/explorer/public/tx/adec8eb4fdf444782f7d1591dcd6ac9792f330eb8e66e52f351a599ebbb800ac); fresh-wallet wizard pending |
| USDC market; DeFindex and Blend yield routes | Add-market and route-attachment hashes | USDC live without a route in group 1; XLM DeFindex in group 1 and XLM Blend in group 3 verified by deployer. [Evidence](DEMO-MAINNET.md) |
| XLM market, 0% borrow rate | Add-market hash and live rate read | Deployer configuration recorded; [XLM market](https://stellar.expert/explorer/public/tx/69e7e64b2d2c33753d14cff5fae29dd5a2a4cabaf093750a7d00f899bc1f8f59); frontend reads verified |
| Configure and fund rewards | Distributor, funding and speed hashes | Group 2 deployer verified; [funding](https://stellar.expert/explorer/public/tx/95d2fd444f7639fde3ca938cf1cce86b57dd413031bd19a2629bad8162e7778d); fresh-wallet setup pending |
| Supply and enable collateral | Supply and enter_market hashes | Deployer verified for XLM; [evidence](DEMO-MAINNET.md); fresh-wallet frontend pending |
| Borrow and repay | Confirmed hashes and balances | Pending |
| Withdraw | Confirmed receipt-share withdrawal hash | Deployer verified for DeFindex and Blend routes; [evidence](DEMO-MAINNET.md); fresh-wallet frontend pending |
| Claim rewards | Confirmed claim and reward balance change | Deployer verified: [group 2 claim](https://stellar.expert/explorer/public/tx/b492b6e91ee347d46e2b92ad7b73c4eea127b98776e154f2ea76c18cb960f77b); fresh-wallet frontend pending |
| Enable margin and open 2x position | Factory hash and every V3 stage hash | [Margin enabled](https://stellar.expert/explorer/public/tx/c9f0cf44d7d1f13a26bbfc8d0beeab639ab4f5c1e235a575c9312593a5125ea2); 2x open pending |
| Close margin position | Every close stage hash and settled position | Pending |
| Control Panel edits | Buffer, cap and rate update hashes | Pending |
| Staged collateral-factor change | Proposal, chain ETA and apply hash | Pending |
| Reject 90% collateral factor | UI and contract rejection evidence | Pending |
| Add a third market after launch | Add-market hash and updated group | Pending |
| Liquidator coverage | Running service status and configuration evidence | Pending |
| Fresh Albedo account | Network, date and completed-flow checklist | Pending |
| Read-only Claude review | Findings and resolution in COORDINATION.md | Completed for frontend/keeper fixes and Wallets Kit; keeper fee funding and signed acceptance remain pending |
| Vercel deployment | Live URL and deployed commit | [Connected mainnet beta](https://peridot-markets-preview-eg1grm094-peridot3.vercel.app), source `20099c2`, authenticated preview |

Group 1 Meridian has no rewards and must remain available for the add-market-after-launch demonstration. Group 2 Rewards holds the funded distributor; group 3 BlendDemo demonstrates Blend. The local phase-1 contract tag reported by Lead A does not mean the frontend acceptance table is complete.

Record each transaction with its network, contract, action, amount, confirmation result and stellar.expert link. Never record a private key or signed envelope here.

## Video route

1. Landing: explain isolated markets and routed yield.
2. Prior work: show imported core and frontend attribution.
3. Launch: show per-market deployment, activation and route attachment; configure leverage, then enable rewards last with the market-list lock disclosure.
4. Group: enter markets before reward-bearing supply or borrowing. Show Meridian yield and margin, Rewards claim, and BlendDemo route. Open at least two confirmed mainnet transaction links; show the 2x flow only once its app evidence exists.
5. Control Panel: add a market in Meridian before rewards; change buffer and rates, then show reward speed in Rewards. Show 90% CF rejection, the staged countdown, apply plus sync_pairs and event history.
6. Architecture: explain the vault, oracle and reward integration seams.
7. Roadmap: audits of new contracts, multisig administration, partner groups and SCF.

## Later phases

Phase 2 requires mainnet Aquarius deposit and harvest evidence plus a funded-reserve withdrawal test. Phases 3 and 4 are recorded only after their preceding phases are complete and tagged.

## Development checks, 25 October

Frontend implementation: `390cf93`, interface/recovery `4f92a41`, launch `f80d4ca`, group entry `e8a028d`, Control `a7c7879`. Worker implementation: `3e182cb`, mainnet dry-run and review fixes `a73cab9`. Mainnet frontend integration: `543c96c`.

These development checks use explicit mocks or read-only calls. Read-only mainnet rendering is connection evidence but does not establish signed frontend flows or fresh Albedo acceptance.

- Production frontend build passes with mainnet default and mocks disabled.
- Frontend: 64 integrated unit tests pass, including binary pool IDs, debt accrual bounds, transaction expiry proof, staged proposal replacement, owner checks and market-addition recovery.
- Chromium: three end-to-end tests pass. Launch, lending, rewards, margin, staged Control changes, interrupted deploy/activate recovery, and five routes at 375px width are covered.
- Keeper: 71 tests pass including an isolated real PostgreSQL database, durable submission intents, competing workers, restart and fee limits. Runtime dependency audit reports zero vulnerabilities.
- Testnet factory `CCFODI4F6QE276PXGHVYOSX52DMYYI2YDJMQZ7ZGU4YWEH5IG2Y3ZR3M`: read-only `group_count` returned 0 and `get_wasm` returned registered hashes at ledger 5382714. No transaction was submitted. Lead A reports that group creation is blocked by testnet rent; see the coordination board.
- Read-only browser checks render all three live groups. [Mainnet read-only screenshot](assets/mainnet-readonly.png) shows submissions disabled.
- The read-only wallet preflight passed against the public deployer account at ledger 65132405. It reported account existence, an absent USDC trustline and zero market liquidity, and kept `freshAccountClaimVerified` and `acceptanceComplete` false. This validates the checker, not a fresh wallet. Help and invalid-input handling and TypeScript checks also pass.
- Fresh-wallet transaction and live worker gates remain pending. The current core also prevents adding markets once rewards have been enabled, so the demo must disclose that restriction.

## Labelled mock screenshots

[Landing](assets/home-demo.png) · [Mobile landing](assets/home-mobile-demo.png) · [Launch](assets/launch-demo.png) · [Group](assets/group-demo.png) · [Control Panel](assets/control-demo.png)

These screenshots display the demo banner. The separate [mainnet read-only screenshot](assets/mainnet-readonly.png) uses the live manifest and explicitly disables submissions.

## Vercel preview

[Open the labelled demo](https://peridot-markets-preview-q1q53sbiz-peridot3.vercel.app). Private-account project: `peridot3/peridot-markets-preview`. Deployment `dpl_3v5F1k9nmcreTe2YqxSv2Bs37VYN` is READY in the preview environment, with Vercel authentication enabled. The deployed frontend source is `4f92a41`. Mock mode disables wallet signing and movements of real funds.

Authenticated HTTP verification returned the application HTML and demo banner. This preview is not the mainnet release. The first CLI attempt using deprecated `--target preview` was classified as production and rejected by the app's mock-production guard; retrying with `--environment preview` succeeded. No production demo was published.

The acceptance wallet is Albedo. Albedo is the default in Stellar Wallets Kit; Freighter is also supported and can be selected explicitly. Its extension is not required for the Albedo acceptance run.

## Fresh Albedo acceptance runbook

Run this only after the deployment manifest is verified, the required read-only review is complete, and the account funding and spending budget are approved. Use a new Albedo account and a fresh browser profile. Never copy its recovery phrase or secret into this repository or the evidence record.

Before signing, run the read-only public-account preflight from `app/`:

```sh
NEXT_PUBLIC_MAINNET_RPC_URL=https://mainnet.sorobanrpc.com \
  node --import tsx scripts/fresh-wallet-check.ts --account G...
```

Use only the fresh public address. The report checks account existence, total XLM balance, asset trustline gaps, entered markets, receipt balances, debt, liquidity and rewards across groups 1 to 3. Total XLM is not a spendable-fee budget. Exit 0 means reads completed, exit 2 means the account is not created on mainnet, and exit 1 means invalid input or a read failed. The script does not prove the account is fresh, request signatures, submit transactions or mark acceptance complete.

1. Record the public account address, network, app deployment and factory IDs. Confirm the app shows live data, the wallet network matches, and demo mode is off. Verify a deliberate wrong-network selection prevents signing.
2. Authorize any required classic-asset trustline transactions with Albedo and fund only the approved amounts. Record funding separately from protocol transactions.
3. Create a new group through the wizard. Record every confirmed hash for group creation, each market deployment, activation and route attachment, and pool permission/binding. Reject one signature and verify resume does not repeat already confirmed steps.
4. Enter both the collateral and borrowed markets first, including before supply in a reward-bearing group. Supply, borrow, partially repay, repay all, partially withdraw and withdraw all. Compare underlying balances, receipt shares and remaining debt after each action. An amount larger than the available balance must fail simulation without a signature.
5. Configure rewards only after all intended markets are active. Fund the distributor, set speeds, accrue and claim. Verify a later market addition is blocked by the current core limitation. Test third-market addition on a separate group before rewards are enabled.
6. Open a 2x margin position, reload after a confirmed stage, resume, close and return free margin to supply. Record each stage hash. Verify unknown confirmations block duplicate submissions and optional residual repayments always require explicit wallet approval.
7. In Control Panel, change immediate buffer, cap and rate settings. Reject 90% collateral. Stage a valid CF change, verify the full 60-second wait and reviewed companion price changes, then confirm the separate leverage synchronization. Reject the synchronization signature once and recover using Sync leverage limits without repeating market application. Repeat with a price-only proposal to verify synchronization still follows apply_pending for a margin group.
8. Check wrong-owner controls, permissionless leverage synchronization, funded rewards and available exits. Record actual liquidator service status, accrual/boosted-refresh cadence and required liquidation evidence. A simulation-only worker does not satisfy coverage.
9. Attach transaction links, before/after balances, failures and resolutions to the phase table. Publish a phase tag only when every required live gate has evidence. The current local and preview tests do not satisfy this runbook.

## Mainnet margin and keeper preflight

Read-only group 1 preflight verified controller identity, pool permission and binding, both markets enabled at an effective maximum of 3x, and four configured 2x directions. Both markets had zero borrowing liquidity and no positions. The approved tiny open/close requires a supply deposit first; no B transaction evidence exists yet.

Keeper dry run verified deployed pins and simulated interest and boosted-balance refreshes. Its scheduled-fee estimate with planning headroom was 79,672,817 stroops per day, exceeding the configured 10,000,000 stroops. Live startup rejects this configuration; no spending limit was increased. The service is not running live. See [measured dry run](../keeper/liquidator/margin/mainnet-group1-dry-run.json). Latest keeper tests: 79 passed, one PostgreSQL integration test skipped; prior database integration validation remains separately recorded.

## Wallet integration verification

Wallets Kit 2.7.1 integration is committed as `20099c2`. Albedo is selected by default and Freighter is available. Initialization opens no wallet popup. Explicit connection opens Albedo; returned Soroban envelopes are checked against the expected source, transaction hash, network and account signature. Two signature regressions, type checking and the production build pass. Chromium verified the live mainnet page, wallet selection, Albedo popup and 375px layout without entering credentials or signing. [Wallet screenshot](assets/mainnet-wallets-mobile.png).

The dependency audit reports 29 findings in Wallets Kit's transitive dependency tree after compatible updates (12 low, 6 moderate, 11 high). Only Albedo and Freighter modules are configured; this is not a clean-audit claim. The prior zero-vulnerability result applied before Wallets Kit was added.

## Connected mainnet beta preview

[Open mainnet beta](https://peridot-markets-preview-eg1grm094-peridot3.vercel.app). Source `20099c2`, deployment `dpl_Hur1ciLxFErhC5QbnquhBUxACZng`, private project `peridot3/peridot-markets-preview`. Vercel reports READY and preview target; authentication protection remains enabled. Mainnet is selected, mocks and read-only mode are off, public RPC is configured. Authenticated HTTP verification found the beta banner and both wallet choices, with neither mock nor read-only banner. Wallet signatures are required for real transactions.

This proves deployment and network configuration, not fresh-wallet acceptance or a successful margin trade. The fresh Albedo public address and user-approved signatures are still pending. No [B] READY: app on mainnet marker has been posted.
