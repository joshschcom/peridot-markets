import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://markets.peridot.finance';

/** Static routes only; dynamic group and token pages are discovered from the in-app lists. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/groups', '/groups/1', '/launch', '/launch-token', '/tokens', '/vaults', '/about'];
  return routes.map(path => ({ url: `${BASE}${path}`, changeFrequency: 'daily', priority: path === '' ? 1 : 0.7 }));
}
