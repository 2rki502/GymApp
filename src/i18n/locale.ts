/** Current UI language. Kept dependency-free so domain formatters can read it. */
export type Lang = 'en' | 'ar';

let current: Lang = 'en';

export const getLang = (): Lang => current;
export const setLang = (l: Lang) => {
  current = l;
};
export const isRTL = (l: Lang = current) => l === 'ar';
