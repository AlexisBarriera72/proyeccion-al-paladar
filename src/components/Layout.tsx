// The frame every guest page shares: skip link, demo banner, the dark header (the sala), main,
// and the dark footer with its marquee. Pages draw their own band and paper sheet inside main.
import {ArrowUpRight, Info, Menu as MenuIcon, Pause, Play, X} from 'lucide-react';
import {useState, type ReactNode} from 'react';
import {useReducedMotion} from 'motion/react';
import {Link, useLocation} from '../lib/router.tsx';
import {cn} from '../lib/cn.ts';
import {useT} from '../lib/i18n.tsx';
import {useConfig} from '../lib/config.tsx';
import {container} from '../lib/styles.ts';
import {photos} from '../photos.ts';

const INSTAGRAM = 'https://www.instagram.com/proyeccionalpaladarpr/';

export const isDemoPage = () => document.documentElement.dataset.demo === '1';

export function DemoBanner() {
  const {t} = useT();
  const config = useConfig();
  // The Worker marks demo HTML, so the banner is there from the first paint (no late shift).
  if (!(config ? config.demo : isDemoPage())) return null;
  return (
    <div role="note" className="bg-brass text-sala">
      <p className={cn(container, 'flex items-start gap-2 py-2 text-sm font-semibold leading-5')}>
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t('demo.banner')}
      </p>
    </div>
  );
}

const focusOnSala = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass';
// Phones: large Fraunces words in the open menu. From 768px: a quiet row of text links, the
// current one underlined in brass.
const navLink = cn(
  'inline-flex min-h-12 items-center gap-2 rounded-2xl font-display text-[26px] font-medium leading-[1.15] text-on-sala',
  'hover:text-brass aria-[current=page]:text-brass',
  'md:min-h-11 md:rounded-none md:border-b-2 md:border-transparent md:px-1 md:font-sans md:text-sm md:leading-5',
  'md:aria-[current=page]:border-brass md:aria-[current=page]:font-semibold md:aria-[current=page]:text-on-sala',
  '[&_svg]:size-5 md:[&_svg]:size-4 [&_svg]:shrink-0',
  focusOnSala,
);

/** The site's links: Calendario, Condiciones, Instagram and the language switch. */
function SiteLinks({onPick}: {onPick?: () => void}) {
  const {t, lang, setLang} = useT();
  const config = useConfig();
  const {path} = useLocation();
  return (
    <>
      <Link
        to="/"
        onClick={onPick}
        aria-current={path === '/' || path.startsWith('/funciones/') ? 'page' : undefined}
        className={navLink}
      >
        {t('app.calendar')}
      </Link>
      <Link
        to="/politicas/"
        onClick={onPick}
        aria-current={path === '/politicas/' ? 'page' : undefined}
        className={navLink}
      >
        {t('app.policies')}
      </Link>
      <a
        href={config?.instagramUrl ?? INSTAGRAM}
        className={navLink}
        rel="noopener noreferrer"
        target="_blank"
        onClick={onPick}
      >
        {t('app.instagram')}
        <ArrowUpRight aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={() => {
          setLang(lang === 'es' ? 'en' : 'es');
          onPick?.();
        }}
        className={cn(navLink, 'text-left')}
        lang={lang === 'es' ? 'en' : 'es'}
      >
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
    <header data-texture="" className="texture-grain bg-sala text-on-sala">
      {/* Inside the banner landmark, so every line of the page belongs to a landmark. */}
      <DemoBanner />
      <div className={cn(container, 'flex flex-wrap items-center justify-between gap-x-6 py-3')}>
        <Link to="/" className={cn('flex min-h-12 min-w-0 flex-1 basis-0 items-center gap-3 rounded-2xl', focusOnSala)}>
          {logo ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-on-sala">
              <img src={logo.src} width={40} height={40} alt="" className="size-10 rounded-full" />
            </span>
          ) : null}
          <span className="min-w-0 [overflow-wrap:break-word]">
            <span className="block font-display text-[18px] font-medium leading-6 text-on-sala sm:text-[20px]">
              {t('app.name')}
            </span>
            <span className="block text-sm leading-5 text-on-sala-muted">{t('app.tagline')}</span>
          </span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? 'site-menu' : undefined}
          onClick={() => setOpen(value => !value)}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-on-sala/50 px-3 text-sm font-medium leading-5 text-on-sala hover:bg-sala-raised md:hidden',
            'max-[26rem]:w-11 max-[26rem]:justify-center max-[26rem]:px-0 [&_svg]:size-4',
            focusOnSala,
          )}
        >
          {open ? <X aria-hidden="true" /> : <MenuIcon aria-hidden="true" />}
          {/* Below 26rem the word is read, not shown, so the name keeps to one line. */}
          <span className="max-[26rem]:sr-only">{t('app.menu')}</span>
        </button>
        <nav
          id="site-menu"
          aria-label={t('app.nav')}
          className={cn(
            'w-full grid-cols-1 gap-x-6 border-t border-sala-line py-4 min-[24rem]:grid-cols-2',
            'md:flex md:w-auto md:flex-row md:items-center md:gap-6 md:border-0 md:py-0',
            open ? 'grid' : 'hidden',
          )}
        >
          <SiteLinks onPick={() => setOpen(false)} />
        </nav>
      </div>
    </header>
  );
}

/**
 * Their phrase, moving slowly above the footer. It is decoration, so screen readers skip it; it
 * can be paused (WCAG 2.2.2), stops while hovered, and stays still under reduced motion.
 */
function Marquee() {
  const {t} = useT();
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const run = (copy: number) => (
    <span key={copy} className="flex shrink-0">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          lang="es"
          className="flex items-center gap-8 pr-8 font-display text-[26px] italic leading-8 text-on-sala-muted"
        >
          {t('app.motto')}
          <span className="size-1.5 rotate-45 bg-brass" />
        </span>
      ))}
    </span>
  );
  return (
    <div className="flex items-center gap-2 border-b border-sala-line pr-2 sm:pr-4">
      <div aria-hidden="true" data-marquee="" className="min-w-0 flex-1 overflow-hidden py-4">
        <div
          className={cn(
            'flex w-max animate-marquee hover:[animation-play-state:paused] motion-reduce:animate-none',
            paused && '[animation-play-state:paused]',
          )}
        >
          {run(0)}
          {run(1)}
        </div>
      </div>
      {reduce ? null : (
        <button
          type="button"
          aria-pressed={paused}
          aria-label={t('app.marqueePause')}
          onClick={() => setPaused(value => !value)}
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-2xl text-on-sala hover:bg-sala-raised [&_svg]:size-4',
            focusOnSala,
          )}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

const footerLink = cn(
  'inline-flex min-h-11 items-center gap-1 text-sm leading-5 text-on-sala underline underline-offset-4 hover:text-brass [&_svg]:size-4',
  focusOnSala,
);

export function SiteFooter() {
  const {t} = useT();
  const config = useConfig();
  return (
    <footer data-texture="" className="texture-grain bg-sala text-on-sala">
      <Marquee />
      <div className={cn(container, 'flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between')}>
        <div className="space-y-1">
          <p className="font-display text-[28px] font-medium leading-[1.15] text-on-sala">{t('app.name')}</p>
          <p className="text-sm leading-5 text-on-sala-muted">{t('app.tagline')}</p>
          <p className="text-sm leading-5 text-on-sala-muted">{t('app.footerSource')}</p>
        </div>
        <nav aria-label={t('app.footerNav')} className="flex flex-wrap gap-x-5 gap-y-1">
          <Link to="/" className={footerLink}>
            {t('app.calendar')}
          </Link>
          <Link to="/politicas/" className={footerLink}>
            {t('app.policies')}
          </Link>
          <a href={config?.instagramUrl ?? INSTAGRAM} rel="noopener noreferrer" target="_blank" className={footerLink}>
            {t('app.instagram')}
            <ArrowUpRight aria-hidden="true" />
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
      <main id="main" tabIndex={-1} className="w-full flex-1 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
