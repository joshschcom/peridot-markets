import { Networks, StrKey } from '@stellar/stellar-sdk';
import type { Deployments } from './types';
import mainnet from './deployments/mainnet.json';
import testnet from './deployments/testnet.json';

const selected = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';
if (selected !== 'mainnet' && selected !== 'testnet') throw new Error('NEXT_PUBLIC_NETWORK must be mainnet or testnet.');
export const network = {
  name: selected as 'mainnet' | 'testnet',
  passphrase: selected === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
  rpcUrl: selected === 'mainnet'
    ? (process.env.NEXT_PUBLIC_MAINNET_RPC_URL || '')
    : (process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org'),
  fallbackRpcUrl: selected === 'mainnet' ? (process.env.NEXT_PUBLIC_MAINNET_FALLBACK_RPC_URL || 'https://rpc.lightsail.network/') : '',
  useMocks: process.env.NEXT_PUBLIC_USE_MOCKS === 'true',
  readOnly: process.env.NEXT_PUBLIC_READ_ONLY === 'true',
  explorerUrl: `https://stellar.expert/explorer/${selected === 'mainnet' ? 'public' : 'testnet'}`,
} as const;
export function getDeployments(): Deployments {
  const raw = (selected === 'mainnet' ? mainnet : testnet) as unknown as Partial<Deployments>;
  if (raw.network !== selected || !raw.factory || !StrKey.isValidContract(raw.factory)) {
    throw new Error(`The ${selected} factory has not been configured. A verified deployment manifest is required.`);
  }
  return raw as Deployments;
}
export function transactionUrl(hash: string): string {
  return `${network.explorerUrl}/tx/${encodeURIComponent(hash)}`;
}

export function isMarginAvailable(): boolean {
  if (network.useMocks) return true;
  try { const d = getDeployments(); return !!d.margin_factory && StrKey.isValidContract(d.margin_factory) && !!d.wasm?.margin && !!d.wasm?.swap_adapter; }
  catch { return false; }
}
