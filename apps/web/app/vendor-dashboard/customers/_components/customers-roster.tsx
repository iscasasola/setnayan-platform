import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  CUSTOMER_LANES,
  waitingDays,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { lockRequestFuseLabel } from '@/lib/lock-request-state';
import { normalizeSearchText } from '@/lib/paginate';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { ListPager } from '../../_components/list-pager';
import type { Paged } from '@/lib/paginate';
import { formatCount } from '@/lib/format-number';

/**
 * CUSTOMERS › PEOPLE — the roster, opening on who is waiting (S-PR2, corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3 "People: one row per
 * customer (avatar · name · event line · stage pill · one-line next step),
 * Filter ▾, thumb row = search (≥60 %) + Add"; prototype frame 03).
 *
 * 🔑 THE LANES COME FROM ONE PURE DERIVATION (`lib/vendor-customer-pipeline.ts`)
 * so this file decides nothing about who is booked. It draws.
 *
 * ── THE LOOK (owner 2026-10-12, "APPROVE ALL" look calls 7 + 8) ──────────────
 * A list is HAIRLINE ROWS with a terracotta arrow — no tile around it, no box
 * around a row. The stage is the shared `Badge` (soft fill, no border). The
 * row's right column is ONE line: the next step or the money — never a choice
 * of columns (Show ▾ is gone, plan § 2: "the right column shows the next step;
 * money and days live in the other two segments"). No button inside the row:
 * the whole row is the one tap, and it goes where the step is taken.
 *
 * ── FILTER ▾ — ONE DROPDOWN (owner-APPROVED 2026-10-01, kept by the plan) ────
 * It sits in the "Waiting first" eyebrow (frame 03). A SLOT handed in by the
 * page, so this file stays a server component a unit test can render.
 *
 * Search and Add are NOT here: they float in the thumb row (kind 30 + the brand
 * Add), drawn by the page. The ⋯ menu is gone — its doors are the two other
 * segments and the customer card (plan § 2).
 */

/** The stage, as the badge says it — one word or two. */
const LANE_BADGE: Record<CustomerLane, { word: string; tone: BadgeTone }> = {
  waiting: { word: 'Asked', tone: 'wait' },
  holding: { word: 'Holding', tone: 'wait' },
  talking: { word: 'Talking', tone: 'quiet' },
  booked: { word: 'Booked', tone: 'ok' },
  finished: { word: 'Done', tone: 'quiet' },
};

export type RosterRow = PipelineCustomer & {
  /**
   * The right-hand line under the badge for a booked or finished row — the
   * money, already worded by the page (`moneyNote`). Null on every other lane:
   * those rows say their next step instead.
   */
  note: { text: string; tone: 'quiet' | 'ok' | 'warn' } | null;
  /** The kind of event, in words ("Wedding"), or null when the event has none. */
  kind: string | null;
  /** A quote is out with them (sent or viewed) — "Quoted", not "Talking". */
  quoted: boolean;
  /** They booked this shop before (`chat_threads.is_returning`). */
  returning: boolean;
};

/** The badge for a row — a booking ask is "Booking", a sent quote "Quoted". */
export function rosterBadge(r: RosterRow): { word: string; tone: BadgeTone } {
  if (r.waitingKind === 'booking_ask') return { word: 'Booking', tone: 'wait' };
  if (r.lane === 'talking' && r.quoted) return { word: 'Quoted', tone: 'quiet' };
  return LANE_BADGE[r.lane];
}

/**
 * The words of a row's next step — what pressing it is FOR. It goes where the
 * row goes (`hrefFor`); it opens the place the step is taken, it never takes
 * it: a booking ask is answered on the customer card, with the fee shown
 * before Agree.
 */
export function nextStepLabel(r: RosterRow): string {
  if (r.waitingKind === 'inquiry') return 'Reply';
  if (r.waitingKind === 'booking_ask') return 'Agree';
  if (r.lane === 'holding') return 'Follow up';
  if (r.lane === 'talking') return r.quoted ? 'See the quote' : 'Send a quote';
  if (r.lane === 'booked') return 'See the day';
  return 'Open';
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'Date not set';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function initialsOf(name: string): string {
  const words = name.trim().split(/[\s&]+/).filter(Boolean);
  if (words.length === 0) return 'SN';
  if (words.length === 1) return (words[0]!.slice(0, 2) || 'SN').toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/**
 * Where pressing the row actually takes the shop — its NEXT ACTION, per lane.
 *
 * ⚠ BOTH DESTINATIONS ARE BOUND TO A LOCAL LITERALLY NAMED `href`, AND THAT IS
 * LOAD-BEARING, NOT STYLE. `lint-port-no-lost-controls` finds a route's
 * destinations with a regex that requires the token `href` immediately before
 * the string; a template literal returned straight out of a ternary is
 * invisible to it. *A guard that cannot see a control reads its absence as a
 * deletion.*
 */
export function hrefFor(r: RosterRow): string | null {
  if (r.lane === 'waiting' && r.waitingKind === 'inquiry') {
    // Accept / decline lives on the thread. The customer card is unreachable
    // pre-accept — `get_vendor_event_brief` refuses a shop that holds neither an
    // accepted enquiry nor a booking — so sending them there would be a door
    // that bounces straight back.
    if (!r.threadId) return null;
    const href = `/vendor-dashboard/messages/${r.threadId}`;
    return href;
  }
  // Every other lane has a customer card, and the booking ask can be ANSWERED
  // on it (PR-H slice B put Agree / Turn it down there).
  // 🔒 `?tab=details` IS NOT DECORATION. A bare client route is a CHAT landing
  // since #5614 — without it every row went to the chat and the customer card
  // had no door on this page.
  const href = `/vendor-dashboard/clients/${r.eventId}?tab=details`;
  return href;
}

/**
 * The row's ONE right-hand line: what is waiting, or the money.
 * "waiting 3 days" · "2 days left to answer" · "quiet 9 days" · "quote pending"
 * · "Balance ₱42,000" — never an unmeasured number.
 */
export function rowLine(r: RosterRow, nowMs: number): { text: string; tone: 'quiet' | 'ok' | 'warn' } | null {
  if (r.waitingKind === 'booking_ask') {
    // The fuse from the MATERIALIZED deadline the trigger stamped — the number
    // shown is the number enforced, in the ONE shared phrasing.
    const fuse = lockRequestFuseLabel(r.expiresAt, new Date(nowMs));
    return { text: fuse ?? 'asked to book', tone: 'warn' };
  }
  if (r.lane === 'waiting') {
    const days = waitingDays(r.waitingSince, nowMs);
    if (days === null) return { text: 'asked', tone: 'warn' };
    return { text: days === 0 ? 'asked today' : `waiting ${formatCount(days)} day${days === 1 ? '' : 's'}`, tone: 'warn' };
  }
  if (r.lane === 'holding') {
    // `quietDays` is what PUT this customer here, so it is never null on a
    // holding row — but it is read defensively: a row is worth showing without
    // its age and is not worth crashing a page over.
    return r.quietDays === null ? null : { text: `quiet ${formatCount(r.quietDays)} days`, tone: 'quiet' };
  }
  if (r.lane === 'talking') return { text: r.quoted ? 'quote pending' : 'no quote yet', tone: 'quiet' };
  return r.note;
}

/** The name, with the searched letters terracotta (kind 30: "matching letters terracotta"). */
function Marked({ text, query }: { text: string; query: string }): ReactNode {
  const q = normalizeSearchText(query);
  if (!q) return text;
  // Accents and case are ignored by the search, so match on the same folded
  // text — one character of the folded string is one of the original.
  const folded = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const word = q.split(' ').find((w) => w && folded.includes(w));
  if (!word || folded.length !== text.length) return text;
  const at = folded.indexOf(word);
  return (
    <>
      {text.slice(0, at)}
      <mark data-search-hit="" className="bg-transparent font-bold text-sn-accent">
        {text.slice(at, at + word.length)}
      </mark>
      {text.slice(at + word.length)}
    </>
  );
}

const LINE_TONE: Record<'quiet' | 'ok' | 'warn', string | undefined> = {
  quiet: undefined,
  ok: 'rgb(var(--color-ok))',
  warn: 'rgb(var(--color-warn))',
};

/** One customer — avatar · name · event line · badge + one line · the arrow. No box. */
export function RosterRowView({ r, nowMs, query }: { r: RosterRow; nowMs: number; query: string }) {
  const href = hrefFor(r);
  const badge = rosterBadge(r);
  const line = rowLine(r, nowMs);
  const eventLine = [r.kind, fmtDate(r.eventDate), r.place, r.returning ? 'returning' : null]
    .filter(Boolean)
    .join(' · ');
  const inner = (
    <>
      <span
        aria-hidden
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-[13px] font-semibold text-ink/70"
      >
        {/*
          Only a genuinely NAMELESS event wears the neutral mark — initials of
          the fallback word would read like a name. Nothing is masked any more
          (owner 2026-09-08, 2026-09-19).
        */}
        {r.identityRevealed ? initialsOf(r.title) : '·'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium leading-tight text-ink">
          <Marked text={r.title} query={query} />
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink/60">{eventLine}</span>
      </span>
      <span className="flex min-w-0 max-w-[9.5rem] flex-col items-end gap-1 text-right">
        <Badge tone={badge.tone} data="customer-stage">
          {badge.word}
        </Badge>
        {line ? (
          <span className="max-w-full truncate text-[12.5px] text-ink/60" style={{ color: LINE_TONE[line.tone] }} data-row-line="">
            {line.text}
          </span>
        ) : null}
      </span>
      {href ? (
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-sn-accent" strokeWidth={2} />
      ) : (
        <span aria-hidden className="w-4" />
      )}
    </>
  );
  const rowClass =
    'grid min-h-[64px] grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-ink/10 py-2.5';
  return href ? (
    <Link href={href} className={`sn-press ${rowClass}`} aria-label={`${r.title} — ${nextStepLabel(r)}`} data-customer-row={r.lane}>
      {inner}
    </Link>
  ) : (
    <div className={rowClass} data-customer-row={r.lane}>
      {inner}
    </div>
  );
}

export function CustomersRoster({
  rows,
  paged,
  query,
  incomplete,
  pagerKeepParams,
  counts,
  nowMs,
  /**
   * How many people the shop is holding on each date — computed across ALL
   * customers, not just the ones on screen, so filtering to a lane cannot make
   * a clash disappear.
   */
  holdingPerDate,
  filter = null,
  /** True while Filter ▾ shows only outside clients — the Setnayan rows step aside. */
  hidden = false,
  /** Outside clients that match the search — so "No one named …" is said only when NOBODY matched. */
  otherMatches = 0,
}: {
  rows: RosterRow[];
  counts: Record<CustomerLane, number>;
  nowMs: number;
  holdingPerDate: Map<string, number>;
  /**
   * The page being shown. `rows` IS `paged.items` — the page slices, the
   * counts never do (owner 2026-09-19: "if they have 1000 inquiries, they can
   * still manage all and still be able to see the lower parts of the page").
   */
  paged: Paged<RosterRow>;
  /** The name search as typed (`?q=`) — its letters are marked on the rows. */
  query: string;
  /** The reads behind the roster could not prove they reached every customer. */
  incomplete: boolean;
  /** Every param but `page`, so paging keeps the lane, segment and search. */
  pagerKeepParams: string;
  /** The page's Filter ▾ (a `PickMenu`) — a slot, so this file stays server-rendered. */
  filter?: ReactNode;
  hidden?: boolean;
  otherMatches?: number;
}) {
  const total = CUSTOMER_LANES.reduce((n, l) => n + counts[l], 0);
  const q = query.trim();
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
      {/* "WAITING FIRST · Everyone ▾" — the order is said, and the one dropdown narrows it (frame 03). */}
      <div className="home-k2 flex min-h-11 items-center gap-3" data-customers-eyebrow="">
        <span>Waiting first</span>
        {filter}
      </div>

      {/*
        THE EXPOSURE LINE — one warn ROW above the list (plan § 2: "Date-clash
        banner — Keep, as one warn row above the list"), not a box.

        "A shop holding four couples for one date is exposed and nothing shows
        them that." ⛔ It renders ONLY when a date genuinely has more than one,
        and it names the dates rather than giving a total — "14 Feb · 3" is
        something a person can act on this morning.
      */}
      {clashes.length > 0 ? (
        <p
          role="status"
          className="border-t border-ink/10 py-2.5 text-[13.5px]"
          style={{ color: 'rgb(var(--color-warn))' }}
          data-customers-clash=""
        >
          <span className="font-semibold">
            {clashes.length === 1
              ? 'One date has more than one customer holding it.'
              : `${clashes.length} dates have more than one customer holding them.`}
          </span>{' '}
          {clashes.map(([date, n]) => `${fmtDate(date)} · ${n}`).join(' · ')}. You can only take one.
        </p>
      ) : null}

      {/* Kind 30's one line under a search: how many it found, of how many. */}
      {q && !hidden ? (
        <p className="py-1.5 text-[12.5px] text-ink/60" data-customers-found="">
          {formatCount(paged.total)} of {formatCount(total)} customers
        </p>
      ) : null}

      {hidden ? null : rows.length === 0 ? (
        q ? (
          otherMatches > 0 ? null : (
            <p className="border-t border-ink/10 py-4 text-[14px] text-ink/70" data-customers-none="">
              No one named &ldquo;{q}&rdquo;. Check the spelling, or add them with <b>Add</b>.
            </p>
          )
        ) : (
          <p className="border-t border-ink/10 py-4 text-[14px] text-ink/70" data-customers-none="">
            {total === 0
              ? 'No customers yet. When somebody asks about a date, or books you, they show up here — the ones waiting on an answer first.'
              : 'Nobody in this list right now. Pick Everyone in Filter to see the rest.'}
          </p>
        )
      ) : (
        <ul data-customers-list="">
          {rows.map((r) => (
            <li key={`${r.lane}:${r.eventId}`} className="[&:first-child>*]:border-t-0">
              <RosterRowView r={r} nowMs={nowMs} query={q} />
            </li>
          ))}
        </ul>
      )}

      {/* The pager: "1–20 of 1,000 · ‹ Prev · 1 2 … 50 · Next ›" — the shared
          one, so this list pages exactly like every other supplier list. */}
      {hidden ? null : (
        <ListPager paged={paged} param="page" keepParams={pagerKeepParams} hash="customers" noun="customers" incomplete={incomplete} />
      )}
    </div>
  );
}
