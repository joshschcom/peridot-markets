/** Zenex perps vault: an async-buffer vault over Zenex's strategy vault (Zenith Protocols perpetual futures exchange).
 * Constructor (contracts/zenex-vault): owner, market, underlying, cfg{ zenex_market, zenex_vault, keeper, target_buffer_bps,
 * min_buffer_bps, slippage_bps, haircut_bps, cap }. Bounds mirror the contract (ZenexConfig in contracts/zenex-vault/src/lib.rs).
 * Integration reality: Zenex is live on MAINNET only. On testnet the vault runs against a MOCK Zenex (contracts/mocks/mock-zenex). */
import { xdr } from '@stellar/stellar-sdk';
import type { VaultCtx, VaultKind, Values, Validation, PreviewModel } from './types';
import { encodeField } from './schema';

/** Same limits as the contract constructor. */
export const ZX_BOUNDS = { targetMinPct: 20, minBufferMinPct: 5, slippageMinPct: 0.5, slippageMaxPct: 5, haircutMinPct: 0.5, haircutMaxPct: 20, zenexMinDeposit: 10, zenexVaultCap: 100_000 } as const;

/** Zenex mainnet (docs.zenex.trade/deployments, verified against the chain). Testnet values are the mock from deployments/testnet.json. */
export const ZENEX_ADDRESSES = {
  mainnet: {
    market: 'CAOZCITWHWAXH5FRU4EULQ5EN2HMTCHICRNC4R5ZAOVD7XHCCQSJ42IB',
    vault: 'CB2MX4WXJHOHCTDTN5DCFC7G3TLFLOYLCRCINPK7G2A3EUVW2AYVA56N',
    usdc: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
  },
  testnet: {
    market: 'CAKMRLHPAJJLPLVBK5EC3CANNGRBJW6HACYFYCIYNATINHX3C2S5WEST',
    vault: 'CDR75E2Z3L4BW342XGQWYX3JA42L2U2IOGEQKI7YUW5C3UDCT4DDV5HH',
    usdc: 'CDPXNHHVSLX3HFAHV7XOISM23MZH36WSXTO45RNDOBIDFZBGTSOVD4OY',
  },
} as const;

const z = (ctx: VaultCtx) => ZENEX_ADDRESSES[ctx.net];
const num = (v: Values, k: string) => Number(v[k]);

function validate(v: Values, ctx: VaultCtx): Validation {
  const errors: Record<string, string> = {}; const warnings: string[] = [];
  if (num(v, 'minBuffer') >= num(v, 'targetBuffer')) errors.minBuffer = 'The refill threshold must be lower than the target buffer.';
  if (num(v, 'cap') < ZX_BOUNDS.zenexMinDeposit) errors.cap = `The cap must be at least ${ZX_BOUNDS.zenexMinDeposit} (Zenex minimum deposit).`;
  if (num(v, 'cap') > ZX_BOUNDS.zenexVaultCap) errors.cap = `The cap cannot exceed Zenex's own vault limit of ${ZX_BOUNDS.zenexVaultCap.toLocaleString('en-US')}.`;
  if (v.market === v.owner) warnings.push('Depositing market is the owner: only you can deposit until you bind a market contract once with bind_market.');
  if (ctx.net === 'testnet') warnings.push('Testnet uses a MOCK Zenex. Funds are test tokens; fills are simulated by a script.');
  return { errors, warnings };
}

function preview(v: Values, ctx: VaultCtx): PreviewModel | null {
  const t = num(v, 'targetBuffer'), m = num(v, 'minBuffer'), s = num(v, 'slippage'), h = num(v, 'haircut'), cap = num(v, 'cap');
  if (![t, m, s, h, cap].every(Number.isFinite)) return null;
  const example = Math.min(cap, 1000);
  const toZenex = example * (1 - t / 100);
  return {
    type: 'rows', title: 'How a deposit is split',
    rows: [
      ['Deposit', `${example} tokens`],
      ['Stays liquid in the vault', `${(example * t / 100).toFixed(2)} (${t}%)`],
      ['Sent to Zenex by the keeper', `${toZenex.toFixed(2)} (after the 0.01 order fee)`],
      ['Refill when liquid share drops below', `${m}% of value`],
      ['Value shown to depositors', `at most ${(100 - h).toFixed(1)}% of Zenex holdings (haircut ${h}%)`],
      ['Order price tolerance', `${s}% vs. the Zenex quote`],
      ['Zenex exit delay', 'at least 1 hour, paid from the liquid share first'],
    ],
  };
}

function summary(v: Values, ctx: VaultCtx): string[] {
  return [
    `Deposits stop at ${v.cap} tokens in total value. ${v.targetBuffer}% stays liquid for withdrawals; the rest earns Zenex perps fees through ${ctx.net === 'mainnet' ? 'the live Zenex XLM-USD vault' : 'the MOCK Zenex vault'}.`,
    `A keeper (${v.keeper.slice(0, 6)}...) moves funds in and out of Zenex. It cannot send funds anywhere else.`,
    `Value is marked down by ${v.haircut}% on Zenex holdings so it is never overstated. You can only raise this later, never lower it.`,
    `You (the owner) can pause deposits, change these limits within the bounds, and swap the keeper. You cannot withdraw depositors' funds.`,
  ];
}

/** ScMap with symbol keys sorted alphabetically, as the host requires for a contracttype struct. */
export function scStruct(entries: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(Object.keys(entries).sort().map(k => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: entries[k] })));
}

export const zenexKind: VaultKind = {
  id: 'zenex',
  name: 'Zenex perps vault',
  tagline: 'Earn perpetual futures fees from Zenex traders',
  description: 'A vault that keeps a liquid buffer and parks the rest in a Zenex strategy vault, which is the counterparty to Zenex perp traders and earns their trading, liquidation and funding fees. Zenex settles deposits and exits through keeper-filled orders, so exits from Zenex take at least an hour; the liquid buffer serves withdrawals meanwhile. Plugs into a Peridot market through the existing DeFindex route.',
  status: 'live',
  risks: [
    'Vault shares can lose value: the Zenex vault pays out when traders profit.',
    'Withdrawals beyond the liquid buffer wait for Zenex: orders fill at least 1 hour later and only when Zenex liquidity and pending-profit gates allow it.',
    'Zenex fees: 0.1% on deposits, 0.25% on exits and a small order fee each time the keeper moves funds.',
    'Testnet runs against a mock Zenex, not the real protocol. The real integration is mainnet only.',
  ],
  fields: [
    { key: 'owner', label: 'Owner', help: 'Controls limits, keeper and pausing. Cannot withdraw other people\'s funds.', group: 'Roles', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner', locked: 'owner' },
    { key: 'market', label: 'Depositing market', help: 'The only address that may deposit (a Peridot market\'s receipt vault). Keep the owner here if the market does not exist yet and bind it once later.', group: 'Roles', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner' },
    { key: 'keeper', label: 'Keeper', help: 'Moves funds between the liquid buffer and Zenex. It can only create Zenex orders for this vault, never send funds elsewhere.', group: 'Roles', input: 'address', encoding: 'address', default: ctx => ctx.owner, suggest: 'owner' },
    { key: 'underlying', label: 'Deposit token', help: 'USDC. Must be the settlement token of the Zenex market; the vault checks it on creation.', group: 'Zenex', input: 'address', encoding: 'address', default: ctx => z(ctx).usdc },
    { key: 'zenexMarket', label: 'Zenex market', help: 'The Zenex market contract that takes vault orders (XLM-USD on mainnet).', group: 'Zenex', input: 'address', encoding: 'address', default: ctx => z(ctx).market },
    { key: 'zenexVault', label: 'Zenex strategy vault', help: 'The Zenex vault whose share token this vault holds. Must belong to the market above; checked on creation.', group: 'Zenex', input: 'address', encoding: 'address', default: ctx => z(ctx).vault },
    { key: 'targetBuffer', label: 'Liquid buffer', help: 'Share of the vault kept as plain USDC for instant withdrawals. More buffer means less yield but fewer failed withdrawals. Minimum 20%.', group: 'Liquidity', input: 'number', encoding: 'u32', unit: '%', min: ZX_BOUNDS.targetMinPct, max: 100, step: 1, scale: 100, default: '30' },
    { key: 'minBuffer', label: 'Refill threshold', help: 'When the liquid share falls below this, the keeper asks Zenex to return funds. Must be below the buffer target.', group: 'Liquidity', input: 'number', encoding: 'u32', unit: '%', min: ZX_BOUNDS.minBufferMinPct, max: 99, step: 1, scale: 100, default: '10' },
    { key: 'slippage', label: 'Order price tolerance', help: 'Zenex orders are rejected if they would give less than this vs. the quote at order time. Covers Zenex fees. 0.5% to 5%.', group: 'Safety', input: 'number', encoding: 'u32', unit: '%', min: ZX_BOUNDS.slippageMinPct, max: ZX_BOUNDS.slippageMaxPct, step: 0.1, scale: 100, default: '1' },
    { key: 'haircut', label: 'Valuation haircut', help: 'Funds in Zenex are counted at this much below their quote, so the vault never overstates value while orders and fees are pending. 0.5% to 20%, can only be raised later.', group: 'Safety', input: 'number', encoding: 'u32', unit: '%', min: ZX_BOUNDS.haircutMinPct, max: ZX_BOUNDS.haircutMaxPct, step: 0.1, scale: 100, default: '2' },
    { key: 'cap', label: 'Deposit cap', help: 'Maximum total value, in USDC. Between Zenex\'s 10 USDC minimum and its 100,000 USDC vault limit. Keep it small while the vault is new.', group: 'Safety', input: 'amount', encoding: 'i128', unit: 'USDC', min: ZX_BOUNDS.zenexMinDeposit, max: ZX_BOUNDS.zenexVaultCap, step: 1, default: '1000' },
  ],
  validate,
  preview,
  summary,
  // Constructor: (owner, market, underlying, cfg). The cfg struct is one ScMap argument.
  encode(v, ctx) {
    const f = (k: string) => encodeField(zenexKind.fields.find(x => x.key === k)!, v[k], ctx);
    const u32 = (k: string) => f(k);
    const cfg = scStruct({
      zenex_market: f('zenexMarket'),
      zenex_vault: f('zenexVault'),
      keeper: f('keeper'),
      target_buffer_bps: u32('targetBuffer'),
      min_buffer_bps: u32('minBuffer'),
      slippage_bps: u32('slippage'),
      haircut_bps: u32('haircut'),
      cap: f('cap'),
    });
    return [f('owner'), f('market'), f('underlying'), cfg];
  },
};
