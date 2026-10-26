'use client';
import Link from 'next/link';
import { ArrowUpRight, Check, Lock } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { Badge } from '@/components/ui/primitives';
import { COMING_SOON_COPY, STATUS_TONE, VAULT_OPTIONS, isSubmittable, statusLabel, statusOn, type VaultId, type VaultOption } from '@/lib/vaults/registry';
import './vaults.css';

export interface VaultOptionListProps {
  /** Currently selected option, when the list is used as a picker. */
  selected?: VaultId;
  /** Called for options the factory can take today. Others are never selectable. */
  onSelect?: (option: VaultOption) => void;
  disabled?: boolean;
  /** Hide the long description (wizard) or show it (vaults page). */
  compact?: boolean;
  ariaLabel?: string;
}

export function VaultStatusBadge({ option }: { option: VaultOption }) {
  return <Badge tone={STATUS_TONE[statusOn(option, network.name)]}>{statusLabel(option, network.name)}</Badge>;
}

/** The single place users see every yield venue. Live options can be picked, the rest are visible but locked and say why. */
export function VaultOptionList({ selected, onSelect, disabled, compact, ariaLabel = 'Yield venues' }: VaultOptionListProps) {
  return <div className={`vault-options${compact ? ' compact' : ''}`} role="group" aria-label={ariaLabel}>
    {VAULT_OPTIONS.map(option => {
      const live = isSubmittable(option);
      const isSelected = selected === option.id;
      const body = <>
        <span className="vault-option-top">
          <span className="vault-option-name">{isSelected && <Check size={14} aria-hidden />}{!live && !isSelected && <Lock size={13} aria-hidden />}{option.name}</span>
          <VaultStatusBadge option={option} />
        </span>
        <span className="vault-option-tag">{option.tagline}</span>
        {!compact && <span className="vault-option-detail">{option.detail}</span>}
        {option.status === 'coming-soon' && <span className="vault-option-note">{COMING_SOON_COPY}</span>}
        {option.id === 'xoxno' && <span className="vault-option-note">Pick XOXNO in Create a vault below. Testnet only, not yet selectable as a market route.</span>}
        {option.status === 'demo' && <span className="vault-option-note">Demo flow only. Nothing is deployed on chain from this app yet.</span>}
      </>;
      if (live && onSelect) {
        return <button key={option.id} type="button" className={`vault-option selectable${isSelected ? ' selected' : ''}`} aria-pressed={isSelected} disabled={disabled} onClick={() => onSelect(option)}>{body}</button>;
      }
      return <div key={option.id} className={`vault-option${live ? '' : ' locked'}`} aria-disabled={!live} data-vault={option.id}>
        {body}
        {option.id === 'aquarius' && <Link className="text-link vault-option-link" href="/vaults">Try the Aquarius vault demo <ArrowUpRight size={13} aria-hidden /></Link>}
      </div>;
    })}
  </div>;
}
