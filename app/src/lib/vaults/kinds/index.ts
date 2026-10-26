/** Registry of vault kinds the app can create. Sibling agents: add your kind here (one import, one array entry). */
import type { VaultKind } from './types';
import { aquariusKind } from './aquarius';
import { xoxnoKind } from './xoxno';

export const VAULT_KINDS: readonly VaultKind[] = [aquariusKind, xoxnoKind];

export function getKind(id: string): VaultKind | undefined { return VAULT_KINDS.find(k => k.id === id); }
export function liveKinds(): VaultKind[] { return VAULT_KINDS.filter(k => k.status === 'live'); }
export * from './types';
export * from './schema';
