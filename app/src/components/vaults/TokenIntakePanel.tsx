'use client';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { Address } from '@/components/ui/Address';
import { Badge } from '@/components/ui/primitives';
import { formatSupply } from '@/lib/vaults/token-intake';
import type { Inspection } from '@/lib/vaults/token-intake-client';
import './vaults.css';

/** Shows what was read from the pasted token and how it can be priced. Blocking messages are plain and say what to do next. */
export function TokenIntakePanel({ inspection, vaultHint }: { inspection: Inspection; vaultHint: string }) {
  const { info, pricing, leverage, parsed } = inspection;
  return <div className="intake-panel card inset" style={{ padding: 14 }} data-testid="token-intake">
    <div className="row between"><strong>{info.name ? `${info.name} (${info.symbol})` : info.symbol}</strong>{network.useMocks && <Badge tone="warn">Demo token</Badge>}</div>
    <div className="kv">
      <div><span>Contract</span><span><Address value={info.address} label="token contract" /></span></div>
      {parsed.kind === 'classic' && <div><span>Resolved from</span><span>{parsed.issuer === 'native' ? 'native XLM' : `${parsed.code}:${parsed.issuer.slice(0, 4)}...${parsed.issuer.slice(-4)}`} to its Stellar Asset Contract</span></div>}
      <div><span>Decimals</span><span>{info.decimals}</span></div>
      <div><span>Total supply</span><span>{formatSupply(info.totalSupply, info.decimals)}</span></div>
    </div>
    <div className={`status ${pricing.canSubmit ? 'success' : 'danger'}`} role={pricing.canSubmit ? 'status' : 'alert'}>
      {pricing.canSubmit ? <CheckCircle2 size={16} aria-hidden /> : <ShieldAlert size={16} aria-hidden />}
      <div style={{ minWidth: 0, flex: 1 }}><p><strong>{pricing.title}</strong></p><ul>{pricing.lines.map(l => <li key={l}>{l}</li>)}</ul></div>
    </div>
    <p className="muted" style={{ fontSize: 12, margin: 0 }}><strong>Leverage:</strong> {leverage.reason}</p>
    <p className="muted" style={{ fontSize: 12, margin: 0 }}><strong>Yield:</strong> {vaultHint}</p>
  </div>;
}
