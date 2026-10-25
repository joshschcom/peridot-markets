import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e', timeout:90_000, workers:1,
  use:{baseURL:'http://127.0.0.1:3020',trace:'retain-on-failure'},
  webServer:{command:'NEXT_PUBLIC_USE_MOCKS=true npm run dev -- --port 3020 --hostname 127.0.0.1',url:'http://127.0.0.1:3020',reuseExistingServer:!process.env.CI,timeout:120_000},
});
