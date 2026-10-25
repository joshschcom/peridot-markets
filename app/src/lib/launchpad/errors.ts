/** Human-readable messages for launchpad contract errors. Codes mirror `contracts/launchpad-curve/src/errors.rs`
 * and `contracts/launchpad-factory/src/errors.rs`. Errors are mapped by (contract role, code), because the same
 * number means different things on the curve, the factory and a Stellar Asset Contract. */

export type ContractRole = 'curve' | 'factory' | 'token';

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
};

const DIAGNOSTIC = /contract:(C[A-Z2-7]{55}), topics:\[error, Error\(Contract, #(\d+)\)\]/g;
const PLAIN = /Error\(Contract, #(\d+)\)/;

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : 'The request failed.';
}

/** Returns a readable message for a failed launchpad call. `roles` maps contract ids to what they are, so the
 * failing contract (the first entry of the newest-first diagnostic log) picks the right table. */
export function describeLaunchpadError(error: unknown, roles: Record<string, ContractRole>, fallbackRole?: ContractRole): string {
  const message = messageOf(error);
  if (/trustline entry is missing/.test(message)) return 'Your account has no trustline for this asset. Add it in your wallet, then try again.';
  const matches = [...message.matchAll(DIAGNOSTIC)];
  for (const [, contract, code] of matches) {
    const role = roles[contract];
    const described = describeCode(role, Number(code));
    if (described) return described;
  }
  const plain = message.match(PLAIN);
  if (plain && fallbackRole) {
    const described = describeCode(fallbackRole, Number(plain[1]));
    if (described) return described;
  }
  if (/insufficient balance|resulting balance is not within the allowed range|balance is not sufficient/i.test(message)) return 'Insufficient balance for this transaction.';
  return message;
}

function describeCode(role: ContractRole | undefined, code: number): string | null {
  if (role === 'curve') return CURVE_ERRORS[code] ?? null;
  if (role === 'factory') return FACTORY_ERRORS[code] ?? null;
  return null;
}
