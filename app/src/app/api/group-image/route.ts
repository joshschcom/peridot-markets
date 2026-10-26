import { NextResponse } from 'next/server';
import { network } from '@/lib/peridot/network';
import { getGroup } from '@/lib/peridot/factory';
import { applyProfileUpdate, parseProfileInput, ProfileError } from '@/lib/group-image/service';
import { clientIp, isGroupId, rateLimited, readProfile } from '@/lib/group-image/store';
import { MAX_IMAGE_BYTES } from '@/lib/group-image/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = MAX_IMAGE_BYTES + 64 * 1024;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...headers } });

/** Public profile fields only. */
function publicProfile(p: NonNullable<Awaited<ReturnType<typeof readProfile>>>) {
  return { groupId: p.groupId, owner: p.owner, image: p.image, name: p.name, description: p.description, links: p.links, updatedAt: p.updatedAt };
}

/** GET /api/group-image?groups=1,2,3 returns { profiles: { "<id>": profile } } for the server's own network. */
export async function GET(request: Request) {
  if (network.useMocks) return json({ profiles: {} });
  if (rateLimited(clientIp(request.headers), 'read', 120, 60_000)) return json({ error: 'Too many requests.' }, 429, { 'Retry-After': '60' });
  const raw = new URL(request.url).searchParams.get('groups') || '';
  const ids = [...new Set(raw.split(',').filter(Boolean).map(Number))].slice(0, 100);
  if (!ids.length || !ids.every(isGroupId)) return json({ error: 'Pass groups=1,2,3 with valid group ids.' }, 400);
  const profiles: Record<string, ReturnType<typeof publicProfile>> = {};
  for (const id of ids) { const p = await readProfile(network.name, id); if (p) profiles[id] = publicProfile(p); }
  return json({ profiles }, 200, { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' });
}

async function readBody(request: Request): Promise<Request> {
  const declared = Number(request.headers.get('content-length') || '0');
  if (declared > MAX_BODY) throw new ProfileError(413, 'The upload is too large.');
  if (!request.body) throw new ProfileError(400, 'Empty request.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BODY) { await reader.cancel(); throw new ProfileError(413, 'The upload is too large.'); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { buffer.set(c, at); at += c.length; }
  return new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type') || '' }, body: buffer });
}

/** POST multipart/form-data: groupId, profile (JSON), signedTx (XDR signed by the group owner), optional image file.
 * Sending profile.image = null removes the image. */
export async function POST(request: Request) {
  if (network.useMocks) return json({ error: 'Demo mode keeps images in the browser only.' }, 404);
  if (rateLimited(clientIp(request.headers), 'write', 10, 10 * 60_000)) return json({ error: 'Too many uploads. Try again in a few minutes.' }, 429, { 'Retry-After': '600' });
  try {
    const type = request.headers.get('content-type') || '';
    if (!type.toLowerCase().startsWith('multipart/form-data')) throw new ProfileError(415, 'Send multipart/form-data.');
    const form = await (await readBody(request)).formData();
    const groupId = Number(form.get('groupId')), signedXdr = form.get('signedTx'), profileText = form.get('profile'), file = form.get('image');
    if (!isGroupId(groupId) || typeof signedXdr !== 'string' || typeof profileText !== 'string' || signedXdr.length > 8192 || profileText.length > 4096) throw new ProfileError(400, 'Invalid request.');
    let parsed: unknown;
    try { parsed = JSON.parse(profileText); } catch { throw new ProfileError(400, 'Invalid profile JSON.'); }
    const profile = parseProfileInput(parsed);
    if (file !== null && typeof file === 'string') throw new ProfileError(400, 'The image must be a file.');
    const bytes = file ? new Uint8Array(await (file as File).arrayBuffer()) : null;
    const saved = await applyProfileUpdate({
      network: network.name, passphrase: network.passphrase, groupId, profile, file: bytes, signedXdr,
      ownerOf: async id => { try { return (await getGroup(id)).owner; } catch { return null; } },
    });
    return json({ profile: publicProfile(saved) });
  } catch (error) {
    if (error instanceof ProfileError) return json({ error: error.message }, error.status);
    return json({ error: 'The profile could not be saved.' }, 500);
  }
}
