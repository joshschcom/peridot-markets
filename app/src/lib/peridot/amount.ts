/** Exact conversion. User amounts never pass through floating point. */
export function parseAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token decimals.');
  const clean = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(clean)) throw new Error('Enter a nonnegative decimal amount.');
  const [whole, fraction = ''] = clean.split('.');
  if (fraction.length > decimals) throw new Error(`This token supports ${decimals} decimal places.`);
  const result = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (result > (1n << 127n) - 1n) throw new Error('Amount is too large.');
  return result;
}
export function formatAmount(value: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('Unsupported token decimals.');
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const scale = 10n ** BigInt(decimals);
  const fraction = (abs % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${sign}${abs / scale}${fraction ? `.${fraction}` : ''}`;
}
