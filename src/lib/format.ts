import type {Lang} from '../../shared/time.ts';

const money = new Map<string, Intl.NumberFormat>();

/** "$25.00" in the visitor's language. Only for amounts staff entered and approved. */
export function formatMoney(cents: number, currency: string, lang: Lang): string {
  const key = `${lang}:${currency}`;
  let format = money.get(key);
  if (!format) {
    format = new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'es-PR', {style: 'currency', currency});
    money.set(key, format);
  }
  return format.format(cents / 100);
}

/** A localized pick: English when present, otherwise Spanish (the business's language). */
export const pick = (value: {es: string; en: string | null} | null | undefined, lang: Lang) =>
  value ? (lang === 'en' && value.en ? value.en : value.es) : '';
