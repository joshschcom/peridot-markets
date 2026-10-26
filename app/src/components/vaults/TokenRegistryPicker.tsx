'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { MOCK_CUSTOM_TOKENS } from '@/lib/peridot/mock';
import { Skeleton } from '@/components/ui/primitives';
import { registryTokens, searchTokens, type RegistryToken } from '@/lib/vaults/token-intake';
import { shortAddress } from '@/lib/vaults/aquarius-pools';
import { useAquariusPools } from './useAquariusPools';
import './vaults.css';

/** Search box over every token in the Aquarius USDC registry. Picking one hands the address to the caller. */
export function TokenRegistryPicker({ onPick, disabled, id }: { onPick: (address: string, symbol: string) => void; disabled?: boolean; id: string }) {
  const { loading, result } = useAquariusPools();
  const [query, setQuery] = useState('');
  const all = useMemo<RegistryToken[]>(() => {
    const fromPools = registryTokens(network.name, result?.pools ?? []);
    if (!network.useMocks) return fromPools;
    const demo = Object.entries(MOCK_CUSTOM_TOKENS).map(([address, t]) => ({ token: { address, symbol: t.symbol }, pools: 0 }));
    return [...fromPools, ...demo];
  }, [result]);
  const shown = searchTokens(all, query, 8);
  return <div className="field token-picker">
    <label htmlFor={`${id}-registry-search`}>Pick from the Aquarius registry</label>
    <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><Search size={14} aria-hidden /><input id={`${id}-registry-search`} type="search" placeholder="Search symbol or address" value={query} disabled={disabled} onChange={e => setQuery(e.target.value)} /></div>
    {loading && !result ? <div className="row" aria-label="Loading registry tokens">{[0, 1, 2, 3].map(i => <Skeleton key={i} width={80} height={30} style={{ borderRadius: 999 }} />)}</div>
      : shown.length === 0 ? <span className="field-hint">No registry token matches. Paste an address below instead.</span>
      : <div className="row token-chips" role="group" aria-label="Registry tokens">{shown.map(({ token }) => <button key={token.address} type="button" className="button secondary sm" disabled={disabled} title={token.address} onClick={() => onPick(token.address, token.symbol)}>{token.symbol} <span className="subtle">{shortAddress(token.address)}</span></button>)}</div>}
    <span className="field-hint">{result ? `Tokens that trade against USDC on Aquarius${result.primary === 'demo' ? ' (demo data)' : ''}.` : 'Loading the Aquarius registry.'}</span>
  </div>;
}
