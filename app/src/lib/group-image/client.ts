'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { network } from '@/lib/peridot/network';
import { buildProfileChallenge, imageSrc, sha256Hex, type GroupProfileInput, type StoredImage } from './profile';
import { checkImageBytes, detectImageType, MAX_IMAGE_BYTES, validateImageUrl } from './validate';

/** Public view of a stored profile. */
export interface PublicGroupProfile { groupId: number; owner: string; image: StoredImage | null; name?: string; description?: string; links?: string[]; updatedAt: number }
/** An image the user picked but has not published yet. `blob` is the already-cropped file. */
export type PendingImage = { kind: 'blob'; blob: Blob } | { kind: 'url'; url: string } | { kind: 'remove' };

/* ---- shared cache with batching: cards on one page cost a single request ---- */
const cache = new Map<number, PublicGroupProfile | null>();
const listeners = new Set<() => void>();
let version = 0;
const wanted = new Set<number>();
let timer: ReturnType<typeof setTimeout> | undefined;
const MOCK_KEY = 'peridot-demo-group-images-v1';
let mockLoaded = false;

function emit() { version++; listeners.forEach(l => l()); }
function loadMock() {
  if (mockLoaded || typeof window === 'undefined') return;
  mockLoaded = true;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(MOCK_KEY) || '{}') as Record<string, PublicGroupProfile>;
    for (const [id, p] of Object.entries(stored)) cache.set(Number(id), p);
  } catch { /* storage unavailable: demo images stay in memory */ }
}
function persistMock() {
  try {
    const out: Record<string, PublicGroupProfile> = {};
    for (const [id, p] of cache) if (p) out[id] = p;
    window.sessionStorage.setItem(MOCK_KEY, JSON.stringify(out));
  } catch { /* memory only */ }
}
async function flush() {
  timer = undefined;
  const ids = [...wanted].filter(id => !cache.has(id));
  wanted.clear();
  if (!ids.length) return;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    try {
      const response = await fetch(`/api/group-image?groups=${batch.join(',')}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json() as { profiles?: Record<string, PublicGroupProfile> };
      for (const id of batch) cache.set(id, data.profiles?.[id] ?? null);
    } catch { for (const id of batch) cache.set(id, null); }
  }
  emit();
}
function request(id: number) {
  if (cache.has(id) || wanted.has(id) || typeof window === 'undefined') return;
  if (network.useMocks) { loadMock(); if (!cache.has(id)) cache.set(id, null); return; }
  wanted.add(id);
  timer ??= setTimeout(() => { void flush(); }, 15);
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** Profile for a group (image today; name, description and links when those ship). `undefined` while loading. */
export function useGroupProfile(groupId: number | undefined): PublicGroupProfile | null | undefined {
  useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => { if (groupId !== undefined) { loadMock(); request(groupId); if (network.useMocks) emit(); } }, [groupId]);
  if (groupId === undefined) return null;
  if (network.useMocks) loadMock();
  return cache.get(groupId);
}
export function useGroupImageSrc(groupId: number | undefined): string | null {
  return imageSrc(useGroupProfile(groupId)?.image);
}

/* ---- picking and cropping ---- */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const OUTPUT_SIZE = 512;
export interface CropView { zoom: number; x: number; y: number }

/** Checks a file the user picked before decoding it. Only PNG, JPEG and WebP signatures pass; SVG and GIF never do. */
export async function validatePickedFile(file: Blob): Promise<string | null> {
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_SOURCE_BYTES) return 'Choose an image under 10 MB. It is resized to 512 by 512 pixels.';
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  return detectImageType(head) ? null : 'Only PNG, JPEG and WebP images are accepted.';
}
export function drawCrop(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, view: CropView, size: number) {
  const side = Math.min(bitmap.width, bitmap.height) / Math.max(1, view.zoom);
  const sx = (bitmap.width - side) / 2 * (1 + view.x), sy = (bitmap.height - side) / 2 * (1 + view.y);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
}
/** Re-encodes the visible square to at most 512 by 512 pixels. Canvas output carries no EXIF, so location data in photos is dropped. */
export async function exportCrop(bitmap: ImageBitmap, view: CropView): Promise<Blob> {
  for (const [size, quality] of [[OUTPUT_SIZE, 0.92], [OUTPUT_SIZE, 0.8], [384, 0.8], [256, 0.7]] as const) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image editing is not available in this browser.');
    drawCrop(ctx, bitmap, view, size);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
    if (blob && blob.size <= MAX_IMAGE_BYTES && (blob.type === 'image/webp' || blob.type === 'image/png')) return blob;
  }
  throw new Error('The image could not be reduced below 512 KB. Try a simpler picture.');
}

/* ---- publishing ---- */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('The image could not be read.')); r.readAsDataURL(blob); });
}
export interface PublishArgs { groupId: number; owner: string; signTransaction: (xdr: string) => Promise<string>; pending: PendingImage }

/** Saves (or removes) the group image. Live networks ask the owner wallet for a free, never-submitted signature;
 * demo mode keeps a data URL in memory for this browser session only. */
export async function publishGroupImage({ groupId, owner, signTransaction, pending }: PublishArgs): Promise<PublicGroupProfile | null> {
  if (network.useMocks) {
    loadMock();
    let image: StoredImage | null = null;
    if (pending.kind === 'blob') image = { kind: 'data', dataUrl: await blobToDataUrl(pending.blob) };
    else if (pending.kind === 'url') { const c = validateImageUrl(pending.url); if (!c.ok) throw new Error(c.error); image = { kind: 'url', url: c.url }; }
    const profile: PublicGroupProfile | null = image ? { groupId, owner, image, updatedAt: Math.floor(Date.now() / 1000) } : null;
    cache.set(groupId, profile); persistMock(); emit();
    return profile;
  }
  let bytes: Uint8Array | null = null, profile: GroupProfileInput;
  if (pending.kind === 'blob') {
    bytes = new Uint8Array(await pending.blob.arrayBuffer());
    const checked = checkImageBytes(bytes);
    if (!checked.ok) throw new Error(checked.error);
    profile = { image: { kind: 'upload', sha256: sha256Hex(bytes), mime: checked.info.mime } };
  } else if (pending.kind === 'url') {
    const checked = validateImageUrl(pending.url);
    if (!checked.ok) throw new Error(checked.error);
    profile = { image: { kind: 'url', url: checked.url } };
  } else profile = { image: null };
  const challenge = buildProfileChallenge({ owner, network: network.name, passphrase: network.passphrase, groupId, profile });
  const signedTx = await signTransaction(challenge.xdr);
  const form = new FormData();
  form.set('groupId', String(groupId)); form.set('profile', JSON.stringify(profile)); form.set('signedTx', signedTx);
  if (bytes && pending.kind === 'blob') form.set('image', new Blob([bytes as BlobPart], { type: 'application/octet-stream' }), 'group-image');
  const response = await fetch('/api/group-image', { method: 'POST', body: form });
  const data = await response.json().catch(() => ({})) as { profile?: PublicGroupProfile; error?: string };
  if (!response.ok || !data.profile) throw new Error(data.error || 'The image could not be saved.');
  cache.set(groupId, data.profile); emit();
  return data.profile;
}
export function forgetGroupProfile(groupId: number) { cache.delete(groupId); emit(); }
