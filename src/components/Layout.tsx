// The frame every guest page shares: skip link, demo banner, header, main, footer.
import {CalendarDays, ExternalLink, Info, Languages, Menu as MenuIcon, ScrollText, X} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import {Link, useLocation} from '../lib/router.tsx';
import {cn} from '../lib/cn.ts';
import {useT} from '../lib/i18n.tsx';
import {useConfig} from '../lib/config.tsx';
import {photos} from '../photos.ts';

const INSTAGRAM = 'https://www.instagram.com/proyeccionalpaladarpr/';

export const isDemoPage = () => document.documentElement.dataset.demo === '1';

export function DemoBanner() {
  const {t} = useT();
  const config = useConfig();
  // The Worker marks demo HTML, so the banner is there from the first paint (no late shift).
  if (!(config ? config.demo : isDemoPage())) return null;
  return (
    <div role="note" className="bg-ink text-white">
      <p className="mx-auto flex max-w-[1280px] items-start gap-2 px-4 py-2 text-sm font-medium leading-5 sm:px-6 lg:px-8">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('demo.banner')}
      </p>
    </div>
  );
}

const navLink =
  'inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-medium leading-5 text-ink hover:bg-stone-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&_svg]:size-4 [&_svg]:shrink-0';
const current = 'aria-[current=page]:bg-stone-100 aria-[current=page]:font-semibold';

/** The site's links: Calendario, Condiciones, Instagram and the language switch. */
function SiteLinks({onPick, className}: {onPick?: () => void; className?: string}) {
  const {t, lang, setLang} = useT();
  const config = useConfig();
  const {path} = useLocation();
  return (
    <>
      <Link
        to="/"
        onClick={onPick}
        aria-current={path === '/' || path.startsWith('/funciones/') ? 'page' : undefined}
        className={cn(navLink, current, className)}
      >
        <CalendarDays aria-hidden="true" />
        {t('app.calendar')}
      </Link>
      <Link
        to="/politicas/"
        onClick={onPick}
        aria-current={path === '/politicas/' ? 'page' : undefined}
        className={cn(navLink, current, className)}
      >
        <ScrollText aria-hidden="true" />
        {t('app.policies')}
      </Link>
      <a
        href={config?.instagramUrl ?? INSTAGRAM}
        className={cn(navLink, className)}
        rel="noopener noreferrer"
        target="_blank"
        onClick={onPick}
      >
        <ExternalLink aria-hidden="true" />
        {t('app.instagram')}
      </a>
      <button
        type="button"
        onClick={() => {
          setLang(lang === 'es' ? 'en' : 'es');
          onPick?.();
        }}
        className={cn(navLink, className)}
        lang={lang === 'es' ? 'en' : 'es'}
      >
        <Languages aria-hidden="true" />
        {t('app.lang')}
      </button>
    </>
  );
}

export function SiteHeader() {
  const {t} = useT();
  const logo = photos.logo;
  // Below 768px the links sit behind "Menú", opening in the page flow (no overlay). Wider: inline.
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-border/70 bg-surface">
      {/* Inside the banner landmark, so every line of the page belongs to a landmark. */}
      <DemoBanner />
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex min-h-12 min-w-0 flex-1 basis-0 items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {logo ? (
            <img
              src={logo.src}
              width={40}
              height={40}
              alt=""
              className="size-10 shrink-0 rounded-full border border-border bg-white"
            />
          ) : null}
          <span className="min-w-0 leading-tight [overflow-wrap:break-word]">
            <span className="block text-base font-semibold tracking-[-0.01em] text-ink">{t('app.name')}</span>
            <span className="block text-sm leading-5 text-muted">{t('app.tagline')}</span>
          </span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? 'site-menu' : undefined}
          onClick={() => setOpen(value => !value)}
          className={cn(
            navLink,
            'shrink-0 border border-stone-400 max-[23rem]:w-11 max-[23rem]:justify-center max-[23rem]:px-0 md:hidden',
          )}
        >
          {open ? <X aria-hidden="true" /> : <MenuIcon aria-hidden="true" />}
          {/* Below 23rem the word is read, not shown, so the name keeps one line. */}
          <span className="max-[23rem]:sr-only">{t('app.menu')}</span>
        </button>
        <nav
          id="site-menu"
          aria-label={t('app.nav')}
          className={cn(
            'w-full flex-col gap-1 border-t border-border/70 py-2 md:flex md:w-auto md:flex-row md:items-center md:border-0 md:py-0',
            open ? 'flex' : 'hidden',
          )}
        >
          <SiteLinks onPick={() => setOpen(false)} className="w-full md:w-auto" />
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const {t} = useT();
  const config = useConfig();
  return (
    <footer className="mt-8 border-t border-border/70">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <div className="space-y-1 text-sm leading-5 text-muted">
          <p className="font-semibold text-ink">{t('app.name')}</p>
          <p>{t('app.footerSource')}</p>
        </div>
        <nav aria-label={t('app.footerNav')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm leading-5">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent"
          >
            {t('app.calendar')}
          </Link>
          <Link
            to="/politicas/"
            className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent"
          >
            {t('app.policies')}
          </Link>
          <a
            href={config?.instagramUrl ?? INSTAGRAM}
            rel="noopener noreferrer"
            target="_blank"
            className="inline-flex min-h-11 items-center text-ink underline underline-offset-4 hover:text-accent"
          >
            {t('app.instagram')}
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function PageFrame({children}: {children: ReactNode}) {
  const {t} = useT();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:bg-surface focus:px-4 focus:py-3 focus:text-ink"
      >
        {t('app.skip')}
      </a>
      <SiteHeader />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-4 focus:outline-none sm:px-6 sm:py-6 lg:px-8"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
