# Peridot Markets

Launch isolated lending markets on Stellar, configure each market, and route idle liquidity into supported yield venues.

**HackMeridian 2026: Scale + Stellar Composed.** The build is in progress. No new mainnet deployment or completed live-wallet test is claimed yet.

Demo preview: [Open Peridot Markets](https://peridot-markets-preview-q1q53sbiz-peridot3.vercel.app) (Vercel login required, simulated balances). Mainnet app: pending. Video: pending. Deck: pending.

[Architecture](docs/ARCHITECTURE.md) · [Specifications](docs/SPECS.md) · [Milestones vs intake](docs/MILESTONES.md) · [Demo evidence](docs/DEMO.md) · [Prior work](docs/PRIOR_WORK.md)

## Status

| Phase | Scope | Status | Mainnet evidence |
|---|---|---|---|
| 1 | Factory, launch wizard, lending, rewards, margin, owner controls, liquidator | In progress | Pending |
| 2 | Aquarius LP vault, capped loss reserve, self-hosted keeper | Not started | Pending |
| 3 | Price guards, custom margin, Zenex, bonding-curve launchpad and graduation | Not started | Pending |
| 4 | XOXNO, hosted keeper, yield switching, range management, ICO launchpad | Not started | Pending |

A phase is complete only after mainnet deployment, connected frontend, fresh Freighter-account verification, read-only second opinion, evidence and a phase tag. Mock interactions are development tests, not mainnet evidence.

## Problem and solution

New token communities need lending and borrowing markets with parameters that suit their own users. Peridot Markets gives each community an isolated group with configurable rates, collateral factors, caps, a liquid buffer, yield routes, rewards and optional margin.

The launch wizard creates the group in separate confirmed transactions. The group page supplies, borrows, repays, withdraws, claims funded rewards and manages margin positions. The owner Control Panel adds markets and changes parameters inside factory guardrails. Market creation uses deploy, activate and attach-yield transactions. With the currently pinned core, all markets must be added before rewards are enabled; adding markets after rewards is blocked pending a core decision.

Peridot's existing lending, margin, dashboard and bot code predates the event. This repository adds factory-created groups, their configuration and frontend flows, integration wrappers and group operations. See the exact source commits in [PRIOR_WORK.md](docs/PRIOR_WORK.md).

## Try the local demo

Use Node.js 22.12 or newer. Mock mode is explicit and displays a demo banner. It does not request wallet signatures or move funds.

```sh
cd app
npm ci
NEXT_PUBLIC_USE_MOCKS=true npm run dev
```

Open `http://localhost:3000`, then `/launch`, `/groups/1` and `/groups/1/control`. The mock owner is a demo address, not a funded account. Data is saved in browser storage.

## Configure a network

Mainnet is the default. Testnet is selected at build time through `NEXT_PUBLIC_NETWORK=testnet`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_NETWORK` | `mainnet` or `testnet` |
| `NEXT_PUBLIC_MAINNET_RPC_URL` | Browser-safe mainnet RPC endpoint |
| `NEXT_PUBLIC_TESTNET_RPC_URL` | Testnet RPC endpoint; defaults to Stellar's public testnet RPC |
| `NEXT_PUBLIC_READ_ONLY` | Set `true` for a chain-connected preview that disables all transaction submissions |
| `NEXT_PUBLIC_USE_MOCKS` | Set `true` only for local demo/testing; production must use `false` |

Copy `app/.env.example` to `app/.env.local` and set the required values. The example uses `https://mainnet.sorobanrpc.com`, a public endpoint listed in [Stellar RPC providers](https://developers.stellar.org/docs/data/apis/rpc/providers). Network, health and browser CORS checks passed on 25 October. Browser environment variables are public. Never put a private API key, wallet secret, admin key or signing key in them.

Lead A's deployment scripts produce `deployments/<network>.json`. After the readiness announcement, run `node scripts/sync-deployments.mjs mainnet` from `app/` with the public RPC environment set. The helper checks the RPC network and registered Wasm pins before copying public fields to the app manifest. Use `testnet` for that network. Placeholder manifests intentionally prevent live transactions. Changing a network or deployment requires a fresh build.

```sh
cd app
npm run typecheck
npm test
npm run build
```

Vercel project root: `app/`. A generated canonical interface snapshot is bundled and checked in CI. Build command: `npm run build`. Production URL and deployment commit will be recorded here after deployment. A fresh Freighter account must complete the evidence checklist before a phase is tagged.

## Integrations

| Integration | Role | Planned phase |
|---|---|---|
| Reflector | Asset prices with explicit token coverage | 1 |
| DeFindex | Yield vaults attached to eligible markets | 1 |
| Blend | Lending yield through a fee-vault adapter | 1 |
| Aquarius | Swaps for margin; LP yield and AQUA harvest later | 1 swaps, 2 LP vault |
| Zenex | USDC perps-vault route with asynchronous withdrawals | 3 |
| XOXNO | Additional lending yield route | 4 |
| Freighter | User-reviewed Stellar transaction signing | 1 |
| Soroban `deploy_v2` | Factory deployment of isolated group contracts | 1 |

Routes are shown as available only when deployed and configured. These protocols are venues Peridot composes with, not competitors ranked by the UI.

## Contracts and transaction evidence

Contract IDs come from generated deployment manifests. [DEMO.md](docs/DEMO.md) records confirmed transaction hashes, network, action and amounts. Existing Peridot deployments are prior work and are not substitutes for this build's evidence.

## Safety, guardrails and upgrades

Core lending contracts are Peridot's audited contracts with one change for the hackathon: upgrade and admin-parameter timelocks shortened from 24h to 60s. See [CORE_DIFF.md](core/CORE_DIFF.md). New contracts are unaudited.

- Groups isolate lending risk. Supply and borrow caps are required and positive.
- Reflector-priced collateral factors are capped at 75%; core also requires at least 1%.
- Liquid buffers range from 10% to 100%; reserve factors from 0% to 50%.
- Zero borrow rates are allowed. Rates and risk parameters use their actual core units.
- Factory owners act through guardrails. Changes emit events for history.
- No admin fallback prices are set. External feed symbols must map to trusted token addresses.
- Rewards depend on distributor funding. The UI shows available funds.
- Margin V3 uses staged operations with persisted recovery. An unknown transaction outcome is not automatically retried.
- New contracts support immediate Peridot-admin upgrades. Core upgrades retain a two-step process with a 60-second delay. Longer delays and multisig administration are post-event work.

Phase 2's loss reserve covers impermanent loss only up to the reserve balance. An empty reserve leaves normal LP risk. Zenex withdrawals take at least one hour and shares can lose value.

## Keeper and liquidation

Phase 1 requires a running margin liquidator for the demo group and fresh boosted-vault values for Blend/DeFindex markets. Service installation, dry-run and live-signing requirements are in [KEEPER.md](docs/KEEPER.md). A copied or dry-run worker does not count as running mainnet coverage.

Phase 2 adds self-hosted Aquarius harvest/range work. Phase 4 adds a funded hosted service. Workers use a dedicated identity; live execution with keys and spending funds require approval.

## Roadmap and SCF

Before opening public token launches: legal review of MiCA white paper and CASP questions, as recorded in the [launchpad handoff](docs/handoff/12-LAUNCHPAD.md). Launchpad work starts only after phase 1 is tagged on mainnet.

After the event: audit new contracts, restore production timelocks, move administration to a multisig, onboard initial partner groups and prepare an SCF proposal with adoption milestones. Intake wording and measurable delivery evidence are maintained in [MILESTONES.md](docs/MILESTONES.md).

## Team

Built by the Peridot team for HackMeridian 2026. Code freeze: 26 October at 08:00 Lisbon. Submission closes at 12:00 Lisbon.
