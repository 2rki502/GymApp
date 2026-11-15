/**
 * Open Food Facts client (https://world.openfoodfacts.org, ODbL data, no API key).
 *
 * - Product lookup by barcode is fast and allows ~100 requests/min.
 * - Text search is rate-limited by the server (~10/min, answers 503 when exceeded), so the app
 *   searches only on request and this client keeps itself under the limit.
 * Every failure is reported as a distinct status so the UI can say what happened and keep
 * the other ways of adding food available.
 */
import { fromOpenFoodFacts, lookupCodes, OFF_FIELDS, rankByName, type FoodItem } from '@/domain/food';

const BASE = 'https://world.openfoodfacts.org';

export type Failure = { status: 'busy' | 'offline' | 'timeout' | 'error' };
export type LookupResult = { status: 'found'; item: FoodItem } | { status: 'notFound' } | Failure;
export type SearchResult = { status: 'ok'; items: FoodItem[] } | Failure;

interface Options {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  isOnline?: () => boolean;
  now?: () => number;
}

/** Searches allowed per rolling minute (the server allows about 10; stay safely under). */
const SEARCH_BUDGET = 7;

export function createFoodApi(opts: Options = {}) {
  const fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  // Barcode lookups are fast; the search endpoint can take 10+ s when busy.
  const timeoutMs = opts.timeoutMs ?? 8_000;
  const searchTimeoutMs = opts.timeoutMs ?? 20_000;
  // Offline only when the device explicitly says so (some environments leave onLine undefined).
  const isOnline = opts.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
  const now = opts.now ?? (() => Date.now());
  const products = new Map<string, LookupResult>();
  const searches = new Map<string, SearchResult>();
  const searchTimes: number[] = [];

  /** GET JSON with a timeout; returns the HTTP status and body, or a failure. */
  async function get(url: string, signal?: AbortSignal, ms = timeoutMs): Promise<{ status: number; body: unknown } | Failure> {
    if (!isOnline()) return { status: 'offline' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    signal?.addEventListener('abort', () => ctrl.abort());
    try {
      const res = await fetchImpl(url, { signal: ctrl.signal });
      if (res.status === 429 || res.status === 503) return { status: 'busy' };
      const body = res.status === 404 || res.ok ? await res.json().catch(() => null) : null;
      return { status: res.status, body };
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return signal?.aborted ? { status: 'error' } : { status: 'timeout' };
      // A rate-limited reply has no CORS header, so the browser reports it as a network error.
      return { status: isOnline() ? 'error' : 'offline' };
    } finally {
      clearTimeout(timer);
    }
  }

  async function lookup(gtin: string, lang: 'en' | 'ar', signal?: AbortSignal): Promise<LookupResult> {
    const cached = products.get(gtin);
    if (cached) return cached;
    for (const code of lookupCodes(gtin)) {
      const r = await get(`${BASE}/api/v2/product/${code}?fields=${OFF_FIELDS}&lc=${lang}`, signal);
      if ('body' in r) {
        const body = r.body as { status?: number; product?: Record<string, unknown> } | null;
        if (r.status === 200 && body?.status === 1 && body.product) {
          const found: LookupResult = { status: 'found', item: fromOpenFoodFacts(body.product, lang) };
          products.set(gtin, found);
          return found;
        }
        if (r.status === 404 || body?.status === 0) continue; // try the other form, then "not found"
        return { status: 'error' };
      }
      return r;
    }
    const notFound: LookupResult = { status: 'notFound' };
    products.set(gtin, notFound);
    return notFound;
  }

  async function search(query: string, lang: 'en' | 'ar', signal?: AbortSignal): Promise<SearchResult> {
    const q = query.trim().toLowerCase();
    const key = `${lang}:${q}`;
    const cached = searches.get(key);
    if (cached) return cached;
    const t = now();
    while (searchTimes.length && t - searchTimes[0] > 60_000) searchTimes.shift();
    if (searchTimes.length >= SEARCH_BUDGET) return { status: 'busy' };
    searchTimes.push(t);
    const url =
      `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1` +
      `&page_size=24&sort_by=unique_scans_n&lc=${lang}&fields=${OFF_FIELDS}`;
    const r = await get(url, signal, searchTimeoutMs);
    // The search endpoint's rate-limit reply (503) has no CORS header, so a browser sees it as a
    // network error: while online, "busy" is the accurate thing to tell the user.
    if (!('body' in r)) return r.status === 'error' ? { status: 'busy' } : r;
    if (r.status !== 200) return { status: 'error' };
    const list = ((r.body as { products?: Record<string, unknown>[] } | null)?.products ?? [])
      .map((p) => fromOpenFoodFacts(p, lang))
      // A result with no name is useless to pick from.
      .filter((it) => it.name && it.name !== it.barcode);
    const result: SearchResult = { status: 'ok', items: rankByName(q, list) };
    searches.set(key, result);
    return result;
  }

  return { lookup, search };
}

/** The app's shared client (keeps one cache and one rate-limit budget). */
export const foodApi = createFoodApi();
