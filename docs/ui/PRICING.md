# Token pricing for wallet-created markets

Status as of 2026-10-26 (Stellar mainnet). All reads below were read-only simulations. No transaction was sent.

## Verdict

Listing AQUA (and PYUSD) is an **admin call, not a contract change**. The Reflector Stellar DEX oracle is already on the factory's oracle allowlist. Only the per-token mapping is missing.

- `market-factory.check_price_allowed` requires `OracleAllowed(oracle)` and `PriceFeedAllowed(token, oracle, asset)`.
- The price router (`price-router-ext`, `ReflectorOnly`) treats every Reflector oracle the same: it calls `decimals()`, checks `assets()` contains the asset, reads `lastprice(asset)`, rescales to 14 decimals, returns the oracle timestamp. `check()` marks a price stale when older than `resolution * 2` (300 s * 2 = 600 s). There is no CEX or DEX special case.
- The factory function that sets the mapping is `set_price_feed_allowed(admin, token, oracle, asset, allowed)`. Admin only.
- `AquariusOnly` stays launchpad-only (`PriceModeNotAllowed` for other owners). Not needed for this fix.

## Reflector oracles on mainnet (read by simulation)

| Oracle | Address | base() | decimals | resolution | assets() |
|---|---|---|---|---|---|
| External CEX/DEX | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | `Other(USD)` | 14 | 300 s | 16 symbols (`Other`): BTC ETH USDT XRP SOL USDC ADA AVAX DOT MATIC LINK DAI ATOM XLM UNI EURC |
| Stellar DEX (pubnet) | `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` | `Stellar(USDC)` = `CCW67TSZ...MI75` | 14 | 300 s | 52 Stellar token contracts |

The FX oracle was not needed and was not queried.

Source of the DEX oracle (reflector-network/reflector-stellar-connector README): one-minute periods built from classic SDEX trades plus AMM pool reserves (Aquarius constant-product, stableswap and concentrated pools, classic liquidity pools), aggregated as VWAP, and only values that a majority of Reflector nodes report byte-identically are written on chain.

### Coverage and live prices (read at ledger time 1793016845)

| Asset | On External oracle | On Stellar DEX oracle | Live price | Age | Factory approval today |
|---|---|---|---|---|---|
| USDC | yes (`Other(USDC)`) 1.00134 USD | no, it is the base asset (not in `assets()`; `lastprice` returns 1.0 but the router would reject it with `AssetNotOnFeed`) | n/a | n/a | approved on External |
| XLM | yes, 0.16968 USD | yes, 0.16921 USDC | | 245 s | approved on External |
| EURC | yes, 1.1208 USD | yes, 1.1107 USDC | | 245 s | approved on External |
| AQUA | no | yes | 0.00028617 USDC (`28616771853`) | 245 s | **not approved** |
| PYUSD | no | yes | 0.99985 USDC (`99984767742915`) | 245 s | **not approved** |
| BLND | no | no (`assets()` lacks it, `lastprice` null) | none | n/a | not priceable by Reflector |
| yXLM | no | no (`lastprice` null) | none | n/a | not priceable by Reflector (peg source lives in the core router, out of scope) |

Resolution is 300 s and the router accepts prices up to 600 s old. Each value above was 245 s old, inside the window.

### AQUA oracle price versus the Aquarius pool

Deepest AQUA/USDC Aquarius pool (`CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O`): reserves 788,052,834.17 AQUA and 224,954.15 USDC, spot 0.00028546 USDC per AQUA. Oracle: 0.00028617. Difference about 0.25 percent. Two other AQUA/USDC pools exist and are not consistent with the market: `CBRUQ7I6...` (199.9M AQUA / 14,745 USDC, spot 0.0000737) and `CCP3PPN6...` (184,948 AQUA / 53 USDC). That is why the oracle's volume weighted, multi-source price matters more than any single pool.

Caveat: no group router has `set_asset_config` for AQUA yet, so the router's own `lastprice(AQUA)` cannot be simulated. The oracle read plus the 14 to 14 decimal rescale (identity) is the equivalent computation.

## The admin call (prepared, not sent)

Run by the admin identity (`GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH`, confirmed equal to `stellar keys address peridot-mainnet-admin`). `mainnet-public` times out, use `mainnet-gateway`.

```sh
F=CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S      # market-factory
O=CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M      # Reflector Stellar DEX oracle
ADM=GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH

# AQUA
A=CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK
stellar contract invoke --id $F --source peridot-mainnet-admin --network mainnet-gateway \
  --inclusion-fee 2000 --send=yes -- set_price_feed_allowed \
  --admin $ADM --token $A --oracle $O --asset "{\"Stellar\":\"$A\"}" --allowed true

# PYUSD (optional, same shape)
P=CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2
stellar contract invoke --id $F --source peridot-mainnet-admin --network mainnet-gateway \
  --inclusion-fee 2000 --send=yes -- set_price_feed_allowed \
  --admin $ADM --token $P --oracle $O --asset "{\"Stellar\":\"$P\"}" --allowed true
```

Simulation result with `--send=no` (identical flags otherwise): AQUA returned `null` (void, success), PYUSD returned `null`. Nothing was submitted.

Verify after sending:

```sh
stellar contract invoke --id $F --source peridot-mainnet-admin --network mainnet-gateway --send=no -- \
  is_price_feed_allowed --token $A --oracle $O --asset "{\"Stellar\":\"$A\"}"     # expect true
```

The add-market page needs no redeploy: `findReflectorFeed` already tries `reflector_stellar` (Stellar token asset) before `reflector_external` (symbol) and accepts whatever the factory approved.

## Rollback

Same call with `--allowed false` (simulated successfully for AQUA). The flag only gates new price installs (`add_market`, `update_price`, `apply_pending`). Markets already created with the mapping keep their router config, so a rollback after a market exists does not unprice it. There is no admin override and no remove-config call: only the group owner can stage a replacement price config (`update_price`, 60 s delay). Plan on the rollback stopping NEW listings only.

## Risk notes

1. **DEX manipulability.** Reflector DEX prices come from SDEX trades and AMM reserves. A thin book can be moved by a determined attacker, and `ReflectorOnly` has no deviation guard (the step guard applies to `AquariusOnly` only). Mitigations: 1-minute VWAP, node-majority agreement, the 5-minute bucket, and the AQUA book being deep (about $225k per side in the main pool). Do not approve illiquid tokens by default. Every mapping should be a reviewed, per-token decision.
2. **Quote unit.** The DEX oracle quotes in USDC (`base = Stellar(USDC)`), the controller treats the number as USD. External feed shows USDC at 1.00134 USD, so DEX-priced assets carry a systematic basis of roughly 0.1 percent, and a USDC depeg flows straight into every DEX-priced market. Acceptable for volatile assets, material for stable-to-stable pairs (PYUSD, EURC).
3. **Freshness.** Timestamps are floored to the 300 s bucket. One missed oracle round makes the price stale after 600 s and the controller refuses actions needing the price. This is the same behaviour as the CEX feed.
4. **Collateral factor.** Guardrails give DEX-priced markets the Reflector maximum of 75 percent. Recommend owners use at most 50 percent for AQUA (the cap `AquariusOnly` markets get), and a low supply cap at first.
5. **Symbol versus contract.** The DEX mapping binds the exact token contract (`Stellar(token)`), so a lookalike token cannot reuse AQUA's feed. The External oracle maps by symbol, which is why the factory approves each tuple.
6. **Admin oracle governance.** Reflector oracles are admin-controlled by the Reflector DAO multisig. Same trust as the existing XLM and USDC feeds.

## Not covered

BLND and yXLM have no Reflector feed and stay blocked for wallet-created markets. Options would be a contract or router change (a bounded Aquarius source for non-launchpad markets), which is out of scope here.

## Second opinion (codex exec, read-only review of this file against the contracts)

Codex verdict: **NO-GO as documented**, meaning the call is mechanically correct but the safeguards in this note are advisory, not enforced. Its points, all accepted:

- The call only stores permission. A successful simulation does not validate the oracle, price or quote currency. (True. The checks run later at `add_market`/`set_asset_config`, where `assets()` membership is checked at configuration time, not on every read.)
- Rollback is weaker than first written: no admin override, no remove-config operation (corrected above).
- The 50 percent collateral factor and low caps are voluntary. Guardrails allow 75 percent and set no upper bound on caps or aggregate AQUA exposure.
- Oracle outages also block liquidations, so bad debt can accumulate during a stale window. The router never checks `base()` and never converts USDC to USD, so a USDC depeg misvalues every DEX-priced market.
- Freshness uses the router's own resolution (300 s, set at group creation), not the oracle's.

Conclusion for the decision maker: approving AQUA is low effort and reversible for new listings, but not for existing ones. Exposure is per group (each group has its own controller and router), so the blast radius is the groups whose owners choose AQUA, with caps they set themselves. Approve AQUA only if that is acceptable and the UI warning for DEX-priced markets stays (it does). PYUSD is the weaker case: a stable-to-stable pair where the 0.1 percent USDC basis matters, so approve AQUA first and PYUSD only on request. A stricter option, if wanted, is a contract change adding a per-oracle collateral factor cap in `guardrails.rs`; it is not required for this fix.
