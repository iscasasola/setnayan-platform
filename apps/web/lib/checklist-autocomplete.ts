/**
 * Checklist auto-completion — derive "done" from real state (owner 2026-06-16).
 *
 * The couple checklist (lib/checklist.ts) shouldn't make a couple tick "Book your
 * caterer" by hand once they've actually booked one. This module is the PURE,
 * deterministic mapping from structural facts the app already holds → the set of
 * template tasks those facts satisfy. The server reconcile (checklist-actions.ts)
 * fetches the signals and flips matching PENDING rows to done.
 *
 * Mirrors the Wedding Roadmap's hybrid auto/manual model (lib/wedding-roadmap.ts):
 * NO AI, NO inference — a vendor counts as booked only at a confirmed status, a
 * count is > 0, a document is received. Auto-complete only ever moves a task
 * pending → done; it never un-checks, and a couple can still tick anything by
 * hand. Tasks with no reliable signal (invitations, vows, …) stay manual.
 *
 * The category → task map reuses PLAN_GROUPS (lib/wedding-plan-groups.ts) — the
 * same bucketing the home roadmap uses — so the checklist can never drift from
 * the plan grid on what "booked your caterer" means.
 */

import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';

/**
 * Each `book_*` checklist task → the PLAN_GROUP whose categories, once a vendor
 * in them is confirmed, satisfy it. Venue maps to BOTH venue groups (the task is
 * "ceremony & reception venue"). Music maps to the reception band/DJ group only —
 * ceremony musicians are a separate, harder-to-detect booking, left manual.
 */
const BOOK_TASK_TO_PLAN_GROUPS: Record<string, readonly string[]> = {
  book_venue: ['reception_venue', 'ceremony_venue'],
  shortlist_venues: ['reception_venue', 'ceremony_venue'],
  book_caterer: ['catering'],
  book_photo: ['photography'],
  book_hmua: ['hair_makeup'],
  book_coordinator: ['coordinator'],
  book_florist: ['florals_decor'],
  book_host: ['host_mc'],
  book_lights_sound: ['lights_sound'],
  book_photobooth: ['photobooth'],
  // 'transportation' is the only enum value covering bridal car / shuttle / misc
  // transport — they're indistinguishable at event_vendors.category. The task is
  // titled "Book your bridal car / transportation", so any confirmed transport
  // vendor satisfying it is working-as-titled (accepted overlap, not a bug).
  book_bridal_car: ['bridal_car'],
  book_reception_music: ['music_entertainment'],
  order_cake: ['cake'],
};

/**
 * Per-task category overrides — used when the satisfying categories are NARROWER
 * than the plan group's full set. Reception music = band/DJ only: string_quartet
 * and choir are ceremony musicians (book_ceremony_music, left manual), so a
 * ceremony-only quartet must NOT auto-complete the reception-music task.
 */
const BOOK_TASK_CATEGORY_OVERRIDE: Record<string, readonly string[]> = {
  book_reception_music: ['band_dj'],
};

/** vendor_category values that count as "booked" for each book_* task. */
const BOOK_TASK_CATEGORIES: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(BOOK_TASK_TO_PLAN_GROUPS).map(([taskKey, groupIds]) => {
    const override = BOOK_TASK_CATEGORY_OVERRIDE[taskKey];
    if (override) return [taskKey, new Set<string>(override)];
    const cats = new Set<string>();
    for (const gid of groupIds) {
      const group = PLAN_GROUPS.find((g) => g.id === gid);
      for (const c of group?.categories ?? []) cats.add(c);
    }
    return [taskKey, cats];
  }),
);

/**
 * Structural completion signals the reconcile derives from the event's data.
 * Every field is a plain fact (a count, a non-null timestamp, a confirmed
 * status) — never inference.
 */
export type ChecklistSignals = {
  /** event_vendors categories at a confirmed status (contracted / deposit_paid / delivered / complete). */
  confirmedCategories: ReadonlySet<string>;
  /** events.estimated_budget_centavos > 0 */
  budgetSet: boolean;
  /** events.estimated_pax > 0 OR ≥1 guest row. */
  guestEstimateSet: boolean;
  /** ≥1 guest on the list. */
  hasGuests: boolean;
  /** ≥1 seating table created. */
  seatingStarted: boolean;
  /** ≥1 schedule block created. */
  scheduleStarted: boolean;
  /** events.palette_finalized_at is set. */
  paletteFinalized: boolean;
  /** A custom monogram (drawn or uploaded) exists. */
  monogramSet: boolean;
  /** event_paperwork marriage-license row at status 'received'. */
  marriageLicenseReceived: boolean;
  /** event_paperwork PSA/CENOMAR row at status 'received'. */
  psaReceived: boolean;
  /** events.date_status = 'locked' — the couple has committed to a specific date. */
  dateStatusLocked: boolean;
};

/**
 * The set of template_keys the given signals satisfy. Pure + deterministic:
 * same signals → same set. Only keys with a RELIABLE structural signal appear;
 * everything else stays manual.
 */
export function computeSatisfiedChecklistKeys(signals: ChecklistSignals): Set<string> {
  const done = new Set<string>();

  // Booked-vendor tasks: any confirmed vendor in the task's category set.
  for (const [taskKey, cats] of Object.entries(BOOK_TASK_CATEGORIES)) {
    for (const c of signals.confirmedCategories) {
      if (cats.has(c)) {
        done.add(taskKey);
        break;
      }
    }
  }

  // First-party milestones (one structural fact each).
  if (signals.budgetSet) done.add('set_budget');
  if (signals.guestEstimateSet) done.add('guest_estimate');
  if (signals.hasGuests) {
    done.add('draft_guest_list');
    done.add('guest_list');
  }
  if (signals.seatingStarted) done.add('seating');
  if (signals.scheduleStarted) done.add('schedule');
  if (signals.paletteFinalized) {
    done.add('lock_theme');
    done.add('mood_board');
  }
  if (signals.monogramSet) done.add('monogram');
  if (signals.marriageLicenseReceived) done.add('marriage_license');
  if (signals.psaReceived) done.add('psa_cenomar');
  if (signals.dateStatusLocked) done.add('set_date');

  return done;
}

/** Every template_key auto-completion can ever flip — for tests + sanity bounds. */
export const AUTO_COMPLETABLE_KEYS: ReadonlySet<string> = new Set<string>([
  ...Object.keys(BOOK_TASK_CATEGORIES),
  'set_budget',
  'guest_estimate',
  'draft_guest_list',
  'guest_list',
  'seating',
  'schedule',
  'lock_theme',
  'mood_board',
  'monogram',
  'marriage_license',
  'psa_cenomar',
  'set_date',
]);
