// The staff workspace (/equipo/), a separate chunk. The Worker already checked the Access token
// and the staff list before serving this page; every API call is checked again on the server.
import {useEffect, type ReactNode} from 'react';
import {Link, useLocation} from '../lib/router.tsx';
import {cn} from '../lib/cn.ts';
import {pageTitle} from '../lib/styles.ts';
import {useQuery} from './api.ts';
import {QueryView, useStaffT} from './ui.tsx';
import {CalendarView, SessionPage, SessionsList} from './Sessions.tsx';
import {BookingPage, BookingsList, ManualEntry} from './Bookings.tsx';
import {Exceptions, History, Requests, Tonight} from './Queues.tsx';
import {Experiences, Settings} from './Settings.tsx';
import {MeContext, type Me} from './me.ts';

const NAV = [
  ['/equipo/', 'nav.calendar'],
  ['/equipo/esta-noche/', 'nav.tonight'],
  ['/equipo/sesiones/', 'nav.sessions'],
  ['/equipo/reservaciones/', 'nav.bookings'],
  ['/equipo/excepciones/', 'nav.exceptions'],
  ['/equipo/pedidos/', 'nav.requests'],
  ['/equipo/experiencias/', 'nav.experiences'],
  ['/equipo/configuracion/', 'nav.settings'],
  ['/equipo/historial/', 'nav.history'],
] as const;

function section(path: string): string {
  const match = /^\/equipo\/([^/]+)/.exec(path);
  return match ? `/equipo/${match[1]}/` : '/equipo/';
}

function Frame({me, children}: {me: Me | null; children: ReactNode}) {
  const {t, lang, setLang} = useStaffT();
  const {path} = useLocation();
  const current = section(path);
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:bg-surface focus:px-4 focus:py-3 focus:text-ink"
      >
        {t('app.skip')}
      </a>
      {me?.demo ? (
        <div role="note" className="bg-ink px-4 py-2 text-center text-sm font-medium leading-5 text-white">
          {t('staff.demo')}
        </div>
      ) : null}
      <header className="border-b border-border/70 bg-surface">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-base font-semibold leading-6 text-ink">
              {t('app.name')} · {t('staff.title')}
            </p>
            {me ? (
              <p className="text-sm leading-5 text-muted">
                {t('staff.signedIn', {email: me.email, role: t(`role.${me.role}`)})}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <a
              href="/"
              className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium text-ink hover:bg-stone-100"
            >
              {t('staff.viewSite')}
            </a>
            <button
              type="button"
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              lang={lang === 'es' ? 'en' : 'es'}
              aria-label={t('app.langLabel')}
              className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium text-ink hover:bg-stone-100"
            >
              {t('app.lang')}
            </button>
          </div>
        </div>
        {me ? (
          <nav aria-label={t('nav.label')} className="mx-auto max-w-[1280px] px-2 pb-2 sm:px-4 lg:px-6">
            <ul className="flex flex-wrap gap-1">
              {NAV.map(([to, key]) => (
                <li key={to}>
                  <Link
                    to={to}
                    aria-current={current === to ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      current === to && 'bg-ink text-white hover:bg-ink',
                    )}
                  >
                    {t(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-[1280px] px-4 py-4 focus:outline-none sm:px-6 sm:py-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}

function Routes() {
  const {path, search} = useLocation();
  const [area, id] = path.replace(/\/+$/, '').split('/').slice(2); // after "/equipo"
  if (!area) return <CalendarView />;
  if (area === 'esta-noche') return <Tonight />;
  if (area === 'sesiones') {
    if (id === 'nueva') return <SessionPage id={null} />;
    return id ? <SessionPage key={id} id={id} /> : <SessionsList />;
  }
  if (area === 'reservaciones') {
    if (id === 'nueva') return <ManualEntry sessionId={search.get('session')} />;
    return id ? <BookingPage key={id} id={id} /> : <BookingsList />;
  }
  if (area === 'excepciones') return <Exceptions />;
  if (area === 'pedidos') return <Requests />;
  if (area === 'experiencias') return <Experiences />;
  if (area === 'configuracion') return <Settings />;
  if (area === 'historial') return <History />;
  return <NotFoundStaff />;
}

function NotFoundStaff() {
  const {t} = useStaffT();
  return (
    <h1 tabIndex={-1} className={cn(pageTitle, 'focus:outline-none')}>
      {t('notFound.title')}
    </h1>
  );
}

export default function StaffApp({path}: {path: string}) {
  const {t} = useStaffT();
  const {query, reload} = useQuery<Me>('/api/equipo/me');
  useEffect(() => {
    document.title = `${t('staff.area')} · ${t('app.name')}`;
  }, [t, path]);
  const me = query.state === 'ready' ? query.data : null;
  if (query.state === 'error' && query.status === 403) {
    return (
      <Frame me={null}>
        <h1 tabIndex={-1} className={cn(pageTitle, 'focus:outline-none')}>
          {t('staff.noAccess')}
        </h1>
        <p className="mt-3 text-base leading-6 text-ink">{t('staff.noAccessHelp')}</p>
      </Frame>
    );
  }
  return (
    <Frame me={me}>
      <QueryView query={query} onRetry={() => void reload()}>
        {data => (
          <MeContext.Provider value={data}>
            <Routes />
          </MeContext.Provider>
        )}
      </QueryView>
    </Frame>
  );
}
