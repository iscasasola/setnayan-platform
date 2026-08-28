import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import {
  CUSTOMER_LANES,
  waitingDays,
  type CustomerLane,
  type PipelineCustomer,
} from '@/lib/vendor-customer-pipeline';
import { lockRequestDaysLeft } from '@/lib/lock-request-state';
import { ShopEmpty } from '../../_components/kit';

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
 * ── THE CHIPS ARE A FILTER, NOT A PLACE ────────────────────────────────────
 * `?lane=` narrows the same list; it never routes anywhere. The drawing's own
 * note is the rule: "one list of customers, two ways of looking at it — nothing
 * lives in two rooms."
 *
 * ── A LANE WITH NOTHING IN IT STILL SHOWS ITS CHIP ─────────────────────────
 * With a zero on it. A chip that disappears when empty makes a shop wonder
 * whether the feature exists; a chip reading "Waiting 0" is a shop being told
 * it owes nobody an answer, which is the single most useful thing this page can
 * say on a quiet day.
 */

const LANE_LABEL: Record<CustomerLane, string> = {
  waiting: 'Waiting on you',
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
  const href = `/vendor-dashboard/clients/${r.eventId}`;
  return href;
}

/** "asked today" · "waiting 3 days" — never a number we could not measure. */
function ageLabel(r: RosterRow, now: number): string | null {
  if (r.lane !== 'waiting') return null;
  const days = waitingDays(r.waitingSince, now);
  if (days === null) return null;
  if (days === 0) return 'asked today';
  return `waiting ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * The fuse on a booking ask, from the MATERIALIZED deadline the trigger stamped
 * — the number shown is the number enforced. A lapsed ask floors at 0 and says
 * "last day", exactly as the Answers Desk card does; the two must not disagree.
 */
function fuseLabel(r: RosterRow, now: Date): string | null {
  if (r.waitingKind !== 'booking_ask') return null;
  const left = lockRequestDaysLeft(r.expiresAt, now);
  if (left === null) return null;
  return left === 0 ? 'last day to answer' : `${left} day${left === 1 ? '' : 's'} left`;
}

export function CustomersRoster({
  rows,
  activeLane,
  counts,
  nowMs,
  /** Preserved on every chip link so a filter never drops the visible month. */
  keepParams,
}: {
  rows: RosterRow[];
  activeLane: CustomerLane | null;
  counts: Record<CustomerLane, number>;
  nowMs: number;
  keepParams: string;
}) {
  const now = new Date(nowMs);
  const total = CUSTOMER_LANES.reduce((n, l) => n + counts[l], 0);
  const waitingCount = counts.waiting;
  const chipHref = (lane: CustomerLane | null) => {
    const q = new URLSearchParams(keepParams);
    if (lane) q.set('lane', lane);
    else q.delete('lane');
    const s = q.toString();
    return s ? `?${s}#customers` : '#customers';
  };

  return (
    <div id="customers">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="sn-sec">Customers</h2>
        <p className="text-sm" style={{ color: 'var(--m-slate-2)' }}>
          {waitingCount > 0
            ? `${waitingCount} waiting on you`
            : total > 0
              ? 'nobody waiting on you'
              : ''}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Link
          href={chipHref(null)}
          scroll={false}
          aria-current={activeLane === null ? 'true' : undefined}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
          style={
            activeLane === null
              ? { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' }
              : { background: 'transparent', color: 'var(--m-slate)', borderColor: 'var(--m-line)' }
          }
        >
          Everyone <span className="font-mono">{total}</span>
        </Link>
        {CUSTOMER_LANES.map((lane) => {
          const on = activeLane === lane;
          const tone = LANE_CHIP[lane];
          return (
            <Link
              key={lane}
              href={chipHref(lane)}
              scroll={false}
              aria-current={on ? 'true' : undefined}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
              style={
                on
                  ? { background: 'var(--m-ink)', color: 'var(--m-paper)', borderColor: 'var(--m-ink)' }
                  : { background: tone.bg, color: tone.fg, borderColor: tone.border }
              }
            >
              {LANE_LABEL[lane]} <span className="font-mono">{counts[lane]}</span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <ShopEmpty>
          {total === 0
            ? 'No customers yet. When somebody asks about a date, or books you, they show up here — the ones waiting on an answer first.'
            : 'Nobody in this list right now. Press Everyone to see the rest.'}
        </ShopEmpty>
      ) : (
        <div className="sn-tile p-2 sm:p-2.5">
          <ul className="space-y-1">
            {rows.map((r) => {
              const tone = LANE_CHIP[r.lane];
              const href = hrefFor(r);
              const age = ageLabel(r, nowMs);
              const fuse = fuseLabel(r, now);
              const inner = (
                <>
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: 'var(--sn-gold-100)', color: 'var(--sn-gold-800)' }}
                  >
                    {/*
                      A masked row has no name to take initials from, so it wears
                      a neutral mark rather than the first two letters of "A
                      couple planning a wedding" — which would print "AC" for
                      every stranger and read like a name.
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
                            : LANE_LABEL[r.lane]}
                      </span>
                    </span>
                    <span
                      className="mt-0.5 block truncate font-mono text-xs"
                      style={{ color: 'var(--m-slate-2)' }}
                    >
                      {[fmtDate(r.eventDate), r.place, age, fuse].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {r.note ? (
                    <span
                      className="shrink-0 text-right font-mono text-xs"
                      style={{ color: r.note.tone }}
                    >
                      {r.note.text}
                    </span>
                  ) : null}
                  {href ? (
                    <ChevronRight
                      aria-hidden
                      className="h-4 w-4 shrink-0"
                      strokeWidth={1.75}
                      style={{ color: 'var(--m-slate-2)' }}
                    />
                  ) : null}
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
    </div>
  );
}
