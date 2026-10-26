import { StrKey, nativeToScVal, type xdr } from '@stellar/stellar-sdk';
import { readContract, submitContract, type Signer, type TxProgress } from '@/lib/peridot/rpc';
import { scAddress, scI128, scMap, scU32 } from '@/lib/peridot/factory';
import { LAUNCHPAD_TESTNET, launchpadCanSign, launchpadMode, TESTNET_XLM } from './config';
import { describeLaunchpadError } from './errors';
import { readTestnet } from './testnet-rpc';
import { mutateLaunchpadMock, readLaunchpadMock } from './mock';
import { findIco, mockCreateIco, mockIcoAction, mockIcos } from './ico-mock';
import { emptyPosition, validateIco, type IcoConfig, type IcoInfo, type IcoInput, type IcoPosition, type IcoState } from './ico-types';
import { validateMetadataUri, validateName, validateSymbol } from './math';
const FACTORY = LAUNCHPAD_TESTNET.launchpad_factory;
const read = <T>(id: string, method: string, args: xdr.ScVal[] = []) => launchpadMode() === 'live' ? readContract<T>(id, method, args) : readTestnet<T>(id, method, args);
const str = (s: string) => nativeToScVal(s, { type: 'string' });
const u64 = (n: bigint) => nativeToScVal(n, { type: 'u64' });
const assertSigning = () => { if (!launchpadCanSign()) throw new Error('ICO transactions are available on the testnet app only.'); };
const done = (progress?: (p: TxProgress) => void) => { const hash = `mock-ico-${Date.now()}`; progress?.({ status: 'success', hash, message: 'Demo action saved. No onchain transaction.' }); return hash; };
export async function listIcos(): Promise<IcoInfo[]> {
  if (launchpadMode() === 'mock') return mutateLaunchpadMock(s => mockIcos(s).map(i => i.info));
  const count = await read<number>(FACTORY, 'ico_count'); const out: IcoInfo[] = [];
  for (let start = 0; start < count; start += 50) out.push(...await read<IcoInfo[]>(FACTORY, 'list_icos', [scU32(start), scU32(50)]));
  return out;
}
export async function getIco(address: string): Promise<IcoInfo | null> {
  if (launchpadMode() === 'mock') return mutateLaunchpadMock(s => mockIcos(s).find(i => i.info.token === address || i.info.ico === address)?.info ?? null);
  if (!StrKey.isValidContract(address)) return null;
  try { return await read<IcoInfo>(FACTORY, 'get_ico', [scAddress(address)]); }
  catch (error) {
    if (/Error\(Contract, #10\)/.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}
export async function getIcoDetails(info: IcoInfo, user?: string | null) {
  if (launchpadMode() === 'mock') {
    const i = findIco(readLaunchpadMock(), info.ico);
    return { config: i.config, state: i.state, position: user ? i.positions[user] ?? emptyPosition() : emptyPosition(), demoEnd: i.demoEnd };
  }
  const [config, state, position] = await Promise.all([read<IcoConfig>(info.ico, 'get_config'), read<IcoState>(info.ico, 'get_state'), user ? read<IcoPosition>(info.ico, 'get_position', [scAddress(user)]) : Promise.resolve(emptyPosition())]);
  return { config, state, position, demoEnd: undefined as bigint | undefined };
}
export async function createIco(signer: Signer, input: IcoInput, onProgress?: (p: TxProgress) => void) {
  assertSigning(); const p = input.params;
  const error = validateName(input.name) || validateSymbol(input.symbol) || validateMetadataUri(input.metadataUri) || validateIco(p, BigInt(Math.floor(Date.now() / 1000)));
  if (error) throw new Error(error);
  if (launchpadMode() === 'mock') { const info = mutateLaunchpadMock(s => mockCreateIco(s, signer.address, input)); return { ...info, hash: done(onProgress) }; }
  const params = scMap({ quote_token: scAddress(TESTNET_XLM), supply: scI128(p.supply), price: scI128(p.price), soft_cap: scI128(p.soft_cap), hard_cap: scI128(p.hard_cap), start: u64(p.start), end: u64(p.end), buyer_cap: scI128(p.buyer_cap) });
  try {
    const r = await submitContract<[string, string]>({ contractId: FACTORY, method: 'create_ico', args: [scAddress(signer.address), str(input.name), str(input.symbol), str(input.metadataUri), params], signer, onProgress });
    return { token: r.value[0], ico: r.value[1], hash: r.hash };
  } catch (e) { throw new Error(describeLaunchpadError(e, { [FACTORY]: 'factory', [TESTNET_XLM]: 'sac' }, { fallbackRole: 'factory', innerFallback: 'ico' })); }
}
export type IcoAction = 'buy' | 'claim' | 'refund' | 'finalize' | 'withdraw';
export async function actOnIco(signer: Signer, info: IcoInfo, action: IcoAction, amount = 0n, onProgress?: (p: TxProgress) => void) {
  assertSigning();
  if (launchpadMode() === 'mock') { mutateLaunchpadMock(s => mockIcoAction(s, findIco(s, info.ico), signer.address, action, amount)); return { hash: done(onProgress) }; }
  const args = action === 'finalize' ? [] : action === 'buy' ? [scAddress(signer.address), scI128(amount)] : [scAddress(signer.address)];
  try { return await submitContract({ contractId: info.ico, method: action, args, signer, onProgress }); }
  catch (e) { throw new Error(describeLaunchpadError(e, { [info.ico]: 'ico', [info.token]: 'token', [TESTNET_XLM]: 'sac' }, { fallbackRole: 'ico' })); }
}
/** Explicit demo clock control for recording the two outcomes without waiting. Never submits a transaction. */
export function endIcoDemo(address: string, point: 'start' | 'end' = 'end') {
  if (launchpadMode() !== 'mock') throw new Error('Demo controls are disabled.');
  mutateLaunchpadMock(s => { const ico = findIco(s, address); ico.demoEnd = ico.config.params[point]; });
}
