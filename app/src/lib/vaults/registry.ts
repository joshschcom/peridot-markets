/** Single typed list of every way a market can earn yield, plus who can select it today.
 * Pure data and helpers, no network access, safe in node unit tests and server rendering. */

export type VaultId = 'idle' | 'blend' | 'defindex' | 'aquarius' | 'xoxno' | 'zenex';
export type VaultStatus = 'live-mainnet' | 'testnet' | 'demo' | 'coming-soon';
export type AppNetwork = 'mainnet' | 'testnet';
/** The yield_route tag the market factory accepts today, or null when the factory cannot take this venue yet. */
export type FactoryRoute = 'None' | 'Defindex' | 'Blend' | null;

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

export const VAULT_OPTIONS: readonly VaultOption[] = [
  { id: 'idle', name: 'Keep in Peridot', tagline: 'No external venue', detail: 'Funds stay in the market. Suppliers earn only borrower interest.', status: 'live-mainnet', factoryRoute: 'None', risk: 'Lowest' },
  { id: 'blend', name: 'Blend fee vault', tagline: 'Boosted lending yield', detail: 'Idle liquidity is lent in a Blend pool through an allowlisted fee vault. Blend pool risk applies.', status: 'live-mainnet', factoryRoute: 'Blend', risk: 'Low', href: 'https://blend.capital' },
  { id: 'defindex', name: 'DeFindex vault', tagline: 'Managed strategy vault', detail: 'Idle liquidity goes to an allowlisted DeFindex vault that runs Blend autocompound strategies.', status: 'live-mainnet', factoryRoute: 'Defindex', risk: 'Low', href: 'https://defindex.io' },
  { id: 'aquarius', name: 'Aquarius LP vault', tagline: 'Concentrated liquidity plus AQUA rewards', detail: 'Idle liquidity becomes a concentrated Aquarius position that earns swap fees and AQUA. Impermanent loss is possible. The factory cannot deploy this route yet: the creation flow here is a demo.', status: 'demo', factoryRoute: null, risk: 'Medium', href: '/vaults' },
  { id: 'xoxno', name: 'XOXNO Lending', tagline: 'Hub and spoke lending', detail: 'A per-owner vault that supplies one asset to XOXNO Lending (real XOXNO controller, supply only) with its own cap, minimum deposit and performance fee. Created from the Create vault form on /vaults; Peridot markets cannot route to it yet. Testnet only: nothing on mainnet.', status: 'testnet', statusNote: 'customizable', factoryRoute: null, risk: 'Medium', href: 'https://github.com/XOXNO/rs-lending-xlm' },
  { id: 'zenex', name: 'Zenex perps vault', tagline: 'Earn perpetual futures fees', detail: 'Create your own Zenex vault on the Vaults page (limits, buffer, keeper, cap). It keeps a liquid buffer and parks the rest in a Zenex strategy vault, which earns perps fees. Vault shares can lose value and Zenex exits take at least one hour. Testnet runs against a mock Zenex because Zenex has no testnet; the real protocol is mainnet only. Attach a created vault to a market through the DeFindex route (admin allow-list).', status: 'testnet', statusText: 'Testnet, customizable', factoryRoute: null, risk: 'Higher', href: '/vaults' },
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
  return option.statusNote && s === option.status ? `${base}, ${option.statusNote}` : base;
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
