/** Adapted from Peridot-Soroban@fe8d562 ordinary bot; uses the V3 worker's guarded transport. */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { StrKey, scValToNative } from '@stellar/stellar-sdk';
import { scAddress, scU128 } from './stellar.mjs';

export const validAddress = value => typeof value === 'string' && (StrKey.isValidEd25519PublicKey(value) || StrKey.isValidContract(value));
export function lendingSettings(env, group, settings) {
  const caps = JSON.parse(env.LENDING_REPAY_CAPS_JSON || '{}');
  if (!caps || typeof caps !== 'object' || Array.isArray(caps)) throw new Error('LENDING_REPAY_CAPS_JSON must be a market-to-raw-unit string map');
  const repayCaps = {};
  for (const [market, amount] of Object.entries(caps)) {
    if (!group.markets.includes(market) || typeof amount !== 'string' || !/^[1-9]\d*$/.test(amount) || BigInt(amount) >= 1n << 127n) throw new Error('Invalid lending repayment cap or market');
    repayCaps[market] = BigInt(amount);
  }
  const minProfitBps = Number(env.LENDING_MIN_PROFIT_BPS || '100');
  const costBufferRaw = env.LENDING_COST_BUFFER_USD_MICRO || '100000';
  if (!Number.isSafeInteger(minProfitBps) || minProfitBps < 1 || minProfitBps > 10000) throw new Error('LENDING_MIN_PROFIT_BPS must be 1..10000');
  if (!/^[1-9]\d*$/.test(costBufferRaw) || BigInt(costBufferRaw) >= 1n << 127n) throw new Error('LENDING_COST_BUFFER_USD_MICRO must be a positive integer');
  const startLedger = env.LENDING_START_LEDGER ? Number(env.LENDING_START_LEDGER) : null;
  if (startLedger !== null && (!Number.isSafeInteger(startLedger) || startLedger < 1)) throw new Error('LENDING_START_LEDGER must be a positive integer');
  return { repayCaps, minProfitBps, costBufferUsdMicro:BigInt(costBufferRaw), startLedger, bootstrapFile: env.LENDING_BOOTSTRAP_FILE,
    stateFile: env.LENDING_STATE_FILE || `./data/${settings.network}-group-${settings.groupId}-lending.json`,
    scope: `${settings.network}:${group.factory}:${settings.groupId}:${group.lendingController}`,
    network: settings.network, factory: group.factory, groupId: settings.groupId, controllerId: group.lendingController,
    maxBorrowersPerCycle: 25, maxLedgerWindow: 1000, eventPageSize: 100,
  };
}
function addresses(list) {
  if (!Array.isArray(list) || list.length > 10000 || list.some(a=>!validAddress(a))) throw new Error('Invalid borrower index');
  return [...new Set(list)];
}
export async function loadLendingState(config) {
  try {
    const state = JSON.parse(await readFile(config.stateFile, 'utf8'));
    if (state.scope !== config.scope || !Number.isSafeInteger(state.indexedThrough) || state.indexedThrough < 0) throw new Error('Lending state scope or ledger mismatch');
    return { ...state, borrowers: addresses(state.borrowers), initialized: true };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (config.bootstrapFile) {
    const snapshot = JSON.parse(await readFile(config.bootstrapFile, 'utf8'));
    if (snapshot.complete !== true || snapshot.network !== config.network || snapshot.factory !== config.factory || snapshot.group_id !== config.groupId || snapshot.lending_controller !== config.controllerId || !Number.isSafeInteger(snapshot.as_of_ledger) || snapshot.as_of_ledger < 1) throw new Error('Borrower bootstrap snapshot must attest complete matching group coverage at a ledger');
    return { scope: config.scope, indexedThrough: snapshot.as_of_ledger, borrowers: addresses(snapshot.borrowers), initialized: true };
  }
  if (config.startLedger === null) throw new Error('First lending startup requires LENDING_START_LEDGER at or before group creation, or LENDING_BOOTSTRAP_FILE');
  return { scope: config.scope, indexedThrough: config.startLedger - 1, borrowers: [], initialized: false };
}
export async function saveLendingState(path, state) {
  await mkdir(dirname(path), {recursive:true});
  await writeFile(`${path}.tmp`, JSON.stringify(state)+'\n', {mode:0o600});
  await rename(`${path}.tmp`, path);
}
export function discoverBorrowers(current, events) {
  const result = new Set(current);
  for (const event of events) {
    if (!event.topic?.length) continue;
    const name = String(scValToNative(event.topic[0]));
    const index = name === 'repay_borrow' ? 2 : ['borrow_event','market_entered','market_exited','mint'].includes(name) ? 1 : -1;
    if (index < 0) continue;
    if (!event.topic[index]) throw new Error('Missing borrower event topic');
    const address = scValToNative(event.topic[index]);
    if (!validAddress(address)) throw new Error('Malformed borrower event');
    result.add(address);
  }
  return addresses([...result]);
}
function nonnegative(value, name) {
  if (typeof value !== 'bigint' || value < 0n) throw new Error(`Malformed ${name} result`);
  return value;
}
const USD_SCALE = 10n ** 18n;
const ceilDiv = (n,d) => (n+d-1n)/d;
function decimalCount(value, name, max=18) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`Invalid ${name} decimals`);
  return value;
}
/** Router check prices use router.decimals(), not token decimals or a hard-coded USD scale. */
export async function lendingEconomics({ repayMarket, collateralMarket, repayAmount, seizeAmount, read, priceRouter, settings, now=Math.floor(Date.now()/1000) }) {
  if (!StrKey.isValidContract(priceRouter || '')) throw new Error('Verified group price router is required');
  if (!Number.isInteger(settings?.minProfitBps) || settings.minProfitBps < 1 || settings.minProfitBps > 10000 || typeof settings.costBufferUsdMicro !== 'bigint' || settings.costBufferUsdMicro <= 0n) throw new Error('Explicit liquidation profit and cost limits are required');
  if (typeof repayAmount !== 'bigint' || repayAmount <= 0n) throw new Error('Invalid repayment value');
  const repayToken=await read(repayMarket,'get_underlying_token',[]);
  const collateralToken=await read(collateralMarket,'get_underlying_token',[]);
  if (!StrKey.isValidContract(repayToken) || !StrKey.isValidContract(collateralToken)) throw new Error('Invalid valuation token');
  const repayDecimals=decimalCount(await read(repayToken,'decimals',[]),'repayment token');
  const collateralDecimals=decimalCount(await read(collateralToken,'decimals',[]),'collateral token');
  const quoteDecimals=decimalCount(await read(priceRouter,'decimals',[]),'router',38);
  const resolution=await read(priceRouter,'resolution',[]);
  if (!Number.isSafeInteger(resolution) || resolution <= 0) throw new Error('Invalid oracle resolution');
  const price = async token => {
    const observation=await read(priceRouter,'check',[scAddress(token)]);
    if (!observation || observation.status !== 'ok' || typeof observation.timestamp !== 'bigint' || observation.timestamp <= 0n || observation.timestamp > BigInt(now) || BigInt(now)-observation.timestamp > BigInt(resolution)*2n || typeof observation.reflector_price !== 'bigint' || observation.reflector_price <= 0n) throw new Error('Live oracle price is unavailable, stale or invalid');
    return observation.reflector_price;
  };
  const repayPrice=await price(repayToken), collateralPrice=await price(collateralToken);
  const fee=nonnegative(await read(null,'get_liquidation_fee_scaled',[]),'liquidation fee');
  if (fee > 500000n) throw new Error('Liquidation fee exceeds reviewed guardrail');
  const recipient=await read(null,'get_reserve_recipient',[]);
  if (recipient !== null && recipient !== undefined && !validAddress(recipient)) throw new Error('Invalid protocol fee recipient');
  // The core explicitly zeroes the fee when no reserve recipient exists.
  const effectiveFee = recipient === null || recipient === undefined ? 0n : fee;
  const gross=seizeAmount ?? nonnegative(await read(null,'preview_seize_ptokens',[scAddress(repayMarket),scAddress(collateralMarket),scU128(repayAmount)]),'seize preview');
  const netShares=gross-gross*effectiveFee/1000000n;
  const exchangeRate=nonnegative(await read(collateralMarket,'get_exchange_rate',[]),'exchange rate');
  if (exchangeRate === 0n) throw new Error('Invalid zero exchange rate');
  const underlying=netShares*exchangeRate/1000000n;
  const quoteScale=10n**BigInt(quoteDecimals);
  const debtUsd=ceilDiv(repayAmount*repayPrice*USD_SCALE,10n**BigInt(repayDecimals)*quoteScale);
  const netCollateralUsd=underlying*collateralPrice*USD_SCALE/(10n**BigInt(collateralDecimals)*quoteScale);
  const requiredUsd=ceilDiv(debtUsd*(10000n+BigInt(settings.minProfitBps)),10000n)+settings.costBufferUsdMicro*10n**12n;
  return { profitable:netCollateralUsd>=requiredUsd, debtUsd, netCollateralUsd, requiredUsd, netShares };
}
export async function assertLendingEconomics(input) {
  const result=await lendingEconomics(input);
  if (!result.profitable) throw new Error('Net liquidation value is below the configured profit and cost margin');
  return result;
}

export async function planLendingLiquidation({ borrower, publicKey, markets, caps, read, priceRouter, settings }) {
  if (!validAddress(borrower) || borrower === publicKey) return { plan: null, hasDebt: false, reason: 'self or invalid borrower' };
  const debts = [];
  for (const market of markets) debts.push({ market, debt: nonnegative(await read(market,'get_user_borrow_balance',[scAddress(borrower)]),'debt') });
  const hasDebt = debts.some(d=>d.debt>0n);
  if (!hasDebt) return { plan:null, hasDebt:false };
  const liquidity = await read(null,'account_liquidity',[scAddress(borrower)]);
  if (!Array.isArray(liquidity) || liquidity.length !== 2) throw new Error('Malformed account liquidity');
  const shortfall=nonnegative(liquidity[1],'shortfall');
  if (shortfall === 0n) return {plan:null,hasDebt:true};
  const entered = await read(null,'get_user_markets',[scAddress(borrower)]);
  if (!Array.isArray(entered) || entered.some(m=>!markets.includes(m))) throw new Error('Borrower markets do not match selected group');
  // Factory market order is deterministic. Do not compare raw units of different assets.
  for (const {market:repayMarket,debt} of debts) {
    const operatorCap=caps[repayMarket];
    if (debt===0n || !operatorCap) continue;
    const token=await read(repayMarket,'get_underlying_token',[]);
    if (!StrKey.isValidContract(token)) throw new Error('Invalid underlying token');
    const balance=nonnegative(await read(token,'balance',[scAddress(publicKey)]),'inventory balance');
    const allowance=nonnegative(await read(token,'allowance',[scAddress(publicKey),scAddress(repayMarket)]),'repayment allowance');
    const closeCap=nonnegative(await read(null,'preview_repay_cap',[scAddress(borrower),scAddress(repayMarket)]),'repayment cap');
    let amount=[debt,operatorCap,balance,allowance,closeCap].reduce((a,b)=>a<b?a:b);
    if(amount===0n)continue;
    for(const collateralMarket of entered.filter(m=>m!==repayMarket)) {
      const shares=nonnegative(await read(collateralMarket,'get_ptoken_balance',[scAddress(borrower)]),'collateral shares');
      if(shares===0n)continue;
      let repay=amount;
      let seize=nonnegative(await read(null,'preview_seize_ptokens',[scAddress(repayMarket),scAddress(collateralMarket),scU128(repay)]),'seize preview');
      if(seize>shares){repay=repay*shares/seize;if(repay===0n)continue;seize=nonnegative(await read(null,'preview_seize_ptokens',[scAddress(repayMarket),scAddress(collateralMarket),scU128(repay)]),'seize preview');}
      if(seize===0n || seize>shares)continue;
      const economics = await lendingEconomics({ repayMarket, collateralMarket, repayAmount:repay, seizeAmount:seize, read, priceRouter, settings });
      if (!economics.profitable) continue;
      return {hasDebt:true,plan:{borrower,repayMarket,collateralMarket,repayAmount:repay,seizeAmount:seize}};
    }
  }
  throw new Error('Underwater borrower has no executable plan within configured inventory, allowance, cap and collateral limits');
}
export class LendingLiquidationKeeper {
  constructor(config, group, client, read, state, save, logger, status) {
    Object.assign(this,{config,group,client,read,state,save,logger,status});
  }
  async syncEvents() {
    const latest=await this.client.latestLedger();
    if(this.state.indexedThrough>latest.sequence)throw new Error('Borrower checkpoint is ahead of RPC network');
    const from=this.state.indexedThrough+1;
    const through=Math.min(latest.sequence,from+this.config.maxLedgerWindow-1);
    let borrowers=this.state.borrowers;
    if(from<=through){
      // One contract per request avoids provider limits on contract-ID filter counts.
      for(const id of [this.group.lendingController,...this.group.markets]){
        const filters=[{type:'contract',contractIds:[id]}];
        let request={startLedger:from,endLedger:through+1,filters,limit:this.config.eventPageSize};
        const seenCursors=new Set();
        for(;;){
          const response=await this.client.getEvents(request);
          if(!Number.isSafeInteger(response.latestLedger) || response.latestLedger < through)throw new Error('Event service has not indexed the requested ledger');
          if(response.events.some(e=>e.ledger<from || e.ledger>through))throw new Error('Event response is outside requested window');
          borrowers=discoverBorrowers(borrowers,response.events);
          if(response.events.length<this.config.eventPageSize)break;
          if(!response.cursor || seenCursors.has(response.cursor))throw new Error('Event pagination did not advance');
          seenCursors.add(response.cursor);
          request={cursor:response.cursor,endLedger:through+1,filters,limit:this.config.eventPageSize};
        }
      }
      this.state.borrowers=borrowers;this.state.indexedThrough=through;this.state.initialized=true;
      await this.save();
    }
    this.status.indexedThrough=this.state.indexedThrough;
    this.status.discoveryLag=Math.max(0,latest.sequence-this.state.indexedThrough);
    this.status.borrowers=this.state.borrowers.length;
    return this.status.discoveryLag===0;
  }
  async runCycle(){
    if(!await this.syncEvents()){this.status.ready=false;this.status.lastError='Backfilling borrower events';return;}
    let failed=false;
    const selected=this.state.borrowers.slice(0,this.config.maxBorrowersPerCycle);
    for(const borrower of selected){
      try{
        const {plan}=await planLendingLiquidation({borrower,publicKey:this.client.config.publicKey,markets:this.group.markets,caps:this.config.repayCaps,read:this.read,priceRouter:this.group.priceRouter,settings:this.config});
        // Healthy borrowers with debt remain indexed. Even zero-debt borrowers are retained.
        if(!plan)continue;
        await this.client.submit('liquidate',[scAddress(plan.borrower),scAddress(plan.repayMarket),scAddress(plan.collateralMarket),scU128(plan.repayAmount),scAddress(this.client.config.publicKey)]);
        this.logger.info('ordinary lending liquidation processed',{borrower,repayMarket:plan.repayMarket,collateralMarket:plan.collateralMarket,repayAmount:plan.repayAmount.toString(),dryRun:this.client.config.dryRun});
      }catch(error){if(error.fatal)throw error;failed=true;this.logger.error('ordinary lending borrower processing failed',{borrower,error:'Read, inventory, allowance or simulation unavailable'});}
    }
    this.state.borrowers=[...this.state.borrowers.slice(selected.length),...selected];await this.save();
    this.status.ready=!failed && Object.keys(this.config.repayCaps).length>0;this.status.lastError=failed?'Borrower read or liquidation plan failed':this.status.ready?null:'LENDING_REPAY_CAPS_JSON is not configured';
    this.status.lastCycle=Date.now();
  }
}
