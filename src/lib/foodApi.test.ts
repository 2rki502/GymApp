import { describe, expect, it } from 'vitest';
import { createFoodApi } from './foodApi';

type Reply = { status: number; body?: unknown } | 'network-error' | 'hang';

/** A pretend internet: answers each request from a list, and records what was asked. */
function fakeFetch(replies: Reply[]) {
  const calls: string[] = [];
  const fetchImpl = (url: string, init?: { signal?: AbortSignal }) => {
    calls.push(url);
    const r = replies.shift() ?? { status: 404 };
    if (r === 'network-error') return Promise.reject(new TypeError('Failed to fetch'));
    if (r === 'hang')
      return new Promise<never>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: () => Promise.resolve(r.body) });
  };
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const coke = { code: '5449000000996', product_name: 'Coca-Cola Original', brands: 'Coca-Cola', quantity: '330 ml', serving_size: '1 can (330 ml)', serving_quantity: 330, nutriments: { 'energy-kcal_100g': 44, proteins_100g: 0, carbohydrates_100g: 10.9, fat_100g: 0 } };

describe('barcode lookup', () => {
  it('finds a product and returns it ready to log', async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { status: 1, product: coke } }]);
    const r = await createFoodApi({ fetchImpl }).lookup('5449000000996', 'en');
    expect(r.status).toBe('found');
    expect(r.status === 'found' && r.item.per100?.kcal).toBe(44);
    expect(calls[0]).toContain('/api/v2/product/5449000000996');
  });

  it('tries the other UPC form before saying not found', async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 404, body: { status: 0 } }, { status: 200, body: { status: 1, product: { ...coke, code: '0012000001291' } } }]);
    const r = await createFoodApi({ fetchImpl }).lookup('012000001291', 'en');
    expect(r.status).toBe('found');
    expect(calls.map((c) => c.split('/product/')[1].split('?')[0])).toEqual(['012000001291', '0012000001291']);
  });

  it('reports an unknown product, a busy server, no connection and a timeout distinctly', async () => {
    expect((await createFoodApi({ fetchImpl: fakeFetch([{ status: 404, body: { status: 0 } }]).fetchImpl }).lookup('5449000000996', 'en')).status).toBe('notFound');
    expect((await createFoodApi({ fetchImpl: fakeFetch([{ status: 503 }]).fetchImpl }).lookup('5449000000996', 'en')).status).toBe('busy');
    expect((await createFoodApi({ fetchImpl: fakeFetch(['network-error']).fetchImpl, isOnline: () => false }).lookup('5449000000996', 'en')).status).toBe('offline');
    expect((await createFoodApi({ fetchImpl: fakeFetch(['network-error']).fetchImpl, isOnline: () => true }).lookup('5449000000996', 'en')).status).toBe('error');
    expect((await createFoodApi({ fetchImpl: fakeFetch(['hang']).fetchImpl, timeoutMs: 20 }).lookup('5449000000996', 'en')).status).toBe('timeout');
  });

  it('remembers products already looked up (no second request)', async () => {
    const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { status: 1, product: coke } }]);
    const api = createFoodApi({ fetchImpl });
    await api.lookup('5449000000996', 'en');
    expect((await api.lookup('5449000000996', 'en')).status).toBe('found');
    expect(calls).toHaveLength(1);
  });
});

describe('online product search', () => {
  it('returns named products, best name matches first', async () => {
    const products = [
      { code: '1', product_name: 'Aquafina', brands: 'Pepsi', nutriments: { 'energy-kcal_100g': 0, proteins_100g: 0, carbohydrates_100g: 0, fat_100g: 0 } },
      { code: '2', product_name: 'Pepsi', brands: 'Pepsi', nutriments: { 'energy-kcal_100g': 42 } },
      { code: '3', product_name: '', brands: '', nutriments: {} },
    ];
    const { fetchImpl, calls } = fakeFetch([{ status: 200, body: { products } }]);
    const r = await createFoodApi({ fetchImpl }).search('pepsi', 'en');
    expect(r.status).toBe('ok');
    expect(r.status === 'ok' && r.items.map((i) => i.name)).toEqual(['Pepsi', 'Aquafina']);
    expect(calls[0]).toContain('search_terms=pepsi');
  });

  it("stops before the server's rate limit instead of hammering it", async () => {
    const replies: Reply[] = Array.from({ length: 20 }, () => ({ status: 200, body: { products: [] } }));
    const { fetchImpl, calls } = fakeFetch(replies);
    const api = createFoodApi({ fetchImpl, now: () => 0 });
    const results = [];
    for (let i = 0; i < 10; i++) results.push((await api.search(`q${i}`, 'en')).status);
    expect(results.filter((s) => s === 'busy').length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(8);
  });

  it('reports a failed search while online as busy (a rate-limited reply reaches the browser as a network error)', async () => {
    const r = await createFoodApi({ fetchImpl: fakeFetch(['network-error']).fetchImpl, isOnline: () => true }).search('pepsi', 'en');
    expect(r.status).toBe('busy');
  });

  it('treats the server being busy as busy, not as "no results"', async () => {
    expect((await createFoodApi({ fetchImpl: fakeFetch([{ status: 503 }]).fetchImpl }).search('pepsi', 'en')).status).toBe('busy');
    expect((await createFoodApi({ fetchImpl: fakeFetch([{ status: 429 }]).fetchImpl }).search('pepsi', 'en')).status).toBe('busy');
  });
});
