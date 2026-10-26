/** Vault factory client: create a vault of any registered kind, list the caller's vaults. Reads manifests, never hard-coded ids.
 * Demo mode (NEXT_PUBLIC_USE_MOCKS=true) keeps a local list and never touches the chain. */
import { StrKey, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { network } from '@/lib/peridot/network';
import mainnetManifest from '@/lib/peridot/deployments/mainnet.json';
import testnetManifest from '@/lib/peridot/deployments/testnet.json';
import { readContract, submitContract, type Signer, type TxProgress } from '@/lib/peridot/rpc';
import { emitTx, nextTxId } from '@/lib/ui-events';
import { scAddress, scSymbol } from '@/lib/peridot/factory';
import type { Net, Values, VaultCtx, VaultKind, VaultRecordView } from './kinds/types';
import { encodeFields } from './kinds/schema';

interface VaultManifest { vault_factory?: string; vault_kinds?: Record<string, string> }
export function vaultManifest(net: Net = network.name): VaultManifest {
  return (net === 'mainnet' ? mainnetManifest : testnetManifest) as unknown as VaultManifest;
}
/** The deployed factory for the selected network, or null when none is recorded yet. */
export function vaultFactoryId(net: Net = network.name): string | null {
  const id = vaultManifest(net).vault_factory;
  return id && StrKey.isValidContract(id) ? id : null;
}
/** Kinds whose Wasm the factory has registered on this network (from the manifest). */
export function deployedKinds(net: Net = network.name): string[] { return Object.keys(vaultManifest(net).vault_kinds ?? {}); }

export class KeyValueMemory { private d: Record<string, string> = {}; getItem(k: string) { return this.d[k] ?? null; } setItem(k: string, v: string) { this.d[k] = v; } }
export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
const mockKey = (net: Net) => `peridot:vaultfactory:mock:v1:${net}`;

export function loadMockVaults(store: KeyValueStore | null, net: Net): VaultRecordView[] {
  try { const raw = store?.getItem(mockKey(net)); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
export function saveMockVault(store: KeyValueStore | null, net: Net, v: VaultRecordView): VaultRecordView[] {
  const next = [v, ...loadMockVaults(store, net)].slice(0, 50);
  try { store?.setItem(mockKey(net), JSON.stringify(next)); } catch { /* storage is a convenience in demo mode */ }
  return next;
}

export function randomSalt(): Buffer {
  const bytes = new Uint8Array(32);
  (globalThis.crypto ?? (() => { throw new Error('Secure randomness is unavailable in this browser.'); })()).getRandomValues(bytes);
  return Buffer.from(bytes);
}

/** `create_vault(owner, kind, salt, init_args)`. Returns the new vault address. */
export async function createVault(kind: VaultKind, values: Values, ctx: VaultCtx, signer: Signer, onProgress?: (p: TxProgress) => void): Promise<{ address: string; hash: string; ledger: number; demo: boolean }> {
  if (kind.status !== 'live') throw new Error(`${kind.name} is not available yet.`);
  const init = kind.encode ? kind.encode(values, ctx) : encodeFields(kind, values, ctx);
  if (network.useMocks) return createMock(kind, values, ctx, onProgress);
  const factory = vaultFactoryId();
  if (!factory) throw new Error(`The vault factory is not deployed on ${network.name} yet.`);
  if (!deployedKinds().includes(kind.id)) throw new Error(`${kind.name} is not registered with the vault factory on ${network.name} yet.`);
  const res = await submitContract<string>({
    contractId: factory, method: 'create_vault', signer, onProgress,
    args: [scAddress(signer.address), scSymbol(kind.id), nativeToScVal(randomSalt(), { type: 'bytes' }), xdr.ScVal.scvVec(init)],
  });
  return { address: String(res.value), hash: res.hash, ledger: res.ledger, demo: false };
}

async function createMock(kind: VaultKind, values: Values, ctx: VaultCtx, onProgress?: (p: TxProgress) => void) {
  const id = nextTxId();
  const step = (p: TxProgress) => { emitTx({ id, method: 'demo_create_vault', contractId: 'demo-vault-factory', ...p }); onProgress?.(p); };
  step({ status: 'simulating', message: 'Checking the configuration (demo).' });
  await new Promise(r => setTimeout(r, 250));
  const hash = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const address = 'C' + Array.from(globalThis.crypto.getRandomValues(new Uint8Array(55)), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b % 32]).join('');
  let store: KeyValueStore | null = null;
  try { store = window.localStorage; } catch { store = null; }
  saveMockVault(store, ctx.net, { address, kind: kind.id, owner: ctx.owner, ledger: 0, demo: true, txHash: hash, createdAt: Date.now(), values });
  step({ status: 'success', hash, message: 'Demo vault saved. No onchain transaction.' });
  return { address, hash, ledger: 0, demo: true };
}

/** Vaults the owner created through the factory, newest first. */
export async function listMyVaults(owner: string): Promise<VaultRecordView[]> {
  if (network.useMocks) {
    let store: KeyValueStore | null = null;
    try { store = window.localStorage; } catch { store = null; }
    return loadMockVaults(store, network.name).filter(v => v.owner === owner);
  }
  const factory = vaultFactoryId();
  if (!factory) return [];
  const addrs = await readContract<string[]>(factory, 'vaults_of', [scAddress(owner)]);
  const out = await Promise.all(addrs.map(async address => {
    const [kind, vowner, ledger] = await readContract<[string, string, number]>(factory, 'get_vault', [scAddress(address)]);
    return { address, kind, owner: vowner, ledger } satisfies VaultRecordView;
  }));
  return out.reverse();
}
