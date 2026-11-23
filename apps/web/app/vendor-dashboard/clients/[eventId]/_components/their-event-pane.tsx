import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Armchair,
  Clock,
  Eye,
  Footprints,
  Globe,
  Images,
  Info,
  Lock,
  Palette,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { CoordinatingLine } from '@/app/dashboard/[eventId]/_components/coordinating-line';
import { THEIR_EVENT_PART_NAME, type CoordinatorRow, type TheirEventPart, type TheirEventRow } from '@/lib/their-event';
import { TheirEventList } from './their-event-list';
import s from './their-event-pane.module.css';

/**
 * 🖥 THE CHAT'S RIGHT COLUMN ON A COMPUTER (owner 2026-11-21, DECISION_LOG "DESKTOP SPLIT VIEW + ONE EDITOR PER PART —
 * APPROVED TO BUILD"; drawing `prototypes/desktop_split_view_2026-11-21/desktop_split_view_v2_fable.html`, frames 1–2).
 * The chat stays in the left column; this is the right one (`SupplierColumns`, the system's two — drawn from 701, never
 * on a phone, where the list stays above the chat and a part opens full screen as approved).
 *
 *   · {@link CoordinatorPane} — the booked coordinator: "Coordinating <name> · Back to your shop", the event's head, then
 *     the hosts' parts with their marks (Edit · View · "The hosts keep this"). A row opens the hosts' own page.
 *   · {@link TheirEventColumn} — every other booked supplier: the shipped "Their event" list; a tap on Schedule · Numbers
 *     · Guests · Hub opens that part IN this column with a back arrow to the list. Seats and Mood Board are their own
 *     tools and open their own pages; the Logo stays a download.
 */

const ROW_ICON: Readonly<Record<CoordinatorRow['key'], LucideIcon>> = {
  guests: Users,
  seats: Armchair,
  march: Footprints,
  schedule: Clock,
  hub: Globe,
  event_details: Info,
  suppliers: Store,
  mood_board: Palette,
  budget: Wallet,
  memories: Images,
};

function Mark({ mark }: { mark: CoordinatorRow['mark'] }) {
  if (mark === 'edit') return <span className={`${s.pill} ${s.pillEdit}`}>Edit</span>;
  if (mark === 'view')
    return (
      <span className={`${s.pill} ${s.pillView}`}>
        <Eye aria-hidden className={s.pillIcon} />
        View
      </span>
    );
  return <Lock aria-hidden className={s.closed} />;
}

export function CoordinatorPane({
  eventName,
  dateLine,
  placeLine,
  rows,
}: {
  eventName: string | null;
  /** "Sat, Dec 12, 2026 · 21 days" — the brief's date, said by the page. */
  dateLine: string | null;
  /** "Seda Vertis North · 186 guests". */
  placeLine: string | null;
  rows: readonly CoordinatorRow[];
}) {
  return (
    <div className={s.pane} data-their-event-pane="coordinator">
      <CoordinatingLine eventName={eventName} />
      <div className={s.head}>
        {dateLine ? <p className={s.kicker}>{dateLine}</p> : null}
        <h2 className={s.title}>{eventName ?? 'Their event'}</h2>
        {placeLine ? <p className={s.sub}>{placeLine}</p> : null}
      </div>
      <ul className={`sn-frame ${s.list}`}>
        {rows.map((r) => {
          const Icon = ROW_ICON[r.key];
          const body = (
            <>
              <span className={r.mark === 'closed' ? `${s.ic} ${s.icQuiet}` : s.ic}>
                <Icon aria-hidden />
              </span>
              <span className={s.words}>
                <b>{r.name}</b>
                <span>{r.line}</span>
              </span>
              <Mark mark={r.mark} />
            </>
          );
          return (
            <li key={r.key} data-coordinator-row={r.key} data-mark={r.mark}>
              {r.href ? (
                <Link href={r.href} className={s.row}>
                  {body}
                </Link>
              ) : (
                <div className={s.row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TheirEventColumn({
  eventId,
  rows,
  open,
  listHref,
  partHref,
}: {
  eventId: string;
  rows: readonly TheirEventRow[];
  /** The part opened in this column, and its body — null draws the list. */
  open: { part: TheirEventPart; title?: string; body: ReactNode } | null;
  /** The back arrow: this client's chat with the list in the column. */
  listHref: string;
  /** Where a row's tap goes in this column (Schedule · Numbers · Guests · Hub); null = the row's own page. */
  partHref: (part: TheirEventPart) => string | null;
}) {
  if (open) {
    return (
      <div className={s.pane} data-their-event-pane="part" data-their-event-open={open.part}>
        <div className={s.rhead}>
          <Link href={listHref} className={s.back} aria-label="Back to Their event" data-their-event-back="">
            <ArrowLeft aria-hidden />
          </Link>
          <span className={s.rtitle}>{open.title ?? THEIR_EVENT_PART_NAME[open.part]}</span>
        </div>
        {open.body}
      </div>
    );
  }
  return (
    <div className={s.pane} data-their-event-pane="list">
      <div className={s.rhead}>
        <span className={`${s.rtitle} ${s.rtitlePad}`}>Their event</span>
      </div>
      <div className={s.listPad}>
        <TheirEventList eventId={eventId} rows={rows} hrefOf={(r) => (r.href ? (partHref(r.part) ?? r.href) : null)} heading={false} />
      </div>
    </div>
  );
}

