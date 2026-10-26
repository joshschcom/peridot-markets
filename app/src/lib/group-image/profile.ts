import { Account, Keypair, Operation, StrKey, Transaction, TransactionBuilder, hash as stellarHash } from '@stellar/stellar-sdk';

const sha256 = (bytes: Uint8Array): Uint8Array => Uint8Array.from(stellarHash(Buffer.from(bytes)));

/** A group profile lives off chain: the factory stores only the group name. The owner proves ownership by signing a never-submitted
 * transaction (sequence number 1, so it can never be valid on the network) that commits to the profile's hash, a network and a
 * short expiry. The server checks the signature against the group's current on-chain owner. Add new optional fields to
 * `GroupProfileInput` (name, description, links already validate) and they are covered by the same signature. */
export type StoredImage =
  | { kind: 'upload'; sha256: string; mime: 'image/png' | 'image/jpeg' | 'image/webp' }
  | { kind: 'url'; url: string }
  | { kind: 'data'; dataUrl: string };
export interface GroupProfileInput { image: StoredImage | null; name?: string; description?: string; links?: string[] }
export interface GroupProfile extends GroupProfileInput { v: 1; groupId: number; owner: string; signedUntil: number; updatedAt: number }
/** What the signer commits to for an upload: the hash of the bytes the browser sent, not of the sanitized copy the server stores. */
export type SignedImage = Exclude<StoredImage, { kind: 'data' }>;

export const CHALLENGE_DATA_NAME = 'peridot.group-profile';
export const CHALLENGE_TTL_SECONDS = 300;
const DOMAIN = 'peridot-group-profile:v1';

export const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
export const sha256Hex = (bytes: Uint8Array | string) => hex(sha256(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes));

/** Stable JSON: object keys sorted, undefined dropped, so client and server hash identical text. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(v => stableStringify(v === undefined ? null : v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** 32-byte commitment placed in the challenge transaction. */
export function profileCommitment(input: { network: string; groupId: number; profile: GroupProfileInput; expires: number }): Uint8Array {
  return sha256(new TextEncoder().encode([DOMAIN, input.network, String(input.groupId), sha256Hex(stableStringify(input.profile)), String(input.expires)].join('\n')));
}

/** Builds the unsigned challenge transaction XDR for the owner's wallet. */
export function buildProfileChallenge(input: { owner: string; network: string; passphrase: string; groupId: number; profile: GroupProfileInput; now?: number }): { xdr: string; expires: number } {
  if (!StrKey.isValidEd25519PublicKey(input.owner)) throw new Error('Invalid owner address.');
  const now = input.now ?? Math.floor(Date.now() / 1000), expires = now + CHALLENGE_TTL_SECONDS;
  const tx = new TransactionBuilder(new Account(input.owner, '0'), { fee: '100', networkPassphrase: input.passphrase, timebounds: { minTime: 0, maxTime: expires } })
    .addOperation(Operation.manageData({ name: CHALLENGE_DATA_NAME, value: Buffer.from(profileCommitment({ network: input.network, groupId: input.groupId, profile: input.profile, expires })) }))
    .build();
  return { xdr: tx.toXDR(), expires };
}

export type ChallengeResult = { ok: true; expires: number } | { ok: false; error: string };
/** Server-side check that `signedXdr` is a fresh challenge for exactly this profile, signed by `owner`. */
export function verifyProfileChallenge(input: { signedXdr: string; owner: string; network: string; passphrase: string; groupId: number; profile: GroupProfileInput; now?: number }): ChallengeResult {
  try {
    const now = input.now ?? Math.floor(Date.now() / 1000);
    const tx = TransactionBuilder.fromXDR(input.signedXdr, input.passphrase);
    if (!(tx instanceof Transaction)) return { ok: false, error: 'Unexpected signature envelope.' };
    if (tx.source !== input.owner) return { ok: false, error: 'The signature is not from the group owner.' };
    if (tx.sequence !== '1') return { ok: false, error: 'Unexpected challenge sequence.' };
    const expires = Number(tx.timeBounds?.maxTime);
    if (!Number.isSafeInteger(expires) || expires <= 0) return { ok: false, error: 'The signature has no expiry.' };
    if (expires < now) return { ok: false, error: 'The signature expired. Sign again.' };
    if (expires > now + CHALLENGE_TTL_SECONDS + 60) return { ok: false, error: 'The signature expiry is too far in the future.' };
    const op = tx.operations[0];
    if (tx.operations.length !== 1 || op.type !== 'manageData' || op.name !== CHALLENGE_DATA_NAME || !op.value) return { ok: false, error: 'Unexpected challenge contents.' };
    const expected = profileCommitment({ network: input.network, groupId: input.groupId, profile: input.profile, expires });
    if (op.value.length !== expected.length || !op.value.every((b, i) => b === expected[i])) return { ok: false, error: 'The signed message does not match this profile.' };
    const key = Keypair.fromPublicKey(input.owner), hash = tx.hash();
    if (!tx.signatures.some(s => { try { return key.verify(hash, s.signature); } catch { return false; } })) return { ok: false, error: 'The signature is not valid for the group owner.' };
    return { ok: true, expires };
  } catch { return { ok: false, error: 'The signature could not be read.' }; }
}

/** Where a browser should load the image from, or null. */
export function imageSrc(image: StoredImage | null | undefined): string | null {
  if (!image) return null;
  if (image.kind === 'url') return image.url;
  if (image.kind === 'data') return image.dataUrl;
  const ext = image.mime === 'image/png' ? 'png' : image.mime === 'image/jpeg' ? 'jpg' : 'webp';
  return `/api/group-image/file/${image.sha256}.${ext}`;
}
