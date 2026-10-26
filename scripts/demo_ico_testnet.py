#!/usr/bin/env python3
"""Real ICO smoke test, hardwired to Stellar TESTNET. No secret keys are read.
Run `python3 scripts/demo_ico_testnet.py launch`, then `... settle` after both deadlines.
Public results and tx hashes are saved via dep.py to deployments/testnet.json.
"""
import json
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEP = ROOT / 'deployments/testnet.json'
ADMIN = 'peridot-testnet-admin'
BUYERS = ['peridot-testnet-alice', 'peridot-testnet-owner']

def cli(args):
    result = subprocess.run(['stellar', *args], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    hashes = re.findall(r'/tx/([a-f0-9]{64})', result.stderr)
    return result.stdout.strip(), hashes[-1] if hashes else None

def record(key, value):
    subprocess.run(['python3', 'scripts/lib/dep.py', str(DEP), 'set', key, json.dumps(value)], cwd=ROOT, check=True)

def invoke(identity, contract, method, **args):
    argv = ['contract', 'invoke', '--network', 'testnet', '--source-account', identity, '--inclusion-fee', '10000', '--id', contract, '--', method]
    for key, value in args.items():
        argv += ['--' + key, json.dumps(value) if isinstance(value, dict) else str(value)]
    out, tx = cli(argv)
    print(method, tx or 'read-only', out, flush=True)
    return json.loads(out) if out else None, tx

def main():
    dep = json.loads(DEP.read_text())
    assert dep['network'] == 'testnet'
    factory = dep['launchpad_factory']
    creator, _ = cli(['keys', 'public-key', ADMIN])
    buyers = [cli(['keys', 'public-key', name])[0] for name in BUYERS]
    if sys.argv[1] == 'launch':
        for label, soft in [('success', 10), ('refund', 50)]:
            if dep.get('demo', {}).get('launchpad', {}).get('ico', {}).get(label):
                continue
            start = int(time.time()) + 60
            params = dict(quote_token=dep['external']['xlm'], supply='10000000000', price='10000000',
                          soft_cap=str(soft * 10_000_000), hard_cap='1000000000', start=start, end=start + 600, buyer_cap='600000000')
            pair, tx = invoke(ADMIN, factory, 'create_ico', creator=creator, name='ICO ' + label.title(),
                              symbol='ISUCC' if label == 'success' else 'IREF', metadata_uri='""', params=params)
            sale = dict(token=pair[0], ico=pair[1], creator=creator, params=params, buyers=buyers, txs=dict(create=tx))
            record('demo.launchpad.ico.' + label, sale)
        dep = json.loads(DEP.read_text())
        for label in ['success', 'refund']:
            sale = dep['demo']['launchpad']['ico'][label]
            while time.time() < sale['params']['start'] + 5:
                time.sleep(min(5, sale['params']['start'] + 5 - time.time()))
            for n, identity in enumerate(BUYERS):
                if sale['txs'].get(f'buy_{n+1}'):
                    continue
                _, tx = invoke(identity, sale['ico'], 'buy', user=buyers[n], amount='100000000')
                record(f'demo.launchpad.ico.{label}.txs.buy_{n+1}', tx)
        print('Both sales funded. Run settle after', max(x['params']['end'] for x in dep['demo']['launchpad']['ico'].values() if isinstance(x, dict) and 'params' in x), flush=True)
    elif sys.argv[1] == 'settle':
        for label in ['success', 'refund']:
            sale = dep['demo']['launchpad']['ico'][label]
            if time.time() < sale['params']['end'] + 5:
                raise RuntimeError('Sale deadline has not passed yet')
            phase, tx = invoke(ADMIN, sale['ico'], 'finalize')
            assert phase == (1 if label == 'success' else 2), phase
            record(f'demo.launchpad.ico.{label}.txs.finalize', tx)
            for n, identity in enumerate(BUYERS):
                action = 'claim' if label == 'success' else 'refund'
                amount, tx = invoke(identity, sale['ico'], action, user=buyers[n])
                assert int(amount) == 100000000
                record(f'demo.launchpad.ico.{label}.txs.{action}_{n+1}', tx)
            payout, tx = invoke(ADMIN, sale['ico'], 'withdraw', creator=creator)
            assert list(map(int, payout)) == ([200000000, 9800000000] if label == 'success' else [0, 10000000000])
            record(f'demo.launchpad.ico.{label}.txs.withdraw', tx)
            balance, _ = invoke(ADMIN, dep['external']['xlm'], 'balance', id=sale['ico'])
            assert int(balance) == 0
            record(f'demo.launchpad.ico.{label}.verified_empty_quote_escrow', True)
    else:
        raise RuntimeError('Expected launch or settle')

if __name__ == '__main__':
    main()
