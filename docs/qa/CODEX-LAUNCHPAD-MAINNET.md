# Codex second opinion: launchpad mainnet deployment and market-factory upgrade

Run on 2026-10-26 (read-only `codex exec`, before the first mainnet transaction) against branch `launchpad-mainnet`.
Scope: Wasm hashes, constructor and factory parameters, the in-place market-factory upgrade (diff `0849a6a..HEAD`), graduation wiring and `scripts/launchpad_mainnet.sh`.

Verdict: **no blockers** for the upgrade and the single 5 XLM demo token. Three HIGH items concern graduated lending markets, not the deployment.

Pre-checks done by Lead A before the review:
- Live mainnet market-factory Wasm `a5442cae...` was rebuilt from commit `0849a6a` and matches byte for byte, so the diff to HEAD is exact. Only `DataKey::Launchpad` (inserted mid-enum, name-encoded, safe), `set_launchpad`/`get_launchpad`, the `is_curve` check for `AquariusOnly` in `add_market`, `update_price` refusing `AquariusOnly`, and removal of the `margin_enabled && AquariusOnly` check changed. No stored struct changed.
- The new market-factory Wasm `baec971c...` is the same Wasm already running on the testnet factory (in-place upgrade done there on 2026-10-25, 5 groups since, one full graduation).
- Core timelocks: the core Wasm rebuilt with the mainnet INIT_ADMIN reproduces every registered hash, and the deployed controller `dabe8d1c`, receipt vault `8cc9f723`, margin controller `f11f34e7`, reward distributor and Blend adapter match. Source constants are 60 s everywhere except `peridot-token` (24 h, not deployed).

Findings and decisions:

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | HIGH | `price-router-ext` AquariusOnly step guard accepts any move once the anchor is older than 300 s, so a trader can move the pool, call permissionless `cache_price`, liquidate, and reverse. Creator can also raise CF to 50% and caps after `claim_group`. | Known design limit of the AquariusOnly mode. Affects only graduated markets, which cannot occur on mainnet in the demo (300,000 AQUA pool fee). Existing groups keep their old routers. Remediation (TWAP or persistence requirement) goes on the roadmap before any real mainnet graduation. |
| 2 | HIGH | The 500 XLM demo preset yields a quote side of about 84 USD (XLM at 0.169), below the router's 500 USD per side floor, so a graduated market would be unpriceable (supply works, borrowing blocked). Graduation itself still completes. | Accepted for the demo preset (Fast = 500 XLM, same as testnet). Standard and Slow presets (85k, 250k XLM) are the production-sized ones. Documented. |
| 3 | HIGH | `upgrade_launch` lets the factory admin replace a curve's Wasm immediately, so a compromised admin can take curve reserves. | Explicit house-rule trust assumption (immediate upgrades everywhere), stated in SPECS. |
| 4 | MEDIUM | Sticky `Graduatable`: sellers can empty the raise after the target while buys stay closed. | Known and documented design choice; not mainnet-relevant for the demo. |
| 5 | MEDIUM | A pool pre-seeded at another ratio blocks `graduate` (fresh-pool guard), no recovery path. | Already documented in SPECS as a griefing vector; costs the attacker the AQUA fee on mainnet. |
| 6 | MEDIUM | Runbook retries could deploy a second factory or launch a second token and overwrite `price_router_legacy`. | Fixed: `lp-deploy` and `demo` refuse when already recorded, `demo` requires `launch_count == 0`, `price_router_legacy` is only written when the router hash changes. |

Confirmed by Codex: inserting `Launchpad` mid-enum is storage safe; no missing-key panic for existing groups; rollback is `upgrade(admin, a5442cae...)` (code only, it does not undo `set_wasm`); preset encoding `0` is correct; the five preserved Wasm hashes match the live `get_wasm`; the 5 XLM creator buy yields about 29.28M tokens against the 40M cap.

A first Codex run was interrupted by a model-capacity error and its scratch files were overwritten by another agent working in the same scratchpad; the review above is the complete re-run.
