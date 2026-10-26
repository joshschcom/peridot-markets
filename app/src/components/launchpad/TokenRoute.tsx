'use client';
import { useEffect, useState } from 'react';
import { getPlainToken } from '@/lib/launchpad/client';
import type { PlainTokenInfo } from '@/lib/launchpad/types';
import { Skeleton } from '@/components/ui/primitives';
import PlainTokenPage from './PlainTokenPage';
import TokenPage from './TokenPage';

/** Chooses between the curve token page and the simple-token page for one address. */
export default function TokenRoute({ address }: { address: string }) {
  const [state, setState] = useState<{ done: boolean; plain: PlainTokenInfo | null }>({ done: false, plain: null });
  useEffect(() => {
    let alive = true;
    setState({ done: false, plain: null });
    getPlainToken(address).then(plain => { if (alive) setState({ done: true, plain }); }).catch(() => { if (alive) setState({ done: true, plain: null }); });
    return () => { alive = false; };
  }, [address]);
  if (!state.done) return <div className="page" aria-busy="true"><div className="page-heading"><div style={{ display: 'grid', gap: 10, width: 'min(100%,460px)' }}><Skeleton width={160} height={12} /><Skeleton width={300} height={32} /></div></div></div>;
  return state.plain ? <PlainTokenPage info={state.plain} /> : <TokenPage address={address} />;
}
