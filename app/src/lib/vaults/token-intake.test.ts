import test from 'node:test';
import assert from 'node:assert/strict';
import { Asset, Networks } from '@stellar/stellar-sdk';
import { NotATokenError, decidePricing, formatSupply, parseTokenInput, readTokenInfo, registryTokens, searchTokens } from './token-intake';
import { demoPools, MIN_DEPTH_USD } from './aquarius-pools';

const USDC = 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75';
const ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

test('parse: contract ids, bad checksums, account addresses and junk', () => {
  assert.deepEqual(parseTokenInput(` ${USDC} `, Networks.PUBLIC), { kind: 'contract', address: USDC });
  const bad = USDC.slice(0, -1) + (USDC.endsWith('5') ? '4' : '5');
  assert.equal(parseTokenInput(bad, Networks.PUBLIC).kind, 'invalid');
  assert.match((parseTokenInput(ISSUER, Networks.PUBLIC) as { reason: string }).reason, /account address/);
  assert.equal(parseTokenInput('', Networks.PUBLIC).kind, 'invalid');
  assert.equal(parseTokenInput('hello', Networks.PUBLIC).kind, 'invalid');
});

test('parse: CODE:ISSUER resolves to the same SAC id as the SDK and differs per network', () => {
  const p = parseTokenInput(`USDC:${ISSUER}`, Networks.PUBLIC);
  assert.equal(p.kind, 'classic');
  assert.equal((p as { address: string }).address, USDC, 'Circle USDC on mainnet');
  assert.equal((p as { address: string }).address, new Asset('USDC', ISSUER).contractId(Networks.PUBLIC));
  assert.notEqual((parseTokenInput(`USDC:${ISSUER}`, Networks.TESTNET) as { address: string }).address, USDC);
  assert.equal(parseTokenInput('native', Networks.PUBLIC).kind, 'classic');
  assert.equal(parseTokenInput('TOOLONGCODE123:' + ISSUER, Networks.PUBLIC).kind, 'invalid');
  assert.equal(parseTokenInput('USDC:GBADISSUER', Networks.PUBLIC).kind, 'invalid');
});

test('readTokenInfo reads SEP-41 fields and treats name and total_supply as optional', async () => {
  const read = async (_c: string, m: string) => ({ symbol: 'TKN', decimals: 7, name: 'Token', total_supply: 12_3450000n } as Record<string, unknown>)[m];
  assert.deepEqual(await readTokenInfo(read, USDC, 'mainnet'), { address: USDC, name: 'Token', symbol: 'TKN', decimals: 7, totalSupply: 12_3450000n });
  const sac = async (_c: string, m: string) => { if (m === 'symbol') return 'USDC'; if (m === 'decimals') return 7; throw new Error('no such function'); };
  const info = await readTokenInfo(sac, USDC, 'mainnet');
  assert.equal(info.name, null);
  assert.equal(info.totalSupply, null);
});

test('readTokenInfo rejects non token contracts and absurd decimals', async () => {
  await assert.rejects(readTokenInfo(async () => { throw new Error('missing function'); }, USDC, 'mainnet'), NotATokenError);
  await assert.rejects(readTokenInfo(async (_c, m) => (m === 'symbol' ? 'X' : 99), USDC, 'testnet'), /not a Soroban token contract/);
  await assert.rejects(readTokenInfo(async (_c, m) => (m === 'symbol' ? '' : 7), USDC, 'testnet'), NotATokenError);
});

test('formatSupply', () => {
  assert.equal(formatSupply(null, 7), 'Not reported by this token');
  assert.equal(formatSupply(10_000_000_000_000n, 7), '1,000,000');
  assert.equal(formatSupply(12_3456789n, 7), '12.3456');
  assert.equal(formatSupply(5n, 0), '5');
});

test('pricing: an approved Reflector mapping can be submitted', () => {
  const d = decidePricing({ reflectorApproved: true, pool: null, symbol: 'XLM' });
  assert.equal(d.canSubmit, true);
  assert.equal(d.mode, 'reflector');
});

test('pricing: no Reflector feed blocks the market, with or without a deep pool, and says why', () => {
  const none = decidePricing({ reflectorApproved: false, pool: null, symbol: 'FOO' });
  assert.equal(none.canSubmit, false);
  assert.match(none.lines.join(' '), /No Aquarius pool pairs it with USDC/);
  const deep = decidePricing({ reflectorApproved: false, pool: { address: 'CP', depthUsd: 12_000 }, symbol: 'FOO' });
  assert.equal(deep.canSubmit, false, 'AquariusOnly is launchpad-only in the factory, so a deep pool still cannot be submitted');
  assert.equal(deep.aquariusDepthOk, true);
  assert.match(deep.lines.join(' '), /launchpad/);
  assert.match(deep.lines.join(' '), new RegExp(`\\$${MIN_DEPTH_USD} per side`));
  const shallow = decidePricing({ reflectorApproved: false, pool: { address: 'CP', depthUsd: 200 }, symbol: 'FOO' });
  assert.equal(shallow.aquariusDepthOk, false);
  assert.match(shallow.lines.join(' '), /below the router/);
  assert.equal(decidePricing({ reflectorApproved: false, pool: { address: 'CP', depthUsd: null }, symbol: 'FOO' }).aquariusDepthOk, null);
});

test('registry tokens are unique, ranked by pool count and searchable', () => {
  const tokens = registryTokens('mainnet', demoPools('mainnet'));
  assert.equal(tokens[0].token.symbol, 'USDC');
  assert.equal(new Set(tokens.map(t => t.token.address)).size, tokens.length);
  assert.ok(tokens.some(t => t.token.symbol === 'EURC'));
  assert.deepEqual(searchTokens(tokens, 'eur').map(t => t.token.symbol), ['EURC']);
  assert.equal(searchTokens(tokens, '', 3).length, 3);
  assert.equal(searchTokens(tokens, 'zzz-none').length, 0);
});
