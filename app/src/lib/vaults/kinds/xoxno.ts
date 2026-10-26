/** XOXNO Lending vault: one asset supplied to the real XOXNO Lending controller (supply only, never borrows).
 * Constructor (contracts/xoxno-vault `__constructor`): owner, depositor, underlying, hub_id, spoke_id, keeper,
 * deposit_cap (i128), min_deposit (i128), fee_bps (u32). The XOXNO controller and the protocol admin are baked
 * into the Wasm, so they are not form fields. Bounds here mirror the contract (fee at most 2000 bps, cap above
 * zero, minimum deposit not above the cap); the constructor enforces them again. */
import type { PreviewModel, VaultCtx, VaultKind, Values, Validation } from './types';
import { parseScaled } from './schema';

export const XOXNO_BOUNDS = { feeMaxBps: 2000, idMax: 1000 } as const;
/** Testnet XLM Stellar Asset Contract: supplied by the demo vault (XOXNO testnet hub 1, spoke 1). */
export const XOXNO_TESTNET_XLM = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
/** Mainnet XLM Stellar Asset Contract (peridot-contracts/addresses.md, Assets): listed by XOXNO mainnet hub 1, spoke 1. */
export const XOXNO_MAINNET_XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';

function validate(v: Values, ctx: VaultCtx): Validation {
  const errors: Record<string, string> = {}; const warnings: string[] = [];
  const cap = parseScaled(v.cap ?? '', ctx.decimals), min = parseScaled(v.minDeposit ?? '', ctx.decimals);
  if (cap !== null && cap <= 0n) errors.cap = 'The deposit cap must be above zero.';
  if (min !== null && min <= 0n) errors.minDeposit = 'The minimum deposit must be above zero.';
  if (cap !== null && min !== null && min > cap) errors.minDeposit = 'The minimum deposit cannot exceed the deposit cap.';
  if (v.depositor && v.depositor !== v.owner) warnings.push('Only the depositor address can deposit. Use a Peridot market vault address here only if that market is meant to route into this vault.');
  if (ctx.net === 'mainnet') warnings.push('This vault kind has not been audited. Start with a small cap.');
  return { errors, warnings };
}

function summary(v: Values): string[] {
  const own = v.depositor === v.owner;
  return [
    `Supplies ${v.underlying ? 'the chosen token' : 'one token'} to XOXNO Lending (hub ${v.hubId}, spoke ${v.spokeId}). It never borrows.`,
    `${own ? 'Only you can deposit.' : 'Only the depositor address can deposit.'} Deposits stop at ${v.cap} tokens and each deposit must be at least ${v.minDeposit}.`,
    `You (the owner) take ${v.fee}% of the yield, paid as vault shares when the keeper harvests. The owner cannot withdraw depositors' funds.`,
    'Peridot admin can pause new deposits and upgrade the code. Withdrawals are never blocked by a pause.',
  ];
}

function preview(v: Values): PreviewModel | null {
  const fee = Number(v.fee);
  if (!Number.isFinite(fee)) return null;
  return { type: 'rows', title: 'Vault summary', rows: [
    ['Venue', 'XOXNO Lending, supply only'],
    ['XOXNO market', `hub ${v.hubId}, spoke ${v.spokeId}`],
    ['Deposit cap', `${v.cap} tokens`],
    ['Minimum deposit', `${v.minDeposit} tokens`],
    ['Performance fee', `${fee.toFixed(2)}% of yield, as vault shares to the owner`],
    ['Who can deposit', v.depositor === v.owner ? 'Owner wallet' : 'A single depositor address'],
  ] };
}

export const xoxnoKind: VaultKind = {
  id: 'xoxno',
  name: 'XOXNO Lending vault',
  tagline: 'Supply one asset to XOXNO Lending with your own cap and fee',
  description: 'A vault that supplies one asset to XOXNO Lending (hub and spoke lending on Stellar) and tracks depositors with shares. It implements the same yield-vault interface as the Blend adapter, so a Peridot market can later use it as a yield route. You set the asset, the XOXNO hub and spoke, who can deposit, a deposit cap and a performance fee. Runs against the real XOXNO Lending deployment on mainnet (hub 1, spoke 1 lists XLM) and on testnet.',
  status: 'live',
  risks: [
    'XOXNO Lending risk applies: smart contract risk, bad debt or an exhausted pool can delay withdrawals. The vault fails a withdrawal cleanly and changes nothing when XOXNO has no liquidity.',
    'Share value moves with the XOXNO supply rate and can only fall through XOXNO losses; the vault itself takes no leverage.',
    'The Peridot admin can upgrade the vault code immediately and pause deposits. This kind has not been audited.',
  ],
  fields: [
    { key: 'owner', label: 'Owner', help: 'Controls the cap, fee, keeper and pausing. Receives the performance fee. Cannot withdraw other people\'s funds.', group: 'Vault', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner', locked: 'owner' },
    { key: 'depositor', label: 'Depositor', help: 'The only address that can deposit: your wallet for a standalone vault, or a Peridot market vault to use this vault as its yield route. Anyone holding shares can withdraw.', group: 'Vault', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner' },
    { key: 'underlying', label: 'Asset (token contract)', help: 'The token supplied to XOXNO. Its hub and spoke must list it as supplyable and not paused, or the vault refuses to deploy.', group: 'XOXNO market', input: 'address', encoding: 'address', default: ctx => ctx.net === 'testnet' ? XOXNO_TESTNET_XLM : XOXNO_MAINNET_XLM },
    { key: 'hubId', label: 'XOXNO hub id', help: 'The XOXNO hub (isolated group of markets), 1 to 3 today.', group: 'XOXNO market', input: 'number', encoding: 'u32', min: 1, max: XOXNO_BOUNDS.idMax, step: 1, default: '1' },
    { key: 'spokeId', label: 'XOXNO spoke id', help: 'The risk profile of the vault\'s XOXNO account. Testnet: 1 Main. Mainnet: 1 Blue Chip, 4 Stables and FX.', group: 'XOXNO market', input: 'number', encoding: 'u32', min: 1, max: XOXNO_BOUNDS.idMax, step: 1, default: '1' },
    { key: 'keeper', label: 'Keeper', help: 'The one address (besides you) allowed to call harvest, which books the performance fee. It cannot move funds.', group: 'Operations', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner' },
    { key: 'cap', label: 'Deposit cap', help: 'Total value the vault accepts, in the asset. Keep it small while the vault is new. You can change it later but never to zero.', group: 'Safety', input: 'amount', encoding: 'i128', unit: 'tokens', min: 1, step: 1, default: '1000' },
    { key: 'minDeposit', label: 'Minimum deposit', help: 'Smallest single deposit accepted. Must not exceed the cap.', group: 'Safety', input: 'amount', encoding: 'i128', unit: 'tokens', min: 0.0000001, step: 1, default: '1' },
    { key: 'fee', label: 'Performance fee', help: 'Share of the yield paid to the owner as vault shares. Hard maximum 20%. 0 for none.', group: 'Safety', input: 'number', encoding: 'u32', unit: '%', min: 0, max: XOXNO_BOUNDS.feeMaxBps / 100, step: 0.1, scale: 100, default: '10' },
  ],
  validate,
  summary,
  preview,
};
