#!/usr/bin/env bash
# Part 3: read-only production build against mainnet data on port 3055, Playwright sweep + number verification.
set -euo pipefail
cd "$(dirname "$0")/.."
export NEXT_PUBLIC_NETWORK=mainnet NEXT_PUBLIC_MAINNET_RPC_URL="${QA_MAINNET_RPC:-https://soroban-rpc.mainnet.stellar.gateway.fm}" NEXT_PUBLIC_READ_ONLY=true NEXT_PUBLIC_USE_MOCKS=false
npm run build
npx next start -p 3055 -H 127.0.0.1 > qa/out/next-start.log 2>&1 &
PID=$!; trap "kill $PID" EXIT; sleep 6
QA_BASE=http://127.0.0.1:3055 npx tsx qa/pages/check-pages.ts
QA_NETWORK=mainnet QA_BASE=http://127.0.0.1:3055 npx tsx qa/pages/verify-numbers.ts
git -C .. status --short -- . ':!qa' | head   # must stay empty: the build must not modify app source
