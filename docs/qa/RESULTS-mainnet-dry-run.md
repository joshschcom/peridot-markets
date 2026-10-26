# Mainnet dry run (simulation only, nothing submitted)

Source account: deployer public address GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH. Mainnet limits: 400M instructions, 200 disk reads, 200 writes, 400 footprint entries per tx. `fee` = prepared transaction fee in stroops (resource fee + inclusion).

| Flow | Step | Verdict | Insn (M) | Entries (ro/rw) | Fee (stroops) | Error / note |
|---|---|---|---|---|---|---|
| group1 Meridian | enter_market USDC (Enable collateral) | SIM-OK | 2.3 | 12 (10/2) | 180698 |  |
| group1 Meridian | supply 1 USDC | CLIENT-GUARD |  |  |  | Error: Add a USDC trustline with your wallet before receiving or using this asset, then refresh balances. |
| group1 Meridian | withdraw 0.5 USDC | CLIENT-GUARD |  |  |  | Error: Add a USDC trustline with your wallet before receiving or using this asset, then refresh balances. |
| group1 Meridian | withdraw all USDC | CLIENT-GUARD |  |  |  | Error: Add a USDC trustline with your wallet before receiving or using this asset, then refresh balances. |
| group1 Meridian | boosted health cache age of XLM market (borrow/margin fail closed when > 300 s) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| group1 Meridian | refresh_boosted_underlying XLM (permissionless; the fix for stale cache) | SIM-OK | 5.3 | 20 (16/4) | 42553 |  |
| group1 Meridian | enter_market XLM (Enable collateral) | SIM-OK | 2.2 | 12 (12/0) | 9765 |  |
| group1 Meridian | supply 1 XLM | SIM-OK | 40.4 | 71 (51/20) | 95813 |  |
| group1 Meridian | withdraw 0.5 XLM | SIM-OK | 34.9 | 82 (71/11) | 77525 |  |
| group1 Meridian | withdraw all XLM | SIM-OK | 49.9 | 87 (69/18) | 97631 |  |
| group1 Meridian | borrow 1 XLM against the deployer XLM deposit | SIM-FAIL |  |  |  | Error: Simulation failed: HostError: Error(WasmVm, InvalidAction) Event log (newest first): 0: [Diagnostic Event] contract:CCK7R22G3HOZDJXU6DVDEXK4HZ6AS3DHHFCAFOMY22XQEA3DJHRRSNXI, topics:[error, Error(WasmVm, InvalidAction)], dat |
| group1 Meridian | borrow 1 USDC (market has no liquidity) | CLIENT-GUARD |  |  |  | Error: Add a USDC trustline with your wallet before receiving or using this asset, then refresh balances. |
| group1 Meridian | repay 1 XLM (no debt) | SIM-OK | 16.5 | 48 (47/1) | 23533 |  |
| group1 Meridian | repay all XLM (no debt) | SIM-OK | 12.5 | 44 (43/1) | 21314 |  |
| group2 Rewards | enter_market XLM (Enable collateral) | SIM-OK | 2.2 | 12 (12/0) | 9778 |  |
| group2 Rewards | supply 1 XLM | SIM-OK | 23.1 | 68 (60/8) | 42851 |  |
| group2 Rewards | withdraw 0.5 XLM | CLIENT-GUARD |  |  |  | Error: Withdrawal exceeds your available collateral or market liquidity. |
| group2 Rewards | withdraw all XLM | CLIENT-GUARD |  |  |  | Error: Withdrawal exceeds your available collateral or market liquidity. |
| group2 Rewards | claim rewards (accrued 21000) | SIM-OK | 11.5 | 58 (53/5) | 29431 |  |
| group3 BlendDemo | boosted health cache age of XLM market (borrow/margin fail closed when > 300 s) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| group3 BlendDemo | refresh_boosted_underlying XLM (permissionless; the fix for stale cache) | SIM-OK | 2.0 | 10 (7/3) | 12170 |  |
| group3 BlendDemo | enter_market XLM (Enable collateral) | SIM-OK | 2.2 | 12 (12/0) | 9764 |  |
| group3 BlendDemo | supply 1 XLM | SIM-OK | 28.7 | 70 (52/18) | 114483 |  |
| group3 BlendDemo | withdraw 0.5 XLM | CLIENT-GUARD |  |  |  | Error: Withdrawal exceeds your available collateral or market liquidity. |
| group3 BlendDemo | withdraw all XLM | CLIENT-GUARD |  |  |  | Error: Withdrawal exceeds your available collateral or market liquidity. |
| margin group1 | marginContext (get_margin_status + effective_max_leverage) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| margin group1 | quoteOpen 0.5 XLM 2x long USDC (fees, pair config, prices, pool route, estimate_swap) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| margin group1 | openPosition stage 1: transfer_spot_to_margin (later stages cannot simulate without it) | SIM-OK | 34.9 | 76 (68/8) | 1785900 |  |
| margin group1 | positions() read for deployer | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| margin group1 | withdrawMargin (no free margin) -> expected client guard | CLIENT-GUARD |  |  |  | Error: No free margin available for this asset. |
| margin group1 | DIAG begin_open_position_v3 without prior transfer (expect insufficient margin balance) | SIM-FAIL |  |  |  | Error: Simulation failed: HostError: Error(WasmVm, InvalidAction) Event log (newest first): 0: [Diagnostic Event] contract:CCWAUBM6C5RRPBFKJK57I56GXRCILOKRVJEOAGEI7ZHKXVSOHEL5JPEY, topics:[error, Error(WasmVm, InvalidAction)], dat |
| control group1 | loadControl (markets, pending, events history, margin, rewards) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| control group1 | update_rates USDC (unchanged curve) | SIM-OK | 2.4 | 11 (6/5) | 18001 |  |
| control group1 | update_idle_buffer USDC (unchanged) | SIM-OK | 5.9 | 37 (35/2) | 18881 |  |
| control group1 | update_risk USDC (supply cap +1) | SIM-OK | 6.8 | 39 (37/2) | 19720 |  |
| control group1 | update_risk USDC (CF -1pt -> staged) | SIM-OK | 5.6 | 18 (15/3) | 748247 |  |
| control group1 | update_price USDC (same approved tuple -> staged) | SIM-OK | 1.6 | 4 (3/1) | 439321 |  |
| control group1 | pause_market USDC (no-op false,false) | SIM-OK | 7.6 | 20 (16/4) | 428976 |  |
| control group1 | apply_pending with nothing staged | SIM-OK | 1.4 | 5 (5/0) | 7810 |  |
| control group1 | sync_pairs (syncLeverageLimits) | SIM-OK | 44.2 | 27 (26/1) | 26367 |  |
| control group1 | update_margin (same config) | SIM-OK | 3.8 | 17 (16/1) | 13595 |  |
| control group1 | set_market_margin USDC true | SIM-OK | 48.7 | 32 (30/2) | 31270 |  |
| control group1 | set_rewards XLM (group 1 has none; would lock the market list) | SIM-OK | 5.1 | 19 (15/4) | 947920 |  |
| control group2 | loadControl (markets, pending, events history, margin, rewards) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| control group2 | update_rates XLM (unchanged curve) | SIM-OK | 2.4 | 11 (6/5) | 17999 |  |
| control group2 | update_idle_buffer XLM (unchanged) | SIM-OK | 5.9 | 37 (35/2) | 18871 |  |
| control group2 | update_risk XLM (supply cap +1) | SIM-OK | 6.8 | 39 (37/2) | 19710 |  |
| control group2 | update_risk XLM (CF -1pt -> staged) | SIM-OK | 5.7 | 18 (15/3) | 748292 |  |
| control group2 | update_price XLM (same approved tuple -> staged) | SIM-OK | 1.6 | 4 (3/1) | 439359 |  |
| control group2 | pause_market XLM (no-op false,false) | SIM-OK | 7.8 | 20 (16/4) | 429039 |  |
| control group2 | apply_pending with nothing staged | SIM-OK | 1.2 | 4 (4/0) | 7472 |  |
| control group2 | fund rewards 1 unit | SIM-OK | 0.8 | 5 (2/3) | 13609 |  |
| control group2 | set_reward_speeds (unchanged) | SIM-OK | 15.2 | 53 (49/4) | 28925 |  |
| control group2 | withdraw_unallocated 0.1 | SIM-OK | 1.7 | 8 (5/3) | 121234 |  |
| control group3 | loadControl (markets, pending, events history, margin, rewards) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |
| control group3 | update_rates XLM (unchanged curve) | SIM-OK | 2.4 | 11 (6/5) | 18068 |  |
| control group3 | update_idle_buffer XLM (unchanged) | SIM-OK | 6.1 | 37 (35/2) | 18978 |  |
| control group3 | update_risk XLM (supply cap +1) | SIM-OK | 6.9 | 39 (37/2) | 19818 |  |
| control group3 | update_risk XLM (CF -1pt -> staged) | SIM-OK | 5.6 | 18 (15/3) | 748382 |  |
| control group3 | update_price XLM (same approved tuple -> staged) | SIM-OK | 1.6 | 4 (3/1) | 439566 |  |
| control group3 | pause_market XLM (no-op false,false) | SIM-OK | 7.6 | 20 (16/4) | 428988 |  |
| control group3 | apply_pending with nothing staged | SIM-OK | 1.2 | 4 (4/0) | 7475 |  |
| control group1 | add_market EURC after launch (rent of a new market) | SIM-OK | 28.6 | 50 (14/36) | 10048501 |  |
| control group1 | add duplicate XLM market after launch | SIM-FAIL |  |  |  | Error: Simulation failed: HostError: Error(Contract, #6) Event log (newest first): 0: [Diagnostic Event] contract:CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S, topics:[error, Error(Contract, #6)], data:"escalating Ok(S |
| control group1 | add market with CF 90% (client guardrail) | CLIENT-GUARD |  |  |  | Error: Collateral factor must be between 1% and 75%. |
| launch wizard | create_group QaDryRun (first wizard tx; rent estimate) | SIM-OK | 10.7 | 24 (5/19) | 4439816 |  |
| launch wizard | discoverMarginPools XLM+USDC (router get_pools + registry) | SIM-OK |  |  |  | returned without signing (read-only / no tx needed) |

Highest ledger-entry count in any simulated transaction: 87 (limit 400 footprint, 200 reads).
