'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Plus, Layers3, Search } from 'lucide-react';
import { listGroups } from '@/lib/peridot/factory';
import type { Group } from '@/lib/peridot/types';
import { useWallet } from '@/lib/peridot/wallet';
import { network } from '@/lib/peridot/network';
export default function GroupsPage() {
  const { address } = useWallet();
  const [groups,setGroups]=useState<Group[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [query,setQuery]=useState('');
  useEffect(()=>{ let alive=true; listGroups().then(g=>{if(alive)setGroups(g);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;}; },[]);
  const filtered=groups.filter(g=>g.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.owner===address)-Number(a.owner===address));
  return <div className="page"><div className="page-heading"><div><p className="eyebrow">FIND YOUR COMMUNITY</p><h1>Explore markets</h1><p className="muted">Independent groups. Transparent rules. Built on Stellar.</p></div><Link className="button" href="/launch"><Plus size={16}/> Launch a group</Link></div><div className="list-toolbar"><label className="search-field"><Search size={17}/><input aria-label="Search groups" placeholder="Search by group name" value={query} onChange={e=>setQuery(e.target.value)}/></label><span className="pill">{network.useMocks?'Demo groups':network.name}</span></div>{loading?<div className="panel empty-state" role="status">Loading market groups…</div>:error?<div className="panel empty-state" role="alert"><Layers3/><h2>Markets are not available yet</h2><p>{error}</p><p className="muted">Verified deployment configuration is required before live transactions.</p></div>:filtered.length===0?<div className="panel empty-state"><Layers3/><h2>{query?'No matching groups':'Be the first to launch'}</h2><p className="muted">Create a group with the assets and parameters your community needs.</p><Link href="/launch" className="button">Configure a group <ArrowRight size={16}/></Link></div>:<div className="groups-grid">{filtered.map(group=><Link className="panel group-card" href={`/groups/${group.id}`} key={group.id}><div className="group-card-top"><span className="group-icon"><Layers3/></span>{group.owner===address&&<span className="pill">Your group</span>}<ArrowRight size={19}/></div><h2>{group.name}</h2><p className="muted">{group.markets.length} {group.markets.length===1?'market':'markets'} · Isolated lending group</p><div className="group-card-bottom"><span>{group.margin_controller?'Leverage enabled':'Lending & borrowing'}</span><small>Group #{group.id}</small></div></Link>)}</div>}</div>;
}
