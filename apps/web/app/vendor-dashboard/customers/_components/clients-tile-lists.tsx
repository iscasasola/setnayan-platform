import { formatPhp } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import type { MoneyRow } from '@/lib/vendor-money';
import { DatesRow } from './dates-row';
import { clientPageHref, meetingWhen, type ClientMeeting } from '../clients-tiles';

/**
 * 🗂 THE LISTS BEHIND THE CLIENTS LIST'S TILES (v113 `listAll()`, spec §9 #7) — what Schedules · To collect · Overdue ·
 * Unread show IN PLACE when pressed. Every row is the shared `DatesRow` (the Dates and Money row), and every row opens
 * the picked client on the page that holds the fact (Schedule · Payment · Chat). Nothing here reads.
 *
 * HONEST: a list the page could not read says so — never an empty "nothing here" over a refused read.
 */

const COULD_NOT = 'Couldn’t load this list. Reload the page to try again.';

export function MeetingsList({
  meetings,
  nameOf,
  failed,
}: {
  meetings: readonly ClientMeeting[];
  nameOf: (eventId: string) => string;
  failed: boolean;
}) {
  return (
    <div data-clients-list="schedules">
      {failed && meetings.length === 0 ? (
        <p role="status" className="py-3 text-[14px] text-ink/70">
          {COULD_NOT}
        </p>
      ) : meetings.length === 0 ? (
        <p className="py-3 text-[14px] text-ink/70">No meetings coming up. A tasting or a visit you set with a client shows here.</p>
      ) : (
        meetings.map((m) => (
          <DatesRow
            key={m.appointmentId}
            data="clients-meeting"
            title={nameOf(m.eventId)}
            line={`${m.label} · ${meetingWhen(m.scheduledAt)}`}
            badge={m.status === 'confirmed' ? { tone: 'ok', word: 'Confirmed' } : { tone: 'wait', word: 'Proposed' }}
            href={clientPageHref(m.eventId, 'schedule')}
          />
        ))
      )}
      {failed && meetings.length > 0 ? <p className="pt-2 text-[13px] text-ink/70">Some meetings couldn’t load.</p> : null}
    </div>
  );
}

export function PaymentsList({ rows, failed, data, empty }: { rows: readonly MoneyRow[]; failed: boolean; data: string; empty: string }) {
  return (
    <div data-clients-list={data}>
      {failed ? (
        <p role="status" className="py-3 text-[14px] text-ink/70">
          Some payments couldn’t load, so this list is not shown. Reload the page to try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-[14px] text-ink/70">{empty}</p>
      ) : (
        rows.map((r) => (
          <DatesRow
            key={r.key}
            data="clients-payment"
            title={r.title}
            line={r.line}
            strong={<span className="text-[15px]">{formatPhp(r.amountPhp)}</span>}
            badge={r.badge}
            href={clientPageHref(r.eventId, 'payments')}
          />
        ))
      )}
    </div>
  );
}

export function UnreadList({
  rows,
  countOf,
  failed,
}: {
  rows: readonly { eventId: string; title: string; threadId: string | null }[];
  countOf: (threadId: string) => number;
  failed: boolean;
}) {
  return (
    <div data-clients-list="unread">
      {failed && rows.length === 0 ? (
        <p role="status" className="py-3 text-[14px] text-ink/70">
          {COULD_NOT}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-[14px] text-ink/70">All read.</p>
      ) : (
        rows.map((r) => {
          const n = r.threadId ? countOf(r.threadId) : 0;
          return (
            <DatesRow
              key={r.eventId}
              data="clients-unread"
              title={r.title}
              line={`${formatCount(n)} unread ${n === 1 ? 'message' : 'messages'}`}
              href={clientPageHref(r.eventId, 'chat')}
            />
          );
        })
      )}
    </div>
  );
}
