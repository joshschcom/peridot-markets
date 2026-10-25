/** Launchpad reads and writes. Three modes (see config.ts `launchpadMode`):
 * - mock: browser-local simulation (lib/launchpad/mock.ts);
 * - live (app on testnet): reads through the shared `readContract`, writes through `submitContract`, so wallet
 *   locks, pending-transaction recovery and read pacing are the same as on the group pages;
 * - remote (app on mainnet): read-only through the dedicated testnet client; writes throw.
 * The launchpad never calls `getDeployments()`: its addresses come from config.ts. */
import { StrKey, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { network } from '@/lib/peridot/network';
import { getRpc, readContract, submitContract, type Signer, type TxProgress } from '@/lib/peridot/rpc';
import { scAddress, scI128, scMap, scU32 } from '@/lib/peridot/factory';
import { readWalletTokenBalance } from '@/lib/peridot/group-client';
import { LAUNCHPAD_TESTNET, TESTNET_XLM, launchpadMode } from './config';
import { describeLaunchpadError, type ContractRole } from './errors';
import { fetchCurveActivity, readTestnet, testnetRpc } from './testnet-rpc';
import { MOCK_AQUA, MOCK_AQUA_ISSUER, MOCK_GRADUATION_FEE, MOCK_XLM_TOKEN, findMockLaunch, mockActivity, mockBuy, mockClaimGroup, mockCurveInfo, mockFactoryConfig, mockGraduate, mockLaunchCurve, mockPreset, mockQuoteBuy, mockQuoteSell, mockSell, mutateLaunchpadMock, readLaunchpadMock } from './mock';
import { creatorCap } from './math';
import type { BuyQuote, CurveActivity, CurveConfig, CurveInfo, CurveParams, FactoryConfig, GradStep, Graduation, LaunchInfo, Preset, SellQuote } from './types';

export type { Signer, TxProgress };
export const FACTORY = LAUNCHPAD_TESTNET.launchpad_factory;
export const MARKET_FACTORY = LAUNCHPAD_TESTNET.market_factory;
const scString = (value: string) => nativeToScVal(value, { type: 'string' });
const MOCK_SAVED = 'Demo action saved. No onchain transaction.';

async function read<T>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
  return launchpadMode() === 'live' ? readContract<T>(contractId, method, args) : readTestnet<T>(contractId, method, args);
}
function roles(extra: Record<string, ContractRole> = {}): Record<string, ContractRole> { return { [FACTORY]: 'factory', ...extra }; }
function rethrow(error: unknown, extra: Record<string, ContractRole>, fallback: ContractRole): never {
  throw new Error(describeLaunchpadError(error, roles(extra), fallback));
}
/** Quote token of every testnet preset. */
export function quoteToken(): string { return launchpadMode() === 'mock' ? MOCK_XLM_TOKEN : TESTNET_XLM; }

// ---------------- reads ----------------

export async function listLaunches(): Promise<LaunchInfo[]> {
  if (launchpadMode() === 'mock') return readLaunchpadMock().launches.map(l => l.info);
  const count = await read<number>(FACTORY, 'launch_count');
  const pages: Promise<LaunchInfo[]>[] = [];
  for (let start = 0; start < count; start += 50) pages.push(read<LaunchInfo[]>(FACTORY, 'list_launches', [scU32(start), scU32(50)]));
  return (await Promise.all(pages)).flat();
}
/** Looks a launch up by its token address, or by its curve address through the curve's own config. */
export async function resolveLaunch(address: string): Promise<LaunchInfo> {
  if (launchpadMode() === 'mock') return findMockLaunch(readLaunchpadMock(), address).info;
  if (!StrKey.isValidContract(address)) throw new Error('Enter a valid token or curve contract address.');
  try { return await read<LaunchInfo>(FACTORY, 'get_launch', [scAddress(address)]); }
  catch (first) {
    let token: string;
    try { token = (await read<CurveConfig>(address, 'get_config')).token; }
    catch { rethrow(first, {}, 'factory'); }
    try { return await read<LaunchInfo>(FACTORY, 'get_launch', [scAddress(token)]); }
    catch (error) { rethrow(error, {}, 'factory'); }
  }
}
export async function getCurveState(curve: string): Promise<CurveInfo> {
  if (launchpadMode() === 'mock') return mockCurveInfo(findMockLaunch(readLaunchpadMock(), curve));
  return read<CurveInfo>(curve, 'get_state').catch(e => rethrow(e, { [curve]: 'curve' }, 'curve'));
}
export async function getCurveConfig(curve: string): Promise<CurveConfig> {
  if (launchpadMode() === 'mock') {
    const l = findMockLaunch(readLaunchpadMock(), curve);
    return { token: l.info.token, quote_token: l.info.quote_token, creator: l.info.creator, factory: 'mock-launchpad-factory', treasury: 'mock-treasury', params: l.params, k: l.params.virtual_quote * l.params.virtual_token, graduation: { venue: 0, router: 'mock-aquarius-router', market_factory: 'mock-market-factory', quote_price: null } };
  }
  return read<CurveConfig>(curve, 'get_config').catch(e => rethrow(e, { [curve]: 'curve' }, 'curve'));
}
export async function quoteBuy(curve: string, quoteIn: bigint): Promise<BuyQuote> {
  if (launchpadMode() === 'mock') { const q = mockQuoteBuy(findMockLaunch(readLaunchpadMock(), curve), quoteIn); return { quote_spent: q.gross, fee: q.fee, tokens_out: q.tokensOut, clamped: q.clamped }; }
  return read<BuyQuote>(curve, 'quote_buy', [scI128(quoteIn)]).catch(e => rethrow(e, { [curve]: 'curve' }, 'curve'));
}
export async function quoteSell(curve: string, tokensIn: bigint): Promise<SellQuote> {
  if (launchpadMode() === 'mock') { const q = mockQuoteSell(findMockLaunch(readLaunchpadMock(), curve), tokensIn); return { gross_quote: q.gross, fee: q.fee, quote_out: q.quoteOut }; }
  return read<SellQuote>(curve, 'quote_sell', [scI128(tokensIn)]).catch(e => rethrow(e, { [curve]: 'curve' }, 'curve'));
}
export async function getGraduation(curve: string): Promise<Graduation | null> {
  if (launchpadMode() === 'mock') return findMockLaunch(readLaunchpadMock(), curve).graduation;
  const value = await read<Graduation | null | undefined>(curve, 'get_graduation').catch(e => rethrow(e, { [curve]: 'curve' }, 'curve'));
  return value ?? null;
}
export interface GraduationCost { token: string; amount: bigint; code: string; issuer: string | null }
/** `(fee token, amount)` from the curve plus the SAC's `name()` ("AQUA:G...") so the trustline can be named. */
export async function getGraduationCost(curve: string): Promise<GraduationCost> {
  if (launchpadMode() === 'mock') return { token: MOCK_AQUA, amount: MOCK_GRADUATION_FEE, code: 'AQUA', issuer: MOCK_AQUA_ISSUER };
  const [token, amount] = await read<[string, bigint]>(curve, 'graduation_cost').catch(e => rethrow(e, { [curve]: 'curve' }, 'curve'));
  let code = 'AQUA', issuer: string | null = null;
  try { const name = await read<string>(token, 'name'); const [c, i] = name.split(':'); if (c) code = c; if (i && StrKey.isValidEd25519PublicKey(i)) issuer = i; } catch { /* name is optional */ }
  return { token, amount, code, issuer };
}
export async function getPreset(preset: Preset): Promise<CurveParams> {
  if (launchpadMode() === 'mock') return mockPreset(preset);
  return read<CurveParams>(FACTORY, 'get_preset', [scAddress(TESTNET_XLM), scU32(preset)]).catch(e => rethrow(e, {}, 'factory'));
}
export async function getFactoryConfig(): Promise<FactoryConfig> {
  if (launchpadMode() === 'mock') return mockFactoryConfig(readLaunchpadMock());
  return read<FactoryConfig>(FACTORY, 'config').catch(e => rethrow(e, {}, 'factory'));
}
export interface TokenBalance { balance: bigint; needsTrustline: boolean }
/** Wallet balance of a token (launch token, XLM or AQUA). SAC accounts without a trustline report `needsTrustline`. */
export async function getTokenBalance(token: string, owner: string): Promise<TokenBalance> {
  if (launchpadMode() === 'mock') {
    const state = readLaunchpadMock();
    if (token === MOCK_XLM_TOKEN) return { balance: state.xlm[owner] ?? 0n, needsTrustline: false };
    if (token === MOCK_AQUA) return { balance: state.aqua[owner] ?? 0n, needsTrustline: false };
    return { balance: findMockLaunch(state, token).holdings[owner] ?? 0n, needsTrustline: false };
  }
  return readWalletTokenBalance(token, owner, (contract, method, args) => read(contract, method, args));
}
export interface TokenMeta { symbol: string; name: string; decimals: number; metadataUri: string }
export async function getTokenMeta(token: string): Promise<TokenMeta> {
  if (launchpadMode() === 'mock') { const l = findMockLaunch(readLaunchpadMock(), token); return { symbol: l.info.symbol, name: l.info.name, decimals: 7, metadataUri: l.metadataUri }; }
  const [symbol, name, decimals, metadataUri] = await Promise.all([read<string>(token, 'symbol'), read<string>(token, 'name'), read<number>(token, 'decimals'), read<string>(token, 'metadata_uri').catch(() => '')]);
  return { symbol, name, decimals, metadataUri: metadataUri || '' };
}
/** Current owner of a graduated group on the market factory (the curve until `claim_group`). */
export async function getGroupOwner(groupId: number): Promise<string> {
  if (launchpadMode() === 'mock') return readLaunchpadMock().groupOwners[String(groupId)] ?? '';
  const group = await read<{ owner: string }>(MARKET_FACTORY, 'get_group', [scU32(groupId)]);
  return group.owner;
}
/** Buys, sells and graduation events of a curve from the RPC event stream. */
export async function getCurveActivity(launch: LaunchInfo): Promise<CurveActivity> {
  if (launchpadMode() === 'mock') return mockActivity(findMockLaunch(readLaunchpadMock(), launch.curve));
  const server = launchpadMode() === 'live' ? getRpc() : testnetRpc();
  return fetchCurveActivity(server, launch.curve, Number(launch.created_at));
}

// ---------------- writes (testnet live mode, or the demo) ----------------

function assertSigning(): void {
  const mode = launchpadMode();
  if (mode === 'remote') throw new Error('The launchpad signs transactions on testnet only. Open the testnet app to trade.');
  if (mode === 'live' && network.readOnly) throw new Error('This preview is read-only. Transactions are not enabled.');
}
function demoDone(onProgress: ((p: TxProgress) => void) | undefined, hash: string) { onProgress?.({ status: 'success', hash, message: MOCK_SAVED }); }

export interface LaunchInput { name: string; symbol: string; metadataUri: string; preset: Preset; creatorBuy: bigint; minTokensOut: bigint }
export async function launchCurve(signer: Signer, input: LaunchInput, onProgress?: (p: TxProgress) => void): Promise<{ token: string; curve: string; hash: string }> {
  assertSigning();
  if (launchpadMode() === 'mock') {
    const result = mutateLaunchpadMock(state => mockLaunchCurve(state, signer.address, input.name, input.symbol, input.preset, input.metadataUri, input.creatorBuy, input.minTokensOut));
    demoDone(onProgress, result.hash);
    return result;
  }
  const params = scMap({ quote_token: scAddress(TESTNET_XLM), preset: scU32(input.preset), metadata_uri: scString(input.metadataUri), creator_buy: scI128(input.creatorBuy), min_tokens_out: scI128(input.minTokensOut) });
  try {
    const result = await submitContract<[string, string]>({ contractId: FACTORY, method: 'launch_curve', args: [scAddress(signer.address), scString(input.name), scString(input.symbol), params], signer, onProgress });
    const [token, curve] = result.value;
    return { token, curve, hash: result.hash };
  } catch (error) { rethrow(error, {}, 'factory'); }
}
export async function buyTokens(signer: Signer, curve: string, quoteIn: bigint, minTokensOut: bigint, onProgress?: (p: TxProgress) => void): Promise<{ tokensOut: bigint; hash: string }> {
  assertSigning();
  if (launchpadMode() === 'mock') { const r = mutateLaunchpadMock(state => mockBuy(state, signer.address, findMockLaunch(state, curve), quoteIn, minTokensOut)); demoDone(onProgress, r.hash); return r; }
  try {
    const result = await submitContract<bigint>({ contractId: curve, method: 'buy', args: [scAddress(signer.address), scI128(quoteIn), scI128(minTokensOut)], signer, onProgress });
    return { tokensOut: result.value, hash: result.hash };
  } catch (error) { rethrow(error, { [curve]: 'curve' }, 'curve'); }
}
export async function sellTokens(signer: Signer, curve: string, tokensIn: bigint, minQuoteOut: bigint, onProgress?: (p: TxProgress) => void): Promise<{ quoteOut: bigint; hash: string }> {
  assertSigning();
  if (launchpadMode() === 'mock') { const r = mutateLaunchpadMock(state => mockSell(state, signer.address, findMockLaunch(state, curve), tokensIn, minQuoteOut)); demoDone(onProgress, r.hash); return r; }
  try {
    const result = await submitContract<bigint>({ contractId: curve, method: 'sell', args: [scAddress(signer.address), scI128(tokensIn), scI128(minQuoteOut)], signer, onProgress });
    return { quoteOut: result.value, hash: result.hash };
  } catch (error) { rethrow(error, { [curve]: 'curve' }, 'curve'); }
}
/** One graduation step per call. Only the first step needs the payer's AQUA; later steps ignore the payer. */
export async function graduate(signer: Signer, curve: string, onProgress?: (p: TxProgress) => void): Promise<{ step: GradStep; hash: string }> {
  assertSigning();
  if (launchpadMode() === 'mock') { const r = mutateLaunchpadMock(state => mockGraduate(state, signer.address, findMockLaunch(state, curve))); demoDone(onProgress, r.hash); return r; }
  try {
    const result = await submitContract<GradStep>({ contractId: curve, method: 'graduate', args: [scAddress(signer.address)], signer, onProgress });
    return { step: result.value, hash: result.hash };
  } catch (error) { rethrow(error, { [curve]: 'curve', [MARKET_FACTORY]: 'factory' }, 'curve'); }
}
export async function claimGroup(signer: Signer, curve: string, onProgress?: (p: TxProgress) => void): Promise<{ groupId: number; hash: string }> {
  assertSigning();
  if (launchpadMode() === 'mock') { const r = mutateLaunchpadMock(state => mockClaimGroup(state, signer.address, findMockLaunch(state, curve))); demoDone(onProgress, r.hash); return r; }
  try {
    const result = await submitContract<number>({ contractId: curve, method: 'claim_group', args: [scAddress(signer.address)], signer, onProgress });
    return { groupId: result.value, hash: result.hash };
  } catch (error) { rethrow(error, { [curve]: 'curve' }, 'curve'); }
}

/** Creator cap in tokens for a preset, shown on the launch form before the curve exists. */
export function presetCreatorCap(params: CurveParams): bigint { return creatorCap(params); }
