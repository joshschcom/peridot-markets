'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { getGroup } from '@/lib/peridot/factory';
import { getDeployments, network } from '@/lib/peridot/network';
import { EmptyState } from '@/components/ui/primitives';

/* Clean "Group not found" state for unknown ids (QA finding: /groups/99 dumped a raw event log).
 * The guard renders the dashboard immediately and checks the group in parallel; both calls hit the
 * same `getGroup` read in the same tick, so `readContractRaw` coalesces them into one RPC request. */
export const MAX_GROUP_ID = 4_294_967_295;
export function isValidGroupId(id: string): boolean { return /^\d+$/.test(id) && Number(id) <= MAX_GROUP_ID; }

/** Mock mode throws 'Group not found.'; live mode reports FactoryError::GroupNotFound (#4) from the factory contract. */
export function isGroupNotFound(error: unknown, factory: string | null): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/Group not found\./.test(message)) return true;
  return message.includes('Error(Contract, #4)') && !!factory && message.includes(factory);
}

function factoryId(): string | null { try { return getDeployments().factory; } catch { return null; } }

export function GroupGuard({ id, children }: { id: string; children: ReactNode }) {
  const [missing, setMissing] = useState(() => !isValidGroupId(id));
  useEffect(() => {
    if (!isValidGroupId(id)) { setMissing(true); return; }
    let active = true;
    setMissing(false);
    getGroup(Number(id)).then(() => { if (active) setMissing(false); }, error => { if (active && isGroupNotFound(error, network.useMocks ? null : factoryId())) setMissing(true); });
    return () => { active = false; };
  }, [id]);
  if (!missing) return <>{children}</>;
  return <div className="page">
    <EmptyState icon={SearchX} title="Group not found" role="status" action={<div className="row"><Link className="button" href="/groups">All groups</Link><Link className="button secondary" href="/launch">Launch a group</Link></div>}>
      <p>There is no market group {isValidGroupId(id) ? `#${id}` : `"${id.slice(0, 40)}"`} on {network.useMocks ? 'the demo' : network.name}. The link may be out of date, or the group may not exist yet.</p>
    </EmptyState>
  </div>;
}
