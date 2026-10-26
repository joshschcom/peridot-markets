'use client';
import { useEffect, useState } from 'react';
import { getPlainToken } from '@/lib/launchpad/client';
import type { PlainTokenInfo } from '@/lib/launchpad/types';
import { Notice, Skeleton } from '@/components/ui/primitives';
import { getIco } from '@/lib/launchpad/ico-client';
import type { IcoInfo } from '@/lib/launchpad/ico-types';
import IcoPage from './IcoPage';
import PlainTokenPage from './PlainTokenPage';
import TokenPage from './TokenPage';

/** Chooses between the curve token page and the simple-token page for one address. */
export default function TokenRoute({ address }: { address: string }) {
  const [error, setError] = useState('');
  const [state, setState] = useState<{ done: boolean; plain: PlainTokenInfo | null; ico: IcoInfo | null }>({ done: false, plain: null, ico: null });
  useEffect(() => {
    let alive = true;
    setError('');
    setState({ done: false, plain: null, ico: null });
    Promise.allSettled([getPlainToken(address), getIco(address)]).then(([plainResult, icoResult]) => {
      if (!alive) return;
      const plain = plainResult.status === 'fulfilled' ? plainResult.value : null;
      const ico = icoResult.status === 'fulfilled' ? icoResult.value : null;
      if (!plain && icoResult.status === 'rejected') setError('Token registry unavailable. Refresh to try again.');
      setState({ done: true, plain, ico });
    });
    return () => { alive = false; };
  }, [address]);
  if (error) return <div className="page"><Notice tone="danger" role="alert">{error}</Notice></div>;
  if (!state.done) return <div className="page" aria-busy="true"><div className="page-heading"><div style={{ display: 'grid', gap: 10, width: 'min(100%,460px)' }}><Skeleton width={160} height={12} /><Skeleton width={300} height={32} /></div></div></div>;
  return state.ico ? <IcoPage info={state.ico} /> : state.plain ? <PlainTokenPage info={state.plain} /> : <TokenPage address={address} />;
}
