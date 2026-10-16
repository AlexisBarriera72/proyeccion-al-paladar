import {useEffect} from 'react';
import {useT} from '../lib/i18n.tsx';
import {Link} from '../lib/router.tsx';
import {pageTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {buttonVariants} from '../components/ui/button.tsx';

export function NotFound() {
  const {t} = useT();
  useEffect(() => {
    document.title = `${t('notFound.title')} · ${t('app.name')}`;
  }, [t]);
  return (
    <div className="max-w-3xl space-y-4">
      <h1 tabIndex={-1} className={cn(pageTitle, 'focus:outline-none')}>
        {t('notFound.title')}
      </h1>
      <Link to="/" className={buttonVariants({variant: 'secondary'})}>
        {t('notFound.back')}
      </Link>
    </div>
  );
}
