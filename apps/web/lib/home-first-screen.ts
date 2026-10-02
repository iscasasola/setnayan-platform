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
 *   guests → "Add your guests", while the (measured) list is empty
 *   invite → "Send N invitations", N = the measured guests not yet sent one
 *            (first-timer fix 9, 2026-10-02 — the approved frame 1 card)
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
import { SERVICE_NAMES } from '@/lib/service-names';

export type HomeNextKind = 'guide' | 'date' | 'guests' | 'invite' | 'papic' | 'ai' | 'plan';

/** The order the Home already stacked its nudges in — the first that applies is Next. */
export const HOME_NEXT_ORDER: readonly HomeNextKind[] = ['guide', 'date', 'guests', 'invite', 'papic', 'ai', 'plan'];

/** The guided flow's position, as Home reads it (null = nothing left, not for this viewer, or unread). */
export type HomeGuide = {
  round: number;
  roundTitle: string;
  done: number;
  total: number;
  nextTitle: string | null;
  /** The step after the next one still to do (the setup's slim card names two). */
  thenTitle?: string | null;
  /** 🧭 The setup round ("Finish your Event Hub", B) is what is left. */
  setup?: boolean;
  /** …and it is still to be offered once, right after onboarding (Start / Later). */
  offer?: boolean;
} | null;

export type HomeNext = {
  kind: HomeNextKind;
  title: string;
  body: string;
  action: string;
  /**
   * 🧭 THE ONCE-OFFER after onboarding (owner-approved default 2026-10-01: "the
   * Event Hub setup is offered once after onboarding + the Home card + the
   * Maker's What's left"): the guide card drawn as "Start / Later". Absent =
   * the ordinary one-button card.
   */
  offer?: boolean;
};

/**
 * The guest list as Home read it — null when the read did not happen, so the
 * guests/invite cards are never drawn from a refused query (a couple with 180
 * names must never be told "Add your guests").
 */
export type HomeGuestsRead = {
  /** Guests on the living, accepted list, the couple themselves excluded. */
  total: number;
  /** …of whom no invitation has been sent (`invitation_sent_at` empty). */
  unsent: number;
} | null;

/** Count the Home's guests read — the same set `/guests/send` offers to send to. */
export function homeGuestsRead(
  rows: readonly { role?: string | null; invitation_sent_at?: string | null }[],
  measured: boolean,
): HomeGuestsRead {
  if (!measured) return null;
  const invitable = rows.filter((g) => g.role !== 'bride' && g.role !== 'groom');
  return {
    total: invitable.length,
    unsent: invitable.filter((g) => !(typeof g.invitation_sent_at === 'string' && g.invitation_sent_at.trim() !== '')).length,
  };
}

export type HomeNextInput = {
  guide: HomeGuide;
  hasDate: boolean;
  guests: HomeGuestsRead;
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
  const { guide, hasDate, guests, noun, papicReady, aiOffer } = input;
  if (guide?.setup) {
    /* "Finish your Event Hub — n of m · Continue" (frame 10): the next two steps
       still to do; the count is what is really in place. */
    const next = guide.nextTitle ? `Next: ${guide.nextTitle}${guide.thenTitle ? ` · then ${guide.thenTitle}` : ''}` : '';
    return {
      kind: 'guide',
      title: `Finish your Event Hub — ${formatCount(guide.done)} of ${formatCount(guide.total)}`,
      /* The offer is frame 0, "Before we start", in one card: what we already
         have, what is left, what helps — and that none of it is required. */
      body: guide.offer
        ? `From sign-up we already have your names, dates, look and how guests get in — we won’t ask again. ${formatCount(guide.total - guide.done)} short ${guide.total - guide.done === 1 ? 'step finishes' : 'steps finish'} your Event Hub; Love Story photos help. None of it is required.`
        : next,
      action: guide.offer ? 'Start' : 'Continue',
      ...(guide.offer ? { offer: true } : {}),
    };
  }
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
  if (guests && guests.total === 0) {
    return {
      kind: 'guests',
      title: 'Add your guests',
      body: 'Your guest list is empty.',
      action: 'Add guests',
    };
  }
  if (guests && guests.unsent > 0) {
    const n = formatCount(guests.unsent);
    return {
      kind: 'invite',
      title: `Send ${n} ${guests.unsent === 1 ? 'invitation' : 'invitations'}`,
      body: `${n} of ${formatCount(guests.total)} ${guests.total === 1 ? 'guest has' : 'guests have'} not been sent one yet.`,
      action: 'Send invitations',
    };
  }
  if (papicReady) {
    return {
      kind: 'papic',
      title: 'Your free camera is ready',
      body: 'Hand it to someone you trust and the candids start landing in your gallery.',
      action: `Open ${SERVICE_NAMES.papic.plain.toLowerCase()}`,
    };
  }
  if (aiOffer) {
    return {
      kind: 'ai',
      title: `${SERVICE_NAMES['setnayan-ai'].plain} · ${SERVICE_NAMES['setnayan-ai'].brand}`,
      body: 'Ask anything about your event.',
      action: `See the ${SERVICE_NAMES['setnayan-ai'].plain.toLowerCase()}`,
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
/** `name` is the plain name (first), `brand` the Setnayan name (small under) — `lib/service-names.ts`. */
export type HomeService = { key: HomeServiceKey; name: string; brand: string; status: string };

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
    { key: 'papic', name: SERVICE_NAMES.papic.plain, brand: SERVICE_NAMES.papic.brand, status: input.papic },
    { key: 'ai', name: SERVICE_NAMES['setnayan-ai'].plain, brand: SERVICE_NAMES['setnayan-ai'].brand, status: input.ai },
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
   · the "Kumusta, <name> · welcome back" hero — the first screen's cover (event
                    name + date) is the greeting now; frame 1 draws no hero;
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
  /** The "Kumusta, … · welcome back" greeting + "Your wedding is taking shape" sentence: the first screen's cover is the greeting now (frame 1 draws none). */
  hero: boolean;
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
  if (!above) return { hero: false, countdown: false, guests: false, rsvpRow: false, money: false, needsYou: false };
  return {
    hero: true,
    countdown: true,
    guests: true,
    rsvpRow: true,
    money: above.money,
    needsYou: above.nextKind === 'plan' && openDecisionCount === 0,
  };
}
