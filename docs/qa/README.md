# Peridot Markets QA harness

End-to-end logic tests of the app's own client code (`app/src/lib/peridot/*`) without a browser wallet. The harness lives in `app/qa/` and never edits app source.

## How it works
- `app/qa/lib/bootstrap.ts` (first import of every script) selects the network through the app's env vars, polyfills `window.localStorage` and `navigator.locks`, and for testnet overlays the app's placeholder `deployments/testnet.json` with `deployments/testnet.json` plus the external ids from `docs/handoff/11-ADDRESSES.md` (in memory only). For mainnet it patches `rpc.Server.sendTransaction` to throw, so nothing can be submitted.
- `app/qa/lib/signer.ts`: a `Signer` that signs the prepared envelope with a Stellar SDK keypair exactly like a wallet (`signTransaction(xdr)`), records the simulated resources, and flags address-credential auth entries (the wallets sign the envelope only). `dryRunSigner` records the prepared tx then throws `dry run`.
- `app/qa/lib/report.ts`: `step()`/`check()`/`dryStep()` record each step with tx hash, simulated and on-chain resources, fee and exact error into `app/qa/out/*.json`; `app/qa/make-report.ts` renders `docs/qa/RESULTS-*.md`.
- Secrets: testnet keys live only in `app/qa/.secrets/` (git-ignored, mode 600). Friendbot budget is capped at 5 accounts (used: owner, user, trader2).
- The harness must type-check: `app/tsconfig.json` includes `**/*.ts`, so any type error in `app/qa` breaks `next build`. Run `cd app && npx tsc --noEmit` after editing (recommended fix: add `"qa"` to tsconfig `exclude`).

## Commands (from `app/`)
| Part | Command | Notes |
|---|---|---|
| 1 Testnet journeys | `qa/run-testnet.sh` (or any single `QA_NETWORK=testnet npx tsx qa/flows/NN-name.ts`) | about 50 min; uses friendbot; the pool-align step trades on the shared testnet pool |
| 2 Mainnet dry run | `qa/run-mainnet-dry.sh [1\|2\|3\|margin\|control\|launch]` | simulation only, public deployer address, default RPC `soroban-rpc.mainnet.stellar.gateway.fm` |
| 3 Pages | `qa/run-pages.sh` | production build with `NEXT_PUBLIC_READ_ONLY=true`, port 3055, screenshots in `docs/qa/screens/` |
| Debug a failed tx | `QA_NETWORK=testnet npx tsx qa/diag-tx.ts <hash>` | prints the diagnostic error events |

Results: `FINDINGS.md` (ranked bugs, flow table), `RESULTS-testnet.md`, `RESULTS-mainnet-dry-run.md`, `screens/`.
