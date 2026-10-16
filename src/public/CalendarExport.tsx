// "Añadir a mi calendario" (.ics, built in the browser from the server's status) and a Google
// Calendar link. A request that holds no seats is exported as TENTATIVE and says so.
import {useEffect, useMemo, useState} from 'react';
import {CalendarPlus} from 'lucide-react';
import type {BookingStatus, PublicSession} from '../../shared/types.ts';
import {buildIcs, googleCalendarUrl, icsStatusFor} from '../../shared/ics.ts';
import {useT} from '../lib/i18n.tsx';
import {pick} from '../lib/format.ts';
import {buttonVariants} from '../components/ui/button.tsx';

export function CalendarExport({
  session,
  status,
  reference,
  partySize,
  manageUrl,
  full = false,
}: {
  session: PublicSession;
  status: BookingStatus;
  reference: string;
  partySize: number;
  manageUrl: string | null;
  /** Full-width buttons, stacked, for a column of actions. */
  full?: boolean;
}) {
  const {t, lang} = useT();
  const icsStatus = icsStatusFor(status);
  const title = pick(session.title, lang);
  const people = partySize === 1 ? t('flow.person') : t('flow.people', {count: partySize});
  const event = useMemo(
    () =>
      session.startsAt === null
        ? null
        : {
            start: session.startsAt,
            end: session.endsAt,
            summary: icsStatus === 'CONFIRMED' ? title : t('result.icsPending', {title}),
            description: `${reference}. ${
              icsStatus === 'CONFIRMED' ? t('result.icsConfirmedNote', {count: people}) : t('result.icsPendingNote')
            }`,
            location: session.venue ? [session.venue.name, session.venue.address].filter(Boolean).join(', ') : null,
            url: manageUrl,
          },
    [session, icsStatus, title, reference, people, manageUrl, t],
  );
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    if (!event) return;
    const ics = buildIcs({...event, uid: `${reference}@proyeccionalpaladar`, status: icsStatus, stamp: Date.now()});
    const url = URL.createObjectURL(new Blob([ics], {type: 'text/calendar;charset=utf-8'}));
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [event, reference, icsStatus]);
  if (!event || status === 'cancelled') return null;
  return (
    <div className={full ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'}>
      {href ? (
        <a
          href={href}
          download={`proyeccion-al-paladar-${reference}.ics`}
          className={buttonVariants({variant: 'secondary', width: full ? 'full' : 'auto'})}
        >
          <CalendarPlus aria-hidden="true" />
          {t('result.ics')}
        </a>
      ) : null}
      <a
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({variant: 'ghost', width: full ? 'full' : 'auto'})}
      >
        {t('result.google')}
      </a>
    </div>
  );
}
