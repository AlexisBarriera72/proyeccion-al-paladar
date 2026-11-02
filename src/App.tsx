// The app shell: language, public config, reduced motion, routes. The staff area is a separate
// chunk, loaded only on /equipo.
import {lazy, Suspense, useEffect} from 'react';
import {MotionConfig} from 'motion/react';
import {LangProvider, useT} from './lib/i18n.tsx';
import {ConfigProvider} from './lib/config.tsx';
import {hasNavigated, useLocation} from './lib/router.tsx';
import {PageFrame} from './components/Layout.tsx';
import {CalendarPage} from './public/CalendarPage.tsx';
import {NotFound} from './public/NotFound.tsx';

const StaffApp = lazy(() => import('./staff/StaffApp.tsx'));
const ManagePage = lazy(() => import('./public/ManagePage.tsx').then(module => ({default: module.ManagePage})));
const PoliciesPage = lazy(() => import('./public/PoliciesPage.tsx').then(module => ({default: module.PoliciesPage})));

const visible = (element: HTMLElement) =>
  typeof element.checkVisibility === 'function' ? element.checkVisibility() : element.getClientRects().length > 0;

/**
 * After an in-app navigation, focus the new page's main heading so it is announced. It renders
 * inside the page's Suspense boundary, so it runs once the page's code has loaded, and it waits a
 * moment for a heading that appears after the page's data, unless the person moves focus first.
 */
function FocusOnNavigate({path}: {path: string}) {
  useEffect(() => {
    if (!hasNavigated()) return;
    const start = document.activeElement;
    let tries = 0;
    let frame = 0;
    const attempt = () => {
      const moved = document.activeElement !== start && document.activeElement !== document.body;
      if (moved) return;
      const main = document.getElementById('main');
      const heading = [main?.querySelector<HTMLElement>('[data-focus]'), main?.querySelector<HTMLElement>('h1')].find(
        (element): element is HTMLElement => Boolean(element && visible(element)),
      );
      if (heading) heading.focus({preventScroll: true});
      else if (++tries < 120) frame = requestAnimationFrame(attempt);
      else main?.focus({preventScroll: true});
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [path]);
  return null;
}

function StaffLoading() {
  const {t} = useT();
  return (
    <p className="p-6 text-sm leading-5 text-muted" aria-busy="true">
      {t('app.loading')}
    </p>
  );
}

function PageLoading() {
  const {t} = useT();
  // The band's place, so the page that loads lands where this was.
  return (
    <div aria-busy="true" className="h-40 bg-sala sm:h-56">
      <p className="sr-only">{t('app.loading')}</p>
    </div>
  );
}

function Routes() {
  const {path} = useLocation();

  if (path === '/equipo' || path.startsWith('/equipo/')) {
    return (
      <Suspense fallback={<StaffLoading />}>
        <StaffApp path={path} />
        <FocusOnNavigate key={path} path={path} />
      </Suspense>
    );
  }

  const session = /^\/funciones\/([A-Za-z0-9_-]{1,80})\/?$/.exec(path);
  const manage = /^\/reservacion\/([^/]{1,100})\/?$/.exec(path);
  let page;
  if (path === '/') page = <CalendarPage sessionId={null} />;
  else if (session) page = <CalendarPage sessionId={session[1]} />;
  else if (manage) page = <ManagePage key={manage[1]} token={manage[1]} />;
  else if (path === '/politicas' || path === '/politicas/') page = <PoliciesPage />;
  else page = <NotFound />;
  return (
    <PageFrame>
      <Suspense fallback={<PageLoading />}>
        {page}
        <FocusOnNavigate key={path} path={path} />
      </Suspense>
    </PageFrame>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LangProvider>
        <ConfigProvider>
          <Routes />
        </ConfigProvider>
      </LangProvider>
    </MotionConfig>
  );
}
