import Link from 'next/link';
import type { ReactNode } from 'react';
import { DoorOpen, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { pageBackLink } from '@/lib/page-home';
import { PartPage, PartTop } from './parts';
import s from './set-two.module.css';

/**
 * their-event-line.tsx — THE DARK LINE A SUPPLIER'S PART OF THEIR EVENT OPENS UNDER: "Their event · <couple> · ✕ Close"
 * (owner-approved 21 Nov 2026: supplier pages set two — "pages inside a client open full screen on a phone under the
 * approved dark line" — and the Their event door drawing, `prototypes/their_event_door_2026-11-21/`, "one part's own
 * page for a supplier, with Their event · name · ✕ Close on top"). The supplier twin of the couple side's shipped
 * `CoordinatingLine` (`app/dashboard/[eventId]/_components/coordinating-line.tsx`): same height, same pill, tokens only.
 *
 * Close goes where the ONE back map says the part's page goes (`lib/page-home.ts`) — the client, never a typed address.
 * The couple's name is read honestly: unread, the line says "Their event" alone — never "Unknown" and never a guess.
 */
export function TheirEventLine({
  route,
  eventId,
  eventName,
}: {
  /** The part's own route pattern, as on disk — Close reads its home from the map. */
  route: string;
  eventId: string;
  /** The couple's event name; null when it could not be read. */
  eventName: string | null;
}) {
  const close = pageBackLink(route, { eventId });
  return (
    <div role="note" className={s.line} data-their-event-line="">
      <DoorOpen aria-hidden strokeWidth={1.9} />
      <span className={s.lineName}>
        Their event{eventName ? <> · <b>{eventName}</b></> : null}
      </span>
      {close ? (
        <Link href={close.href} className={s.lineClose} aria-label={`Close — back to ${close.label}`} data-their-event-close="">
          <span>
            <X aria-hidden strokeWidth={2.2} />
            Close
          </span>
        </Link>
      ) : null}
    </div>
  );
}

/** The couple's event name for the line — `null` (said as "Their event") when the read was refused or found no row. */
export async function readTheirEventName(supabase: SupabaseClient, eventId: string): Promise<string | null> {
  const { data, error } = await supabase.from('events').select('display_name').eq('event_id', eventId).maybeSingle();
  if (error) {
    logQueryError('TheirEventLine.eventName', error, { eventId }, 'graceful_degrade');
    return null;
  }
  return (data?.display_name as string | null | undefined) ?? null;
}

/**
 * A part of their event, as one shape: the page column (the house measure, written at the call site), the dark line on a
 * phone, then the top block — the part's title as the page heading, a pill / ⓘ / action at its end, the quiet back from
 * 701, and the part's first line(s) under it. Pages inside a client draw ONLY their body under this.
 */
export function TheirEventPart({
  column,
  mark,
  route,
  eventId,
  eventName,
  title,
  end,
  intro,
  children,
}: {
  column: string;
  mark: string;
  route: string;
  eventId: string;
  eventName: string | null;
  title: ReactNode;
  end?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const back = pageBackLink(route, { eventId });
  return (
    <PartPage column={column} mark={mark}>
      <TheirEventLine route={route} eventId={eventId} eventName={eventName} />
      <PartTop heading={1} title={title} end={end} back={back}>
        {intro}
      </PartTop>
      {children}
    </PartPage>
  );
}
