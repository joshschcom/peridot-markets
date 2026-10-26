'use client';
import { useState } from 'react';
import { avatarHue, initialsOf } from '@/lib/group-image/validate';
import { useGroupImageSrc } from '@/lib/group-image/client';
import './group-image.css';

/** Group picture. The image is never trusted: fixed size, object-fit cover, no referrer sent, and a coloured initials circle
 * when there is no image, while it loads or if the remote file fails. */
export function GroupAvatar({ groupId, name, size = 36, src: override, className = '' }: { groupId?: number; name: string; size?: number; src?: string | null; className?: string }) {
  const stored = useGroupImageSrc(groupId);
  const src = override === undefined ? stored : override;
  // Track state per source string so a changed image resets without an effect (an effect could clear a load that already finished).
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src, loaded = !!src && loadedSrc === src;
  const hue = avatarHue(`${groupId ?? ''}:${name}`);
  const initials = initialsOf(name), label = name || 'Group', showImage = !!src && !failed;
  return <span className={`group-avatar ${className}`.trim()} data-testid="group-avatar" data-has-image={src && !failed ? 'true' : 'false'}
    style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.38)), background: `hsl(${hue} 45% 28%)`, color: `hsl(${hue} 80% 90%)` }}>
    <span role="img" aria-label={`${label} initials`} aria-hidden={showImage}>{initials}</span>
    {src && !failed && <img key={src} src={src} alt={`${label} group image`} width={size} height={size} referrerPolicy="no-referrer" loading="lazy" decoding="async" draggable={false}
      onLoad={() => setLoadedSrc(src)} onError={() => setFailedSrc(src)} ref={el => { if (el && el.complete && el.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src); }} style={{ opacity: loaded ? 1 : 0 }} />}
  </span>;
}
