# Prior work

The HackMeridian build window begins 25 October 2026 at 09:00 Lisbon. Imported code remains prior work regardless of its import date.

| Source | Pinned commit | Use in this repository | Import evidence |
|---|---|---|---|
| PeridotFinance/Peridot-Soroban, leveraged-fix | `47858c1a13c2588970395faa2212e7b68bd33060` | Audited lending core and existing margin, router and vault code | `3833c42` imports core; `206cf00` changes timelock constants |
| Same source, peridot-dashboard | Same pinned commit | Required untouched dashboard base | `6c671e0` untouched dashboard import |
| PeridotFinance/PeridotV2Full | `86ae3795f3ca011bef156f2d9ed8fe900410dc11` | Current frontend reference supplied by Joshua; selected UI and Stellar flow reuse | Selected group flow adaptations in app/src/lib/peridot/margin.ts and group-client.ts; implementation `390cf93`, updates `4f92a41` |
| script3/fee-vault | `1ab9835` (as recorded by Lead A) | Upstream Blend fee-vault implementation built for the mainnet route; not byte-identical to an upstream release | [Deployment and build disclosure](DEMO-MAINNET.md#blend-route-group-3-blenddemo) |
| PeridotFinance/Peridot-Soroban, main | `fe8d562051195dbc0af667367514b479de36fc8d` | Ordinary lending liquidator and idle-cash reference | Imported as `3e182cb` into `keeper/liquidator/lending-reference/`; provenance in `keeper/liquidator/PRIOR_WORK.md` |
| PeridotFinance/Peridot-Soroban, leveraged-fix, peridot-contracts/bots/margin-liquidator | `47858c1a13c2588970395faa2212e7b68bd33060` | Matching staged V3 margin liquidator | Imported and adapted as `3e182cb` in `keeper/liquidator/margin/`; provenance in `keeper/liquidator/PRIOR_WORK.md` |

## Core changes

Core lending contracts are Peridot's audited contracts with one change for the hackathon: upgrade and admin-parameter timelocks shortened from 24h to 60s. The exact diff is maintained by Lead A in [CORE_DIFF.md](../core/CORE_DIFF.md).

This disclosure does not extend an existing audit to new factories, adapters, frontend changes or operations code.

## Built during HackMeridian

Factory-created isolated groups, group configuration screens, launch sequencing, deployment integration and new adapters are tracked in repository commits after the prior-work imports. A feature is described as delivered only when its implementation and evidence exist. See [milestones](MILESTONES.md) and [demo evidence](DEMO.md).

Mainnet contracts and deployer transactions are recorded in [DEMO-MAINNET.md](DEMO-MAINNET.md). Frontend UI updates include launch `f80d4ca`, entry prerequisites `e8a028d` and Control recovery `a7c7879`; these are event work, while the imported trading and lending foundations remain prior work.

## Interface corrections discovered during integration

The pinned reference exposes staged margin V3, not the V2 methods in the initial handoff. Its lending reward claim calls token balance and transfer, not mint. Existing margin fee support is also prior work. These findings are recorded in [COORDINATION.md](COORDINATION.md); new integration code must match the actual ABI.

## Custom margin diff

Phase 3 has not started. No custom-margin diff is claimed.
