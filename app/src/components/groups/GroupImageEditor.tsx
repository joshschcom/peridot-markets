'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { network } from '@/lib/peridot/network';
import { useWallet } from '@/lib/peridot/wallet';
import { drawCrop, exportCrop, publishGroupImage, useGroupImageSrc, useGroupProfile, validatePickedFile, type CropView, type PendingImage } from '@/lib/group-image/client';
import { validateImageUrl } from '@/lib/group-image/validate';
import { Notice } from '@/components/ui/primitives';
import { GroupAvatar } from './GroupAvatar';
import './group-image.css';

const errorText = (e: unknown) => e instanceof Error ? e.message : String(e);
const PREVIEW = 160;

/** Image field for a group. With `groupId` (the owner Control Panel) it saves straight away; without it (launch wizard) it only
 * reports the picked image through `onPending`, and `GroupImagePublisher` saves it once the group exists. */
export function GroupImageEditor({ groupId, owner, groupName, pending, onPending, disabled }: { groupId?: number; owner?: string; groupName: string; pending?: PendingImage | null; onPending?: (p: PendingImage | null) => void; disabled?: boolean }) {
  const wallet = useWallet();
  const fileId = useId(), urlId = useId();
  const saved = useGroupImageSrc(groupId);
  const savedProfile = useGroupProfile(groupId);
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [view, setView] = useState<CropView>({ zoom: 1, x: 0, y: 0 });
  const [local, setLocal] = useState<PendingImage | null>(null);
  const [urlText, setUrlText] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = pending !== undefined ? pending : local;
  const setCurrent = useCallback((p: PendingImage | null) => { setLocal(p); onPending?.(p); }, [onPending]);

  useEffect(() => {
    const c = canvas.current;
    if (!bitmap || !c) return;
    const ctx = c.getContext('2d');
    if (ctx) drawCrop(ctx, bitmap, view, PREVIEW);
    const handle = setTimeout(() => {
      exportCrop(bitmap, view).then(blob => { setCurrent({ kind: 'blob', blob }); setError(''); }).catch(e => setError(errorText(e)));
    }, 250);
    return () => clearTimeout(handle);
  }, [bitmap, view, setCurrent]);

  const pick = async (file: File | undefined) => {
    setError(''); setDone('');
    if (!file) return;
    const problem = await validatePickedFile(file);
    if (problem) { setError(problem); return; }
    try {
      const decoded = await createImageBitmap(file);
      if (decoded.width < 32 || decoded.height < 32) { setError('Choose an image at least 32 by 32 pixels.'); return; }
      setBitmap(decoded); setView({ zoom: 1, x: 0, y: 0 });
    } catch { setError('This image could not be read. Try another PNG, JPEG or WebP file.'); }
  };
  const useUrl = () => {
    setError(''); setDone('');
    const checked = validateImageUrl(urlText);
    if (!checked.ok) { setError(checked.error); return; }
    setBitmap(null); setUrlText(checked.url); setCurrent({ kind: 'url', url: checked.url });
  };
  const clearLocal = () => { setBitmap(null); setCurrent(null); setUrlText(''); setError(''); setDone(''); };

  const canSave = groupId !== undefined && !!owner && wallet.address === owner && !wallet.networkMismatch && !network.readOnly;
  const save = async (next: PendingImage) => {
    if (groupId === undefined || !owner) return;
    setBusy(true); setError(''); setDone('');
    try {
      await publishGroupImage({ groupId, owner, signTransaction: wallet.signTransaction, pending: next });
      setDone(next.kind === 'remove' ? 'Group image removed.' : 'Group image saved.');
      setBitmap(null); setCurrent(null); setUrlText('');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const shown = current?.kind === 'url' ? current.url : undefined;
  const live = groupId !== undefined;
  return <div className="group-image-editor" data-testid="group-image-editor">
    <div className="group-image-tabs" role="group" aria-label="Image source">
      <button type="button" aria-pressed={tab === 'upload'} onClick={() => setTab('upload')} disabled={disabled}>Upload</button>
      <button type="button" aria-pressed={tab === 'url'} onClick={() => setTab('url')} disabled={disabled}>Image URL</button>
    </div>
    <div className="group-image-row">
      <div className="group-image-preview">
        {bitmap && tab === 'upload'
          ? <div className="group-image-crop"><canvas ref={canvas} width={PREVIEW} height={PREVIEW} aria-label="Cropped preview" /></div>
          : <GroupAvatar groupId={groupId} name={groupName || 'Group'} size={PREVIEW / 1.6} src={shown ?? (current?.kind === 'remove' ? null : undefined)} />}
        <span className="subtle" style={{ fontSize: 12 }}>{bitmap && tab === 'upload' ? 'Square preview' : current ? 'Preview' : saved ? 'Current image' : 'No image yet'}</span>
      </div>
      <div className="group-image-controls">
        {tab === 'upload' ? <>
          <div className="group-image-actions">
            <label className="button secondary" htmlFor={fileId} aria-disabled={disabled}><ImagePlus size={15} aria-hidden />{bitmap ? 'Choose another' : 'Choose image'}</label>
            <input id={fileId} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {bitmap && <>
            <label className="range">Zoom<input type="range" min={1} max={3} step={0.05} value={view.zoom} onChange={e => setView(v => ({ ...v, zoom: Number(e.target.value) }))} aria-label="Zoom" /></label>
            <label className="range">Move left or right<input type="range" min={-1} max={1} step={0.02} value={view.x} onChange={e => setView(v => ({ ...v, x: Number(e.target.value) }))} aria-label="Horizontal position" /></label>
            <label className="range">Move up or down<input type="range" min={-1} max={1} step={0.02} value={view.y} onChange={e => setView(v => ({ ...v, y: Number(e.target.value) }))} aria-label="Vertical position" /></label>
          </>}
          <span className="field-hint">PNG, JPEG or WebP, cropped to a square and saved at up to 512 by 512 pixels (512 KB maximum). Photo metadata is removed.</span>
        </> : <div className="field">
          <label htmlFor={urlId}>HTTPS image URL</label>
          <input id={urlId} type="url" inputMode="url" placeholder="https://example.com/logo.png" maxLength={500} value={urlText} disabled={disabled} onChange={e => setUrlText(e.target.value)} />
          <span className="field-hint">Visitors&apos; browsers load this image directly from that site, so its owner can see their IP address. Uploading is more private.</span>
          <div className="group-image-actions"><button type="button" className="button secondary" disabled={disabled || !urlText} onClick={useUrl}>Use this URL</button></div>
        </div>}
        <div className="group-image-actions">
          {live && <button type="button" className="button" disabled={disabled || busy || !canSave || !current || current.kind === 'remove'} onClick={() => current && void save(current)}>
            {busy ? <Loader2 size={14} className="spin" aria-hidden /> : <Check size={14} aria-hidden />}{busy ? 'Waiting for signature...' : 'Save image'}</button>}
          {live && <button type="button" className="button danger sm" disabled={disabled || busy || !canSave || !savedProfile?.image} onClick={() => void save({ kind: 'remove' })}><Trash2 size={14} aria-hidden />Remove image</button>}
          {!live && current && <button type="button" className="button ghost sm" disabled={disabled} onClick={clearLocal}><Trash2 size={14} aria-hidden />Remove</button>}
        </div>
        {live && !canSave && <p className="field-hint" style={{ margin: 0 }}>Connect the group owner wallet on {network.name} to change the image.</p>}
        {live && canSave && !network.useMocks && <p className="field-hint" style={{ margin: 0 }}>Saving asks your wallet for a free signature that proves you own this group. No transaction is sent.</p>}
        {!live && <p className="field-hint" style={{ margin: 0 }}>{network.useMocks ? 'Demo mode keeps the image in this browser tab only.' : 'The image is saved after your group is created, with one free wallet signature that proves ownership.'}</p>}
        {error && <Notice tone="danger" role="alert">{error}</Notice>}
        {done && <Notice tone="success" role="status">{done}</Notice>}
      </div>
    </div>
  </div>;
}

/** Shown on the launch success screen: publishes the image picked in step 1 to the new group. */
export function GroupImagePublisher({ groupId, owner, pending, onDone }: { groupId: number; owner: string; pending: PendingImage; onDone: () => void }) {
  const wallet = useWallet();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const auto = useRef(false);
  const run = useCallback(async () => {
    setBusy(true); setError('');
    try { await publishGroupImage({ groupId, owner, signTransaction: wallet.signTransaction, pending }); setSaved(true); onDone(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }, [groupId, owner, pending, wallet.signTransaction, onDone]);
  useEffect(() => { if (network.useMocks && !auto.current) { auto.current = true; void run(); } }, [run]);
  if (saved) return <Notice tone="success" role="status">Group image saved.</Notice>;
  return <div className="stack-sm" style={{ justifyItems: 'center' }}>
    {error && <Notice tone="danger" role="alert">{error}</Notice>}
    <button type="button" className="button secondary" disabled={busy || wallet.address !== owner} onClick={() => void run()}>{busy ? <Loader2 size={14} className="spin" aria-hidden /> : <ImagePlus size={14} aria-hidden />}{busy ? 'Saving image...' : 'Save group image (free signature)'}</button>
  </div>;
}
