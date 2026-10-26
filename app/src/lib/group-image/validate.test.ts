import assert from 'node:assert/strict';
import test from 'node:test';
import { checkImageBytes, detectImageType, initialsOf, MAX_IMAGE_BYTES, readImageSize, stripImageMetadata, validateImageUrl, validateProfileText, avatarHue } from './validate';
import { gifBytes, jpeg, png, svgBytes, webp } from './fixtures';

test('detects formats from magic bytes only', () => {
  assert.equal(detectImageType(png()), 'image/png');
  assert.equal(detectImageType(jpeg()), 'image/jpeg');
  assert.equal(detectImageType(webp()), 'image/webp');
  assert.equal(detectImageType(svgBytes), null);
  assert.equal(detectImageType(gifBytes), null);
  assert.equal(detectImageType(new TextEncoder().encode('<html></html>')), null);
  assert.equal(detectImageType(new Uint8Array()), null);
});
test('reads dimensions from each container', () => {
  assert.deepEqual(readImageSize(png(300, 200), 'image/png'), { width: 300, height: 200 });
  assert.deepEqual(readImageSize(jpeg(300, 200), 'image/jpeg'), { width: 300, height: 200 });
  assert.deepEqual(readImageSize(webp(300, 200), 'image/webp'), { width: 300, height: 200 });
});
test('accepts an in-policy image and rejects size, dimension and type violations', () => {
  const ok = checkImageBytes(png(512, 512));
  assert.ok(ok.ok && ok.info.mime === 'image/png');
  assert.equal(checkImageBytes(new Uint8Array()).ok, false);
  assert.equal(checkImageBytes(svgBytes).ok, false);
  assert.equal(checkImageBytes(gifBytes).ok, false);
  const big = checkImageBytes(png(1025, 100));
  assert.ok(!big.ok && /1024/.test(big.error));
  assert.equal(checkImageBytes(jpeg(100, 2000)).ok, false);
  const heavy = new Uint8Array(MAX_IMAGE_BYTES + 1); heavy.set(png());
  const tooBig = checkImageBytes(heavy);
  assert.ok(!tooBig.ok && /512 KB/.test(tooBig.error));
  assert.equal(checkImageBytes(webp(64, 64, { animated: true })).ok, false);
  assert.equal(checkImageBytes(png(64, 64, [{ type: 'acTL', data: [0, 0, 0, 2, 0, 0, 0, 0] }])).ok, false);
  assert.equal(checkImageBytes(png().subarray(0, 20)).ok, false);
});
test('strips metadata from PNG, JPEG and WebP and keeps the images valid', () => {
  const p = stripImageMetadata(png(64, 64, [{ type: 'tEXt', data: [65, 0, 66] }, { type: 'eXIf', data: [1, 2] }]), 'image/png')!;
  assert.ok(p.length < png(64, 64, [{ type: 'tEXt', data: [65, 0, 66] }, { type: 'eXIf', data: [1, 2] }]).length);
  assert.equal(Buffer.from(p).includes(Buffer.from('tEXt')), false);
  assert.equal(Buffer.from(p).includes(Buffer.from('eXIf')), false);
  assert.ok(checkImageBytes(p).ok);
  const j = stripImageMetadata(jpeg(), 'image/jpeg')!;
  assert.equal(Buffer.from(j).includes(Buffer.from('Exif')), false);
  assert.ok(checkImageBytes(j).ok);
  const w = stripImageMetadata(webp(64, 64, { exif: true }), 'image/webp')!;
  assert.equal(Buffer.from(w).includes(Buffer.from('EXIF')), false);
  assert.ok(checkImageBytes(w).ok);
  assert.equal(stripImageMetadata(png().subarray(0, 40), 'image/png'), null);
});
test('image URL policy: https only, public hosts, no credentials, no SVG', () => {
  const ok = validateImageUrl('https://cdn.example.com/a/logo.png?v=2#frag');
  assert.ok(ok.ok && ok.url === 'https://cdn.example.com/a/logo.png?v=2');
  for (const bad of ['', 'http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://example.com/a.png', 'https://user:pw@example.com/a.png',
    'https://localhost/a.png', 'https://127.0.0.1/a.png', 'https://10.0.0.5/a.png', 'https://[::1]/a.png', 'https://2130706433/a.png', 'https://0x7f000001/a.png',
    'https://printer.local/a.png', 'https://intranet/a.png', 'https://example.com:8443/a.png', 'https://example.com/logo.svg', 'https://example.com/a b.png',
    'https://example.com/"onerror=1', `https://example.com/${'a'.repeat(600)}.png`, 'not a url']) {
    assert.equal(validateImageUrl(bad).ok, false, bad);
  }
});
test('profile text fields (extension point) are bounded and plain', () => {
  assert.deepEqual(validateProfileText({ name: ' Meridian ', description: 'Hello', links: ['https://peridot.example/docs'] }), { ok: true, value: { name: 'Meridian', description: 'Hello', links: ['https://peridot.example/docs'] } });
  assert.equal(validateProfileText({ name: 'x'.repeat(33) }).ok, false);
  assert.equal(validateProfileText({ name: '<b>' }).ok, false);
  assert.equal(validateProfileText({ description: 'x'.repeat(241) }).ok, false);
  assert.equal(validateProfileText({ links: ['http://example.com'] }).ok, false);
  assert.equal(validateProfileText({ links: ['https://a.example', 'https://b.example', 'https://c.example', 'https://d.example', 'https://e.example'] }).ok, false);
});
test('placeholder initials and hue are deterministic', () => {
  assert.equal(initialsOf('Meridian'), 'ME');
  assert.equal(initialsOf('my_cool group'), 'MC');
  assert.equal(initialsOf(''), '?');
  assert.equal(avatarHue('a'), avatarHue('a'));
  assert.ok(avatarHue('Meridian') >= 0 && avatarHue('Meridian') < 360);
});
