import type { UnitSystem } from './types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const weightUnit = (u: UnitSystem) => (u === 'metric' ? 'kg' : 'lb');
export const lengthUnit = (u: UnitSystem) => (u === 'metric' ? 'cm' : 'in');

/** kg → display unit */
export function toDisplayWeight(kg: number, u: UnitSystem): number {
  return u === 'metric' ? kg : kg / KG_PER_LB;
}
/** display unit → kg */
export function fromDisplayWeight(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : v * KG_PER_LB;
}
export function toDisplayLength(cm: number, u: UnitSystem): number {
  return u === 'metric' ? cm : cm / CM_PER_IN;
}
export function fromDisplayLength(v: number, u: UnitSystem): number {
  return u === 'metric' ? v : v * CM_PER_IN;
}

/** Round to at most `dp` decimals and drop trailing zeros. */
export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function fmtNumber(n: number, dp = 1): string {
  const r = round(n, dp);
  return r.toLocaleString('en-GB', { maximumFractionDigits: dp });
}

export function fmtWeight(kg: number, u: UnitSystem, withUnit = true): string {
  const v = fmtNumber(toDisplayWeight(kg, u), 1);
  return withUnit ? `${v} ${weightUnit(u)}` : v;
}

/**
 * Parse a user-typed decimal. Accepts comma decimals (European keyboards).
 * Returns null for empty / invalid / negative input.
 */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
