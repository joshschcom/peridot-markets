/** Generic, schema-driven validation and encoding shared by every vault kind. */
import { StrKey, nativeToScVal, Address, type xdr } from '@stellar/stellar-sdk';
import type { FieldSpec, Validation, Values, VaultCtx, VaultKind } from './types';

export function defaultValues(kind: VaultKind, ctx: VaultCtx): Values {
  const out: Values = {};
  for (const f of kind.fields) out[f.key] = typeof f.default === 'function' ? f.default(ctx) : f.default;
  return out;
}

const DEC = /^\d+(\.\d+)?$/;
/** Parses a decimal string into a scaled bigint without floating point. Returns null when malformed or too precise. */
export function parseScaled(text: string, decimals: number): bigint | null {
  const t = text.trim();
  if (!DEC.test(t)) return null;
  const [whole, frac = ''] = t.split('.');
  if (frac.length > decimals) return null;
  return BigInt(whole + frac.padEnd(decimals, '0'));
}

/** Number of decimals a `scale` of 10^k implies, or null when scale is not a power of ten (e.g. 60 minutes). */
function scaleDecimals(scale: number): number | null {
  const k = Math.round(Math.log10(scale));
  return 10 ** k === scale ? k : null;
}

export function rawNumber(f: FieldSpec, text: string, ctx: VaultCtx): bigint | null {
  if (f.input === 'amount') return parseScaled(text, ctx.decimals);
  const scale = f.scale ?? 1;
  const dec = scaleDecimals(scale);
  if (dec !== null) return parseScaled(text, dec);
  // Non power-of-ten scale (minutes to seconds): integers or finite decimals that multiply to a whole number.
  const n = Number(text);
  if (!DEC.test(text.trim()) || !Number.isFinite(n)) return null;
  const raw = n * scale;
  return Math.abs(raw - Math.round(raw)) < 1e-9 ? BigInt(Math.round(raw)) : null;
}

export function validateField(f: FieldSpec, text: string, ctx: VaultCtx): string | null {
  const v = (text ?? '').trim();
  if (!v) return f.required === false ? null : `${f.label} is required.`;
  switch (f.input) {
    case 'address':
      return StrKey.isValidContract(v) || StrKey.isValidEd25519PublicKey(v) ? null : `${f.label} must be a Stellar address (G... or C...).`;
    case 'select':
      return f.options?.some(o => o.value === v) ? null : `Choose one of the listed ${f.label.toLowerCase()} options.`;
    case 'toggle':
      return v === 'true' || v === 'false' ? null : 'Choose on or off.';
    case 'text':
      return null;
    default: {
      const raw = rawNumber(f, v, ctx);
      if (raw === null) return `${f.label} must be a number${f.input === 'amount' ? ` with at most ${ctx.decimals} decimals` : ''}.`;
      if (f.input === 'number' && f.step !== undefined && f.step >= 1 && Number(v) % 1 !== 0) return `${f.label} must be a whole number.`;
      const n = Number(v);
      if (f.min !== undefined && n < f.min) return `${f.label} must be at least ${f.min}${f.unit ? ' ' + f.unit : ''}.`;
      if (f.max !== undefined && n > f.max) return `${f.label} must be at most ${f.max}${f.unit ? ' ' + f.unit : ''}.`;
      return null;
    }
  }
}

export function validateKind(kind: VaultKind, values: Values, ctx: VaultCtx): Validation {
  const errors: Record<string, string> = {};
  for (const f of kind.fields) {
    const e = validateField(f, values[f.key] ?? '', ctx);
    if (e) errors[f.key] = e;
  }
  const extra = Object.keys(errors).length === 0 && kind.validate ? kind.validate(values, ctx) : { errors: {}, warnings: [] };
  return { errors: { ...extra.errors, ...errors }, warnings: extra.warnings };
}

export function encodeField(f: FieldSpec, text: string, ctx: VaultCtx): xdr.ScVal {
  const v = text.trim();
  switch (f.encoding) {
    case 'address': return new Address(v).toScVal();
    case 'bool': return nativeToScVal(v === 'true', { type: 'bool' });
    case 'symbol': return nativeToScVal(v, { type: 'symbol' });
    case 'u32': return nativeToScVal(Number(f.input === 'select' ? v : rawNumber(f, v, ctx)), { type: 'u32' });
    case 'u64': return nativeToScVal(f.input === 'select' ? BigInt(v) : rawNumber(f, v, ctx)!, { type: 'u64' });
    case 'i128': return nativeToScVal(rawNumber(f, v, ctx)!, { type: 'i128' });
  }
}

/** Encodes every field in schema order. The owner must be the first schema field with `suggest: 'owner'` or be prepended by the kind. */
export function encodeFields(kind: VaultKind, values: Values, ctx: VaultCtx): xdr.ScVal[] {
  return kind.fields.map(f => encodeField(f, values[f.key], ctx));
}

export function isValid(v: Validation): boolean { return Object.keys(v.errors).length === 0; }

/** Fixed-point display of a raw amount. */
export function formatScaled(raw: bigint, decimals: number): string {
  const neg = raw < 0n; const s = (neg ? -raw : raw).toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, s.length - decimals), frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}
