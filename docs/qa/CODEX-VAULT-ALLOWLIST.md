# Codex review: allow-listing the Zenex and XOXNO vaults on the mainnet market-factory

Date 2026-10-26. Read-only Codex pass over `contracts/zenex-vault`, `contracts/xoxno-vault`, `contracts/market-factory` (`set_yield_vault_allowed`, `check_defindex`, `attach_yield`) and `core/receipt-vault`. Nothing was executed on chain for this document. Codex assumed the source matches the uploaded wasm hashes (no adapter source changed after the latest wasm commits `0a617ea` Zenex and `6d8b130` XOXNO) and did not verify live state.

Target factory: `CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S`. Admin: `GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH` (identity `peridot-mainnet-admin`).

| Vault | Wasm | Demo instance | Recommendation |
|---|---|---|---|
| Zenex (USDC) | `99a3fc7e0275a209f44a50256d822ccfcad4da0d2824979ec7f08dc32abff399` | `CD6ZTDY6MTACM5D3BY7OW3SXZDAQ322RQUOFEFXBWU44TLO4LXIZQRMP` | **DO NOT ALLOW-LIST** for a production market |
| XOXNO (XLM) | `61d1443a708a10691ad6cf955584cf43cb4fd9465e4c40e927ad1673bb63bc23` | `CCXPXDV3VXQE2WHOQOBRO7XSQTPJXSYWRF4H3UHIEWNVGL2RRYDIHCDC` | **ALLOW-LIST WITH CONDITIONS**, demo-sized only |

## What an allow-listed vault can do to a market (shared)

- The allow-list is a permission flag only. It changes no existing market. `attach_yield` checks: flag set, exactly one asset equal to the market token, one unpaused strategy, and a zero-share quote of length 1. It does not check binding, owner, code hash, caps, liquidity or pricing.
- Market guardrails require positive supply and borrow caps and an idle buffer of 1,000 to 10,000 bps. There is no separate cap on the yield allocation and no clipping to the vault's headroom.
- Routed deposits are reverting calls: an adapter pause, cap or failed external supply can revert the market deposit. A stuck investment blocks redemptions and borrowing whenever market cash is short, and a final redemption must exit the remaining strategy shares.
- Both adapters share one trust root: the baked admin `GC3FLITV...7CXH` can `upgrade` either adapter immediately, with no timelock, and then take whatever the adapter holds plus all later routed deposits. Owner and keeper limits do not survive a malicious upgrade. It cannot reach unrelated idle cash held by the market.
- Rollback is weak: `set_yield_vault_allowed(admin, vault, false)` only blocks FUTURE attaches. A market that already attached keeps its `BoostedVault`, keeps depositing and withdrawing, and can stay stuck. Raising the idle buffer lowers the target allocation but does not detach or unwind, and `switch_yield` returns `Unsupported`. So treat the allow-list call as hard to undo once a market is attached; the real rollback for an attached market is to drain the adapter (owner `unwind`/withdraw, wind-down) and a code upgrade, not the flag.

## Zenex vault (DO NOT ALLOW-LIST)

- NAV can overstate recoverable USDC: valuation uses `preview_redeem(shares, 0)`, which ignores pending trader PnL, and a fixed 0.5 to 20% haircut does not guarantee a conservative price. Trader profits can become a loss for depositors after others redeemed at the overstated NAV (`zenex-vault/src/lib.rs:419`).
- Donations (USDC to the adapter, Zenex shares, donations to the Zenex vault) move the reported backing and the market's exchange rate. Mint rounds down without virtual shares, so inflated NAV can cause `ZeroShares` or exhaust the cap. The classic outsider first-depositor theft is blocked (only the bound market deposits, shares are not transferable) (`:390`, `:558`).
- Withdrawals are buffer-limited. `withdraw` fails if the local USDC buffer cannot cover the payout; refilling needs a keeper `sync`/`unwind` and a Zenex fill that waits at least 1 hour and depends on exec-fee funding, oracle availability, Zenex liquidity and its redemption lock. A keeper that does nothing strands withdrawals. Pause blocks deposits and new orders, not withdrawals (`:622`, `:696`, `:766`).
- Authority: `bind_market` is owner-authenticated, once, with zero shares, so no stranger can front-run it. Owner can rotate the keeper, change buffer, slippage and cap, and raise the haircut (instantly lowering NAV). The keeper can only move funds to the fixed Zenex venues; there is no sweep. Zenex's own owner/governance can freeze its market.
- Needed before listing: PnL-aware valuation and a workable delayed-exit and recovery path. For a later isolated demo: adapter cap at most 1,000 USDC, a much smaller initial allocation, market idle buffer at least 5,000 bps (the factory does NOT enforce it), adapter target buffer at least 2,000 bps. These limit exposure, they are not solvency guarantees.

## XOXNO vault (ALLOW-LIST WITH CONDITIONS)

- NAV is the lending claim from the XOXNO controller (`get_collateral_amount`, `xoxno-vault/src/lib.rs:314`), not cash available now. XOXNO bad-debt socialisation lowers supplier indexes; unrecognised bad debt can overstate recoverable value. Direct token donations to the adapter are excluded from NAV (and not recoverable); top-ups of the controller account raise the claim.
- Concrete bug to know about: `get_asset_amounts_per_shares` ignores pending performance fees, but a withdrawal first mints dilution shares to the owner. With 100 growing to 110 XLM and a 10% fee, the quote is about 110 and the holder receives about 109. The market sizes a redemption from the quote and requires its cash shortfall as the minimum output, so withdrawals or borrows can revert until fees are crystallised. Full-exit rounding can also clash with the wrapper's exact minimum (`:332`, `:529`, `:609`). Mitigation for a demo: owner fee set to 0.
- Blocking: adapter pause, cap, minimum deposit (1 XLM, constructor-fixed), impairment or a failed XOXNO supply reject deposits. Withdrawals stay open during an adapter pause but need XOXNO cash and exact settlement; an external listing pause can block exits (`:425`, `:678`). Owner can move the cap up or down, set the fee up to 20%, and redeem fee shares. XOXNO governance and its oracle administration are extra trust boundaries.
- Binding: owner-authenticated, once, zero total shares, no front-running. The existing demo vault holds about 3 XLM (after the 2 XLM partial withdrawal), so it must be emptied completely, fee shares included, before `bind_market`.
- Conditions: (1) empty the demo vault, then bind it to the exact market; (2) adapter cap at most 10 XLM, market supply cap at most 10 XLM, idle buffer at least 5,000 bps; (3) fee 0 for the demo or fix fee-net quoting first; (4) test a small deposit, the cap boundary and a complete redemption through the real receipt wrapper before announcing it. Production approval also needs an enforceable allocation limit, fee-consistent accounting and verified XOXNO governance.

## Commands for Lead A (NOT executed)

Run only after the conditions above are met and the vault is bound to the target market. Network `mainnet-public` (use `mainnet-gateway --inclusion-fee 2000` if the public RPC is flaky).

```
# XOXNO demo vault (conditions apply)
stellar contract invoke --id CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S \
  --source-account peridot-mainnet-admin --network mainnet-public -- \
  set_yield_vault_allowed --admin GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH \
  --vault CCXPXDV3VXQE2WHOQOBRO7XSQTPJXSYWRF4H3UHIEWNVGL2RRYDIHCDC --allowed true

# Zenex demo vault: NOT recommended for a production market. Only for an isolated demo market with the Zenex limits above.
stellar contract invoke --id CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S \
  --source-account peridot-mainnet-admin --network mainnet-public -- \
  set_yield_vault_allowed --admin GC3FLITV3KLO5RUJLJWXM5O5MMWVDIF5RX64Y46YZFHP3WVYQBF37CXH \
  --vault CD6ZTDY6MTACM5D3BY7OW3SXZDAQ322RQUOFEFXBWU44TLO4LXIZQRMP --allowed true

# Verify (read-only)
stellar contract invoke --id CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S --network mainnet-public --source peridot-mainnet-admin --send=no -- is_yield_vault_allowed --vault <VAULT>

# Rollback: stops new attaches only; an already attached market is NOT detached (see above)
... -- set_yield_vault_allowed --admin GC3FL...7CXH --vault <VAULT> --allowed false
```

## Aquarius vault pass (for the record)

Codex pass on the aquarius-vault mainnet wasm `77ead300...dd76` (source identical to the vault-factory branch; hash reproduced in this checkout): no P0 for an unbound demo of at most 10 XLM, VERDICT GO. The crate has no baked admin and no upgrade path. Open P1/P2 items: spot-price NAV and swap slippage measured against the pool's own spot (sandwich or colluding keeper can move fees and execution), AQUA harvest only claims (no conversion route, `_min_out` ignored, owner can `sweep_extra` AQUA), the market wrapper can still revert on pool or pricing errors, constructor bounds allow unusable configs (cap below the minimum first deposit), and the cap is owner-mutable. None of these block an unbound demo; they matter before any market is bound.
