// The Worker: guards first, then routes. Every response it returns carries the security
// headers (worker/http.ts); `_headers` only covers assets served without the Worker.
import {accessEmail, staffIdentity} from './access.ts';
import {clock, databaseMarkerProblem, environmentProblem, type Env} from './env.ts';
import {error, withSecurityHeaders, type HeaderOptions} from './http.ts';
import {handlePublic} from './public-api.ts';
import {handleStaff} from './staff-api.ts';
import {publicSession} from './views.ts';
import {withDemoMark, withSessionMeta} from './meta.ts';

const text = (body: string, status: number) =>
  new Response(body, {status, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}});

const page = (title: string, body: string, status: number) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family: Arial, sans-serif; background:#fafaf9; color:#1c1917; padding:24px"><h1 style="font-size:24px">${title}</h1><p>${body}</p></body></html>`,
    {status, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}},
  );

/** The SPA's index.html (the client router takes over). */
/** HTML and assets from dist/; demo HTML is marked so the page knows before any API call. */
async function asset(env: Env, request: Request): Promise<Response> {
  const response = await env.ASSETS!.fetch(request);
  return env.DEMO_MODE === '1' ? withDemoMark(response) : response;
}

async function shell(env: Env, request: Request): Promise<Response> {
  const url = new URL('/', request.url);
  return asset(env, new Request(url, {headers: request.headers}));
}

async function limited(binding: Env['SUBMIT_LIMITER'], request: Request): Promise<boolean> {
  if (!binding) return false;
  const key = request.headers.get('cf-connecting-ip') || 'local';
  return !(await binding.limit({key})).success;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const pitch = env.APP_ENV !== 'production';
    const secure = (response: Response, options: Partial<HeaderOptions> = {}) => {
      const out = withSecurityHeaders(response, {noIndex: pitch, ...options});
      if (path.startsWith('/assets/') && out.status === 200) {
        out.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      }
      return out;
    };
    const privateOptions = {noIndex: true, noStore: true};

    // 1. Fail closed on a misconfigured environment or a database from another environment.
    const problem = environmentProblem(env) ?? (await databaseMarkerProblem(env));
    if (problem) {
      console.error('refusing requests:', problem);
      return secure(text('Servicio no disponible.', 503), privateOptions);
    }

    // 2. The demo: the Access token is checked on every request, assets included.
    if (env.ACCESS_EVERYWHERE === '1' && !(await accessEmail(request, env))) {
      return secure(text('Acceso restringido.', 403), privateOptions);
    }

    const now = clock(env, request);
    try {
      if (path.startsWith('/api/public/')) {
        const limiter = request.method === 'GET' ? env.READ_LIMITER : env.SUBMIT_LIMITER;
        if (await limited(limiter, request)) return secure(error('rate_limited', 429, {}), privateOptions);
        return secure(await handlePublic(request, url, {env, db: env.DB!, now}), privateOptions);
      }
      if (path.startsWith('/api/equipo/')) {
        const staff = await staffIdentity(request, env);
        if (!staff) return secure(error('staff_only', 403), privateOptions);
        return secure(await handleStaff(request, url, {env, db: env.DB!, now, staff}), privateOptions);
      }
      if (path.startsWith('/api/')) return secure(error('not_found', 404), privateOptions);

      if (path === '/equipo' || path.startsWith('/equipo/')) {
        // Access guards these paths in production; the Worker checks the token again.
        const staff = await staffIdentity(request, env);
        if (!staff) {
          return secure(page('Sin acceso al área del equipo', 'Entra con un correo del equipo.', 403), privateOptions);
        }
        return secure(await shell(env, request), privateOptions);
      }
      if (path.startsWith('/reservacion/')) {
        return secure(await shell(env, request), {...privateOptions, noReferrer: true});
      }
      const fn = /^\/funciones\/([A-Za-z0-9_-]{1,80})\/?$/.exec(path);
      if (fn) {
        const session = await publicSession(env.DB!, now, fn[1]);
        const html = await shell(env, request);
        return secure(session ? withSessionMeta(html, session, url.href) : html);
      }
      return secure(await asset(env, request));
    } catch (failure) {
      console.error(failure);
      return secure(error('server_error', 500), privateOptions);
    }
  },
};
