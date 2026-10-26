# Peridot Markets: pitch facts (verified only)

**As of: __ASOF_UTC__ (UTC) = __ASOF_LISBON__ (Europe/Lisbon). Lisbon is on WET (UTC+0) from Sunday 25 Oct 2026 01:00 UTC, so Lisbon time equals UTC for the whole event.** Mainnet ledger __ASOF_LEDGER__.
Repo head this was written against: `__HEAD__` on branch `pitch-facts` (merged with `origin/demo-merge` `729010e`). Repo: https://github.com/joshschcom/peridot-markets (public).

How to read this file (for the deck and video LLM):

- Every number is either read from the Stellar public network (Horizon, Soroban RPC, read-only simulations, nothing was sent or spent) or comes from a file in this repo, with the path or commit cited.
- `UNVERIFIED` means no evidence was found. `NOT YET DONE` means the thing is not on mainnet today. `PENDING (agent X running)` means another team agent is building or deploying it right now and it is not in `deployments/mainnet.json` yet.
- Do not say a PENDING or NOT YET DONE item is live. Do not round the money: the mainnet deposits are tiny beta amounts (see section 5).
- Refresh the numeric tables right before recording: `node scripts/pitch_facts_refresh.mjs` (read-only, prints markdown tables). Screenshots: `node scripts/pitch_screenshots.mjs`.
- Timestamps in `docs/COORDINATION.md` entries signed `[A]` and labelled "WET" run about one hour ahead of git and chain time (example: "READY: mainnet phase-1, 17:00 WET" while the phase-1 commit is 16:02:37 UTC and the on-chain transactions end at 16:01:48 UTC). This file uses chain and git timestamps only. `[B]` entries use UTC and agree with the chain.

## 0. One-paragraph truth

Peridot Markets is a factory that gives any Stellar token its own isolated money market group (lending, borrowing, optional leverage, optional own-token rewards) on top of Peridot's audited lending core, with idle liquidity optionally routed into DeFindex or Blend. Phase 1 is live on Stellar mainnet since Sunday 25 Oct 2026 15:36 to 16:01 Lisbon (Blend route 16:51 to 16:53): 3 groups, 4 markets, 21 contracts, DeFindex and Blend routes, margin enabled on group 1, a funded rewards group with a real claim. The token launchpad (bonding curve, Aquarius graduation) is verified end to end on TESTNET only; it is not on mainnet. No borrow, no margin position and no Control Panel edit has happened on mainnet yet. Phases 2, 3 and 4 are not tagged.

## 1. Phases

Only one git tag exists: `phase-1` (annotated tag object `590a2f0779c86904e98b70959b655f7c7d4076bf`, points at commit `3bf79b5ae7fe3ff8a9923214d776d955837e7ee1`, tagger time 2026-10-25 16:02:30 UTC = 16:02:30 Lisbon; pushed to origin, verified with `git ls-remote --tags origin`). Phase definitions: `docs/handoff/00-DROPOFF.md` section 1.

| Phase | Planned scope (00-DROPOFF.md) | Shipped to mainnet | Not shipped | Tag / commit | Mainnet deploy time (Lisbon) |
|---|---|---|---|---|---|
| 1 MVP | Factory, per-market rates incl. 0%, CF, caps, buffers, Reflector pricing, routes None/DeFindex/Blend, own reward token, margin via audited margin-controller, Control Panel, frontend, liquidator | market-factory + margin-factory, groups 1 to 3, 4 markets, DeFindex route (group 1 XLM), Blend route (group 3 XLM), rewards (group 2, 20 XLM funded, one real claim), margin enabled on group 1 (3x max, Aquarius XLM/USDC pool allowlisted and bound), keeper on a droplet for group 1 (refresh and interest only) | A borrow tx, a margin open or close tx, a Control Panel edit tx, a fresh-wallet acceptance run (all NOT YET DONE on mainnet; see section 6). Rewards group cannot take a new market after rewards are set (audited-core re-entry limit, documented in `docs/SPECS.md` Factory) | tag `phase-1`, commit `3bf79b5`. Blend route came after the tag: commit `09cc9ec` (2026-10-25 16:54:04 UTC) | First mainnet tx (upload market-factory Wasm) 15:36:23; market-factory created 15:36:33; group 1 created 15:40:08; margin-factory 15:50:58 to 15:56:28; rewards group and claim 15:56:58 to 16:00:03; tag 16:02:30; Blend fee vault and group 3 16:51:08 to 16:53:43 |
| 2 Aquarius | Aquarius LP vault with loss reserve, self-hosted keeper harvesting AQUA | Nothing from the Aquarius LP vault. The self-hosted keeper (liquidation, boosted-vault refresh, interest accrual) runs on a DigitalOcean droplet for group 1 since 2026-10-26 06:30:23 (first keeper tx) | Aquarius LP vault with loss reserve (no `aquarius-loss-reserve` crate in the workspace; the factory rejects any route other than None, DeFindex, Blend: `contracts/market-factory/src/lib.rs` line 409), AQUA harvest. The core `aquarius-lp-vault` crate is imported prior work, not deployed by this project. In flight, not merged into `demo-merge`: an `aquarius-vault` crate (laddered concentrated liquidity, 14 unit tests, commit `a284dfd` on branch `vault-factory`), PENDING (agent running) | No tag | NOT YET DONE. The /vaults page labels the Aquarius LP vault "Demo flow" (see screenshot) |
| 3 Price + custom margin + Zenex + launchpad curve | Aquarius guard pricing, custom margin, Zenex route, launchpad bonding curve | On TESTNET only: AquariusOnly pricing (`contracts/price-router-ext`, 55 tests), launchpad token + curve + factory with Aquarius graduation, plain simple token. Mainnet: PENDING (launchpad on mainnet, agent running; not in `deployments/mainnet.json`) | `ReflectorWithAquariusGuard` (rejected `UnsupportedMode`), custom margin (`docs/PRIOR_WORK.md`: "Phase 3 has not started. No custom-margin diff is claimed"), Zenex route on mainnet. A `zenex-vault` crate now exists in `contracts/zenex-vault` (tests, merged in `729010e`) and is deployed on TESTNET against a MOCK Zenex (Zenex has no testnet, `deployments/testnet.json` `zenex.note`); mainnet PENDING (agent running) | No tag. Launchpad stages: `d0bbdc4` (stage 1), `3d4b983` (stage 2 graduation), `3974d73` (LP lock by transfer to the zero account) | No mainnet deploy. Testnet graduation run recorded in `docs/DEMO-TESTNET.md` (25 Oct) |
| 4 More routes + hosted keeper | XOXNO adapter, hosted keeper with on-chain funding, switch yield route, CL range, ICO | Nothing on mainnet. Group 1 keeper is team-run, not a paid hosted service (`keeper_mode` is `None` on all 3 groups, read on chain) | XOXNO (branch `xoxno-vault`, not merged into `demo-merge`: unit tests against a mock controller and a testnet Wasm, latest commit `a42d252`; PENDING, agent running), hosted keeper subscription, switch_yield, ICO (`docs/SPECS.md`: "The ICO is not built"). The generic vault-factory (create-vault form in the app, `f0aa1f2`; contract `2ae9d78`) is merged and deployed to TESTNET only | No tag | NOT YET DONE |

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

External contracts our contracts call (all exist on chain): Reflector external CEX/DEX feed `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` (prices the markets, symbol keyed), Reflector Stellar-assets feed `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` (allowlisted, not used by the three live groups), Aquarius router `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK`, Aquarius XLM/USDC pool used for margin `CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV`, Blend Fixed V2 pool `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`, DeFindex Peridot XLM vault `CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK` (an existing Peridot vault from prior work, Wasm `ae3409a4...`), USDC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`, XLM `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA`.

Wasm hashes registered in the factory (`deployments/mainnet.json` `wasm`, matched against the live instances): receipt vault `8cc9f723...`, controller `dabe8d1c...`, jump rate `4052162e...`, price router `e04a63e0...`, reward distributor `2e5790ce...`, swap adapter `2640f364...`, margin `f11f34e7...`, blend adapter `4a5b6d2c...`.

Not on mainnet (none of these IDs exist in `deployments/mainnet.json`):

| Item | Status |
|---|---|
| Launchpad factory, token, bonding curve, ICO | PENDING (agent running) for factory/token/curve. ICO: not built. On TESTNET: factory `CBYQC54BS5HIWEO6KQNVGZ6XRNOTG3OMT6UZYBUD2NESGHBQMALGSBWC` (`deployments/testnet.json`) |
| Market-factory and price-router upgrade for graduation (AquariusOnly pricing, `set_launchpad`) | PENDING (agent running). The mainnet market-factory today still has the pre-launchpad code path |
| Vault factory | PENDING on mainnet (agent running). TESTNET only: `CAORI4VMNA655LG3JD4B253YW74VIJ6L4ZXCSFL6R54S75GR746X2JUE` (`deployments/testnet.json`) |
| Zenex vault | PENDING on mainnet (agent running). TESTNET only against a MOCK Zenex: vault `CCORKRU7JLYZWB7IFGWEZINOUNJZAFMMYX3OPEBJBYMAZCVSJ6UHONCB`, market `CD4CBEJ7NMCKT7P5EOHJVWAVVJVIIVU2G76XGLOJKHO4CSM3BPJKDOBD` (`deployments/testnet.json`) |
| Aquarius LP vault adapter, XOXNO vault | PENDING (agents running; branches `vault-factory` (aquarius-vault crate) and `xoxno-vault` not merged into `demo-merge`). Not deployed on mainnet |
| Core price router, aquarius-lp-vault, peridot-token | Not deployed by this project |

## 3. Counts during the event (mainnet)

Event window start: 2026-10-25 09:00 Lisbon = 09:00 UTC (`docs/PRIOR_WORK.md`: build window begins 25 October 2026 at 09:00 Lisbon). Snapshot below is as of the as-of time; the keeper currently adds about 80 transactions an hour (166 in its first two hours), so rerun the script for current numbers.

| Metric | Value | Method |
|---|---|---|
| Market groups created | 3 (Meridian, Rewards, BlendDemo) | `market_factory.group_count()` simulated on chain, plus `group_created` events |
| Markets | 4 (USDC and XLM in group 1, XLM in group 2, XLM in group 3) | `get_group(g).markets` for g = 1 to 3 |
| Groups with margin | 1 (group 1, 2 margin-enabled markets) | `margin_factory.get_margin(1..3)`; groups 2 and 3 return null |
| Contracts deployed | 21 | 3 direct `create_contract` ops by the deployer (market-factory, margin-factory, Blend fee vault; Horizon operations) + 18 created by the factories (3 group controllers, 3 price routers, 4 market receipt vaults, 4 jump-rate models, 1 reward distributor, 1 Blend adapter, 1 margin controller, 1 swap adapter), each confirmed to exist on chain |
| Wasm uploads | 11 | Horizon operations of the deployer with function type upload |
| Transactions sent by the deployer `peridot-mainnet-admin` (`GC3FLITV3...`) | 72 sent since 15:36:23 on 25 Oct (71 successful, 1 failed on chain: a classic 75 XLM funding payment, not a protocol call). 70 are Soroban invocations or uploads, 1 account creation, 1 payment | Horizon `/accounts/{id}/transactions` with `include_failed=true`, filter `source_account = address`, created at or after the event start |
| Transactions sent by the keeper `peridot-mainnet-keeper` (`GAFJVD3T...`) | 166 at the as-of snapshot, all successful (57 `refresh_boosted_underlying`, 109 `update_interest`), first 2026-10-26 06:30:23, fees paid 0.195 XLM in total | same method |
| Total sent by the two addresses built for this project | 238 (237 successful) | 72 + 166 |
| Transactions sent by the Peridot production key `peridot-mainnet` (`GDYDTMY4...`) | 580 since event start (576 successful): 423 `cache_price`, 69 `refresh_boosted_underlying`, 67 `update_interest`, 8 `bump_user_borrow_ttl`, 3 `withdraw`, plus classic ops. These are Peridot's pre-existing production lending core (prior work), NOT Peridot Markets. Do not count them as event work | same method |
| Total including the prior-work key | 818 | 72 + 166 + 580. Use 238 for "transactions we sent for Peridot Markets" |
| Fees paid by the deployer | 477.86 XLM charged in total (includes Soroban rent for Wasm uploads and contract storage) | sum of `fee_charged` over the 72 transactions |
| Tokens launched on mainnet | 0. PENDING (agent running). Testnet: launchpad factory `launch_count` is 2 (PDEMO, PGRAD) plus plain token SIMPL | `launchpad_factory.config()` on testnet; mainnet has no launchpad contract |
| Tokens graduated on mainnet | 0. PENDING. Testnet: 1 (PGRAD, pool `CBZADNRMC7O6IL344YXEIB3PBD2PPAJLHHI5KWJORWXJR67UNOUUTO3G`) | `get_graduation()` on the PGRAD curve: `claimed: true`, `group_id: 1` |
| Third-party users | None found. The only supplier on all four markets is the deployer; zero borrows, zero margin positions (every `mint`, `burn`, `redeem`, `borrow_event` event of every group contract since 15:40 on 25 Oct comes from the deployer) | Soroban RPC `getEvents`, 96 events scanned |

## 4. Integrations actually live on mainnet

| Partner | Status | One tx hash as proof | Notes |
|---|---|---|---|
| Reflector | LIVE on mainnet | [8341a38f...](https://stellar.expert/explorer/public/tx/8341a38f2efa8f90961cf779c0d3aa654249a8062d552f681ccddae6ebae0295): `activate_market` USDC, binds the Reflector feed to the market (token, oracle, asset tuple allowlisted by `set_price_feed_allowed`) | All 4 markets are priced `ReflectorOnly` on the external feed (read at as-of time: XLM and USDC prices returned by `lastprice`). The Stellar-assets feed is allowlisted but unused |
| Aquarius | PARTIAL. Live as the margin swap venue (pool allowlisted and bound for group 1). No swap has run through it, because no margin position exists. LP vault: not built. Launchpad graduation into an Aquarius pool: testnet only | [a994a43a...](https://stellar.expert/explorer/public/tx/a994a43ae8d0a0a485fcd3508fe57ad9d700512566d4baa282639030bee58497): `set_pool_binding`, XLM/USDC pool `CBBMQBNH...`. Testnet graduation: [b7ecae68...](https://stellar.expert/explorer/testnet/tx/b7ecae682686980929010b0bd77e88669f6d9476680c99ea368b880eb041f1b2) | Aquarius pool creation fee read live on mainnet: `get_standard_pool_payment_amount` = 3,000,000,000,000 base units of AQUA (300,000 AQUA) |
| Blend | LIVE on mainnet (group 3, via Peridot-administered fee vault and the Blend adapter) | [9af448d3...](https://stellar.expert/explorer/public/tx/9af448d3603385adddacba91b103dbeda8c67946fd32c76090be8bb319658db9): supply 5 XLM, 4 XLM sent to Blend (adapter value 39,999,999 stroops) | Position was withdrawn in full ([0dafc04e...](https://stellar.expert/explorer/public/tx/0dafc04e651ff663e1a0b8bfe47823d29d7218110ba0c1e3e32a5b33e7fc991c)); today the adapter holds 0 (section 5) |
| DeFindex | LIVE on mainnet (group 1 XLM market attached directly to the existing Peridot XLM DeFindex vault) | [a6a5a1fa...](https://stellar.expert/explorer/public/tx/a6a5a1fa7f953dbae5b1b0cb4ae4513cdc3ccc420c4d0f73e0c61686e81b08a8): supply 5 XLM, 80% routed to the vault | The vault is Peridot's own prior-work vault, not a new vault created by this project. Currently holds 24 XLM from our market |
| Zenex | TESTNET ONLY (against a MOCK Zenex, because Zenex has no testnet). Not on mainnet. PENDING (agent running) | testnet: [cabee19f...](https://stellar.expert/explorer/testnet/tx/cabee19f28a4851f79ec5d6ff312e7b0a80a9e55354c511b7f538b7b9fca886a) `deposit` into the Zenex vault (hash from `deployments/testnet.json` `zenex.txs`; not re-checked on testnet) | Real Zenex exists on mainnet only (`docs/handoff/11-ADDRESSES.md`). Do not say Zenex is integrated on mainnet |
| XOXNO | NOT LIVE. In progress on branch `xoxno-vault` (not merged into `demo-merge`; unit tests against a mock controller, a testnet Wasm). PENDING (agent running) | none | Listing a token on XOXNO Lending is owner-only governance (`docs/SPECS.md`, XOXNO section); do not claim graduation into XOXNO |

## 5. Value routed (read on chain at the as-of time; tiny beta amounts)

Prices from the Reflector external feed read at the as-of time (XLM __PX_XLM__ USD, USDC __PX_USDC__ USD).

| Where | Token amount | USD |
|---|---|---|
| Supplied to our four markets in total (all by the deployer) | 30 XLM (group 1 XLM market) | __USD_SUPPLIED__ |
| Of which routed into DeFindex (Peridot XLM vault, held by the group 1 XLM market): vault shares 239,943,636, worth 24.0000000 XLM | 24 XLM (idle buffer 20% stays in the market: 6 XLM) | __USD_DEFINDEX__ |
| Routed into Blend (group 3 adapter via the fee vault): shares 0 | 0 XLM | 0 |
| Borrowed from our markets | 0 | 0 |
| Group 2 reward distributor balance (reward token XLM) | 19.9983 XLM available of 20 XLM funded, 0.0017 XLM paid out (one claim) | about 3.37 |
| Aquarius liquidity locked by graduations, mainnet | 0 (no mainnet graduation). PENDING (agent running) | 0 |
| Aquarius liquidity locked by the PGRAD graduation, TESTNET (not real money) | 500 XLM and 200,000,000 PGRAD seeded; 3,162,277,660,168 LP shares sit at the all-zero account `GAAAA...AWHF` (token `balance` read on testnet equals the curve's `lp_shares_burned`) | testnet tokens |

Honest framing for the pitch: total value in the mainnet markets is about 30 XLM, roughly 5 USD. The product is live and verifiable; there is no TVL to brag about yet.

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
| Launchpad launch / buy / graduation (mainnet) | NOT YET DONE. PENDING (agent running) | none | |
| Launchpad on TESTNET: buy 200 XLM on curve | done (testnet) | [5dd88453...](https://stellar.expert/explorer/testnet/tx/5dd884534a941a32e85973ba5d8729d31ecfd8664e56bc074e5020e58605fdb2) | 25 Oct |
| TESTNET graduation, pool created and LP locked | done (testnet) | [b7ecae68...](https://stellar.expert/explorer/testnet/tx/b7ecae682686980929010b0bd77e88669f6d9476680c99ea368b880eb041f1b2) | |
| TESTNET graduation, market added and activated (PGRAD priced from its pool, 25% CF) | done (testnet) | add [b62e5d09...](https://stellar.expert/explorer/testnet/tx/b62e5d09ecb0b41c4dd9dedb48e927708c253a7668ef69d2e79a5084780ef957), activate [f5369f74...](https://stellar.expert/explorer/testnet/tx/f5369f748dc178ecc18e9ee793e22708479388371603f6f0effac7f1f254f03e) | |
| Control Panel update on mainnet | NOT YET DONE (no `update_risk`, `update_rates`, `apply_pending` by the deployer). On TESTNET (QA harness): staged CF change `update_risk` [3bf45208...](https://stellar.expert/explorer/testnet/tx/3bf452086b5d659b8ebe18c6f3fbdbf71510fe6ce1bbfeb769e51190b872d198), then `apply_pending` [f2380463...](https://stellar.expert/explorer/testnet/tx/f2380463c1160bfa4b972b3b16798dbcbd72fe5290e77678d7678576f257af75) | none on mainnet | |
| Guardrail rejection | done as a read-only simulation (nothing sent): `market_factory.update_risk` on group 1 XLM market with CF 900000 (90%) returns `HostError: Error(Contract, #20)`, which is `CollateralFactorTooHigh = 20` in `contracts/market-factory/src/errors.rs`. The same call with CF 700000 simulates as success (`null`) | simulation, no hash | |

## 7. Fees and parameters as deployed

Read from chain where marked "chain"; otherwise from the repo file named.

| Parameter | Value | Source |
|---|---|---|
| Interest share to protocol (reserve factor) | 10% (`reserve_factor` 100000 on a 1e6 scale) on all 4 markets | chain: `market_factory.get_market_record` for each market. Guardrail maximum 50% (`guardrails.rs`) |
| Blend fee-vault take rate | 10% (`FeeModeKey.value` 1000000 on 1e7 scale, `is_apr_capped: false`); fee vault admin is the deployer | chain: instance storage of `CCHILGAY...` read via RPC. Fees accrued so far: 0 |
| DeFindex Peridot XLM vault fees | `get_fees` = [100, 5000]: 1% vault fee (100 bps), DeFindex takes 50% of that fee. Fee receiver is Peridot's prior-work key per `docs/SPECS.md` | chain: `get_fees` simulation; roles from SPECS (UNVERIFIED on chain) |
| LP vault performance fee | NOT BUILT (no Aquarius LP vault deployed) | n/a |
| Loss reserve cut and cap | NOT BUILT. Design only: reserve cut default 30% (`reserve_cut_bps` 3000) of harvested yield, cap 10% of principal (`reserve_cap_bps` 1000) | `docs/handoff/01-VAULT-AQUARIUS.md` line 29, design, not deployed |
| Margin fees (group 1) | Open fee 0 and close fee 0 (preview at 2x returns `close_fee_bps` 0 and `open_fee_ptokens` 0); liquidation fee 0; liquidation incentive 1.08 (pair incentive 8%); max leverage 3x group maximum; max slippage 5% (50000 on 1e6); maintenance margin 5% | chain: `margin_controller.preview_open_fees_v3`, `margin_factory.get_margin` and `get_margin_status`. Core cap on open or close fee is 5% (`core/margin-controller/src/constants.rs` `MAX_BASIS_FEE_BPS` 500). Custom per-asset margin fees: not built |
| Close factor | 50% | chain: `get_close_factor_scaled` 500000 on each group controller |
| Collateral factors | USDC 75%, XLM 70% (groups 1 to 3) | chain, market records |
| Supply and borrow caps | Group 1 USDC 10,000 / 5,000; XLM 100,000 / 50,000 (groups 1 to 3 XLM identical). Caps are required at creation (`CapRequired`), no maximum | chain, 7-decimal base units |
| Liquid (idle) buffer | 20% on all 4 markets | chain, `idle_buffer_bps` 2000 |
| Rate curves | USDC: base 0, multiplier 0.08, jump 2.0, kink 90% (stable preset; 1e6 scale 0/80000/2000000/900000). XLM groups 1 and 2: all zero (0% borrow). Group 3 XLM: stable preset | chain, `get_market_record.cfg.rates` |
| Hosted keeper price | NOT BUILT (`fund_keeper` and `keeper_mode` exist only as a design; all groups have `keeper_mode: None`, `keeper_paid_until: 0`). Real keeper cost: 0.195 XLM of fees for 166 transactions; configured cap 10 XLM per 24 h and 0.1 XLM per tx (`docs/COORDINATION.md` 07:30 entry) | chain + docs |
| Launchpad trade fee | 1% (`trade_fee_bps` 100) on the quote leg of every buy and sell; max 5% (500). `creator_fee_share_bps` 0 on the PGRAD curve (max 50%) | chain, TESTNET PGRAD curve `get_config`; defaults in `docs/SPECS.md` Launchpad |
| Launchpad graduation target | Presets Fast 25,000 XLM, Standard 85,000, Slow 250,000 (`docs/SPECS.md`). Testnet demo curves: PGRAD 500 XLM, PDEMO 25,000 XLM | repo + testnet chain |
| Launchpad graduation fee | The curve payer pays the Aquarius pool-creation fee in AQUA: 300,000 AQUA on mainnet (read live, `get_standard_pool_payment_amount` 3,000,000,000,000), 1 AQUA on testnet. No extra Peridot fee beyond the 1% trade fee and an optional launch fee (0 on testnet factory: `launch_fee: 0`) | chain |
| Creator cap | Creator buys capped at 5% of the curve supply (`creator_cap_bps` 500; max 20%) | chain, PGRAD curve config |
| LP percentage and lock | 800,000,000 of 1,000,000,000 tokens on the curve, 200,000,000 (20% of supply) go to the Aquarius pool with all raised XLM. LP shares are sent to the all-zero account (no key), verified on testnet | chain, PGRAD `get_config` (`curve_supply`, `lp_supply`) and share token balance |
| Collateral factor of a graduated token | 25% preset (cap 50% for AquariusOnly pricing); leverage on pool-priced tokens capped at 2x and opt-in | `docs/DEMO-TESTNET.md`, `guardrails.rs` |
| Factory guardrails | CF 1% to 75% (Reflector) or 50% (AquariusOnly); idle buffer 10% to 100%; reserve factor 0 to 50%; at most 16 markets per group; at most 4 margin markets; group max leverage 1 to 5x; liquidation incentive 1.02 to 1.10; slippage at most 10%; liquidation fee at most 50%; reward speed at most 1e12 base units per second; staged changes (CF, price) wait 60 s; no fallback prices | `contracts/market-factory/src/guardrails.rs`, `docs/SPECS.md` Margin, `contracts/peridot-interfaces/ts/index.ts` `GUARDRAILS` |
| Rewards on group 2 | Supply speed 200 stroops per second set via `set_reward_speeds` (about 1.73 XLM per day, so 20 XLM lasts about 11 days) | `docs/DEMO-MAINNET.md` |

## 8. Live URLs, repo, CI, tests

| Item | Value | Status |
|---|---|---|
| Repo | https://github.com/joshschcom/peridot-markets (public). `main` is behind; the integrated branch is `demo-merge` (head `1756a96` when this was written) | verified with `gh repo view` |
| Local build | http://localhost:3010 | NOT RUNNING at the as-of time (connection refused); run it yourself |
| Public droplet, mainnet app | http://165.22.89.201 | HTTP 200 at the as-of time. Deployed commit UNVERIFIED (file `/etc/peridot-web/deployed-commit` on the droplet was not read) |
| Public droplet, testnet launchpad app | http://testnet.165.22.89.201.sslip.io | HTTP 200 at the as-of time. Same commit caveat |
| Vercel previews (private, Vercel-authenticated, HTTP 302 to login) | latest connected mainnet beta https://peridot-markets-preview-8ipc1f9u1-peridot3.vercel.app (source `b896c82`, before the QoL, launchpad and vault merges). Older: eg1grm094 (`20099c2`), mbm5vqtlz, q1q53sbiz (labelled mock demo, `4f92a41`) | URLs from `docs/COORDINATION.md` and `docs/DEMO.md` |
| Custom domain | None configured. `docs/WEB-HOSTING.md` uses `markets.peridot.xyz` only as an example; it does not resolve at the as-of time | UNVERIFIED that Joshua owns it |
| CI (`.github/workflows/frontend-keeper.yml`) | RED. All 33 GitHub Actions runs listed by `gh run list` have conclusion failure. The `frontend` job fails at the `npm ci` step on every run ("package.json and package-lock.json are not in sync", missing `typescript@4.9.5` and `utf-8-validate@5.0.10` from the lock file under the runner's Node 22); the `keeper` job passes. `npm ci` succeeds locally with npm 11, so the lock file needs regenerating with npm 10 | `gh run view 40293790524 --log-failed`. Not fixed here (app/ is not ours to change) |

Tests, run in the worktree at `1756a96` plus this file (results copied from the runs, not estimated):

| Suite | Result |
|---|---|
| Rust workspace, `cargo test --workspace --no-fail-fast` | 862 passed, 0 failed, 5 ignored (the reference core's own ignores) |
| per crate (passed) | receipt_vault 182, simple_peridottroller 127, aquarius_lp_vault 120 (core, not deployed), margin_controller 110, price_router_ext 55, price_router (core) 45, launchpad_curve 37, swap_adapter 32, margin_factory 25, launchpad_factory 24, lp_receipt_vault 22 (core, not deployed), market_factory 21, blend_vault_adapter 21, reward_distributor 16, jump_rate_model 13, launchpad_token 6, mock_depth_fixture 2, peridot_token 2, mock_reflector 1, doc-test 1 |
| App, `cd app && npm test` | 179 passed, 0 failed |
| Keeper, `cd keeper/liquidator/margin && npm test` | 80 tests: 79 passed, 0 failed, 1 skipped (the real-PostgreSQL integration case is skipped without `PG_INTEGRATION_TEST=true`; CI passes it) |
| App end-to-end (Playwright) | NOT RUN here. UNVERIFIED current pass count (earlier reports: 3 flows in `docs/COORDINATION.md`; specs now in `app/tests/e2e/`) |

## 9. Demo state for recording

Wallets (Horizon, as-of time):

| Wallet | Holds |
|---|---|
| Deployer `GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH` | __BAL_ADMIN__ XLM; no USDC and no trustline. It is the group owner of all 3 groups and holds the 30 XLM supply position in group 1 (a `deposit` receipt, withdrawable) |
| Keeper `GAFJVD3TKIEMIUEBJPQVZNRCG7PF25XOX7QZDRGR7Y3MNQWYQR6C2S3W` | __BAL_KEEPER__ XLM |
| Peridot prod key `GDYDTMY46RNAUIIUVG6RPD2D3I3ES4J2SSXGCKIQP2OET4Q5PV75LSPL` (prior work, do not use for the demo) | __BAL_PROD__ |
| Fresh Albedo test account `GBTAM7KI53O5CMJW7QHS2TG7JX65H4Y2TGDXS42ZLJEK6YMGDBBZOOQD` (`docs/DEMO.md`) | 5.0001 XLM, no markets entered, no USDC trustline |
| Other wallets Joshua may use for the video | UNVERIFIED: no addresses of them appear in the repo |

Recommended group for the video: **group 1 "Meridian"**. Why, with evidence read at the as-of time:

- It is the only group with a real position: 30 XLM supplied (collateral value for the deployer: 3.5388 USD at 70% CF, `account_liquidity` simulation), 24 XLM routed to DeFindex.
- Borrowable now: a read-only simulation of `borrow(user = deployer, amount = 1 XLM)` on the group 1 XLM market succeeds (events `BorrowEvent` and a token transfer of 1 XLM), nothing was sent. The XLM market has 30 XLM of liquidity and a 0% borrow rate.
- Boosted cache fresh: the group 1 XLM market `BoostedHealthCache` was 29 to 71 seconds old when read (limit for health checks is 300 seconds). The keeper (`GAFJ...`) is refreshing: its latest transaction was within the last 2 minutes of the as-of time on each check, cadence about every 2 minutes. The droplet itself (`165.245.251.79`) was not logged into; its liveness is inferred from those on-chain transactions.
- It has margin enabled (3x group maximum, 2 markets, Aquarius pool bound) and leaves room to add a third market live (no reward token set, so `MarketsLockedByRewards` does not apply).
- Group 2 has the claim demo but needs a wait between actions; group 3 has no keeper coverage (its boosted cache was 27,724 seconds old, so a borrow there would fail until someone calls `refresh_boosted_underlying`).

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
10. CI badge: do not show the GitHub Actions page as proof of green tests (section 8).

## 10. Known limitations, core changes, new and unaudited contracts

Changes to the audited core (`core/CORE_DIFF.md`): the only code change is eight timelock constants (upgrade timelock 24h to 60s in `simple-peridottroller`, `receipt-vault`, `margin-controller`, `swap-adapter`, `jump-rate-model`, `aquarius-lp-vault`, `price-router`, and the admin-parameter delay 24h to 60s in `simple-peridottroller`). Reference: Peridot-Soroban `leveraged-fix` at `47858c1a13c2588970395faa2212e7b68bd33060`, imported unmodified in `3833c42`, constants changed in `206cf00`. OpenZeppelin stellar-contracts pinned at `3f81125` (v0.7.1), unmodified. The core Wasm bakes in its initial admin at compile time, so Wasm for mainnet was built with the market-factory address as admin (`scripts/build_core.sh`); this is how the audited code works, not our change. Later commits may add to this: UNVERIFIED that no other `core/` file changed after `206cf00` (check `git diff 206cf00 HEAD -- core/` before saying "only timelocks").

New and unaudited (written during the event, deployed on mainnet): market-factory, margin-factory, price-router-ext, reward-distributor, blend-vault-adapter. New and unaudited, TESTNET only: launchpad-token, launchpad-curve, launchpad-factory, vault-factory. The frontend and the keeper are also new or adapted code. The audit covers the imported core only (`docs/PRIOR_WORK.md`: "does not extend an existing audit to new factories, adapters, frontend changes or operations code"). Pre-mainnet second opinion by Codex found 7 issues, all fixed and re-reviewed (`docs/COORDINATION.md` 15:00 and 15:45 entries). The Peridot Blend fee-vault Wasm is built from script3/fee-vault `1ab9835` and is not byte identical to an upstream release (`docs/DEMO-MAINNET.md`).

Known limitations:

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

Generator: `node scripts/pitch_screenshots.mjs --build` (first time) or without `--build`. It builds `app/` three ways: mainnet real data, testnet real data, and mock mode, loads pages without a wallet (nothing is signed), and writes `docs/assets/pitch-<id>.png` plus `docs/assets/pitch-screenshots.json`. Captured at the as-of time against app commit `1756a96`.

__SHOT_TABLE__

PENDING because the feature branch is not merged into `demo-merge` yet: `home-story` (new landing story, branch `home-story`) and `vault-factory` (create-vault UI, branch `vault-factory`). Already merged and visible in these shots: wallet modal and the Mainnet/Testnet switch (in the header). Rerun `node scripts/pitch_screenshots.mjs --build` after those merge.

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
| Mainnet launchpad, graduation, vault factory, Aquarius/Zenex/XOXNO vaults | Those agents' deployments land in `deployments/mainnet.json`; rerun `scripts/pitch_facts_refresh.mjs` and update sections 2 to 6 |
| Any wallet Joshua will use on camera besides the deployer | Joshua gives the address; `--only=wallets` reads it |
