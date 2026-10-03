/**
 * lib/hub-setup-steps.ts — "FINISH YOUR EVENT HUB": THE EVENT HUB SETUP (B),
 * the step after the wedding onboarding (A).
 *
 * ⚖ Owner-approved 2026-10-01 — spec corpus
 * `WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC_2026-10-01.md` (THE MAP
 * rows B1–B7) and DECISION_LOG 2026-10-01 "ASK EVERY FACT ONCE — THE EVENT HUB
 * SETUP NEVER REPEATS WHAT ONBOARDING GATHERED"; approved design
 * `prototypes/finish_your_event_hub_v2_2026-10-01_fable.html`.
 *
 * 🔑 THE ONE RULE — every fact is asked once and stored where its app already
 * reads it. A setup step is NOT a new screen and NOT a new field: it is a
 * Details item of the Event Hub Maker (`item`), opened one at a time by the
 * Maker's "What's left" (`lib/details-guided-flow.ts`, which puts these steps
 * first). What a step writes is what that item's editor already writes
 * (`writes`) — so opening the Maker after the setup shows everything filled in.
 * No setup-only table, no copy, no sync job.
 *
 *   B1   When should guests arrive?      → the Schedule's public "Guests arrive" moment
 *   B2   Parish and reception            → each venue LOCKED, or its typed name (not drawn when both are locked)
 *   B3   Your Love Story (four chapters) → `events.love_story` moments
 *   B4   What everyone wears             → the Mood Board's dress code (`dress_code_config`)
 *   B5–6 What to ask guests · reply-by   → `rsvp_ask_config` questions · `guest_list_edit_deadline`
 *   B7   Your guests' names              → the Guest list (`guests`), by the template import
 *
 * Anything onboarding asked (`ONBOARDING_A_FIELDS`) is never a step here —
 * `hub-setup-steps.test.ts` fails the day a step writes one of them.
 *
 * 🔓 UNLOCKS — each step names what filling it in turns on; until then the
 * Maker shows "Locked — finish ___" (filled in, never a paywall).
 *
 * Pure and client-safe: no I/O, no React. Its facts are read on the server
 * (`hubSetupFactsFrom`, `details-guided-progress.ts`) — by the Maker and by
 * Home from the SAME derivation, so the three doors (the once-offer after
 * onboarding, Home's slim card, the Maker's What's left) count the same steps.
 */

/** A setup step. `guests` is the one with no Details item — it opens the Guest list's import. */
export type HubSetupStepKey = 'arrive' | 'venues' | 'love-story' | 'wear' | 'ask' | 'guests';

/** The Details items a setup step opens (a type-only mirror of `DetailsItemKey`'s members it uses). */
export type HubSetupItem = 'schedule' | 'venues' | 'love-story' | 'mood-board' | 'rsvp';

export type HubSetupStepDef = {
  key: HubSetupStepKey;
  /** THE MAP row it is. */
  map: 'B1' | 'B2' | 'B3' | 'B4' | 'B5–6' | 'B7';
  title: string;
  /** Its one line under the title. */
  shows: string;
  /** The words "Locked — finish ___" names it by. */
  short: string;
  /** The Details item it opens; null = it opens a page (the Guest list's import). */
  item: HubSetupItem | null;
  /** What filling it in turns on. */
  unlocks: string;
  /** The fields it writes — each the field its Maker place already reads. */
  writes: readonly string[];
  /** Only where guests reply from a list (never on an open event — one QR for everyone). */
  guestListOnly?: true;
};

/**
 * THE STEPS, in THE MAP's order. DATA: a new step is a row.
 * B5 and B6 are ONE step — THE MAP draws them as one row ("What to ask guests ▾ ·
 * Reply-by"), they unlock one thing together ("RSVP can go live") and they are
 * edited in one Maker place (Details › RSVP, `maker-rsvp-ask.tsx`).
 */
export const HUB_SETUP_STEPS: readonly HubSetupStepDef[] = [
  {
    key: 'arrive',
    map: 'B1',
    title: 'When should guests arrive?',
    shows: 'Add a public “Guests arrive” moment before your ceremony.',
    short: 'When guests arrive',
    item: 'schedule',
    unlocks: 'the run of the day, and “Arrive by” for your guests',
    writes: ['event_schedule_blocks'],
  },
  {
    key: 'venues',
    map: 'B2',
    title: 'Parish and reception',
    shows: 'Your Event Hub shows your booked venues first — or the name you type.',
    short: 'Parish and reception',
    item: 'venues',
    unlocks: 'Directions on the day, and the Parish and Reception cards',
    writes: ['event_vendors'],
  },
  {
    key: 'love-story',
    map: 'B3',
    title: 'Your Love Story',
    shows: 'Four short chapters — a date, a few lines, photos. Any of it can wait.',
    short: 'Love Story',
    item: 'love-story',
    unlocks: 'the Our Love Story page — it opens with the first chapter you fill',
    writes: ['events.love_story'],
  },
  {
    key: 'wear',
    map: 'B4',
    title: 'What everyone wears',
    shows: 'Saved to your Mood Board — one dress code per group.',
    short: 'What everyone wears',
    item: 'mood-board',
    unlocks: 'What to wear on your Event Hub and on the invitation',
    writes: ['events.dress_code_config'],
  },
  {
    key: 'ask',
    map: 'B5–6',
    title: 'What to ask guests · reply-by',
    shows: 'What guests answer when they reply, and the date they reply by.',
    short: 'What to ask guests',
    item: 'rsvp',
    unlocks: 'RSVP can go live — at your next Apply',
    writes: ['events.rsvp_ask_config.questions', 'events.guest_list_edit_deadline'],
    guestListOnly: true,
  },
  {
    key: 'guests',
    map: 'B7',
    title: 'Your guests’ names',
    shows: 'Names make the invitations. Fill the guest-list template, or add them one by one.',
    short: 'Guest names',
    item: null,
    unlocks: 'personal invitations, tickets and the seat plan',
    writes: ['guests'],
    guestListOnly: true,
  },
];

/**
 * THE FIELDS ONBOARDING (A) WRITES — never asked again here (THE MAP rows A1–A7,
 * A-Hub, A-C; the shipped wedding commit `app/onboarding/wedding/actions.ts` and
 * `setupColumns`). `rsvp_ask_config` is shared by ONE column and split by key:
 * onboarding writes who gets in (`guestsReply` · `whoCanRsvp`); the setup writes
 * only the questions.
 */
export const ONBOARDING_A_FIELDS: readonly string[] = [
  'events.bride_name',
  'events.groom_name',
  'events.ceremony_type',
  'events.ceremony_sub_type',
  'events.is_mixed_ceremony',
  'events.secondary_ceremony_type',
  'events.date_mode',
  'events.date_candidates',
  'events.date_window_start',
  'events.date_window_end',
  'events.event_date',
  'events.region',
  'events.venue_latitude',
  'events.venue_longitude',
  'events.venue_name',
  'events.rsvp_ask_config.guestsReply',
  'events.rsvp_ask_config.whoCanRsvp',
  'events.estimated_pax',
  'events.budget_band',
  'events.estimated_budget_centavos',
  'events.landing_page_hero_image_url',
  'events.invite_theme',
  'events.role_palette',
  'events.mood_feel_key',
];


/**
 * The facts each step's "done" is read from — every one already stored. A null
 * fact was not read (a refused query): its step makes NO claim ('check'),
 * never a "not done" nobody measured.
 */
export type HubSetupFacts = {
  /** Guests reply from a list (`rsvp_ask_config.guestsReply !== false`) — onboarding's "How do guests get in?". */
  guestList: boolean;
  /** A public, top-level "Guests arrive" moment (`pre_ceremony`) is on the Schedule. */
  arrival: boolean | null;
  /** Which venues are LOCKED — a confirmed booking (`event_vendors`, `pickVenueBookingRows`). Both → the step is not drawn. */
  venuesLocked: { ceremony: boolean; reception: boolean } | null;
  /**
   * Which venues the Event Hub SHOWS by name — locked first, the typed name as
   * the fallback (owner, Lane 2 answer #3; `resolveEventVenues`, the Hub's own
   * resolver). A couple who types their venue is done; nothing waits forever
   * on a lock "Enter your own" can never make.
   */
  venuesNamed: { ceremony: boolean; reception: boolean } | null;
  /** The Love Story's moments (`resolveMoments`). */
  loveStoryMoments: number | null;
  /** The Mood Board carries a dress code (`dressCodeIsSet`). */
  wear: boolean | null;
  /** A reply-by date is set (`guest_list_edit_deadline`). */
  replyBy: boolean | null;
  /** Guests on the list besides the couple themselves. */
  guests: number | null;
};

export type HubSetupState = 'done' | 'left' | 'check';

export type HubSetupStep = HubSetupStepDef & { state: HubSetupState };

const stateOf = (v: boolean | null): HubSetupState => (v === null ? 'check' : v ? 'done' : 'left');

/** One step's done, from the facts. */
export function hubSetupDone(key: HubSetupStepKey, f: HubSetupFacts): boolean | null {
  switch (key) {
    case 'arrive':
      return f.arrival;
    case 'venues': {
      // Each venue: locked, OR shown by its typed name — the Hub's own rule.
      if (!f.venuesLocked || !f.venuesNamed) return null;
      const has = (k: 'ceremony' | 'reception') => f.venuesLocked![k] || f.venuesNamed![k];
      return has('ceremony') && has('reception');
    }
    case 'love-story':
      return f.loveStoryMoments === null ? null : f.loveStoryMoments > 0;
    case 'wear':
      return f.wear;
    case 'ask':
      return f.replyBy;
    case 'guests':
      return f.guests === null ? null : f.guests > 0;
  }
}

/**
 * THE STEPS THIS EVENT GETS — built from what is MISSING, never a fixed list:
 *   · a step whose Details item this event does not have is not drawn
 *     (`items`: the items the Maker draws for it);
 *   · on an open event (one QR, no guest list) What to ask · reply-by and the
 *     guests' names are not drawn;
 *   · when both venues are already LOCKED (onboarding, or a booked supplier)
 *     the venue step is not drawn — a locked venue is never asked.
 */
export function hubSetupSteps(f: HubSetupFacts, items: ReadonlySet<string>): HubSetupStep[] {
  const out: HubSetupStep[] = [];
  for (const def of HUB_SETUP_STEPS) {
    if (def.item && !items.has(def.item)) continue;
    if (def.guestListOnly && !f.guestList) continue;
    if (def.key === 'venues' && f.venuesLocked?.ceremony && f.venuesLocked.reception) continue;
    out.push({ ...def, state: stateOf(hubSetupDone(def.key, f)) });
  }
  return out;
}

/** "n of m" — what is really in place (a skipped step stays not done), and the next two still to do. */
export function hubSetupProgress(steps: readonly Pick<HubSetupStep, 'key' | 'title' | 'state'>[]): {
  done: number;
  total: number;
  next: HubSetupStepKey | null;
  nextTitle: string | null;
  thenTitle: string | null;
} {
  const left = steps.filter((s) => s.state === 'left');
  return {
    done: steps.filter((s) => s.state === 'done').length,
    total: steps.length,
    next: left[0]?.key ?? null,
    nextTitle: left[0]?.title ?? null,
    thenTitle: left[1]?.title ?? null,
  };
}

/** 🔓 The line under every step: what it turns on — "Unlocked" once it has. */
export function unlockLine(step: Pick<HubSetupStepDef, 'unlocks'>, state: HubSetupState): string {
  return state === 'done' ? `Unlocked: ${step.unlocks}.` : `Unlocks: ${step.unlocks}.`;
}

export { HUB_SETUP_LOCKED_SCENES, hubSetupApplies, lockedLine } from './hub-setup-locks';

/**
 * THE SETUP ROUND, READY FOR THE PLAN — what `buildGuidedPlan` draws as round 0:
 * each step with its unlock line already worded, and every item the setup owns
 * (`claims` — a step not drawn because its fact is in place still owns its
 * item, so the item never returns to a later round). Built on the SERVER and
 * handed to the plan, so the step table never rides in the Maker's first load.
 */
export type HubSetupRoundStep = Pick<HubSetupStep, 'key' | 'title' | 'shows' | 'item' | 'state'> & { unlocks: string };
export type HubSetupRound = { steps: HubSetupRoundStep[]; claims: HubSetupItem[] };

export function hubSetupRound(f: HubSetupFacts, items: ReadonlySet<string>): HubSetupRound {
  return {
    steps: hubSetupSteps(f, items).map((s) => ({
      key: s.key,
      title: s.title,
      shows: s.shows,
      item: s.item,
      state: s.state,
      unlocks: unlockLine(s, s.state),
    })),
    claims: HUB_SETUP_STEPS.flatMap((d) => (d.item && items.has(d.item) ? [d.item] : [])),
  };
}

/** Where the guest-names step opens: the Guest list's template import (#6225). */
export function hubSetupGuestsHref(eventId: string): string {
  return `/dashboard/${eventId}/guests/import`;
}
