/** Launchpad wiring for both networks. These constants mirror the launchpad entries of `deployments/testnet.json` and
 * `deployments/mainnet.json` (root of the repo) rather than the network-selected manifest in `lib/peridot/deployments`,
 * which the launchpad never reads. Update both places together. `launchpadConfig()` follows the network pill. */
import { Asset, Networks } from '@stellar/stellar-sdk';
import { network } from '@/lib/peridot/network';

export interface LaunchpadConfig {
  network: 'testnet' | 'mainnet';
  launchpad_factory: string;
  market_factory: string;
  aquarius_router: string;
  wasm: { launchpad_token: string; launchpad_curve: string; launchpad_factory: string; launchpad_ico?: string };
  /** True once `create_ico` and `set_ico_wasm` are live on this network's launchpad factory (the ICO UI is hidden otherwise). */
  ico_live?: boolean;
  demo: {
    first: { token: string; curve: string; target_xlm: number };
    graduated?: { token: string; symbol: string; curve: string; pool: string; group_id: number; target_xlm: number };
  };
}

export const LAUNCHPAD_TESTNET: LaunchpadConfig = {
  network: 'testnet',
  /** `launchpad_factory` in deployments/testnet.json. */
  ico_live: true,
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
};

/** Mainnet launchpad (deployed 2026-10-26, open factory, no launch fee). */
export const LAUNCHPAD_MAINNET: LaunchpadConfig = {
  network: 'mainnet',
  launchpad_factory: 'CAN6YNLFZHMLHPZAMSLR2BTIM7VOS6YZEXJSZAXQEHKPO7BN4RP5NA7J',
  market_factory: 'CBGW6LMUXRZ7OB6SUOZELAFJOQV74E4ME4S4ZPGD5IFY32LSMQFMCQ7S',
  aquarius_router: 'CBQDHNBFBZYE4MKPWBSJOPIYLW4SFSXAXUTSXJN76GNKYVYPCKWC6QUK',
  /** Flip to true only after the factory upgrade and `set_ico_wasm` are confirmed on mainnet (see deployments/mainnet.json `launchpad_ico`). */
  ico_live: false,
  wasm: {
    launchpad_token: 'aab4c9e060086d8928459dd4efe16c1ecc381b3eb9abdf55d363b9914965a550',
    launchpad_curve: 'bdde6afcccaafe445652294c3b03d382cfdc905a4fc7a25534a6daf6bb16420c',
    /** Live factory Wasm. After the in-place upgrade this becomes `b371a8c3...6d62` (built, not yet uploaded), together with the manifest snapshot. */
    launchpad_factory: 'e7c070cecffa912ba791a63bc377299965635be62dd3f5e3b6dd72b62b71304d',
    launchpad_ico: '7596bd473fa4d036b65a5b05ea2a65e273ca14a9f6ca1822f397b245b0b82284',
  },
  demo: {
    first: {
      token: 'CDKHQPYSBULW3T2FNLPKKKXVKREDYZTI37KRURBNVNEUIZ5YDT4O4DYT',
      curve: 'CDWJL4YJ4H546FFXNXSNREW27PFQFNMBQPXDIUHTN765Z52MRDUJH43A',
      target_xlm: 500,
    },
  },
};

/** Native XLM Stellar Asset Contract on testnet: the quote token of every preset. */
export const TESTNET_XLM = Asset.native().contractId(Networks.TESTNET);
export const TESTNET_PASSPHRASE = Networks.TESTNET;
export const TESTNET_RPC_URL = process.env.NEXT_PUBLIC_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org';
export const TESTNET_EXPLORER = 'https://stellar.expert/explorer/testnet';
/** Where a mainnet build sends people who want to trade: the same app served with NEXT_PUBLIC_NETWORK=testnet. */
export const TESTNET_APP_URL = process.env.NEXT_PUBLIC_TESTNET_APP_URL || '';
/** Aquarius testnet swap page, for the AQUA needed by the first graduation step. */
export const AQUARIUS_TESTNET_SWAP_URL = 'https://testnet.aqua.network/swap/';

/** Native XLM Stellar Asset Contract on mainnet. */
export const MAINNET_XLM = Asset.native().contractId(Networks.PUBLIC);
export const MAINNET_EXPLORER = 'https://stellar.expert/explorer/public';
/** Aquarius mainnet swap page, for the AQUA needed by the first graduation step. */
export const AQUARIUS_MAINNET_SWAP_URL = 'https://aqua.network/swap/';
/** Graduation cost shown before the contract is read: 300,000 AQUA (live value comes from `graduation_cost()`). */
export const MAINNET_GRADUATION_AQUA = 300_000;
/** Rough network fee of the mainnet demo launch with a creator buy (0.53 XLM including Soroban rent). The wallet shows the exact fee. */
export const MAINNET_LAUNCH_FEE_ESTIMATE_XLM = 0.6;
/** Rough fee of `create_ico`: deploys a token and an escrow contract (testnet fee 0.5 XLM, mainnet rent is higher). The wallet shows the exact fee. */
export const MAINNET_ICO_FEE_ESTIMATE_XLM = 0.8;
/** Plain-token deploy is one contract creation: a little cheaper than a curve launch. The wallet shows the exact fee. */
export const MAINNET_PLAIN_FEE_ESTIMATE_XLM = 0.3;

export type LaunchpadNetwork = 'mainnet' | 'testnet';
/** Pure selector, exported for tests. */
export function selectLaunchpadConfig(name: LaunchpadNetwork): LaunchpadConfig { return name === 'mainnet' ? LAUNCHPAD_MAINNET : LAUNCHPAD_TESTNET; }
/** The network the launchpad talks to. Demo mode (NEXT_PUBLIC_USE_MOCKS=true) is always labelled testnet: nothing is real. */
export function launchpadNetwork(): LaunchpadNetwork { return network.useMocks ? 'testnet' : network.name; }
/** The launchpad wiring for the active network (the header network pill). */
export function launchpadConfig(): LaunchpadConfig { return selectLaunchpadConfig(launchpadNetwork()); }
/** True when the launchpad is pointed at real money (mainnet, not demo mode). */
export function isLaunchpadMainnet(): boolean { return launchpadNetwork() === 'mainnet'; }
/** Quote token (native XLM SAC) of the active network. */
export function launchpadXlm(): string { return isLaunchpadMainnet() ? MAINNET_XLM : TESTNET_XLM; }
export function launchpadExplorer(): string { return isLaunchpadMainnet() ? MAINNET_EXPLORER : TESTNET_EXPLORER; }
export function launchpadSwapUrl(): string { return isLaunchpadMainnet() ? AQUARIUS_MAINNET_SWAP_URL : AQUARIUS_TESTNET_SWAP_URL; }
/** "mainnet" or "testnet" for UI copy. */
export function launchpadNetworkLabel(): LaunchpadNetwork { return launchpadNetwork(); }

/** True when ICOs can be listed and created on the active network (demo mode, testnet, or a mainnet factory that was upgraded). */
export function icoAvailable(): boolean { return network.useMocks || launchpadConfig().ico_live === true; }

export type LaunchpadMode = 'mock' | 'live';
/** Pure mode rule, exported for tests: mocks win; otherwise the launchpad is live on whichever network is active. */
export function modeFor(useMocks: boolean): LaunchpadMode { return useMocks ? 'mock' : 'live'; }
/**
 * - `mock`: NEXT_PUBLIC_USE_MOCKS=true, everything is simulated in the browser (wins over the network switch).
 * - `live`: reads and signed writes go through the shared peridot RPC helpers on the active network (mainnet or testnet).
 */
export function launchpadMode(): LaunchpadMode { return modeFor(network.useMocks); }
/** True when this build can sign launchpad transactions. */
export function launchpadCanSign(): boolean {
  const mode = launchpadMode();
  return mode === 'mock' || (mode === 'live' && !network.readOnly);
}
export function lpTxUrl(hash: string): string { return `${launchpadExplorer()}/tx/${encodeURIComponent(hash)}`; }
export function lpAccountUrl(address: string): string | null {
  if (/^C[A-Z2-7]{55}$/.test(address)) return `${launchpadExplorer()}/contract/${address}`;
  if (/^G[A-Z2-7]{55}$/.test(address)) return `${launchpadExplorer()}/account/${address}`;
  return null;
}
