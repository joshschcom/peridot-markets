import assert from 'node:assert/strict';
import test from 'node:test';
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { buildProfileChallenge, imageSrc, stableStringify, verifyProfileChallenge, type GroupProfileInput } from './profile';

const owner = Keypair.random(), other = Keypair.random();
const profile: GroupProfileInput = { image: { kind: 'url', url: 'https://cdn.example.com/a.png' } };
const base = { network: 'testnet', passphrase: Networks.TESTNET, groupId: 7 };
const sign = (xdr: string, key: Keypair) => { const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET); tx.sign(key); return tx.toXDR(); };
const challenge = (now = 1_000_000, p = profile, id = 7) => buildProfileChallenge({ ...base, owner: owner.publicKey(), groupId: id, profile: p, now }).xdr;

test('stable stringify ignores key order and undefined', () => {
  assert.equal(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] }), '{"a":[2,{"d":1}],"b":1}');
});
test('accepts a fresh challenge signed by the owner', () => {
  const r = verifyProfileChallenge({ ...base, signedXdr: sign(challenge(), owner), owner: owner.publicKey(), profile, now: 1_000_100 });
  assert.ok(r.ok && r.expires === 1_000_300);
});
test('rejects wrong signer, unsigned, wrong group, wrong profile, wrong network and tampering', () => {
  const now = 1_000_100, args = { ...base, owner: owner.publicKey(), profile, now };
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: sign(challenge(), other) }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: challenge() }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: sign(challenge(1_000_000, profile, 8), owner) }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: sign(challenge(), owner), profile: { image: { kind: 'url', url: 'https://evil.example.com/a.png' } } }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: sign(challenge(), owner), profile: { image: null } }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: sign(challenge(), owner), network: 'mainnet' }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: sign(challenge(), owner), profile: { ...profile, name: 'Added' } }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, signedXdr: 'not xdr' }).ok, false);
});
test('rejects an expired challenge and one with an excessive expiry', () => {
  const signed = sign(challenge(1_000_000), owner);
  const args = { ...base, owner: owner.publicKey(), profile, signedXdr: signed };
  assert.equal(verifyProfileChallenge({ ...args, now: 1_000_301 }).ok, false);
  assert.equal(verifyProfileChallenge({ ...args, now: 900_000 }).ok, false);
});
test('the challenge is not a valid ledger transaction (sequence 1, no fee payer funds)', () => {
  const tx = TransactionBuilder.fromXDR(challenge(), Networks.TESTNET);
  assert.equal((tx as { sequence: string }).sequence, '1');
});
test('image source mapping', () => {
  assert.equal(imageSrc(null), null);
  assert.equal(imageSrc({ kind: 'url', url: 'https://a.example/x.png' }), 'https://a.example/x.png');
  assert.equal(imageSrc({ kind: 'upload', sha256: 'a'.repeat(64), mime: 'image/jpeg' }), `/api/group-image/file/${'a'.repeat(64)}.jpg`);
});
