import { defineConfig } from '@playwright/test';
// E2E_PORT lets several worktrees run the suite side by side; default stays 3020.
const port = process.env.E2E_PORT || '3020';
export default defineConfig({
  testDir:'./tests/e2e', timeout:240_000, workers:1,
  // Cold Next.js routes can compile while Rust/build checks run in another worktree.
  expect:{timeout:90_000},
  use:{baseURL:`http://127.0.0.1:${port}`,trace:'retain-on-failure'},
  webServer:{command:`NEXT_DIST_DIR=.next-e2e NEXT_PUBLIC_USE_MOCKS=true NEXT_PUBLIC_READ_ONLY=false npm run dev -- --port ${port} --hostname 127.0.0.1`,url:`http://127.0.0.1:${port}`,reuseExistingServer:!process.env.CI,timeout:360_000},
});
