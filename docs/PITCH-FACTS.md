# Peridot Markets: pitch facts (verified only)

**As of: 2026-10-26T11:47:39Z (UTC) = 2026-10-26 11:47:39 (Europe/Lisbon). Lisbon is on WET (UTC+0) from Sunday 25 Oct 2026 01:00 UTC, so Lisbon time equals UTC for the whole event.** Mainnet ledger 65145895.
Repo head this was written against: `6b43fbd` on branch `pitch-facts` (merged with `origin/demo-merge` `6b43fbd`). Repo: https://github.com/joshschcom/peridot-markets (public).

How to read this file (for the deck and video LLM):

- Every number is either read from the Stellar public network (Horizon, Soroban RPC, read-only simulations, nothing was sent or spent) or comes from a file in this repo, with the path or commit cited.
- `UNVERIFIED` means no evidence was found. `NOT YET DONE` means the thing is not on mainnet today. `PENDING (agent X running)` means another team agent is building or deploying it right now and it is not finished or not in `deployments/mainnet.json` yet.
- Do not say a PENDING or NOT YET DONE item is live. Do not round the money: the mainnet deposits are tiny beta amounts (see section 5).
- MAINNET IS MOVING: another agent deployed the launchpad on mainnet with the deployer key while this was written (09:16 to 09:21 UTC, logged in `deployments/mainnet.json` `launchpad_log` from commit `3f4c39a`; every hash there matches Horizon). Items still being built are marked PENDING (agent running). Rerun the refresh script before recording.
- Refresh the numeric tables right before recording: `node scripts/pitch_facts_refresh.mjs` (read-only, prints markdown tables). Screenshots: `node scripts/pitch_screenshots.mjs`.
- Timestamps in `docs/COORDINATION.md` entries signed `[A]` and labelled "WET" run about one hour ahead of git and chain time (example: "READY: mainnet phase-1, 17:00 WET" while the phase-1 commit is 16:02:37 UTC and the on-chain transactions end at 16:01:48 UTC). This file uses chain and git timestamps only. `[B]` entries use UTC and agree with the chain.

## How to use this file for the pitch

1. Use section "Fact sheet" below for slides and the video script. Every line in it is verified on chain or in the repo; the sections after it give the hash or file for each.
2. Use "Claims NOT to make" as a hard filter. If a sentence in the deck is not supported by the fact sheet or sections 1 to 10, cut it or mark it as roadmap.
3. Words: "live on mainnet" only for what section 3, 4 and 6 mark as done. "Testnet" for anything proven only on testnet (graduation, Aquarius ladder vault, Zenex against a mock). "Prepared" or "PENDING" for the rest. Never say "audited" about anything but the imported core.
4. The money is tiny (about 30 XLM supplied, about 5 USD). Sell the product and the verifiable transactions, not TVL.
5. Numbers drift (the keeper sends about 80 transactions an hour; agents were still deploying). Before recording run `node scripts/pitch_facts_refresh.mjs` and compare with section 3 and 5.
6. Screenshots are in `docs/assets/pitch-*.png` (section 11 says which are real data and which are mock mode). Mock-mode shots carry a "Demo data" banner; do not present them as mainnet.

## Fact sheet (10 lines, ready to paste, all verified at the as-of time)

1. Peridot Markets is live on Stellar mainnet (beta, unaudited new contracts, small caps): any token gets its own isolated lending group through a factory (`CBGW6LMU...`), 3 groups and 4 markets created on 25 Oct 2026.
2. The lending core is Peridot's audited code with exactly one change for the hackathon: eight timelock constants shortened from 24 h to 60 s (`core/CORE_DIFF.md`).
3. Idle liquidity is routed on mainnet into DeFindex (24 XLM from group 1) and Blend (group 3 adapter, tx `9af448d3...`); prices come from Reflector.
4. Leverage up to 3x is enabled on group 1 with the Aquarius XLM/USDC pool allowlisted and bound; a guardrail rejects a 90% collateral factor on chain (`CollateralFactorTooHigh`, error 20, simulated, nothing sent).
5. A group can pay rewards in its own token: group 2 has a funded distributor (20 XLM) and a real claim on chain (`b492b6e9...`).
6. The token launchpad is live on mainnet: factory `CAN6YNLF...`, token PDEMO launched 26 Oct 09:21 UTC (`fce3e87f...`), upgraded for ICO support at 11:28 UTC; testnet shows the full path bonding curve to Aquarius pool with LP locked to the zero address and the token's own lending market.
7. A vault factory (`CBWWQGA6...`) is live on mainnet with Zenex and XOXNO vault kinds registered; a demo XOXNO vault holds 3 XLM in the real XOXNO lending controller (create `2b8ce5b3...`, deposit `71abddbe...`, withdraw `320f7f44...`).
8. A keeper on a DigitalOcean droplet refreshes the boosted vaults and accrues interest every couple of minutes: 457 on-chain transactions from the keeper key since 06:30 UTC, costing 0.536 XLM in total.
9. Tests: 884 Rust tests (`cargo test --workspace`), 206 app tests and 79 keeper tests pass locally; the app is served at https://markets.peridot.finance (HTTPS) and https://test-markets.peridot.finance (testnet).
10. Our addresses sent 559 mainnet transactions during the event (admin 93, vaults key 9, keeper 457), deployed 27 contracts, and spent about 792 XLM in fees and rent (mostly Wasm and contract rent).

## Claims NOT to make

- Do not say any borrow, leverage position, Control Panel edit, fresh-wallet acceptance or liquidation has happened on mainnet: none has (section 6).
- Do not say a token has graduated on mainnet (0; graduation costs 300,000 AQUA and the demo 500 XLM preset is too small for borrowing against a graduated token, Codex HIGH finding 2). Graduation is proven on testnet only.
- Do not say an ICO exists on mainnet: the ICO contracts are live, but no ICO has been created.
- Do not say Zenex or XOXNO vaults are routed from a Peridot market on mainnet: neither vault is allow-listed in the market-factory (read on chain, `is_yield_vault_allowed` false). The XOXNO demo vault is a standalone vault with 3 XLM; the Zenex demo vault has no deposits.
- Do not say Aquarius LP vault, loss reserve, AQUA harvest, custom margin, hosted keeper subscription or XOXNO/Zenex "integration" in the sense of live user funds: not built or testnet only (the Aquarius ladder vault is testnet only).
- Do not say "audited" for the factories, adapters, launchpad, vaults, frontend or keeper; only the imported core is audited, and its timelocks were changed.
- Do not claim TVL, users or volume: one depositor (the deployer), about 5 USD.
- Do not claim CI is green (red on all runs) or that Albedo signing works for Soroban transactions (unverified).
- Do not use the 1 hour-ahead `[A]` times in `docs/COORDINATION.md`; use chain times.

## 0. One-paragraph truth

Peridot Markets is a factory that gives any Stellar token its own isolated money market group (lending, borrowing, optional leverage, optional own-token rewards) on top of Peridot's audited lending core, with idle liquidity optionally routed into DeFindex or Blend. Phase 1 is live on Stellar mainnet since Sunday 25 Oct 2026 15:36 to 16:01 Lisbon (Blend route 16:51 to 16:53): 3 groups, 4 markets, 21 contracts, DeFindex and Blend routes, margin enabled on group 1, a funded rewards group with a real claim. The token launchpad (bonding curve, Aquarius graduation) is verified end to end on TESTNET. On mainnet, the launchpad factory was deployed at 09:17:53 UTC on 26 Oct and one token (PDEMO) was launched at 09:21:03 UTC on its bonding curve (still trading, 0 graduated); the factory was upgraded in place for ICO support at 11:28 UTC (no ICO created yet), a vault factory with Zenex and XOXNO kinds went live at 10:52 to 10:58 UTC, and a demo XOXNO vault deposited 5 XLM and withdrew 2 into the real XOXNO controller. No borrow, no margin position and no Control Panel edit has happened on mainnet yet. Phases 2, 3 and 4 are not tagged.

## 1. Phases

Only one git tag exists: `phase-1` (annotated tag object `590a2f0779c86904e98b70959b655f7c7d4076bf`, points at commit `3bf79b5ae7fe3ff8a9923214d776d955837e7ee1`, tagger time 2026-10-25 16:02:30 UTC = 16:02:30 Lisbon; pushed to origin, verified with `git ls-remote --tags origin`). Phase definitions: the original design notes (not published) section 1.

| Phase | Planned scope (00-DROPOFF.md) | Shipped to mainnet | Not shipped | Tag / commit | Mainnet deploy time (Lisbon) |
|---|---|---|---|---|---|
| 1 MVP | Factory, per-market rates incl. 0%, CF, caps, buffers, Reflector pricing, routes None/DeFindex/Blend, own reward token, margin via audited margin-controller, Control Panel, frontend, liquidator | market-factory + margin-factory, groups 1 to 3, 4 markets, DeFindex route (group 1 XLM), Blend route (group 3 XLM), rewards (group 2, 20 XLM funded, one real claim), margin enabled on group 1 (3x max, Aquarius XLM/USDC pool allowlisted and bound), keeper on a droplet for group 1 (refresh and interest only) | A borrow tx, a margin open or close tx, a Control Panel edit tx, a fresh-wallet acceptance run (all NOT YET DONE on mainnet; see section 6). Rewards group cannot take a new market after rewards are set (audited-core re-entry limit, documented in `docs/SPECS.md` Factory) | tag `phase-1`, commit `3bf79b5`. Blend route came after the tag: commit `09cc9ec` (2026-10-25 16:54:04 UTC) | First mainnet tx (upload market-factory Wasm) 15:36:23; market-factory created 15:36:33; group 1 created 15:40:08; margin-factory 15:50:58 to 15:56:28; rewards group and claim 15:56:58 to 16:00:03; tag 16:02:30; Blend fee vault and group 3 16:51:08 to 16:53:43 |
| 2 Aquarius | Aquarius LP vault with loss reserve, self-hosted keeper harvesting AQUA | Nothing from the Aquarius LP vault. The self-hosted keeper (liquidation, boosted-vault refresh, interest accrual) runs on a DigitalOcean droplet for group 1 since 2026-10-26 06:30:23 (first keeper tx) | Aquarius LP vault with loss reserve (no `aquarius-loss-reserve` crate in the workspace; the factory rejects any route other than None, DeFindex, Blend: `contracts/market-factory/src/lib.rs` line 409), AQUA harvest. The core `aquarius-lp-vault` crate is imported prior work, not deployed by this project. In flight, not merged into `demo-merge`: an `aquarius-vault` crate (laddered concentrated liquidity, 14 unit tests, commit `a284dfd` on branch `vault-factory`), PENDING (agent running) | No tag | NOT YET DONE. The /vaults page labels the Aquarius LP vault "Demo flow" (see screenshot) |
| 3 Price + custom margin + Zenex + launchpad curve | Aquarius guard pricing, custom margin, Zenex route, launchpad bonding curve | On TESTNET only: AquariusOnly pricing (`contracts/price-router-ext`, 55 tests), launchpad token + curve + factory with Aquarius graduation, plain simple token. Mainnet: IN FLIGHT, observed on chain 26 Oct 09:16 to 09:21 UTC: market-factory upgraded, launchpad factory deployed, launchpad configured (`set_graduation`, `set_quote_price`, `set_launchpad`), first token PDEMO launched (section 6). recorded in `deployments/mainnet.json` `launchpad_log`; ICO upgrade at 11:28 UTC (`launchpad_ico_mainnet`); no graduation yet, no ICO created | `ReflectorWithAquariusGuard` (rejected `UnsupportedMode`), custom margin (`docs/PRIOR_WORK.md`: "Phase 3 has not started. No custom-margin diff is claimed"), Zenex route on mainnet. A `zenex-vault` crate now exists in `contracts/zenex-vault` (tests, merged in `729010e`) and is deployed on TESTNET against a MOCK Zenex (Zenex has no testnet, `deployments/testnet.json` `zenex.note`); mainnet PENDING (agent running) | No tag. Launchpad stages: `d0bbdc4` (stage 1), `3d4b983` (stage 2 graduation), `3974d73` (LP lock by transfer to the zero account) | Mainnet launchpad: 26 Oct 09:17:53 (factory), 09:21:03 (first launch), UTC = Lisbon; not a finished phase. Testnet graduation run recorded in `docs/DEMO-TESTNET.md` (25 Oct) |
| 4 More routes + hosted keeper | XOXNO adapter, hosted keeper with on-chain funding, switch yield route, CL range, ICO | Nothing on mainnet. Group 1 keeper is team-run, not a paid hosted service (`keeper_mode` is `None` on all 3 groups, read on chain) | XOXNO as a Peridot market route (a standalone XOXNO vault is live on mainnet, but the market-factory does not allow-list it), hosted keeper subscription, switch_yield, ICO (`docs/SPECS.md`: "The ICO is not built"). The generic vault-factory (create-vault form in the app, `f0aa1f2`; contract `2ae9d78`) is merged and deployed to TESTNET only | No tag | NOT YET DONE |

## 2. Mainnet contracts

Source: `deployments/mainnet.json` (core commit `47858c1a13c2588970395faa2212e7b68bd33060`) plus contracts derived on chain from the factory (`get_group`, `get_market_record`, `get_margin`). Every ID below was checked with a Soroban RPC `getLedgerEntries` instance lookup at the as-of time: all exist ("On chain: YES"). Full machine-checked table: `node scripts/pitch_facts_refresh.mjs --only=contracts`.

| Role | Contract ID | On chain |
|---|---|---|
| Market factory (MF): creates groups and markets, admin of every group contract | `CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S` | YES |
| Margin factory (XF): per-group margin controller and swap adapter | `CCTFHRHDJM4BH6O2R325L6JXYWVCUDCM2IBO3BLRCE53KDM5JR5YZ6YH` | YES |
| Group 1 "Meridian" controller | `CCIVCL6B5TNYC5PTJDFXD24AEJ5VQU5XUTZXFFGMIVRWQSSZFZPIPUES` | YES |
| Group 1 price router (Reflector) | `CBBZ2FPMJDFSGQD64Y6U4IKJ7YXO2RP5T5AQMXRNBYKFXZOTGMFTF3XD` | YES |
| Group 1 USDC market (receipt vault, no yield route) | `CCZHYRBCNKB5F3RPMD4VV747NIV6QFJ4EBZLPWDSQWHNNKYDO62OVIRM` | YES |
| Group 1 XLM market (0% borrow, DeFindex route) | `CCK7R22G3HOZDJXU6DVDEXK4HZ6AS3DHHFCAFOMY22XQEA3DJHRRSNXI` | YES |
| Group 1 margin controller (audited variant, 3x max) | `CCWAUBM6C5RRPBFKJK57I56GXRCILOKRVJEOAGEI7ZHKXVSOHEL5JPEY` | YES |
| Group 1 swap adapter (routes margin swaps through Aquarius) | `CCDGYBI2JL7K3B7KVPV4GWJTKUF3IE75RC3EDCQ3IGYOPQZFII6ZCNQH` | YES |
| Group 1 jump-rate models (USDC, XLM) | `CAJTAM4FD26AZJRCSMECXQKCK2PKGDNOZCCSDAGKHGOJL3XU7VMH2AZJ`, `CCOJ6X3KDYIPQVYRVVWRYKOXQ36S4PZYVPFIU4EIBESXADIFVCSJVYNC` | YES |
| Group 2 "Rewards" controller | `CADHYBWKFNDE3LKNWCRD7F6FNHTNQAR4W3AT2G3TROO7V6RZ2VMUKZSZ` | YES |
| Group 2 price router | `CC34X3I5DLX456C7TEOVH2ZVMIXEX3BXNIO53WQBCG6SE5AKXFZNVZV6` | YES |
| Group 2 XLM market | `CARDJEVXDP5RY3GAKRYSW4T5CKYY7Y4PQTS4CJSVQEBKP4JMHTDFPXNV` | YES |
| Group 2 jump-rate model | `CD27WGPCV7YO56PZKOUCT3QIGUWHONZPE7LYG5EKS2WVCXJRR6RY4FJJ` | YES |
| Reward distributor (group 2, reward token XLM) | `CA4AMJK54MZI2KDU5KJFPF5SD4KULJETIITPVVQH5WTEH2WH6IKOSYUF` | YES |
| Group 3 "BlendDemo" controller | `CBGLMNCDWF7GTSGWU5DT5ZGAVM6JABAMJH3G3SMNGKDQQ2NTIG3RU2O2` | YES |
| Group 3 price router | `CDUMNV6OQ625MSLANDLXECPLYSWEQGYBPWUJCAALNIUKKPXXM3AV5JSJ` | YES |
| Group 3 XLM market (Blend route) | `CCUQUYBW3LJXPYB5U5QIDBDWPMKYVBPCIHQZSSXOSAV2SIXOBDNHSUDM` | YES |
| Group 3 jump-rate model | `CDN4KKCMSPFLGL2YBMJEWYKS3XKF4WED2LELJTJJLS2JDEE5VEQ2AOO5` | YES |
| Blend vault adapter (group 3, one per market) | `CDLLNAM63H5BVYH4BCNIWY6AULTDO6H455M4NF3HIYUW4XBXW6TPOPIX` | YES |
| Peridot Blend fee vault (admin = deployer, 10% take rate) on the Blend Fixed V2 pool | `CCHILGAYU4DQXLWSTOA5BQYZD7QJMWUU5PQLS4Z25FLI2WP6IVV3X337` | YES |
| Keeper address (liquidation, boosted refresh, interest): account, not a contract | `GAFJVD3TKIEMIUEBJPQVZNRCG7PF25XOX7QZDRGR7Y3MNQWYQR6C2S3W` | account exists on Horizon |
| Deployer, group owner, factory admin (`peridot-mainnet-admin`): account | `GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH` | account exists on Horizon |

Launchpad, vault factory and vaults on mainnet (read on chain from the deployer's Horizon transactions, `config` and `list_launches`, and also recorded in `deployments/mainnet.json` `launchpad_factory`, `launchpad_demo`, `launchpad_log`):

| Role | Contract ID | On chain |
|---|---|---|
| Launchpad factory (created by tx `ef3dfcc9...`, 26 Oct 09:17:53) | `CAN6YNLFZHMLHPZAMSLR2BTIM7VOS6YZEXJSZAXQEHKPO7BN4RP5NA7J` | YES (Wasm `e7c070ce...`, `launch_count` 1, `launch_fee` 0, admin and treasury = deployer) |
| PDEMO token ("Peridot Demo", preset 0, quote XLM) | `CDKHQPYSBULW3T2FNLPKKKXVKREDYZTI37KRURBNVNEUIZ5YDT4O4DYT` | YES |
| PDEMO bonding curve | `CDWJL4YJ4H546FFXNXSNREW27PFQFNMBQPXDIUHTN765Z52MRDUJH43A` | YES (phase Trading, raised 4.95 XLM of a 500 XLM target) |
| Launchpad factory Wasm after the ICO upgrade (txs `a86d1491...` upload ICO, `405e9ee9...` upload factory, `2df7039b...` upgrade, `b572adef...` `set_ico_wasm`, all 26 Oct 11:28 UTC, deployer) | same ID `CAN6YNLF...` | YES, Wasm now `b371a8c3...`; ICO Wasm `7596bd47...`; no ICO created |
| Vault factory (deploy tx `07962786...`, 26 Oct 10:52:48, vaults key) | `CBWWQGA6ZURTB5IVZO3Q2EQBOSO4FDGLKNUNUWX5Q57TWKHHYFGRAJTW` | YES (Wasm `231f72c4...`, admin deployer); kinds registered by `set_wasm`: zenex (tx `72eddbed...`, 10:57:53), xoxno (tx `6c57f036...`, 10:58:13) |
| Demo Zenex vault (create tx `8118c8cd...`, 10:59:13) | `CD6ZTDY6MTACM5D3BY7OW3SXZDAQ322RQUOFEFXBWU44TLO4LXIZQRMP` | YES; `total_supply` 0, unbound to a market, NOT allow-listed in the market-factory (`is_yield_vault_allowed` false) |
| Demo XOXNO vault (create `2b8ce5b3...` 10:59:23, deposit 5 XLM `71abddbe...` 10:59:43, withdraw 2 XLM `320f7f44...` 10:59:58; owner = vaults key) | `CCXPXDV3VXQE2WHOQOBRO7XSQTPJXSYWRF4H3UHIEWNVGL2RRYDIHCDC` | YES; `get_state`: principal and total value 30,000,000 base units = 3 XLM, supplied into the real XOXNO controller `CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX`; NOT allow-listed in the market-factory (`is_yield_vault_allowed` false) |
| Market-factory Wasm after the 09:17:08 upgrade tx `be954d81...` | same ID `CBGW6LMU...` | Wasm hash changed from `a5442cae...` to `baec971c...` |

External contracts our contracts call (all exist on chain): Reflector external CEX/DEX feed `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` (prices the markets, symbol keyed), Reflector Stellar-assets feed `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` (allowlisted, not used by the three live groups), Aquarius router `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK`, Aquarius XLM/USDC pool used for margin `CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV`, Blend Fixed V2 pool `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`, DeFindex Peridot XLM vault `CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK` (an existing Peridot vault from prior work, Wasm `ae3409a4...`), USDC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`, XLM `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`.

Wasm hashes registered in the factory (`deployments/mainnet.json` `wasm`, matched against the live instances): receipt vault `8cc9f723...`, controller `dabe8d1c...`, jump rate `4052162e...`, price router `e04a63e0...` (the manifest now also lists `price_router_ext` `14c83a90...` as the Wasm for new groups, registered at 09:19:28 UTC, tx `bb6ed2a3...`; the three existing groups keep the old router), reward distributor `2e5790ce...`, swap adapter `2640f364...`, margin `f11f34e7...`, blend adapter `4a5b6d2c...`.

Not on mainnet yet, or only partly (status per row):

| Item | Status |
|---|---|
| Launchpad ICO | Contracts live on mainnet since 11:28 UTC (ICO Wasm registered in the factory), tested end to end on testnet; no ICO created on mainnet |
| Launchpad factory, token, curve on mainnet | Live (table above) and in the manifest. Graduation on mainnet: NOT YET DONE. App page for the mainnet token: see section 9 |
| Market-factory upgrade for graduation (`set_launchpad`, AquariusOnly pricing) | Done on mainnet (txs `be954d81...` 09:17:08, `c0019b9d...` 09:19:18, `bb6ed2a3...` 09:19:28). The three existing groups keep their old price routers |
| Vault factory, Zenex and XOXNO demo vaults | Live on mainnet (table above), not connected to any Peridot market |
| Aquarius ladder vault | TESTNET only. A mainnet upload would cost about 70 XLM and was not done (coordinator, UNVERIFIED on chain: absence is not provable) |
| Core price router, aquarius-lp-vault, peridot-token | Not deployed by this project |

## 3. Counts during the event (mainnet)

Event window start: 2026-10-25 09:00 Lisbon = 09:00 UTC (`docs/PRIOR_WORK.md`: build window begins 25 October 2026 at 09:00 Lisbon). Snapshot below is as of the as-of time; the keeper currently adds about 85 transactions an hour (457 in its first 5 hours 17 minutes), so rerun the script for current numbers.

| Metric | Value | Method |
|---|---|---|
| Market groups created | 3 (Meridian, Rewards, BlendDemo) | `market_factory.group_count()` simulated on chain, plus `group_created` events |
| Markets | 4 (USDC and XLM in group 1, XLM in group 2, XLM in group 3) | `get_group(g).markets` for g = 1 to 3 |
| Groups with margin | 1 (group 1, 2 margin-enabled markets) | `margin_factory.get_margin(1..3)`; groups 2 and 3 return null |
| Contracts deployed | 27 | 5 direct `create_contract` ops (deployer: market-factory, margin-factory, Blend fee vault, launchpad factory; vaults key: vault factory; Horizon operations) + 22 created by factories (3 group controllers, 3 price routers, 4 market receipt vaults, 4 jump-rate models, 1 reward distributor, 1 Blend adapter, 1 margin controller, 1 swap adapter, the PDEMO token and curve, the Zenex and XOXNO demo vaults), each confirmed to exist on chain. Before 09:17 UTC on 26 Oct the count was 21 |
| Wasm uploads | 21 | Horizon operations with function type upload: 18 by the deployer (11 up to 16:53 on 25 Oct, 7 on 26 Oct) and 3 by the vault agents' key |
| Transactions sent by the deployer `peridot-mainnet-admin` (`GC3FLITV3...`) | 93 sent since 15:36:23 on 25 Oct (92 successful, 1 failed on chain: a classic 75 XLM funding payment, not a protocol call). 91 are Soroban invocations, uploads or creates | Horizon `/accounts/{id}/transactions` with `include_failed=true`, filter `source_account = address`, created at or after the event start. Last one 26 Oct 11:28:48 (ICO upgrade) |
| Transactions sent by the keeper `peridot-mainnet-keeper` (`GAFJVD3T...`) | 457 at the as-of snapshot, all successful (154 `refresh_boosted_underlying`, 303 `update_interest`), first 2026-10-26 06:30:23, last 11:47:33, fees paid 0.536 XLM in total | same method |
| Transactions sent by `peridot-mainnet-vaults` (`GDLVO6BC...`), the key the vault agents use, funded by the deployer | 9, all successful, first 09:21:08, last 11:08:58: 3 Wasm uploads, 1 contract create (vault factory), 2 `create_vault` (Zenex and XOXNO demo vaults), 1 `deposit`, 1 `withdraw`; 70.54 XLM of fees and rent | same method |
| Total sent by the three addresses built for this project | 559 (558 successful) | 93 + 457 + 9 |
| Transactions sent by the Peridot production key `peridot-mainnet` (`GDYDTMY4...`) | 663 since event start (659 successful): 483 `cache_price`, 79 `refresh_boosted_underlying`, 77 `update_interest`, 8 `bump_user_borrow_ttl`, 4 `withdraw`. These are Peridot's pre-existing production lending core (prior work), NOT Peridot Markets. Do not count them as event work | same method |
| Total including the prior-work key | 1,222 | 559 + 663. Use 559 for "transactions we sent for Peridot Markets" |
| Fees paid | Deployer 721.16 XLM, vault key 70.54 XLM, keeper 0.54 XLM: about 792.2 XLM in total (includes Soroban rent for Wasm uploads and contract storage; the launchpad deployment alone was about 181 XLM) | sum of `fee_charged` over the sent transactions |
| Tokens launched on mainnet | 1 (PDEMO, launched 26 Oct 09:21:03 UTC by the deployer with a 5 XLM first buy, 4.95 XLM after the 1% fee). Testnet: launchpad factory `launch_count` is 2 (PDEMO, PGRAD) plus plain token SIMPL | mainnet launchpad factory `config()` `launch_count` = 1 and `list_launches` |
| Tokens graduated on mainnet | 0 (PDEMO curve is in phase Trading; graduation needs 500 XLM raised and 300,000 AQUA). Testnet: 1 (PGRAD, pool `CBZADNRMC7O6IL344YXEIB3PBD2PPAJLHHI5KWJORWXJR67UNOUUTO3G`) | `get_state()` on the mainnet PDEMO curve; `get_graduation()` on the PGRAD curve: `claimed: true`, `group_id: 1` |
| Third-party users | None found. The only supplier on all four markets is the deployer; zero borrows, zero margin positions (every `mint`, `burn`, `redeem`, `borrow_event` event of every group contract since 15:40 on 25 Oct comes from the deployer) | Soroban RPC `getEvents`, 96 events scanned |

## 4. Integrations actually live on mainnet

| Partner | Status | One tx hash as proof | Notes |
|---|---|---|---|
| Reflector | LIVE on mainnet | [8341a38f...](https://stellar.expert/explorer/public/tx/8341a38f2efa8f90961cf779c0d3aa654249a8062d552f681ccddae6ebae0295): `activate_market` USDC, binds the Reflector feed to the market (token, oracle, asset tuple allowlisted by `set_price_feed_allowed`) | All 4 markets are priced `ReflectorOnly` on the external feed (read at as-of time: XLM and USDC prices returned by `lastprice`). The Stellar-assets feed is allowlisted but unused |
| Aquarius | PARTIAL. Live as the margin swap venue (pool allowlisted and bound for group 1). No swap has run through it, because no margin position exists. LP vault: not built. Launchpad graduation into an Aquarius pool: testnet only | [a994a43a...](https://stellar.expert/explorer/public/tx/a994a43ae8d0a0a485fcd3508fe57ad9d700512566d4baa282639030bee58497): `set_pool_binding`, XLM/USDC pool `CBBMQBNH...`. Testnet graduation: [b7ecae68...](https://stellar.expert/explorer/testnet/tx/b7ecae682686980929010b0bd77e88669f6d9476680c99ea368b880eb041f1b2) | Aquarius pool creation fee read live on mainnet: `get_standard_pool_payment_amount` = 3,000,000,000,000 base units of AQUA (300,000 AQUA) |
| Blend | LIVE on mainnet (group 3, via Peridot-administered fee vault and the Blend adapter) | [9af448d3...](https://stellar.expert/explorer/public/tx/9af448d3603385adddacba91b103dbeda8c67946fd32c76090be8bb319658db9): supply 5 XLM, 4 XLM sent to Blend (adapter value 39,999,999 stroops) | Position was withdrawn in full ([0dafc04e...](https://stellar.expert/explorer/public/tx/0dafc04e651ff663e1a0b8bfe47823d29d7218110ba0c1e3e32a5b33e7fc991c)); today the adapter holds 0 (section 5) |
| DeFindex | LIVE on mainnet (group 1 XLM market attached directly to the existing Peridot XLM DeFindex vault) | [a6a5a1fa...](https://stellar.expert/explorer/public/tx/a6a5a1fa7f953dbae5b1b0cb4ae4513cdc3ccc420c4d0f73e0c61686e81b08a8): supply 5 XLM, 80% routed to the vault | The vault is Peridot's own prior-work vault, not a new vault created by this project. Currently holds 24 XLM from our market |
| Zenex | PARTIAL on mainnet: vault factory kind registered (tx `72eddbed...`) and a demo Zenex vault `CD6ZTDY6...` deployed (create tx `8118c8cd...`), but 0 deposits, no market binding, not allow-listed in the market-factory, so no user funds reach Zenex. Full flow (deposit, sync, fill, withdraw) proven on TESTNET against a MOCK Zenex only | mainnet: [8118c8cd...](https://stellar.expert/explorer/public/tx/8118c8cd1fc751c5f94d1919fb320dc94a7d4ef4e67b30b71ef99cc0c424977e) `create_vault`. testnet deposit: [cabee19f...](https://stellar.expert/explorer/testnet/tx/cabee19f28a4851f79ec5d6ff312e7b0a80a9e55354c511b7f538b7b9fca886a) | Real Zenex exists on mainnet only; the constructor was simulated against it (`deployments/mainnet.json` `zenex.constructor_simulation`, a claim in the manifest, not re-run here). Do not say Zenex is integrated with live funds |
| XOXNO | LIVE on mainnet as a standalone vault: the demo vault supplies into the real XOXNO lending controller (3 XLM now). NOT connected to a Peridot market (not allow-listed in the market-factory) | [71abddbe...](https://stellar.expert/explorer/public/tx/71abddbea7edc02f72644cc9a86e3171b2ae2880b1e9b4ca3a3424d30ac395a5): deposit 5 XLM; [320f7f44...](https://stellar.expert/explorer/public/tx/320f7f44d69e70ef1dae3eea9647080cc69313b93cf7bfd8ef6596c87cf53523): withdraw 2 XLM | Listing a graduated token on XOXNO Lending is owner-only governance (`docs/SPECS.md`); do not claim graduation into XOXNO |

## 5. Value routed (read on chain at the as-of time; tiny beta amounts)

Prices from the Reflector external feed read at the as-of time (XLM 0.16924 USD, USDC 1.0013 USD at 11:47 UTC; the USD figures below used the 09:27 prices and are approximate).

| Where | Token amount | USD |
|---|---|---|
| Supplied to our four markets in total (all by the deployer) | 30 XLM (group 1 XLM market) | 5.07 |
| Of which routed into DeFindex (Peridot XLM vault, held by the group 1 XLM market): vault shares 239,943,636, worth 24.0000000 XLM | 24 XLM (idle buffer 20% stays in the market: 6 XLM) | 4.06 |
| Routed into Blend (group 3 adapter via the fee vault): shares 0 | 0 XLM | 0 |
| Borrowed from our markets | 0 | 0 |
| Standalone XOXNO demo vault (vaults key), supplied into the real XOXNO controller | 3 XLM (principal 30,000,000 base units) | about 0.51 |
| Group 2 reward distributor balance (reward token XLM) | 19.9983 XLM available of 20 XLM funded, 0.0017 XLM paid out (one claim) | about 3.38 |
| Aquarius liquidity locked by graduations, mainnet | 0 (no mainnet graduation; the mainnet PDEMO curve holds 4.95 XLM raised and is still trading) | 0 |
| Aquarius liquidity locked by the PGRAD graduation, TESTNET (not real money) | 500 XLM and 200,000,000 PGRAD seeded; 3,162,277,660,168 LP shares sit at the all-zero account `GAAAA...AWHF` (token `balance` read on testnet equals the curve's `lp_shares_burned`) | testnet tokens |

Honest framing for the pitch: total value in the mainnet markets is about 30 XLM, roughly 5 USD (plus the 3 XLM demo vault). The product is live and verifiable; there is no TVL to brag about yet.

## 6. Key tx hashes (mainnet unless marked)

All times UTC = Lisbon. Links: `https://stellar.expert/explorer/public/tx/<hash>`.

| Step | Status | Hash | Time |
|---|---|---|---|
| Upload market-factory Wasm | done | `72907d0035cd65fe8e5da956877014485d86f8f465fa3d9d97b7d79b8ba628b4` | 25 Oct 15:36:23 |
| Deploy market-factory | done | `f6cafca8fe3d83e8571e2fe74d9eb4fd667ff0827fd1426c36019e73424ed6a9` | 15:36:33 |
| `create_group` (group 1 Meridian) | done | `adec8eb4fdf444782f7d1591dcd6ac9792f330eb8e66e52f351a599ebbb800ac` | 15:40:08 |
| `create_group` (group 2 Rewards) | done | `4d2bd3e7385dfbe4e03dfa8587ddda783bd0352a6e8a908be91d66a1d33920ad` | 15:56:58 |
| `create_group` (group 3 BlendDemo) | done | `e3117823ca85ee86972db0b9cca3ace5c3c6fd534d46465477e5cb22128d7365` | 16:52:28 |
| `add_market` USDC | done | `76ce3b922c50e100baa6fa20aa39681fd649c92229464dcaf6e723ee6776d4d3` | 15:40:23 |
| `add_market` XLM, 0% borrow | done | `69e7e64b2d2c33753d14cff5fae29dd5a2a4cabaf093750a7d00f899bc1f8f59` | 15:41:23 |
| `attach_yield` DeFindex (group 1 XLM) | done | `d07907253f036601bc35615f0562393218d56145bdcbddf5ea656997eafb8692` | 15:42:13 |
| `attach_yield` Blend (group 3 XLM) | done | `78d937d5e5c45d294ae51d7462d401862385a529bbb8884fc888bfb1d8939922` | 16:52:58 |
| `attach_yield` Aquarius, Zenex, XOXNO on mainnet | NOT YET DONE (PENDING, agents running). Zenex `attach_yield` on TESTNET against the mock: `edfe422085c82e1d33b75f7ccf2ed782aecbcf3320c9c7f9162c628bccad2e05` | none on mainnet | |
| `deposit` (supply) 5 XLM, DeFindex route | done | `a6a5a1fa7f953dbae5b1b0cb4ae4513cdc3ccc420c4d0f73e0c61686e81b08a8` | 15:42:58 |
| `deposit` (supply) 30 XLM seed on group 1 (still deposited) | done | `50a27e85dd9b978ffa44bbeefb8d2b6e04ba44d4b7caa6e34654a05c290e0e85` | 21:38:58 |
| `borrow` | NOT YET DONE on mainnet. A read-only simulation of borrowing 1 XLM on group 1 by the deployer succeeds now (nothing sent); see section 9 | none | |
| Reward `claim` (group 2, 17,000 stroops paid) | done | `b492b6e91ee347d46e2b92ad7b73c4eea127b98776e154f2ea76c18cb960f77b` | 16:00:03 |
| `enable_margin` group 1 | done | `c9f0cf44d7d1f13a26bbfc8d0beeab639ab4f5c1e235a575c9312593a5125ea2` | 15:55:03 |
| Margin open | NOT YET DONE on mainnet (no position exists). TESTNET 2x long open by the QA harness (first of 4 stage transactions): [20a6b5fb...](https://stellar.expert/explorer/testnet/tx/20a6b5fbc98a55b654b82fb22923c98f15534a4faad95067309eacee774b837c) | none on mainnet | |
| Margin close | NOT YET DONE on mainnet. TESTNET close (first of 3 stages): [ff77f742...](https://stellar.expert/explorer/testnet/tx/ff77f742e2037285a84b3c3724361625330d5f22a607d2a8c26c06ce05edfc82) | none on mainnet | |
| Keeper `refresh_boosted_underlying` (first live one) | done | `5e0f85dede0c23d11020d30743cc99f62d3b2c3921ba4dafd6e2861fa7a83a8a` | 26 Oct 06:30:23 |
| Keeper harvest of AQUA (Aquarius vault) | NOT YET DONE. No harvesting exists; the keeper only refreshes and accrues | none | |
| Launchpad factory deploy (mainnet) | done, in flight (PENDING agent running) | `ef3dfcc92c3e1618b83464cb5efa2ac021322614c11201ffb46d7818e7c7d699` | 26 Oct 09:17:53 |
| Market-factory upgrade for the launchpad (mainnet) | done, in flight | `be954d8101b54e2936b1082be89752d8be8ce1b55db86ceecafd83848f9dec16` | 09:17:08 |
| Launchpad configured: `set_graduation` `49510585...`, `set_quote_price` `560343b7...`, `set_launchpad` `c0019b9d...` | done, in flight | `49510585b39e6a090d3614f3ccc91508fcc944265b8ff8a7fdb19f40accf9d43`, `560343b7f5de791a2db8957ae0c4d7c6f65f5cfd9f86d7c8c82c6f364519858b`, `c0019b9d1262b8c13fdc7aa5e039761617dc06546d48fe818c28766c3adff5d3` | 09:18:48 to 09:19:18 |
| Launchpad `launch_curve` (token PDEMO) with atomic creator buy of 5 XLM (4.95 net of fee) | done (mainnet) | `fce3e87f87ade9af25b5eb7785f80ea2b19b28901773a0f19d61b2ef4acf4030` | 09:21:03 |
| Launchpad buy by a user (separate from the creator buy) | NOT YET DONE (no other buyer seen) | none | |
| Launchpad graduation (mainnet), pool and market | NOT YET DONE. PENDING (agent running) | none | |
| Launchpad on TESTNET: buy 200 XLM on curve | done (testnet) | [5dd88453...](https://stellar.expert/explorer/testnet/tx/5dd884534a941a32e85973ba5d8729d31ecfd8664e56bc074e5020e58605fdb2) | 25 Oct |
| TESTNET graduation, pool created and LP locked | done (testnet) | [b7ecae68...](https://stellar.expert/explorer/testnet/tx/b7ecae682686980929010b0bd77e88669f6d9476680c99ea368b880eb041f1b2) | |
| TESTNET graduation, market added and activated (PGRAD priced from its pool, 25% CF) | done (testnet) | add [b62e5d09...](https://stellar.expert/explorer/testnet/tx/b62e5d09ecb0b41c4dd9dedb48e927708c253a7668ef69d2e79a5084780ef957), activate [f5369f74...](https://stellar.expert/explorer/testnet/tx/f5369f748dc178ecc18e9ee793e22708479388371603f6f0effac7f1f254f03e) | |
| Control Panel update on mainnet | NOT YET DONE (no `update_risk`, `update_rates`, `apply_pending` by the deployer). On TESTNET (QA harness): staged CF change `update_risk` [3bf45208...](https://stellar.expert/explorer/testnet/tx/3bf452086b5d659b8ebe18c6f3fbdbf71510fe6ce1bbfeb769e51190b872d198), then `apply_pending` [f2380463...](https://stellar.expert/explorer/testnet/tx/f2380463c1160bfa4b972b3b16798dbcbd72fe5290e77678d7678576f257af75) | none on mainnet | |
| Vault factory deploy (mainnet) | done | `079627868c13673bc029ec2e133b35f6f0c704b87816fce47e1c9524def0c2db` | 26 Oct 10:52:48 |
| `attach_yield` XOXNO or Zenex vault to a Peridot market (mainnet) | NOT YET DONE. Both vaults are not allow-listed in the market-factory | none | |
| Vault kinds registered: Zenex, XOXNO (`set_wasm`) | done | `72eddbed6d1a9c86d359e52b2cc973e25b2ac38af629d68472002846f022d53f`, `6c57f036b326ed1cdb518e6ea624fc78a6c0265595f8b16adfb02b7303a83c32` | 10:57:53, 10:58:13 |
| XOXNO demo vault create, deposit 5 XLM, withdraw 2 XLM | done | `2b8ce5b3bdaef9c807149cfa9daf5e5bc3795b45f69fc5e98f782542602b29b9`, `71abddbea7edc02f72644cc9a86e3171b2ae2880b1e9b4ca3a3424d30ac395a5`, `320f7f44d69e70ef1dae3eea9647080cc69313b93cf7bfd8ef6596c87cf53523` | 10:59:23, 10:59:43, 10:59:58 |
| Zenex demo vault create | done (no deposit) | `8118c8cd1fc751c5f94d1919fb320dc94a7d4ef4e67b30b71ef99cc0c424977e` | 10:59:13 |
| Launchpad ICO support: upload ICO Wasm, upload factory Wasm, upgrade factory in place, `set_ico_wasm` | done (deployer) | `a86d1491fb62bc36f559d8225e8abc1d9d74efae568fdf2d824800b7cdcd0f49`, `405e9ee9ab3efde21f0f041ea948e7f438f7277b2c37a9f29c87164ac9263841`, `2df7039be8a3573548f5c88c9cb49eb3d94708647bafbc04a5fe2ab1a96bffaf`, `b572adeff883116c001fd8ecf32aa6f58640139794f4e5b9e97929ca608f0e05` | 11:28:13 to 11:28:48 |
| ICO created on mainnet | NOT YET DONE (contracts live, no ICO) | none | |
| Guardrail rejection | done as a read-only simulation (nothing sent): `market_factory.update_risk` on group 1 XLM market with CF 900000 (90%) returns `HostError: Error(Contract, #20)`, which is `CollateralFactorTooHigh = 20` in `contracts/market-factory/src/errors.rs`. The same call with CF 700000 simulates as success (`null`) | simulation, no hash | |

## 7. Fees and parameters as deployed

Read from chain where marked "chain"; otherwise from the repo file named.

| Parameter | Value | Source |
|---|---|---|
| Interest share to protocol (reserve factor) | 10% (`reserve_factor` 100000 on a 1e6 scale) on all 4 markets | chain: `market_factory.get_market_record` for each market. Guardrail maximum 50% (`guardrails.rs`) |
| Blend fee-vault take rate | 10% (`FeeModeKey.value` 1000000 on 1e7 scale, `is_apr_capped: false`); fee vault admin is the deployer | chain: instance storage of `CCHILGAY...` read via RPC. Fees accrued so far: 0 |
| DeFindex Peridot XLM vault fees | `get_fees` = [100, 5000]: 1% vault fee (100 bps), DeFindex takes 50% of that fee. Fee receiver is Peridot's prior-work key per `docs/SPECS.md` | chain: `get_fees` simulation; roles from SPECS (UNVERIFIED on chain) |
| LP vault performance fee | NOT BUILT (no Aquarius LP vault deployed) | n/a |
| Loss reserve cut and cap | NOT BUILT. Design only: reserve cut default 30% (`reserve_cut_bps` 3000) of harvested yield, cap 10% of principal (`reserve_cap_bps` 1000) | the original vault design notes (not published) line 29, design, not deployed |
| Margin fees (group 1) | Open fee 0 and close fee 0 (preview at 2x returns `close_fee_bps` 0 and `open_fee_ptokens` 0); liquidation fee 0; liquidation incentive 1.08 (pair incentive 8%); max leverage 3x group maximum; max slippage 5% (50000 on 1e6); maintenance margin 5% | chain: `margin_controller.preview_open_fees_v3`, `margin_factory.get_margin` and `get_margin_status`. Core cap on open or close fee is 5% (`core/margin-controller/src/constants.rs` `MAX_BASIS_FEE_BPS` 500). Custom per-asset margin fees: not built |
| Close factor | 50% | chain: `get_close_factor_scaled` 500000 on each group controller |
| Collateral factors | USDC 75%, XLM 70% (groups 1 to 3) | chain, market records |
| Supply and borrow caps | Group 1 USDC 10,000 / 5,000; XLM 100,000 / 50,000 (groups 1 to 3 XLM identical). Caps are required at creation (`CapRequired`), no maximum | chain, 7-decimal base units |
| Liquid (idle) buffer | 20% on all 4 markets | chain, `idle_buffer_bps` 2000 |
| Rate curves | USDC: base 0, multiplier 0.08, jump 2.0, kink 90% (stable preset; 1e6 scale 0/80000/2000000/900000). XLM groups 1 and 2: all zero (0% borrow). Group 3 XLM: stable preset | chain, `get_market_record.cfg.rates` |
| Hosted keeper price | NOT BUILT (`fund_keeper` and `keeper_mode` exist only as a design; all groups have `keeper_mode: None`, `keeper_paid_until: 0`). Real keeper cost: 0.286 XLM of fees for 244 transactions; configured cap 10 XLM per 24 h and 0.1 XLM per tx (`docs/COORDINATION.md` 07:30 entry) | chain + docs |
| Launchpad trade fee | 1% (`trade_fee_bps` 100) on the quote leg of every buy and sell; max 5% (500). `creator_fee_share_bps` 0 (max 50%). Same values on the mainnet PDEMO curve and the testnet PGRAD curve; 0.05 XLM of fee accrued so far on the mainnet curve (`fees_treasury_pending` 500000) | chain: mainnet PDEMO `get_config` and `get_state`, testnet PGRAD `get_config`; defaults in `docs/SPECS.md` Launchpad |
| Launchpad graduation target | Mainnet presets (`deployments/mainnet.json` `launchpad.presets_xlm`): Fast 500 XLM (demo preset, used by PDEMO), Standard 85,000 XLM, Slow 250,000 XLM. Testnet: Fast 25,000 per `docs/SPECS.md`; testnet demo curves PGRAD 500 XLM and PDEMO 25,000 XLM | repo + chain |
| Launchpad graduation fee | The curve payer pays the Aquarius pool-creation fee in AQUA: 300,000 AQUA on mainnet (read live, `get_standard_pool_payment_amount` 3,000,000,000,000), 1 AQUA on testnet. No extra Peridot fee beyond the 1% trade fee and an optional launch fee (0 on the testnet and mainnet launchpad factories: `launch_fee` 0) | chain |
| Creator cap | Creator buys capped at 5% of the curve supply (`creator_cap_bps` 500; max 20%) | chain, mainnet PDEMO and testnet PGRAD curve config |
| LP percentage and lock | 800,000,000 of 1,000,000,000 tokens on the curve, 200,000,000 (20% of supply) go to the Aquarius pool with all raised XLM. LP shares are sent to the all-zero account (no key), the zero-account lock is verified on testnet (mainnet not graduated yet) | chain, `get_config` (`curve_supply` 8e15, `lp_supply` 2e15 base units, same on mainnet PDEMO) and the testnet share token balance |
| Collateral factor of a graduated token | 25% preset (cap 50% for AquariusOnly pricing); leverage on pool-priced tokens capped at 2x and opt-in | `docs/DEMO-TESTNET.md`, `guardrails.rs` |
| Factory guardrails | CF 1% to 75% (Reflector) or 50% (AquariusOnly); idle buffer 10% to 100%; reserve factor 0 to 50%; at most 16 markets per group; at most 4 margin markets; group max leverage 1 to 5x; liquidation incentive 1.02 to 1.10; slippage at most 10%; liquidation fee at most 50%; reward speed at most 1e12 base units per second; staged changes (CF, price) wait 60 s; no fallback prices | `contracts/market-factory/src/guardrails.rs`, `docs/SPECS.md` Margin, `contracts/peridot-interfaces/ts/index.ts` `GUARDRAILS` |
| Rewards on group 2 | Supply speed 200 stroops per second set via `set_reward_speeds` (about 1.73 XLM per day, so 20 XLM lasts about 11 days) | `docs/DEMO-MAINNET.md` |

## 8. Live URLs, repo, CI, tests

| Item | Value | Status |
|---|---|---|
| Repo | https://github.com/joshschcom/peridot-markets (public). `main` is behind; the integrated branch is `demo-merge` (head `6b43fbd`, 26 Oct 11:38 UTC, when this was written) | verified with `gh repo view` |
| Local build | http://localhost:3010 | not checked at the final refresh (was not running earlier); run it yourself |
| Public droplet, mainnet app | http://165.22.89.201 and https://markets.peridot.finance | both HTTP 200 at 11:47 UTC; coordinator states the droplet serves the final merge (UNVERIFIED by me: the deployed-commit file was not read). `/llms.txt`, `/robots.txt` and `/sitemap.xml` return 200 as of 11:56 UTC after the redeploy; deployed commit `6b43fbd` (read from the droplet) |
| Public droplet, testnet launchpad app | https://test-markets.peridot.finance and http://testnet.165.22.89.201.sslip.io | both HTTP 200 at 11:47 UTC, same caveats |
| Vercel previews (private, Vercel-authenticated, HTTP 302 to login) | latest connected mainnet beta https://peridot-markets-preview-8ipc1f9u1-peridot3.vercel.app (source `b896c82`, before the QoL, launchpad and vault merges). Older: eg1grm094 (`20099c2`), mbm5vqtlz, q1q53sbiz (labelled mock demo, `4f92a41`) | URLs from `docs/COORDINATION.md` and `docs/DEMO.md` |
| Custom domains | https://markets.peridot.finance (mainnet) and https://test-markets.peridot.finance (testnet): HTTPS, DNS only, droplet 165.22.89.201 (per coordinator; HTTP 200 over HTTPS verified at 11:47 UTC). The `markets.peridot.xyz` name in `docs/WEB-HOSTING.md` is only an example | HTTPS reachability verified; ownership and DNS settings UNVERIFIED |
| CI (`.github/workflows/frontend-keeper.yml`) | RED. Every recent GitHub Actions run listed by `gh run list` (latest checked 11:47 UTC, on `demo-merge`, `ico-mainnet`, `xoxno-vault-mainnet`) has conclusion failure; earlier all 33 runs failed. The `frontend` job fails at the `npm ci` step on every run ("package.json and package-lock.json are not in sync", missing `typescript@4.9.5` and `utf-8-validate@5.0.10` from the lock file under the runner's Node 22); the `keeper` job passes. `npm ci` succeeds locally with npm 11, so the lock file needs regenerating with npm 10 | `gh run view 40293790524 --log-failed`. Not fixed here (app/ is not ours to change) |

Tests: the Rust and keeper results are from the run at `demo-merge` `729010e` (cargo was NOT rerun after the later ICO, XOXNO and vault-factory merges, so the Rust total may be higher now); the app result is from the final merge `6b43fbd` (results copied from the runs, not estimated):

| Suite | Result |
|---|---|
| Rust workspace, `cargo test --workspace --no-fail-fast` | 884 passed, 0 failed, 5 ignored (the reference core's own ignores) |
| per crate (passed) | receipt_vault 182, simple_peridottroller 127, aquarius_lp_vault 120 (core, not deployed), margin_controller 110, price_router_ext 55, price_router (core) 45, launchpad_curve 37, swap_adapter 32, margin_factory 25, launchpad_factory 24, lp_receipt_vault 22 (core, not deployed), market_factory 21, blend_vault_adapter 21, reward_distributor 16, zenex_vault 15, jump_rate_model 13, vault_factory 7, launchpad_token 6, mock_depth_fixture 2, peridot_token 2, mock_reflector 1, doc-test 1 |
| App, `cd app && npm test` | 206 passed, 0 failed (at `6b43fbd`) |
| Keeper, `cd keeper/liquidator/margin && npm test` | 80 tests: 79 passed, 0 failed, 1 skipped (the real-PostgreSQL integration case is skipped without `PG_INTEGRATION_TEST=true`; CI passes it) |
| App end-to-end (Playwright) | NOT RUN here. UNVERIFIED current pass count (earlier reports: 3 flows in `docs/COORDINATION.md`; specs now in `app/tests/e2e/`) |

## 9. Demo state for recording

Wallets (Horizon, as-of time):

| Wallet | Holds |
|---|---|
| Deployer `GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH` | 19.8395802 XLM (down from 247 XLM: about 181 XLM went into the launchpad deployment, the rest into ICO uploads and funding the vault key); no USDC and no trustline. It is the group owner of all 3 groups and holds the 30 XLM supply position in group 1 (a `deposit` receipt, withdrawable) |
| Keeper `GAFJVD3TKIEMIUEBJPQVZNRCG7PF25XOX7QZDRGR7Y3MNQWYQR6C2S3W` | 29.4642360 XLM |
| Peridot prod key `GDYDTMY46RNAUIIUVG6RPD2D3I3ES4J2SSXGCKIQP2OET4Q5PV75LSPL` (prior work, do not use for the demo) | 0.0000000 EURC; 4.3512407 PYUSD; 1.5242916 USDC; 8.5004461 XLM |
| Vault agents key `GDLVO6BC6NPS2UZBN2DVP2E4G57KAEGTMV2DAMOENHVVQNQNT5YI7GWP` (owner of the demo Zenex and XOXNO vaults) | 70.4618990 XLM |
| Fresh Albedo test account `GBTAM7KI53O5CMJW7QHS2TG7JX65H4Y2TGDXS42ZLJEK6YMGDBBZOOQD` (`docs/DEMO.md`) | 5.0001 XLM, no markets entered, no USDC trustline |
| Other wallets Joshua may use for the video | UNVERIFIED: no addresses of them appear in the repo |

Recommended group for the video: **group 1 "Meridian"**. Why, with evidence read at the as-of time:

- It is the only group with a real position: 30 XLM supplied (collateral value for the deployer: 3.5388 USD at 70% CF, `account_liquidity` simulation), 24 XLM routed to DeFindex.
- Borrowable now: a read-only simulation of `borrow(user = deployer, amount = 1 XLM)` on the group 1 XLM market succeeds (events `BorrowEvent` and a token transfer of 1 XLM), nothing was sent. The XLM market has 30 XLM of liquidity and a 0% borrow rate.
- Boosted cache fresh: the group 1 XLM market `BoostedHealthCache` was 28 to 71 seconds old in five reads (37 s at the final read) (limit for health checks is 300 seconds). The keeper (`GAFJ...`) is refreshing: its latest transaction was within the last 2 minutes of the as-of time on each check, cadence about every 2 minutes. The droplet itself (`165.245.251.79`) was not logged into; its liveness is inferred from those on-chain transactions.
- It has margin enabled (3x group maximum, 2 markets, Aquarius pool bound) and leaves room to add a third market live (no reward token set, so `MarketsLockedByRewards` does not apply).
- Group 2 has the claim demo but needs a wait between actions; group 3 has no keeper coverage (its boosted cache was 39,127 seconds old, so a borrow there would fail until someone calls `refresh_boosted_underlying`).

Do NOT click live (from `docs/COORDINATION.md` known issues, plus findings of this check):

1. Borrow on group 3 (stale boosted cache, no keeper). Borrow on group 1 works only while the droplet keeper runs; run `scripts/refresh_boosted_mainnet.sh` right before the borrow if in doubt.
2. Anything signed with Albedo: Albedo signing of Soroban `invokeHostFunction` envelopes is UNVERIFIED (`docs/COORDINATION.md` 01:10 entry). Use Freighter for the recording unless one real Albedo signature has been tested first.
3. Two consecutive actions on group 2 (rewards): about every second transaction fails with `storage exceeded_limit` on `SupplyIndex` when the simulation lands in the same ledger as the previous accrual. Wait about 10 seconds between actions, or avoid group 2 in the live take.
4. Margin open: the app signs `transfer_spot_to_margin` before knowing `begin_open` passes the pool-versus-oracle deviation band. Check the pool against the oracle first. No margin position has ever been opened on mainnet. Shorts need USDC liquidity, which the USDC market does not have (0 supplied): do not demo shorts. The USDC market has no supply and nobody holds USDC.
5. Raw contract errors still reach users for supply above cap, paused market, duplicate token and early margin apply (`Error(Contract, #N)`), and `/groups/99` dumps a raw event log (`docs/qa/FINDINGS.md` item 6). Do not trigger error paths live except the 90% CF guardrail, which has a clean message in the Control Panel.
6. Do not claim Aquarius LP vault, Zenex, XOXNO or hosted keeper as live.
7. Wallet network mismatch: the app now has a Mainnet/Testnet switch in the header (merged after the earlier screenshots); launchpad pages need the testnet app. Keep the mainnet and testnet apps in separate browser tabs.
8. RPC: `mainnet.sorobanrpc.com` timed out in earlier sessions (`docs/COORDINATION.md` 22:30); the app is configured with the gateway.fm RPC. Record with a warm connection.
9. Keeper operations: never `systemctl restart` the keeper while a transaction is in flight (`docs/COORDINATION.md` operator note).
10. The mainnet launchpad was being deployed while this was written. Do not Launch or Buy on mainnet live unless the deploying agent has finished and reported; graduation needs 300,000 AQUA, which nobody holds. Show graduation from the testnet PGRAD run.
11. Vaults page copy lags the chain: it labels the XOXNO and Zenex vault kinds "Testnet, customizable" and says XOXNO is "testnet only, nothing on mainnet", while demo vaults of both kinds exist on mainnet (not connected to any market). Do not read that page's wording as a claim about mainnet.
12. CI badge: do not show the GitHub Actions page as proof of green tests (section 8).

## 10. Known limitations, core changes, new and unaudited contracts

Changes to the audited core (`core/CORE_DIFF.md`): the only code change is eight timelock constants (upgrade timelock 24h to 60s in `simple-peridottroller`, `receipt-vault`, `margin-controller`, `swap-adapter`, `jump-rate-model`, `aquarius-lp-vault`, `price-router`, and the admin-parameter delay 24h to 60s in `simple-peridottroller`). Reference: Peridot-Soroban `leveraged-fix` at `47858c1a13c2588970395faa2212e7b68bd33060`, imported unmodified in `3833c42`, constants changed in `206cf00`. OpenZeppelin stellar-contracts pinned at `3f81125` (v0.7.1), unmodified. The core Wasm bakes in its initial admin at compile time, so Wasm for mainnet was built with the market-factory address as admin (`scripts/build_core.sh`); this is how the audited code works, not our change. Later commits may add to this: UNVERIFIED that no other `core/` file changed after `206cf00` (check `git diff 206cf00 HEAD -- core/` before saying "only timelocks").

New and unaudited (written during the event, deployed on mainnet): market-factory, margin-factory, price-router-ext, reward-distributor, blend-vault-adapter. New and unaudited, live on mainnet since 26 Oct (launchpad 09:17 to 09:21 UTC, ICO Wasm 11:28 UTC, vault factory and demo vaults 10:52 to 10:59 UTC): launchpad-token, launchpad-curve, launchpad-factory, the ICO contract, vault-factory, the XOXNO vault and the Zenex vault (the XOXNO vault had a Codex review recorded as "GO x2" in `deployments/mainnet.json`; not an audit). New and unaudited, TESTNET only: vault-factory, zenex-vault (against a mock Zenex). The frontend and the keeper are also new or adapted code. The audit covers the imported core only (`docs/PRIOR_WORK.md`: "does not extend an existing audit to new factories, adapters, frontend changes or operations code"). Pre-mainnet second opinion by Codex found 7 issues, all fixed and re-reviewed (`docs/COORDINATION.md` 15:00 and 15:45 entries). The Peridot Blend fee-vault Wasm is built from script3/fee-vault `1ab9835` and is not byte identical to an upstream release (`docs/DEMO-MAINNET.md`).

Known limitations:

- Codex second opinion on the mainnet launchpad and market-factory upgrade (`docs/qa/CODEX-LAUNCHPAD-MAINNET.md`, 26 Oct, no blockers for the upgrade and the 5 XLM demo token) left three HIGH findings open, all about graduated lending markets, not the deployment: (1) the AquariusOnly price step guard accepts any move once its anchor is older than 300 s, so a trader could move the pool, call permissionless `cache_price`, liquidate and reverse, and a creator can raise the collateral factor to 50% and the caps after `claim_group`; remediation (TWAP or persistence) is not done; (2) the 500 XLM demo preset gives a quote side of about 84 USD, below the price router's 500 USD per side floor, so a graduated market from that preset would be unpriceable (supply works, borrowing is blocked); (3) the factory admin can replace a curve's Wasm immediately (`upgrade_launch`), so a compromised admin key could take curve reserves. Medium items: sticky `Graduatable` lets sellers empty the raise after the target; a pool pre-seeded at another ratio can block graduation.
- The market-factory was upgraded in place on mainnet (`a5442cae...` to `baec971c...`); rollback restores the code only. Existing groups keep their old price routers.

- Rewards lock the market list: once a group has a reward token, no market can be added (audited-core re-entry). Enable rewards last.
- Core upgrades and parameter changes use 60 s timelocks instead of 24 h (hackathon setting).
- Boosted-vault (DeFindex, Blend) health cache must be refreshed at least every 5 minutes or borrows revert; this depends on the keeper or a manual refresh.
- Margin: Long and Short are both capped with the margin asset's CF, so after a CF drop the chain still allows a raw 3x long that only the app's quote blocks (documented MEDIUM, `docs/COORDINATION.md` 03:30 entry). Margin needs 7-decimal assets, at most 4 margin markets per group.
- Launchpad: testnet only; public mainnet token sales need legal review (MiCA); each curve is upgradeable by the factory admin; AquariusOnly price needs a keeper poke at least every 150 s (roadmap); spot price in a pool can be manipulated, mitigated by the 50% CF cap, depth floor and step guard.
- The graduation fee of 300,000 AQUA is paid by the graduating payer; on mainnet this is the main cost of graduation.
- Third-party admin keys (Aquarius router and pool kill switches) can affect locked LP (`docs/SPECS.md`).
- Albedo Soroban signing UNVERIFIED; fresh-wallet acceptance run NOT DONE; real margin open and close NOT DONE on mainnet.
- Intake milestones 1.2, 1.3, 1.4 (Aquarius LP vault, loss reserve, range keeper) are "Not started" in `docs/MILESTONES.md`; do not present them as delivered.
- Dependency audit of Wallets Kit: 29 transitive findings (12 low, 6 moderate, 11 high), `docs/DEMO.md`.

## 11. Screenshots (1440x900, `docs/assets/`)

Generator: `node scripts/pitch_screenshots.mjs --build` (first time) or without `--build`. It builds `app/` three ways: mainnet real data, testnet real data, and mock mode, loads pages without a wallet (nothing is signed), and writes `docs/assets/pitch-<id>.png` plus `docs/assets/pitch-screenshots.json`. Captured at the as-of time against the app built from `demo-merge` `729010e` (later commit `0ec6d9a` only adds XOXNO files).

| File | Shows | Data | Captured (UTC) | Result |
|---|---|---|---|---|
| `docs/assets/pitch-landing.png` | Landing page hero (home story, new illustration group YOURTOKEN is an illustration, not a real group) | real mainnet data (read-only, no wallet) | 2026-10-26T11:48:41Z | ok |
| `docs/assets/pitch-groups.png` | Groups directory: the three live mainnet groups | real mainnet data (read-only, no wallet) | 2026-10-26T11:48:51Z | ok |
| `docs/assets/pitch-group.png` | Group 1 Meridian page: markets, yield routes, caps | real mainnet data (read-only, no wallet) | 2026-10-26T11:49:03Z | ok |
| `docs/assets/pitch-vaults.png` | Vault options panel (/vaults) | real mainnet registry data (read-only) | 2026-10-26T11:49:16Z | ok |
| `docs/assets/pitch-leverage.png` | Group 1 Leverage tab | real mainnet data (read-only, no wallet) | 2026-10-26T11:49:31Z | ok |
| `docs/assets/pitch-control.png` | Real Control Panel for group 1 (read-only without the owner wallet): staged changes, leverage sync, market list | real mainnet data (read-only, no wallet) | 2026-10-26T11:49:46Z | ok |
| `docs/assets/pitch-wallet-modal.png` | Wallet picker modal opened from Connect wallet | real mainnet app, no wallet connected (modal only) | 2026-10-26T11:50:09Z | ok |
| `docs/assets/pitch-network-menu.png` | Network pill menu (Mainnet / Testnet switch) | real mainnet app (menu only) | 2026-10-26T11:50:19Z | ok |
| `docs/assets/pitch-launch-chooser.png` | Launchpad launch chooser: Simple, Curve and ICO side by side | real mainnet app (read-only, nothing submitted) | 2026-10-26T11:50:28Z | ok |
| `docs/assets/pitch-wizard-market.png` | Launch wizard, markets step with a market card | MOCK mode (demo banner, no chain) | 2026-10-26T11:50:41Z | ok |
| `docs/assets/pitch-wizard-review.png` | Launch wizard review step listing every transaction | MOCK mode (demo banner, no chain) | 2026-10-26T11:50:44Z | ok |
| `docs/assets/pitch-control-guardrail.png` | Control Panel rejecting a 90% collateral factor | MOCK mode (demo banner, no chain); same guardrail as the on-chain CollateralFactorTooHigh error | 2026-10-26T11:50:51Z | ok |
| `docs/assets/pitch-control-mock.png` | Control Panel in demo mode: a staged collateral-factor change and the change history | MOCK mode (demo banner, no chain) | 2026-10-26T11:50:56Z | ok |
| `docs/assets/pitch-token-before.png` | Launched token still on its bonding curve (PDEMO), before graduation | real TESTNET data (read-only) | 2026-10-26T11:51:02Z | ok |
| `docs/assets/pitch-token-after.png` | Graduated token (PGRAD): Aquarius pool, locked LP, own market group | real TESTNET data (read-only) | 2026-10-26T11:51:17Z | ok |
| `docs/assets/pitch-token-mainnet.png` | Mainnet PDEMO token page on its bonding curve (not graduated) | real mainnet data (read-only); PDEMO launched 26 Oct 09:21 UTC, still on its curve | 2026-10-26T11:54:49Z | ok |

All shots were taken at 11:5x UTC against the app built from `demo-merge` `6b43fbd` (final merge: wallet picker modal, runtime network switch, new home page, simple token, ICO in the launch chooser, vault factory UI, QoL port). Not captured: the token picker (still in progress per the coordinator) and any ICO page on mainnet (no mainnet ICO exists). Real versus mock: `landing`, `groups`, `group`, `vaults`, `leverage`, `control`, `wallet-modal`, `network-menu`, `launch-chooser`, `token-mainnet` load the live mainnet app without a wallet (real mainnet data, read-only; `control` is the owner-only panel in read-only form with empty history because the factory history window is the latest 1,000 ledgers; the landing hero's group "YOURTOKEN" is an illustration, not a real group); `token-before` and `token-after` read the real TESTNET launchpad; `wizard-market`, `wizard-review`, `control-guardrail`, `control-mock` run in explicit mock mode (demo banner, no chain; the 90% rejection text is the app's client-side guardrail message, the on-chain equivalent is error `#20`). No wallet-connected view was captured. The `vaults` page text says XOXNO and Zenex are testnet while mainnet demo vaults exist (copy lags the chain).

## 12. UNVERIFIED items and what would verify them

| Item | What would verify it |
|---|---|
| Which commit the droplet apps (165.22.89.201) serve | `ssh` the droplet and read `/etc/peridot-web/deployed-commit` |
| Keeper droplet `165.245.251.79` health and status endpoint | `curl http://127.0.0.1:8788/status` on the droplet. On-chain evidence of liveness (keeper txs every ~2 min) is verified |
| Fee receiver of the DeFindex Peridot XLM vault is `GDYDTMY4...` | `get_fee_receiver()` simulation on `CCB2AR5X...` (not run) |
| Only the eight timelock constants differ in `core/` today | `git diff 206cf00 HEAD -- core/ ':!core/CORE_DIFF.md'` |
| Playwright end-to-end pass count | `cd app && npm run test:e2e` on an idle machine |
| Albedo signs Soroban envelopes | One real Albedo signature on testnet |
| Custom domain exists | Joshua confirms domain ownership and runs `peridot-set-domain` |
| Anything deployed on mainnet after 11:47 UTC (graduation, ICO creation, Aquarius ladder vault, market binding of the new vaults) | Rerun `node scripts/pitch_facts_refresh.mjs` (it reads `launchpad_factory` from the manifest) and update sections 2 to 6 |
| Droplet serves the final merge; llms.txt, robots.txt, sitemap.xml | VERIFIED 11:56 UTC: all three return 200 on both domains; deployed commit 6b43fbd. Rerun `curl` after any later redeploy |
| Cargo test count after the ICO, XOXNO and vault-factory merges | `cargo test --workspace --no-fail-fast` (not rerun after 729010e) |
| Zenex constructor simulated against the real Zenex | Re-run the simulation described in `deployments/mainnet.json` `zenex.constructor_simulation` |
| Any wallet Joshua will use on camera besides the deployer | Joshua gives the address; `--only=wallets` reads it |
