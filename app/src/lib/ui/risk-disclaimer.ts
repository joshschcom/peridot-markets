/** Persistence rules for the one-time risk disclaimer.
 *
 * Adapted from PeridotV2Full 86ae3795 `components/RiskDisclaimerModal.tsx` (its localStorage flag
 * `peridot-risk-disclaimer-acknowledged` = 'true'). Changes: the stored value is the disclaimer
 * version, so editing the text re-shows the dialog; storage access is injected for unit tests. */

export const DISCLAIMER_KEY = 'peridot:risk-ack';
/** Bump when the disclaimer text changes materially; every visitor then sees it again. */
export const DISCLAIMER_VERSION = '2026-10-26';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** True when this browser already acknowledged exactly this version. Any storage failure counts as not acknowledged. */
export function hasAcknowledged(storage: KeyValueStorage | null | undefined, version: string = DISCLAIMER_VERSION): boolean {
  if (!storage) return false;
  try { return storage.getItem(DISCLAIMER_KEY) === version; }
  catch { return false; }
}

/** Persist the acknowledgement. Returns false when storage is unavailable (the dialog still closes for this page view). */
export function acknowledge(storage: KeyValueStorage | null | undefined, version: string = DISCLAIMER_VERSION): boolean {
  if (!storage) return false;
  try { storage.setItem(DISCLAIMER_KEY, version); return true; }
  catch { return false; }
}

/** Script for test setups (Playwright `page.addInitScript`) that pre-accepts the current disclaimer version. */
export const disclaimerPreAcceptScript = `try{localStorage.setItem('${DISCLAIMER_KEY}','${DISCLAIMER_VERSION}')}catch(e){}`;
