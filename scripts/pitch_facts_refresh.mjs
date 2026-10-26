#!/usr/bin/env node
// Read-only refresh of the numeric tables in docs/PITCH-FACTS.md.
// Sends NO transactions and signs nothing: Horizon GETs, Soroban RPC getLedgerEntries and simulateTransaction only.
//
//   node scripts/pitch_facts_refresh.mjs                 print all tables (markdown) to stdout
//   node scripts/pitch_facts_refresh.mjs --only=accounts print one section (as_of,contracts,accounts,groups,value,wallets,config)
//   node scripts/pitch_facts_refresh.mjs --json          print the raw collected data as JSON instead
//
// Env: EVENT_START (default 2026-10-25T09:00:00Z = 09:00 Lisbon, WET = UTC on that date),
//      SOROBAN_RPC (default https://mainnet.sorobanrpc.com), HORIZON (default https://horizon.stellar.org),
//      DEPLOYMENTS (default deployments/mainnet.json).
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'app', 'package.json'));
const sdk = require('@stellar/stellar-sdk');
const { rpc, xdr, Address, StrKey, scValToNative, nativeToScVal, TransactionBuilder, Account, Operation, Networks, BASE_FEE, Contract } = sdk;

const HORIZON = process.env.HORIZON || 'https://horizon.stellar.org';
const RPC_URLS = (process.env.SOROBAN_RPC
  ? [process.env.SOROBAN_RPC]
  : ['https://mainnet.sorobanrpc.com', 'https://soroban-rpc.mainnet.stellar.gateway.fm']);
const EVENT_START = process.env.EVENT_START || '2026-10-25T09:00:00Z';
const DEP = JSON.parse(readFileSync(path.join(ROOT, process.env.DEPLOYMENTS || 'deployments/mainnet.json'), 'utf8'));
const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
const AS_JSON = args.includes('--json');
const want = (s) => !ONLY || ONLY === s;

// Public addresses only (no secrets are read anywhere in this file).
const ADDRS = {
  'peridot-mainnet-admin (deployer, group owner, factory admin)': DEP.admin,
  'peridot-mainnet-keeper (liquidation and refresh keeper)': 'GAFJVD3TKIEMIUEBJPQVZNRCG7PF25XOX7QZDRGR7Y3MNQWYQR6C2S3W',
  'peridot-mainnet (Peridot prod admin, prior work key)': 'GDYDTMY46RNAUIIUVG6RPD2D3I3ES4J2SSXGCKIQP2OET4Q5PV75LSPL',
};
const SIM_SOURCE = DEP.admin; // public key used only as the simulation source; never signs.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(1000 * (i + 1)); continue; }
    throw new Error(`${url} -> ${r.status}`);
  }
  throw new Error(`${url} kept failing`);
}

let _server;
function server() {
  if (!_server) _server = new rpc.Server(RPC_URLS[0], { allowHttp: false });
  return _server;
}
async function withRpc(fn) {
  let last;
  for (const u of RPC_URLS) {
    try { return await fn(new rpc.Server(u)); } catch (e) { last = e; }
  }
  throw last;
}

// ---------- helpers ----------
export const fmtLisbon = (iso) => {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return f.format(d);
};
const stroops = (v, dec = 7) => {
  const neg = v < 0n; let a = neg ? -v : v;
  const base = 10n ** BigInt(dec);
  const whole = a / base; const frac = (a % base).toString().padStart(dec, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
};

async function simulate(contractId, fn, params = [], source = SIM_SOURCE) {
  return withRpc(async (s) => {
    const acct = new Account(source, '0');
    const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.PUBLIC })
      .addOperation(new Contract(contractId).call(fn, ...params)).setTimeout(60).build();
    const sim = await s.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) throw new Error(`${fn}: ${sim.error}`);
    return sim.result?.retval ? scValToNative(sim.result.retval) : null;
  });
}
const addrArg = (a) => new Address(a).toScVal();
const u32Arg = (n) => nativeToScVal(n, { type: 'u32' });

async function contractInfo(id) {
  // Returns {exists, wasmHash?, kind}
  const key = new Contract(id).getFootprint();
  const res = await withRpc((s) => s.getLedgerEntries(key));
  if (!res.entries || !res.entries.length) return { exists: false };
  const inst = res.entries[0].val.contractData.val.value;
  const ex = inst.executable;
  const isWasm = ex.constructor.name === 'ContractExecutableWasm';
  return { exists: true, kind: isWasm ? 'wasm' : 'stellar-asset', wasmHash: isWasm ? ex.wasmHash.toString('hex') : undefined, lastModified: res.entries[0].lastModifiedLedgerSeq };
}

// ---------- sections ----------
async function sectionAsOf() {
  const now = new Date();
  const ledger = await withRpc((s) => s.getLatestLedger());
  return { utc: now.toISOString(), lisbon: fmtLisbon(now.toISOString()), ledger: ledger.sequence, eventStart: EVENT_START, eventStartLisbon: fmtLisbon(EVENT_START) };
}

function collectIds(o, p = '', out = []) {
  if (typeof o === 'string') { if (/^C[A-Z2-7]{55}$/.test(o) && StrKey.isValidContract(o)) out.push([p, o]); }
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) collectIds(v, p ? `${p}.${k}` : k, out);
  return out;
}

async function sectionContracts() {
  const ids = collectIds(DEP);
  const mf = DEP.factory, xf = DEP.margin_factory;
  const derived = [];
  const gc = Number(await simulate(mf, 'group_count'));
  const groups = [];
  for (let g = 1; g <= gc; g++) {
    const grp = await simulate(mf, 'get_group', [u32Arg(g)]);
    groups.push(grp);
    derived.push([`group ${g} (${grp.name}).controller`, grp.controller]);
    derived.push([`group ${g}.price_router`, grp.price_router]);
    if (grp.reward_distributor) derived.push([`group ${g}.reward_distributor`, grp.reward_distributor]);
    if (grp.margin_controller) derived.push([`group ${g}.margin_controller`, grp.margin_controller]);
    for (const m of grp.markets) {
      derived.push([`group ${g}.market`, m]);
      try { const rec = await simulate(mf, 'get_market_record', [u32Arg(g), addrArg(m)]); if (rec.jump_rate_model) derived.push([`group ${g}.jump_rate_model`, rec.jump_rate_model]); if (rec.adapter) derived.push([`group ${g}.yield_adapter`, rec.adapter]); } catch {}
    }
    const mi = await simulate(xf, 'get_margin', [u32Arg(g)]).catch(() => null);
    if (mi && mi.swap_adapter) derived.push([`group ${g}.swap_adapter`, mi.swap_adapter]);
  }
  // Launchpad (mainnet): factory id from deployments/mainnet.json `launchpad_factory`, or env LAUNCHPAD_FACTORY while the
  // manifest is not updated yet. Lists every launch (token + curve) and counts launched / graduated tokens.
  let launchpad = null;
  const lf = DEP.launchpad_factory || process.env.LAUNCHPAD_FACTORY;
  if (lf) {
    try {
      derived.push(['launchpad factory', lf]);
      const cfg = await simulate(lf, 'config');
      const launches = await simulate(lf, 'list_launches', [u32Arg(0), u32Arg(50)]);
      let graduated = 0; const items = [];
      for (const l of launches) {
        derived.push([`launch ${l.symbol} token`, l.token]); derived.push([`launch ${l.symbol} curve`, l.curve]);
        let phase = null; try { phase = (await simulate(l.curve, 'get_state')).phase; } catch {}
        if (Number(phase) === 2) graduated++;
        items.push({ symbol: l.symbol, token: l.token, curve: l.curve, createdAt: l.created_at, phase });
      }
      launchpad = { factory: lf, launchCount: cfg.launch_count, graduated, items };
    } catch (e) { launchpad = { factory: lf, error: String(e.message).slice(0, 100) }; }
  }
  const seen = new Set(); const rows = [];
  for (const [label, id] of [...ids, ...derived]) {
    if (seen.has(id)) continue; seen.add(id);
    let info; try { info = await contractInfo(id); } catch (e) { info = { exists: null, error: 'ERROR ' + String(e.message || e).slice(0, 80) }; }
    rows.push({ label, id, ...info });
  }
  const derivedIds = new Set(derived.map((d) => d[1]));
  const factoryMade = rows.filter((r) => derivedIds.has(r.id) && r.exists);
  return { rows, groups, groupCount: gc, factoryCreatedContracts: factoryMade.length, launchpad };
}

// decode invoke host function ops from Horizon
function decodeSym(b64) {
  try { const v = xdr.ScVal.fromXDR(b64, 'base64'); return String(scValToNative(v)); } catch { return null; }
}
function decodeAddr(b64) {
  try { const v = xdr.ScVal.fromXDR(b64, 'base64'); return Address.fromScVal(v).toString(); } catch { return null; }
}

async function pageAll(url, stopFn) {
  const out = []; let next = url;
  while (next) {
    const j = await getJson(next);
    const recs = j._embedded.records;
    if (!recs.length) break;
    for (const r of recs) { if (stopFn(r)) return out; out.push(r); }
    next = j._links.next.href;
    if (recs.length < 1) break;
    await sleep(120);
  }
  return out;
}

async function sectionAccounts() {
  const out = {};
  for (const [label, addr] of Object.entries(ADDRS)) {
    const acct = await getJson(`${HORIZON}/accounts/${addr}`);
    const txs = await pageAll(`${HORIZON}/accounts/${addr}/transactions?order=desc&limit=200&include_failed=true`, (t) => t.created_at < EVENT_START);
    const sent = txs.filter((t) => t.source_account === addr);
    const ok = sent.filter((t) => t.successful).length;
    const failedOnChain = sent.length - ok;
    const opsTotal = sent.reduce((a, t) => a + Number(t.operation_count), 0);
    const feeCharged = sent.reduce((a, t) => a + BigInt(t.fee_charged), 0n);
    // function name tally from operations
    const ops = await pageAll(`${HORIZON}/accounts/${addr}/operations?order=desc&limit=200&include_failed=true`, (o) => o.created_at < EVENT_START);
    const sentHashes = new Set(sent.map((t) => t.hash));
    const tally = {}; const creates = { upload: 0, create: 0 }; const byOpType = {};
    const detail = [];
    for (const o of ops) {
      if (!sentHashes.has(o.transaction_hash)) continue;
      byOpType[o.type] = (byOpType[o.type] || 0) + 1;
      if (o.type === 'invoke_host_function') {
        const fn = o.function || '';
        if (/Upload/i.test(fn)) { creates.upload++; detail.push({ t: o.created_at, hash: o.transaction_hash, fn: 'upload_wasm', ok: o.transaction_successful }); }
        else if (/Create/i.test(fn)) { creates.create++; detail.push({ t: o.created_at, hash: o.transaction_hash, fn: 'create_contract', ok: o.transaction_successful }); }
        else if (/Invoke/i.test(fn) && Array.isArray(o.parameters) && o.parameters.length >= 2) {
          const contract = decodeAddr(o.parameters[0].value); const name = decodeSym(o.parameters[1].value);
          const key = name || '?';
          tally[key] = (tally[key] || 0) + 1;
          detail.push({ t: o.created_at, hash: o.transaction_hash, fn: key, contract, ok: o.transaction_successful });
        }
      }
    }
    out[label] = {
      address: addr,
      xlm: acct.balances.find((b) => b.asset_type === 'native')?.balance,
      balances: acct.balances.map((b) => ({ asset: b.asset_code || b.asset_type, balance: b.balance, issuer: b.asset_issuer })),
      txSentSinceStart: sent.length, successful: ok, failedOnChain, participantTxs: txs.length,
      operations: opsTotal, feeChargedStroops: feeCharged.toString(), tally, creates, byOpType,
      first: sent.length ? sent[sent.length - 1].created_at : null, last: sent.length ? sent[0].created_at : null,
      detail,
    };
  }
  return out;
}

const j = (x) => JSON.stringify(x, (k, v) => (typeof v === 'bigint' ? v.toString() : v));
const toBig = (v) => (v === null || v === undefined ? null : BigInt(v));

async function readInstanceStorage(id) {
  const r = await withRpc((s) => s.getLedgerEntries(new Contract(id).getFootprint()));
  const inst = r.entries[0].val.contractData.val.value;
  const out = {};
  for (const e of inst.storage || []) out[j(scValToNative(e.key))] = scValToNative(e.val);
  return out;
}

async function readBoostedCache(market) {
  // receipt-vault DataKey::BoostedHealthCache (persistent): { underlying, updated_at }. Borrow health checks panic when older than 300 s.
  const fp = new Contract(market).getFootprint();
  fp.contractData.key = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('BoostedHealthCache')]);
  const r = await withRpc((s) => s.getLedgerEntries(fp));
  if (!r.entries.length) return null;
  const v = scValToNative(r.entries[0].val.contractData.val);
  return { underlying: BigInt(v.underlying), updatedAt: Number(v.updated_at) };
}

async function sectionValue() {
  const out = { markets: [], vaults: {}, prices: {} };
  const ext = DEP.external;
  const refl = ext.reflector_external;
  let dec = 14; try { dec = Number(await simulate(refl, 'decimals')); } catch {}
  async function px(sym) {
    const asset = xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Other'), xdr.ScVal.scvSymbol(sym)]);
    const r = await simulate(refl, 'lastprice', [asset]);
    return r ? { price: Number(r.price) / 10 ** dec, ts: Number(r.timestamp) } : null;
  }
  out.prices = { XLM: await px('XLM'), USDC: await px('USDC'), decimals: dec };
  const usd = { [ext.xlm]: out.prices.XLM?.price, [ext.usdc]: out.prices.USDC?.price };
  const nowS = Math.floor(Date.now() / 1000);

  const mf = DEP.factory; const gc = Number(await simulate(mf, 'get_group', [u32Arg(1)]).then(() => simulate(mf, 'group_count')));
  let totalSuppliedUsd = 0, totalBorrowedUsd = 0, totalRoutedUsd = 0;
  for (let g = 1; g <= gc; g++) {
    const grp = await simulate(mf, 'get_group', [u32Arg(g)]);
    for (const m of grp.markets) {
      const rec = { group: g, groupName: String(grp.name), market: m };
      const get = async (k, fn) => { try { rec[k] = await simulate(m, fn); } catch (e) { rec[k] = null; rec[k + 'Err'] = String(e.message).slice(0, 60); } };
      await get('underlying', 'get_underlying_token');
      await get('totalUnderlying', 'get_total_underlying');
      await get('totalBorrowed', 'get_total_borrowed');
      await get('totalReserves', 'get_total_reserves');
      await get('availableLiquidity', 'get_available_liquidity');
      await get('ptokens', 'get_total_ptokens');
      await get('boostedVault', 'get_boosted_vault');
      try { rec.record = await simulate(mf, 'get_market_record', [u32Arg(g), addrArg(m)]); } catch {}
      if (rec.boostedVault) {
        try { const c = await readBoostedCache(m); rec.boostedCache = c ? { underlying: c.underlying, ageSeconds: nowS - c.updatedAt } : null; } catch {}
      }
      const px_ = usd[rec.underlying];
      const toUsd = (v) => (v !== null && v !== undefined && px_ ? Number(BigInt(v)) / 1e7 * px_ : null);
      rec.usd = { supplied: toUsd(rec.totalUnderlying), borrowed: toUsd(rec.totalBorrowed) };
      if (rec.usd.supplied) totalSuppliedUsd += rec.usd.supplied;
      if (rec.usd.borrowed) totalBorrowedUsd += rec.usd.borrowed;
      out.markets.push(rec);
    }
  }
  // Partner positions held by our contracts
  const XLM = ext.xlm;
  const g1xlm = DEP.demo.markets.XLM;
  const dx = ext.defindex_vaults?.XLM;
  if (dx) {
    const r = { name: 'DeFindex Peridot XLM vault, held by group 1 XLM market', vault: dx, holder: g1xlm };
    try {
      const sh = await simulate(dx, 'balance', [addrArg(g1xlm)]); r.shares = sh;
      const per = await simulate(dx, 'get_asset_amounts_per_shares', [nativeToScVal(sh, { type: 'i128' })]);
      r.underlying = Array.isArray(per) ? per[0] : per; r.token = XLM;
      r.usd = Number(BigInt(r.underlying)) / 1e7 * (out.prices.XLM?.price || 0);
      totalRoutedUsd += r.usd;
    } catch (e) { r.error = String(e.message).slice(0, 120); }
    out.vaults.defindex = r;
  }
  const fv = ext.blend_fee_vault;
  const bl = { name: 'Blend fee vault, held by group 3 Blend adapter', vault: fv, holder: DEP.demo.blend_adapter, token: XLM };
  try {
    bl.underlying = await simulate(fv, 'get_underlying_tokens', [addrArg(XLM), addrArg(DEP.demo.blend_adapter)]);
    bl.shares = await simulate(fv, 'get_shares', [addrArg(XLM), addrArg(DEP.demo.blend_adapter)]);
    bl.usd = Number(BigInt(bl.underlying)) / 1e7 * (out.prices.XLM?.price || 0); totalRoutedUsd += bl.usd;
  } catch (e) { bl.error = String(e.message).slice(0, 120); }
  out.vaults.blend = bl;
  // Rewards distributor
  const rd = DEP.demo.reward_distributor;
  out.rewards = {};
  for (const f of ['balance_available', 'total_paid', 'total_funded', 'total_withdrawn']) { try { out.rewards[f] = await simulate(rd, f); } catch {} }
  out.totals = { suppliedUsd: totalSuppliedUsd, borrowedUsd: totalBorrowedUsd, routedToPartnersUsd: totalRoutedUsd };
  return out;
}

async function sectionConfig() {
  const out = { markets: [], margin: {}, rewards: {}, feeVault: {}, defindexFees: null };
  const mf = DEP.factory; const gc = Number(await simulate(mf, 'group_count'));
  for (let g = 1; g <= gc; g++) {
    const grp = await simulate(mf, 'get_group', [u32Arg(g)]);
    for (const m of grp.markets) {
      const rec = await simulate(mf, 'get_market_record', [u32Arg(g), addrArg(m)]);
      const extra = {};
      for (const [k, fn] of [['collateralFactorLive', 'get_collateral_factor'], ['idleBufferBps', 'get_idle_cash_buffer_bps'], ['totalReserves', 'get_total_reserves'], ['totalAdminFees', 'get_total_admin_fees']]) {
        try { extra[k] = await simulate(m, fn); } catch {}
      }
      out.markets.push({ group: g, name: String(grp.name), market: m, cfg: rec.cfg, active: rec.active, pendingCf: rec.pending_cf, pendingPrice: rec.pending_price, adapter: rec.adapter, ...extra });
    }
    try {
      const ctl = grp.controller;
      const cf = {}; for (const [k, fn] of [['closeFactor', 'get_close_factor_scaled'], ['liquidationIncentive', 'get_liquidation_incentive_scaled'], ['liquidationFee', 'get_liquidation_fee_scaled']]) { try { cf[k] = await simulate(ctl, fn); } catch {} }
      out.markets.push({ group: g, controllerParams: cf });
    } catch {}
  }
  try { out.margin = { group1: await simulate(DEP.margin_factory, 'get_margin', [u32Arg(1)]), status: await simulate(DEP.margin_factory, 'get_margin_status', [u32Arg(1)]).catch(() => null) }; } catch {}
  try {
    const mc = DEP.demo.margin_controller;
    const fees = await simulate(mc, 'preview_open_fees_v3', [nativeToScVal(2n, { type: 'u128' }), nativeToScVal(10000000n, { type: 'u128' })]);
    out.margin.previewOpenFees2x_1unit = fees;
  } catch (e) { out.margin.previewErr = String(e.message).slice(0, 100); }
  try { out.feeVault = await readInstanceStorage(DEP.external.blend_fee_vault); } catch {}
  try { out.defindexFees = await simulate(DEP.external.defindex_vaults.XLM, 'get_fees'); } catch {}
  return out;
}

async function sectionWallets() {
  // Native XLM + USDC balances of every address that appears in the repo demo docs.
  const addrs = { ...Object.fromEntries(Object.entries(ADDRS).map(([k, v]) => [k, v])) };
  addrs['fresh Albedo test account (docs/DEMO.md, COORDINATION)'] = 'GBTAM7KI53O5CMJW7QHS2TG7JX65H4Y2TGDXS42ZLJEK6YMGDBBZOOQD';
  const out = {};
  for (const [label, a] of Object.entries(addrs)) {
    try {
      const acct = await getJson(`${HORIZON}/accounts/${a}`);
      out[label] = { address: a, balances: acct.balances.map((b) => ({ asset: b.asset_code || b.asset_type, balance: b.balance })) };
    } catch (e) { out[label] = { address: a, error: String(e.message).slice(0, 80) }; }
  }
  return out;
}

function toMd(data) {
  const L = [];
  if (data.as_of) {
    const a = data.as_of;
    L.push(`**As of ${a.utc} (UTC) = ${a.lisbon} (Europe/Lisbon, WET, same as UTC this week). Mainnet ledger ${a.ledger}.** Event window start used: ${a.eventStart} (= ${a.eventStartLisbon} Lisbon).`, '');
  }
  if (data.contracts) {
    L.push('### Contract existence check (Soroban RPC getLedgerEntries, instance key)', '', '| Label | Contract ID | On chain | Kind / Wasm hash |', '|---|---|---|---|');
    for (const r of data.contracts.rows) L.push(`| ${r.label} | \`${r.id}\` | ${r.exists === null ? 'ERROR' : r.exists ? 'YES' : 'NO'} | ${r.exists ? (r.kind === 'wasm' ? 'wasm ' + r.wasmHash.slice(0, 12) + '...' : r.kind) : (r.error || '')} |`);
    if (data.contracts.launchpad) L.push('', `Launchpad on this network: ${j(data.contracts.launchpad)} (phase 0 Trading, 1 Graduatable, 2 Graduated, 3 Graduating)`);
    L.push('', `Market groups on the market-factory (group_count): ${data.contracts.groupCount}. Contracts created by the factories (controllers, price routers, markets, jump-rate models, distributors, adapters, margin controllers, swap adapters), counted from on-chain state: ${data.contracts.factoryCreatedContracts}.`, '');
  }
  if (data.accounts) {
    L.push('### Transactions sent by our addresses since the event start (Horizon)', '', '| Account | Address | Tx sent (source = address) | successful | failed on chain | operations | fees paid (XLM) | first | last | XLM balance |', '|---|---|---|---|---|---|---|---|---|---|');
    let tot = 0, okTot = 0;
    for (const [k, v] of Object.entries(data.accounts)) {
      tot += v.txSentSinceStart; okTot += v.successful;
      L.push(`| ${k} | \`${v.address}\` | ${v.txSentSinceStart} | ${v.successful} | ${v.failedOnChain} | ${v.operations} | ${stroops(BigInt(v.feeChargedStroops))} | ${v.first || '-'} | ${v.last || '-'} | ${v.xlm} |`);
    }
    L.push('', `Total transactions sent by the three addresses since the event start: ${tot} (${okTot} successful).`, '');
    for (const [k, v] of Object.entries(data.accounts)) {
      L.push(`Function tally for ${k}: ` + (Object.entries(v.tally).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} x${n}`).join(', ') || '(none)') + `; wasm uploads ${v.creates.upload}, create_contract ${v.creates.create}; op types ${JSON.stringify(v.byOpType)}`);
    }
    L.push('');
  }
  if (data.value) {
    const v = data.value;
    L.push('### Reflector prices used for USD values', '', `XLM ${j(v.prices.XLM)}  USDC ${j(v.prices.USDC)}  (decimals ${v.prices.decimals})`, '');
    L.push('### Market state (read-only simulations on each receipt vault; amounts in 7-decimal base units)', '', '| Group | Market | underlying | total_underlying | total_borrowed | available_liquidity | boosted vault | boosted cache age (s) | supplied USD |', '|---|---|---|---|---|---|---|---|---|');
    for (const m of v.markets) L.push(`| ${m.group} ${m.groupName} | \`${m.market}\` | \`${m.underlying}\` | ${m.totalUnderlying} | ${m.totalBorrowed} | ${m.availableLiquidity} | ${m.boostedVault ? '`' + m.boostedVault + '`' : '-'} | ${m.boostedCache ? m.boostedCache.ageSeconds + ' (health check needs <= 300)' : '-'} | ${m.usd.supplied === null ? '-' : m.usd.supplied.toFixed(4)} |`);
    L.push('', '### Partner positions held by our contracts', '', '| Position | Vault | Holder | Shares | Underlying (base units) | USD |', '|---|---|---|---|---|---|');
    for (const r of Object.values(v.vaults)) L.push(`| ${r.name} | \`${r.vault}\` | \`${r.holder}\` | ${r.shares ?? '-'} | ${r.error ? 'ERR ' + r.error : r.underlying} | ${r.usd === undefined ? '-' : r.usd.toFixed(4)} |`);
    L.push('', `Totals across our markets: supplied ${v.totals.suppliedUsd.toFixed(4)} USD, borrowed ${v.totals.borrowedUsd.toFixed(4)} USD, routed into partner protocols ${v.totals.routedToPartnersUsd.toFixed(4)} USD.`, '', `Group 2 reward distributor: ${j(v.rewards)}`, '');
  }
  if (data.config) {
    const c = data.config;
    L.push('### Market configuration as deployed (factory get_market_record)', '', '| Group | Market | CF (1e6) | reserve factor (1e6) | supply cap | borrow cap | idle buffer bps | rates (base/mult/jump/kink) | yield route | price |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const m of c.markets.filter((x) => x.cfg)) L.push(`| ${m.group} ${m.name} | \`${m.market}\` | ${m.cfg.collateral_factor} | ${m.cfg.reserve_factor} | ${m.cfg.supply_cap} | ${m.cfg.borrow_cap} | ${m.cfg.idle_buffer_bps} | ${m.cfg.rates.base}/${m.cfg.rates.multiplier}/${m.cfg.rates.jump}/${m.cfg.rates.kink} | ${j(m.cfg.yield_route)} | ${j(m.cfg.price)} |`);
    L.push('', 'Controller params: ' + c.markets.filter((x) => x.controllerParams).map((x) => `group ${x.group} ${j(x.controllerParams)}`).join('; '), '', `Margin group 1: ${j(c.margin)}`, '', `Blend fee vault instance storage (FeeModeKey.value is the take rate in 1e7 scale, 1000000 = 10%): ${j(c.feeVault)}`, '', `DeFindex Peridot XLM vault get_fees [vault_fee_bps, defindex_share_bps]: ${j(c.defindexFees)}`, '');
  }
  if (data.wallets) {
    L.push('### Wallet balances (Horizon)', '', '| Wallet | Address | Balances |', '|---|---|---|');
    for (const [k, w] of Object.entries(data.wallets)) L.push(`| ${k} | \`${w.address}\` | ${w.error ? w.error : w.balances.map((b) => `${b.balance} ${b.asset}`).join('; ')} |`);
    L.push('');
  }
  return L.join('\n');
}

const data = {};
if (want('as_of')) data.as_of = await sectionAsOf();
if (want('contracts')) data.contracts = await sectionContracts();
if (want('accounts')) data.accounts = await sectionAccounts();
if (want('value')) data.value = await sectionValue();
if (want('config')) data.config = await sectionConfig();
if (want('wallets')) data.wallets = await sectionWallets();
if (AS_JSON) console.log(JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
else console.log(toMd(data));
