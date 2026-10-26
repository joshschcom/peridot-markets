'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { network } from '@/lib/peridot/network';
import { chainReader } from '@/lib/vaults/aquarius-chain';
import { loadAquariusPools, registryPools, sortPools, type LoadResult } from '@/lib/vaults/aquarius-pools';

const LOAD_TIMEOUT_MS = 15_000;


export function useAquariusPools() {
  const [state, setState] = useState<{ loading: boolean; result: LoadResult | null }>({ loading: true, result: null });
  const run = useRef(0);
  const load = useCallback(() => {
    const id = ++run.current;
    setState(s => ({ loading: true, result: s.result }));
    const net = network.name;
    const canRead = network.useMocks || !(net === 'mainnet' && !network.rpcUrl);
    const real = loadAquariusPools({
      net, demo: network.useMocks,
      chain: !network.useMocks && canRead ? chainReader(net) : null,
      fetchFn: !network.useMocks && typeof fetch === 'function' ? (url, init) => fetch(url, init) : null,
    });
    // The page must never hang on a slow source: after the timeout the verified list is shown with a warning.
    const timeout = new Promise<LoadResult>(resolve => setTimeout(() => resolve({ pools: sortPools(registryPools(net)), sources: { chain: 'error', api: 'error' }, primary: 'registry', warnings: ['Aquarius sources were too slow. Showing the verified pool list shipped with this app.'] }), LOAD_TIMEOUT_MS));
    Promise.race([real, timeout]).catch((): LoadResult => ({ pools: sortPools(registryPools(net)), sources: { chain: 'error', api: 'error' }, primary: 'registry', warnings: ['Pools could not be loaded. Showing the verified pool list shipped with this app.'] }))
      .then(result => { if (id === run.current) setState({ loading: false, result }); });
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

