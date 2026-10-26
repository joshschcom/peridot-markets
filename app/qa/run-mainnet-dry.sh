#!/usr/bin/env bash
# Part 2: mainnet SIMULATION ONLY. No secrets. The harness patches rpc.Server.sendTransaction to throw, and the signer refuses to sign.
set -euo pipefail
cd "$(dirname "$0")/.."
export QA_NETWORK=mainnet
export QA_MAINNET_RPC="${QA_MAINNET_RPC:-https://soroban-rpc.mainnet.stellar.gateway.fm}"
npx tsx qa/flows/50-mainnet.ts "$@"
npx tsx qa/make-report.ts
