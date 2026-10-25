# Testnet: token launchpad end to end (bonding curve to graduated lending market)

Network: Stellar testnet. Everything below ran on the real Aquarius testnet router `CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD` and the real market-factory. Mainnet launches are not enabled: public token sales need a legal review first (MiCA).

Launchpad factory `CBYQC54BS5HIWEO6KQNVGZ6XRNOTG3OMT6UZYBUD2NESGHBQMALGSBWC`, market-factory `CCFODI4F6QE276PXGHVYOSX52DMYYI2YDJMQZ7ZGU4YWEH5IG2Y3ZR3M`.
Demo token PGRAD: token `CBYIF7IQLULTFO2WIX2WFGEZ6PZL5QLEAYYIZLDXYTS7GFOK3LPA2UGF`, curve `CAIA6FUZGSY4454KNTOYQ3MT7CGTQMUZBOWUP2C3JNXXH44QPT3B5EFT`, graduation target 500 XLM (testnet preset).

| Step | Transaction |
|---|---|
| Buy 200 XLM on the curve | [5dd88453...](https://stellar.expert/explorer/testnet/tx/5dd884534a941a32e85973ba5d8729d31ecfd8664e56bc074e5020e58605fdb2) |
| Sell 10% of the tokens | [baa3bbcd...](https://stellar.expert/explorer/testnet/tx/baa3bbcdef832a605c98713bd5807b3125e9f2ed5938cb631091759374bc5fdd) |
| Buy 300 XLM | [5f9883dd...](https://stellar.expert/explorer/testnet/tx/5f9883dbc3a4d8659229923e406b25d9814c5910a1fa10dc88ab6379942fb2f9) |
| Buy 100 XLM, clamped exactly at the 500 XLM target | [bef49dc2...](https://stellar.expert/explorer/testnet/tx/bef49dc2961be09af2f62a3c680fef5a7cf738a53deefb77607bd00f5c50cd92) |
| Graduation 1: Aquarius pool `CBZADNRM...` created, all raised XLM and the LP allocation deposited, LP shares locked, unsold tokens burned (1 AQUA fee paid by the payer) | [b7ecae68...](https://stellar.expert/explorer/testnet/tx/b7ecae682686980929010b0bd77e88669f6d9476680c99ea368b880eb041f1b2) |
| Graduation 2: group created, curve is the owner | [4db49282...](https://stellar.expert/explorer/testnet/tx/4db49282b3cccfed5a4b11c39b00fb1767706408b2e8ee4c510607436524d1ef) |
| Graduation 3: XLM (quote) market added | [3673d0f0...](https://stellar.expert/explorer/testnet/tx/3673d0f000863e0f6a168e63b1cc9574946ac07045a2368497d0244772dc0630) |
| Graduation 4: quote market activated | [11bc0f14...](https://stellar.expert/explorer/testnet/tx/11bc0f14b0141f088aa6e77afdbe154cf348ae9f275b2dddb8efc8266b076192) |
| Graduation 5: PGRAD market added, priced from its Aquarius pool, 25% collateral factor | [b62e5d09...](https://stellar.expert/explorer/testnet/tx/b62e5d09ecb0b41c4dd9dedb48e927708c253a7668ef69d2e79a5084780ef957) |
| Graduation 6: PGRAD market activated, `Graduated` | [f5369f74...](https://stellar.expert/explorer/testnet/tx/f5369f748dc178ecc18e9ee793e22708479388371603f6f0effac7f1f254f03e) |
| `claim_group`: the creator becomes owner of the group | [3da6ff3c...](https://stellar.expert/explorer/testnet/tx/3da6ff3c7cdbc810dbe024a76131b30a965b62fc635f11e786adedf9f953fc5f) |

Result: group 1 on the testnet market-factory with two active markets (XLM and PGRAD), PGRAD priced by `AquariusOnly`, collateral factor 25%, caps sized from the pool, margin off by default (the owner may enable it later, capped at 2x for pool-priced tokens).

Found only on the real network: the Aquarius share token's `burn` needs authorization from the pool, not the holder, so LP shares cannot be burned by the curve. The curve locks them by sending them to the all-zero account (`GAAAA...AWHF`, no key exists). The test double had accepted a burn.
