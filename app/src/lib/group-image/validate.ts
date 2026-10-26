/** Pure validation helpers for group profile images. Shared by the API route, the browser UI and the tests.
 * Nothing here trusts the file name or the declared content type: the type is decided from magic bytes only. */
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_IMAGE_DIMENSION = 1024;
export const MAX_NAME_LENGTH = 32;
export const MAX_DESCRIPTION_LENGTH = 240;
export const MAX_LINKS = 4;
export const MAX_URL_LENGTH = 500;

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';
export const MIME_EXTENSION: Record<ImageMime, 'png' | 'jpg' | 'webp'> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const EXTENSION_MIME: Record<string, ImageMime> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ascii = (b: Uint8Array, at: number, length: number) => String.fromCharCode(...b.subarray(at, at + length));
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const u32le = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];

/** Returns the image type from the leading bytes, or null for anything else (SVG, HTML, GIF, BMP, ...). */
export function detectImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 8 && PNG_SIGNATURE.every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  return null;
}

export interface ImageInfo { mime: ImageMime; width: number; height: number }

/** Reads the pixel size from the container header without decoding. Returns null when the structure is malformed. */
export function readImageSize(bytes: Uint8Array, mime: ImageMime): { width: number; height: number } | null {
  try {
    if (mime === 'image/png') {
      if (bytes.length < 33 || ascii(bytes, 12, 4) !== 'IHDR') return null;
      return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    }
    if (mime === 'image/jpeg') {
      let i = 2;
      while (i + 4 <= bytes.length) {
        if (bytes[i] !== 0xff) return null;
        const marker = bytes[i + 1];
        if (marker === 0xff) { i++; continue; }
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
        const length = u16be(bytes, i + 2);
        if (length < 2) return null;
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          if (i + 9 > bytes.length) return null;
          return { height: u16be(bytes, i + 5), width: u16be(bytes, i + 7) };
        }
        if (marker === 0xda) return null;
        i += 2 + length;
      }
      return null;
    }
    if (bytes.length < 30) return null;
    const kind = ascii(bytes, 12, 4);
    if (kind === 'VP8X') return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
    if (kind === 'VP8L') {
      if (bytes[20] !== 0x2f) return null;
      const bits = u32le(bytes, 21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ') {
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
      return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    }
    return null;
  } catch { return null; }
}

export type ImageCheck = { ok: true; info: ImageInfo } | { ok: false; error: string };

/** Size, type and dimension policy for an uploaded file. */
export function checkImageBytes(bytes: Uint8Array): ImageCheck {
  if (bytes.length === 0) return { ok: false, error: 'The image file is empty.' };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: `The image is larger than ${MAX_IMAGE_BYTES / 1024} KB.` };
  const mime = detectImageType(bytes);
  if (!mime) return { ok: false, error: 'Only PNG, JPEG and WebP images are accepted.' };
  const size = readImageSize(bytes, mime);
  if (!size || size.width < 1 || size.height < 1) return { ok: false, error: 'The image header is not valid.' };
  if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) return { ok: false, error: `The image is larger than ${MAX_IMAGE_DIMENSION} by ${MAX_IMAGE_DIMENSION} pixels.` };
  if (mime === 'image/webp' && bytes.length >= 21 && ascii(bytes, 12, 4) === 'VP8X' && (bytes[20] & 0x02)) return { ok: false, error: 'Animated WebP images are not accepted.' };
  if (mime === 'image/png' && containsChunk(bytes, 'acTL')) return { ok: false, error: 'Animated PNG images are not accepted.' };
  return { ok: true, info: { mime, ...size } };
}

function containsChunk(bytes: Uint8Array, type: string): boolean {
  let i = 8;
  while (i + 12 <= bytes.length) {
    if (ascii(bytes, i + 4, 4) === type) return true;
    i += 12 + u32be(bytes, i);
  }
  return false;
}

const PNG_KEEP = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'cHRM', 'gAMA', 'sRGB']);
/** Drops metadata (EXIF, XMP, text, ICC, timestamps and any unknown segment) so only pixel data and display basics remain.
 * Input must already have passed checkImageBytes. Returns null when the container cannot be walked safely. */
export function stripImageMetadata(bytes: Uint8Array, mime: ImageMime): Uint8Array | null {
  const parts: Uint8Array[] = [];
  if (mime === 'image/png') {
    parts.push(bytes.subarray(0, 8));
    let i = 8, ended = false;
    while (i + 12 <= bytes.length) {
      const length = u32be(bytes, i), end = i + 12 + length;
      if (end > bytes.length) return null;
      const type = ascii(bytes, i + 4, 4);
      if (PNG_KEEP.has(type)) parts.push(bytes.subarray(i, end));
      i = end;
      if (type === 'IEND') { ended = true; break; }
    }
    return ended ? concat(parts) : null;
  }
  if (mime === 'image/jpeg') {
    parts.push(bytes.subarray(0, 2));
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xda) { parts.push(bytes.subarray(i)); return concat(parts); }
      const length = u16be(bytes, i + 2), end = i + 2 + length;
      if (length < 2 || end > bytes.length) return null;
      const metadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
      if (!metadata) parts.push(bytes.subarray(i, end));
      i = end;
    }
    return null;
  }
  // WebP: drop ICCP, EXIF and XMP chunks and clear their VP8X flags.
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= bytes.length) {
    const length = u32le(bytes, i + 4), padded = length + (length & 1), end = i + 8 + padded;
    if (end > bytes.length) return null;
    const type = ascii(bytes, i, 4);
    if (type !== 'ICCP' && type !== 'EXIF' && type !== 'XMP ') {
      const chunk = bytes.slice(i, end);
      if (type === 'VP8X') chunk[8] &= ~(0x20 | 0x08 | 0x04);
      chunks.push(chunk);
    }
    i = end;
  }
  const body = concat(chunks), out = new Uint8Array(12 + body.length);
  out.set(bytes.subarray(0, 4), 0);
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(bytes.subarray(8, 12), 8);
  out.set(body, 12);
  return out;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

const PRIVATE_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp', '.intranet', '.onion'];
/** An HTTPS image URL that a visitor's browser may be asked to load. The server never fetches it, so this is about protecting
 * viewers: no credentials, no ports, no IP literals or internal host names (blind requests into a visitor's network). */
export function validateImageUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } { return checkHttpsUrl(raw, true); }
export function checkHttpsUrl(raw: string, image: boolean): { ok: true; url: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: 'Enter an image URL.' };
  if (text.length > MAX_URL_LENGTH) return { ok: false, error: `The URL is longer than ${MAX_URL_LENGTH} characters.` };
  if (/[\u0000- \u007f"'<>\\`]/.test(text)) return { ok: false, error: 'The URL contains characters that are not allowed.' };
  let url: URL;
  try { url = new URL(text); } catch { return { ok: false, error: 'This is not a valid URL.' }; }
  if (url.protocol !== 'https:') return { ok: false, error: 'Only https:// image URLs are accepted.' };
  if (url.username || url.password) return { ok: false, error: 'URLs with embedded credentials are not accepted.' };
  if (url.port) return { ok: false, error: 'URLs with a custom port are not accepted.' };
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host.startsWith('[') || /^\d+(\.\d+){0,3}$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return { ok: false, error: 'Use a public host name, not an IP address or a local name.' };
  if (host === 'localhost' || PRIVATE_SUFFIXES.some(s => host.endsWith(s))) return { ok: false, error: 'Use a public host name, not an IP address or a local name.' };
  if (image && /\.(svg|svgz|html?|js|php)$/i.test(url.pathname)) return { ok: false, error: 'SVG and web page URLs are not accepted. Use a PNG, JPEG or WebP image.' };
  url.hash = '';
  return { ok: true, url: url.toString() };
}

/** Optional profile text fields, kept here so a name, description and links can ship without a new route. */
export function validateProfileText(input: { name?: unknown; description?: unknown; links?: unknown }): { ok: true; value: { name?: string; description?: string; links?: string[] } } | { ok: false; error: string } {
  const value: { name?: string; description?: string; links?: string[] } = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.length > MAX_NAME_LENGTH || /[\u0000-\u001f\u007f<>]/.test(input.name)) return { ok: false, error: `Name must be plain text up to ${MAX_NAME_LENGTH} characters.` };
    value.name = input.name.trim();
  }
  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.length > MAX_DESCRIPTION_LENGTH || /[\u0000-\u0008\u000b-\u001f\u007f<>]/.test(input.description)) return { ok: false, error: `Description must be plain text up to ${MAX_DESCRIPTION_LENGTH} characters.` };
    value.description = input.description.trim();
  }
  if (input.links !== undefined) {
    if (!Array.isArray(input.links) || input.links.length > MAX_LINKS) return { ok: false, error: `At most ${MAX_LINKS} links are allowed.` };
    const links: string[] = [];
    for (const link of input.links) {
      const checked = typeof link === 'string' ? checkHttpsUrl(link, false) : null;
      if (!checked || !checked.ok) return { ok: false, error: 'Links must be public https URLs.' };
      const url = checked.url;
      links.push(url);
    }
    value.links = links;
  }
  return { ok: true, value };
}

/** Placeholder avatar helpers: deterministic colour and up to two initials from the group name. */
export function initialsOf(name: string): string {
  const words = name.replace(/[_\-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const letters = words.length === 1 ? [...words[0]].slice(0, 2) : [[...words[0]][0], [...words[1]][0]];
  return letters.join('').toUpperCase();
}
export function avatarHue(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}
