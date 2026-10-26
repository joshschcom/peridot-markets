import { NETWORK_URL_PARAM } from '@/lib/peridot/network-select';

/** Builds the shareable URL for the current page. Live networks get an explicit `?network=` so the
 * recipient lands on the same chain; demo mode shares the plain path. */
export function shareUrl(origin: string, pathname: string, networkName: string, useMocks: boolean): string {
  return useMocks ? `${origin}${pathname}` : `${origin}${pathname}?${NETWORK_URL_PARAM}=${networkName}`;
}
