import {useEffect} from 'react';
import {useT} from '../lib/i18n.tsx';
import {Link} from '../lib/router.tsx';
import {pageTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {buttonVariants} from '../components/ui/button.tsx';
import {PageBand} from '../components/Band.tsx';

export function NotFound() {
  const {t} = useT();
  useEffect(() => {
    document.title = `${t('notFound.title')} · ${t('app.name')}`;
  }, [t]);
  return (
    <PageBand className="pb-6 sm:pb-10">
      <div className="max-w-3xl space-y-6">
        <h1 tabIndex={-1} className={cn(pageTitle, 'text-on-sala focus:outline-none')}>
          {t('notFound.title')}
        </h1>
        <Link to="/" className={buttonVariants({variant: 'brass'})}>
          {t('notFound.back')}
        </Link>
      </div>
    </PageBand>
  );
}
