# Launchpad on mainnet: what the app needs

Source of truth: `deployments/mainnet.json` (keys `launchpad_factory`, `launchpad`, `launchpad_demo`, `wasm.launchpad_*`, `wasm.price_router`). Deployed 2026-10-26, see the launchpad section of `docs/DEMO-MAINNET.md`. `app/src/lib/launchpad/config.ts` currently only exports `LAUNCHPAD_TESTNET`; the mainnet equivalents below are the values to add (same shape, so the pages can be switched by `NEXT_PUBLIC_NETWORK`).

## Constants (mirror `LAUNCHPAD_TESTNET`)

| Field in config.ts | Mainnet value |
|---|---|
| `network` | `'mainnet'` |
| `launchpad_factory` | `CAN6YNLFZHMLHPZAMSLR2BTIM7VOS6YZEXJSZAXQEHKPO7BN4RP5NA7J` |
| `market_factory` | `CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S` |
| `aquarius_router` | `CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK` |
| `wasm.launchpad_token` | `aab4c9e060086d8928459dd4efe16c1ecc381b3eb9abdf55d363b9914965a550` |
| `wasm.launchpad_curve` | `bdde6afcccaafe445652294c3b03d382cfdc905a4fc7a25534a6daf6bb16420c` |
| `wasm.launchpad_factory` | `e7c070cecffa912ba791a63bc377299965635be62dd3f5e3b6dd72b62b71304d` (differs from the testnet factory hash `71944f62...`: same source, different build path) |
| `demo.first` (PDEMO) | token `CDKHQPYSBULW3T2FNLPKKKXVKREDYZTI37KRURBNVNEUIZ5YDT4O4DYT`, curve `CDWJL4YJ4H546FFXNXSNREW27PFQFNMBQPXDIUHTN765Z52MRDUJH43A`, `target_xlm: 500` |
| XLM quote token (`TESTNET_XLM` equivalent) | `Asset.native().contractId(Networks.PUBLIC)` = `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| Passphrase (`TESTNET_PASSPHRASE` equivalent) | `Networks.PUBLIC` = `Public Global Stellar Network ; September 2015` |
| RPC (`TESTNET_RPC_URL` equivalent) | `NEXT_PUBLIC_MAINNET_RPC_URL`, default `https://soroban-rpc.mainnet.stellar.gateway.fm` (the `mainnet.sorobanrpc.com` endpoint timed out repeatedly) with the existing fallback |
| Explorer (`TESTNET_EXPLORER` equivalent) | `https://stellar.expert/explorer/public` |
| Aquarius swap page (graduation needs AQUA) | `https://aqua.network/swap/` (mainnet; confirm before linking) |

No `demo.graduated` entry exists on mainnet (graduation has not happened and costs 300,000 AQUA).

## Env

No new env names are required by `config.ts` for mainnet beyond the existing ones: `NEXT_PUBLIC_NETWORK=mainnet`, `NEXT_PUBLIC_MAINNET_RPC_URL`, `NEXT_PUBLIC_MAINNET_FALLBACK_RPC_URL`, `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_READ_ONLY` (true for a preview that must not sign). `NEXT_PUBLIC_TESTNET_APP_URL` becomes optional once the mainnet launchpad is live. `launchpadMode()` currently returns `remote` on mainnet builds; it needs a `live` branch for mainnet using the constants above.

## Facts the UI can rely on

- The factory is **open** (not paused, no launch fee). Presets for the XLM quote: Fast = 500 XLM target (demo size), Standard = 85,000 XLM, Slow = 250,000 XLM. Read them with `get_preset(quote_token, preset)` (`Preset` is an integer enum: 0 Fast, 1 Standard, 2 Slow).
- `create_plain_token(creator, name, symbol, supply_whole, metadata_uri)` is live (simple token path, supply in whole tokens, 7 decimals).
- `launch_curve` needs the creator's authorisation only; `creator_buy` is paid in XLM and is atomic with the launch; `min_tokens_out` must be positive when `creator_buy > 0`.
- Graduation: `graduation_cost()` returns (AQUA contract `CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK`, `3000000000000` = 300,000 AQUA). The payer needs an AQUA trustline and balance; show this before the first graduation step. The market-factory now accepts `AquariusOnly` markets from curves of this launchpad (`get_launchpad` returns the factory) and new groups use the AquariusOnly-capable price router `14c83a90...`.
- Risk copy to keep visible: a 500 XLM raise is below the price router's 500 USD per pool side floor, so a graduated Fast token gets a supply-only market until the pool is deeper.
- The app's `app/src/lib/peridot/deployments/mainnet.json` snapshot must be re-synced from `deployments/mainnet.json`: `wasm.price_router` changed to `14c83a90...` (previous value kept as `wasm.price_router_legacy`, still the router of groups 1 to 3), and `wasm.market_factory_v2` records the new market-factory Wasm now running at `factory`.
