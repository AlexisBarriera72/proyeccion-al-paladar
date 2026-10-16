// The staff workspace (/equipo/), a separate chunk. The Worker already checked the Access token
// and the staff list before serving this page; every API call is checked again on the server.
//
// Header: on computers, the brand row (with "Ver el sitio", the language and the account menu)
// and the section links in three groups. Below 1024px, one compact row and a "Secciones" sheet.
// Excepciones and Pedidos show a count only when above zero, from the staff endpoints.
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {DropdownMenu as M} from 'radix-ui';
import {
  CalendarClock,
  CalendarDays,
  History,
  Inbox,
  Menu as MenuIcon,
  Moon,
  Settings as SettingsIcon,
  TriangleAlert,
  UserRound,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';
import {Link, useLocation} from '../lib/router.tsx';
import {cn} from '../lib/cn.ts';
import {helper, numbers, pageTitle} from '../lib/styles.ts';
import {isDemoPage} from '../components/Layout.tsx';
import {Button} from '../components/ui/button.tsx';
import {Dialog} from '../components/ui/dialog.tsx';
import {menuContainer} from '../components/ui/menu.tsx';
import {useQuery} from './api.ts';
import {QueryView, useStaffT} from './ui.tsx';
import {CalendarView, SessionPage, SessionsList} from './Sessions.tsx';
import {BookingPage, BookingsList} from './Bookings.tsx';
import {Exceptions, History as HistoryPage, Requests, Tonight} from './Queues.tsx';
import {Experiences, Settings} from './Settings.tsx';
import {CountsContext, MeContext, type Me} from './me.ts';

type Queue = 'exceptions' | 'requests';
type NavLink = {to: string; key: string; icon: LucideIcon; queue?: Queue};

const NAV: {key: string; links: NavLink[]}[] = [
  {
    key: 'nav.group.daily',
    links: [
      {to: '/equipo/', key: 'nav.calendar', icon: CalendarDays},
      {to: '/equipo/esta-noche/', key: 'nav.tonight', icon: Moon},
      {to: '/equipo/sesiones/', key: 'nav.sessions', icon: CalendarClock},
      {to: '/equipo/reservaciones/', key: 'nav.bookings', icon: Users},
    ],
  },
  {
    key: 'nav.group.attention',
    links: [
      {to: '/equipo/excepciones/', key: 'nav.exceptions', icon: TriangleAlert, queue: 'exceptions'},
      {to: '/equipo/pedidos/', key: 'nav.requests', icon: Inbox, queue: 'requests'},
    ],
  },
  {
    key: 'nav.group.setup',
    links: [
      {to: '/equipo/experiencias/', key: 'nav.experiences', icon: UtensilsCrossed},
      {to: '/equipo/configuracion/', key: 'nav.settings', icon: SettingsIcon},
      {to: '/equipo/historial/', key: 'nav.history', icon: History},
    ],
  },
];

function section(path: string): string {
  const match = /^\/equipo\/([^/]+)/.exec(path);
  return match ? `/equipo/${match[1]}/` : '/equipo/';
}

/** The open counts of the two queues, refreshed on every section change and after writes. */
function useQueueCounts(me: Me | null, path: string) {
  const exceptions = useQuery<{exceptions: unknown[]}>(me ? '/api/equipo/exceptions' : null);
  const requests = useQuery<{requests: unknown[]}>(me ? '/api/equipo/requests' : null);
  const reloadExceptions = exceptions.reload;
  const reloadRequests = requests.reload;
  const refresh = useCallback(() => {
    void reloadExceptions(true);
    void reloadRequests(true);
  }, [reloadExceptions, reloadRequests]);
  // Each section change reloads quietly; the first load is the queries' own.
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);
  const shown = useRef(path);
  useEffect(() => {
    if (shown.current === path) return;
    shown.current = path;
    latest.current();
  }, [path]);
  const counts: Record<Queue, number> = {
    exceptions: exceptions.query.state === 'ready' ? exceptions.query.data.exceptions.length : 0,
    requests: requests.query.state === 'ready' ? requests.query.data.requests.length : 0,
  };
  return {counts, refresh};
}

function CountBadge({count, current}: {count: number; current?: boolean}) {
  const {t} = useStaffT();
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex min-w-6 items-center justify-center rounded-full border px-1.5 text-sm leading-5',
        numbers,
        current ? 'border-white text-white' : 'border-stone-500 text-ink',
      )}
    >
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{t('nav.count', {count})}</span>
    </span>
  );
}

const linkFocus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function LangButton() {
  const {t, lang, setLang} = useStaffT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
      lang={lang === 'es' ? 'en' : 'es'}
      className={cn(
        'inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100',
        linkFocus,
      )}
    >
      {t('app.lang')}
    </button>
  );
}

function SiteLink() {
  const {t} = useStaffT();
  return (
    <a
      href="/"
      className={cn(
        'inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100',
        linkFocus,
      )}
    >
      {t('staff.viewSite')}
    </a>
  );
}

/** Who is signed in: the role on the button, the email and role in the menu. */
function AccountMenu({me}: {me: Me}) {
  const {t} = useStaffT();
  const role = t(`role.${me.role}`);
  return (
    <M.Root modal={false}>
      <M.Trigger asChild>
        <Button variant="ghost">
          <UserRound aria-hidden="true" />
          <span className="sr-only">{t('staff.accountOf', {email: me.email})} </span>
          {role}
        </Button>
      </M.Trigger>
      <M.Portal container={menuContainer()}>
        <M.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[min(14rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border/50 bg-surface p-1 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_rgba(28,25,23,0.06)]"
        >
          <M.Label className="break-all px-3 py-2 text-sm leading-5 text-muted">
            {t('staff.signedIn', {email: me.email, role})}
          </M.Label>
          <M.Separator className="my-1 h-px bg-border/70" />
          <M.Item
            asChild
            className="flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-2xl px-3 text-sm leading-5 text-ink outline-none data-[highlighted]:bg-stone-100 data-[highlighted]:outline-2 data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-accent"
          >
            <a href="/">{t('staff.viewSite')}</a>
          </M.Item>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

/** Computers: the section links in three groups, separated by hairlines. */
function DesktopNav({current, counts}: {current: string; counts: Record<Queue, number>}) {
  const {t} = useStaffT();
  return (
    <nav aria-label={t('nav.label')} className="hidden pb-2 lg:block">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {NAV.map((group, index) => (
          <div key={group.key} className="flex items-center gap-2">
            {index ? <span aria-hidden="true" className="h-6 w-px bg-border" /> : null}
            <ul aria-label={t(group.key)} className="flex flex-wrap gap-1">
              {group.links.map(link => {
                const active = current === link.to;
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100',
                        linkFocus,
                        active && 'bg-ink text-white hover:bg-ink',
                      )}
                    >
                      {t(link.key)}
                      {link.queue ? <CountBadge count={counts[link.queue]} current={active} /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

/** Below 1024px: the grouped links in a bottom sheet, with the account details at its foot. */
function SectionsSheet({me, current, counts}: {me: Me; current: string; counts: Record<Queue, number>}) {
  const {t} = useStaffT();
  const [open, setOpen] = useState(false);
  // After a link in the sheet navigates, the sheet hands focus back to "Secciones"; send it on
  // to the new page's heading instead, so the change is announced.
  const toHeading = useRef(false);
  const waiting = counts.exceptions + counts.requests > 0;
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        onFocus={() => {
          if (!toHeading.current) return;
          toHeading.current = false;
          document.getElementById('main')?.querySelector<HTMLElement>('h1')?.focus();
        }}
      >
        <MenuIcon aria-hidden="true" />
        {/* Below 23rem the word is read, not shown, so the name keeps its room. */}
        <span className="max-[23rem]:sr-only">{t('nav.sections')}</span>
        {waiting ? (
          <>
            <span aria-hidden="true" className="size-2 rounded-full bg-ink" />
            <span className="sr-only">{t('nav.waiting')}</span>
          </>
        ) : null}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} kind="sheet" title={t('nav.sections')} closeLabel={t('staff.close')}>
        <div className="flex flex-col gap-6">
          <nav aria-label={t('nav.label')} className="flex flex-col gap-5">
            {NAV.map(group => (
              <div key={group.key} className="flex flex-col gap-2">
                <h3 id={`nav-${group.key}`} className={helper}>
                  {t(group.key)}
                </h3>
                <ul aria-labelledby={`nav-${group.key}`} className="flex flex-col gap-1">
                  {group.links.map(link => {
                    const active = current === link.to;
                    const Icon = link.icon;
                    return (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => {
                            toHeading.current = true;
                            setTimeout(() => (toHeading.current = false), 2000);
                            setOpen(false);
                          }}
                          className={cn(
                            'flex min-h-12 items-center gap-3 rounded-2xl px-3 text-base font-medium leading-6 text-ink hover:bg-stone-100',
                            linkFocus,
                            active && 'bg-ink text-white hover:bg-ink',
                          )}
                        >
                          <Icon className="size-5 shrink-0" aria-hidden="true" />
                          <span className="flex-1">{t(link.key)}</span>
                          {link.queue ? <CountBadge count={counts[link.queue]} current={active} /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
            <p className={cn(helper, 'break-all')}>
              {t('staff.signedIn', {email: me.email, role: t(`role.${me.role}`)})}
            </p>
            <div className="-ml-3 flex flex-wrap gap-1">
              <SiteLink />
              <LangButton />
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Frame({me, children}: {me: Me | null; children: ReactNode}) {
  const {t} = useStaffT();
  const {path} = useLocation();
  const current = section(path);
  const {counts, refresh} = useQueueCounts(me, path);
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:bg-surface focus:px-4 focus:py-3 focus:text-ink"
      >
        {t('app.skip')}
      </a>
      <header className="border-b border-border/70 bg-surface">
        {(me ? me.demo : isDemoPage()) ? (
          <div role="note" className="bg-ink px-4 py-2 text-center text-sm font-medium leading-5 text-white">
            {t('staff.demo')}
          </div>
        ) : null}
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-14 items-center justify-between gap-3 py-2 lg:min-h-16">
            <div className="min-w-0 flex-1 [overflow-wrap:break-word]">
              <p className="text-base font-semibold leading-6 text-ink">
                {t('app.name')}
                <span className="hidden font-normal text-muted lg:inline"> · {t('staff.title')}</span>
              </p>
              <p className="text-sm leading-5 text-muted lg:hidden">
                {me ? `${t('staff.title')} · ${t(`role.${me.role}`)}` : t('staff.title')}
              </p>
            </div>
            <div className={cn('flex shrink-0 items-center gap-1', me && 'hidden lg:flex')}>
              <SiteLink />
              <LangButton />
              {me ? <AccountMenu me={me} /> : null}
            </div>
            {me ? (
              <div className="shrink-0 lg:hidden">
                <SectionsSheet me={me} current={current} counts={counts} />
              </div>
            ) : null}
          </div>
          {me ? <DesktopNav current={current} counts={counts} /> : null}
        </div>
      </header>
      <CountsContext.Provider value={refresh}>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-[1280px] px-4 pb-12 pt-6 focus:outline-none sm:px-6 lg:px-8 lg:pt-8"
        >
          {children}
        </main>
      </CountsContext.Provider>
    </div>
  );
}

function Routes() {
  const {path, search} = useLocation();
  const [area, id] = path.replace(/\/+$/, '').split('/').slice(2); // after "/equipo"
  if (!area) return <CalendarView />;
  if (area === 'esta-noche') return <Tonight />;
  if (area === 'sesiones') {
    // /nueva/ is a deep link: the list, with the new-session sheet open.
    if (id === 'nueva') return <SessionsList creating />;
    return id ? <SessionPage key={id} id={id} /> : <SessionsList />;
  }
  if (area === 'reservaciones') {
    // /nueva/?session= is a deep link: the list, with the manual-entry sheet open.
    if (id === 'nueva') return <BookingsList entry={{sessionId: search.get('session')}} />;
    return id ? <BookingPage key={id} id={id} /> : <BookingsList />;
  }
  if (area === 'excepciones') return <Exceptions />;
  if (area === 'pedidos') return <Requests />;
  if (area === 'experiencias') return <Experiences />;
  if (area === 'configuracion') return <Settings />;
  if (area === 'historial') return <HistoryPage />;
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
