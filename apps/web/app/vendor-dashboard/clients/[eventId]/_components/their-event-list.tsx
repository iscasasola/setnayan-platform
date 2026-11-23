import Link from 'next/link';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { ASK_FOR_MORE, askForMoreHref, type TheirEventRow } from '@/lib/their-event';

/**
 * 🚪 "THEIR EVENT" — the booked supplier's short list of links to only their open parts (owner 2026-11-21: *"Suppliers
 * see lists of links for different parts of the dashboard."*; drawing `their_event_door_2026-11-21`, frames "Caterer ·
 * their links" · "Florist · their links" · "1 · The same list on the customer page"). The same list in the chat with the
 * hosts and on the customer page. A tap opens that part alone; the Logo is a plain download; the last row asks for more.
 * Nothing locked is shown. Rows come built from `theirEventRows` (lib/their-event.ts) — this only draws.
 */
export function TheirEventList({
  eventId,
  rows,
  hrefOf,
  heading = true,
}: {
  eventId: string;
  rows: readonly TheirEventRow[];
  /**
   * 🖥 Where a row goes when the list is the chat's RIGHT COLUMN on a computer (owner 2026-11-21, "DESKTOP SPLIT VIEW"):
   * a part that opens in the column. Left out, every row goes to its own page, as on a phone.
   */
  hrefOf?: (row: TheirEventRow) => string | null;
  /** The small "Their event" heading — off where the column's own header already says it. */
  heading?: boolean;
}) {
  const cls = 'flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-2 first:border-t-0';
  return (
    <section className="py-2" data-their-event="" aria-labelledby={`their-event-${eventId}`}>
      <h2 id={`their-event-${eventId}`} className={heading ? 'text-xs font-semibold uppercase tracking-wide text-ink/55' : 'sr-only'}>
        Their event
      </h2>
      <ul className="mt-1">
        {rows.map((r) => {
          const body = (
            <>
              <span className="min-w-0">
                <span className="block text-[15px] text-ink">{r.name}</span>
                <span className="block truncate text-[13px] text-ink/60">{r.line}</span>
              </span>
              {r.trail ? <span className="shrink-0 text-[13px] font-medium text-sn-accent">{r.trail}</span> : null}
            </>
          );
          const href = r.download ? r.href : hrefOf ? hrefOf(r) : r.href;
          return (
            <li key={r.part} data-their-event-part={r.part}>
              {href ? (
                r.download ? (
                  <SaveFileLink href={href} filename="logo.svg" className={cls}>
                    {body}
                  </SaveFileLink>
                ) : (
                  <Link href={href} className={cls}>
                    {body}
                  </Link>
                )
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
        <li data-their-event-part="ask">
          <Link href={askForMoreHref(eventId)} className={`${cls} text-[15px] font-medium text-sn-accent`}>
            {ASK_FOR_MORE}
          </Link>
        </li>
      </ul>
    </section>
  );
}
