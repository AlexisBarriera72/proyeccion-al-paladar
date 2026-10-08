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

/** After an in-app navigation, focus the new page's main heading so it is announced. */
function useFocusOnNavigate(path: string) {
  useEffect(() => {
    if (!hasNavigated()) return;
    const frame = requestAnimationFrame(() => {
      const main = document.getElementById('main');
      const target =
        main?.querySelector<HTMLElement>('[data-focus]') ?? main?.querySelector<HTMLElement>('h1') ?? main ?? null;
      target?.focus({preventScroll: true});
    });
    return () => cancelAnimationFrame(frame);
  }, [path]);
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
  return (
    <div aria-busy="true" className="mx-auto h-64 max-w-2xl rounded-2xl bg-stone-100">
      <p className="sr-only">{t('app.loading')}</p>
    </div>
  );
}

function Routes() {
  const {path} = useLocation();
  useFocusOnNavigate(path);

  if (path === '/equipo' || path.startsWith('/equipo/')) {
    return (
      <Suspense fallback={<StaffLoading />}>
        <StaffApp path={path} />
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
      <Suspense fallback={<PageLoading />}>{page}</Suspense>
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
