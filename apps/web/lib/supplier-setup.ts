/**
 * lib/supplier-setup.ts — A NEW SHOP'S SIX STEPS, DONE IN PLACE ON TODAY (pure — no I/O, no clock).
 *
 * Owner 2026-10-28 (corpus DECISION_LOG "SUPPLIER DASHBOARD APPROVED — EVERYTHING IN PLACE, A ⚙ PER PAGE", TODAY;
 * "THE SUPPLIER PACKAGE IS SIGNED OFF"; prototype `prototypes/supplier_in_place_2026-10-28/interactive.html` v8,
 * `steps` + `stepBody`): "new-shop setup = 6 folds done in place (Save → ✓, the bar grows, the next opens; big tools
 * such as the service maker as a SHEET over Today); step 4 counts Good · Better · Best (≥ 3 cards per Service,
 * 'N to go'); step 5 documents in place …; step 6 opens the shop's Anyone-QR fold."
 *
 *   1 Name your shop · 2 Your details · 3 Add your logo · 4 What you offer · 5 Send your documents · 6 Download your QR
 *
 * 🧾📥 STEPS 5 AND 6, 7 NOV 2026 (owner, build-sessions/PLAN-SUPPLIER-GO-LIVE-BUILD-2026-11-07.md Track C; prototype
 * `open-shop-redesign.html` v21): step 5 is one row per required paper (`lib/setup-papers.ts`); step 6 is "Download
 * your QR" — the shop's own page, `/v/<slug>` (`myPageUrl`), never the couple Event Hub root — and the house spotlight
 * runs once after it (`SETUP_TOUR_KEY`). Step 6's ✓ is THAT TOUR'S RECORD in `users.tour_seen_keys` (written by the
 * shipped `completeTour` when it ends or is skipped): a download is a press, and the record is the saved fact.
 *
 * NOTHING HERE RE-DECIDES A RULE THAT LIVES ELSEWHERE. Each fold's ✓ is read off what the shipped rail
 * (`buildFirstStepsRail`) or the shipped checklist (`businessProfileChecklist`) already measured — a fold is never
 * ticked by a press, only by the saved fact, so it cannot congratulate a step that did not happen. The rail's own
 * order (details → logo → what you offer → documents …) is the folds' order.
 *
 * 🔢 GOOD · BETTER · BEST IS A POSITION, NOT A COLUMN. There is no tier on `vendor_services`: a service's cards are
 * ordered by their own starting price (lowest first, unpriced last) and the first three are called Good, Better and
 * Best. No price is written or suggested here — only the supplier's own numbers are shown.
 */
import type { BadgeTone } from '@/app/_components/badge';
import type { BusinessProfileItem } from '@/lib/vendor-profile';
import type { FirstStepsRail } from '@/lib/vendor-first-steps';
import type { TourKey } from '@/lib/tours';
import { DETAILS_CHECKLIST_KEYS } from '@/lib/supplier-details';
import { formatCount } from '@/lib/format-number';

/** At least this many service cards per service (owner 2026-10-28). */
export const CARDS_PER_SERVICE = 3;
/** The three slots' names, in order (lowest starting price first). */
export const SERVICE_TIERS = ['Good', 'Better', 'Best'] as const;

/** One authored service card, as the setup fold needs it. */
export type SetupCard = {
  id: string;
  /** The service (`vendor_services.category`). */
  service: string;
  title: string | null;
  pricePhp: number | null;
};

export type OfferService = {
  service: string;
  /** The service's cards, lowest starting price first (unpriced last) — slot i is `SERVICE_TIERS[i]`. */
  cards: SetupCard[];
  /** Cards still to add for this service to reach `CARDS_PER_SERVICE`. */
  toGo: number;
};

export type OfferProgress = {
  services: OfferService[];
  /** Cards still to add across every service. */
  toGo: number;
};

/**
 * Every service the shop offers (its profile's services first, then any service it already made a card for), each
 * with its cards and what is left. A shop with no service at all has one whole service to go.
 *
 * 🔢 EACH REAL SERVICE ONCE (owner 2026-10-29, "fix her shop and service card"). `vendor_profiles.services` holds the
 * coarse profile category AND the taxonomy leaves (`/open-shop` writes `[coarse, leaf]`; `syncProfileFromCoverages`
 * keeps "coarse preserved + covered canonical leaves"), and the maker files a card under its LEAF — so counting the
 * coarse key as a second service asked a one-service shop for six cards, three of them for a "service" no card can
 * ever be filed under. A coarse key (`coarse`) is therefore NOT a service of its own when
 * the shop offers any leaf — unless a card is actually filed under it (a legacy card), when it is real and counted.
 * A shop whose services are ALL coarse (nothing finer chosen yet) keeps them, as before.
 */
export function offerProgress(
  offered: readonly string[],
  cards: readonly SetupCard[],
  /**
   * The coarse profile categories — `new Set(VENDOR_CATEGORIES)` (`lib/vendors.ts`), the same set
   * `syncProfileFromCoverages` preserves beside the leaves. Handed in (REQUIRED) so this file stays light for the
   * client folds that import it, and so no caller can forget it.
   */
  coarse: ReadonlySet<string>,
): OfferProgress {
  const hasLeaf = offered.some((s) => s && !coarse.has(s));
  const carded = new Set(cards.map((c) => c.service));
  const real = offered.filter((s) => !hasLeaf || !coarse.has(s) || carded.has(s));
  const order: string[] = [];
  for (const s of [...real, ...cards.map((c) => c.service)]) if (s && !order.includes(s)) order.push(s);
  const services = order.map((service) => {
    const mine = cards
      .filter((c) => c.service === service)
      .sort((a, b) => (a.pricePhp ?? Number.POSITIVE_INFINITY) - (b.pricePhp ?? Number.POSITIVE_INFINITY));
    return { service, cards: mine, toGo: Math.max(0, CARDS_PER_SERVICE - mine.length) };
  });
  const toGo = services.length === 0 ? CARDS_PER_SERVICE : services.reduce((n, s) => n + s.toGo, 0);
  return { services, toGo };
}

/** "1 to go" · "3 of 3" — the words on a service's row and on the fold. */
export function toGoWord(toGo: number): string {
  return `${formatCount(toGo)} to go`;
}

/** The tour that runs once after step 6 — and whose record is step 6's ✓ (`lib/tours.ts`). */
export const SETUP_TOUR_KEY = 'vendor_setup_tour_v1' as const satisfies TourKey;

export type SetupFoldKey = 'name' | 'details' | 'logo' | 'offer' | 'docs' | 'qr';

export type SetupFold = {
  key: SetupFoldKey;
  /** 1-based, the chip's number until it is ✓. */
  n: number;
  title: string;
  /** The one quiet line under the title. */
  line: string;
  done: boolean;
  /** A state at the right of the head ("1 to go" · "Checking" · "Needs a fix"), or null. */
  badge: { word: string; tone: BadgeTone } | null;
};

export type SetupDocs = {
  /** The latest application's status (`vendor_verification_applications.status`), null when none. */
  status: string | null;
  docsIn: number;
  docsTotal: number;
};

export type SetupInput = {
  checklist: readonly BusinessProfileItem[];
  rail: FirstStepsRail;
  /** Null when the cards could not be read — the fold then says so and is not ticked. */
  offer: OfferProgress | null;
  docs: SetupDocs;
  shopName: string | null;
  /** The shop's web address, for "Name your shop"'s line ("Banawe Florals · setnayan.com/banaweflorals"). */
  slug?: string | null;
  /** The main service's display name, for "What you offer"'s line ("Photography · no card yet"). */
  serviceLabel?: string | null;
  /**
   * Step 6: whether the QR's tour is on record (`users.tour_seen_keys` holds `SETUP_TOUR_KEY`). NULL when that read
   * was refused — the step then says it could not load, and is never ticked.
   */
  qrSaved: boolean | null;
};

export type SetupView = {
  folds: SetupFold[];
  done: number;
  of: number;
  /** The fold that opens on arrival — the first one not done (none when all six are). */
  firstOpen: SetupFoldKey | null;
};

/**
 * 📅 "In business since" moved from step 1 to step 2 on 2026-11-06 (owner, "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS
 * ANSWERED": the year LEAVES the sign-up door; Your details asks it). Left under "Name your shop", a shop that had
 * just named itself could never see that step ✓ — the one box the door no longer asks would hold it open forever.
 */
const SINCE_KEY = 'in_business_since_year';
const NAME_KEYS = DETAILS_CHECKLIST_KEYS.name.filter((k) => k !== 'logo' && k !== SINCE_KEY);
const DETAIL_KEYS = [SINCE_KEY, ...DETAILS_CHECKLIST_KEYS.what, ...DETAILS_CHECKLIST_KEYS.where, ...DETAILS_CHECKLIST_KEYS.contact];

/** The checklist rows a fold edits — the Your-details groups, cut the prototype's way (the name apart). */
export function setupChecklistKeys(key: 'name' | 'details' | 'logo'): readonly string[] {
  return key === 'name' ? NAME_KEYS : key === 'details' ? DETAIL_KEYS : ['logo'];
}

function allIn(checklist: readonly BusinessProfileItem[], keys: readonly string[]): boolean {
  const m = meterOf(checklist, keys);
  return m.total > 0 && m.done >= m.total;
}

/** How many of a step's own rows are in — the SAME count its ✓ is decided from, so the two can never disagree. */
function meterOf(checklist: readonly BusinessProfileItem[], keys: readonly string[]): { done: number; total: number } {
  const mine = checklist.filter((i) => keys.includes(i.key));
  return { done: mine.filter((i) => i.ok).length, total: mine.length };
}

export function assembleSetup(input: SetupInput): SetupView {
  const step = (k: string) => input.rail.steps.find((s) => s.key === k);
  const status = input.docs.status;
  const checking = status === 'pending_review' || status === 'in_review';
  const docsBadge: SetupFold['badge'] =
    step('documents')?.state === 'done'
      ? { word: 'Approved', tone: 'ok' }
      : checking
        ? { word: 'Checking', tone: 'wait' }
        : status === 'rejected'
          ? { word: 'Needs a fix', tone: 'no' }
          : input.docs.docsIn === 0
            ? { word: 'none sent yet', tone: 'quiet' }
            : { word: `${formatCount(input.docs.docsIn)} of ${formatCount(input.docs.docsTotal)} in`, tone: 'quiet' };
  const offer = input.offer;
  // ✓ ONLY WHEN ITS OWN METER IS FULL (owner 2026-11-06, the redesign's Today): "Your details" shows "7 of 8 in" —
  // the count of ITS rows — and is ticked from that same count, never from a different one.
  const details = meterOf(input.checklist, DETAIL_KEYS);
  const detailsDone = details.total > 0 && details.done >= details.total;
  const cardCount = offer ? offer.services.reduce((n, s) => n + s.cards.length, 0) : 0;
  const cardWord = cardCount === 0 ? 'no card yet' : `${formatCount(cardCount)} card${cardCount === 1 ? '' : 's'}`;
  const folds: SetupFold[] = [
    {
      key: 'name',
      n: 1,
      title: 'Name your shop',
      // The prototype's line: the name and the page address it became.
      line:
        [input.shopName?.trim() || null, input.slug ? `setnayan.com/${input.slug}` : null].filter(Boolean).join(' · ') ||
        'What couples call you',
      done: allIn(input.checklist, NAME_KEYS),
      badge: null,
    },
    {
      key: 'details',
      n: 2,
      title: 'Your details',
      line: 'Address, contact, the year you started',
      done: detailsDone,
      badge: detailsDone || details.total === 0
        ? null
        : { word: `${formatCount(details.done)} of ${formatCount(details.total)} in`, tone: 'quiet' },
    },
    {
      key: 'logo',
      n: 3,
      title: 'Add your logo',
      line: 'Shows on your page and your QR',
      done: step('logo')?.state === 'done',
      badge: step('logo')?.state === 'done' ? null : { word: 'Needed to go live', tone: 'quiet' },
    },
    {
      key: 'offer',
      n: 4,
      title: 'What you offer',
      // "Photography · no card yet" (the prototype) — the Good · Better · Best rule is the badge's "N to go".
      line: input.serviceLabel ? `${input.serviceLabel} · ${cardWord}` : 'At least 3 cards per service — Good · Better · Best',
      done: step('service_card')?.state === 'done',
      badge: offer === null ? { word: 'Couldn’t load', tone: 'no' } : offer.toGo > 0 ? { word: toGoWord(offer.toGo), tone: 'wait' } : null,
    },
    {
      key: 'docs',
      n: 5,
      title: 'Send your documents',
      line: 'Setnayan checks them before you go live',
      // Sent counts as done for the supplier: the next move is Setnayan's (the rail's own "waiting is not doing").
      done: step('documents')?.state === 'done' || checking,
      badge: docsBadge,
    },
    {
      key: 'qr',
      n: 6,
      title: 'Download your QR',
      line: 'Scan it → your page · put it on your photos, posts and cards',
      done: input.qrSaved === true,
      badge: input.qrSaved === null ? { word: 'Couldn’t load', tone: 'no' } : null,
    },
  ];
  const done = folds.filter((f) => f.done).length;
  return { folds, done, of: folds.length, firstOpen: folds.find((f) => !f.done)?.key ?? null };
}

/** "3 of 6 done" — or, once all six are, what happens next. */
export function setupHeadline(v: Pick<SetupView, 'done' | 'of'>): string {
  return v.done >= v.of ? 'All done — Setnayan checks you next' : `${formatCount(v.done)} of ${formatCount(v.of)} done`;
}

/**
 * The fold to open after a save: when the open fold has just turned ✓, the next one not done after it (then any
 * before it); otherwise the open fold stays open. Pure, so the "the next opens" promise is testable.
 */
export function nextOpenAfter(
  folds: readonly Pick<SetupFold, 'key' | 'done'>[],
  open: SetupFoldKey | null,
  wasDone: ReadonlySet<SetupFoldKey>,
): SetupFoldKey | null {
  if (!open) return open;
  const now = folds.find((f) => f.key === open);
  if (!now || !now.done || wasDone.has(open)) return open;
  const at = folds.findIndex((f) => f.key === open);
  return [...folds.slice(at + 1), ...folds.slice(0, at)].find((f) => !f.done)?.key ?? null;
}

/**
 * 7️⃣ STEP 7 — HOW MANY A DAY, ON TODAY (owner 10 Nov 2026, Build 6 Lane E; prototype
 * `supplier_clients_2026-11-07/supplier-menu-r2.v119.html` `todayNew`: "step 7 is Build 6" — a row UNDER the six, its
 * stepper on the row, never counted in "N of 6"). It is the SAME number Clients ⚙ › How many a day sets —
 * `vendor_schedule_pools.daily_booking_capacity`, written by the shipped `updatePoolCapacity` through the same
 * `FormCounter` — never a second field. Venues are asked "How many halls?" (the plan's words).
 *
 *   unread   the schedules read was refused — said, never a stepper standing on a guessed 1
 *   not_set  no schedule yet — "Set how many events you take a day…" + [Set it] (the Clients wording, #7423)
 *   set      one stepper per schedule (a shop with one schedule has its stepper on the row itself)
 *   halls    a venue whose schedules are all halls — each hall is named in Your halls, so the row counts them and
 *            opens Your halls; a stepper here would have to invent unnamed halls
 *
 * 🔒 app/vendor-dashboard/_components/setup-step-7-is-how-many-a-day.test.ts
 */
export const DAILY_STEP_N = 7;

export type SetupDailySchedule = { poolId: string; name: string; capacity: number; hall?: boolean };

export type SetupDailyView = {
  state: 'unread' | 'not_set' | 'set' | 'halls';
  title: string;
  line: string;
  /** The schedules a stepper is drawn for (`set` only), oldest first. */
  rows: { poolId: string; name: string; capacity: number }[];
};

export const DAILY_TITLE = 'How many events can you take on one day?';
export const DAILY_TITLE_VENUE = 'How many halls?';
export const DAILY_NOT_SET = 'Set how many events you take a day so couples see if your date is open.';
export const DAILY_UNREAD = 'Couldn’t load your schedule';

export function setupDailyView(input: {
  /** The shop's active schedules — NULL when that read was refused. */
  schedules: readonly SetupDailySchedule[] | null;
  /** A venue (a venue category, or any hall) — asked "How many halls?". */
  venue: boolean;
}): SetupDailyView {
  const title = input.venue ? DAILY_TITLE_VENUE : DAILY_TITLE;
  if (input.schedules === null) return { state: 'unread', title, line: DAILY_UNREAD, rows: [] };
  const plain = input.schedules.filter((s) => !s.hall);
  const halls = input.schedules.filter((s) => s.hall);
  if (plain.length > 0) {
    return {
      state: 'set',
      title,
      line: input.venue ? 'Count your halls. 2 halls = 2.' : 'Count your crews. 2 crews = 2.',
      // A stepper starts at 1 — a stored 0 or less is never shown as a number the supplier did not set.
      rows: plain.map((s) => ({ poolId: s.poolId, name: s.name, capacity: Math.max(1, Math.trunc(s.capacity) || 1) })),
    };
  }
  if (halls.length > 0) {
    const word = `${formatCount(halls.length)} hall${halls.length === 1 ? '' : 's'}`;
    return { state: 'halls', title, line: [word, ...halls.map((h) => h.name)].join(' · '), rows: [] };
  }
  return { state: 'not_set', title, line: DAILY_NOT_SET, rows: [] };
}
