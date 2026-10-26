'use client';
import Link from 'next/link';
import { ArrowUpRight, Check, Lock } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { Badge } from '@/components/ui/primitives';
import { APPROVAL_COPY, VAULT_OPTIONS, venueAvailability, type VaultId, type VaultOption } from '@/lib/vaults/registry';
import { deployedKinds } from '@/lib/vaults/factory-client';
import { YieldRate, type YieldRateProps } from './YieldRate';
import './vaults.css';

export interface VaultOptionListProps {
  /** Currently selected option, when the list is used as a picker. */
  selected?: VaultId;
  /** Called for options that are selectable on this network. Others are never selectable. */
  onSelect?: (option: VaultOption) => void;
  disabled?: boolean;
  /** Hide the long description (wizard) or show it (vaults page). */
  compact?: boolean;
  ariaLabel?: string;
  /** Extra lock reason per option (for example "no DeFindex vault for this token"); null means not locked. */
  isLocked?: (option: VaultOption) => string | null;
  /** Inputs for the rate shown on each card; undefined hides the rate for that option. */
  rateFor?: (option: VaultOption) => Omit<YieldRateProps, 'venue'> | undefined;
}

export function VaultStatusBadge({ option }: { option: VaultOption }) {
  const a = venueAvailability(option, network.name, deployedKinds());
  return <Badge tone={a.tone}>{a.label}</Badge>;
}

/** The single place users see every yield venue. Selectable options can be picked, the rest are visible but locked and say why. */
export function VaultOptionList({ selected, onSelect, disabled, compact, ariaLabel = 'Yield venues', isLocked, rateFor }: VaultOptionListProps) {
  const kinds = deployedKinds();
  return <div className={`vault-options${compact ? ' compact' : ''}`} role="group" aria-label={ariaLabel}>
    {VAULT_OPTIONS.map(option => {
      const a = venueAvailability(option, network.name, kinds);
      const extra = isLocked?.(option) ?? null;
      const live = a.selectable && !extra;
      const reason = extra ?? a.reason;
      const isSelected = selected === option.id;
      const rate = rateFor?.(option);
      const body = <>
        <span className="vault-option-top">
          <span className="vault-option-name">{isSelected && <Check size={14} aria-hidden />}{!live && !isSelected && <Lock size={13} aria-hidden />}{option.name}</span>
          <Badge tone={a.tone}>{a.label}</Badge>
        </span>
        <span className="vault-option-tag">{option.tagline}</span>
        {rate && <YieldRate venue={option.id} {...rate} />}
        {!compact && <span className="vault-option-detail">{option.detail}</span>}
        {!compact && option.kind && <span className="vault-option-detail">{APPROVAL_COPY}</span>}
        {!live && reason && <span className="vault-option-note">{reason}</span>}
      </>;
      if (live && onSelect) {
        return <button key={option.id} type="button" className={`vault-option selectable${isSelected ? ' selected' : ''}`} aria-pressed={isSelected} disabled={disabled} data-vault={option.id} onClick={() => onSelect(option)}>{body}</button>;
      }
      return <div key={option.id} className={`vault-option${live ? '' : ' locked'}`} aria-disabled={!live} data-vault={option.id}>
        {body}
        {option.kind && <Link className="text-link vault-option-link" href="/vaults#create-vault">Create a {option.name} <ArrowUpRight size={13} aria-hidden /></Link>}
      </div>;
    })}
  </div>;
}
