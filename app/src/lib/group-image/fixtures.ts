/** Tiny hand-built image containers for tests. They have valid headers and chunk structure but no real pixel data. */
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const text = (s: string) => [...s].map(c => c.charCodeAt(0));

export function png(width = 64, height = 64, extra: { type: string; data: number[] }[] = []): Uint8Array {
  const chunk = (type: string, data: number[]) => [...be32(data.length), ...text(type), ...data, 0, 0, 0, 0];
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...be32(width), ...be32(height), 8, 6, 0, 0, 0]),
    ...extra.flatMap(c => chunk(c.type, c.data)),
    ...chunk('IDAT', [1, 2, 3, 4]), ...chunk('IEND', [])]);
}
export function jpeg(width = 64, height = 64, withExif = true): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, ...(withExif ? [0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00] : []),
    0xff, 0xc0, 0x00, 0x0b, 8, (height >> 8) & 255, height & 255, (width >> 8) & 255, width & 255, 1, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 1, 2, 3, 0xff, 0xd9]);
}
export function webp(width = 64, height = 64, opts: { exif?: boolean; animated?: boolean } = {}): Uint8Array {
  const w = width - 1, h = height - 1;
  const flags = (opts.exif ? 0x08 : 0) | (opts.animated ? 0x02 : 0);
  const chunk = (type: string, data: number[]) => [...text(type), ...le32(data.length), ...data, ...(data.length & 1 ? [0] : [])];
  const body = [...text('WEBP'),
    ...chunk('VP8X', [flags, 0, 0, 0, w & 255, (w >> 8) & 255, (w >> 16) & 255, h & 255, (h >> 8) & 255, (h >> 16) & 255]),
    ...(opts.exif ? chunk('EXIF', [1, 2, 3, 4, 5]) : []),
    ...chunk('VP8L', [0x2f, 0, 0, 0, 0])];
  return Uint8Array.from([...text('RIFF'), ...le32(body.length), ...body]);
}
export const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
export const gifBytes = Uint8Array.from([...text('GIF89a'), 1, 0, 1, 0, 0, 0, 0]);
