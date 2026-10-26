/** Testnet launchpad wiring. The launchpad runs on testnet only during the beta, so these constants mirror the
 * launchpad entries of `deployments/testnet.json` (root of the repo) rather than the network-selected manifest in
 * `lib/peridot/deployments`, which the launchpad never reads. Update both places together. */
import { Asset, Networks } from '@stellar/stellar-sdk';
import { network } from '@/lib/peridot/network';

export const LAUNCHPAD_TESTNET = {
  network: 'testnet',
  /** `launchpad_factory` in deployments/testnet.json. */
  launchpad_factory: 'CBYQC54BS5HIWEO6KQNVGZ6XRNOTG3OMT6UZYBUD2NESGHBQMALGSBWC',
  /** `factory` in deployments/testnet.json: graduated groups live here. */
  market_factory: 'CCFODI4F6QE276PXGHVYOSX52DMYYI2YDJMQZ7ZGU4YWEH5IG2Y3ZR3M',
  /** Aquarius testnet router (curve `get_config().graduation.router`). */
  aquarius_router: 'CBCFTQSPDBAIZ6R6PJQKSQWKNKWH2QIV3I4J72SHWBIK3ADRRAM5A6GD',
  wasm: {
    launchpad_token: 'aab4c9e060086d8928459dd4efe16c1ecc381b3eb9abdf55d363b9914965a550',
    launchpad_curve: 'bdde6afcccaafe445652294c3b03d382cfdc905a4fc7a25534a6daf6bb16420c',
    launchpad_factory: 'b371a8c37cb6a9cabd74b28c899f86114efa7a85e955042085f78c3261ee6d62',
    launchpad_ico: '516dfcd5fab8c1abd28ccfa911f201463d11b4d9157919259b204c66fbdab306',
  },
  demo: {
    first: {
      token: 'CDOV4QVKFFLGXD7DE33JFXQDCP2XOHZYT2FGO7HZD4MTZ7N5FDNXPZBT',
      curve: 'CAAK6ARU4T5V4U3ACNMI76C3UEFZXLV2LTJECQRKWNVC74IV3BZKNHWH',
      target_xlm: 25_000,
    },
    graduated: {
      token: 'CBYIF7IQLULTFO2WIX2WFGEZ6PZL5QLEAYYIZLDXYTS7GFOK3LPA2UGF',
      symbol: 'PGRAD',
      curve: 'CAIA6FUZGSY4454KNTOYQ3MT7CGTQMUZBOWUP2C3JNXXH44QPT3B5EFT',
      pool: 'CBZADNRMC7O6IL344YXEIB3PBD2PPAJLHHI5KWJORWXJR67UNOUUTO3G',
      group_id: 1,
      target_xlm: 500,
    },
  },
} as const;

/** Native XLM Stellar Asset Contract on testnet: the quote token of every preset. */
export const TESTNET_XLM = Asset.native().contractId(Networks.TESTNET);
export const TESTNET_PASSPHRASE = Networks.TESTNET;
export const TESTNET_RPC_URL = process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org';
export const TESTNET_EXPLORER = 'https://stellar.expert/explorer/testnet';
/** Where a mainnet build sends people who want to trade: the same app served with NEXT_PUBLIC_NETWORK=testnet. */
export const TESTNET_APP_URL = process.env.NEXT_PUBLIC_TESTNET_APP_URL || '';
/** Aquarius testnet swap page, for the AQUA needed by the first graduation step. */
export const AQUARIUS_TESTNET_SWAP_URL = 'https://testnet.aqua.network/swap/';

export type LaunchpadMode = 'mock' | 'live' | 'remote';
/**
 * - `mock`: NEXT_PUBLIC_USE_MOCKS=true, everything is simulated in the browser (wins over the network switch).
 * - `live`: the app runs on testnet; reads and signed writes go through the shared peridot RPC helpers.
 * - `remote`: the app runs on mainnet; the launchpad shows read-only testnet data through its own RPC client.
 */
export function launchpadMode(): LaunchpadMode {
  if (network.useMocks) return 'mock';
  return network.name === 'testnet' ? 'live' : 'remote';
}
/** True when this build can sign launchpad transactions. */
export function launchpadCanSign(): boolean {
  const mode = launchpadMode();
  return mode === 'mock' || (mode === 'live' && !network.readOnly);
}
export function testnetTxUrl(hash: string): string { return `${TESTNET_EXPLORER}/tx/${encodeURIComponent(hash)}`; }
export function testnetAccountUrl(address: string): string | null {
  if (/^C[A-Z2-7]{55}$/.test(address)) return `${TESTNET_EXPLORER}/contract/${address}`;
  if (/^G[A-Z2-7]{55}$/.test(address)) return `${TESTNET_EXPLORER}/account/${address}`;
  return null;
}
