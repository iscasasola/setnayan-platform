import type { EventWords } from '../_lib/event-words';
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
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  MapPin,
  PartyPopper,
  User,
  UtensilsCrossed,
} from 'lucide-react';
import type { ScheduleBlockRow } from '@/lib/schedule';
import { pickTriggerNowNext } from '@/lib/run-of-show';
import { venueNowMs } from '@/lib/schedule';

/** What the card's schedule tile renders. `happeningNow` = the pick is the
 *  host-set LIVE block (run-of-show trigger), so the tile labels it
 *  "Happening now" instead of "Coming up". Absent/false = preview semantics. */
export type NextScheduleBlockPick = Pick<
  ScheduleBlockRow,
  'label' | 'start_at' | 'location'
> & { happeningNow?: boolean };

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
  nextScheduleBlock: NextScheduleBlockPick | null;
  /** /[slug] paths for the nav links. */
  slug: string;
  /** Whether the guest is a limited +1 (hides certain links). */
  isLimitedPlusOne: boolean;
  /** True once this guest has scanned in at the door on the day-of (a
   *  guest_checkins row exists). Flips the seat tile to a warm arrival state. */
  arrived: boolean;
  /**
   * True only on this guest's VERY FIRST arrival — their earliest recorded scan
   * is inside the arrival window.
   *
   * Optional and defaulting to false so every existing construction site stays
   * byte-unchanged, and so an unknown answer falls back to today's copy rather
   * than greeting a returning guest as a stranger.
   */
  firstVisit?: boolean;
};

// ---- Helpers ---------------------------------------------------------------

function rsvpMeta(status: RsvpStatus): {
  label: string;
  dot: string;
  badge: string;
} {
  // Functional-color exile (design 2026-07-25 §4): app green / red / amber are
  // gone from the guest tree. The four states now read as mono stamps —
  // "Going" is gild-ruled, the rest are ink — so they stay distinguishable by
  // rule and label rather than by hue. Labels themselves are unchanged.
  switch (status) {
    case 'attending':
      return {
        label: 'Going',
        dot: 'bg-gild',
        badge: 'text-gild border border-gild',
      };
    case 'declined':
      return {
        label: 'Declined',
        dot: 'bg-ink/40',
        badge: 'text-ink/60 border border-ink/25',
      };
    case 'maybe':
      return {
        label: 'Maybe',
        dot: 'bg-ink/30',
        badge: 'text-ink/60 border border-ink/20',
      };
    default:
      return {
        // Identical to RsvpPill's pending label by requirement, not by luck —
        // see rsvp-widget.tsx. These two drifted apart once already.
        label: 'No reply yet',
        dot: 'bg-ink/30',
        badge: 'text-ink/55 border border-ink/15',
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
 *
 * With `preferRunState` (NEXT_PUBLIC_GUEST_NOW_TRIGGER, owner directive
 * 2026-07-23): once the host/coordinator has started the run of show, the
 * card follows the run_state pointer — the 'live' block first, else the first
 * still-'upcoming' block (a private live block simply isn't in the public
 * list, so this degrades to the next visible moment — no teaser). While the
 * show hasn't started, the wall-clock inference below runs unchanged.
 */
export function pickNextScheduleBlock(
  blocks: ScheduleBlockRow[],
  opts?: { preferRunState?: boolean },
): NextScheduleBlockPick | null {
  const topLevel = blocks.filter((b) => !b.parent_block_id && b.is_public);
  if (opts?.preferRunState) {
    const picked = pickTriggerNowNext(topLevel);
    if (picked) {
      const chosen = picked.current ?? picked.next;
      if (!chosen) return null; // program wrapped — nothing to come up
      const { label, start_at, location } = chosen;
      // happeningNow flips the card's label from "Coming up" to "Happening
      // now" — the host-set live block is the current moment, not a preview.
      return { label, start_at, location, happeningNow: chosen === picked.current };
    }
  }
  // The VENUE's clock, minus a 15-minute grace. `start_at` holds the venue's
  // wall clock, so measuring it against the guest's own clock put this card a
  // whole UTC offset out — eight hours in Manila, which on the day means a
  // guest standing at the reception is told the ceremony is "coming up".
  const now = venueNowMs() - 15 * 60 * 1000;
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
export function GuestHubCard({
  data,
  words,
  guestListClosed = false,
  detailsCardOnPage = false,
}: {
  data: GuestHubData;
  words: EventWords;
  /**
   * The guest list is final (owner 2026-08-20). Drops the "Please confirm
   * you're coming" nudge — after the deadline there is nothing to confirm
   * with, so the nudge asks for a thing the guest can no longer do and the
   * database would refuse. Their status line stays; only the instruction goes.
   * Defaults FALSE so every existing mount is unchanged.
   */
  guestListClosed?: boolean;
  /** Whether the reply card is rendering on THIS page right now. The card is
   *  phase-gated to `rsvp`; the chip below must not point at it in any other
   *  phase, where the anchor does not exist. Defaults false — a chip that is
   *  absent is a smaller failure than one that scrolls to nothing. */
  detailsCardOnPage?: boolean;
}) {
  const { firstName, displayName, rsvpStatus, tableLabel, mealPreference, dietaryRestrictions, nextScheduleBlock, slug, isLimitedPlusOne, arrived, firstVisit = false } = data;
  // Day-of arrival: once the guest has checked in at the door AND has a seat,
  // the seat tile greets them by name with a gentle bloom instead of the
  // neutral "Your seat" copy. Needs both — a checked-in guest with no assigned
  // table still gets the normal "not yet assigned" tile.
  const showArrival = arrived && Boolean(tableLabel);
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
        /* Pahina hub plate (design §11a): the guest-personal layer is STARRED,
           not numbered — the gild ✦ marks "this belongs to you" while editorial
           chapters carry a №. Palette-derived gild replaces the fixed Atelier
           champagne-gold so the plate re-skins with the couple's colours. The
           <details> disclosure, the localStorage script, and every id/gate are
           untouched. */
        className="group border border-gild/30 bg-gradient-to-br from-paper-deep to-gild/5 shadow-sm"
      >
        {/* Summary row — always visible, acts as the toggle handle */}
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-ink/[0.02]">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex flex-col">
              <span className="font-pahina text-lg font-light italic leading-snug text-ink">
                {/* 🔴 THIS WAS AN UNCONDITIONAL "Hi again". The very first
                    person ever to scan a printed invitation QR was greeted as
                    a returning visitor — their arrival mints the session and
                    lands them straight here, so this is literally the first
                    sentence they read. The comment above this card's mount even
                    claimed it was "for identified RETURNING guests", asserting a
                    gate that did not exist.
                    🔒 "Hello", never "Welcome": Welcome already means "you have
                    checked in at the door" in five other places, and telling
                    somebody at home that they have arrived at the venue is a
                    different lie.
                    🪤 THE BLANK-NAME ARM BROKE THAT RULE THREE LINES BELOW THE
                    SENTENCE STATING IT — it read "Hello — welcome." The guard
                    written to enforce the rule only ever rendered a NAMED guest,
                    so the one arm that broke it was the one arm never tested.
                    All four arms are asserted now. */}
                {firstName.trim()
                  ? firstVisit
                    ? `Hello, ${firstName.trim()}.`
                    : `Hi again, ${firstName.trim()}.`
                  : firstVisit
                    ? 'Hello.'
                    : 'Your invitation.'}
              </span>
              <span className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.28em] text-gild">
                <span aria-hidden>✦ </span>Your invitation summary
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${rsvp.badge}`}
            >
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
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/45">
                RSVP
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <CheckCircle2 aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.5} />
                {rsvp.label}
              </span>
              {rsvpStatus === 'attending' ? (
                <span className="mt-0.5 text-xs text-ink/70">Your place is reserved.</span>
              ) : rsvpStatus === 'pending' ? (
                <span className="mt-0.5 text-xs text-ink/70">
                  {guestListClosed
                    ? 'Replies are closed.'
                    : 'Please confirm you\u2019re coming.'}
                </span>
              ) : null}
            </div>

            {/* Table assignment — blooms into a warm arrival greeting once the
                guest has checked in at the door (showArrival). The CSS keyframe
                is frozen by the global prefers-reduced-motion block. */}
            <div
              className={`flex flex-col gap-1 rounded-xl border p-3.5 ${
                showArrival
                  ? 'sn-arrival-bloom border-gild/40 bg-gradient-to-br from-paper-deep to-gild/10'
                  : 'border-ink/8 bg-cream'
              }`}
            >
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/45">
                {showArrival ? 'You’ve arrived' : 'Your seat'}
              </span>
              <span className="flex items-center gap-1.5 text-ink">
                {showArrival ? (
                  <PartyPopper aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
                ) : (
                  <MapPin aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.5} />
                )}
                {tableLabel ? (
                  <span className="font-serif text-lg italic leading-tight">{tableLabel}</span>
                ) : (
                  <span className="text-sm font-medium text-ink/50">Not yet assigned</span>
                )}
              </span>
              {showArrival ? (
                <span className="mt-0.5 text-xs text-ink/70">
                  Welcome, {firstName} — you&rsquo;re checked in.
                </span>
              ) : null}
              {tableLabel ? (
                <Link
                  href={`/${slug}/find-my-table`}
                  className="mt-0.5 text-xs text-terracotta underline-offset-2 hover:underline"
                >
                  See venue map →
                </Link>
              ) : (
                <span className="mt-0.5 text-xs text-ink/45">
                  {`${words.TheHost} will assign seats closer to the date.`}
                </span>
              )}
            </div>

            {/* Meal + dietary */}
            <div className="flex flex-col gap-1 rounded-xl border border-ink/8 bg-cream p-3.5">
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink/45">
                Meal
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <UtensilsCrossed aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.5} />
                {meal ?? <span className="text-ink/50">No preference set</span>}
              </span>
              {restrictions ? (
                <span className="mt-0.5 text-xs text-ink/60">
                  Notes: {restrictions}
                </span>
              ) : null}
            </div>
          </div>

          {/* Next upcoming schedule item */}
          {nextScheduleBlock ? (
            <div className="flex items-start gap-3 border border-gild/25 bg-gild/10 px-4 py-3">
              <CalendarClock
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
                strokeWidth={1.5}
              />
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink/50">
                  {nextScheduleBlock.happeningNow ? 'Happening now' : 'Coming up'}
                </p>
                <p className="mt-0.5 font-serif text-base italic leading-snug text-ink">
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
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink/40">
              Quick links
            </span>
            <Link
              href={`/${slug}/find-my-table`}
              className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs text-ink/70 hover:border-terracotta hover:text-terracotta-700"
            >
              <MapPin aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Find my table
            </Link>
            {detailsCardOnPage ? (
              <a
                href="#your-details"
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs text-ink/70 hover:border-terracotta hover:text-terracotta-700"
              >
                <User aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                Your details
              </a>
            ) : null}
            {!isLimitedPlusOne ? (
              <Link
                href={`/${slug}/welcome`}
                className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-cream px-3 py-1 text-xs text-ink/70 hover:border-terracotta hover:text-terracotta-700"
              >
                Welcome back
              </Link>
            ) : null}
          </div>

          {/* Greeter */}
          <p className="text-xs text-ink/40">
            Signed in as <span className="font-medium text-ink/60">{displayName}</span>
          </p>
        </div>
      </details>
    </>
  );
}
