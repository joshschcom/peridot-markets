/** Runtime network choice. Pure and dependency free so it can be unit tested and imported before the SDK loads.
 * Precedence: `?network=` URL param, then the stored choice, then the build default. Invalid values are ignored. */
export type NetworkName = 'mainnet' | 'testnet';
export const NETWORK_STORAGE_KEY = 'peridot:network';
export const NETWORK_URL_PARAM = 'network';

export function parseNetworkName(value: unknown): NetworkName | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return v === 'mainnet' || v === 'testnet' ? v : null;
}

export interface NetworkSelectionInput { search?: string | null; stored?: string | null; buildDefault: NetworkName }
export interface NetworkSelection { name: NetworkName; source: 'url' | 'storage' | 'build' }

export function selectNetwork(input: NetworkSelectionInput): NetworkSelection {
  let fromUrl: NetworkName | null = null;
  try { fromUrl = parseNetworkName(new URLSearchParams(input.search || '').get(NETWORK_URL_PARAM)); } catch { /* Malformed query strings are ignored. */ }
  if (fromUrl) return { name: fromUrl, source: 'url' };
  const fromStorage = parseNetworkName(input.stored);
  if (fromStorage) return { name: fromStorage, source: 'storage' };
  return { name: input.buildDefault, source: 'build' };
}

export function parseBuildDefault(value: string | undefined): NetworkName {
  if (!value) return 'mainnet';
  const parsed = parseNetworkName(value);
  if (!parsed) throw new Error('NEXT_PUBLIC_NETWORK must be mainnet or testnet.');
  return parsed;
}

/** Browser-only. Reads the URL and storage, persists a URL override so later links keep it. Falls back to the build default on the server or when storage is blocked. */
export function resolveRuntimeNetwork(buildDefault: NetworkName): NetworkSelection {
  if (typeof window === 'undefined') return { name: buildDefault, source: 'build' };
  let stored: string | null = null;
  try { stored = window.localStorage?.getItem(NETWORK_STORAGE_KEY); } catch { /* Storage can be blocked. */ }
  const selection = selectNetwork({ search: window.location?.search, stored, buildDefault });
  if (selection.source === 'url') storeNetworkChoice(selection.name);
  return selection;
}

export function storeNetworkChoice(name: NetworkName): void {
  try { window.localStorage.setItem(NETWORK_STORAGE_KEY, name); } catch { /* Without storage the choice lasts until the URL param is dropped. */ }
}
