import type { NextConfig } from 'next';
if (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
  throw new Error('Production deployments cannot enable demo balances. Set NEXT_PUBLIC_USE_MOCKS=false.');
}
const nextConfig: NextConfig = { poweredByHeader: false, reactStrictMode: true };
export default nextConfig;
