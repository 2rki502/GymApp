import { ar } from './ar';
import { en, type Entry, type Key, type Plural } from './en';
import { getLang, isRTL, setLang, type Lang } from './locale';

export { getLang, isRTL, setLang, type Lang, type Key };

const DICTS: Record<Lang, Record<Key, Entry>> = { en, ar };
const pluralRules = new Map<Lang, Intl.PluralRules>();

function rules(lang: Lang): Intl.PluralRules {
  let r = pluralRules.get(lang);
  if (!r) {
    r = new Intl.PluralRules(lang);
    pluralRules.set(lang, r);
  }
  return r;
}

type Vars = Record<string, string | number>;

/**
 * Remove Arabic diacritics (tashkeel). The beIN Normal UI font has no mark
 * positioning, so harakat render detached; undiacritised text is also the norm in
 * Arabic interfaces. Source strings keep their marks — only display output is cleaned.
 */
const TASHKEEL = /[ً-ْٰ]/g;
export const plainArabic = (s: string) => (getLang() === 'ar' ? s.replace(TASHKEEL, '') : s);

/**
 * Translate a key in the current language. Plural entries pick their form from
 * `vars.n` via Intl.PluralRules (Arabic has zero/one/two/few/many/other).
 */
export function t(key: Key, vars?: Vars): string {
  const lang = getLang();
  const entry: Entry = DICTS[lang][key] ?? en[key];
  let s: string;
  if (typeof entry === 'string') s = entry;
  else {
    const n = Number(vars?.n ?? 0);
    const p = entry as Plural;
    s = p[rules(lang).select(n)] ?? p.other;
  }
  if (lang === 'ar') s = s.replace(TASHKEEL, '');
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** Apply language and text direction to the document. */
export function applyLanguage(lang: Lang) {
  setLang(lang);
  const root = document.documentElement;
  root.lang = lang;
  root.dir = isRTL(lang) ? 'rtl' : 'ltr';
}

/**
 * Isolate a left-to-right fragment (e.g. "−1.2", "+15") so the bidi algorithm keeps
 * its sign attached inside right-to-left text. Harmless in English.
 */
export const ltr = (s: string) => `⁦${s}⁩`;

/** Signed number like "+1.2" / "−0.4", isolated for RTL text. */
export const signed = (n: number, format: (v: number) => string) => ltr(`${n > 0 ? '+' : n < 0 ? '−' : ''}${format(Math.abs(n))}`);

/** Join a list with the language's comma ("، " in Arabic). */
export const joinList = (items: string[]) => items.join(getLang() === 'ar' ? '، ' : ', ');

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];
