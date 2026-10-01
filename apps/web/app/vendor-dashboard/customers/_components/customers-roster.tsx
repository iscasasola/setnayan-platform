import Link from 'next/link';
import type { ReactNode } from 'react';
import { MoreHorizontal, Plus, Search } from 'lucide-react';
import {
  CUSTOMER_LANES,
  waitingDays,
  HOLDING_QUIET_DAYS,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { lockRequestFuseLabel } from '@/lib/lock-request-state';
import { ShopEmpty } from '../../_components/kit';
import { ListPager } from '../../_components/list-pager';
import type { Paged } from '@/lib/paginate';
import { formatCount } from '@/lib/format-number';

/**
 * CUSTOMERS — the roster, opening on who is waiting.
 *
 * This is the page's FIRST block now. It used to sit under a month calendar and
 * two rows of summary tiles, and it knew two states: booked, and "in
 * conversation". A couple who had ASKED and not been accepted, and a couple
 * waiting on the shop's yes, were both invisible on the page whose whole job is
 * "who are my customers".
 *
 * 🔑 THE LANES COME FROM ONE PURE DERIVATION (`lib/vendor-customer-pipeline.ts`)
 * so this file decides nothing about who is booked. It draws.
 *
 * ── FILTER ▾ AND SHOW ▾ — ONE DROPDOWN EACH (owner-APPROVED 2026-10-01) ──
 * DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE RECOMMENDED
 * ANSWERS", frame 2: title · round + · ⋯ · search · Filter ▾ · a counts line ·
 * Show ▾ · rows (name · event · status pill · one next-step button). The lane
 * chip row this replaced was five pills — the interaction rule is "3+ choices →
 * ONE dropdown". Both dropdowns are the shipped `PickMenu`, handed in by the
 * page as SLOTS (`filter`, `show`) so this file stays a server component that a
 * unit test can render.
 *
 * `?lane=` still narrows the same list; it never routes anywhere — "one list of
 * customers, two ways of looking at it — nothing lives in two rooms."
 *
 * ── EVERY LANE STILL HAS ITS COUNT ─────────────────────────────────────────
 * The counts line names the waiting count first, always — "0 waiting on you"
 * is a shop being told it owes nobody an answer, the single most useful thing
 * this page can say on a quiet day — and the Filter ▾ options carry every
 * lane's count, zero included.
 */

const LANE_LABEL: Record<CustomerLane, string> = {
  waiting: 'Waiting on you',
  holding: 'Holding',
  talking: 'Talking',
  booked: 'Booked',
  finished: 'Finished',
};

/**
 * Colour carries STATUS, never decoration — the repo's own rule. Only the lane
 * that means "somebody is owed an answer" gets a warm semantic.
 */
const LANE_CHIP: Record<CustomerLane, { bg: string; fg: string; border: string }> = {
  waiting: {
    bg: 'var(--sn-warning-soft)',
    fg: 'var(--sn-warning-deep)',
    border: 'color-mix(in srgb, var(--sn-warning) 30%, transparent)',
  },
  /*
    HOLDING WEARS THE SAME WARM SEMANTIC AS WAITING, and that is the rule, not a
    coincidence: colour carries STATUS here, and both lanes mean "this is on
    you". It is deliberately NOT a second, louder colour — a shop with quiet
    leads is not in trouble, it has work to do.
  */
  holding: {
    bg: 'var(--sn-warning-soft)',
    fg: 'var(--sn-warning-deep)',
    border: 'color-mix(in srgb, var(--sn-warning) 30%, transparent)',
  },
  talking: { bg: 'var(--m-paper-2)', fg: 'var(--m-slate)', border: 'var(--m-line)' },
  booked: {
    bg: 'rgba(79,107,74,0.12)',
    fg: 'var(--m-sage-deep)',
    border: 'rgba(79,107,74,0.28)',
  },
  finished: { bg: 'var(--m-paper-2)', fg: 'var(--m-slate-2)', border: 'var(--m-line)' },
};

export type RosterRow = PipelineCustomer & {
  /** Right-hand money note, already computed by the page. */
  note: { text: string; tone: string } | null;
};

/** The counts line's words — "3 waiting on you · 5 talking · 12 booked". */
const LANE_SHORT: Record<CustomerLane, string> = {
  waiting: 'waiting on you',
  holding: 'holding',
  talking: 'talking',
  booked: 'booked',
  finished: 'done',
};

/** What the right-hand column shows on a phone (`?show=`). From `lg` up, all three. */
export type RosterShow = 'next' | 'money' | 'date';
export const ROSTER_SHOW: readonly RosterShow[] = ['next', 'money', 'date'];
export const ROSTER_SHOW_LABEL: Record<RosterShow, string> = {
  next: 'Next step',
  money: 'Money',
  date: 'Days to go',
};

/**
 * The words on a row's one next-step button. It goes where the row goes
 * (`hrefFor`) — it OPENS the place the step is taken, it never takes it: a
 * booking ask is answered on the customer card, with the fee shown before Agree.
 */
function nextStepLabel(r: RosterRow): string {
  if (r.waitingKind === 'inquiry') return 'Reply';
  if (r.waitingKind === 'booking_ask') return 'Answer';
  if (r.lane === 'holding') return 'Follow up';
  if (r.lane === 'talking') return 'Send a quote';
  if (r.lane === 'booked') return 'See the day';
  return 'Open';
}

/** "today" · "in 12 days" · "3 days ago" — whole Manila days, never a guess. */
function daysToGo(iso: string | null, nowMs: number): string | null {
  if (!iso) return null;
  const today = new Date(nowMs + 8 * 3_600_000).toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(diff)) return null;
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff > 1) return `in ${formatCount(diff)} days`;
  return `${formatCount(-diff)} day${diff === -1 ? '' : 's'} ago`;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
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

/**
 * Where pressing the row actually takes the shop — its NEXT ACTION, per lane.
 *
 * ⚠ BOTH DESTINATIONS ARE BOUND TO A LOCAL LITERALLY NAMED `href`, AND THAT IS
 * LOAD-BEARING, NOT STYLE. `lint-port-no-lost-controls` finds a route's
 * destinations with a regex that requires the token `href` immediately before
 * the string; a template literal returned straight out of a ternary is
 * invisible to it. The first draft of this function did exactly that and the
 * guard correctly reported that `/vendor-dashboard/customers` had LOST
 * `/vendor-dashboard/messages/[seg]` — a real removal from its point of view.
 * Inlining these back into the `return` re-hides them. *A guard that cannot see
 * a control reads its absence as a deletion.*
 */
function hrefFor(r: RosterRow): string | null {
  if (r.lane === 'waiting' && r.waitingKind === 'inquiry') {
    // Accept / decline lives on the thread. The customer card is unreachable
    // pre-accept — `get_vendor_event_brief` refuses a shop that holds neither an
    // accepted enquiry nor a booking — so sending them there would be a door
    // that bounces straight back to Clients.
    if (!r.threadId) return null;
    const href = `/vendor-dashboard/messages/${r.threadId}`;
    return href;
  }
  // Every other lane has a customer card, and the booking ask can be ANSWERED
  // on it (PR-H slice B put Agree / Turn it down there).
  // 🔒 `?tab=details` IS NOT DECORATION. A bare client route is a CHAT landing
  // since #5614 — so without it this whole roster and the "Open chat" beside it
  // went to the same place, and the customer card had no door on this page.
  const href = `/vendor-dashboard/clients/${r.eventId}?tab=details`;
  return href;
}

/** "asked today" · "waiting 3 days" · "quiet 9 days" — never an unmeasured number. */
function ageLabel(r: RosterRow, now: number): string | null {
  if (r.lane === 'holding') {
    // The number that makes the lane actionable. `quietDays` is what PUT this
    // customer here, so it is never null on a holding row — but it is still
    // read defensively rather than asserted, because a row is worth showing
    // without its age and is not worth crashing a page over.
    return r.quietDays === null ? null : `quiet ${r.quietDays} days`;
  }
  if (r.lane !== 'waiting') return null;
  const days = waitingDays(r.waitingSince, now);
  if (days === null) return null;
  if (days === 0) return 'asked today';
  return `waiting ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The fuse on a booking ask, from the MATERIALIZED deadline the trigger stamped
 * — the number shown is the number enforced.
 *
 * 🔑 THE PHRASING IS THE SHARED ONE. This used to word it itself ("last day to
 * answer", "2 days left") beside two other surfaces wording it two other ways,
 * which is how three screens come to disagree about one deadline. The window is
 * 48 hours (owner 2026-08-28), so it counts in HOURS below a day.
 */
function fuseLabel(r: RosterRow, now: Date): string | null {
  if (r.waitingKind !== 'booking_ask') return null;
  return lockRequestFuseLabel(r.expiresAt, now);
}

export function CustomersRoster({
  rows,
  paged,
  query,
  incomplete,
  pagerKeepParams,
  searchKeepParams,
  counts,
  nowMs,
  /**
   * How many people the shop is holding on each date — computed across ALL
   * customers, not just the ones on screen, so filtering to a lane cannot make
   * a clash disappear.
   */
  holdingPerDate,
  show = 'next',
  filter = null,
  showPick = null,
}: {
  rows: RosterRow[];
  counts: Record<CustomerLane, number>;
  nowMs: number;
  holdingPerDate: Map<string, number>;
  /**
   * The page being shown. `rows` IS `paged.items` — the page slices, the
   * counts above never do (owner 2026-09-19: "if they have 1000 inquiries,
   * they can still manage all and still be able to see the lower parts of the
   * page").
   */
  paged: Paged<RosterRow>;
  /** The name search as typed (`?q=`), echoed back into the box. */
  query: string;
  /** The reads behind the roster could not prove they reached every customer. */
  incomplete: boolean;
  /** Every param but `page`, so paging keeps the lane, month, search and open section. */
  pagerKeepParams: string;
  /** Every param but `page` and `q`, carried by the search box as hidden fields. */
  searchKeepParams: string;
  /** Which column a phone row shows on its right (`?show=`). */
  show?: RosterShow;
  /** The page's Filter ▾ (a `PickMenu`) — a slot, so this file stays server-rendered. */
  filter?: ReactNode;
  /** The page's Show ▾ (a `PickMenu`). */
  showPick?: ReactNode;
}) {
  const now = new Date(nowMs);
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

  /*
    THE COUNTS LINE — "3 waiting on you · 5 talking · 12 booked". Waiting is
    always said, zero included; the other lanes only when they hold someone.
  */
  const countsLine =
    total === 0
      ? ''
      : CUSTOMER_LANES.filter((l) => l === 'waiting' || counts[l] > 0)
          .map((l) => `${formatCount(counts[l])} ${LANE_SHORT[l]}`)
          .join(' · ');

  /** On a phone only the chosen column shows; from `lg` up, all of them. */
  const colClass = (c: RosterShow) =>
    c === show ? 'shrink-0 text-right font-mono text-xs' : 'hidden shrink-0 text-right font-mono text-xs lg:block';

  return (
    <div id="customers" className="scroll-mt-24">
      {/*
        TITLE · round + · ⋯ — the + is the SHIPPED "Import an outside client"
        form in the Clients section (owner answer 3: "+ on Customers adds an
        outside client"); `?add=outside` opens it. Nothing new takes the client.
      */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="sn-sec">Customers</h2>
        <div className="flex items-center gap-2">
          <Link
            href="?open=clients&add=outside#import-outside"
            scroll={false}
            data-customers-add
            aria-label="Add an outside client"
            className="sn-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
          {/*
            ⋯ — the tools that used to sit as five folds and a "Book of
            business" link. Every one is still on the page, below; these are the
            doors. A <details>, so it opens with no script. No <li> on purpose:
            a row of this roster is an <li>.
          */}
          <details className="relative" data-customers-more>
            <summary
              aria-label="More customer tools"
              className="sn-press flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-ink/15 [&::-webkit-details-marker]:hidden"
            >
              <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={2} />
            </summary>
            <div className="sn-glass-bare absolute right-0 z-20 mt-2 flex w-60 flex-col rounded-xl p-1.5 text-sm shadow-lg">
              <Link href="?open=clients#customer-tools" scroll={false} className="rounded-lg px-3 py-2 hover:bg-ink/5">
                Book of business
              </Link>
              <Link href="?open=messages#customer-tools" scroll={false} className="rounded-lg px-3 py-2 hover:bg-ink/5">
                Messages
              </Link>
              <Link href="#calendar" className="rounded-lg px-3 py-2 hover:bg-ink/5">
                Calendar
              </Link>
              <Link href="?open=availability#customer-tools" scroll={false} className="rounded-lg px-3 py-2 hover:bg-ink/5">
                Availability &amp; capacity
              </Link>
              <Link href="?open=proposals#customer-tools" scroll={false} className="rounded-lg px-3 py-2 hover:bg-ink/5">
                Proposals
              </Link>
              <Link href="?open=contracts#customer-tools" scroll={false} className="rounded-lg px-3 py-2 hover:bg-ink/5">
                Contracts
              </Link>
            </div>
          </details>
        </div>
      </div>

      {/*
        NAME SEARCH + Filter ▾ — a plain GET form, so the search works before any
        script loads and the result is a link a shop can come back to. It resets
        to page 1 (the `page` param is not carried) and keeps the lane, month and
        open section.
      */}
      {total > 0 ? (
        <div className="mb-2 flex items-center gap-2">
          <form method="get" action="#customers" role="search" className="flex min-w-0 flex-1 gap-2">
            {[...new URLSearchParams(searchKeepParams).entries()].map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search customers by name</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                strokeWidth={1.75}
                style={{ color: 'var(--m-slate-2)' }}
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                maxLength={80}
                placeholder="Search a customer"
                className="w-full rounded-full border py-2 pl-9 pr-3 text-sm"
                style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)', color: 'var(--m-ink)' }}
              />
            </label>
          </form>
          {filter}
        </div>
      ) : null}

      {total > 0 ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="min-w-0 text-sm" style={{ color: 'var(--m-slate-2)' }} data-customers-counts>
            {countsLine}
          </p>
          <div className="shrink-0 lg:hidden">{showPick}</div>
        </div>
      ) : null}

      {/*
        THE EXPOSURE LINE — the thing the owner said nothing shows.

        "A shop holding four couples for one date is exposed and nothing shows
        them that." One quiet enquiry is a lead going cold; several on ONE
        Saturday is a shop that has told several couples it is free and can serve
        one of them.

        ⛔ It renders ONLY when a date genuinely has more than one, and it names
        the dates rather than giving a total — "3 couples on 2 dates" is a
        statistic, "14 Feb · 3" is something a person can act on this morning.
      */}
      {clashes.length > 0 ? (
        <div
          className="mb-3 rounded-xl border px-3.5 py-2.5 text-sm"
          style={{
            background: 'var(--sn-warning-soft)',
            borderColor: 'color-mix(in srgb, var(--sn-warning) 30%, transparent)',
            color: 'var(--sn-warning-deep)',
          }}
        >
          <span className="font-semibold">
            {clashes.length === 1
              ? 'One date has more than one customer holding it.'
              : `${clashes.length} dates have more than one customer holding them.`}
          </span>{' '}
          {clashes
            .map(([date, n]) => `${fmtDate(date)} · ${n}`)
            .join(' · ')}
          . You can only take one.
        </div>
      ) : null}

      {rows.length === 0 && query.trim() && total > 0 ? (
        <ShopEmpty>
          No customer here matches &ldquo;{query.trim()}&rdquo;.{' '}
          <Link
            href={searchKeepParams ? `?${searchKeepParams}#customers` : '#customers'}
            className="font-semibold underline"
          >
            Clear the search
          </Link>
        </ShopEmpty>
      ) : rows.length === 0 ? (
        <ShopEmpty>
          {total === 0
            ? 'No customers yet. When somebody asks about a date, or books you, they show up here — the ones waiting on an answer first.'
            : 'Nobody in this list right now. Pick Everyone in Filter to see the rest.'}
        </ShopEmpty>
      ) : (
        <div className="sn-tile p-2 sm:p-2.5">
          <ul className="space-y-1">
            {rows.map((r) => {
              const tone = LANE_CHIP[r.lane];
              const href = hrefFor(r);
              const age = ageLabel(r, nowMs);
              const fuse = fuseLabel(r, now);
              const nextNote = [age, fuse].filter(Boolean).join(' · ');
              const togo = daysToGo(r.eventDate, nowMs);
              const inner = (
                <>
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
                  >
                    {/*
                      Only a genuinely NAMELESS event wears the neutral mark —
                      initials of the fallback word would read like a name.
                      Nothing is masked any more (owner 2026-09-08, 2026-09-19).
                    */}
                    {r.identityRevealed ? initialsOf(r.title) : '·'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className="truncate text-sm font-medium"
                        style={{ color: 'var(--m-ink)' }}
                      >
                        {r.title}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}
                      >
                        {r.waitingKind === 'booking_ask'
                          ? 'Wants to book you'
                          : r.waitingKind === 'inquiry'
                            ? 'Asked you something'
                            : r.lane === 'holding'
                              ? 'Hasn’t booked yet'
                              : LANE_LABEL[r.lane]}
                      </span>
                    </span>
                    <span
                      className="mt-0.5 block truncate font-mono text-xs"
                      style={{ color: 'var(--m-slate-2)' }}
                    >
                      {[fmtDate(r.eventDate), r.place].filter(Boolean).join(' · ')}
                    </span>
                    {/*
                      THE ONE NEXT-STEP BUTTON. Drawn inside the row's own link
                      (one tap target, no link inside a link) — it names where
                      the row goes.
                    */}
                    {href ? (
                      <span
                        data-row-next
                        className="mt-1.5 inline-flex items-center rounded-full bg-ink px-3 py-1 text-xs font-semibold text-cream"
                      >
                        {nextStepLabel(r)}
                      </span>
                    ) : null}
                  </span>
                  {/* Show ▾ — one column on a phone, all three from lg up. */}
                  <span className={colClass('next')} style={{ color: 'var(--m-slate-2)' }}>
                    {nextNote || '—'}
                  </span>
                  <span className={colClass('money')} style={{ color: r.note?.tone ?? 'var(--m-slate-2)' }}>
                    {r.note?.text ?? '—'}
                  </span>
                  <span className={colClass('date')} style={{ color: 'var(--m-slate-2)' }}>
                    {togo ?? '—'}
                  </span>
                </>
              );
              return (
                <li key={`${r.lane}:${r.eventId}`}>
                  {href ? (
                    <Link
                      href={href}
                      className="sn-row group flex items-center gap-3 px-3.5 py-3 transition-transform hover:translate-x-0.5"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="sn-row flex items-center gap-3 px-3.5 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
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
    </div>
  );
}
