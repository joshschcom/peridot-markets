/** Network side of the xoxno kind: create a vault through the vault-factory and read it back. */
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { network } from '@/lib/peridot/network';
import { readContract, submitContract, type Signer, type TxProgress } from '@/lib/peridot/rpc';
import { encodeXoxnoInitArgs, XOXNO_KIND_ID, type XoxnoConfig } from './xoxno';

/** Testnet vault-factory (deployments/testnet.json `vault_factory`). Override with NEXT_PUBLIC_VAULT_FACTORY. */
export const TESTNET_VAULT_FACTORY = 'CAORI4VMNA655LG3JD4B253YW74VIJ6L4ZXCSFL6R54S75GR746X2JUE';
export function vaultFactoryAddress(): string | null {
  const env = process.env.NEXT_PUBLIC_VAULT_FACTORY;
  if (env) return env;
  return network.name === 'testnet' ? TESTNET_VAULT_FACTORY : null;
}
/** Real vault creation needs the testnet app. Demo mode (mocks) never signs. */
export function xoxnoVaultMode(): 'live' | 'mock' | 'unavailable' {
  if (network.useMocks) return 'mock';
  return network.name === 'testnet' && vaultFactoryAddress() ? 'live' : 'unavailable';
}

export interface CreatedXoxnoVault { vault: string; hash: string }

export async function createXoxnoVault(signer: Signer, cfg: XoxnoConfig, onProgress?: (p: TxProgress) => void): Promise<CreatedXoxnoVault> {
  const initArgs = encodeXoxnoInitArgs(cfg);
  if (cfg.owner !== signer.address) throw new Error('The owner must be the connected wallet.');
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  if (xoxnoVaultMode() === 'mock') {
    onProgress?.({ status: 'success', message: 'Demo vault recorded. No onchain transaction.' } as TxProgress);
    return { vault: `C${Array.from(salt.slice(0, 27), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[b % 32]).join('').padEnd(55, 'A')}`, hash: `mock-${Array.from(salt.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('')}` };
  }
  const factory = vaultFactoryAddress();
  if (xoxnoVaultMode() !== 'live' || !factory) throw new Error('Creating XOXNO vaults runs on the testnet app only.');
  const res = await submitContract<string>({
    contractId: factory,
    method: 'create_vault',
    args: [new Address(cfg.owner).toScVal(), nativeToScVal(XOXNO_KIND_ID, { type: 'symbol' }), xdr.ScVal.scvBytes(Buffer.from(salt)), xdr.ScVal.scvVec(initArgs)],
    signer,
    onProgress,
  });
  return { vault: String(res.value), hash: res.hash };
}

export interface XoxnoVaultView {
  owner: string; depositor: string; underlying: string; hubId: number; spokeId: number; feeBps: number;
  depositCap: bigint; minDeposit: bigint; totalValue: bigint; totalShares: bigint; paused: boolean; accountId: bigint | null;
}
export async function readXoxnoVault(vault: string): Promise<XoxnoVaultView> {
  const [p, s, a] = await Promise.all([
    readContract<Record<string, unknown>>(vault, 'params'),
    readContract<Record<string, unknown>>(vault, 'get_state'),
    readContract<bigint | undefined>(vault, 'account_id'),
  ]);
  return {
    owner: String(p.owner), depositor: String(p.depositor), underlying: String(p.underlying), hubId: Number(p.hub_id), spokeId: Number(p.spoke_id), feeBps: Number(p.fee_bps),
    depositCap: BigInt(p.deposit_cap as bigint), minDeposit: BigInt(p.min_deposit as bigint), totalValue: BigInt(s.total_value as bigint), totalShares: BigInt(s.total_shares as bigint),
    paused: Boolean(s.paused), accountId: a === undefined || a === null ? null : BigInt(a),
  };
}
