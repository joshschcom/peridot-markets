# Peridot Markets frontend

Next.js frontend for factory-created Stellar lending groups. The dashboard base was imported as prior work in `6c671e0`; see [provenance](../docs/PRIOR_WORK.md).

Use Node.js 22.12 or newer. Run `npm ci`, then `NEXT_PUBLIC_USE_MOCKS=true npm run dev` for the explicitly labelled local demo. The demo stores state in browser storage and does not sign transactions.

Mainnet is the default. Copy `.env.example` to `.env.local`, set a browser-safe RPC URL, and use `NEXT_PUBLIC_NETWORK=testnet` for testnet. Live operation requires a verified deployment manifest in `src/lib/peridot/deployments/`. Production Vercel builds reject mock mode. No wallet secret belongs in this app.

Routes: `/launch`, `/groups`, `/groups/[id]`, `/groups/[id]/control`, `/about`.

Validation: `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`. Install Chromium with `npx playwright install chromium` before browser tests. Browser tests use explicit mock mode and do not establish fresh Freighter or mainnet acceptance.

Vercel root directory is `app/`. The app bundles a generated snapshot of canonical interface types. `prebuild` refreshes it when the contracts source is present; CI rejects stale snapshots. This makes the app directory independently deployable. The live URL and phase evidence belong in the [repository README](../README.md) and [demo record](../docs/DEMO.md).
