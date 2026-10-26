import { network } from '@/lib/peridot/network';
import { clientIp, rateLimited, readImageFile } from '@/lib/group-image/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Referrer-Policy': 'no-referrer',
};

/** Serves a stored upload by content hash. The name is validated as <64 hex>.<png|jpg|webp>, so no path can escape the directory. */
export async function GET(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (network.useMocks) return new Response('Not found', { status: 404, headers: SECURITY });
  if (rateLimited(clientIp(request.headers), 'file', 600, 60_000)) return new Response('Too many requests', { status: 429, headers: { ...SECURITY, 'Retry-After': '60' } });
  const file = await readImageFile(network.name, name);
  if (!file) return new Response('Not found', { status: 404, headers: SECURITY });
  return new Response(new Uint8Array(file.bytes), { status: 200, headers: { ...SECURITY, 'Content-Type': file.mime, 'Content-Length': String(file.bytes.length), 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
