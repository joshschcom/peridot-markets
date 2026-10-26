import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { StrKey } from '@stellar/stellar-sdk';
import { LAUNCHPAD_MAINNET, LAUNCHPAD_TESTNET, MAINNET_XLM, TESTNET_XLM, launchpadConfig, launchpadMode, modeFor, selectLaunchpadConfig } from './config';

const rootMainnet = JSON.parse(readFileSync(new URL('../../../../deployments/mainnet.json', import.meta.url), 'utf8'));
const appMainnet = JSON.parse(readFileSync(new URL('../peridot/deployments/mainnet.json', import.meta.url), 'utf8'));

test('selector follows the network name', () => {
  assert.equal(selectLaunchpadConfig('mainnet'), LAUNCHPAD_MAINNET);
  assert.equal(selectLaunchpadConfig('testnet'), LAUNCHPAD_TESTNET);
  assert.equal(LAUNCHPAD_MAINNET.network, 'mainnet');
  assert.equal(LAUNCHPAD_TESTNET.network, 'testnet');
  assert.notEqual(LAUNCHPAD_MAINNET.launchpad_factory, LAUNCHPAD_TESTNET.launchpad_factory);
  assert.notEqual(MAINNET_XLM, TESTNET_XLM);
});

test('the active config matches the module-load network, and mocks win over it', () => {
  assert.ok(['mainnet', 'testnet'].includes(launchpadConfig().network));
  assert.equal(modeFor(true), 'mock');
  assert.equal(modeFor(false), 'live');
  assert.ok(['mock', 'live'].includes(launchpadMode()));
});

test('every address in both configs is a valid contract id', () => {
  for (const c of [LAUNCHPAD_MAINNET, LAUNCHPAD_TESTNET]) {
    for (const v of [c.launchpad_factory, c.market_factory, c.aquarius_router, c.demo.first.token, c.demo.first.curve]) assert.ok(StrKey.isValidContract(v), v);
  }
  assert.ok(StrKey.isValidContract(MAINNET_XLM));
  assert.equal(MAINNET_XLM, rootMainnet.external.xlm);
});

test('mainnet config mirrors deployments/mainnet.json and the app snapshot', () => {
  assert.equal(LAUNCHPAD_MAINNET.launchpad_factory, rootMainnet.launchpad_factory);
  assert.equal(LAUNCHPAD_MAINNET.market_factory, rootMainnet.factory);
  assert.equal(LAUNCHPAD_MAINNET.aquarius_router, rootMainnet.external.aquarius_router);
  assert.equal(LAUNCHPAD_MAINNET.demo.first.token, rootMainnet.launchpad_demo.token);
  assert.equal(LAUNCHPAD_MAINNET.wasm.launchpad_factory, rootMainnet.wasm.launchpad_factory);
  assert.equal(LAUNCHPAD_MAINNET.wasm.launchpad_curve, rootMainnet.wasm.launchpad_curve);
  assert.equal(LAUNCHPAD_MAINNET.wasm.launchpad_token, rootMainnet.wasm.launchpad_token);
  assert.equal(appMainnet.factory, rootMainnet.factory);
  assert.equal(appMainnet.launchpad_factory, rootMainnet.launchpad_factory);
  for (const key of Object.keys(appMainnet.wasm)) assert.equal(appMainnet.wasm[key], rootMainnet.wasm[key], `wasm.${key}`);
});
