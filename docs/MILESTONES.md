# Milestones

## Intake goals (verbatim, submitted before the event)

> "Building a new vault smart contract framework which helps with LP Trading and generating yield for users with the benefit of not having impermanent loss. in addition to that a framework which lets users deploy their own lending & borrowing markets no matter how new the project is"

Below, each intake goal is split into measurable milestones. Status: Done / Partial / Not started. Every Done links to a commit, contract ID or mainnet tx.

Statuses track verified delivery in this HackMeridian repository. Prior work alone does not establish completion. Loss cover is limited to the reserve balance.

### Goal 1: Vault framework for LP yield without impermanent loss

| # | Milestone | Status | Proof |
|---|---|---|---|
| 1.1 | One vault interface that any yield venue plugs into (Aquarius LP, DeFindex, Blend, Zenex, XOXNO) | Partial | Canonical interface and Blend adapter implemented; remaining adapters and live evidence pending. |
| 1.2 | Aquarius LP vault earning trading fees and AQUA rewards for depositors | Not started | Pending: vault ID, deposit and harvest txs |
| 1.3 | Impermanent-loss cover: a capped loss reserve funded from fees and AQUA that tops up withdrawals when the LP position is below principal. Cover is limited to the reserve balance | Not started | Pending: reserve contract, test showing principal returned with a funded reserve |
| 1.4 | Keeper that keeps liquidity in range and auto-sells AQUA rewards | Not started | Pending: keeper code, rebalance and harvest txs |
| 1.5 | Vaults attachable per market, so lending deposits earn LP or partner yield | Partial | Factory attachment and frontend transaction flow implemented; live attachment evidence pending. |

### Goal 2: Anyone can deploy their own lending and borrowing markets, however new the project

| # | Milestone | Status | Proof |
|---|---|---|---|
| 2.1 | Market factory: anyone launches an isolated market group with any SEP-41 token | Partial | Factory and launch flow implemented; mainnet factory and creation transaction pending. |
| 2.2 | Per-market configuration: rate curve (including 0% borrow), collateral factor, caps, liquid buffer, yield route | Partial | Configuration forms and guardrail tests implemented; live configuration evidence pending. |
| 2.3 | Pricing for new tokens without a CEX listing: Reflector Stellar-assets feed, bounded by Aquarius pool quotes | Partial | Trusted Reflector asset discovery implemented; Aquarius price guards and live evidence pending. |
| 2.4 | Optional leveraged margin per group | Partial | Staged V3 margin UI and liquidator implemented; live position evidence pending. |
| 2.5 | Owner Control Panel: add markets later and change parameters inside guardrails | Partial | Control Panel and staged changes implemented; adding markets after rewards currently blocked by pinned core. |
| 2.6 | Live on Stellar mainnet with the frontend connected | Partial | Frontend demo deployed; mainnet contracts, connected live flows and fresh-wallet evidence pending. See [DEMO.md](DEMO.md) |

## Added during the event (beyond intake)

| # | Milestone | Status | Proof |
|---|---|---|---|
| A1 | Own reward token per group with per-market emissions | Partial | Funded rewards flow implemented; live claim evidence pending. |
| A2 | Hosted keeper (DigitalOcean subscription) or self-hosted | Partial | Self-hosted liquidation and refresh workers implemented; hosted subscription and live service pending. |
| A3 | Custom margin with per-asset leverage and trading fees | Not started | Pending |
| A4 | Token launchpad (bonding curve, ICO) that graduates tokens into an Aquarius pool and their own market group | Not started | Added in [launchpad handoff](handoff/12-LAUNCHPAD.md); begins only after phase 1 is tagged on mainnet |
