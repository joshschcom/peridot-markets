/** Group lending uses the audited core ABI. Flow design informed by PeridotV2Full
 * 86ae3795/lib/stellar-soroban-lending.ts; addresses and transport are group scoped. */
import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { network } from './network';
import { readContract, submitContract } from './rpc';
import { parseAmount } from './amount';
import { canonicalTokenSymbol, getTokenMetadata } from './factory';
import { readMockState, mutateMockState, writeMockEvent } from './mock';
import type { Group, MarketConfig, PriceCheck, VaultState } from './types';

export type Signer = { address: string; signTransaction: (xdr: string) => Promise<string> };
export type Progress = { status: 'simulating'|'signing'|'submitting'|'confirming'|'success'|'unknown'|'error'; hash?: string; message?: string };
export const addr = (value: string) => new Address(value).toScVal();
export const uint = (value: bigint | number, type: 'u128'|'u64'|'u32' = 'u128') => nativeToScVal(value, { type });
export const unitEnum = (value: string) => xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(value)]);
export const enumName = (value: unknown): string => typeof value === 'string' ? value : Array.isArray(value) ? String(value[0]) : value && typeof value === 'object' && 'tag' in value ? String(value.tag) : '';
export interface TokenInfo { address: string; symbol: string; decimals: number }
export interface MarketView {
  address: string; config: MarketConfig; token: TokenInfo; supplied: bigint; borrowed: bigint;
  liquidity: bigint; receiptBalance: bigint; walletBalance: bigint; needsTrustline:boolean; debt: bigint; exchangeRate: bigint;
  supplyApr: number; borrowApr: number; utilization: number; price: PriceCheck | null;
  priceError?: string; vault: VaultState | null; vaultError?: string; entered: boolean;
}
const MOCK_KEY = 'peridot:group-portfolio:v1';
type MockAccount = { supplied: string; debt: string; entered: boolean };
type MockBook = Record<string, MockAccount>;
function mockBook(): MockBook { try { return JSON.parse(localStorage.getItem(MOCK_KEY) || '{}'); } catch { return {}; } }
function mockKey(group: Group, market: string, owner: string) { return `${network.name}:${group.id}:${market}:${owner}`; }
function saveBook(book: MockBook) { try { localStorage.setItem(MOCK_KEY, JSON.stringify(book)); } catch { throw new Error('Demo storage is unavailable. Enable browser storage to retain this action.'); } }
export function mockAccount(group: Group, market: string, owner: string): MockAccount { return mockBook()[mockKey(group,market,owner)] || { supplied:'0', debt:'0', entered:false }; }
export async function tokenInfo(token: string): Promise<TokenInfo> {
  if (network.useMocks) return { address: token, ...await getTokenMetadata(token) };
  const [symbol, decimals] = await Promise.all([readContract<string>(token,'symbol',[]),readContract<number>(token,'decimals',[])]);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token precision.');
  return { address:token, symbol:canonicalTokenSymbol(token,symbol), decimals };
}
export function rateApr(config: MarketConfig, cash: bigint, borrowed: bigint, reserves = 0n) {
  const total = cash + borrowed - reserves;
  if (cash < 0n || borrowed < 0n || reserves < 0n || total < 0n) throw new Error('Invalid market totals.');
  const rawUtil = total > 0n ? borrowed * 1_000_000n / total : 0n;
  const util = rawUtil > 1_000_000n ? 1_000_000n : rawUtil;
  const r=config.rates;
  const borrow = r.base + (util <= r.kink ? util*r.multiplier/1_000_000n : r.kink*r.multiplier/1_000_000n+(util-r.kink)*r.jump/1_000_000n);
  const supply=(borrow*(1_000_000n-config.reserve_factor)/1_000_000n)*util/1_000_000n;
  return { borrowApr:Number(borrow)/10000, supplyApr:Number(supply)/10000, utilization:Number(util)/10000 };
}
/** Recognize only SAC's explicit missing-trustline diagnostic for this token and account. */
export function isMissingTrustlineError(error:unknown,token:string,owner:string):boolean {
  if(!(error instanceof Error))return false;
  const message=error.message;
  return message.includes('Error(Contract, #13)')&&message.includes(`contract:${token},`)
    &&new RegExp(`\"trustline entry is missing for account\"\\s*,\\s*${owner}\\s*\\]`).test(message);
}
export async function readWalletTokenBalance(token:string,owner:string,read:(contract:string,method:string,args:xdr.ScVal[])=>Promise<unknown>=readContract):Promise<{balance:bigint;needsTrustline:boolean}> {
  try {
    const balance=await read(token,'balance',[addr(owner)]);
    if(typeof balance!=='bigint'||balance<0n)throw new Error('Token returned an invalid wallet balance.');
    return {balance,needsTrustline:false};
  } catch(error) {
    if(isMissingTrustlineError(error,token,owner))return {balance:0n,needsTrustline:true};
    throw error;
  }
}
export async function readMarket(group: Group, market: string, config: MarketConfig, owner: string | null): Promise<MarketView> {
  const token=await tokenInfo(config.token);
  if(network.useMocks) {
    const account=mockAccount(group,market,owner||'');
    const supplied=100_000n*10n**BigInt(token.decimals)+BigInt(account.supplied), borrowed=20_000n*10n**BigInt(token.decimals)+BigInt(account.debt);
    return { address:market,config,token,supplied,borrowed,liquidity:supplied-borrowed,receiptBalance:BigInt(account.supplied),walletBalance:10_000n*10n**BigInt(token.decimals)-BigInt(account.supplied)+BigInt(account.debt),needsTrustline:false,debt:BigInt(account.debt),exchangeRate:1_000_000n,...rateApr(config,supplied-borrowed,borrowed),price:{mode:'ReflectorOnly',reflector_price:100_000_000n,aquarius_price:undefined,deviation_bps:undefined,status:'ok',timestamp:BigInt(Math.floor(Date.now()/1000))},vault:null,entered:account.entered };
  }
  const [supplied,borrowed,liquidity,exchangeRate,reserves,receiptBalance,walletState,debt,enteredMarkets] = await Promise.all([
    readContract<bigint>(market,'get_total_underlying',[]),readContract<bigint>(market,'get_total_borrowed',[]),readContract<bigint>(market,'get_available_liquidity',[]),readContract<bigint>(market,'get_exchange_rate',[]),readContract<bigint>(market,'get_total_reserves',[]),
    owner?readContract<bigint>(market,'get_ptoken_balance',[addr(owner)]):0n,
    owner?readWalletTokenBalance(config.token,owner):{balance:0n,needsTrustline:false},
    owner?readContract<bigint>(market,'get_user_borrow_balance',[addr(owner)]):0n,
    owner?readContract<string[]>(group.controller,'get_user_markets',[addr(owner)]):[],
  ]);
  let price:PriceCheck|null=null,priceError:string|undefined,vault:VaultState|null=null,vaultError:string|undefined;
  try { price=await readContract<PriceCheck>(group.price_router,'check',[addr(config.token)]); } catch(e) { priceError=String(e); }
  if(config.yield_route.tag!=='None') {
    try {
      const vaultId=await readContract<string|undefined>(market,'get_boosted_vault',[]);
      if(vaultId && config.yield_route.tag!=='Defindex') vault=await readContract<VaultState>(vaultId,'get_state',[]);
      else if(vaultId) {
        const shares=await readContract<bigint>(vaultId,'balance',[addr(market)]);
        const amounts=await readContract<bigint[]>(vaultId,'get_asset_amounts_per_shares',[nativeToScVal(shares,{type:'i128'})]);
        vault={kind:'DeFindex',underlying:config.token,total_shares:shares,total_value:amounts[0]||0n,principal:0n,reserve:0n,last_harvest_ts:0n,last_harvest_amount:0n,apy_hint_bps:0,paused:false};
      }
    } catch(e) { vaultError=String(e); }
  }
  // Config rate curve is an APR quote, not a historical compounded yield.
  return {address:market,config,token,supplied,borrowed,liquidity,exchangeRate,receiptBalance,walletBalance:walletState.balance,needsTrustline:walletState.needsTrustline,debt,...rateApr(config,supplied+reserves-borrowed,borrowed,reserves),price,priceError,vault,vaultError,entered:(enteredMarkets as string[]).includes(market)};
}
export type LendingAction='Supply'|'Withdraw'|'Borrow'|'Repay'|'Enable collateral';
export async function lend(group:Group,market:MarketView,action:LendingAction,amount:string,signer:Signer,onProgress?:(p:Progress)=>void,all=false) {
  if(market.needsTrustline&&action!=='Enable collateral')throw new Error(`Add a ${market.token.symbol} trustline with your wallet before receiving or using this asset, then refresh balances.`);
  const units=action==='Enable collateral'||(all&&(action==='Withdraw'||action==='Repay'))?0n:parseAmount(amount,market.token.decimals);
  if(action!=='Enable collateral' && units<=0n && !all) throw new Error('Enter an amount greater than zero.');
  if(network.useMocks) {
    onProgress?.({status:'simulating',message:`Demo ${action.toLowerCase()}`});
    const book=mockBook(),key=mockKey(group,market.address,signer.address),old=mockAccount(group,market.address,signer.address);
    let supplied=BigInt(old.supplied),debt=BigInt(old.debt);
    if(action==='Supply') { if(group.reward_distributor&&!old.entered)throw new Error('Enable this market before supplying to earn rewards.'); if(units>market.walletBalance)throw new Error('Amount exceeds your wallet balance.'); supplied+=units; }
    if(action==='Withdraw') { if(!all&&units>supplied) throw new Error('Amount exceeds your supplied balance.'); supplied=all?0n:supplied-units; }
    if(action==='Borrow') { if(!old.entered)throw new Error('Enable this market before borrowing its asset.'); if(units>market.liquidity)throw new Error('The market has insufficient liquidity.'); debt+=units; }
    if(action==='Repay') debt=all?0n:debt-(units>debt?debt:units);
    book[key]={supplied:supplied.toString(),debt:debt.toString(),entered:old.entered||action==='Enable collateral'};
    if(action==='Borrow'||action==='Withdraw') {
      const state=readMockState();let collateral=0n,totalDebt=0n;
      for(const address of group.markets){
        const account=book[mockKey(group,address,signer.address)]||{supplied:'0',debt:'0',entered:false};
        const cfg=state.configs[`${group.id}:${address}`];
        if(account.entered&&cfg)collateral+=BigInt(account.supplied)*cfg.collateral_factor/1_000_000n;
        totalDebt+=BigInt(account.debt);
      }
      if(totalDebt>collateral)throw new Error('Enable enough collateral in this group before borrowing or withdrawing.');
    }
    saveBook(book);
    if(group.reward_distributor&&book[key].entered)mutateMockState(state=>{
      const key=`control:${group.id}`;
      const control=(state.pending[key]??={changes:[],pauses:{}}) as {rewardAccrued?:Record<string,bigint>};
      const supplyReward=market.supplied>0n?market.config.supply_reward_per_sec*supplied/market.supplied:0n;
      const borrowReward=market.borrowed>0n?market.config.borrow_reward_per_sec*debt/market.borrowed:0n;
      const accrued=control.rewardAccrued??={};accrued[signer.address]=(accrued[signer.address]??0n)+supplyReward+borrowReward;
    });
    onProgress?.({status:'success',message:'Demo action saved. No onchain transaction.'}); return {hash:'',value:undefined};
  }
  let contractId=market.address,method=action.toLowerCase(),args=[addr(signer.address),uint(units)];
  if(action==='Supply'&&group.reward_distributor){
    const entered=await readContract<string[]>(group.controller,'get_user_markets',[addr(signer.address)]);
    if(!entered.includes(market.address))throw new Error('Enable this market before supplying to earn rewards.');
  }
  if(action==='Supply') { method='deposit'; if(units>market.walletBalance) throw new Error('Amount exceeds your wallet balance.'); }
  if(action==='Enable collateral') {contractId=group.controller;method='enter_market';args=[addr(signer.address),addr(market.address)];}
  if(action==='Withdraw') {
    const [rate,balance,max]=await Promise.all([readContract<bigint>(market.address,'get_exchange_rate'),readContract<bigint>(market.address,'get_ptoken_balance',[addr(signer.address)]),readContract<bigint>(group.controller,'preview_redeem_max',[addr(signer.address),addr(market.address)])]);
    if(rate<=0n)throw new Error('Invalid current exchange rate.');
    const shares=all?balance:units*1_000_000n/rate;
    if(shares<=0n||shares>max||shares>balance)throw new Error('Withdrawal exceeds your available collateral or market liquidity.');
    args=[addr(signer.address),uint(shares)];
  }
  if(action==='Borrow') {
    const entered=await readContract<string[]>(group.controller,'get_user_markets',[addr(signer.address)]);
    if(!entered.includes(market.address))throw new Error('Enable this market before borrowing its asset.');
    const max=await readContract<bigint>(group.controller,'preview_borrow_max',[addr(signer.address),addr(market.address)]);
    if(units>max)throw new Error('Borrow amount exceeds your available borrow power or liquidity.');
  }
  if(action==='Repay' && !all && units>market.walletBalance) throw new Error('Repayment exceeds your wallet balance.');
  if(action==='Repay' && all) {method='repay_max';args=[addr(signer.address)];}
  return submitContract({contractId,method,args,signer,onProgress});
}
export async function readRewards(group:Group,owner:string|null) {
  if(!group.reward_distributor) return null;
  if(network.useMocks){
    const state=readMockState();
    const token=state.pending[`reward-token:${group.id}`] as TokenInfo|undefined;
    if(!token)throw new Error('Demo reward token metadata is missing. Reconfigure this demo group.');
    const control=state.pending[`control:${group.id}`] as {rewardBalance?:bigint;rewardAccrued?:Record<string,bigint>}|undefined;
    return {token,accrued:owner?(control?.rewardAccrued?.[owner]??0n):0n,available:control?.rewardBalance??0n};
  }
  const token=await tokenInfo(await readContract<string>(group.reward_distributor,'reward_token',[]));
  const [accrued,available]=await Promise.all([owner?readContract<bigint>(group.controller,'get_accrued',[addr(owner)]):0n,readContract<bigint>(group.reward_distributor,'balance_available',[])]);
  return {token,accrued,available};
}
export async function claimRewards(group:Group,signer:Signer,onProgress?:(p:Progress)=>void) {
  if(network.useMocks){
    if(!group.reward_distributor)throw new Error('This group has no reward token.');
    mutateMockState(state=>{
      const key=`control:${group.id}`;
      const control=(state.pending[key]??={changes:[],pauses:{}}) as {rewardBalance?:bigint;rewardAccrued?:Record<string,bigint>};
      const accrued=control.rewardAccrued?.[signer.address]??0n,available=control.rewardBalance??0n;
      const paid=accrued<available?accrued:available;
      control.rewardBalance=available-paid;(control.rewardAccrued??={})[signer.address]=accrued-paid;
      writeMockEvent(state,group.id,'claim',`Demo claim paid ${paid} base units; unpaid accrual remains.`);
    });
    onProgress?.({status:'success',message:'Demo claim saved. No real tokens moved.'});return {hash:'',value:undefined};
  }
  const rewardToken=await readContract<string>(group.reward_distributor!,'reward_token');
  const recipient=await readWalletTokenBalance(rewardToken,signer.address);
  if(recipient.needsTrustline)throw new Error('Add the reward token trustline with your wallet before claiming. Refresh after confirmation.');
  return submitContract({contractId:group.controller,method:'claim',args:[addr(signer.address)],signer,onProgress});
}
