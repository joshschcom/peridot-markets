# 04 Vault agent: DeFindex route (small task, the lead can take it)

**Addresses (from 11-ADDRESSES.md):** factory mainnet `CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI`, testnet `CDSCWE4GLNBYYTES2OCYDFQA2LLY4RBIAX6ZI32VSUXD7GO6HRPO4A32`. Testnet vaults: USDC `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN`, XLM `CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6`. Mainnet vaults already used by Peridot (from `addresses.md` on `leveraged-fix`): Peridot XLM `CCB2AR5X...`, USDC `CAB4JOLS...`, EURC `CBP2R5KY...`; Soroswap/DeFindex USDC `CA2FIPJ7...`, EURC `CCKTLDG6...`. For new groups, create one vault per group market from the factory with the Blend autocompound strategies listed in 11, so groups stay isolated; Peridot's core-market vaults stay with the core markets. Interface verified against `apps/contracts/vault/src/lib.rs`.

**Phase 1.** No new contract. Find the **mainnet** DeFindex vaults (USDC, XLM) as well as testnet ones; phase 1 ships on mainnet.

Read `00-DROPOFF.md` sections 0 to 7 first. DeFindex is an official HackMeridian partner, and Peridot's `receipt-vault` boosted hook was built against the DeFindex vault interface. **No adapter is needed.** A DeFindex vault is attached directly.

## Tasks

1. Find testnet DeFindex vaults for USDC and XLM (DeFindex docs, `defindex-sdk` on npm, or the DeFindex team at the event). Record them in `external.defindex_vaults`.
2. Verify the interface matches what `receipt-vault` calls: `deposit(amounts_desired, amounts_min, from, invest)`, `withdraw(shares, min_amounts_out, from)`, `get_asset_amounts_per_shares(shares)`, `balance(id)`. Use `stellar contract info interface`. Note any differences (for example DeFindex `withdraw` arg changes in newer versions) in SPECS.md.
3. Factory side (`YieldRoute::Defindex { vault }`): `attach_yield` validates that the vault's first asset equals the market underlying (`get_assets` or equivalent), then `set_boosted_vault` + `bind_boosted_vault`. No deploy.
4. `kind`/`get_state` are not available on DeFindex vaults. The frontend reads DeFindex state via the DeFindex SDK or `get_asset_amounts_per_shares` + `balance(market)`. Tell the frontend agent which calls to use.
5. Integration test on testnet: supply to a market routed to DeFindex, check funds moved, withdraw.

## Deliver

Vault addresses, SPECS.md section "DeFindex route", one testnet tx pair in DEMO.md.
