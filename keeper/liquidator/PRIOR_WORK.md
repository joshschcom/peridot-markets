# Liquidator prior work

| Imported path | Source | Commit |
|---|---|---|
| `margin/` | `PeridotFinance/Peridot-Soroban/peridot-contracts/bots/margin-liquidator` | `47858c1a13c2588970395faa2212e7b68bd33060` |
| `lending-reference/` | `PeridotFinance/Peridot-Soroban/peridot-bots/liquidator` | `fe8d562051195dbc0af667367514b479de36fc8d` |

Imports contain tracked source, tests and deployment examples. Generated `dist`, dependencies and secret `.env` files are excluded. The existing V3 liquidation state machine, fee policy, PostgreSQL journal and replay protections are prior work.

New HackMeridian files:

- `margin/src/group-config.mjs`: explicit group, network and manifest validation; factory discovery.
- `margin/src/group-main.mjs`: group-scoped service entry point and serialized lifecycle.
- `margin/src/refresh.mjs`: phase 1 permissionless boosted-value refresh.
- `margin/src/status.mjs`: health and public service status.
- `margin/src/lending.mjs`: ordinary lending algorithm adapted from the attributed reference, with strict reads, integer bounds, durable borrower discovery and the shared guarded transport.
- `margin/test/lending.test.mjs`: borrower history, repayment bounds, signer role and failure propagation.
- `margin/test/group-journal.test.mjs`: scoped intents across worker roles.
- `margin/test/group.test.mjs`: configuration, group isolation, refresh and HTTP status regressions.
- Group-specific environment example, container setup and operating instructions.

Changes to imported files:

- `config.mjs`: dry-run/mainnet defaults and mandatory explicit controller for the legacy direct entry point.
- `stellar.mjs`: fail closed on incomplete read/dry-run simulations and record the called contract in durable intents, and verify both receipt hashes before ordinary liquidation signing.
- `safety.mjs`: dedicated roles permit only argument-free `refresh_boosted_underlying()` or group-scoped ordinary `liquidate()` with bounded repayment and the keeper as beneficiary.
- `journal.mjs`: one signing-account lock and rolling fee budget cover both group controllers and the selected group's explicitly approved boosted receipt vaults. Every intent records its actual target. Unknown targets remain rejected.
- `package.json`, lock metadata and `Dockerfile`: group-aware start command and package/container configuration.
- `test/config.test.mjs`: explicit network/controller fixture for stricter defaults.
- `test/journal-postgres.test.mjs`: real restart coverage for an approved receipt-vault refresh intent.

No V2 margin calls are introduced. The selected core exposes staged V3 liquidation.

The ordinary bot remains unmodified reference code. Its stale defaults, concurrent submissions and floating-point thresholds are not used by the active adaptation. The new worker uses explicit network/group configuration, sequential transactions, integer arithmetic and persistent event backfill or an operator-attested complete snapshot.
