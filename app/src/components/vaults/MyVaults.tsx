'use client';
import { useCallback, useEffect, useState } from 'react';
import { Vault } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { Badge, EmptyState, Notice, Skeleton } from '@/components/ui/primitives';
import { Address } from '@/components/ui/Address';
import { getKind } from '@/lib/vaults/kinds';
import { listMyVaults } from '@/lib/vaults/factory-client';
import { isYieldVaultAllowed } from '@/lib/peridot/factory';
import { ApprovalBadge } from './VaultStep';
import type { VaultRecordView } from '@/lib/vaults/kinds/types';
import './vaults.css';

export function MyVaults({ refreshKey }: { refreshKey: number }) {
  const wallet = useWallet();
  const owner = wallet.address ?? '';
  const [items, setItems] = useState<VaultRecordView[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!owner) { setItems([]); return; }
    try { setError(''); setItems(await listMyVaults(owner)); } catch (e) { setError(e instanceof Error ? e.message : 'Vaults could not be loaded.'); setItems([]); }
  }, [owner]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const [approvals, setApprovals] = useState<Record<string, 'checking' | 'allowed' | 'needs' | 'failed'>>({});
  useEffect(() => {
    let cancelled = false;
    const live = (items ?? []).filter(v => !v.demo);
    if (live.length === 0) return;
    Promise.all(live.map(async v => [v.address, await isYieldVaultAllowed(v.address).then((ok): 'allowed' | 'needs' | 'failed' => ok ? 'allowed' : 'needs').catch((): 'failed' => 'failed')] as const)).then(pairs => { if (!cancelled) setApprovals(Object.fromEntries(pairs) as Record<string, 'allowed' | 'needs' | 'failed'>); });
    return () => { cancelled = true; };
  }, [items]);

  return <section className="card" aria-labelledby="mine-h">
    <div className="card-header"><div><h2 id="mine-h">My vaults</h2><p>{network.useMocks ? 'Demo vaults, saved in this browser only. They are not contracts.' : 'Vaults you created through the vault factory, with their market-factory allow-list state. A vault can be attached to a market once it shows Approved by Peridot.'}</p></div></div>
    {error && <Notice tone="warn" role="alert">{error}</Notice>}
    {items === null ? <Skeleton height={44} style={{ borderRadius: 10 }} />
      : !owner && !network.useMocks ? <EmptyState icon={Vault} title="Connect a wallet" role="status"><p>Connect your wallet to see the vaults you created.</p></EmptyState>
      : items.length === 0 ? <EmptyState icon={Vault} title="No vaults yet" role="status"><p>Create one above and it appears here.</p></EmptyState>
      : <div className="demo-vault-list">{items.map(v => {
        const kind = getKind(v.kind);
        return <article key={v.address} className="card inset" data-testid="my-vault">
          <div className="row between"><strong>{kind?.name ?? v.kind}</strong><span className="row" style={{ gap: 6 }}>{v.demo ? <Badge tone="warn">Demo, not deployed</Badge> : <Badge tone="success">On chain</Badge>}{!v.demo && <ApprovalBadge state={approvals[v.address] ?? 'checking'} />}</span></div>
          <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>{v.demo ? `Created ${new Date(v.createdAt ?? 0).toLocaleString()}` : `Created at ledger ${v.ledger}`} · vault <Address value={v.address} label="vault address" head={6} tail={6} /></p>
          {v.values && kind?.summary && <ul className="summary-list" style={{ marginTop: 6 }}>{safeSummary(kind, v)}</ul>}
        </article>;
      })}</div>}
  </section>;
}

function safeSummary(kind: NonNullable<ReturnType<typeof getKind>>, v: VaultRecordView) {
  try { return kind.summary!(v.values!, { owner: v.owner, net: network.name, decimals: 7 }).map(s => <li key={s}>{s}</li>); } catch { return null; }
}
