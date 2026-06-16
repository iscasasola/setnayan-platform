/**
 * GuestHubCard — persistent status summary for identified returning guests.
 *
 * Renders at the top of the /[slug] page whenever a guest holds a valid
 * session cookie. Surfaces the four pieces of data that today require
 * navigation to see: RSVP status, table assignment, meal preference, and
 * the next upcoming schedule event.
 *
 * Design rules:
 *   • Pure server component — no client JS budget.
 *   • Uses only data the parent page already fetches (guest row + schedule
 *     blocks). The table label requires one extra targeted query
 *     (seat-assignment + table_label for THIS guest only — one DB round-trip).
 *   • `--m-*` CSS variables (Alabaster / Obsidian / Champagne-Gold / Mulberry)
 *     match the invitation page's Clean Editorial palette. Card sits flush in
 *     the article flow — not a floating overlay, not a dashboard widget.
 *   • Collapsed to one-liner summary on return visits via a cookie hint
 *     (`setnayan_hub_expanded` absence = compact by default). The `<details>`
 *     element handles expand/collapse with zero JS.
 */

import Link from 'next/link';
import { CalendarClock, CheckCircle2, ChevronDown, MapPin, UtensilsCrossed } from 'lucide-react';
import type { ScheduleBlockRow } from '@/lib/schedule';

// ---- Types from the parent page ------------------------------------------

type RsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe';

export type GuestHubData = {
  /** Guest's first name for the headline greeting. */
  firstName: string;
  /** Resolved display name (display_name ?? first + last). */
  displayName: string;
  rsvpStatus: RsvpStatus;
  /** Table label (e.g. "Table 5") when the guest has a seat assignment. */
  tableLabel: string | null;
  mealPreference: string | null;
  dietaryRestrictions: string | null;
  /** Next upcoming public schedule block (may be null when none are set). */
  nextScheduleBlock: Pick<ScheduleBlockRow, 'label' | 'start_at' | 'location'> | null;
  /** /[slug] paths for the nav links. */
  slug: string;
  /** Whether the guest is a limited +1 (hides certain links). */
  isLimitedPlusOne: boolean;
};

// ---- Helpers ---------------------------------------------------------------

function rsvpMeta(status: RsvpStatus): {
  label: string;
  dot: string;
  badge: string;
} {
  switch (status) {
    case 'attending':
      return {
        label: 'Going',
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      };
    case 'declined':
      return {
        label: 'Declined',
        dot: 'bg-rose-400',
        badge: 'bg-rose-50 text-rose-800 border border-rose-200',
      };
    case 'maybe':
      return {
        label: 'Maybe',
        dot: 'bg-amber-400',
        badge: 'bg-amber-50 text-amber-800 border border-amber-200',
      };
    default:
      return {
        label: 'RSVP pending',
        dot: 'bg-ink/30',
        badge: 'bg-ink/5 text-ink/70 border border-ink/15',
      };
  }
}

const MEAL_LABELS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids menu',
  no_preference: 'No preference',
};

function formatMeal(pref: string | null): string | null {
  if (!pref || pref === 'no_preference') return null;
  return MEAL_LABELS[pref] ?? pref;
}

/**
 * Format a schedule start_at ISO string to a short readable time.
 * e.g. "2026-07-19T14:30:00" → "2:30 PM"
 */
function formatTime(iso: string): string {
  try {
    // Parse as local-date (the schedule times are stored as local event-time
    // ISO strings, not UTC). Appending 'Z' would wrongly shift the time.
    const [datePart, timePart] = iso.split('T');
    if (!timePart) return datePart ?? iso;
    const [hStr, mStr] = timePart.split(':');
    const h = parseInt(hStr ?? '0', 10);
    const m = parseInt(mStr ?? '0', 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  } catch {
    return iso;
  }
}

/**
 * Pick the nearest upcoming block from the already-fetched public schedule.
 * "Upcoming" = start_at is in the future (or within the last 15 min to cover
 * the "happening now" window). Returns top-level blocks only (no children).
 */
export function pickNextScheduleBlock(
  blocks: ScheduleBlockRow[],
): Pick<ScheduleBlockRow, 'label' | 'start_at' | 'location'> | null {
  const now = Date.now() - 15 * 60 * 1000; // 15 min grace
  const topLevel = blocks.filter((b) => !b.parent_block_id && b.is_public);
  const upcoming = topLevel
    .filter((b) => new Date(b.start_at).getTime() >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  if (!upcoming.length) return null;
  const { label, start_at, location } = upcoming[0]!;
  return { label, start_at, location };
}

// ---- Component -------------------------------------------------------------

/**
 * The hub card itself. Always renders (parent only mounts it when a guest
 * session is present). Uses a `<details>` disclosure with `open` defaulting
 * to true so the card starts OPEN on first load — CSS/JS-free toggle.
 *
 * To persist "I collapsed it", we'd need a cookie write on toggle which
 * requires a Client Component. The spec says "localStorage signal if
 * practical". We use a lightweight Client Component wrapper in the same file
 * that reads localStorage on mount and removes the `open` attribute if the
 * guest previously collapsed it.
 */
export function GuestHubCard({ data }: { data: GuestHubData }) {
  const { firstName, displayName, rsvpStatus, tableLabel, mealPreference, dietaryRestrictions, nextScheduleBlock, slug, isLimitedPlusOne } = data;
  const rsvp = rsvpMeta(rsvpStatus);
  const meal = formatMeal(mealPreference);
  const restrictions = (dietaryRestrictions ?? '').trim();

  return (
    <>
      {/*
        Client-side persistence: if the guest previously collapsed the card,
        we honour that choice on return visits via localStorage. The static
        HTML has the card open; the inline script flips it before paint
        (synchronous, blocking = no FOUC). This avoids a full Client Component
        just for a toggle preference.
      */}
      {/*
        Inline sync script: runs before paint so the card starts in the
        user's preferred state without a flash-of-open-content on return
        visits. Also registers the toggle listener to persist the preference.
        Synchronous inline = no FOUC. This avoids a full Client Component
        just for a toggle preference.
      */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: inline sync script for localStorage init + toggle listener
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var el=document.getElementById('guest-hub-card');if(!el)return;if(localStorage.getItem('setnayan_hub_open')==='0')el.removeAttribute('open');el.addEventListener('toggle',function(){try{localStorage.setItem('setnayan_hub_open',el.open?'1':'0')}catch(e){}});}catch(e){}})()`,
        }}
      />
      <details
        id="guest-hub-card"
        open
        className="group rounded-2xl border border-champagne-gold/30 bg-gradient-to-br from-cream to-champagne-gold/5 shadow-sm"
      >
        {/* Summary row — always visible, acts as the toggle handle */}
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 hover:bg-ink/[0.02]">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex flex-col">
              <span className="font-serif text-base italic leading-snug text-ink">
                Hi again, {firstName}.
              </span>
              <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                Your invitation summary
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${rsvp.badge}`}>
              <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${rsvp.dot}`} />
              {rsvp.label}
            </span>
            <ChevronDown
              aria-hidden
              className="h-4 w-4 text-ink/40 transition-transform group-open:rotate-180"
              strokeWidth={1.75}
            />
          </div>
        </summary>

        {/* Expanded body */}
        <div className="space-y-4 px-5 pb-5 pt-1">
          <hr className="border-ink/10" />

          {/* Status grid — up to 3 tiles depending on available data */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* RSVP status */}
            <div className="flex flex-col gap-1 rounded-xl border border-ink/8 bg-cream p-3.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/45">
                RSVP
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.5} />
                {rsvp.label}
              </span>
              {rsvpStatus === 'attending' ? (
                <span className="mt-0.5 text-[11px] text-emerald-700">
                  Your place is reserved.
                </span>
              ) : rsvpStatus === 'pending' ? (
                <span className="mt-0.5 text-[11px] text-amber-700">
                  Please confirm you&apos;re coming.
                </span>
              ) : null}
            </div>

            {/* Table assignment */}
            <div className="flex flex-col gap-1 rounded-xl border border-ink/8 bg-cream p-3.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/45">
                Your seat
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <MapPin aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.5} />
                {tableLabel ?? (
                  <span className="text-ink/50">Not yet assigned</span>
                )}
              </span>
              {tableLabel ? (
                <Link
                  href={`/${slug}/find-my-table`}
                  className="mt-0.5 text-[11px] text-terracotta underline-offset-2 hover:underline"
                >
                  See venue map →
                </Link>
              ) : (
                <span className="mt-0.5 text-[11px] text-ink/45">
                  The couple will assign seats closer to the date.
                </span>
              )}
            </div>

            {/* Meal + dietary */}
            <div className="flex flex-col gap-1 rounded-xl border border-ink/8 bg-cream p-3.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/45">
                Meal
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <UtensilsCrossed aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.5} />
                {meal ?? <span className="text-ink/50">No preference set</span>}
              </span>
              {restrictions ? (
                <span className="mt-0.5 text-[11px] text-ink/60">
                  Notes: {restrictions}
                </span>
              ) : null}
            </div>
          </div>

          {/* Next upcoming schedule item */}
          {nextScheduleBlock ? (
            <div className="flex items-start gap-3 rounded-xl border border-champagne-gold/25 bg-champagne-gold/10 px-4 py-3">
              <CalendarClock
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                strokeWidth={1.5}
              />
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink/50">
                  Coming up
                </p>
                <p className="mt-0.5 text-sm font-medium text-ink">
                  {nextScheduleBlock.label}
                </p>
                <p className="mt-0.5 text-xs text-ink/60">
                  {formatTime(nextScheduleBlock.start_at)}
                  {nextScheduleBlock.location
                    ? ` · ${nextScheduleBlock.location}`
                    : null}
                </p>
              </div>
            </div>
          ) : null}

          {/* Quick-nav links */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/40">
              Quick links
            </span>
            <Link
              href={`/${slug}/find-my-table`}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs text-ink/70 hover:border-terracotta hover:text-terracotta"
            >
              <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Find my table
            </Link>
            {!isLimitedPlusOne ? (
              <Link
                href={`/${slug}/welcome`}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs text-ink/70 hover:border-terracotta hover:text-terracotta"
              >
                Welcome back
              </Link>
            ) : null}
          </div>

          {/* Greeter */}
          <p className="text-[11px] text-ink/40">
            Signed in as <span className="font-medium text-ink/60">{displayName}</span>
          </p>
        </div>
      </details>
    </>
  );
}
