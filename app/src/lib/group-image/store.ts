import { promises as fs } from 'node:fs';
import path from 'node:path';
import { EXTENSION_MIME, MIME_EXTENSION, type ImageMime } from './validate';
import type { GroupProfile } from './profile';

/** File-backed registry. Layout: <GROUP_IMAGE_DIR>/<network>/files/<sha256>.<ext> and <network>/profiles/<groupId>.json. */
export function uploadRoot(): string {
  return path.resolve(process.env.GROUP_IMAGE_DIR || (process.env.NODE_ENV === 'production' ? '/var/lib/peridot-web/uploads' : './.uploads'));
}
const dirs = (network: string) => ({ files: path.join(uploadRoot(), network, 'files'), profiles: path.join(uploadRoot(), network, 'profiles') });
const HASH = /^[0-9a-f]{64}$/;
export const isGroupId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4294967295;

async function writeAtomic(file: string, data: Uint8Array | string) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o750 });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(tmp, data, { mode: 0o640 });
  await fs.rename(tmp, file);
}

export async function saveImageFile(network: string, hash: string, mime: ImageMime, bytes: Uint8Array) {
  if (!HASH.test(hash)) throw new Error('Invalid image hash.');
  await writeAtomic(path.join(dirs(network).files, `${hash}.${MIME_EXTENSION[mime]}`), bytes);
}
export async function readImageFile(network: string, name: string): Promise<{ bytes: Buffer; mime: ImageMime } | null> {
  const match = /^([0-9a-f]{64})\.(png|jpg|webp)$/.exec(name);
  if (!match) return null;
  try { return { bytes: await fs.readFile(path.join(dirs(network).files, name)), mime: EXTENSION_MIME[match[2]] }; } catch { return null; }
}
export async function readProfile(network: string, groupId: number): Promise<GroupProfile | null> {
  if (!isGroupId(groupId)) return null;
  try { return JSON.parse(await fs.readFile(path.join(dirs(network).profiles, `${groupId}.json`), 'utf8')) as GroupProfile; } catch { return null; }
}
export async function writeProfile(network: string, profile: GroupProfile) {
  await writeAtomic(path.join(dirs(network).profiles, `${profile.groupId}.json`), JSON.stringify(profile));
}
/** Removes an upload that no profile references any more. Profiles are small, so a directory scan is fine. */
export async function pruneUnreferenced(network: string, hash: string, ext: string) {
  try {
    const { files, profiles } = dirs(network);
    for (const name of await fs.readdir(profiles)) {
      if (!name.endsWith('.json')) continue;
      try { const p = JSON.parse(await fs.readFile(path.join(profiles, name), 'utf8')) as GroupProfile; if (p.image?.kind === 'upload' && p.image.sha256 === hash) return; } catch { /* unreadable profile: keep the file */ }
    }
    await fs.rm(path.join(files, `${hash}.${ext}`), { force: true });
  } catch { /* nothing to prune */ }
}

/** Serialises writes per group inside one process so two saves cannot interleave their replay checks. */
const chains = new Map<string, Promise<unknown>>();
export function withGroupLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const next = (chains.get(key) || Promise.resolve()).catch(() => undefined).then(task);
  chains.set(key, next);
  void next.finally(() => { if (chains.get(key) === next) chains.delete(key); }).catch(() => undefined);
  return next;
}

/** Fixed-window in-memory limiter per IP and bucket. Resets on restart, which is fine for abuse damping. */
const windows = new Map<string, { start: number; count: number }>();
export function rateLimited(ip: string, bucket: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const key = `${bucket}|${ip}`, w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5000) for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    return false;
  }
  w.count++;
  return w.count > limit;
}
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || headers.get('x-real-ip') || 'unknown').slice(0, 64);
}
export function resetRateLimits() { windows.clear(); }
