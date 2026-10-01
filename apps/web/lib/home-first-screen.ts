/**
 * lib/home-first-screen.ts — WHAT THE PHONE HOME SHOWS FIRST (pure, no I/O).
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SIMPLE PHONE APP — APPROVED";
 * `Setnayan/prototypes/phone_app_simple_2026-10-01_fable.html`, frame 1 "Home"):
 * ONE "Next" card → an always-there **Edit your Event Hub** button → three
 * numbers (days to go · coming · no reply) + one Paid / Still owing line.
 * Nothing else above the fold on a 390 × 844 phone.
 *
 * 🔑 NOTHING HERE IS NEW. The Next card is the Home's EXISTING nudges collapsed
 * into one, in the order the Home already stacked them (page.tsx `overlays`):
 *
 *   guide → the Event Hub's guided "What's left" (Details part 5 —
 *           "Round N · x of y · Continue"), for whom Details is
 *   date  → the set-your-date nudge, while no date is set
 *   papic → "Your free camera is ready", until the first photo is shot
 *   ai    → the Setnayan AI offer, last because it is a purchase, not a step
 *   plan  → nothing above is waiting: the full plan, just below
 *
 * The first that applies wins; the rest stay reachable below the fold, exactly
 * where they were. The numbers come from the existing honest reads, and a read
 * that did not happen prints "—", NEVER 0 (the rule of
 * `lib/guests-read-is-honest.test.ts`): a couple with 180 names must never be
 * told "0 coming" because a query was refused.
 */
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';

export type HomeNextKind = 'guide' | 'date' | 'papic' | 'ai' | 'plan';

/** The order the Home already stacked its nudges in — the first that applies is Next. */
export const HOME_NEXT_ORDER: readonly HomeNextKind[] = ['guide', 'date', 'papic', 'ai', 'plan'];

/** The guided flow's position, as Home reads it (null = nothing left, not for this viewer, or unread). */
export type HomeGuide = {
  round: number;
  roundTitle: string;
  done: number;
  total: number;
  nextTitle: string | null;
} | null;

export type HomeNext = {
  kind: HomeNextKind;
  title: string;
  body: string;
  action: string;
};

export type HomeNextInput = {
  guide: HomeGuide;
  hasDate: boolean;
  noun: 'wedding' | 'event';
  papicReady: boolean;
  /** An AI offer exists AND may be shown here (never in the store shell). */
  aiOffer: boolean;
};

/**
 * ONE card, always — the first unfinished thing, else the plan below.
 *
 * ⚠ The card's DESTINATION is not decided here: each kind's link is a literal
 * in `home-first-screen.tsx` (`NEXT_HREF`), where `lint-port-no-lost-controls`
 * can see it. A link built in `lib/` is invisible to that scan, which is how
 * the guided flow's `?tool=details&guide=1` first read as "lost".
 */
export function pickHomeNext(input: HomeNextInput): HomeNext {
  const { guide, hasDate, noun, papicReady, aiOffer } = input;
  if (guide) {
    return {
      kind: 'guide',
      title: guide.nextTitle ?? guide.roundTitle,
      body: `Your Event Hub · ${guide.roundTitle} · ${formatCount(guide.done)} of ${formatCount(guide.total)} done.`,
      action: 'Continue',
    };
  }
  if (!hasDate) {
    return {
      kind: 'date',
      title: `Set your ${noun} date`,
      body: 'Lock it in to start the countdown and open what waits for a date.',
      action: 'Set your date',
    };
  }
  if (papicReady) {
    return {
      kind: 'papic',
      title: 'Your free camera is ready',
      body: 'Hand it to someone you trust and the candids start landing in your gallery.',
      action: 'Open Papic',
    };
  }
  if (aiOffer) {
    return {
      kind: 'ai',
      title: 'Plan with Setnayan AI',
      body: 'Ask anything about your event.',
      action: 'See Setnayan AI',
    };
  }
  return {
    kind: 'plan',
    title: 'You are on track',
    body: 'Nothing is waiting on you right now. Your whole plan is just below.',
    action: 'See your plan',
  };
}

/** A count the Home states — "—" when the read did not happen, never 0. */
export function glanceCount(n: number, measured: boolean): string {
  return measured ? formatCount(n) : '—';
}

/** Days to go — "—" with no firm date (never a countdown to a placeholder). */
export function glanceDays(daysOut: number | null): { value: string; label: string } {
  if (daysOut === null || !Number.isFinite(daysOut)) return { value: '—', label: 'days to go' };
  if (daysOut <= 0) return { value: '0', label: daysOut === 0 ? 'today' : 'days to go' };
  return { value: formatCount(daysOut), label: daysOut === 1 ? 'day to go' : 'days to go' };
}

/** The money line — `null` means the read did not happen, and prints "—". */
export function glanceMoney(php: number | null): string {
  return php === null ? '—' : formatPhp(php);
}

/*
  ─── "YOUR SERVICES" — Papic and Setnayan AI, one compact row ─────────────────

  Owner, 2026-10-01, on the first screenshots: *"how about papic? and sai? not
  seen here? … let's add it"*. One row under the numbers, two items, each with
  the status the dashboard ALREADY derives — never a new opinion of its own:

   · Papic — `resolvePapicHomeTile` (lib/papic-home-tile.ts), the same reader
     the dashboard's Papic tile and the "free camera" nudge share. It is a
     READINESS read (photos gathered, pre-capture), not an ownership pill.
   · Setnayan AI — `isSetnayanAiActiveForEvent` under the resolved paywall, the
     entitlement the dashboard's `aiEntitled` uses.

  🔒 NOT IN THE STORE SHELL. Both are in `STORE_SHELL_HIDDEN_ADDON_KEYS`
  (lib/store-shell.ts) and their pages are web-only there, so the row is absent.
  ⛔ NEVER TWICE: the service that is today's Next card is left out of the row.
  A read that failed prints "—".
*/

export type HomeServiceKey = 'papic' | 'ai';
export type HomeService = { key: HomeServiceKey; name: string; status: string };

/** What `resolvePapicHomeTile` returned, or 'failed' when it threw. */
export type PapicStatusInput =
  | { permitted: false }
  | { permitted: true; tile: { photosGathered: number | null; preCapture: boolean } | null | 'failed' };

export function papicStatus(input: PapicStatusInput): string {
  // A viewer the capture counts are not shared with gets the door, not a number.
  if (!input.permitted) return 'Open';
  const { tile } = input;
  if (tile === 'failed') return '—';
  // No pool, no camera, no photo: this event has no Papic yet.
  if (tile === null) return 'Not added';
  // A refused count is not "nothing shot yet" (S41b).
  if (tile.photosGathered === null) return '—';
  if (tile.preCapture || tile.photosGathered === 0) return 'Free camera ready';
  return `On · ${formatCount(tile.photosGathered)} ${tile.photosGathered === 1 ? 'photo' : 'photos'}`;
}

/** `null` = the entitlement could not be resolved. */
export function aiStatus(active: boolean | null): string {
  if (active === null) return '—';
  return active ? 'On' : 'Try it';
}

export function homeServices(input: {
  next: HomeNextKind;
  storeShell: boolean;
  papic: string;
  ai: string;
}): HomeService[] {
  if (input.storeShell) return [];
  const all: HomeService[] = [
    { key: 'papic', name: 'Papic', status: input.papic },
    { key: 'ai', name: 'Setnayan AI', status: input.ai },
  ];
  return all.filter((s) => s.key !== input.next);
}

/*
  ─── EACH THING ONCE — what the dashboard below the first screen leaves out ───

  Owner, 2026-10-01 (DECISION_LOG "HOME ON DESKTOP SHOWS EACH THING ONCE"), on
  the TEST wedding's Home after the first screen shipped: *"you updated the Home
  of that event but instead of changing it I see dupes on the event."* The
  first screen was ADDED ON TOP of the old tiles, so four facts rendered twice:

   · days to go   — the first-screen number AND the "The wedding day" card's
                    countdown numeral (and the Sai briefing's "N days to go" chip);
   · coming / no reply — the three numbers AND the Guests tile AND the
                    "N guests haven't replied yet" row;
   · Paid / Still owing — the money line AND the Budget tile;
   · the Next card AND "Needs you this week" saying the same thing — "You are
                    on track · nothing is waiting" against "Nothing needs a
                    decision right now". (With decisions open the tile carries a
                    COUNT the first screen does not, so it stays.)

  Each is REMOVED (not rendered), never hidden behind a breakpoint: phone and
  desktop show the same Home, desktop just wider. What the first screen does not
  say — the Papic tile, the date and venue, % planned, the journey rail, the
  decisions board — stays.

  Pure and total so a guard can assert it: nothing above ⇒ nothing removed.
*/
export type FirstScreenAbove = {
  /** The kind of the one Next card the first screen drew. */
  nextKind: HomeNextKind;
  /** The first screen drew its Paid / Still owing line (the viewer may see the budget). */
  money: boolean;
};

export type FirstScreenRepeats = {
  /** The wedding-day card's days-to-go numeral and the briefing's days chip. */
  countdown: boolean;
  /** The Guests tile (coming · no reply). */
  guests: boolean;
  /** The "N guests haven't replied yet" row in the decisions tile. */
  rsvpRow: boolean;
  /** The Budget tile. */
  money: boolean;
  /** The whole "Needs you this week" tile. */
  needsYou: boolean;
};

export function firstScreenRepeats(
  above: FirstScreenAbove | undefined,
  openDecisionCount: number,
): FirstScreenRepeats {
  if (!above) return { countdown: false, guests: false, rsvpRow: false, money: false, needsYou: false };
  return {
    countdown: true,
    guests: true,
    rsvpRow: true,
    money: above.money,
    needsYou: above.nextKind === 'plan' && openDecisionCount === 0,
  };
}
