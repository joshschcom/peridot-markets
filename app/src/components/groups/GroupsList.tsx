'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { GroupCards } from '@/components/markets/GroupOverview';
import { Badge } from '@/components/ui/primitives';

/** Client body of /groups; the route file stays a server component so it can export metadata. */
export function GroupsList() {
  const [query, setQuery] = useState('');
  return <div className="page">
    <div className="page-heading">
      <div><p className="eyebrow">Explore</p><h1>Market groups</h1><p className="lead">Independent lending groups with transparent rules. Supply, borrow, claim rewards or open a leveraged position.</p></div>
      <div className="page-actions"><Link className="button" href="/launch"><Plus size={16} aria-hidden /> Launch a group</Link></div>
    </div>
    <div className="row" style={{ gap: 12 }}>
      <label className="search-field">
        <Search size={16} aria-hidden />
        <input type="search" aria-label="Search groups" placeholder="Search by group name" value={query} onChange={e => setQuery(e.target.value)} />
      </label>
      <Badge tone={network.useMocks ? 'info' : 'accent'}>{network.useMocks ? 'Demo groups' : network.name === 'mainnet' ? 'Mainnet beta' : 'Testnet'}</Badge>
    </div>
    <GroupCards query={query} />
  </div>;
}
