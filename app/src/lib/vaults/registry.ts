/** Single typed list of every way a market can earn yield, plus who can select it today.
 * Pure data and helpers, no network access, safe in node unit tests and server rendering.
 * Whether a vault kind is registered on a network is NOT decided here: callers pass the kinds from the deployment
 * manifest (`deployedKinds()` in factory-client) into `venueAvailability`, so nothing is hard-coded per network. */

export type VaultId = 'idle' | 'blend' | 'defindex' | 'aquarius' | 'xoxno' | 'zenex';
export type VaultStatus = 'live-mainnet' | 'testnet' | 'demo' | 'coming-soon';
export type AppNetwork = 'mainnet' | 'testnet';
/** The yield_route tag the market factory accepts today, or null when the factory cannot take this venue yet. */
export type FactoryRoute = 'None' | 'Defindex' | 'Blend' | null;
/** Vault kinds the vault factory can deploy (`create_vault(kind)`). */
export type VaultKindId = 'aquarius' | 'zenex' | 'xoxno';

export interface VaultOption {
  id: VaultId;
  name: string;
  tagline: string;
  /** One honest sentence on what the venue does and what it risks. */
  detail: string;
  status: VaultStatus;
  /** Route written to the market config when selected in the wizard; null means it cannot be submitted. */
  factoryRoute: FactoryRoute;
  risk: 'Lowest' | 'Low' | 'Medium' | 'Higher';
  /** Overrides the status badge text (the status still decides tone and lock state). */
  statusText?: string;
  /** Where the user can learn more or try the venue. */
  href?: string;
  /** Extra qualifier for the status badge, for example "customizable". */
  statusNote?: string;
  /** Set when the venue is a vault the user creates through the vault factory and then attaches to a market
   * through the DeFindex-shaped route. The kind must be registered on the network to be selectable. */
  kind?: VaultKindId;
  /** Deposit token restriction, when the venue only takes one asset. */
  underlying?: string;
}

export const STATUS_LABEL: Record<VaultStatus, string> = {
  'live-mainnet': 'Live on mainnet',
  testnet: 'Testnet',
  demo: 'Demo flow',
  'coming-soon': 'Coming soon',
};
export const STATUS_TONE: Record<VaultStatus, 'success' | 'info' | 'warn' | 'neutral'> = {
  'live-mainnet': 'success',
  testnet: 'info',
  demo: 'warn',
  'coming-soon': 'neutral',
};
export const COMING_SOON_COPY = 'Coming soon, not active in this demo.';
/** What every created vault needs before a market can use it. */
export const APPROVAL_COPY = 'Peridot admin must allow-list the vault on the market factory (set_yield_vault_allowed) before a market can attach it.';

export const VAULT_OPTIONS: readonly VaultOption[] = [
  { id: 'idle', name: 'Keep in Peridot', tagline: 'No external venue', detail: 'Funds stay in the market. Suppliers earn only borrower interest.', status: 'live-mainnet', factoryRoute: 'None', risk: 'Lowest' },
  { id: 'blend', name: 'Blend fee vault', tagline: 'Boosted lending yield', detail: 'Idle liquidity is lent in a Blend pool through an allowlisted fee vault. Blend pool risk applies.', status: 'live-mainnet', factoryRoute: 'Blend', risk: 'Low', href: 'https://blend.capital' },
  { id: 'defindex', name: 'DeFindex vault', tagline: 'Managed strategy vault for XLM, USDC or EURC', detail: 'Idle liquidity goes to the Peridot DeFindex vault for the market token (XLM, USDC or EURC), which runs a Blend autocompound strategy. The vault address is fixed per token, not chosen by the owner.', status: 'live-mainnet', factoryRoute: 'Defindex', risk: 'Low', href: 'https://defindex.io' },
  { id: 'aquarius', name: 'Aquarius LP ladder vault', tagline: 'Concentrated liquidity ladder plus AQUA rewards', detail: 'Your own vault that lays one token across a ladder of Aquarius concentrated-liquidity ranges, earning swap fees and AQUA. Impermanent loss is possible. Create it on the Vaults page, then attach it to a market once Peridot allow-lists it.', status: 'live-mainnet', statusNote: 'customizable', factoryRoute: 'Defindex', kind: 'aquarius', risk: 'Medium', href: '/vaults' },
  { id: 'xoxno', name: 'XOXNO lending vault', tagline: 'Supply one asset to XOXNO Lending', detail: 'Your own vault that supplies one asset to the XOXNO Lending controller (supply only, never borrows) with your cap, minimum deposit and performance fee. Create it on the Vaults page, then attach it to a market once Peridot allow-lists it.', status: 'live-mainnet', statusNote: 'customizable', factoryRoute: 'Defindex', kind: 'xoxno', risk: 'Medium', href: 'https://github.com/XOXNO/rs-lending-xlm' },
  { id: 'zenex', name: 'Zenex perps vault', tagline: 'USDC only, earns perps fees, async withdrawals', detail: 'Your own USDC vault that keeps a liquid buffer and parks the rest in the Zenex strategy vault, the counterparty to Zenex perp traders. Shares can lose value and exits from Zenex take at least an hour. Create it on the Vaults page, bind the market, and attach it once Peridot allow-lists it.', status: 'live-mainnet', statusNote: 'customizable', factoryRoute: 'Defindex', kind: 'zenex', risk: 'Higher', href: '/vaults', underlying: 'USDC' },
];

export function getVaultOption(id: VaultId): VaultOption {
  const found = VAULT_OPTIONS.find(o => o.id === id);
  if (!found) throw new Error(`Unknown vault option ${id}.`);
  return found;
}

/** Can the market wizard submit this option today? Only options the factory accepts and that are live. */
export function isSubmittable(option: VaultOption): boolean {
  return option.factoryRoute !== null && (option.status === 'live-mainnet' || option.status === 'testnet');
}

/** Status shown to the user on a given network. Testnet-only venues read as unavailable on mainnet and vice versa. */
export function statusOn(option: VaultOption, net: AppNetwork): VaultStatus {
  if (option.statusText) return option.status;
  if (option.status === 'live-mainnet' && net === 'testnet') return 'testnet';
  return option.status;
}

export function statusLabel(option: VaultOption, net: AppNetwork): string {
  if (option.statusText) return option.statusText;
  const s = statusOn(option, net);
  const base = s === 'coming-soon' ? 'Coming soon' : STATUS_LABEL[s];
  return option.statusNote ? `${base}, ${option.statusNote}` : base;
}

export interface VenueAvailability {
  selectable: boolean;
  label: string;
  tone: 'success' | 'info' | 'warn' | 'neutral';
  /** Plain reason when not selectable. */
  reason?: string;
}

/** Availability on a network, driven by the manifest: a created-vault venue is selectable only when its kind is
 * registered with the vault factory there (`vault_kinds` in deployments/<network>.json). */
export function venueAvailability(option: VaultOption, net: AppNetwork, registeredKinds: readonly string[]): VenueAvailability {
  if (!isSubmittable(option)) return { selectable: false, label: statusLabel(option, net), tone: STATUS_TONE[statusOn(option, net)], reason: COMING_SOON_COPY };
  if (option.kind && !registeredKinds.includes(option.kind)) {
    return { selectable: false, label: `Registering on ${net}`, tone: 'info', reason: `The ${option.name} kind is not registered with the vault factory on ${net} yet. It is selectable as soon as the manifest lists it.` };
  }
  return { selectable: true, label: statusLabel(option, net), tone: STATUS_TONE[statusOn(option, net)] };
}

/** Options that are not selectable, for the "also planned" lists. */
export function unavailableOptions(): VaultOption[] {
  return VAULT_OPTIONS.filter(o => !isSubmittable(o));
}

export function groupByStatus(): Record<VaultStatus, VaultOption[]> {
  const out: Record<VaultStatus, VaultOption[]> = { 'live-mainnet': [], testnet: [], demo: [], 'coming-soon': [] };
  for (const o of VAULT_OPTIONS) out[o.status].push(o);
  return out;
}

/** The venue a draft points at, derived from its route and vault: created vaults are told apart by kind. */
export function venueForRoute(route: 'None' | 'Defindex' | 'Blend', kind?: string | null): VaultId {
  if (route === 'None') return 'idle';
  if (route === 'Blend') return 'blend';
  if (kind === 'aquarius' || kind === 'zenex' || kind === 'xoxno') return kind;
  return 'defindex';
}
