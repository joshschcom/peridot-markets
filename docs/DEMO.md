# Demo and verification evidence

No HackMeridian mainnet deployment or transaction evidence has been recorded yet. Existing Peridot deployments and mock interactions do not count as new mainnet proof.

## Phase 1 acceptance

| Flow | Expected evidence | Status |
|---|---|---|
| Create Meridian group | Mainnet create_group hash and group ID | Pending |
| USDC market, 20% liquid, Blend or DeFindex | Add-market and route-attachment hashes | Pending |
| XLM market, 0% borrow rate | Add-market hash and live rate read | Pending |
| Configure and fund rewards | Distributor, funding and speed hashes | Pending |
| Supply and enable collateral | Supply and enter_market hashes | Pending |
| Borrow and repay | Confirmed hashes and balances | Pending |
| Withdraw | Confirmed receipt-share withdrawal hash | Pending |
| Claim rewards | Confirmed claim and reward balance change | Pending |
| Enable margin and open 2x position | Factory hash and every V3 stage hash | Pending |
| Close margin position | Every close stage hash and settled position | Pending |
| Control Panel edits | Buffer, cap and rate update hashes | Pending |
| Staged collateral-factor change | Proposal, chain ETA and apply hash | Pending |
| Reject 90% collateral factor | UI and contract rejection evidence | Pending |
| Add a third market after launch | Add-market hash and updated group | Pending |
| Liquidator coverage | Running service status and configuration evidence | Pending |
| Fresh Freighter account | Network, date and completed-flow checklist | Pending |
| Read-only Claude review | Findings and resolution in COORDINATION.md | Pending |
| Vercel deployment | Live URL and deployed commit | Pending |

Record each transaction with its network, contract, action, amount, confirmation result and stellar.expert link. Never record a private key or signed envelope here.

## Video route

1. Landing: explain isolated markets and routed yield.
2. Prior work: show imported core and frontend attribution.
3. Launch: USDC at 20% liquid, XLM at zero borrow rate, rewards and 3x group leverage.
4. Group: supply, show route state, claim and open 2x margin. Open at least two confirmed mainnet transaction links.
5. Control Panel: add a market, change buffer, rates and reward speed; show the 90% CF rejection and history.
6. Architecture: explain the vault, oracle and reward integration seams.
7. Roadmap: audits of new contracts, multisig administration, partner groups and SCF.

## Later phases

Phase 2 requires mainnet Aquarius deposit and harvest evidence plus a funded-reserve withdrawal test. Phases 3 and 4 are recorded only after their preceding phases are complete and tagged.

## Development checks, 25 October

Frontend implementation: `390cf93`, followed by interface and recovery updates in `4f92a41`. Worker implementation: `3e182cb`.

These checks use explicit mocks or read-only calls. They are not mainnet or fresh Freighter evidence.

- Production frontend build passes with mainnet default and mocks disabled.
- Frontend: 46 unit tests pass, including binary pool IDs, debt accrual bounds, transaction expiry proof, staged proposal replacement, owner checks and market-addition recovery.
- Chromium: three end-to-end tests pass. Launch, lending, rewards, margin, staged Control changes, interrupted deploy/activate recovery, and five routes at 375px width are covered.
- Keeper: 71 tests pass including an isolated real PostgreSQL database, durable submission intents, competing workers, restart and fee limits. Runtime dependency audit reports zero vulnerabilities.
- Testnet factory `CCFODI4F6QE276PXGHVYOSX52DMYYI2YDJMQZ7ZGU4YWEH5IG2Y3ZR3M`: read-only `group_count` returned 0 and `get_wasm` returned registered hashes at ledger 5382714. No transaction was submitted. Lead A reports that group creation is blocked by testnet rent; see the coordination board.
- Live and fresh-wallet gates remain pending. The current core also prevents adding markets once rewards have been enabled, so the demo must disclose that restriction.

## Labelled mock screenshots

[Landing](assets/home-demo.png) · [Mobile landing](assets/home-mobile-demo.png) · [Launch](assets/launch-demo.png) · [Group](assets/group-demo.png) · [Control Panel](assets/control-demo.png)

All screenshots display the demo banner. Replace or supplement them with live screenshots after the deployment gate is satisfied.

## Vercel preview

[Open the labelled demo](https://peridot-markets-preview-q1q53sbiz-peridot3.vercel.app). Private-account project: `peridot3/peridot-markets-preview`. Deployment `dpl_3v5F1k9nmcreTe2YqxSv2Bs37VYN` is READY in the preview environment, with Vercel authentication enabled. The deployed frontend source is `4f92a41`. Mock mode disables wallet signing and movements of real funds.

Authenticated HTTP verification returned the application HTML and demo banner. This preview is not the mainnet release. The first CLI attempt using deprecated `--target preview` was classified as production and rejected by the app's mock-production guard; retrying with `--environment preview` succeeded. No production demo was published.
