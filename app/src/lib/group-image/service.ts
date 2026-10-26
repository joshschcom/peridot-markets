import { checkImageBytes, stripImageMetadata, validateImageUrl, validateProfileText } from './validate';
import { sha256Hex, verifyProfileChallenge, type GroupProfile, type GroupProfileInput, type SignedImage } from './profile';
import { isGroupId, pruneUnreferenced, readProfile, saveImageFile, withGroupLock, writeProfile } from './store';

export class ProfileError extends Error { constructor(readonly status: number, message: string) { super(message); } }

/** Strict parse of the JSON the browser signed. Unknown keys are rejected so the signed text and the stored text cannot diverge. */
export function parseProfileInput(raw: unknown): GroupProfileInput & { image: SignedImage | null } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ProfileError(400, 'Invalid profile.');
  const body = raw as Record<string, unknown>;
  for (const key of Object.keys(body)) if (!['image', 'name', 'description', 'links'].includes(key)) throw new ProfileError(400, `Unknown profile field: ${key.slice(0, 32)}.`);
  const text = validateProfileText(body);
  if (!text.ok) throw new ProfileError(400, text.error);
  let image: SignedImage | null = null;
  const source = body.image;
  if (source !== null && source !== undefined) {
    const entry = source as Record<string, unknown>;
    if (typeof source !== 'object' || Array.isArray(source)) throw new ProfileError(400, 'Invalid image.');
    if (entry.kind === 'url' && typeof entry.url === 'string' && Object.keys(entry).length === 2) {
      const checked = validateImageUrl(entry.url);
      if (!checked.ok) throw new ProfileError(400, checked.error);
      if (checked.url !== entry.url) throw new ProfileError(400, 'The image URL is not in canonical form.');
      image = { kind: 'url', url: checked.url };
    } else if (entry.kind === 'upload' && typeof entry.sha256 === 'string' && /^[0-9a-f]{64}$/.test(entry.sha256) && (entry.mime === 'image/png' || entry.mime === 'image/jpeg' || entry.mime === 'image/webp') && Object.keys(entry).length === 3) {
      image = { kind: 'upload', sha256: entry.sha256, mime: entry.mime };
    } else throw new ProfileError(400, 'Invalid image.');
  }
  return { image, ...text.value };
}

export interface UpdateRequest {
  network: string; passphrase: string; groupId: number; profile: GroupProfileInput & { image: SignedImage | null };
  file?: Uint8Array | null; signedXdr: string; ownerOf: (groupId: number) => Promise<string | null>; now?: number;
}

export async function applyProfileUpdate(req: UpdateRequest): Promise<GroupProfile> {
  if (!isGroupId(req.groupId)) throw new ProfileError(400, 'Invalid group id.');
  const { profile } = req;
  let bytes: Uint8Array | null = null;
  if (profile.image?.kind === 'upload') {
    if (!req.file) throw new ProfileError(400, 'The image file is missing.');
    const checked = checkImageBytes(req.file);
    if (!checked.ok) throw new ProfileError(400, checked.error);
    if (checked.info.mime !== profile.image.mime || sha256Hex(req.file) !== profile.image.sha256) throw new ProfileError(400, 'The image does not match the signed profile.');
    bytes = req.file;
  } else if (req.file) throw new ProfileError(400, 'Unexpected image file.');
  const owner = await req.ownerOf(req.groupId);
  if (!owner) throw new ProfileError(404, 'Group not found.');
  const verdict = verifyProfileChallenge({ signedXdr: req.signedXdr, owner, network: req.network, passphrase: req.passphrase, groupId: req.groupId, profile, now: req.now });
  if (!verdict.ok) throw new ProfileError(401, verdict.error);
  return withGroupLock(`${req.network}:${req.groupId}`, async () => {
    const previous = await readProfile(req.network, req.groupId);
    if (previous && previous.signedUntil >= verdict.expires) throw new ProfileError(409, 'A newer or identical update was already saved. Sign again to retry.');
    let image: GroupProfile['image'] = null;
    if (profile.image?.kind === 'url') image = profile.image;
    else if (profile.image?.kind === 'upload' && bytes) {
      const clean = stripImageMetadata(bytes, profile.image.mime);
      const recheck = clean && checkImageBytes(clean);
      if (!clean || !recheck || !recheck.ok) throw new ProfileError(400, 'The image could not be cleaned safely. Re-export it as PNG, JPEG or WebP.');
      const hash = sha256Hex(clean);
      await saveImageFile(req.network, hash, recheck.info.mime, clean);
      image = { kind: 'upload', sha256: hash, mime: recheck.info.mime };
    }
    const next: GroupProfile = { v: 1, groupId: req.groupId, owner, image, signedUntil: verdict.expires, updatedAt: Math.floor((req.now ?? Date.now() / 1000)) };
    if (profile.name !== undefined) next.name = profile.name;
    if (profile.description !== undefined) next.description = profile.description;
    if (profile.links !== undefined) next.links = profile.links;
    await writeProfile(req.network, next);
    if (previous?.image?.kind === 'upload' && !(image?.kind === 'upload' && image.sha256 === previous.image.sha256)) {
      await pruneUnreferenced(req.network, previous.image.sha256, previous.image.mime === 'image/png' ? 'png' : previous.image.mime === 'image/jpeg' ? 'jpg' : 'webp');
    }
    return next;
  });
}
