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
