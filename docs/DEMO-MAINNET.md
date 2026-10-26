# Mainnet transactions (phase 1, lending core)

Network: Stellar public. Deployer and demo group owner: `GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH` (identity `peridot-mainnet-admin`).
Beta, unaudited new contracts, small caps. Core lending contracts are Peridot's audited contracts with 60s upgrade and admin-parameter timelocks.

| Step | Transaction |
|---|---|
| Upload market-factory Wasm | [72907d00...](https://stellar.expert/explorer/public/tx/72907d0035cd65fe8e5da956877014485d86f8f465fa3d9d97b7d79b8ba628b4) |
| Deploy market-factory `CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S` | [f6cafca8...](https://stellar.expert/explorer/public/tx/f6cafca8fe3d83e8571e2fe74d9eb4fd667ff0827fd1426c36019e73424ed6a9) |
| `create_group("Meridian")`, group 1 | [adec8eb4...](https://stellar.expert/explorer/public/tx/adec8eb4fdf444782f7d1591dcd6ac9792f330eb8e66e52f351a599ebbb800ac) |
| `add_market` USDC | [76ce3b92...](https://stellar.expert/explorer/public/tx/76ce3b922c50e100baa6fa20aa39681fd649c92229464dcaf6e723ee6776d4d3) |
| `activate_market` USDC | [8341a38f...](https://stellar.expert/explorer/public/tx/8341a38f2efa8f90961cf779c0d3aa654249a8062d552f681ccddae6ebae0295) |
| `add_market` XLM, 0% borrow rate | [69e7e64b...](https://stellar.expert/explorer/public/tx/69e7e64b2d2c33753d14cff5fae29dd5a2a4cabaf093750a7d00f899bc1f8f59) |
| `activate_market` XLM | [ce7c379a...](https://stellar.expert/explorer/public/tx/ce7c379ad98b66001cc101784e2f40f42493194024b9ff0987709c2f37f9ac58) |
| `attach_yield` XLM to the Peridot DeFindex XLM vault | [d0790725...](https://stellar.expert/explorer/public/tx/d07907253f036601bc35615f0562393218d56145bdcbddf5ea656997eafb8692) |
| `enter_market` XLM | [d9c190e3...](https://stellar.expert/explorer/public/tx/d9c190e34b93d53545f9d07f420386b3f804e0bed4b7672ac98f6eea3426119e) |
| Supply 5 XLM (80% routed to DeFindex) | [a6a5a1fa...](https://stellar.expert/explorer/public/tx/a6a5a1fa7f953dbae5b1b0cb4ae4513cdc3ccc420c4d0f73e0c61686e81b08a8) |
| Withdraw all | [0e28f6ba...](https://stellar.expert/explorer/public/tx/0e28f6babd4c96b9467def9c6382738bd6259944be1c4a22854aced7fbf80315) |

Group 1: controller `CCIVCL6B5TNYC5PTJDFXD24AEJ5VQU5XUTZXFFGMIVRWQSSZFZPIPUES`, price router `CBBZ2FPMJDFSGQD64Y6U4IKJ7YXO2RP5T5AQMXRNBYKFXZOTGMFTF3XD`,
USDC market `CCZHYRBCNKB5F3RPMD4VV747NIV6QFJ4EBZLPWDSQWHNNKYDO62OVIRM` (75% CF, no yield route, 10,000 USDC supply cap),
XLM market `CCK7R22G3HOZDJXU6DVDEXK4HZ6AS3DHHFCAFOMY22XQEA3DJHRRSNXI` (70% CF, 0% borrow, DeFindex route, 100,000 XLM supply cap).


## Margin (group 1)

Margin-factory `CCTFHRHDJM4BH6O2R325L6JXYWVCUDCM2IBO3BLRCE53KDM5JR5YZ6YH`, group 1 margin controller `CCWAUBM6C5RRPBFKJK57I56GXRCILOKRVJEOAGEI7ZHKXVSOHEL5JPEY` (audited variant, 3x group maximum, 5% slippage, incentive 1.08).
Aquarius XLM/USDC pool `CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV` is trusted by Peridot, allowlisted and bound for the group.

| Step | Transaction |
|---|---|
| Upload margin-factory Wasm | [073bfa5b...](https://stellar.expert/explorer/public/tx/073bfa5b7289d035d23059287a5ed6e8627b451181bf91c55a272cd0b57173d5) |
| Deploy margin-factory | [f3fed435...](https://stellar.expert/explorer/public/tx/f3fed435bfebf5e91641fa9435ffadd17f9623a0cf6bfca68cff8c9ee31daf03) |
| `enable_margin` group 1 | [c9f0cf44...](https://stellar.expert/explorer/public/tx/c9f0cf44d7d1f13a26bbfc8d0beeab639ab4f5c1e235a575c9312593a5125ea2) |
| `set_pool_allowed` | [5f713e56...](https://stellar.expert/explorer/public/tx/5f713e567624ad6b83d2ba0a6621a0d0606bd4e308c14f4b7bdfc8fd2df80e78) |
| `set_pool_binding` | [a994a43a...](https://stellar.expert/explorer/public/tx/a994a43ae8d0a0a485fcd3508fe57ad9d700512566d4baa282639030bee58497) |
| `set_market_margin` USDC | [c90a0678...](https://stellar.expert/explorer/public/tx/c90a06789e4b8feef33a7ffe297a28d928daa04bedc4caa2d2ab0c0406207aeb) |
| `set_market_margin` XLM | [b13e8d84...](https://stellar.expert/explorer/public/tx/b13e8d8483c117f61dd18e6bfaac03cf7f4e3d870c36d2320d02b396d4ed6e27) |

Opening and closing a position is done from the app (V3 flow: begin, swap, activate). No position has been opened by the deployer yet.

## Rewards (group 2 "Rewards")

Rewards lock a group's market list, so they live in a separate group and group 1 stays open for adding markets. Group 2 controller `CADHYBWKFNDE3LKNWCRD7F6FNHTNQAR4W3AT2G3TROO7V6RZ2VMUKZSZ`, XLM market `CARDJEVXDP5RY3GAKRYSW4T5CKYY7Y4PQTS4CJSVQEBKP4JMHTDFPXNV`,
reward distributor `CA4AMJK54MZI2KDU5KJFPF5SD4KULJETIITPVVQH5WTEH2WH6IKOSYUF`. Reward token: XLM, funded with 20 XLM, supply speed 200 stroops per second (about 1.73 XLM per day, so the 20 XLM last about 11 days), refundable with `withdraw_unallocated`.

| Step | Transaction |
|---|---|
| `activate_market` XLM (group 2) | [1ae1f19c...](https://stellar.expert/explorer/public/tx/1ae1f19ce8b613d07f90114b08bb68c85543977f6eb5cd60db13bb7400fe7eaf) |
| Fund distributor, 20 XLM | [95d2fd44...](https://stellar.expert/explorer/public/tx/95d2fd444f7639fde3ca938cf1cce86b57dd413031bd19a2629bad8162e7778d) |
| `set_reward_speeds` | [bba8d854...](https://stellar.expert/explorer/public/tx/bba8d854877c192b3bc8beb0b0360a94c8499e2de65be158f1503cdc13b29ed2) |
| `enter_market` | [afa1e4ce...](https://stellar.expert/explorer/public/tx/afa1e4cee2b9719b248dd49a63d8b478e94c71701def2ffde68e0ea43542f833) |
| Supply 5 XLM | [29eef561...](https://stellar.expert/explorer/public/tx/29eef56125c0b967ab099795274e1fee6ce6d30c421332010b01068db911e4fc) |
| `claim` (17,000 stroops paid after 85 s) | [b492b6e9...](https://stellar.expert/explorer/public/tx/b492b6e91ee347d46e2b92ad7b73c4eea127b98776e154f2ea76c18cb960f77b) |
| Withdraw all | [70799c6f...](https://stellar.expert/explorer/public/tx/70799c6f9f6756d8afb5521fcb2cbf58720260b4fb4310fa611ada7f97843002) |

## Blend route (group 3 "BlendDemo")

Peridot-administered Blend fee vault `CCHILGAYU4DQXLWSTOA5BQYZD7QJMWUU5PQLS4Z25FLI2WP6IVV3X337` on the Blend Fixed V2 pool `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD`, 10% take rate, reserves XLM and USDC enabled.
Fee-vault Wasm built from script3/fee-vault `1ab9835` (not byte identical to an upstream release; sha256 `adc84e97...`). Group 3 controller `CBGLMNCDWF7GTSGWU5DT5ZGAVM6JABAMJH3G3SMNGKDQQ2NTIG3RU2O2`,
XLM market `CCUQUYBW3LJXPYB5U5QIDBDWPMKYVBPCIHQZSSXOSAV2SIXOBDNHSUDM`, Blend adapter `CDLLNAM63H5BVYH4BCNIWY6AULTDO6H455M4NF3HIYUW4XBXW6TPOPIX`.

| Step | Transaction |
|---|---|
| `add_reserve_vault` XLM | [516ce844...](https://stellar.expert/explorer/public/tx/516ce8449c634675bfc6b13db2143c28b6e5129e39a2212c8734217f4133d4a7) |
| `add_reserve_vault` USDC | [87ea39ef...](https://stellar.expert/explorer/public/tx/87ea39ef224051852df1cd4790bd9f0c1f0bf706204e84c0ba6946452fb9ca2f) |
| Allowlist the fee vault in the factory | [9890568a...](https://stellar.expert/explorer/public/tx/9890568ac336140c351f1c211c6c90be60dcb793a5e705572373778f151dc69b) |
| `activate_market` XLM (group 3) | [96e91524...](https://stellar.expert/explorer/public/tx/96e91524b862b781719952805323def5e0719b062b2d43e1a0f7dd5e40dd323a) |
| `attach_yield` (adapter deployed, 20% idle buffer) | [78d937d5...](https://stellar.expert/explorer/public/tx/78d937d5e5c45d294ae51d7462d401862385a529bbb8884fc888bfb1d8939922) |
| `enter_market` | [6e2f9c20...](https://stellar.expert/explorer/public/tx/6e2f9c202133a430909f02db1ca91743e6a3394feb15d225aa2362279127b5fd) |
| Supply 5 XLM (4 XLM sent to Blend, adapter value 39,999,999 stroops) | [9af448d3...](https://stellar.expert/explorer/public/tx/9af448d3603385adddacba91b103dbeda8c67946fd32c76090be8bb319658db9) |
| Withdraw all | [0dafc04e...](https://stellar.expert/explorer/public/tx/0dafc04e651ff663e1a0b8bfe47823d29d7218110ba0c1e3e32a5b33e7fc991c) |


## Launchpad (bonding curve) and graduation upgrade, 2026-10-26

Beta, unaudited new contracts. Everything below was sent by `peridot-mainnet-admin` (`GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH`) with `scripts/launchpad_mainnet.sh`. Times are UTC; Lisbon is on WET (UTC+0) on this date, so the times are the same. Authorised by Joshua: launchpad deploy, one demo token, and the in-place market-factory upgrade plus the AquariusOnly-capable price router Wasm so graduation can work. Second opinion: `docs/qa/CODEX-LAUNCHPAD-MAINNET.md`.

Launchpad factory `CAN6YNLFZHMLHPZAMSLR2BTIM7VOS6YZEXJSZAXQEHKPO7BN4RP5NA7J` (admin and treasury = the admin account, **open**: not paused, anyone can launch, no launch fee). Graduation is wired to the mainnet market-factory `CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S` and the Aquarius router `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK`; quote asset XLM priced by the Reflector external feed.

Demo token **PDEMO** ("Peridot Demo"): token `CDKHQPYSBULW3T2FNLPKKKXVKREDYZTI37KRURBNVNEUIZ5YDT4O4DYT`, curve `CDWJL4YJ4H546FFXNXSNREW27PFQFNMBQPXDIUHTN765Z52MRDUJH43A`, Fast preset (500 XLM graduation target, 1% trade fee, 800M tokens on the curve, 200M reserved for the pool, creator buy cap 5% of the curve). The creator bought with 5 XLM atomically at launch and received 29,276,445.7 PDEMO (3.66% of the curve supply, inside the 5% cap).

| Step (UTC) | Ledger | Transaction | Cost XLM |
|---|---|---|---|
| 09:15:48 upload launchpad-token Wasm `aab4c9e0...` | 65144073 | [4afb0393...](https://stellar.expert/explorer/public/tx/4afb03933df16a24baa258045c376f976664ace368f592748caa323f106d3f8c) | 11.83 |
| 09:16:08 upload launchpad-curve Wasm `bdde6afc...` | 65144077 | [69bf21f0...](https://stellar.expert/explorer/public/tx/69bf21f0e2cfe7cdba8460a7f38aa5b66ef90e9988078e8f38c3466c36d7a81a) | 43.47 |
| 09:16:18 upload launchpad-factory Wasm `e7c070ce...` | 65144079 | [3b5bb0e0...](https://stellar.expert/explorer/public/tx/3b5bb0e00b4dff298e217e45409dad1082e82eeb642a79a627f387d898d33790) | 37.39 |
| 09:16:28 upload market-factory Wasm `baec971c...` | 65144081 | [103ebbac...](https://stellar.expert/explorer/public/tx/103ebbac38906ccc595f1fd6a99d78c00a89ac3c0324011e110a7cf9de6af9fb) | 58.63 |
| 09:16:38 upload price-router-ext Wasm `14c83a90...` (AquariusOnly) | 65144083 | [90ff3106...](https://stellar.expert/explorer/public/tx/90ff31061d5b4d977ac9eec3edad73fd89370319af14a625b60a76d5e92df764) | 28.57 |
| 09:17:08 market-factory `upgrade` `a5442cae...` to `baec971c...` (3 groups still readable) | 65144089 | [be954d81...](https://stellar.expert/explorer/public/tx/be954d8101b54e2936b1082be89752d8be8ce1b55db86ceecafd83848f9dec16) | 0.0005 |
| 09:17:53 deploy launchpad factory | 65144098 | [ef3dfcc9...](https://stellar.expert/explorer/public/tx/ef3dfcc92c3e1618b83464cb5efa2ac021322614c11201ffb46d7818e7c7d699) | 0.05 |
| 09:18:23 `set_wasm` (token, curve) | 65144104 | [86ed4ae8...](https://stellar.expert/explorer/public/tx/86ed4ae8d685c0c74ac87e7d773271c0551b19fa67a90b96484501e9d20d6731) | 0.02 |
| 09:18:28 `set_default_presets` XLM | 65144105 | [6ea456f1...](https://stellar.expert/explorer/public/tx/6ea456f137690195d84c4ba27272f8cc6bd19556320d928c9690d41d6f8504ae) | 0.23 |
| 09:18:38 `set_preset` Fast = 500 XLM | 65144107 | [45fca49c...](https://stellar.expert/explorer/public/tx/45fca49c16c52cc691ea50233098f480149e59e87ba6529ba22599afb7c39aa9) | 0.0006 |
| 09:18:48 `set_graduation` | 65144109 | [49510585...](https://stellar.expert/explorer/public/tx/49510585b39e6a090d3614f3ccc91508fcc944265b8ff8a7fdb19f40accf9d43) | 0.03 |
| 09:18:58 `set_quote_price` XLM (Reflector) | 65144111 | [560343b7...](https://stellar.expert/explorer/public/tx/560343b7f5de791a2db8957ae0c4d7c6f65f5cfd9f86d7c8c82c6f364519858b) | 0.05 |
| 09:19:18 market-factory `set_launchpad` | 65144115 | [c0019b9d...](https://stellar.expert/explorer/public/tx/c0019b9d1262b8c13fdc7aa5e039761617dc06546d48fe818c28766c3adff5d3) | 0.01 |
| 09:19:28 market-factory `set_wasm` (price router `e04a63e0...` to `14c83a90...`) | 65144117 | [bb6ed2a3...](https://stellar.expert/explorer/public/tx/bb6ed2a361d55f8c608998b72cb17172926a8556ba574f7ffd098d4403c19e79) | 0.0006 |
| 09:21:03 `launch_curve` PDEMO with 5 XLM creator buy | 65144136 | [fce3e87f...](https://stellar.expert/explorer/public/tx/fce3e87f87ade9af25b5eb7785f80ea2b19b28901773a0f19d61b2ef4acf4030) | 0.53 (+5 XLM into the curve) |

**Total spent: 185.84 XLM** (180.84 XLM fees and Soroban rent, mostly the five Wasm uploads at 179.9, plus the 5 XLM creator buy). Admin balance 247.15 XLM before, 61.31 XLM after.

What to click (in the app, once it reads this manifest): open the Launchpad page, select PDEMO, show the curve state (price, progress to the 500 XLM target, creator bought 5 XLM), simulate a 1 XLM buy (quote about 5.66M PDEMO for 1 XLM) and a sell, then show the Launch wizard (token plus curve, optional creator buy). The simple-token path (`create_plain_token`) is live on the same factory.

Read-only checks done after launch: `get_state` (price, 0.99% progress, 49.5 XLM raised), `quote_buy` 1 XLM and `quote_sell` of 10M tokens, `is_curve` is true, the market-factory `get_launchpad`, `get_wasm` (new price router), and three existing groups still read. Graduation was NOT run: `graduation_cost()` reads 300,000 AQUA on mainnet, and `graduate` correctly refuses a curve below target. A simulated `create_group(owner = curve)` on the market-factory succeeds (it would be group 4 with a new AquariusOnly-capable price router), so the market-factory half of graduation is accepted; the Aquarius pool-creation half is exercised on testnet only.

Caveats (details in `docs/qa/CODEX-LAUNCHPAD-MAINNET.md`): a 500 XLM raise gives a pool below the price router's 500 USD per side floor, so a graduated 500 XLM token would have supply but no borrowing price; AquariusOnly pricing has a manipulation window after 300 s that must be fixed before real graduations; the factory admin can upgrade curves immediately (house rule); the rollback for the market-factory is `upgrade(admin, a5442cae...)` and restores code only.

## Vault factory and Aquarius ladder vault (branch `vault-factory`)

Deployer: `GDLVO6BC6NPS2UZBN2DVP2E4G57KAEGTMV2DAMOENHVVQNQNT5YI7GWP` (identity `peridot-mainnet-vaults`, shared funding of 75 XLM, cap for this job 60 XLM). Artifacts are reproducible and identical to the testnet ones: vault-factory wasm `231f72c4ace3f355668dff53f08694f61a890748c7e8bcdeb27c584f88677a7d`, aquarius-vault wasm `77ead300da294e48c04199d9e873d70283f59ea9309ee9ef92944fbf5345dd76`. Neither crate has a baked admin; the factory admin is the constructor argument (the deployer key, see the trust note in `docs/ui/VAULTS-UI.md`).

Cost estimate from the testnet fees charged for the same transactions (stroops converted to XLM): upload aquarius-vault about 3.5, upload vault-factory about 1.9, deploy factory about 0.02, set_wasm below 0.01, create_vault about 0.02, seed deposit about 0.02, three rebalance steps about 1.1 in total, a withdrawal about 0.01. Fees about 7 XLM plus the 10 XLM seed: about 17 XLM, well under the 60 XLM cap.

Demo vault parameters: pool Aquarius XLM/USDC concentrated 0.1% `CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV` (tick spacing 20, about 5.1 million XLM and 428k USDC deep), underlying XLM, owner and keeper the deployer, 5 rungs of 3 spacings (0.6% each) touching, pyramid weights, rebalance trigger 5 spacings (about 1%), cooldown 1 hour, performance fee 10%, deposit cap 100 XLM, swap slippage cap 1%.

### Done on mainnet

| Step | Result |
|---|---|
| Upload and deploy vault-factory | `CBWWQGA6ZURTB5IVZO3Q2EQBOSO4FDGLKNUNUWX5Q57TWKHHYFGRAJTW`, tx [07962786...](https://stellar.expert/explorer/public/tx/079627868c13673bc029ec2e133b35f6f0c704b87816fce47e1c9524def0c2db), wasm sha256 `231f72c4ace3f355668dff53f08694f61a890748c7e8bcdeb27c584f88677a7d`, admin `GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH` (peridot-mainnet-admin, verified on chain), cost 10.45 XLM |

Correction to the estimate above: mainnet wasm rent is far higher than testnet. Simulated upload fees on mainnet: vault-factory 11.96 XLM (paid 10.45 with deploy), aquarius-vault (46,819 bytes) 70.3 XLM. Zenex and XOXNO paid 32.4 and 26.9 XLM for theirs. The Aquarius wasm is NOT uploaded yet: it needs about 83 XLM in total with the seed deposit, which exceeds the 60 XLM cap, and it waits for a decision.

Register kinds (run by the factory admin, `peridot-mainnet-admin`):
`stellar contract invoke --id CBWWQGA6ZURTB5IVZO3Q2EQBOSO4FDGLKNUNUWX5Q57TWKHHYFGRAJTW --network mainnet-public --source peridot-mainnet-admin -- set_wasm --admin GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH --kind <kind> --hash <hash>` with `zenex` `99a3fc7e0275a209f44a50256d822ccfcad4da0d2824979ec7f08dc32abff399`, `xoxno` `61d1443a708a10691ad6cf955584cf43cb4fd9465e4c40e927ad1673bb63bc23`, and `aquarius` `77ead300da294e48c04199d9e873d70283f59ea9309ee9ef92944fbf5345dd76` (after the upload).
