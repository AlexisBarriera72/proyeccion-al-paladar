// One session: what's known about it, the terms, and the action the server would accept.
import {lazy, Suspense, useEffect, useState} from 'react';
import {motion} from 'motion/react';
import {ArrowLeft, CalendarDays, ExternalLink, Link2, MapPin, Tag, Users} from 'lucide-react';
import type {PublicSession} from '../../shared/types.ts';
import {formatLongDate, formatTime} from '../../shared/time.ts';
import {useT} from '../lib/i18n.tsx';
import {useConfig} from '../lib/config.tsx';
import {pick} from '../lib/format.ts';
import {Link} from '../lib/router.tsx';
import {copyText} from '../lib/copy.ts';
import {useEntry, useMagnetic} from '../lib/motion.ts';
import {detailTitle, helper, numbers, sectionTitle, sessionTitle} from '../lib/styles.ts';
import {cn} from '../lib/cn.ts';
import {Button, buttonVariants} from '../components/ui/button.tsx';
import {AvailabilityBadge} from '../components/Status.tsx';
import {Price} from '../components/Price.tsx';
import {Photo} from '../components/Photo.tsx';
import {Disclosure} from '../components/ui/disclosure.tsx';
import {PageBand, PageSheet} from '../components/Band.tsx';
import {hasReceipt} from './flowStorage.ts';

const fact = 'space-y-0.5 py-3';
const factLabel = 'flex items-center gap-2 text-sm leading-5 text-muted [&_svg]:size-4 [&_svg]:shrink-0';

// The flow loads on first use, so the calendar's first visit stays small.
const ReserveFlow = lazy(() => import('./ReserveFlow.tsx').then(module => ({default: module.ReserveFlow})));

/**
 * The terms that apply. An announced policy keeps its label and condition in view; its exact
 * quote sits behind a button on session pages and stays open on the terms page.
 */
export function PolicyBlock({policy, quoteOpen = false}: {policy: PublicSession['policy']; quoteOpen?: boolean}) {
  const {t, lang} = useT();
  if (!policy) return <p className={helper}>{t('policy.none')}</p>;
  const text = pick(policy.text, lang);
  const quote = policy.state === 'announced' && (
    <div className="space-y-2">
      <figure className="space-y-1">
        <figcaption className={helper}>{t('policy.quote')}</figcaption>
        <blockquote lang="es" className="border-l-2 border-stone-400 pl-3 text-sm leading-5 text-ink">
          {policy.text.es}
        </blockquote>
      </figure>
      {policy.sourceUrl ? (
        <a
          href={policy.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({variant: 'link'})}
        >
          {t('policy.source')}
        </a>
      ) : null}
    </div>
  );
  return (
    <div className="space-y-2">
      {policy.state === 'announced' ? (
        <>
          <p className="text-sm font-semibold leading-5 text-ink">{t('policy.announced')}</p>
          <p className={helper}>{t('policy.announcedHelp')}</p>
          {quoteOpen ? (
            quote
          ) : (
            <Disclosure variant="link" summary={t('policy.readQuote')}>
              {quote}
            </Disclosure>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-semibold leading-5 text-ink">{policy.title}</p>
          {policy.effectiveFrom ? (
            <p className={helper}>{t('policy.approvedSince', {date: formatLongDate(policy.effectiveFrom, lang)})}</p>
          ) : null}
          <p className="text-sm leading-5 text-ink">{text}</p>
        </>
      )}
    </div>
  );
}

export function WhenText({session}: {session: PublicSession}) {
  const {t, lang} = useT();
  if (session.startsAt === null) return <>{t('status.date_tbd')}</>;
  return (
    <span className={numbers}>
      <span className="first-letter:uppercase">{formatLongDate(session.startsAt, lang)}</span>
      {', '}
      <span className="whitespace-nowrap">{formatTime(session.startsAt, lang)}</span>
      {session.endsAt ? (
        <>
          –<span className="whitespace-nowrap">{formatTime(session.endsAt, lang)}</span>
        </>
      ) : null}{' '}
      <span className="text-muted">({t('detail.tz')})</span>
    </span>
  );
}

export function SessionDetail({
  session,
  variant,
  onChanged,
}: {
  session: PublicSession;
  variant: 'panel' | 'page';
  onChanged: () => void;
}) {
  const {t, lang} = useT();
  const config = useConfig();
  const [flowOpen, setFlowOpen] = useState(false);
  const [flowUsed, setFlowUsed] = useState(false);
  // A receipt from this tab stays reachable even once the session can't be booked any more
  // (for instance when this booking took its last seats): it holds the guest's private link.
  const [receiptSaved, setReceiptSaved] = useState(() => hasReceipt(session.id));
  useEffect(() => {
    if (!flowOpen) setReceiptSaved(hasReceipt(session.id));
  }, [flowOpen, session.id]);
  const openFlow = () => {
    setFlowUsed(true);
    setFlowOpen(true);
  };
  const [shared, setShared] = useState<string | null>(null);
  const magnetic = useMagnetic(3);
  const entry = useEntry();
  const Heading = variant === 'page' ? 'h1' : 'h2';
  // One level below the title: h2 under the page's h1, h3 under the panel's h2.
  const Sub = variant === 'page' ? 'h2' : 'h3';
  const instagram = config?.instagramUrl ?? 'https://www.instagram.com/proyeccionalpaladarpr/';

  const share = async () => {
    const ok = await copyText(`${location.origin}/funciones/${session.id}/`);
    setShared(ok ? t('detail.linkCopied') : t('result.copyFailed'));
  };

  const page = variant === 'page';
  const remaining =
    session.remaining !== null && session.availability !== 'sold_out' && session.availability !== 'past'
      ? session.remaining === 1
        ? t('status.remainingOne')
        : t('status.remaining', {count: session.remaining})
      : null;
  // The title and status: in the band on a page of its own, at the top of the panel otherwise.
  const header = (
    <div className="space-y-3">
      <Heading
        id={`session-${session.id}`}
        tabIndex={-1}
        data-focus
        className={cn(
          page ? cn(sessionTitle, 'text-on-sala') : detailTitle,
          'focus:outline-none',
          session.availability === 'cancelled' && 'line-through',
        )}
      >
        {pick(session.title, lang)}
      </Heading>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AvailabilityBadge availability={session.availability} tone={page ? 'sala' : 'paper'} />
        {remaining ? (
          <span className={cn('text-sm leading-5', page ? 'text-on-sala' : 'text-ink', numbers)}>{remaining}</span>
        ) : null}
      </div>
    </div>
  );

  const body = (
    <>
      <dl className="divide-y divide-border/70 border-y border-border/70 text-base leading-6">
        <div className={fact}>
          <dt className={factLabel}>
            <CalendarDays aria-hidden="true" />
            {t('detail.when')}
          </dt>
          <dd className="pl-6 text-ink">
            <WhenText session={session} />
          </dd>
        </div>
        <div className={fact}>
          <dt className={factLabel}>
            <MapPin aria-hidden="true" />
            {t('detail.where')}
          </dt>
          <dd className="pl-6 text-ink">
            {session.venue ? (
              <>
                {session.venue.name}
                {session.venue.address ? (
                  <span className="block text-sm leading-5 text-muted">{session.venue.address}</span>
                ) : null}
                {session.venue.instructions ? (
                  <span className="block text-sm leading-5 text-muted">{session.venue.instructions}</span>
                ) : null}
              </>
            ) : (
              t('venue.tbd')
            )}
          </dd>
        </div>
        <div className={fact}>
          <dt className={factLabel}>
            <Tag aria-hidden="true" />
            {t('detail.price')}
          </dt>
          <dd className={cn('pl-6 text-ink', numbers)}>
            <Price price={session.price} />
          </dd>
        </div>
        <div className={fact}>
          <dt className={factLabel}>
            <Users aria-hidden="true" />
            {t('detail.group')}
          </dt>
          <dd className={cn('pl-6 text-ink', numbers)}>
            {session.partyMin !== null && session.partyMax !== null
              ? t('group.limits', {min: session.partyMin, max: session.partyMax})
              : t('group.unknown')}
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        {session.action === 'none' ? (
          <div className="space-y-2">
            <p className="text-base leading-6 text-ink">{t('action.none')}</p>
            <div className="flex flex-wrap gap-3">
              {receiptSaved ? (
                <Button variant="primary" onClick={openFlow}>
                  {t('action.viewReceipt')}
                </Button>
              ) : null}
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({variant: 'secondary'})}
              >
                <ExternalLink aria-hidden="true" />
                {t('action.noneHelp')}
              </a>
            </div>
          </div>
        ) : (
          <div {...magnetic.handlers} className="w-full">
            <Button variant="primary" width="full" onClick={openFlow} className="relative">
              <motion.span style={magnetic.style} className="inline-flex items-center gap-2">
                {session.action === 'reserve' ? t('action.reserve') : t('action.request')}
              </motion.span>
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={share} className="-ml-3">
            <Link2 aria-hidden="true" />
            {t('detail.share')}
          </Button>
          <span role="status" aria-live="polite" className={helper}>
            {shared}
          </span>
        </div>
      </div>

      {session.photoSlot || session.description ? (
        <div className="space-y-4 border-t border-border/70 pt-5">
          {session.photoSlot ? (
            <Photo slot={session.photoSlot} sizes={variant === 'page' ? '(min-width: 640px) 560px, 100vw' : '312px'} />
          ) : null}
          {session.description ? (
            <p className="text-base leading-6 text-ink">{pick(session.description, lang)}</p>
          ) : null}
        </div>
      ) : null}

      {session.inclusions.es.length ? (
        <section aria-labelledby={`includes-${session.id}`} className="space-y-2 border-t border-border/70 pt-5">
          <Sub id={`includes-${session.id}`} className={sectionTitle}>
            {t('detail.includes')}
          </Sub>
          <ul
            className="list-disc space-y-1 pl-5 text-base leading-6 text-ink"
            lang={lang === 'en' && session.inclusions.en ? 'en' : 'es'}
          >
            {(lang === 'en' && session.inclusions.en ? session.inclusions.en : session.inclusions.es).map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={helper}>{t('detail.includesNote')}</p>
        </section>
      ) : null}

      <section aria-labelledby={`terms-${session.id}`} className="space-y-2 border-t border-border/70 pt-5">
        <Sub id={`terms-${session.id}`} className={sectionTitle}>
          {t('detail.terms')}
        </Sub>
        <PolicyBlock policy={session.policy} />
      </section>

      {/* Mounted while open, so a refusal that ends the session's sale can still be read. */}
      {flowUsed && (session.action !== 'none' || flowOpen || receiptSaved) ? (
        <Suspense fallback={null}>
          <ReserveFlow session={session} open={flowOpen} onOpenChange={setFlowOpen} onSessionChanged={onChanged} />
        </Suspense>
      ) : null}
    </>
  );

  if (!page) {
    return (
      <article className="space-y-5" aria-labelledby={`session-${session.id}`}>
        {header}
        {body}
      </article>
    );
  }
  return (
    <article aria-labelledby={`session-${session.id}`}>
      <PageBand>
        <motion.div variants={entry.item} className="space-y-4">
          <Link to="/" className={cn(buttonVariants({variant: 'onSala'}), '-ml-3')}>
            <ArrowLeft aria-hidden="true" />
            {t('detail.back')}
          </Link>
          {header}
        </motion.div>
      </PageBand>
      <PageSheet>
        <motion.div
          variants={entry.item}
          className="max-w-2xl space-y-5 sm:rounded-2xl sm:border sm:border-border/70 sm:bg-surface sm:p-6 sm:shadow-[0_1px_2px_rgba(28,25,23,0.05),0_12px_32px_rgba(28,25,23,0.08)]"
        >
          {body}
        </motion.div>
      </PageSheet>
    </article>
  );
}
