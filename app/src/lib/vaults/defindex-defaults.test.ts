import test from 'node:test';
import assert from 'node:assert/strict';
import { StrKey } from '@stellar/stellar-sdk';
import { DEFINDEX_DEFAULTS, DEFINDEX_SYMBOLS, defaultDefindexVault, defaultDefindexVaultBySymbol, defindexUnavailableReason } from './defindex-defaults';
import mainnet from '@/lib/peridot/deployments/mainnet.json';

const XLM = 'CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA';

test('mainnet has exactly one valid vault per supported token, each with a source note', () => {
  const list = DEFINDEX_DEFAULTS.mainnet;
  assert.deepEqual(list.map(d => d.symbol), DEFINDEX_SYMBOLS);
  for (const d of list) {
    assert.ok(StrKey.isValidContract(d.vault), d.vault);
    assert.ok(StrKey.isValidContract(d.token), d.token);
    assert.match(d.source, /addresses\.md/);
  }
  assert.equal(new Set(list.map(d => d.vault)).size, list.length);
  assert.equal(new Set(list.map(d => d.token)).size, list.length);
});

test('the XLM default matches the deployment manifest', () => {
  const manifest = (mainnet as { external: { defindex_vaults: Record<string, string>; xlm: string; usdc: string } }).external;
  assert.equal(defaultDefindexVault('mainnet', XLM)?.vault, manifest.defindex_vaults.XLM);
  assert.equal(defaultDefindexVault('mainnet', manifest.xlm)?.symbol, 'XLM');
  assert.equal(defaultDefindexVault('mainnet', manifest.usdc)?.symbol, 'USDC');
});

test('lookups by token and by symbol agree; unknown tokens and testnet are refused with a reason', () => {
  assert.equal(defaultDefindexVaultBySymbol('mainnet', 'usdc')?.vault, defaultDefindexVault('mainnet', 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75')?.vault);
  assert.equal(defaultDefindexVault('mainnet', 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR'), undefined);
  assert.equal(defindexUnavailableReason('mainnet', XLM), null);
  assert.match(defindexUnavailableReason('mainnet', 'CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR', 'PDEMO') ?? '', /PDEMO has no Peridot DeFindex vault/);
  assert.match(defindexUnavailableReason('mainnet', '') ?? '', /Verify a token first/);
  assert.match(defindexUnavailableReason('testnet', XLM) ?? '', /mainnet only/);
  assert.equal(DEFINDEX_DEFAULTS.testnet.length, 0);
});
