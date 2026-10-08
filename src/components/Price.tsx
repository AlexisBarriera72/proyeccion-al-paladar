// An amount only when staff entered and approved one; otherwise what's known, in words.
import type {PublicSession} from '../../shared/types.ts';
import {formatMoney} from '../lib/format.ts';
import {useT} from '../lib/i18n.tsx';

export function priceText(
  price: PublicSession['price'],
  t: (key: string, vars?: Record<string, string | number>) => string,
  lang: 'es' | 'en',
) {
  if (price.status === 'approved' && price.cents !== null && price.currency) {
    return t('price.perPerson', {amount: formatMoney(price.cents, price.currency, lang)});
  }
  if (price.status === 'not_charged') return t('price.free');
  return t('price.tbd');
}

export function Price({price}: {price: PublicSession['price']}) {
  const {t, lang} = useT();
  return <>{priceText(price, t, lang)}</>;
}
