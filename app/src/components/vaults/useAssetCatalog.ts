'use client';
import { useEffect, useMemo, useState } from 'react';
import { network, getDeployments } from '@/lib/peridot/network';
import { MOCK_CUSTOM_TOKENS, readMockState } from '@/lib/peridot/mock';
import { mergeAssets, type CatalogAsset, type ExtraAsset } from '@/lib/vaults/assets';
import { useAquariusPools } from './useAquariusPools';

/** Every asset a user can pick, deduplicated by contract id: known network assets, Aquarius pool tokens, launchpad tokens.
 * Known assets render immediately; pools and launchpad tokens attach when they arrive. */
export function useAssetCatalog(): { assets: CatalogAsset[]; loading: boolean; note: string } {
  const { loading, result } = useAquariusPools();
  const [launched, setLaunched] = useState<ExtraAsset[]>([]);
  useEffect(() => {
    if (network.useMocks) return;
    let cancelled = false;
    import('@/lib/launchpad/client').then(async ({ listLaunches, listPlainTokens }) => {
      const [curves, plain] = await Promise.all([listLaunches().catch(() => []), listPlainTokens().catch(() => [])]);
      if (cancelled) return;
      setLaunched([...curves.map(l => ({ address: l.token, symbol: l.symbol, name: l.name, decimals: 7, origin: 'launchpad' as const })), ...plain.map(t => ({ address: t.token, symbol: t.symbol, name: t.name, decimals: 7, origin: 'launchpad' as const }))].reverse());
    }).catch(() => { /* The launchpad is optional on this network. */ });
    return () => { cancelled = true; };
  }, []);
  const assets = useMemo(() => {
    let vaultKeys: string[] = [];
    try { const d = getDeployments().external?.defindex_vaults; if (d && typeof d === 'object') vaultKeys = Object.keys(d); } catch { /* no manifest */ }
    if (network.useMocks) {
      const state = readMockState();
      const demo: ExtraAsset[] = Object.entries(MOCK_CUSTOM_TOKENS).map(([address, t]) => ({ address, symbol: t.symbol, name: t.name, decimals: t.decimals, origin: 'demo' }));
      return mergeAssets(network.name, { pools: result?.pools ?? [], extra: demo, vaultKeys, allow: new Set([...Object.keys(state.tokens), ...Object.keys(MOCK_CUSTOM_TOKENS)]) });
    }
    return mergeAssets(network.name, { pools: result?.pools ?? [], extra: launched, vaultKeys });
  }, [result, launched]);
  const note = loading && !result ? 'Loading Aquarius pools...' : result?.primary === 'demo' ? 'Demo data.' : '';
  return { assets, loading: loading && !result, note };
}
