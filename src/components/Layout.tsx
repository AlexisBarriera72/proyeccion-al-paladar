// The frame every guest page shares: skip link, demo banner, header, main, footer.
import {ExternalLink} from 'lucide-react';
import type {ReactNode} from 'react';
import {Link} from '../lib/router.tsx';
import {useT} from '../lib/i18n.tsx';
import {useConfig} from '../lib/config.tsx';
import {photos} from '../photos.ts';

export const isDemoPage = () => document.documentElement.dataset.demo === '1';

export function DemoBanner() {
  const {t} = useT();
  const config = useConfig();
  // The Worker marks demo HTML, so the banner is there from the first paint (no late shift).
  if (!(config ? config.demo : isDemoPage())) return null;
  return (
    <div
      role="note"
      className="border-b border-ink bg-ink px-4 py-2 text-center text-sm font-medium leading-5 text-white"
    >
      {t('demo.banner')}
    </div>
  );
}

export function SiteHeader() {
  const {t, lang, setLang} = useT();
  const config = useConfig();
  const logo = photos.logo;
  return (
    <header className="border-b border-border/70 bg-surface">
      {/* Inside the banner landmark, so every line of the page belongs to a landmark. */}
      <DemoBanner />
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex min-h-11 items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {logo ? (
            <img
              src={logo.src}
              width={40}
              height={40}
              alt=""
              className="size-10 rounded-full border border-border bg-white"
            />
          ) : null}
          <span className="leading-tight">
            <span className="block text-base font-semibold tracking-[-0.01em] text-ink">{t('app.name')}</span>
            <span className="block text-sm leading-5 text-muted">{t('app.tagline')}</span>
          </span>
        </Link>
        <nav aria-label={t('app.name')} className="flex flex-wrap items-center gap-1">
          <Link
            to="/politicas/"
            className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium text-ink hover:bg-stone-100"
          >
            {t('app.policies')}
          </Link>
          <a
            href={config?.instagramUrl ?? 'https://www.instagram.com/proyeccionalpaladarpr/'}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-medium text-ink hover:bg-stone-100"
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            {t('app.instagram')}
          </a>
          <button
            type="button"
            onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
            className="inline-flex min-h-11 items-center rounded-2xl px-3 text-sm font-medium text-ink hover:bg-stone-100"
            lang={lang === 'es' ? 'en' : 'es'}
            aria-label={t('app.langLabel')}
          >
            {t('app.lang')}
          </button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const {t} = useT();
  return (
    <footer className="mx-auto max-w-[1280px] px-4 py-8 text-sm leading-5 text-muted sm:px-6 lg:px-8">
      <p>{t('app.footer')}</p>
      <p>{t('app.footerSource')}</p>
    </footer>
  );
}

export function PageFrame({children}: {children: ReactNode}) {
  const {t} = useT();
  return (
    <div className="min-h-dvh">
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
        className="mx-auto max-w-[1280px] px-4 py-4 focus:outline-none sm:px-6 sm:py-6 lg:px-8"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
