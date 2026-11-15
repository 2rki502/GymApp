/**
 * Food lookup: barcodes and QR codes, Open Food Facts products, built-in common foods,
 * serving maths and search. Pure functions only (no network, React or storage).
 */
import type { Intake } from './nutrition';

export type FoodUnit = 'g' | 'ml';
export type MacroKey = 'protein' | 'carbs' | 'fat';

/** A serving the user can pick: an amount in the food's unit (g or ml), with an optional printed label. */
export interface Serving {
  /** a known serving word ("cup", "medium"…), or 'label' / 'package' for a product's own serving */
  key: string;
  amount: number;
  label?: string;
}

/** A common food bundled with the app (see data/foods.ts). */
export interface BuiltInFood {
  id: string;
  /** USDA FoodData Central id, for traceability */
  fdcId: number;
  name: string;
  nameAr: string;
  /** extra search words, both languages */
  words: string;
  unit: FoodUnit;
  per100: Intake;
  servings: Serving[];
}

/** Anything that can be logged: a built-in food, a database product, or a recent entry. */
export interface FoodItem {
  source: 'builtin' | 'off' | 'recent';
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  unit: FoodUnit;
  /** null = the source has no usable nutrition: the user must enter it */
  per100: Intake | null;
  /** macros the source didn't provide (shown as 0, flagged for checking) */
  missing: MacroKey[];
  servings: Serving[];
  image?: string;
  /** a manually entered recent food: only whole portions make sense (no per-100 data) */
  portionOnly?: boolean;
}

// ── Codes ──────────────────────────────────────────────────────────────────

export type CodeResult = { ok: true; gtin: string } | { ok: false; reason: 'empty' | 'format' | 'checksum' | 'notProduct' };

/** GS1 check digit (EAN-8, UPC-A, EAN-13, GTIN-14 all use it). */
function checkDigitOk(code: string): boolean {
  const ds = code.split('').map(Number);
  const check = ds.pop()!;
  let sum = 0;
  ds.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E (8 digits, the short code on small packs) → the full 12-digit UPC-A. */
function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const [d1, d2, d3, d4, d5, d6] = code.slice(1, 7);
  const check = code[7];
  let body: string;
  if ('012'.includes(d6)) body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  const upcA = `${ns}${body}${check}`;
  return checkDigitOk(upcA) ? upcA : null;
}

/** A GTIN-14 with a leading 0 is the same product as its 13-digit form (what databases use). */
const shorten = (gtin: string) => (gtin.length === 14 && gtin.startsWith('0') ? gtin.slice(1) : gtin);

function fromDigits(d: string): CodeResult {
  if (d.length === 8) {
    const upcA = expandUpcE(d);
    if (upcA) return { ok: true, gtin: upcA };
    return checkDigitOk(d) ? { ok: true, gtin: d } : { ok: false, reason: 'checksum' };
  }
  if (d.length === 12 || d.length === 13 || d.length === 14) {
    return checkDigitOk(d) ? { ok: true, gtin: shorten(d) } : { ok: false, reason: 'checksum' };
  }
  return { ok: false, reason: 'format' };
}

/**
 * Turn whatever was scanned or typed into a product number (GTIN), or say why not.
 * Accepts retail barcodes (EAN-13/8, UPC-A/E), GS1 Digital Link QR codes
 * (https://…/01/<GTIN>…) and GS1 element strings ("(01)<GTIN>…").
 */
export function parseScannedCode(raw: string): CodeResult {
  const s = raw.trim();
  if (!s) return { ok: false, reason: 'empty' };
  if (/^\d+$/.test(s)) return fromDigits(s);
  // GS1 Digital Link: any domain, the product number follows the "01" key in the path.
  const link = /\/01\/(\d{8}|\d{12,14})(?:[/?#]|$)/.exec(s);
  if (link) return fromDigits(link[1]);
  // GS1 element string, human-readable or raw (as in GS1 QR / DataMatrix).
  const element = /^\(01\)(\d{14})/.exec(s) ?? /^\u001d?01(\d{14})/.exec(s);
  if (element) return fromDigits(element[1]);
  return { ok: false, reason: 'notProduct' };
}

/** Databases store UPCs as 12 or 13 digits ("0" prefixed): try both. */
export function lookupCodes(gtin: string): string[] {
  if (gtin.length === 12) return [gtin, `0${gtin}`];
  if (gtin.length === 13 && gtin.startsWith('0')) return [gtin, gtin.slice(1)];
  return [gtin];
}

// ── Open Food Facts ────────────────────────────────────────────────────────

/** The fields requested from Open Food Facts (keeps responses small). */
export const OFF_FIELDS = [
  'code', 'product_name', 'product_name_en', 'product_name_ar', 'generic_name', 'brands', 'quantity',
  'product_quantity', 'product_quantity_unit', 'serving_size', 'serving_quantity', 'nutriments', 'image_front_small_url',
].join(',');

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const LIQUID = /\b\d*[.,]?\d*\s*(ml|cl|dl|l|litre|liter|fl\.?\s?oz)\b/i;

/** Convert a raw Open Food Facts product into a loggable item, refusing to guess missing nutrition. */
export function fromOpenFoodFacts(p: Record<string, unknown>, lang: 'en' | 'ar'): FoodItem {
  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const code = str(p.code);
  const brand = str(p.brands).split(',')[0]?.trim() || undefined;
  const name = str(p[`product_name_${lang}`]) || str(p.product_name) || str(p.product_name_en) || str(p.generic_name) || brand || code;

  const unitText = `${str(p.product_quantity_unit)} ${str(p.quantity)} ${str(p.serving_size)}`;
  const unit: FoodUnit = str(p.product_quantity_unit).toLowerCase() === 'ml' || LIQUID.test(unitText) ? 'ml' : 'g';

  const kJ = num(n.energy_100g);
  const kcalRaw = num(n['energy-kcal_100g']) ?? (kJ !== undefined ? kJ / 4.184 : undefined);
  const macros = { protein: num(n.proteins_100g), carbs: num(n.carbohydrates_100g), fat: num(n.fat_100g) };
  const missing = (Object.keys(macros) as MacroKey[]).filter((k) => macros[k] === undefined || macros[k]! < 0);
  const noMacros = missing.length === 3;

  let per100: Intake | null = null;
  // Usable only with real energy: 0 kcal with no macros at all is an empty record, not a 0-kcal food.
  if (kcalRaw !== undefined && kcalRaw >= 0 && kcalRaw <= 900 && !(kcalRaw === 0 && noMacros)) {
    const ok = (v: number | undefined) => (v !== undefined && v >= 0 && v <= 100 ? v : 0);
    per100 = { kcal: Math.round(kcalRaw), protein: ok(macros.protein), carbs: ok(macros.carbs), fat: ok(macros.fat) };
  }

  const servings: Serving[] = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0 && sq <= 3000) servings.push({ key: 'label', label: str(p.serving_size) || `${sq} ${unit}`, amount: sq });
  const pq = num(p.product_quantity);
  if (pq && pq > 0 && pq <= 3000 && (!sq || Math.abs(pq - sq) > 1)) servings.push({ key: 'package', label: str(p.quantity) || `${pq} ${unit}`, amount: pq });

  const image = str(p.image_front_small_url);
  return {
    source: 'off',
    id: `off:${code}`,
    name,
    brand,
    barcode: code || undefined,
    unit,
    per100,
    missing: per100 ? missing : [],
    servings,
    image: image.startsWith('https://') ? image : undefined,
  };
}

// ── Maths ──────────────────────────────────────────────────────────────────

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Nutrition for `amount` grams/ml of a food with the given per-100 values. */
export function nutritionFor(per100: Intake, amount: number): Intake {
  const f = amount / 100;
  return { kcal: Math.round(per100.kcal * f), protein: round1(per100.protein * f), carbs: round1(per100.carbs * f), fat: round1(per100.fat * f) };
}

// ── Search ─────────────────────────────────────────────────────────────────

/** Lower-case, strip Arabic diacritics and unify letter variants (أ/إ/آ→ا, ة→ه, ى→ي). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Words of a text, also without the Arabic article "ال", so "الرز" matches "رز". */
const words = (s: string) => normalize(s).split(' ').flatMap((w) => (w.startsWith('ال') && w.length > 3 ? [w, w.slice(2)] : [w]));

/** 0 = a word starts with the token, 1 = contains it, null = no match. */
function tokenScore(token: string, ws: string[]): number | null {
  if (ws.some((w) => w.startsWith(token))) return 0;
  if (ws.some((w) => w.includes(token))) return 1;
  return null;
}

/** Built-in foods matching every word of the query, best matches first. */
export function searchBuiltIn(query: string, foods: BuiltInFood[]): BuiltInFood[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length || tokens.join('').length < 2) return [];
  const scored: { f: BuiltInFood; score: number }[] = [];
  foods.forEach((f) => {
    const nameWords = [...words(f.name), ...words(f.nameAr)];
    const extra = words(f.words);
    let total = 0;
    for (const t of tokens) {
      const inName = tokenScore(t, nameWords);
      const inWords = tokenScore(t, extra);
      if (inName === null && inWords === null) return;
      total += inName !== null ? inName : 2 + inWords!;
    }
    scored.push({ f, score: total });
  });
  return scored.sort((a, b) => a.score - b.score).map((s) => s.f);
}

/** Re-rank database results so a name match beats a brand-only match (Pepsi before Aquafina). */
export function rankByName<T extends { name: string; brand?: string }>(query: string, items: T[]): T[] {
  const q = normalize(query);
  const score = (it: T) => {
    const name = normalize(it.name);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(' ').some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    return 4;
  };
  return items.map((it, i) => ({ it, i, s: score(it) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.it);
}
