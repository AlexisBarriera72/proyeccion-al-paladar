// Link previews for a session's page (/funciones/:id): crawlers don't run JavaScript, so the
// Worker writes the session's title and date into the HTML. Only published or cancelled
// sessions get them; the text is set as text (escaped by HTMLRewriter).
import {formatLongDate, formatTime} from '../shared/time.ts';
import type {PublicSession} from '../shared/types.ts';

export function sessionMeta(session: PublicSession): {title: string; description: string} {
  const when =
    session.startsAt === null
      ? 'Fecha por confirmar'
      : `${formatLongDate(session.startsAt, 'es')}, ${formatTime(session.startsAt, 'es')} (hora de Puerto Rico)`;
  const status = session.availability === 'cancelled' ? ' Función cancelada.' : '';
  return {
    title: `${session.title.es} · Proyección al Paladar`,
    description: `${when}.${status} Cine gastronómico en Aguada.`,
  };
}

interface RewriterElement {
  setAttribute(name: string, value: string): void;
  setInnerContent(content: string): void;
}
interface Rewriter {
  on(selector: string, handlers: {element(element: RewriterElement): void}): Rewriter;
  transform(response: Response): Response;
}
// HTMLRewriter is a Workers runtime global; reached through globalThis so tests typecheck too.
const rewriter = () => new (globalThis as unknown as {HTMLRewriter: new () => Rewriter}).HTMLRewriter();

export function withSessionMeta(response: Response, session: PublicSession, pageUrl: string): Response {
  const meta = sessionMeta(session);
  const content = (value: string) => ({
    element(element: RewriterElement) {
      element.setAttribute('content', value);
    },
  });
  return rewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', content(meta.description))
    .on('meta[property="og:title"]', content(meta.title))
    .on('meta[property="og:description"]', content(meta.description))
    .on('meta[property="og:url"]', content(pageUrl))
    .transform(response);
}
