/** Turn raw wallet, RPC and contract failures into one plain sentence.
 *
 * Idea adapted from PeridotV2Full 86ae3795 `lib/tx-errors.ts` (`friendlyTxError`) and
 * `lib/errorFormatter.ts`; the patterns are rewritten for Stellar: Soroban host diagnostics,
 * SAC error codes, Peridot core panic strings, Stellar Wallets Kit rejections and the app's own
 * transport messages. Unknown input falls back to the raw message (the toast shows it collapsed). */
import { xdr } from '@stellar/stellar-sdk';

export interface HumanizedTxError {
  /** Plain-language explanation. Equals `raw` when nothing matched. */
  text: string;
  /** Short category for styling and tests. `raw` when nothing matched. */
  kind: string;
  /** Original message, untouched. */
  raw: string;
}

export function rawMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || error.name;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') return (error as { message: string }).message;
  try { return JSON.stringify(error); } catch { return String(error); }
}

const RESULT_CODES: Record<string, { kind: string; text: string }> = {
  txTooLate: { kind: 'expired', text: 'The transaction expired before the network included it. Review the action and try again.' },
  txTooEarly: { kind: 'expired', text: 'The transaction time bounds have not started yet. Check your device clock and try again.' },
  txInsufficientBalance: { kind: 'fee-balance', text: 'Your account does not hold enough XLM to pay the network fee and keep its reserve.' },
  txInsufficientFee: { kind: 'fee', text: 'The network fee was too low for the current load. Try again in a few seconds.' },
  txBadSeq: { kind: 'sequence', text: 'Another transaction from this account was submitted first. Refresh and try again.' },
  txBadAuth: { kind: 'auth', text: 'The wallet signature did not match the account. Reconnect your wallet and try again.' },
  txBadAuthExtra: { kind: 'auth', text: 'The transaction carried an unexpected signature. Reconnect your wallet and try again.' },
  txNoAccount: { kind: 'account', text: 'This account does not exist on the selected network yet. Fund it with XLM first.' },
  txSorobanInvalid: { kind: 'footprint', text: 'The simulated resources no longer matched the network state. Try again in a few seconds.' },
  txFailed: { kind: 'failed', text: 'The transaction failed when the network applied it. Refresh balances and try again.' },
  txMalformed: { kind: 'malformed', text: 'The network rejected the transaction as malformed. Refresh the page and review the action again.' },
  txInternalError: { kind: 'network', text: 'The network reported an internal error. Try again in a moment.' },
};

/** Decode `Transaction rejected: <TransactionResult XDR>` from `lib/peridot/rpc.ts` into a result code name. */
export function decodeResultCode(message: string): string | null {
  const match = /Transaction rejected:\s*([A-Za-z0-9+/=]{16,})/.exec(message);
  if (!match) return null;
  try {
    // stellar-sdk 17 decodes unions to `{ type, value }`; older builds expose `result().switch().name`.
    const decoded = xdr.TransactionResult.fromXDR(match[1], 'base64') as unknown as { result: unknown };
    const result = (typeof decoded.result === 'function' ? (decoded.result as () => unknown)() : decoded.result) as { type?: unknown; switch?: unknown } | undefined;
    if (!result) return null;
    if (typeof result.type === 'string') return result.type;
    const code = typeof result.switch === 'function' ? (result.switch as () => { name?: string })() : (result.switch as { name?: string } | undefined);
    return code?.name ?? null;
  } catch { return null; }
}

interface Rule { kind: string; test: RegExp; text: string }
/* First match wins. Patterns target raw diagnostics; the app's own sentences pass through untouched. */
const RULES: Rule[] = [
  { kind: 'cancelled', test: /user (declined|rejected|denied|cancell?ed)|rejected by (the )?user|declined by (the )?user|action rejected|request rejected|user closed/i, text: 'You cancelled the request in your wallet. Nothing was submitted.' },
  { kind: 'popup', test: /pop-?up (was )?blocked|blocked (a |the )?pop-?up|window\.open|allow pop-?ups/i, text: 'Your browser blocked the wallet window. Allow pop-ups for this site and try again.' },
  { kind: 'supply-cap', test: /supply cap exceeded|supply cap/i, text: 'This supply would exceed the market supply cap. Supply a smaller amount or wait until the cap is raised.' },
  { kind: 'borrow-cap', test: /borrow cap exceeded|borrow cap/i, text: 'This borrow would exceed the market borrow cap. Borrow a smaller amount or wait until the cap is raised.' },
  { kind: 'paused', test: /(deposit|redeem|borrow|market|vault|withdraw|supply) paused|is paused|\bpaused\b/i, text: 'This market is paused by its owner. Try again once it is unpaused.' },
  { kind: 'stale-boosted', test: /boosted health cache (stale|unavailable)|boosted .*stale|stale .*boosted|refresh_boosted_underlying/i, text: 'The market yield-route cache is stale. Refresh the market first (Refresh button, then try again in the next ledger).' },
  { kind: 'footprint', test: /exceeded[_ ]limit|ExceededLimit|footprint|ResourceLimitExceeded|resource limit/i, text: 'The transaction footprint changed between simulation and submission. Try again in a few seconds.' },
  { kind: 'trustline', test: /trustline entry is missing|trustline (is )?missing|Error\(Contract, #13\)[^]*trustline/i, text: 'Your wallet has no trustline for this asset. Add the trustline in your wallet, then try again.' },
  { kind: 'balance', test: /balance is not sufficient|insufficient balance|insufficient funds|insufficient shares|insufficient ptokens|insufficient margin|amount exceeds your/i, text: 'Your balance is too low for this amount. Check your wallet and supplied balances, then try a smaller amount.' },
  { kind: 'collateral', test: /insufficient collateral|liquidity shortfall|\bshortfall\b|account liquidity|borrowing power/i, text: 'Your collateral does not cover this action. Supply more collateral or reduce the amount.' },
  { kind: 'liquidity', test: /not enough liquidity|insufficient liquidity|market has insufficient liquidity/i, text: 'The market does not have enough free liquidity right now. Try a smaller amount or wait for repayments.' },
  { kind: 'expired', test: /txTooLate|too late|expired|time ?bounds? (exceeded|passed)/i, text: 'The transaction expired before it was submitted. Review the action and try again.' },
  { kind: 'rate-limit', test: /\b429\b|too many requests|rate limit/i, text: 'The network RPC is busy. Wait a few seconds and try again.' },
  { kind: 'archived', test: /archived|restore(d)? (contract|entry|ledger)|must be restored/i, text: 'Archived contract data must be restored before this transaction. Try again later or ask the group owner to restore it.' },
  { kind: 'price', test: /stale price|price (is )?stale|price deviation|oracle (price )?(stale|unavailable)|deviation (band|too high)/i, text: 'A price feed is stale or deviates too much from the pool. Try again when the oracle has refreshed.' },
  { kind: 'not-entered', test: /market not entered|not entered/i, text: 'Enable this market first (a separate transaction), then try again.' },
  { kind: 'wallet-timeout', test: /wallet did not respond|timed out waiting|request timed out/i, text: 'The wallet did not respond in time. Close any old wallet window and try again.' },
];

export function describeTxError(error: unknown): HumanizedTxError {
  const raw = rawMessage(error);
  const code = decodeResultCode(raw);
  if (code && RESULT_CODES[code]) return { ...RESULT_CODES[code], raw };
  if (code) return { kind: 'rejected', text: `The network rejected the transaction (${code}). Check balances, limits and permissions, then try again.`, raw };
  for (const rule of RULES) if (rule.test.test(raw)) return { kind: rule.kind, text: rule.text, raw };
  return { kind: 'raw', text: raw, raw };
}

/** One readable sentence for a raw failure; the raw message itself when nothing matched. */
export function humanizeTxError(error: unknown): string {
  return describeTxError(error).text;
}

/** Heuristic: does this look like machine output (host diagnostics, XDR, JSON) rather than a sentence? */
export function looksRaw(message: string): boolean {
  return /HostError|Error\(|Diagnostic|Event log|[A-Za-z0-9+/]{40,}={0,2}|[{}[\]]|\bxdr\b|WasmVm|InvalidAction/i.test(message) || message.length > 220;
}
