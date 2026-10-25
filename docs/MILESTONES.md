# Milestones

## Intake goals (verbatim, submitted before the event)

> "Building a new vault smart contract framework which helps with LP Trading and generating yield for users with the benefit of not having impermanent loss. in addition to that a framework which lets users deploy their own lending & borrowing markets no matter how new the project is"

Below, each intake goal is split into measurable milestones. Status: Done / Partial / Not started. Every Done links to a commit, contract ID or mainnet tx.

Statuses track verified delivery in this HackMeridian repository. Prior work alone does not establish completion. Loss cover is limited to the reserve balance.

### Goal 1: Vault framework for LP yield without impermanent loss

| # | Milestone | Status | Proof |
|---|---|---|---|
| 1.1 | One vault interface that any yield venue plugs into (Aquarius LP, DeFindex, Blend, Zenex, XOXNO) | Not started | Pending: interface crate, adapters |
| 1.2 | Aquarius LP vault earning trading fees and AQUA rewards for depositors | Not started | Pending: vault ID, deposit and harvest txs |
| 1.3 | Impermanent-loss cover: a capped loss reserve funded from fees and AQUA that tops up withdrawals when the LP position is below principal. Cover is limited to the reserve balance | Not started | Pending: reserve contract, test showing principal returned with a funded reserve |
| 1.4 | Keeper that keeps liquidity in range and auto-sells AQUA rewards | Not started | Pending: keeper code, rebalance and harvest txs |
| 1.5 | Vaults attachable per market, so lending deposits earn LP or partner yield | Not started | Pending: attach_yield txs |

### Goal 2: Anyone can deploy their own lending and borrowing markets, however new the project

| # | Milestone | Status | Proof |
|---|---|---|---|
| 2.1 | Market factory: anyone launches an isolated market group with any SEP-41 token | Not started | Pending: factory ID, create_group tx |
| 2.2 | Per-market configuration: rate curve (including 0% borrow), collateral factor, caps, liquid buffer, yield route | Not started | Pending: add_market txs |
| 2.3 | Pricing for new tokens without a CEX listing: Reflector Stellar-assets feed, bounded by Aquarius pool quotes | Not started | Pending: price router config, check() output |
| 2.4 | Optional leveraged margin per group | Not started | Pending: enable_margin tx, open position tx |
| 2.5 | Owner Control Panel: add markets later and change parameters inside guardrails | Not started | Pending: update txs, event history |
| 2.6 | Live on Stellar mainnet with the frontend connected | Not started | Pending: live URL, deployments/mainnet.json |

## Added during the event (beyond intake)

| # | Milestone | Status | Proof |
|---|---|---|---|
| A1 | Own reward token per group with per-market emissions | Not started | Pending |
| A2 | Hosted keeper (DigitalOcean subscription) or self-hosted | Not started | Pending |
| A3 | Custom margin with per-asset leverage and trading fees | Not started | Pending |
