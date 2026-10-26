# Task: build the ICO launch type for the Peridot Markets launchpad (testnet only)

You work in this git worktree (branch `ico`, based on `demo-merge`). Do not touch `/Users/joshua/Peridot/Peridot-Soroban`. Do not edit `keeper/`. No em dashes in any text you write. Do NOT send any mainnet transaction. Deadline is a few hours: be fast, commit and push small and often (`git push origin ico`).

## Goal
The launch page (`/launch-token`) has a chooser with Simple token, Bonding curve and ICO ("Coming later"). Build the ICO type end to end on TESTNET: contract, deployment, and the app flow.

## ICO semantics (keep it simple and safe)
- A creator launches a token with a fixed supply and an ICO: a fixed price (quote asset per token, quote is the same asset the curve launches use), a hard cap (max raise), a soft cap (minimum raise), a start and an end time.
- Anyone can buy during the window at the fixed price until the hard cap is reached. Tokens are allocated to buyers; they claim after the sale ends.
- If the soft cap is reached by the end: the sale succeeds. The creator can withdraw the raised quote asset (optionally a configured percentage seeds an Aquarius pool and the rest goes to the creator; if that is too much for the time, keep it to: creator withdraws raise, remaining unsold tokens are burned or returned to the creator, as the contract's documented rule).
- If the soft cap is not reached: the sale fails and buyers can refund their quote asset in full; the creator can reclaim the token supply.
- Bounds enforced in the contract: duration between 10 minutes and 30 days, price above zero, soft cap at most hard cap, per-buyer cap optional, supply and caps within i128 safe ranges, no admin power over buyer funds, creator cannot withdraw before success, pausable by admin only for NEW purchases (never traps refunds or claims).
- Events for create, buy, finalize, claim, refund.

## Read first
`docs/handoff/12-LAUNCHPAD.md`, `docs/SPECS.md` (launchpad sections), `contracts/launchpad-factory`, `contracts/launchpad-token`, `contracts/launchpad-curve`, `contracts/vault-factory` (for the factory pattern), `app/src/lib/launchpad/*`, `app/src/components/launchpad/*`, `app/src/app/launch-token/page.tsx`, `deployments/testnet.json`, `scripts/deploy.sh`, `scripts/lib/dep.py`.

## Conventions
soroban-sdk 25.3, `#[contracttype]` tuple variants only, no `Option<struct>` in contracttype (use Vec), TTL bump only when below 100_000 up to 400_000, admin baked at compile time like the other crates, `upgrade(admin, hash)`, constructor style as in the curve. Unit tests for every path (success, soft cap miss and refund, hard cap, before start, after end, double claim, double refund, rounding).

## Deliver
1. `contracts/launchpad-ico` crate (add to workspace) with tests. Preferred: one ICO contract instance per launch deployed by the existing launchpad factory (add `create_ico(...)` to the factory, appended storage keys only so existing launches are untouched, upgrade the testnet factory in place with its `upgrade(admin, hash)` as was done for `create_plain_token`), registry getters (`list_icos`, `get_ico`, `icos_of`). If changing the factory is too slow, deploy a standalone `ico-factory` instead and say why.
2. Build with the repo scripts, deploy on TESTNET only, record in `deployments/testnet.json` through `scripts/lib/dep.py`, run one real testnet ICO end to end (create, buy from two accounts, finalize, claim, and a second ICO that misses its soft cap and refunds) and record tx hashes in `docs/handoff/12-LAUNCHPAD.md`.
3. App: enable the ICO option in the chooser (plain-language explanation: fixed price, soft cap, hard cap, refund if it fails), a create form with validation and a preview, an ICO page showing progress, countdown, buy box, claim and refund buttons, a type badge `ICO` on token cards, demo mode (mock) so the recording works without a wallet, humanized errors. Keep the design tokens, dark and light themes, 375px mobile.
4. Keep green: `cargo test` (all crates), `cd app && npm run typecheck && npm test && npm run build && npx playwright test` (the risk disclaimer must be pre-accepted in specs, see `app/tests/e2e/mock-flows.spec.ts`). Screenshots in `docs/ui/ico-*.png` (desktop dark, light, mobile).

When finished, push branch `ico` and print a short summary: head commit, contract ids and hashes, tx hashes, shared files touched, what is unfinished.
