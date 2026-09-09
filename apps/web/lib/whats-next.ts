/**
 * WHAT'S NEXT — the celebration that follows this one, if the host wants one.
 *
 * `02_The_Story_Maker.md` §7 · `08` step 1.7.
 *
 * ⚖ THE OWNER'S RULING IS THE SHAPE OF THIS FILE: **a story is finished on its
 * own. Most end here, and that is a whole story.** So nothing is pre-selected,
 * the resting answer is a real answer, and `NOTHING_YET` is a candidate in the
 * list rather than the absence of one. A screen that offered only ways to
 * continue would be asking the host to justify stopping.
 *
 * ── DERIVED, NEVER CREATED ───────────────────────────────────────────────────
 * 🔑 `lib/event-anchor.ts`'s OWN OWNER LOCK GOVERNS THIS SCREEN: *"Recurrence is
 * DERIVED at read time, never an auto-created row — an event exists only on the
 * user's go-signal tap."* Every candidate here is arithmetic over a date the
 * event already has. Naming one on the back cover writes a sentence; it does not
 * write a row. Only "Start it now" creates anything, and only on the tap.
 *
 * ── THE BADGE IS DERIVED FROM THE ANCHOR, NOT ASSIGNED BY HAND ───────────────
 * Which of the three badges a kind carries falls out of `anchorForType` — the
 * same map the create paths stamp `events.anchor_kind` from. A hand-kept list
 * beside it is exactly the drift that once let a birthday created one way never
 * appear on the Year view (see `event-anchor.ts`'s own note on `canToggleRecur`),
 * so there is no second list here to disagree with the first.
 */

/*
  TYPE-ONLY IMPORT — erased at runtime, so this module pulls in no `server-only`
  client and `whats-next.test.ts` can drive the write below with a recording
  stand-in. Same reason `lib/plan-next-year-authz.ts` exists as its own module:
  a test beside a `'use server'` action under `app/` is never collected by the
  repo's unit-test glob over `lib`, so a rule that lives only in the action is a
  rule nothing can measure.
*/
import type { SupabaseClient } from '@supabase/supabase-js';

import { anchorForType, nextAnniversary, parseISO } from './event-anchor';

/**
 * The three things we can honestly say about WHEN a candidate happens.
 *
 * `derived`  — we can name the date, because it comes from the day just held.
 * `waiting`  — its date comes from a birthdate. **We do not have one, we will
 *              not ask for one, and we will not guess.** The counsel gate in
 *              `event-insert.ts` refuses to store one on this path either.
 * `you_choose` — it has no anchor of its own; the host picks a day.
 */
export type NextTiming = 'derived' | 'waiting' | 'you_choose';

/** The resting answer. A choice, not the absence of one. */
export const NOTHING_YET = 'none' as const;

export type NextCandidate = {
  /** An `event_type_vocab` key — or `NOTHING_YET` for the resting card. */
  kind: string;
  /** The admin roster's own label, never a string invented here. */
  label: string;
  timing: NextTiming;
  /** ISO date we can name, for `derived` only. Null everywhere else. */
  dateISO: string | null;
  /**
   * The same date in the house's own words, formatted by the CALLER.
   *
   * ⚠ IT IS A STRING, NOT A FORMATTER, AND THAT IS NOT A STYLE CHOICE. This
   * list crosses the server/client boundary and a function cannot. Passing
   * `formatEventDate` down as a prop throws at render; formatting here would
   * mean a second date format on one page.
   */
  dateLabel: string | null;
  /** Whole days from today to `dateISO`. Null unless we can name a date. */
  inDays: number | null;
};

/**
 * The badge each timing wears, verbatim from `02` §7 and the prototype.
 * Exported so the screen cannot invent a fourth wording for a third state.
 */
export const TIMING_BADGE: Record<NextTiming, string> = {
  derived: '⟳ Derived, not created',
  waiting: '◇ Waiting on a date',
  you_choose: '✎ You set the date',
};

/** Why we can offer it — the line under the badge. */
export const TIMING_WHY: Record<NextTiming, string> = {
  derived:
    'It takes its date from the day you just had — so we already know when it is, and every one after it.',
  waiting:
    'Its date comes from a birthdate. We will not ask you for one, and we will not guess — pick this and the back cover simply says the chronicle continues.',
  you_choose: 'Some days have no anchor — you simply choose them.',
};

/**
 * An event type as the roster describes it, plus the one thing the roster does
 * not carry: whether its register is solemn.
 *
 * ⚠ `solemn` IS RESOLVED BY THE CALLER, and that is deliberate — it comes from
 * `eventWordsFor`, which reads the type profile, and this module stays pure so
 * its own test can prove the solemn arm without a database.
 */
export type NextTypeOption = { key: string; label: string; solemn: boolean };

/**
 * Types that are never offered as what comes next, whatever the roster says.
 *
 * `wedding` — the generic create path refuses it outright (it has its own
 * dedicated commit with the ceremony CHECK columns), so offering it here would
 * be an option that could not be taken.
 *
 * ⚖ THE SOLEMN REGISTER IS EXCLUDED SEPARATELY AND FOR A DIFFERENT REASON —
 * see `solemn` above. It is NOT in this list, because listing `wake` by name
 * would be a second answer to a question `terminology.register` already
 * answers, and the next solemn type somebody adds would walk straight past a
 * hardcoded name. Offering "a wake" as the happy sequel to a wedding is the
 * kind of sentence this product must never write.
 */
export const NEVER_OFFERED_AS_NEXT: ReadonlySet<string> = new Set(['wedding']);

function timingFor(kind: string): NextTiming {
  const anchor = anchorForType(kind).kind;
  if (anchor === 'person_birthdate') return 'waiting';
  if (anchor === 'union_date') return 'derived';
  return 'you_choose';
}

/** Whole days between two ISO dates, or null if either is unreadable. */
export function daysBetween(fromISO: string, toISO: string): number | null {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * The candidates to offer, in the design's order: the resting card first, then
 * the ones we can name a date for, then the rest.
 *
 * @param eventDateISO the day just held — the anchor every `derived` candidate
 *   takes its date from. A story with no date on its own event offers no
 *   `derived` candidate at all rather than guessing one.
 * @param todayISO today, passed in so the arithmetic is testable.
 * @param roster the creatable event types, from `getCreatableEventTypes`. Only
 *   types the account can actually create are ever offered.
 * @param formatDate the caller's own date formatter — the page's
 *   `formatEventDate`, so this screen never writes a second date format.
 */
export function nextCandidates(args: {
  eventDateISO: string | null;
  todayISO: string;
  roster: readonly NextTypeOption[];
  formatDate: (iso: string) => string;
}): NextCandidate[] {
  const { eventDateISO, todayISO, roster, formatDate } = args;

  const out: NextCandidate[] = [
    {
      kind: NOTHING_YET,
      label: 'Nothing yet',
      timing: 'you_choose',
      dateISO: null,
      dateLabel: null,
      inDays: null,
    },
  ];

  for (const option of roster) {
    if (NEVER_OFFERED_AS_NEXT.has(option.key)) continue;
    if (option.solemn) continue;

    const timing = timingFor(option.key);

    if (timing === 'derived') {
      // Derived means we can NAME the date. Without the day just held we
      // cannot, so the candidate is not offered rather than offered blank —
      // a card reading "Derived, not created" with no date on it is a promise
      // the screen has not kept.
      if (!eventDateISO) continue;
      const occurrence = nextAnniversary(eventDateISO, todayISO);
      if (!occurrence) continue;
      out.push({
        kind: option.key,
        label: option.label,
        timing,
        dateISO: occurrence.dateISO,
        dateLabel: formatDate(occurrence.dateISO),
        inDays: daysBetween(todayISO, occurrence.dateISO),
      });
      continue;
    }

    out.push({
      kind: option.key,
      label: option.label,
      timing,
      dateISO: null,
      dateLabel: null,
      inDays: null,
    });
  }

  return out;
}

/**
 * What the host chose, as it is stored on THIS story.
 *
 * ⚠ IT LIVES ON THE STORY, NOT ON A NEW EVENT ROW. "Announce it only" puts a
 * sentence on this story's back cover and creates nothing at all; the row that
 * `previous_event_id` points back from does not exist and may never exist.
 * Storing the announcement anywhere else would require a row to hang it on,
 * which is precisely the thing the ruling forbids.
 */
export type NextAnnouncement = { kind: string };

/**
 * The stored value → an announcement, or `null` for "nothing announced".
 *
 * Validated against the candidates actually on offer, so a hand-posted value
 * cannot put a type on the back cover that the screen would never show — a
 * retired type, a solemn one, or a wedding.
 */
export function sanitizeNextAnnouncement(
  raw: unknown,
  offered: readonly NextCandidate[],
): NextAnnouncement | null {
  const value =
    raw && typeof raw === 'object'
      ? (raw as Record<string, unknown>).kind
      : raw;
  if (typeof value !== 'string') return null;
  const kind = value.trim();
  if (!kind || kind === NOTHING_YET) return null;
  return offered.some((c) => c.kind === kind) ? { kind } : null;
}

/**
 * How the back cover of this story reads — the words themselves, so the desk's
 * live preview and the published page cannot describe the same choice
 * differently.
 *
 * `null` when nothing was announced, and the caller draws NOTHING: no dashed
 * placeholder on the published page, no "coming soon", no door. **A story that
 * ends at the last word is finished** — the back cover is absent, not empty.
 */
export function backCoverOf(
  announcement: NextAnnouncement | null,
  offered: readonly NextCandidate[],
): { title: string; when: string; sub: string | null } | null {
  if (!announcement) return null;
  const candidate = offered.find((c) => c.kind === announcement.kind);
  if (!candidate) return null;

  if (candidate.timing === 'derived' && candidate.dateLabel) {
    return {
      title: candidate.label,
      when: candidate.dateLabel,
      sub: candidate.inDays === null ? null : `in ${candidate.inDays} days`,
    };
  }
  if (candidate.timing === 'waiting') {
    return { title: candidate.label, when: 'The chronicle continues', sub: null };
  }
  return { title: candidate.label, when: 'A day still to choose', sub: null };
}

/**
 * THE ONLY TABLE AN ANNOUNCEMENT MAY TOUCH.
 *
 * ⚖ "Announce it only" CREATES NOTHING — the owner's ruling, and the reason
 * `event-anchor.ts` may derive a candidate at all ("an event exists only on the
 * user's go-signal tap"). One key on a row that already exists.
 */
export const ANNOUNCEMENT_WRITES_TO = 'event_editorial' as const;

/**
 * Put the announcement on this story's back cover — or take it off.
 *
 * ⚠ READ-MODIFY-WRITE, AND THE READ'S REFUSAL IS FATAL. `draft_json` is one
 * document holding the host's headline, deck and every chapter override.
 * Writing `{ whatsNext }` over a document we FAILED TO READ would delete all of
 * it — a refused read is not an empty draft. Returns false instead.
 */
export async function writeAnnouncement(
  admin: SupabaseClient,
  eventId: string,
  value: NextAnnouncement | null,
): Promise<boolean> {
  const { data: existing, error: readError } = await admin
    .from(ANNOUNCEMENT_WRITES_TO)
    .select('draft_json')
    .eq('event_id', eventId)
    .maybeSingle();
  if (readError) return false;

  const base =
    existing?.draft_json && typeof existing.draft_json === 'object'
      ? (existing.draft_json as Record<string, unknown>)
      : {};

  const { error } = await admin.from(ANNOUNCEMENT_WRITES_TO).upsert(
    {
      event_id: eventId,
      draft_json: { ...base, whatsNext: value },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  return !error;
}
