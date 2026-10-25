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

Not yet on mainnet: margin (needs margin-factory plus margin-controller upload, about 180 XLM of rent), Blend route, rewards.
