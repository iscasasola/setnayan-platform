import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { CUSTOMER_LANES, type CustomerLane, type PipelineCustomer } from '@/lib/vendor-customer-pipeline';
import { ListPager } from '../../_components/list-pager';
import { SupplierSubmit } from '../../_components/supplier-submit';
import { TodayPill } from '../../_components/supplier-today-first-screen';
import type { Paged } from '@/lib/paginate';
import { formatCount } from '@/lib/format-number';
import { eventLine, type PeopleRowView } from '../people-row';

/**
 * CUSTOMERS › PEOPLE — one list of everyone, the ones waiting on an answer
 * first (supplier redesign S-PR2, 2026-10-10; corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Customers" + § 3;
 * prototype `prototypes/supplier_dashboard_2026-10-08_fable.html` frame 03).
 *
 *   "Waiting first" · Filter ▾
 *   avatar · name · event line · (what they asked about) · stage pill · one line
 *
 * 📋 ROWS, NOT A BOX OF ROWS. Each customer is one hairline row and one tap:
 * an ask opens the conversation, everyone else opens their card.
 *
 * 🔑 THE LANES COME FROM ONE PURE DERIVATION (`lib/vendor-customer-pipeline.ts`)
 * and the row's words from another (`../people-row.ts`), so this file decides
 * nothing about who is booked or what a row says. It draws.
 *
 * ── WHAT WENT, AND WHERE (the plan's "Customers" table) ─────────────────────
 *   · the "Customers" heading — the bar names the page;
 *   · the search box and the round + — the frosted thumb row (`people-thumb.tsx`);
 *   · the ⋯ menu — its doors are the two other segments (Calendar, Availability
 *     → Dates · Quotes, Contracts → Money) and the envelope (Messages); "Book of
 *     business" IS this list now;
 *   · Show ▾ and the counts line — the right column is the next step; the waiting
 *     count is on the People segment, every lane's count is in Filter ▾;
 *   · the per-row dark "next step" pill — the row's one line says the step.
 *
 * ── ONE LIST, NOT TWO ───────────────────────────────────────────────────────
 * Outside clients (dates a shop sold outside Setnayan) and kept notes used to
 * be a second list in the "Clients" fold (`clients/surface.tsx`, retired). They
 * are rows here: an outside client wears an "Outside" pill and opens in place
 * (there is no card to go to); kept notes are one quiet row at the end.
 *
 * ── THE CLOSED LINES ────────────────────────────────────────────────────────
 * A booking ask whose window closed, a flagged delay, a meeting time that
 * passed — Today's "Nothing to answer" list held them and is gone (owner answer
 * 3). Each is the row's own line (`data-people-closed`).
 */

export type OutsideClient = {
  blockId: string;
  /** "Main team" — the schedule that holds the date. */
  schedule: string;
  contact: string | null;
  note: string | null;
};

export type RosterRow = PipelineCustomer & {
  /** The pill, the one line and where the row goes — `peopleRowView`. */
  view: PeopleRowView;
  /** "Wedding" — the event's type in words, or null. */
  eventType: string | null;
  /** The categories this couple asked about (`thread_service_interests`), in words. */
  askedAbout: readonly string[];
  /** Set on a row that is an outside client — it has no card and no thread. */
  outside: OutsideClient | null;
};

export type KeptNote = { noteId: string; body: string; createdAt: string };

/**
 * "Ana & Miguel" → AM. Only a word that starts with a letter or a digit gives an
 * initial — the "&" between two names is not one (it drew "A&").
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return 'SN';
  if (words.length === 1) return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** A TIMESTAMP's Manila calendar day — "Aug 24, 2026". (`fmtDate` is for a `date` column.) */
function fmtStamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}

/**
 * Where pressing the row takes the shop.
 *
 * ⚠ BOTH DESTINATIONS ARE BOUND TO A LOCAL LITERALLY NAMED `href`, AND THAT IS
 * LOAD-BEARING, NOT STYLE. `lint-port-no-lost-controls` finds a route's
 * destinations with a regex that requires the token `href` immediately before
 * the string; a template literal returned straight out of a ternary is
 * invisible to it. *A guard that cannot see a control reads its absence as a
 * deletion.*
 */
function hrefFor(r: RosterRow): string | null {
  if (r.outside) return null;
  if (r.view.opens === 'thread') {
    // An enquiry is accepted or declined on the thread — the customer card is
    // unreachable pre-accept (`get_vendor_event_brief` refuses a shop that holds
    // neither an accepted enquiry nor a booking). A flagged delay is answered
    // there too, in the shop's own words.
    if (!r.threadId) return null;
    const href = `/vendor-dashboard/messages/${r.threadId}`;
    return href;
  }
  // Every other row has a customer card, and the booking ask can be ANSWERED on
  // it. 🔒 `?tab=details` IS NOT DECORATION: a bare client route is a CHAT
  // landing since #5614.
  const href = `/vendor-dashboard/clients/${r.eventId}?tab=details`;
  return href;
}

/** The row's three columns — shared by a customer (a link) and an outside client (a fold). */
function RowBody({ r, tail }: { r: RosterRow; tail?: ReactNode }) {
  return (
    <>
      <span
        aria-hidden
        className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-ink"
        style={{ background: 'var(--sn-gold-100)' }}
      >
        {/* Only a genuinely NAMELESS event wears the neutral mark — initials of
            the fallback word would read like a name. Nothing is masked. */}
        {r.identityRevealed ? initialsOf(r.title) : '·'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium leading-tight text-ink" data-people-name="">
          {r.title}
        </span>
        <span className="block truncate text-[13px] text-ink/60" data-people-event="">
          {r.outside
            ? [fmtDate(r.eventDate), r.outside.schedule].join(' · ')
            : eventLine({ type: r.eventType, date: r.eventDate, place: r.place })}
        </span>
        {r.askedAbout.length > 0 ? (
          <span className="block truncate text-[12px] text-ink/50" data-people-asked="">
            {r.askedAbout.join(' · ')}
          </span>
        ) : null}
      </span>
      <span className="grid max-w-[9.75rem] justify-items-end gap-1 text-right">
        <span className="flex items-center gap-1.5">
          <TodayPill tone={r.view.pill.tone}>{r.view.pill.label}</TodayPill>
          {tail}
        </span>
        {r.view.line ? (
          <span
            className="text-[12px] leading-snug text-ink/60"
            style={
              r.view.lineTone === 'warn'
                ? { color: 'rgb(var(--color-warn))' }
                : r.view.lineTone === 'ok'
                  ? { color: 'rgb(var(--color-ok))' }
                  : undefined
            }
            {...(r.view.closed ? { 'data-people-closed': r.view.closed } : {})}
            data-people-line=""
          >
            {r.view.line}
          </span>
        ) : null}
      </span>
    </>
  );
}

const ROW = 'grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 border-t border-ink/10 py-[11px]';

export function CustomersRoster({
  rows,
  paged,
  query,
  incomplete,
  closedLinesUnread = false,
  pagerKeepParams,
  clearSearchHref,
  counts,
  holdingPerDate,
  filter = null,
  keptNotes = [],
  removeOutside,
}: {
  rows: RosterRow[];
  counts: Record<CustomerLane, number>;
  /**
   * How many people the shop is holding on each date — computed across ALL
   * customers, not just the ones on screen, so filtering to a lane cannot make
   * a clash disappear.
   */
  holdingPerDate: Map<string, number>;
  /**
   * The page being shown. `rows` IS `paged.items` — the page slices, the
   * counts never do (owner 2026-09-19: "if they have 1000 inquiries, they can
   * still manage all and still be able to see the lower parts of the page").
   */
  paged: Paged<RosterRow>;
  /** The name search as the server read it (`?q=`). */
  query: string;
  /** The reads behind the roster could not prove they reached every customer. */
  incomplete: boolean;
  /**
   * The flagged-delay / passed-meeting reads were refused: a row may be missing
   * its line. Said on screen — a row with no flag must not read as "no problem".
   */
  closedLinesUnread?: boolean;
  /** Every param but `page`, so paging keeps the segment, lane and search. */
  pagerKeepParams: string;
  /** This page without the search — where "Clear" goes. */
  clearSearchHref: string;
  /** The page's Filter ▾ (a `PickMenu`) — a slot, so this file stays server-rendered. */
  filter?: ReactNode;
  /** The supplier's own notes whose event has since been removed. Empty when none (or unread). */
  keptNotes?: readonly KeptNote[];
  /** The shipped `removeBlock` — takes an outside client off the list and frees the date. */
  removeOutside?: (formData: FormData) => void | Promise<void>;
}) {
  const total = CUSTOMER_LANES.reduce((n, l) => n + counts[l], 0);
  /*
    Sorted soonest-date-first, so the date a shop has to resolve NEXT is the one
    it reads first — and capped, because a warning that becomes a wall of dates
    stops being a warning.
  */
  const clashes = [...holdingPerDate.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 4);

  return (
    <div id="customers" className="scroll-mt-24" data-customers-people="">
      {/* "Waiting first" — the order of the list, and the one dropdown that narrows it. */}
      {total > 0 ? (
        <p className="home-k2 flex items-center gap-2">
          Waiting first
          <span className="font-medium normal-case tracking-normal text-ink">{filter}</span>
        </p>
      ) : null}

      {closedLinesUnread ? (
        <p role="status" className="py-2 text-[13px]" style={{ color: 'rgb(var(--color-warn))' }} data-people-unread="">
          Flagged delays and missed meeting times couldn&rsquo;t load, so a row may be missing one. Reload to try
          again.
        </p>
      ) : null}

      {/*
        THE EXPOSURE LINE. "A shop holding four couples for one date is exposed
        and nothing shows them that." ⛔ It renders ONLY when a date genuinely
        has more than one, and it names the dates rather than giving a total —
        "14 Feb · 3" is something a person can act on this morning. One warn
        row above the list, no box.
      */}
      {clashes.length > 0 ? (
        <p role="status" className="border-b border-ink/10 py-2.5 text-[13px] leading-snug" style={{ color: 'rgb(var(--color-warn))' }} data-people-clash="">
          <span className="font-semibold">
            {clashes.length === 1
              ? 'One date has more than one customer holding it.'
              : `${formatCount(clashes.length)} dates have more than one customer holding them.`}
          </span>{' '}
          {clashes.map(([date, n]) => `${fmtDate(date)} · ${formatCount(n)}`).join(' · ')}. You can only take one.
        </p>
      ) : null}

      {rows.length === 0 && query.trim() && total > 0 ? (
        <div className="flex flex-wrap items-center gap-3 py-3">
          <p className="min-w-0 flex-1 text-sm text-ink/60">No customer here matches &ldquo;{query.trim()}&rdquo;.</p>
          <ActionButton tone="neutral" icon={<X aria-hidden="true" strokeWidth={1.9} />} label="Clear" name="Clear the search" href={clearSearchHref} />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-sm text-ink/60">
          {total === 0
            ? 'No customers yet. When somebody asks about a date, or books you, they show up here — the ones waiting on an answer first.'
            : 'Nobody in this list right now. Pick Everyone to see the rest.'}
        </p>
      ) : (
        <ul className="[&>li:first-child>*]:border-t-0" data-people-rows="">
          {rows.map((r) => {
            const href = hrefFor(r);
            if (r.outside) {
              // An outside client has no card and no thread: the row opens what
              // the shop wrote down, in place, with the one thing it can do.
              return (
                <li key={`outside:${r.outside.blockId}`}>
                  <details name="people-row" className="group border-t border-ink/10 py-[11px]" data-people-row="outside">
                    <summary className="grid cursor-pointer list-none grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 [&::-webkit-details-marker]:hidden">
                      <RowBody
                        r={r}
                        tail={<ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45 transition-transform group-open:rotate-180" strokeWidth={1.75} />}
                      />
                    </summary>
                    <div className="pb-1 pl-[54px] pt-2 text-[13px] text-ink/70">
                      {r.outside.contact ? <p>{r.outside.contact}</p> : null}
                      {r.outside.note ? <p className="text-ink/55">{r.outside.note}</p> : null}
                      <p className="text-ink/55">Not a Setnayan customer — no chat, no reviews. They hold the date on {r.outside.schedule}.</p>
                      {removeOutside ? (
                        <ConfirmForm
                          action={removeOutside}
                          title="Remove this outside client?"
                          confirmLabel="Remove"
                          message="Their date opens back up — that day becomes bookable on Setnayan again."
                          className="mt-2"
                        >
                          <input type="hidden" name="return_to" value="clients" />
                          <input type="hidden" name="block_id" value={r.outside.blockId} />
                          <SupplierSubmit tone="danger" icon={<Trash2 aria-hidden="true" strokeWidth={1.9} />} label="Remove" pendingLabel="Removing…" />
                        </ConfirmForm>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            }
            return (
              <li key={`${r.lane}:${r.eventId}`}>
                {href ? (
                  <Link href={href} className={ROW} data-people-row={r.lane}>
                    <RowBody r={r} />
                  </Link>
                ) : (
                  <div className={ROW} data-people-row={r.lane}>
                    <RowBody r={r} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* The pager: "1–20 of 1,000 · ‹ Prev · 1 2 … 50 · Next ›" — the shared
          one, so this list pages exactly like every other supplier list. */}
      <ListPager
        paged={paged}
        param="page"
        keepParams={pagerKeepParams}
        hash="customers"
        noun="customers"
        incomplete={incomplete}
      />

      {/*
        KEPT NOTES — history without a name attached to it (owner 2026-08-24:
        "the supplier keeps the note, but it stops being filed under that
        person's name"). One quiet row at the end of the list. Drawn ONLY when
        there is something to show and the read succeeded: an empty row would be
        noise on a normal account, or a false "you wrote none" after a refused
        read.
      */}
      {keptNotes.length > 0 ? (
        <details name="people-row" className="group border-t border-ink/10" data-people-kept-notes="">
          <summary className="home-row cursor-pointer list-none !border-t-0 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="home-t block truncate text-[15px] leading-tight text-ink">Kept notes</span>
              <span className="block truncate text-[13px] text-ink/60">
                {formatCount(keptNotes.length)} {keptNotes.length === 1 ? 'note' : 'notes'} · their event has been removed
              </span>
            </span>
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45 transition-transform group-open:rotate-180" strokeWidth={1.75} />
          </summary>
          <div className="pb-3">
            <p className="text-[13px] text-ink/55">
              You keep what you wrote; it is no longer filed under anyone&rsquo;s name.
            </p>
            <ul className="mt-1 [&>li:first-child]:border-t-0">
              {keptNotes.map((n) => (
                <li key={n.noteId} className="border-t border-ink/10 py-2.5">
                  <p className="whitespace-pre-wrap text-sm text-ink/80">{n.body}</p>
                  <p className="mt-0.5 text-[12px] text-ink/50">Written {fmtStamp(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </div>
  );
}
