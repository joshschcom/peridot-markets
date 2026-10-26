'use client';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, ClipboardPaste, Search } from 'lucide-react';
import { assetColor, assetInitials, searchAssets, type CatalogAsset } from '@/lib/vaults/assets';
import { shortAddress } from '@/lib/vaults/aquarius-pools';
import './vaults.css';

export interface TokenComboboxProps {
  id: string;
  label: string;
  assets: readonly CatalogAsset[];
  /** Selected contract id, or '' for none. A pasted address that is not in the list shows as a custom entry. */
  value: string;
  onPick: (asset: CatalogAsset) => void;
  /** The "Paste a custom token address" option; the caller focuses its address input. */
  onCustom: () => void;
  disabled?: boolean;
  note?: string;
  placeholder?: string;
}

export function AssetIcon({ symbol, size = 26 }: { symbol: string; size?: number }) {
  return <span className="asset-icon" aria-hidden style={{ background: assetColor(symbol), width: size, height: size, fontSize: size <= 22 ? 9 : 10 }}>{assetInitials(symbol)}</span>;
}

function poolKind(type: string): string { return type === 'concentrated' ? 'CL' : type === 'stable' ? 'stable' : type === 'constant_product' ? 'CP' : ''; }

/** Searchable, keyboard-driven token dropdown: a trigger button opens a popover with a search box (role combobox) and a listbox. */
export function TokenCombobox({ id, label, assets, value, onPick, onCustom, disabled, note, placeholder = 'Choose a token' }: TokenComboboxProps) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = assets.find(a => a.address === value);
  const shown = useMemo(() => searchAssets(assets, query), [assets, query]);
  const total = shown.length + 1; // plus the custom entry
  const listId = `${id}-listbox`, optId = (i: number) => `${id}-opt-${i}`;

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const away = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  useEffect(() => { setActive(0); }, [query, open]);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`#${CSS.escape(optId(active))}`)?.scrollIntoView({ block: 'nearest' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const close = (refocus = true) => { setOpen(false); setQuery(''); if (refocus) trigger.current?.focus(); };
  const choose = (i: number) => {
    if (i >= shown.length) { close(false); onCustom(); return; }
    const a = shown[i]; close(); onPick(a);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % total); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i - 1 + total) % total); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(total - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { close(false); }
  };
  const groups: Array<{ title: string; start: number; items: CatalogAsset[] }> = [];
  for (const [i, a] of shown.entries()) {
    const title = a.collision ? 'Same symbol, unverified contract' : a.verified ? 'Known assets' : a.origins.includes('launchpad') ? 'Launched on Peridot' : a.origins.includes('demo') ? 'Demo tokens' : 'Other Aquarius pool tokens';
    const g = groups[groups.length - 1];
    if (g && g.title === title) g.items.push(a); else groups.push({ title, start: i, items: [a] });
  }

  return <div className={`field token-combobox${open ? ' open' : ''}`} ref={root}>
    <label id={`${uid}-label`} htmlFor={`${id}-trigger`}>{label}</label>
    <button ref={trigger} type="button" id={`${id}-trigger`} className="tc-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-labelledby={`${uid}-label ${uid}-value`} disabled={disabled}
      onClick={() => setOpen(o => !o)} onKeyDown={e => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setOpen(true); } }}>
      {selected
        ? <span className="tc-value" id={`${uid}-value`}><AssetIcon symbol={selected.symbol} /><span className="tc-sym">{selected.symbol}</span><span className="tc-name">{selected.name}</span><span className="tc-addr">{shortAddress(selected.address)}</span></span>
        : value
          ? <span className="tc-value" id={`${uid}-value`}><AssetIcon symbol="?" /><span className="tc-sym">Custom token</span><span className="tc-addr">{shortAddress(value)}</span></span>
          : <span className="tc-value tc-placeholder" id={`${uid}-value`}>{placeholder}</span>}
      <ChevronDown size={16} aria-hidden className="tc-chev" />
    </button>
    {open && <div className="tc-popover">
      <div className="tc-search"><Search size={14} aria-hidden />
        <input ref={search} type="text" role="combobox" aria-label={`Search ${label.toLowerCase()}`} aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={optId(active)} autoComplete="off" spellCheck={false} placeholder="Search symbol, name or address" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey} />
      </div>
      <ul ref={list} id={listId} role="listbox" aria-labelledby={`${uid}-label`} className="tc-list">
        {groups.map(g => <li key={g.title} role="presentation" className="tc-group">
          <span className="tc-group-title">{g.title}</span>
          <ul role="presentation">{g.items.map((a, j) => { const i = g.start + j; const isSel = a.address === value; return <li key={a.address} id={optId(i)} role="option" aria-selected={isSel} className={`tc-option${i === active ? ' active' : ''}${a.collision ? ' collision' : ''}`} onMouseMove={() => { if (active !== i) setActive(i); }} onMouseDown={e => e.preventDefault()} onClick={() => choose(i)}>
            <AssetIcon symbol={a.symbol} />
            <span className="tc-main">
              <span className="tc-line"><span className="tc-sym">{a.symbol}</span>{a.name && <span className="tc-name">{a.name}</span>}<span className="tc-addr">{shortAddress(a.address)}</span>{a.decimals !== null && <span className="tc-dec">{a.decimals} dec</span>}</span>
              <span className="tc-badges">
                {a.reflector === true && <span className="tc-badge ok">Reflector feed</span>}
                {a.reflector === null && !a.collision && <span className="tc-badge">Verify for price</span>}
                {a.pools.length > 0 && <span className="tc-badge pool">{a.pools.length} Aquarius pool{a.pools.length > 1 ? 's' : ''}</span>}
                {a.vault && <span className="tc-badge info">Vault available</span>}
                {a.origins.includes('launchpad') && <span className="tc-badge accent">Launchpad</span>}
                {a.collision && <span className="tc-badge warn">Unverified issuer</span>}
              </span>
              {a.pools.length > 0 && <span className="tc-pools">{a.pools.slice(0, 3).map(p => <span key={p.address} className="tc-pool" title={p.address}>{p.pair}{p.feeBps !== null ? ` ${(p.feeBps / 100).toFixed(2)}%` : ''} {poolKind(p.type)}</span>)}{a.pools.length > 3 && <span className="tc-pool">+{a.pools.length - 3} more</span>}</span>}
            </span>
            {isSel && <Check size={15} aria-hidden className="tc-check" />}
          </li>; })}</ul>
        </li>)}
        {shown.length === 0 && <li role="presentation" className="tc-empty">No listed token matches &quot;{query}&quot;. Paste its contract address instead.</li>}
        <li id={optId(shown.length)} role="option" aria-selected={false} className={`tc-option tc-custom${active === shown.length ? ' active' : ''}`} onMouseMove={() => { if (active !== shown.length) setActive(shown.length); }} onMouseDown={e => e.preventDefault()} onClick={() => choose(shown.length)}>
          <span className="asset-icon ghost" aria-hidden><ClipboardPaste size={13} /></span>
          <span className="tc-main"><span className="tc-line"><span className="tc-sym">Paste a custom token address (C...)</span></span><span className="tc-name">Any Soroban token or CODE:ISSUER. It is read and priced the same way.</span></span>
        </li>
      </ul>
      {note && <p className="tc-note">{note}</p>}
    </div>}
  </div>;
}
