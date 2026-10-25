# Milestones

## Intake goals (verbatim, submitted before the event)

> "Building a new vault smart contract framework which helps with LP Trading and generating yield for users with the benefit of not having impermanent loss. in addition to that a framework which lets users deploy their own lending & borrowing markets no matter how new the project is"

Below, each intake goal is split into measurable milestones. Status: Done / Partial / Not started. Every Done links to a commit, contract ID or mainnet tx.

Statuses track verified delivery in this HackMeridian repository. Prior work alone does not establish completion. Loss cover is limited to the reserve balance.

### Goal 1: Vault framework for LP yield without impermanent loss

| # | Milestone | Status | Proof |
|---|---|---|---|
| 1.1 | One vault interface that any yield venue plugs into (Aquarius LP, DeFindex, Blend, Zenex, XOXNO) | Partial | Canonical interface, live Blend adapter and direct DeFindex route; [mainnet evidence](DEMO-MAINNET.md). Remaining venue adapters pending. |
| 1.2 | Aquarius LP vault earning trading fees and AQUA rewards for depositors | Not started | Pending: vault ID, deposit and harvest txs |
| 1.3 | Impermanent-loss cover: a capped loss reserve funded from fees and AQUA that tops up withdrawals when the LP position is below principal. Cover is limited to the reserve balance | Not started | Pending: reserve contract, test showing principal returned with a funded reserve |
| 1.4 | Keeper that keeps liquidity in range and auto-sells AQUA rewards | Not started | Pending: keeper code, rebalance and harvest txs |
| 1.5 | Vaults attachable per market, so lending deposits earn LP or partner yield | Partial | DeFindex and Blend attach/supply/withdraw verified on mainnet; [transaction evidence](DEMO-MAINNET.md). Frontend acceptance and LP venue pending. |

### Goal 2: Anyone can deploy their own lending and borrowing markets, however new the project

| # | Milestone | Status | Proof |
|---|---|---|---|
| 2.1 | Market factory: anyone launches an isolated market group with any SEP-41 token | Partial | Factory and Meridian creation live; [create_group tx](https://stellar.expert/explorer/public/tx/adec8eb4fdf444782f7d1591dcd6ac9792f330eb8e66e52f351a599ebbb800ac). Fresh-wallet wizard acceptance pending. |
| 2.2 | Per-market configuration: rate curve (including 0% borrow), collateral factor, caps, liquid buffer, yield route | Partial | USDC/XLM caps, collateral, buffers and zero-rate XLM configured on mainnet; [evidence](DEMO-MAINNET.md). Owner UI changes pending. |
| 2.3 | Pricing for new tokens without a CEX listing: Reflector Stellar-assets feed, bounded by Aquarius pool quotes | Partial | Trusted Reflector asset discovery and Aquarius guards implemented; pool-priced graduation verified on testnet in [DEMO-TESTNET.md](DEMO-TESTNET.md). Mainnet bounded-quote frontend evidence pending. |
| 2.4 | Optional leveraged margin per group | Partial | Group 1 margin enabled; [enable_margin tx](https://stellar.expert/explorer/public/tx/c9f0cf44d7d1f13a26bbfc8d0beeab639ab4f5c1e235a575c9312593a5125ea2). App open/close and running liquidator pending. |
| 2.5 | Owner Control Panel: add markets later and change parameters inside guardrails | Partial | Control Panel and staged changes implemented; adding markets after rewards currently blocked by pinned core. |
| 2.6 | Live on Stellar mainnet with the frontend connected | Partial | Mainnet contracts deployed and three groups render in the browser. [Hosted mainnet beta](https://peridot-markets-preview-8ipc1f9u1-peridot3.vercel.app) is connected; fresh-wallet transaction evidence pending. See [DEMO.md](DEMO.md) |

## Added during the event (beyond intake)

| # | Milestone | Status | Proof |
|---|---|---|---|
| A1 | Own reward token per group with per-market emissions | Partial | Group 2 distributor funded and a real claim paid; [claim tx](https://stellar.expert/explorer/public/tx/b492b6e91ee347d46e2b92ad7b73c4eea127b98776e154f2ea76c18cb960f77b). Fresh-wallet claim pending. |
| A2 | Hosted keeper (DigitalOcean subscription) or self-hosted | Partial | Self-hosted liquidation and refresh workers implemented; hosted subscription and live service pending. |
| A3 | Custom margin with per-asset leverage and trading fees | Not started | Pending |
| A4 | Token launchpad (bonding curve, ICO) that graduates tokens into an Aquarius pool and their own market group | Partial | Lead A verified curve buy/sell, Aquarius graduation and creator-owned lending group on testnet: [transaction evidence](DEMO-TESTNET.md). Launchpad frontend and mainnet launch remain pending. |
