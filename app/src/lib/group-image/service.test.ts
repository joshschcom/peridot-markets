import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';

const dir = mkdtempSync(path.join(os.tmpdir(), 'peridot-group-image-'));
process.env.GROUP_IMAGE_DIR = dir;
test.after(() => rmSync(dir, { recursive: true, force: true }));

import { applyProfileUpdate, parseProfileInput, ProfileError } from './service';
import { buildProfileChallenge, sha256Hex } from './profile';
import { clientIp, rateLimited, readImageFile, readProfile, resetRateLimits } from './store';
import { jpeg, png, svgBytes } from './fixtures';

const owner = Keypair.random(), stranger = Keypair.random();
const ownerOf = async (id: number) => (id === 1 ? owner.publicKey() : null);
const signed = (profile: object, now: number, key = owner, groupId = 1) => {
  const tx = TransactionBuilder.fromXDR(buildProfileChallenge({ owner: owner.publicKey(), network: 'testnet', passphrase: Networks.TESTNET, groupId, profile: profile as never, now }).xdr, Networks.TESTNET);
  tx.sign(key); return tx.toXDR();
};
const common = { network: 'testnet', passphrase: Networks.TESTNET, groupId: 1, ownerOf };
const now = Math.floor(Date.now() / 1000);

test('uploads a signed image, strips metadata, stores it by content hash and serves it', async () => {
  const original = png(64, 64, [{ type: 'tEXt', data: [65, 0, 66] }]);
  const profile = { image: { kind: 'upload' as const, sha256: sha256Hex(original), mime: 'image/png' as const } };
  const saved = await applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: original, signedXdr: signed(profile, now), now });
  assert.equal(saved.owner, owner.publicKey());
  assert.ok(saved.image?.kind === 'upload' && saved.image.sha256 !== profile.image.sha256);
  const file = await readImageFile('testnet', `${(saved.image as { sha256: string }).sha256}.png`);
  assert.ok(file && file.mime === 'image/png' && !file.bytes.includes(Buffer.from('tEXt')));
  assert.deepEqual((await readProfile('testnet', 1))?.image, saved.image);
});
test('rejects replays, stale and non-owner signatures', async () => {
  const profile = { image: { kind: 'url' as const, url: 'https://cdn.example.com/a.png' } };
  const later = now + 10;
  await assert.rejects(applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: null, signedXdr: signed(profile, later, stranger), now: later }), (e: ProfileError) => e.status === 401);
  await applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: null, signedXdr: signed(profile, later), now: later });
  await assert.rejects(applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: null, signedXdr: signed(profile, later), now: later }), (e: ProfileError) => e.status === 409);
  const older = signed({ image: null }, now - 5);
  await assert.rejects(applyProfileUpdate({ ...common, profile: parseProfileInput({ image: null }), file: null, signedXdr: older, now }), (e: ProfileError) => e.status === 409);
  await assert.rejects(applyProfileUpdate({ ...common, groupId: 2, profile: parseProfileInput(profile), file: null, signedXdr: signed(profile, later, owner, 2), now: later }), (e: ProfileError) => e.status === 404);
});
test('removing the image prunes the unreferenced upload', async () => {
  const original = jpeg();
  const profile = { image: { kind: 'upload' as const, sha256: sha256Hex(original), mime: 'image/jpeg' as const } };
  const t1 = now + 60;
  const saved = await applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: original, signedXdr: signed(profile, t1), now: t1 });
  const files = () => readdirSync(path.join(dir, 'testnet', 'files'));
  assert.ok(files().includes(`${(saved.image as { sha256: string }).sha256}.jpg`));
  const t2 = now + 120;
  await applyProfileUpdate({ ...common, profile: parseProfileInput({ image: null }), file: null, signedXdr: signed({ image: null }, t2), now: t2 });
  assert.equal(files().includes(`${(saved.image as { sha256: string }).sha256}.jpg`), false);
  assert.equal((await readProfile('testnet', 1))?.image, null);
});
test('refuses bad files even with a valid signature, and mismatched hashes', async () => {
  const t = now + 200;
  for (const bytes of [svgBytes, new Uint8Array(0)]) {
    const profile = { image: { kind: 'upload' as const, sha256: sha256Hex(bytes), mime: 'image/png' as const } };
    await assert.rejects(applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: bytes, signedXdr: signed(profile, t), now: t }), (e: ProfileError) => e.status === 400);
  }
  const profile = { image: { kind: 'upload' as const, sha256: sha256Hex(png()), mime: 'image/png' as const } };
  await assert.rejects(applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: png(65, 65), signedXdr: signed(profile, t), now: t }), (e: ProfileError) => e.status === 400);
  await assert.rejects(applyProfileUpdate({ ...common, profile: parseProfileInput(profile), file: null, signedXdr: signed(profile, t), now: t }), (e: ProfileError) => e.status === 400);
});
test('profile parsing is strict', () => {
  assert.throws(() => parseProfileInput({ image: null, admin: true }), ProfileError);
  assert.throws(() => parseProfileInput({ image: { kind: 'url', url: 'http://x.example/a.png' } }), ProfileError);
  assert.throws(() => parseProfileInput({ image: { kind: 'url', url: 'https://X.example/a.png#f' } }), ProfileError);
  assert.throws(() => parseProfileInput({ image: { kind: 'upload', sha256: 'zz', mime: 'image/png' } }), ProfileError);
  assert.throws(() => parseProfileInput({ image: { kind: 'upload', sha256: 'a'.repeat(64), mime: 'image/svg+xml' } }), ProfileError);
  assert.throws(() => parseProfileInput({ image: { kind: 'data', dataUrl: 'data:image/png;base64,AA' } }), ProfileError);
  assert.deepEqual(parseProfileInput({ image: null, name: 'Meridian' }), { image: null, name: 'Meridian' });
});
test('file names cannot traverse and the limiter blocks bursts per IP', async () => {
  for (const name of ['../etc/passwd', `${'a'.repeat(64)}.svg`, `${'A'.repeat(64)}.png`, 'x.png', `${'a'.repeat(64)}.png/../x`]) assert.equal(await readImageFile('testnet', name), null);
  resetRateLimits();
  assert.equal([1, 2, 3].map(() => rateLimited('1.1.1.1', 'w', 2, 1000, 0)).join(), 'false,false,true');
  assert.equal(rateLimited('2.2.2.2', 'w', 2, 1000, 0), false);
  assert.equal(rateLimited('1.1.1.1', 'w', 2, 1000, 2000), false);
  assert.equal(clientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })), '9.9.9.9');
});
