import { describe, expect, it } from 'vitest';
import {
  fromOpenFoodFacts, lookupCodes, nutritionFor, parseScannedCode, rankByName, searchBuiltIn, type BuiltInFood,
} from './food';

describe('scanned codes', () => {
  it('accepts valid retail barcodes (EAN-13, EAN-8, UPC-A)', () => {
    expect(parseScannedCode('5449000000996')).toEqual({ ok: true, gtin: '5449000000996' }); // Coca-Cola 330 ml
    expect(parseScannedCode('96385074')).toEqual({ ok: true, gtin: '96385074' }); // EAN-8
    expect(parseScannedCode(' 012000001291 ')).toEqual({ ok: true, gtin: '012000001291' }); // UPC-A, spaces trimmed
  });

  it('expands a short UPC-E code to the full UPC-A number', () => {
    expect(parseScannedCode('04252614')).toEqual({ ok: true, gtin: '042100005264' });
  });

  it('rejects a misread (wrong check digit) instead of finding the wrong product', () => {
    expect(parseScannedCode('5449000000997')).toEqual({ ok: false, reason: 'checksum' });
  });

  it('reads the product number from a GS1 Digital Link QR code', () => {
    expect(parseScannedCode('https://id.gs1.org/01/05449000000996')).toEqual({ ok: true, gtin: '5449000000996' });
    expect(parseScannedCode('https://brand.example/01/05449000000996/10/LOT42?s=1')).toEqual({ ok: true, gtin: '5449000000996' });
    expect(parseScannedCode('(01)05449000000996(17)271231')).toEqual({ ok: true, gtin: '5449000000996' });
  });

  it("says when a QR code doesn't identify a product", () => {
    expect(parseScannedCode('https://www.pepsi.com/promo')).toEqual({ ok: false, reason: 'notProduct' });
    expect(parseScannedCode('hello')).toEqual({ ok: false, reason: 'notProduct' });
    expect(parseScannedCode('12345')).toEqual({ ok: false, reason: 'format' });
    expect(parseScannedCode('   ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('tries both the 12- and 13-digit forms of a UPC when looking it up', () => {
    expect(lookupCodes('012000001291')).toEqual(['012000001291', '0012000001291']);
    expect(lookupCodes('0012000001291')).toEqual(['0012000001291', '012000001291']);
    expect(lookupCodes('5449000000996')).toEqual(['5449000000996']);
  });
});

describe('Open Food Facts products', () => {
  const coke = {
    code: '5449000000996', product_name: 'Coca-Cola Original', brands: 'Coca-Cola, The Coca-Cola Company', quantity: '330 ml',
    product_quantity: 330, product_quantity_unit: 'ml', serving_size: '1 can (330 ml)', serving_quantity: 330,
    nutriments: { 'energy-kcal_100g': 44, proteins_100g: 0, carbohydrates_100g: 10.9, fat_100g: 0 },
    image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
  };

  it('turns a complete product into something loggable, per 100 ml with real servings', () => {
    const f = fromOpenFoodFacts(coke, 'en');
    expect(f).toMatchObject({ source: 'off', barcode: '5449000000996', name: 'Coca-Cola Original', brand: 'Coca-Cola', unit: 'ml', missing: [] });
    expect(f.per100).toEqual({ kcal: 44, protein: 0, carbs: 10.9, fat: 0 });
    expect(f.servings[0]).toMatchObject({ key: 'label', label: '1 can (330 ml)', amount: 330 });
  });

  it('never treats a product with no nutrition as 0 kcal', () => {
    const pepsiUS = { code: '012000001291', product_name: 'Pepsi', brands: 'Pepsi', nutriments: { 'energy-kcal_100g': 0, energy_unit: 'kJ' } };
    expect(fromOpenFoodFacts(pepsiUS, 'en').per100).toBeNull();
    expect(fromOpenFoodFacts({ code: '1', product_name: 'X', nutriments: {} }, 'en').per100).toBeNull();
  });

  it('converts energy given only in kJ, and flags individual missing macros', () => {
    const f = fromOpenFoodFacts({ code: '1', product_name: 'Bar', nutriments: { energy_100g: 1674, proteins_100g: 20 } }, 'en');
    expect(f.per100?.kcal).toBe(400);
    expect(f.missing).toEqual(['carbs', 'fat']);
  });

  it('rejects impossible values', () => {
    expect(fromOpenFoodFacts({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': 4400 } }, 'en').per100).toBeNull();
  });

  it('prefers the Arabic name in Arabic, and falls back sensibly', () => {
    const p = { code: '1', product_name: 'Fresh Laban', product_name_ar: 'لبن طازج', brands: 'Almarai', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 3, carbohydrates_100g: 4.5, fat_100g: 3 } };
    expect(fromOpenFoodFacts(p, 'ar').name).toBe('لبن طازج');
    expect(fromOpenFoodFacts({ ...p, product_name: '', product_name_ar: '' }, 'en').name).toBe('Almarai');
  });
});

describe('serving maths', () => {
  it('scales per-100 values to the amount eaten', () => {
    expect(nutritionFor({ kcal: 44, protein: 0, carbs: 10.9, fat: 0 }, 330)).toEqual({ kcal: 145, protein: 0, carbs: 36, fat: 0 });
    expect(nutritionFor({ kcal: 130, protein: 2.69, carbs: 28.17, fat: 0.28 }, 158)).toEqual({ kcal: 205, protein: 4.3, carbs: 44.5, fat: 0.4 });
  });
});

describe('search', () => {
  const foods: BuiltInFood[] = [
    { id: 'chicken-breast', fdcId: 1, name: 'Chicken breast, cooked', nameAr: 'صدر دجاج مطبوخ', words: 'chicken دجاج', unit: 'g', per100: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, servings: [] },
    { id: 'chickpeas', fdcId: 2, name: 'Chickpeas, cooked', nameAr: 'حمص حب مطبوخ', words: 'garbanzo', unit: 'g', per100: { kcal: 164, protein: 8.9, carbs: 27.4, fat: 2.6 }, servings: [] },
    { id: 'cola', fdcId: 3, name: 'Cola, regular', nameAr: 'مشروب غازي كولا', words: 'pepsi coke بيبسي', unit: 'ml', per100: { kcal: 44, protein: 0, carbs: 10.8, fat: 0.3 }, servings: [] },
    { id: 'rice-white', fdcId: 4, name: 'White rice, cooked', nameAr: 'رز أبيض مطبوخ', words: 'rice ارز أرز', unit: 'g', per100: { kcal: 130, protein: 2.7, carbs: 28.2, fat: 0.3 }, servings: [] },
  ];
  const ids = (q: string) => searchBuiltIn(q, foods).map((f) => f.id);

  it('finds by name, by search word (pepsi → cola) and in Arabic', () => {
    expect(ids('pepsi')).toEqual(['cola']);
    expect(ids('بيبسي')).toEqual(['cola']);
    expect(ids('رز')).toEqual(['rice-white']);
    expect(ids('ارز')).toEqual(['rice-white']);
  });

  it('ranks word starts first and ignores case and spacing', () => {
    expect(ids('  CHICK ')).toEqual(['chicken-breast', 'chickpeas']);
    expect(ids('x')).toEqual([]);
    expect(ids('')).toEqual([]);
  });

  it('re-ranks database results so the name match beats a brand match', () => {
    const items = [{ name: 'Aquafina', brand: 'Pepsi' }, { name: 'Pepsi Max', brand: 'Pepsi' }, { name: 'Pepsi', brand: 'Pepsi' }];
    expect(rankByName('pepsi', items).map((i) => i.name)).toEqual(['Pepsi', 'Pepsi Max', 'Aquafina']);
  });
});
