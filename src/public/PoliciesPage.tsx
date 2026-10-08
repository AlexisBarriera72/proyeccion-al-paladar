// "/politicas/": the approved terms in force and earlier approved versions. Until the owners
// approve any, the announced text is quoted exactly and labeled as unconfirmed.
import {useCallback, useEffect, useState} from 'react';
import {motion} from 'motion/react';
import {RotateCw} from 'lucide-react';
import type {PublicPolicy} from '../../shared/types.ts';
import {formatLongDate} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {getJson} from '../lib/api.ts';
import {useEntry} from '../lib/motion.ts';
import {pick} from '../lib/format.ts';
import {detailTitle, helper, pageTitle, panel} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button} from '../components/ui/button.tsx';
import {PolicyBlock} from './SessionDetail.tsx';

type Policies = {current: PublicPolicy[]; earlier: PublicPolicy[]; announced: PublicPolicy[]};
type Load = {state: 'loading'} | {state: 'error'} | {state: 'ready'; data: Policies};

function Section({id, title, children}: {id: string; title: string; children: React.ReactNode}) {
  return (
    <section aria-labelledby={id} className={cn(panel, 'space-y-4')}>
      <h2 id={id} className={detailTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PoliciesPage() {
  const {t, lang} = useT();
  const entry = useEntry();
  const [load, setLoad] = useState<Load>({state: 'loading'});
  const fetchAll = useCallback(async () => {
    setLoad({state: 'loading'});
    const result = await getJson<Policies>('/api/public/policies');
    setLoad(result.kind === 'ok' ? {state: 'ready', data: result.data} : {state: 'error'});
  }, []);
  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);
  useEffect(() => {
    document.title = `${t('policies.title')} · ${t('app.name')}`;
  }, [t]);

  let body;
  if (load.state === 'loading') {
    body = (
      <div aria-busy="true" className="h-64 rounded-2xl bg-stone-100">
        <p className="sr-only">{t('app.loading')}</p>
      </div>
    );
  } else if (load.state === 'error') {
    body = (
      <div role="alert" className="space-y-3 rounded-2xl border border-stone-400 bg-surface p-4">
        <p className="text-base leading-6 text-ink">{t('policies.loadError')}</p>
        <Button variant="secondary" onClick={() => void fetchAll()}>
          <RotateCw aria-hidden="true" />
          {t('app.retry')}
        </Button>
      </div>
    );
  } else {
    const {current, earlier, announced} = load.data;
    body = (
      <>
        {current.length ? (
          <motion.div variants={entry.item}>
            <Section id="policies-current" title={t('policies.current')}>
              {current.map(policy => (
                <article
                  key={policy.id}
                  className="space-y-2 border-t border-border/70 pt-4 first:border-t-0 first:pt-0"
                >
                  <PolicyBlock policy={policy} />
                </article>
              ))}
            </Section>
          </motion.div>
        ) : announced.length ? (
          <motion.div variants={entry.item}>
            <Section id="policies-announced" title={t('policies.announced')}>
              {announced.map(policy => (
                <article key={policy.id} className="space-y-2">
                  <PolicyBlock policy={policy} />
                </article>
              ))}
            </Section>
          </motion.div>
        ) : (
          <motion.p variants={entry.item} className={cn(panel, 'text-base leading-6 text-ink')}>
            {t('policies.none')}
          </motion.p>
        )}
        {earlier.length ? (
          <motion.div variants={entry.item}>
            <Section id="policies-earlier" title={t('policies.earlier')}>
              <ul className="space-y-4">
                {earlier.map(policy => (
                  <li key={policy.id} className="space-y-1">
                    <p className="text-sm font-semibold leading-5 text-ink">{policy.title}</p>
                    {policy.effectiveFrom ? (
                      <p className={helper}>
                        {t('policy.approvedSince', {date: formatLongDate(policy.effectiveFrom, lang)})}
                      </p>
                    ) : null}
                    <p className="text-sm leading-5 text-ink">{pick(policy.text, lang)}</p>
                  </li>
                ))}
              </ul>
            </Section>
          </motion.div>
        ) : null}
      </>
    );
  }

  return (
    <motion.div variants={entry.page} initial="hidden" animate="show" className="mx-auto max-w-2xl space-y-4">
      <motion.div variants={entry.item} className="space-y-2">
        <h1 tabIndex={-1} className={cn(pageTitle, 'focus:outline-none')}>
          {t('policies.title')}
        </h1>
        <p className={helper}>{t('policies.locked')}</p>
      </motion.div>
      {body}
    </motion.div>
  );
}
