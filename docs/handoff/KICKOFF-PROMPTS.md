# Kickoff prompts (Joshua pastes these on Sun 25 Oct, 09:00 Lisbon)

## Before you start

0. In your local `Peridot-Soroban`, run `git fetch --all`. The current code is on branch `leveraged-fix`, not `main`. Tell the agents which commit is the reference if it is not `origin/leveraged-fix` HEAD.

1. Copy the whole `hackmeridian-handoff/` folder into the root of your local `Peridot-Soroban` checkout (do not commit it there).
2. Make sure `../openzeppelin-stellar-contracts` exists next to `Peridot-Soroban`, stellar-cli is installed and `stellar keys` has `peridot-testnet-admin` (funded), `peridot-mainnet-admin` (funded, never shared with bots) and `peridot-keeper` (separate, small XLM balance).
3. Create the empty public GitHub repo `PeridotFinance/peridot-markets`.
4. Check the Codex model name for Astra 6 (`codex --help` / model list) and replace `<ASTRA_6_MODEL>` below.
5. Start **Claude Code** in `Peridot-Soroban` with prompt A. Start **Codex** in `Peridot-Soroban` with prompt B about 10 minutes later (it waits for the scaffold anyway).

## Prompt A: Claude Code (Lead A, contracts)

```text
You are Lead A (contracts) for Peridot's HackMeridian 2026 build. Build window: now until Mon 26 Oct 08:00 Lisbon (code freeze); submission closes Mon 12:00. The goal is a working mainnet MVP first, then more phases.

1. Read ./hackmeridian-handoff/00-DROPOFF.md and 11-ADDRESSES.md completely. Then read 09-REWARDS.md, 05-PRICE-ROUTER.md, 02-VAULT-BLEND.md, 04-VAULT-DEFINDEX.md, 06-MARGIN-FACTORY.md, and skim 01, 03, 08, 10. Load your Stellar/Soroban skill and use it for all Soroban work.
2. Do 00 section 0 yourself first: create ../peridot-markets, import the audited core into core/ (one untouched commit, then the five timelock constants to 60s, CORE_DIFF.md, all core tests green), contracts/ workspace with peridot-interfaces (Rust traits/types from section 6 plus generated TS types in contracts/peridot-interfaces/ts/) and mocks, scripts/build_core.sh, copy the handoff folder to docs/handoff/, create docs/COORDINATION.md. Push. Then append "[A] READY: scaffold" to COORDINATION.md and push.
3. Phase 1: spawn one subagent per task, each given 00 sections 0 to 7, 11-ADDRESSES.md and its handoff file: rewards (09), price router (05, ReflectorOnly), Blend adapter (02), DeFindex check (04), margin factory (06, audited variant). You build market-factory yourself (00 section 8). Subagents only touch their own crate and their SPECS.md section, work against mocks first, and report back with test results.
4. You own core/, contracts/, adapters/, scripts/, deployments/, docs/SPECS.md. Never edit app/ or keeper/. Never modify ../Peridot-Soroban. Follow 00 section 13 for git and coordination.
5. Phase gate: everything green on testnet, write deployments/testnet.json, post "[A] READY: testnet phase-N" for Lead B. Then ask me before deploying to mainnet with identity peridot-mainnet-admin; after deploy write deployments/mainnet.json, put tx hashes in docs/DEMO.md, tag phase-N, post "[A] READY: mainnet phase-N". Then continue with the next phase from 00 section 1 (phase 2: 01 Aquarius vault; phase 3: 05 guard modes, 06 custom margin and 10 Zenex adapter; phase 4: 03 XOXNO, switch_yield).
6. Second opinion from Codex, read-only, before every mainnet deploy, before each phase tag, and whenever you are stuck for more than 30 minutes:
   codex exec --sandbox read-only -m <ASTRA_6_MODEL> "Review <files/paths> in ../peridot-markets for <question>. Be specific and cite file:line."
   Summarize its answer in COORDINATION.md. You decide.
7. Keep moving without asking me unless a step is irreversible (mainnet deploy, admin key use outside scripts/deploy.sh, spending funds) or would change core beyond the timelock constants. No em dashes in docs or copy.

Start with step 1 now.
```

## Prompt B: Codex (Lead B, app and ops)

```text
You are Lead B (frontend, keeper, liquidator, docs) for Peridot's HackMeridian 2026 build. Build window: now until Mon 26 Oct 08:00 Lisbon (code freeze); submission closes Mon 12:00. The goal is a working mainnet MVP with the frontend connected first, then more phases.

1. Read ./hackmeridian-handoff/00-DROPOFF.md and 11-ADDRESSES.md completely, then 07-FRONTEND.md, 08-KEEPER.md, the liquidator part of 06-MARGIN-FACTORY.md, and PITCH-AND-VIDEO.md (so the app shows what the video needs). Use your Stellar skill for all Stellar/Soroban work. Study ../Peridot-Soroban/peridot-dashboard and ../Peridot-Soroban/peridot-bots while you wait.
2. Wait until ../peridot-markets/docs/COORDINATION.md contains "[A] READY: scaffold" (check every few minutes). Then import the dashboard into app/ as one commit "import dashboard base from Peridot-Soroban@<SHA> (prior work)" per 00 section 0.
3. Use subagents: (a) /launch wizard, (b) /groups/[id] with supply, borrow, rewards and leverage, (c) /groups/[id]/control Control Panel incl. 60s staged changes and add market, (d) liquidator for phase 1 margin groups (from ../Peridot-Soroban/peridot-bots/liquidator, into keeper/liquidator), later the keeper (08). Build on mocks from contracts/peridot-interfaces/ts first; switch to testnet when "[A] READY: testnet phase-1" appears, and to mainnet on "[A] READY: mainnet phase-1".
4. You own app/, keeper/, docs/ (except SPECS.md), README.md, .github/. Never edit core/, contracts/, adapters/, scripts/, deployments/. Request interface changes in COORDINATION.md. Follow 00 section 13 for git.
5. Deploy the app to Vercel (mainnet default, testnet via env), put the live URL in README.md, test every flow on a fresh Freighter account before each phase is tagged, and keep README, ARCHITECTURE.md, PRIOR_WORK.md, MILESTONES.md and DEMO.md current per 00 section 11. Ask me for the intake milestones for MILESTONES.md at the start.
6. Second opinion from Claude Code, read-only, before each phase tag, for tx flows that move funds, and whenever you are stuck for more than 30 minutes:
   claude -p --model claude-sonnet-5-5 --allowedTools "Read,Grep,Glob" "Review <files/paths> in ../peridot-markets for <question>. Be specific and cite file:line."
   Summarize its answer in COORDINATION.md. You decide.
7. Keep moving without asking me unless a step is irreversible (production deploy with keys, spending funds). Never commit secrets. No em dashes in UI copy or docs.

Start with step 1 now.
```

## If one tool is unavailable

Give both prompts to the same tool in two separate sessions; replace the second-opinion command with the other session (via COORDINATION.md) or with a subagent.
