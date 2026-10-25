# 11 Integration registry: addresses and verified interfaces

Researched 24 to 25 Oct 2026 from Peridot's own address book and each protocol's repo or docs (sources at the end). **Every agent verifies an address before first use**:
`stellar contract info interface --id <ID> --network <mainnet|testnet>` and, for tokens, `stellar contract invoke --id <ID> --network <net> -- symbol`.
If an address fails, check the protocol's source again and record the fix here and in `deployments/<network>.json`. Never invent an address.

## Peridot's own files come first

`peridot-contracts/addresses.md` on the reference branch (`leveraged-fix`) is Peridot's maintained address book, verified on-chain by the team (last full check 18 Sep 2026). Where it and this file disagree, **`addresses.md` wins**; note the difference in COORDINATION.md. The deploy scripts there (`deploy_aquarius_*_mainnet.sh`, `deploy_margin_mainnet.sh`, `canary_margin_mainnet.sh`) also carry addresses as defaults. The tables below copy the parts this build needs.

## Peridot existing deployments (prior work, read-only)

| Contract | Mainnet | Testnet |
|---|---|---|
| Core controller (SimplePeridottroller) | `CCVUFGXKFVPAHWMMDDL6HXKUN2B2G73Z27VRM3WXZBBSQEUTNLI6YPEX` | `CDMXPWG55776NECXQMWNBXMEQXZUAWA2AJBCQS7SU7SA64XHMO3KB3O6` |
| JRM volatile (XLM) / stable (USDC, EURC) | `CCPJFBH5WSNZVMCUQCBM4X5334L6ZL3W4Q33XJAK45RCDHJ2JGJ5AP6A` / `CCI5LBBNYOASPQ62GIRY54PDEYWWURJB75HNRAFOU4LTOU3XBC73IB5I` | `CDF2GSHMMJR6OU3PBMHO642MSCEKIZV75SYOBP74Q4RZWDKK7VFOTKDZ` |
| Markets XLM / USDC / EURC | `CBU4Y7CJFOUZZE3QBOXTKM54UTUYW3SDJWTNMDGJBNCR5HS5UCEKV3BE` / `CBVUJJIJTRJNOORPPCVH72DP7YDCOMDHI6WYKP3WOFVEPSCVP3TBXHIN` / `CD3WN3PLW63HFZXE56OTRLMBV46WG54TFPGRL4RDQ43HQTTWVB4RPO3G` | XLM `CB32OVY4AADCHQT3DLKJYW5QVTWY5MOX7BBNZFT3SDHZ5HPSDDEA2THJ`, mock USDT `CCEW6NSPCV7XUEQV75ZMII5HK5DGXK5JP2QOTGLV4UFLDBPEKRGO4Y4B` |
| Margin controller / swap adapter | `CC2MVMWNUSEBJ5ITIKTKTLL3URUPYPGRQB6SWX2HAKEKKXDMYF4EYP5C` / `CCEMGF23WSRRR3C343LQ7SVQWGCNEQ2OA7I5VD7FY7FD4HJAYNQFV7BW` | V3 `CAKKHUGHP67UA4F42QOYPKNGRSBJEOE62MGDXA2UURTEYFOQGSMIRUFO` / V3 `CBSTR53W52JHCRXW4I4QAL7FJJIT2D7MVFTNC3VJRNOPTIKCCZKDTKDL` |
| $P token (PERI) | `CDNJSOJKURHQUDBO7OHK7Z64R2CNMIAWXENHM24ALK7Y3H56EU6PUOKR` | not wired on testnet |
| Isolated LP pilot controller | `CCZKDMAP23ZFL55RVITKSW4LAONQABGPSK2Y77RS64GPHOVDDFF5ENGC` | n/a |
| LP pilot XLM / XLM-yXLM (market, strategy) | `CBRJTPI3327YPP57KGIZIU4Z6APBUN5F6LJ2Q3MPKCISUQJLAQFFZECZ`, `CB3WLG4QITFRELACDR74N63VEPICMQ35QW3DSAMF4KCFOITKOJSHH6RW` | n/a |
| LP pilot PYUSD / PYUSD-USDC (market, strategy) | `CBNVNCPEW2XXGBEGVMZQXBSODO5V2HMGPT5FFLVLT355SXJMYY53MLMA`, `CANCOWOI6R2FZBDLZKUL6BUZJN3VONPZSUUSWFL3KF3MPG5INAF25EKY` | n/a |
| LP pilot USDC / PYUSD-USDC (market, strategy) | `CBIOHQFWKSYTRET3LJV4LTO3ZQWRQMQ7I2SJAZ62IZCQHDST4YO3AZP7`, `CAQZ7XPUSOSBI66A4RPSNPEBI2EADBMBVUBSW6R2DYWC64QHDM3HKGIN` | n/a |
| Aquarius LP vault + boosted market (verified end to end) | not yet deployed for USDC/EURC | vault `CCG5OPVXIE55TVNIM3766IRKOTJPI6XWEO4WSVWCAFJDLRRP55G7AN4H`, market `CCJJJCKVZHSDIGMPXSZNADX5VPTOX4OUMJMUOPIAAX5R6ZQSQZICYHIM`, pool USDT/XLM CL 0.3% `CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I` |

Mainnet settings reference (core group): CF XLM 70%, USDC/EURC 90%; close factor 50%; liquidation incentive 1.08; reserve factor 10%; target idle 10% (LP pilot 30%). Rate curves (1e6 scale): volatile base 10000, multiplier 180000, jump 4000000, kink 800000; stable base 0, multiplier 80000, jump 2000000, kink 900000. Use these as the wizard's "Volatile" and "Stable" presets.

Testnet gotchas from Peridot's own runs: Reflector testnet only publishes `Other(Symbol)` assets, so tokens need `set_oracle_symbol` (`"XLM"`, `"USDT"`); the testnet Aquarius pool sits about 7% off the oracle, so `max_pool_divergence_bps` must be widened (1500) on testnet only; the CLI encodes `Option<Symbol>` as JSON (`--symbol '"XLM"'`); use `--network mainnet-public` for mainnet reads.

## Tokens (Stellar Asset Contracts)

| Token | Mainnet | Testnet | Note |
|---|---|---|---|
| XLM (native SAC) | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | derived with stellar-sdk; matches Blend and Aquarius files |
| USDC (Circle) | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | mainnet matches Blend, Zenex and Peridot's deploy_mainnet.sh; testnet derived from Circle's testnet issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| USDC (Blend testnet mock) | n/a | `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU` | the USDC Blend's testnet pools use; not Circle's |
| AQUA | `CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK` | derive from testnet AQUA issuer if needed | derived from issuer `GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA` |
| BLND | `CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY` | `CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF` | from blend-utils |
| EURC | `CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV` | n/a | from Peridot addresses.md |
| PYUSD | `CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2` | n/a | issuer `GDQE7IXJ4HUHV6RQHIUPRJSEZE4DRS5WY577O2FY6YQ5LVWZ7JZTU2V5` |
| yXLM | `CBZVSNVB55ANF24QVJL2K5QCLOAB6XITGTGXYEAF6NPTXYKEJUYQOHFC` | n/a | not on Reflector; priced via Peridot's price router |
| Mock USDT (Peridot testnet) | n/a | `CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY` | Peridot's testnet stablecoin; older notes also list a testnet USDC `CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F` |

## Reflector (oracle, SEP-40)

| Feed | Mainnet | Testnet |
|---|---|---|
| Stellar assets (Stellar DEX prices) | `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M` | `CAVLP5DH2GJPZMVO7IJY4CVOD5MWEFTJFVPD2YY2FQXOQHRGHK4D6HLP` |
| External CEX and DEX | `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN` | `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63` |
| Forex | `CBKGPWGKSKZF52CFHMTRR23TBWTPMRDIYZ4O2P5VS65BMHYH4DXMCJZC` | `CCSSOHTBL3LEWUCBBEB5NJFC2OKFRC74OWEIJIZLRJBGAAU4VMU5NV4W` |

- Peridot's mainnet deploy already uses the **External CEX and DEX** feed (`CAFJZ...`), which prices by symbol (`Asset::Other("XLM")`, `"USDC"`). The **Stellar assets** feed prices by contract (`Asset::Stellar(address)`) and is the one to use for Stellar-native tokens without a CEX listing.
- So the price router config needs **both** oracle addresses and the asset key per token: `Other(symbol)` on the external feed or `Stellar(token)` on the Stellar feed. The wizard shows which feed covers a token by calling `assets()` on both.
- Interface is already in `core/simple-peridottroller/src/reflector.rs` (`lastprice`, `decimals`, `resolution`, `twap`, `x_last_price`, ...). Read `decimals()` and `resolution()` live, do not hardcode.

## Blend (Script3 / Zenith)

| Contract | Mainnet | Testnet |
|---|---|---|
| Pool factory V2 | `CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU` | `CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6` |
| Backstop V2 | `CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7` | `CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA` |
| **Fixed pool V2** (use this) | `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD` | n/a |
| Testnet V2 pool | n/a | `CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF` |
| YieldBlox pool V2 (do not use) | `CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS` | n/a |
| Fixed pool V1 (legacy) | `CDVQVKOY2YSXS2IC7KN6MNASSHPAO7UN2UR2ON4OI2SKMFJNVAMDX6DP` | n/a |
| Emitter | `CCOQM6S7ICIUWA225O5PSJWUBEMXGFSSW2PQFO6FP4DQEKMS5DASRGRR` | `CC3WJVJINN4E3LPMNTWKK7LQZLYDQMZHZA7EZGXATPHHBPKNZRIO3KZ6` |
| Testnet oracle mock | n/a | `CAZOKR2Y5E2OSWSIBRVZMJ47RUTQPIGVWSAQ2UISGAVC46XKPGDG5PKI` |

- The **fee vault** (`script3/fee-vault`) is built on `blend-contract-sdk 2.22`, so it targets **V2 pools**: use Fixed V2 `CAJJZ...` on mainnet, not the V1 address in Peridot's older notes. Confirm the Fixed V2 pool has USDC and XLM reserves (`get_reserve_list`).
- Fee vault constructor (verified in `src/contract.rs`): `__constructor(admin: Address, pool: Address, is_apr_capped: bool, value: i128)`, `admin.require_auth()`, `value` in **1e7 scale** (`1_000_0000` = 100%; a 10% take rate = `1_000_000`). Then `add_reserve_vault(...)` per asset. No public fee vault instance is listed; Peridot deploys its own.
- Fee vault user calls: `deposit(reserve, user, amount) -> i128`, `withdraw(reserve, user, amount) -> i128` (amount in underlying), `get_shares(reserve, user)`, `get_underlying_tokens(reserve, user)`, `claim_emissions(...)`, `claim_fees(...)`.

## DeFindex (PaltaLabs)

| Contract | Mainnet | Testnet |
|---|---|---|
| Factory | `CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI` | `CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32` |
| USDC Blend autocompound (Fixed) strategy | `CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP` | `CALLOM5I7XLQPPOPQMYAHUWW4N7O3JKT42KQ4ASEEVBXDJQNJOALFSUY` |
| XLM Blend autocompound (Fixed) strategy | `CDPWNUW7UMCSVO36VAJSQHQECISPJLCVPDASKHRC5SEROAAZDUQ5DG2Z` | `CDVLOSPJPQOTB6ZCWO5VSGTOLGMKTXSFWYTUP572GTPNOWX4F76X3HPM` |
| EURC Blend autocompound (Fixed) strategy | `CC5CE6MWISDXT3MLNQ7R3FVILFVFEIH3COWGH45GJKL6BD2ZHF7F7JVI` | n/a |
| USDC vault (PaltaLabs) | Soroswap/DeFindex USDC `CA2FIPJ7U6BG3N7EOZFI74XPJZOEOD4TYWXFVCIO5VDCHTVAGS6F4UKK` | `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` |
| XLM vault (PaltaLabs) | see Peridot XLM vault below | `CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6` |
| EURC vault (Soroswap/DeFindex) | `CCKTLDG6I2MMJCKFWXXBXMA42LJ3XN2IOW6M7TK6EWNPJTS736ETFF2N` | n/a |
| **Peridot's own DeFindex vaults** (already wired to Peridot's core markets) | XLM `CCB2AR5X3KP4WQKE7HNSUSDS7SHFMC2WPVSZ2ZXJ6DHXOKHFFKOZE6GK`, USDC `CAB4JOLSCNELJVDQKZLVGHKWJCLXFDBZZMITJAFL4GBGTHIKWO47PYFH`, EURC `CBP2R5KYAWJCOCVDTSNTEVL3O6JBTWOOH7SZOX7DX5DLGVZCAMLBDZM3` | n/a |

- Mainnet vaults come from Peridot's `addresses.md` (above). A DeFindex vault holds deposits from many depositors, so each **new group market** should get its **own** vault from the factory (route b below) rather than sharing Peridot's core-market vaults; that keeps groups isolated. Other vaults: `total_vaults()` + `get_vault_by_index(i)` + `get_assets()` on the factory.
- Two routes, pick per market: (a) **DeFindex vault** attached directly to the boosted hook (no adapter; this is how Peridot already integrates), or (b) a Peridot-owned DeFindex vault created from the factory with the Blend autocompound strategy, so the group owner's market is its only depositor.
- Vault interface (verified in `apps/contracts/vault/src/lib.rs`): `deposit(amounts_desired: Vec<i128>, amounts_min: Vec<i128>, from: Address, invest: bool) -> Result<(Vec<i128>, i128, Option<...>)>`, `withdraw(withdraw_shares: i128, min_amounts_out: Vec<i128>, from: Address) -> Result<Vec<i128>>`, `get_asset_amounts_per_shares(vault_shares: i128) -> Result<Vec<i128>>`, `get_assets()`, `fetch_total_managed_funds()`. This matches what `receipt-vault` calls.

## Aquarius

| Contract | Mainnet | Testnet |
|---|---|---|
| Router | `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK` | `CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD` |
| AMM API | `https://amm-api.aqua.network/api/external/v2` | `https://amm-api-testnet.aqua.network/api/external/v2` |

Router (from Aquarius reference docs):
```rust
fn get_pools(tokens: Vec<Address>) -> Map<BytesN<32>, Address>        // tokens sorted
fn get_info(tokens: Vec<Address>, pool_index: BytesN<32>) -> Map<Symbol, Val>   // pool_type: "constant_product" | "stable" | "concentrated"
fn deposit(user: Address, tokens: Vec<Address>, pool_index: BytesN<32>, desired_amounts: Vec<u128>, min_shares: u128) -> (Vec<u128>, u128)
fn withdraw(user: Address, tokens: Vec<Address>, pool_index: BytesN<32>, share_amount: u128, min_amounts: Vec<u128>) -> Vec<u128>
fn swap_chained(user: Address, swaps_chain: Vec<(Vec<Address>, BytesN<32>, Address)>, token_in: Address, in_amount: u128, out_min: u128) -> u128
fn claim(user: Address, tokens: Vec<Address>, pool_index: BytesN<32>) -> u128   // AQUA rewards
```
Verified mainnet pools (Peridot addresses.md, on-chain checked; discover others with `get_pools`, the API listing is incomplete):

| Pool | Type, fee | Address | Note |
|---|---|---|---|
| USDC/EURC | concentrated 0.3% | `CDTSE6RLRI7ZO25JSER6E4SQR4PHJJNONEGS5HDJ3Y6LAKECRZKYN5CA` | Aquarius vault target, stable pair (full range) |
| USDC/EURC | volatile 0.3% | `CB37QM6EHVBDDNK7MAVQESV7WPLKV6G36TR7MHAOYWPZXLPQUWSDOK4E` | |
| XLM/yXLM | concentrated 0.1% | `CADMDTCQHSC2GCYPDCYQ7FBYVOXED3E3WGCYJHHT524ZBALM7VYHFS7F` | used by LP pilot |
| XLM/yXLM | stable 0.1% | `CCFGZJTHQZGDZP5PK6WMLKHKJ72ACSVMJGCI2NFR7Q6EAVSKWLJB3ZH3` | has fungible LP token |
| PYUSD/USDC | concentrated 0.1% | `CAPIOQNULTKVYOJT6X2W2XKGNIVUWZDY72Y42YG6HQKJ7DU7YTHIDQYX` | used by LP pilot |
| PYUSD/USDC | stable 0.1% | `CDMH535JSD224YXPET3B4SJOLXTQQ24GRSCWACGYBKSH2DKFJYWI7SUW` | do not use for the vault |
| XLM/USDC | (margin canary pool) | `CBBMQBNHB2FYVZYV7VNHOJHUMTFJLR4PUMRVQYNW6RHIKZO2NQMIBUCV` | pool id `24f9c991c44acf33fff5f44031c40385d235dc212d7379e824ba3db1c35371f3`; used for margin swaps |
| AQUA/USDC | route for harvest | `CA6GAFOJCW4MGQQBUCQUSA3CLIH25G4SNKB2JHYKZCVWZTNW5VXMSC4O` | deepest AQUA route (about $520k) |
| AQUA/PYUSD | route for harvest | `CADFWSBBD6VMCL45DEPZ37X3JNXOZXIWEVJJTHMQH3UEB3JSQVJSPG2I` | |
| xSolvBTC/SolvBTC | stable 0.1% | `CCNXGPE4AQCSNEBZO3XJDKKDI3CRLYMVS6UWBBTVDLALLWMJEXBORQ2A` | largest Aquarius pool; same-pair CP pool `CDTDURXP...` is empty, do not use |

Testnet: XLM/mock-USDT pool `CCMNSENXDBNJSY72BDIPH5CCXLLHBKZ4LXTRKDLKZN4UI2NJFQLWTLD6` (pool id `9ac7a9cde23ac2ada11105eeaa42e43c2ea8332ca0aa8f41f58d7160274d718e`), USDT/XLM CL 0.3% `CA6DAGOMK5D7GKBNWVCIEAYSTPJXLQUFWFKSZOMNEM6BVOTUBDCTIT5I`; testnet AQUA `CDNVQW44C3HALYNVQ4SOBXY5EWYTGVYXX6JPESOLQDABJI5FC5LTRRUE`.

Pool: `estimate_swap(in_idx, out_idx, in_amount) -> u128`, `swap(user, in_idx, out_idx, in_amount, out_min) -> u128`, `claim(user) -> u128`; indices refer to the pool's sorted token vector.

Concentrated liquidity (pool_type `"concentrated"`; fee tiers 10 / 30 / 100 bps with tick spacing 20 / 60 / 200): `estimate_deposit_position(tick_lower, tick_upper, desired_amounts)`, `deposit_position(...)` with `min_liquidity`, `withdraw_position(...)` with `min_amounts` (also pays accrued fees), `claim_position_fees(owner, tick_lower, tick_upper)`, `claim_all_position_fees(owner)`, `get_position(owner, tick_lower, tick_upper)`, `get_user_position_snapshot(user)`, `get_user_reward(user)`. Full signatures: Aquarius docs, "Concentrated liquidity / Contract interface reference". The docs do not state whether CL is live on each network: check with `get_info` on the pools you find.

## XOXNO Lending

From `xoxno-contract-sdk` 0.3 `src/networks.rs` (generated from the deployment config):

| Contract | Mainnet | Testnet |
|---|---|---|
| Controller (entry point) | `CAUCMIN5KSXEVZ7NMXR3LZATGD5EFIEUI5XWTFLYRO2R5OTXI22WE5JX` | `CCXRWJ6SIU2WPFEGLFGJVITPL57QAYIMIO6OAM2NBGNDQSSCK2FFV3F3` |
| Pool | `CBXRNDQMAJFG4VUKMKFEMFS75UUXE2SPSNV4LEEFCSNBCN66PYRWBKXO` | `CBSGF6QOQAMPFBEVSYPEQHSZRIHJ6RCGUPCRDMUX36DEKRWFAO2PZB5A` |
| Position NFT | `CAWCSG77AY2W24QZ6ZXLHZU4UXEFHZBM6EI4A4IF7JB5CTY4XND3TI6C` | `CDVN5JU675MEDPVRPCYC45AHFC275UH57WEU5OTFE4WFGZBNN7HTLPSY` |
| Governance | `CC44PEQW7HSEPKAZ5ZRPH2JS5M5KVJXCUBLJ2ZX4E3WCDKMNFILHC2AD` | `CDS33JDOYH3F3FL4QUQ6DV4WKHML2AKHF4LADTZ57FRUAEBTE7NMY5FQ` |

- Hubs 1, 2, 3 on both networks. Mainnet spokes: 1 Blue Chip, 2 Etherfuse RWA, 3 Centrifuge RWA, 4 Stables and FX, 5 AMM Collateral, 6 Ondo RWA, 7 Commodities, 8 Aquarius Ecosystem. Testnet spokes: 1 Main (USDC/EURC/XLM/BTC), 2 XLM + USDC, 3 Full, 4 LP Tokens.
- Use `LendingAddresses::mainnet(&env)` / `::testnet(&env)` rather than hardcoding; use `find_market` / `is_listed` / `can_supply` to pick the `HubAssetKey` and spoke for USDC and XLM. Governance can add spokes later: read `get_spoke` live.

## Zenex (Zenith Protocols, perps)

Mainnet only (the deployments page lists no testnet). Values checked by Zenex on 6 Oct 2026:

| Contract | Mainnet |
|---|---|
| Market XLM-USD (vault orders go here) | `CAOZCITWHWAXH5FRU4EULQ5EN2HMTCHICRNC4R5ZAOVD7XHCCQSJ42IB` |
| Strategy vault XLM-USD (share token `xvXLMUSDC`) | `CB2MX4WXJHOHCTDTN5DCFC7G3TLFLOYLCRCINPK7G2A3EUVW2AYVA56N` |
| Settlement token | USDC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| Factory | `CDFEZPO7ZMXMZUMOIT2CZF5FUEIGD3CC5VOROUKF4KZEQQEDZBGSQYPQ` |
| Oracle | `CBQP3O5NW6S4ZRE4SZAUO3VDOR32OMO22FLLMP3DJMO3TXJEPNW65XXU` |
| Market router | `CDOF5KRURJ7RRBPORHYSSKT727X3IBNF3LGOFHZND4HBTS5FRUZRJEZT` |
| Treasury | `CDDEOTFOD5O2GOVMANJUIKLLQ5UDJCU3XFBXGTUWQYOUV5HF4OV6AU7U` |

Vault settings that matter for us: min deposit 10 USDC; vault balance cap 100,000 USDC; deposit fee 0.1%, redeem fee 0.25%; redeem cooldown 1 hour; redeems can be blocked while pending trader profit is high; execution fee per order (`Config.exec_fee`). Interface and adapter design: `10-VAULT-ZENEX.md`.

## Swap routing for margin and liquidations

Peridot's `swap-adapter` (mainnet instance `CCEMGF23...`, used by the margin controller `CC2MVMWN...` with the XLM/USDC pool above) already has clients for the Aquarius router (`swap_chained`) and pools (`estimate_swap`, `swap`) and for Soroswap. Point the per-group swap-adapter at the Aquarius router above and allowlist the pools returned by `get_pools` for each margin market.

## Sources

- Peridot: `peridot-contracts/addresses.md` and `scripts/*mainnet*.sh` on branch `leveraged-fix` of PeridotFinance/Peridot-Soroban

- Reflector and other oracles: https://developers.stellar.org/docs/data/oracles/oracle-providers
- Blend deployments: https://github.com/blend-capital/blend-utils (`mainnet.contracts.json`, `testnet.contracts.json`); fee vault: https://github.com/script3/fee-vault, https://docs.blend.capital/tech-docs/integrations/fee-vault
- DeFindex: https://github.com/paltalabs/defindex (`public/*.contracts.json`, `apps/contracts/vault`, `apps/contracts/factory`)
- Aquarius: https://docs.aqua.network/developers/code-examples/prerequisites-and-basics, https://docs.aqua.network/developers/reference/router-and-pool-contracts, https://docs.aqua.network/developers/concentrated-liquidity
- XOXNO: https://github.com/XOXNO/xoxno-contract-sdk (`crates/xoxno-contract-sdk/src/networks.rs`)
- Zenex: https://docs.zenex.trade/deployments, https://github.com/zenith-protocols/zenex-docs (`technical/market/vault-orders.md`, `technical/vault/*`)
