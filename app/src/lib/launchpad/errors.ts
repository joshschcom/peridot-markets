/** Human-readable messages for launchpad contract errors. Codes mirror `contracts/launchpad-curve/src/errors.rs`
 * and `contracts/launchpad-factory/src/errors.rs`. Errors are mapped by (contract role, code), because the same
 * number means different things on the curve, the factory, a Stellar Asset Contract and the OpenZeppelin token.
 *
 * The host prints its diagnostic log newest first. When a nested call fails, every outer frame re-emits the same
 * code while escalating, so the OUTER contract appears first and the frame that actually failed appears LAST
 * (verified against a testnet simulation of `launch_curve` with an over-cap creator buy: factory, factory, then
 * the curve as a "Failed Diagnostic Event"). The mapper therefore reads the innermost frame only. */

export type ContractRole = 'curve' | 'factory' | 'sac' | 'token' | 'ico';

const ICO_ERRORS: Record<number, string> = {
  101: 'Check the supply, price, caps and sale dates. Duration must be 10 minutes to 30 days.',
  102: 'The ICO does not hold its full token supply.', 103: 'Only the ICO admin may do this.',
  104: 'New purchases are paused. Claims and refunds remain available.',
  105: 'This sale has not started yet.', 106: 'This sale is closed.', 107: 'Enter an amount above zero.',
  108: 'This purchase exceeds the remaining hard cap. Lower the amount.', 109: 'This purchase exceeds your remaining wallet cap.',
  110: 'This amount is too small to buy a token base unit.', 111: 'Wait until the sale ends.',
  112: 'This sale did not succeed. Request a refund instead.', 113: 'This sale succeeded. Claim your tokens instead.',
  114: 'You have no contribution to claim or refund.', 115: 'You already claimed your tokens.',
  116: 'You already received your refund.', 117: 'Only the creator may withdraw the proceeds.',
  118: 'The creator already withdrew.', 119: 'Upgrades are permanently locked after the first purchase.',
};
const CURVE_ERRORS: Record<number, string> = {
  1: 'A curve parameter must be positive.',
  2: 'A curve parameter is too large.',
  3: 'The curve supply must stay below the virtual token reserve.',
  4: 'The trade fee exceeds the 5% ceiling.',
  5: 'The creator fee share exceeds 50%.',
  6: 'The creator cap exceeds 20% of the curve supply.',
  7: 'The graduation target would sell more than the curve supply.',
  8: 'Token and quote token cannot be the same.',
  9: 'The curve does not hold its full token supply.',
  10: 'Enter an amount above zero.',
  11: 'The minimum output must be above zero.',
  12: 'The price moved past your slippage setting. Refresh the quote and try again.',
  13: 'Trading is closed for this token.',
  14: 'This trade is too small and would round to zero. Enter a larger amount.',
  15: 'This buy would exceed the creator cap, a fixed share of the curve supply.',
  16: 'You cannot sell more tokens than the curve has sold.',
  17: 'Arithmetic overflow.',
  18: 'Only the launch factory may call this.',
  19: 'The graduation target has not been reached yet.',
  21: 'Graduation is already complete.',
  22: 'An Aquarius pool for this pair already holds liquidity at another ratio, so the curve cannot seed it. Graduation stays blocked until the factory admin upgrades the curve.',
  23: 'The pool returned no LP shares to lock.',
  24: 'Only the creator can claim the group.',
  25: 'Graduation is not complete yet.',
  26: 'The group was already claimed.',
};

const FACTORY_ERRORS: Record<number, string> = {
  1: 'Only the factory admin may call this.',
  2: 'The factory has no launch Wasm registered yet.',
  3: 'Launches are paused right now.',
  4: 'No preset is configured for this quote token and speed.',
  5: 'Name must be 1 to 32 characters: letters, digits, spaces, dots, hyphens or underscores, with no outer spaces.',
  6: 'Symbol must be 2 to 12 letters or digits.',
  7: 'The image URI is longer than 256 bytes.',
  8: 'A creator buy needs a positive minimum token output.',
  9: 'This creator has reached the limit of 100 launches.',
  10: 'This token was not launched through the Peridot launchpad.',
  11: 'The preset failed the curve guardrails.',
  12: 'Invalid launch fee.',
  13: 'Arithmetic overflow.',
  14: 'Graduation targets are not configured on the factory.',
  15: 'No quote price is configured for this quote token.',
  16: 'The quote price must be a Reflector mapping.',
  18: 'Check the ICO supply, price, caps and dates. Duration must be 10 minutes to 30 days.',
  17: 'Supply must be a whole number between 1 and 1,000,000,000,000 tokens.',
};

/** Stellar Asset Contract (XLM, AQUA) errors that a trade or graduation step can surface. */
const SAC_ERRORS: Record<number, string> = {
  8: 'Amounts must be positive.',
  10: 'Insufficient balance for this transfer.',
  11: 'Your trustline for this asset is not authorized.',
  13: 'Your account has no trustline for this asset. Add it in your wallet, then try again.',
};
/** OpenZeppelin fungible token (the launch token) errors. */
const TOKEN_ERRORS: Record<number, string> = {
  100: 'You do not hold enough of this token.',
  101: 'Insufficient token allowance.',
};

const DIAGNOSTIC = /contract:(C[A-Z2-7]{55}), topics:\[error, Error\(Contract, #(\d+)\)\]/g;
const PLAIN = /Error\(Contract, #(\d+)\)/;

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : 'The request failed.';
}

export interface DescribeOptions {
  /** Role to assume when the message carries a bare `Error(Contract, #N)` without a contract id. */
  fallbackRole?: ContractRole;
  /** Role to assume for an innermost contract that is not in `roles`: `launch_curve` fails inside a curve whose
   * address does not exist before the call. */
  innerFallback?: ContractRole;
}

/** Returns a readable message for a failed launchpad call. `roles` maps contract ids to what they are; the
 * innermost failing frame (last entry of the newest-first diagnostic log) picks the table. An innermost contract
 * with no known role returns the raw message rather than a guess from an outer frame. */
export function describeLaunchpadError(error: unknown, roles: Record<string, ContractRole>, options: DescribeOptions = {}): string {
  const message = messageOf(error);
  if (/trustline entry is missing/.test(message)) return SAC_ERRORS[13];
  const matches = [...message.matchAll(DIAGNOSTIC)];
  if (matches.length > 0) {
    const [, contract, code] = matches[matches.length - 1];
    const role = roles[contract] ?? options.innerFallback;
    return describeCode(role, Number(code)) ?? message;
  }
  const plain = message.match(PLAIN);
  if (plain && options.fallbackRole) {
    const described = describeCode(options.fallbackRole, Number(plain[1]));
    if (described) return described;
  }
  if (/insufficient balance|resulting balance is not within the allowed range|balance is not sufficient/i.test(message)) return 'Insufficient balance for this transaction.';
  return message;
}

function describeCode(role: ContractRole | undefined, code: number): string | null {
  if (role === 'ico') return ICO_ERRORS[code] ?? null;
  if (role === 'curve') return CURVE_ERRORS[code] ?? null;
  if (role === 'factory') return FACTORY_ERRORS[code] ?? null;
  if (role === 'sac') return SAC_ERRORS[code] ?? null;
  if (role === 'token') return TOKEN_ERRORS[code] ?? null;
  return null;
}
