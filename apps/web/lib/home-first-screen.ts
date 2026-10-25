/**
 * lib/home-first-screen.ts — WHAT THE PHONE HOME SHOWS FIRST (pure, no I/O).
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SIMPLE PHONE APP — APPROVED";
 * `Setnayan/prototypes/phone_app_simple_2026-10-01_fable.html`, frame 1 "Home"):
 * ONE "Next" card → an always-there **Event Hub** door → three
 * numbers (days to go · coming · no reply) + one Paid / Still owing line.
 * Nothing else above the fold on a 390 × 844 phone.
 *
 * 🔑 NOTHING HERE IS NEW. The Next card is the Home's EXISTING nudges collapsed
 * into one, in the order the Home already stacked them (page.tsx `overlays`):
 *
 *   guide → "Finish your Event Hub — n of m" (the guided "What's left", by
 *           stage — PR-2: its button opens "Which stage do you want ready?"),
 *           for whom Details is
 *   date  → the set-your-date nudge, while no date is set
 *   guests → "Add your guests", while the (measured) list is empty
 *   invite → "Send N invitations", N = the measured guests not yet sent one
 *            (first-timer fix 9, 2026-10-02 — the approved frame 1 card)
 *   papic → at its moments (`lib/papic-glance.ts`, owner 2026-10-13 📍 · 2026-10-14 🎨):
 *           "Your cameras are ready" before the first photo · "Your cameras have
 *           stopped" at zero · running low on the event day. The approved
 *           prototype ranks it ABOVE the guest steps (its stopped card stands
 *           where "Send 12 invitations" would), so it does here.
 *   ai    → the Setnayan AI offer, last because it is a purchase, not a step
 *   plan  → nothing above is waiting: the checklist (the whole plan, step by step)
 *
 * The first that applies wins; the rest are reached from their own page (the
 * Home has no second section: owner 2026-10-02, "HOME IS THE FIRST SCREEN
 * ONLY"). The numbers come from the existing honest reads, and a read
 * that did not happen prints "—", NEVER 0 (the rule of
 * `lib/guests-read-is-honest.test.ts`): a couple with 180 names must never be
 * told "0 coming" because a query was refused.
 */
import { recordFieldHref } from '@/lib/event-details-record';
import { formatCount } from '@/lib/format-number';
import { formatPhp } from '@/lib/php';
import { SERVICE_NAMES, type ServiceNameKey } from '@/lib/service-names';
import { liveStudioControlPath } from '@/lib/live-studio-control';
import { isToInvite, type InviteFacts } from '@/lib/guest-roster-view';
import type { PapicMoment } from '@/lib/papic-glance';
import type { GlanceLine, ServiceGlance } from '@/lib/service-glance';

export type HomeNextKind = 'guide' | 'date' | 'unread' | 'guests' | 'invite' | 'papic' | 'ai' | 'plan';

/**
 * The guided flow's button — it names what the tap does (owner, live phone test
 * 2026-10-02): it opens "Which stage do you want ready?" (PR-2, owner 2026-10-04).
 */
export const HOME_GUIDE_ACTION = 'Pick a stage';

/** The order the Home already stacked its nudges in — the first that applies is Next. */
export const HOME_NEXT_ORDER: readonly HomeNextKind[] = ['guide', 'date', 'unread', 'papic', 'guests', 'invite', 'ai', 'plan'];

/**
 * The guided flow, as Home reads it (null = nothing left, not for this viewer,
 * or unread) — counted by stage (`lib/stage-setup.ts`): every fact ONCE for the
 * whole, and the first stage still to do with its own count.
 */
export type HomeGuide = {
  /** Every fact of the Event Hub, once — in place, of all. */
  done: number;
  total: number;
  /** The first stage with a fact still to do, and its own "n of m". */
  stageTitle: string;
  stageDone: number;
  stageTotal: number;
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
  /** 📍 Which Papic moment this card is (kind 'papic') — its button follows it. */
  papicMoment?: PapicMoment;
};

/**
 * The guest list as Home read it — null when the read did not happen, so the
 * guests/invite cards are never drawn from a refused query (a couple with 180
 * names must never be told "Add your guests").
 */
export type HomeGuestsRead = {
  /** Guests on the living, accepted list, the couple themselves excluded. */
  total: number;
  /** …of whom are still TO INVITE — the one rule, `isToInvite` (lib/guest-roster-view.ts):
   *  no invitation sent, has not declined, not a celebrant. */
  unsent: number;
} | null;

/**
 * Count the Home's guests read. `unsent` is `isToInvite` — the number the
 * Guests list calls "N to invite", Setup calls "Send to N" and the send run
 * opens with — so "Send N invitations" can never name a different N.
 */
export function homeGuestsRead(rows: readonly InviteFacts[], measured: boolean): HomeGuestsRead {
  if (!measured) return null;
  return {
    total: rows.filter((g) => g.role !== 'bride' && g.role !== 'groom').length,
    unsent: rows.filter((g) => isToInvite(g)).length,
  };
}

export type HomeNextInput = {
  guide: HomeGuide;
  hasDate: boolean;
  guests: HomeGuestsRead;
  noun: 'wedding' | 'event';
  papicReady: boolean;
  /**
   * 📍 Papic's moment, from `papicGlance` (owner 2026-10-13/14): ready · stopped ·
   * low on the day — with the credits for the card's words. Wins over the bare
   * `papicReady` when present.
   */
  papic?: { moment: PapicMoment; left: number; total: number } | null;
  /** An AI offer exists AND may be shown here (never in the store shell). */
  aiOffer: boolean;
  /**
   * 🚪 What THIS event needs (owner 2026-10-08, Level 1 — `lib/event-needs.ts`). Absent = every need
   * on (yesterday's Home). No guest list → never "Add your guests" / "Send N invitations", and an
   * unread guest list is not this Home's to report. Cover + photos only → never "Finish your Event
   * Hub" (its steps — venues, attire, what to ask — are the details this event said it does not need).
   */
  needs?: { guestList: boolean; hubDetails: boolean } | null;
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
  const { hasDate, noun, papicReady, papic = null, aiOffer, needs = null } = input;
  const guide = needs && !needs.hubDetails ? null : input.guide;
  const noList = needs?.guestList === false;
  const guests = input.guests;
  if (guide) {
    /* "Finish your Event Hub — n of m · Pick a stage": the whole in place, then
       the first stage still to do with its own count. */
    const left = guide.total - guide.done;
    return {
      kind: 'guide',
      title: `Finish your Event Hub — ${formatCount(guide.done)} of ${formatCount(guide.total)}`,
      /* The offer is frame 0, "Before we start", in one card: what we already
         have, what is left, what helps — and that none of it is required. */
      body: guide.offer
        ? `From sign-up we already have your names, dates, look and how guests get in — we won’t ask again. ${formatCount(left)} short ${left === 1 ? 'step finishes' : 'steps finish'} your Event Hub; Love Story photos help. None of it is required.`
        : `Next: ${guide.stageTitle} — ${formatCount(guide.stageDone)} of ${formatCount(guide.stageTotal)} in place`,
      /* The button names the action (owner 2026-10-02) — never a bare "Continue". */
      action: guide.offer ? 'Start' : HOME_GUIDE_ACTION,
      ...(guide.offer ? { offer: true } : {}),
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
  /* 🔴 A GUEST READ THAT FAILED IS NOT "ON TRACK" (owner 2026-10-07, HOME_AND_GUESTS
     H3). It used to fall through to papic → ai → plan, so a couple whose list could
     not be read was told "You are on track — Nothing is waiting on you". The card
     says what happened and offers the read again; it never guesses past it. */
  if (guests === null && !noList) {
    return {
      kind: 'unread',
      title: 'We couldn’t read your guest list',
      body: 'So we can’t say what’s next — this is not “on track”. Reload to try again.',
      action: 'Reload',
    };
  }
  /* 📍 PAPIC'S MOMENTS — the approved prototype's three cards, word for word. */
  if (papic?.moment === 'stopped') {
    return {
      kind: 'papic',
      papicMoment: 'stopped',
      title: 'Your cameras have stopped',
      body: `All ${formatCount(papic.total)} credits are used. Your guests’ cameras rest until you add more — nothing they shot is lost.`,
      action: 'Buy more',
    };
  }
  if (papic?.moment === 'low-today') {
    /* Owner call 1 (2026-10-14): on the day, running low takes this card once. */
    return {
      kind: 'papic',
      papicMoment: 'low-today',
      title: 'Your credits are running low',
      body: `${formatCount(papic.left)} ${papic.left === 1 ? 'credit is' : 'credits are'} left for today. Add more so your guests’ cameras keep shooting.`,
      action: 'Buy more',
    };
  }
  if (papic?.moment === 'ready' || (!papic && papicReady)) {
    /* The retired free "One" camera (owner 2026-08-11) is not promised here. */
    return {
      kind: 'papic',
      papicMoment: 'ready',
      title: 'Your cameras are ready',
      body: papic
        ? `${formatCount(papic.left)} credits are in. Share your Event Hub link — the first photo a guest shoots lands here.`
        : 'Your credits are in. Share your Event Hub link — the first photo a guest shoots lands here.',
      action: `Open ${SERVICE_NAMES.papic.plain}`,
    };
  }
  if (!noList && guests && guests.total === 0) {
    return {
      kind: 'guests',
      title: 'Add your guests',
      body: 'Your guest list is empty.',
      action: 'Add guests',
    };
  }
  if (!noList && guests && guests.unsent > 0) {
    const n = formatCount(guests.unsent);
    return {
      kind: 'invite',
      title: `Send ${n} ${guests.unsent === 1 ? 'invitation' : 'invitations'}`,
      /* The prototype's words (HOME_AND_GUESTS 2026-10-07, frame Home). */
      body: `${n} ${guests.unsent === 1 ? 'guest has' : 'guests have'} no invitation yet. One tap sends each their own link and ticket.`,
      action: 'Send invitations',
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
    body: 'Nothing is waiting on you right now. Your checklist has the rest of the plan.',
    action: 'Open your checklist',
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

export type HomeServiceKey = 'papic' | 'ai' | 'live' | 'music' | 'booth' | 'hub' | 'nikah';

/*
  ─── EVERY PAID SERVICE + EVENT HUB PRO (owner 2026-10-14 🧾 + ✅) ────────────

  DECISION_LOG 2026-10-14 "HOME › YOUR SERVICES = THE PAID SERVICES + EVENT HUB
  PRO; FREE TOOLS STAY OUT" and, the same day, "APPROVE ALL: THE SERVICES
  PROTOTYPE" (`prototypes/services_home_rows_and_bands_2026-10-14_fable.html`):
  Guest photos · Planner · Live stream · Music · Video booth · Event Hub Pro.
  Owned = the full row (its state, its main door); not added = ONE slim line,
  the price under the name and **Add** on the right. Owner, live on cale-ice
  2026-10-20: *"i thought we will have our other paid services here in home?"* —
  the row had only ever been built for the first two (2026-10-01).

  🔑 NOTHING HERE DECIDES OWNERSHIP, OFFER OR PRICE. Each service's facts arrive
  from the page: whether this event is offered it and where its door is
  (`buildOurServices` — the More menu's ONE builder), whether it is on
  (`eventSkuActive`, the feature gate — so an internal or founder-seat host reads
  "On", exactly as the feature behaves), and its price (`platform_retail_catalog_v2`,
  never a figure in code). This file only maps those facts onto ONE row state.

  🔒 ONE STATE PER SERVICE — `homePaidState`, held by
  `app/dashboard/[eventId]/home-shows-every-paid-service.test.ts`: owned · pending · add · open ·
  unread · absent. "absent" is only ever the event's own fact (its type is not
  offered the service, the day has passed for a day-of one, the store shell) —
  never a forgotten row. What the event LEFT OFF at onboarding (`lib/event-needs.ts`:
  guest list · suppliers · Event Hub details) never hides a paid service: Papic
  is always on, and the rest are not needs.
*/

/**
 * The six rows, in order. Papic is first and is its own glance; the Event Hub comes right after it (owner 2026-10-23,
 * the service widgets: *"order Papic → Event Hub → rest"*), its Pro folded into its card.
 */
export const HOME_PAID_KEYS = ['papic', 'hub', 'ai', 'live', 'music', 'booth'] as const;
export type HomePaidKey = (typeof HOME_PAID_KEYS)[number];
/** The five that are a single catalogue SKU (Papic is credits, sold by the ladder). */
export type HomeSkuKey = Exclude<HomePaidKey, 'papic'>;

/** Each row's catalogue code — the row the price is read from and the gate asks about. */
export const HOME_PAID_SKU: Readonly<Record<HomeSkuKey, string>> = {
  ai: 'SETNAYAN_AI',
  live: 'LIVE_STUDIO',
  music: 'PAKANTA',
  booth: 'PATIKTOK_COMPILER',
  hub: 'COUPLE_WEBSITE_PRO',
};

/** The More menu's card each row stands for (`lib/our-services.ts`). Event Hub Pro has no card there. */
export const HOME_PAID_CARD: Readonly<Record<Exclude<HomeSkuKey, 'hub'>, string>> = {
  ai: 'setnayan-ai',
  live: 'live-studio',
  music: 'music-maker',
  booth: 'patiktok',
};

/** Event Hub Pro's two lines (2026-10-14 🧾): its name, and what it unlocks under it. */
export const HUB_PRO_NAME = 'Event Hub Pro';
export const HUB_PRO_UNLOCKS = '◆ Themes · photo and video backgrounds';
/** The Event Hub card's name (owner 2026-10-23: Event Hub Pro is folded into the Event Hub — one card, its ◆ line). */
export const EVENT_HUB_NAME = 'Event Hub';

/**
 * 💎 THE EVENT HUB CARD'S ◆ LINE — Pro is a state of the Hub, not a service of its own (ownership is per part,
 * `HubOwnership.parts`; its only door was the Maker, the same door). From the Pro row's one state, and the parts the
 * event holds when Full Pro is not on. Never a price: the Maker's Apply is where Pro is asked for.
 */
export function hubProLine(
  row: PaidRow | null,
  parts: { full: boolean; count: number } | null = null,
  /** The per-part ownership read was REFUSED — never "Free" over a read that did not happen (review 2026-10-24). */
  partsUnread = false,
): string {
  if (row?.state === 'unread') return '◆ —';
  if (row?.state === 'owned' || parts?.full) return '◆ Pro on · themes, photo and video backgrounds';
  if (row?.state === 'pending') return '◆ Pro · payment sent · switches on once approved';
  if (partsUnread) return '◆ —';
  if (parts && parts.count > 0) return `◆ Pro · ${formatCount(parts.count)} ${parts.count === 1 ? 'part' : 'parts'} on`;
  return '◆ Free';
}

/** The row states. Exactly one per service — `homePaidState`. */
export type HomePaidState = 'owned' | 'pending' | 'add' | 'open' | 'unread' | 'absent';

/**
 * What the page knows about one service — the More menu card's state
 * (`OurServiceState`) and door, or `null` when there is no card for this event.
 */
export type HomePaidFact = {
  card: { state: string; stateText: string; href: string | null } | null;
  /** The ownership read failed — the row says "—" and sells nothing over a refusal. */
  unread?: boolean;
  /** The catalogue's price label ("₱2,500", "₱1,500 / day") — null when unread or not on sale. */
  price?: string | null;
  /** Setnayan AI's comeback window is open — its one surviving line (hours only, never a price). */
  comebackHoursLeft?: number | null;
};

/** ONE state per service, from its facts. Pure, total. */
export function homePaidState(fact: HomePaidFact | null | undefined): HomePaidState {
  if (!fact) return 'absent';
  if (fact.unread) return 'unread';
  const card = fact.card;
  if (!card) return 'absent';
  switch (card.state) {
    case 'added':
      return 'owned';
    case 'pending':
      return 'pending';
    case 'price':
    case 'unpriced':
      return card.href ? 'add' : 'absent';
    case 'free':
    case 'trial':
      return card.href ? 'open' : 'absent';
    default:
      // 'closed' (a day-of service after the day) · 'soon' — no door, so no row.
      return 'absent';
  }
}

/** A paid row as Home draws it (state 'absent' is never drawn). */
export type PaidRow = {
  state: Exclude<HomePaidState, 'absent'>;
  /** The row is a door to the service's own page. */
  href: string;
  /** The status line — owned / pending / open / unread. */
  line: GlanceLine;
  /** The slim line's words — 'add' only. Its price is the catalogue's, or "See the price". */
  price?: string;
  /** The owned row's main door (the prototype's words), when it is a different page from the row's own. */
  door?: { label: string; href: string };
};

/** The words of a slim "not added" line. `price` null = an unread catalogue → never ₱0, never "Free". */
export function paidSlimWords(key: HomeSkuKey, price: string | null, comebackHoursLeft: number | null = null): string {
  if (key === 'ai' && comebackHoursLeft !== null && comebackHoursLeft > 0) {
    return `Comeback price · ${formatCount(comebackHoursLeft)}h left`;
  }
  // ✨ Setnayan AI not added reads "Try it" — no price on Home (owner-approved 2026-10-24, the control center: "the
  // not-added AI line says 'Try it' with no price"); the price lives on its own page, where it is bought.
  if (key === 'ai') return 'Try it';
  if (!price) return 'See the price';
  if (key === 'live') return `1 camera free · ${price} for more`;
  if (key === 'booth') return `Free to record · ${price} to save & share`;
  return price;
}

/** One paid row from its facts — null when the service has no row on this Home. */
export function paidRow(key: HomeSkuKey, fact: HomePaidFact | null | undefined, eventId: string): PaidRow | null {
  const state = homePaidState(fact);
  if (state === 'absent' || !fact) return null;
  const href = fact.card?.href ?? `/dashboard/${eventId}`;
  if (state === 'unread') return { state, href, line: { strong: '—' } };
  if (state === 'pending') return { state, href, line: { lead: 'Payment sent · switches on once approved' } };
  if (state === 'open') return { state, href, line: { lead: fact.card?.stateText ?? '' } };
  if (state === 'add') {
    return { state, href, line: {}, price: paidSlimWords(key, fact.price ?? null, fact.comebackHoursLeft ?? null) };
  }
  // owned — the prototype's main door, where it is another page than the row's own.
  if (key === 'hub') {
    return {
      state,
      href,
      line: { strong: 'Pro on', tail: ' · themes, photo and video backgrounds' },
      door: { label: 'Open the Maker', href: `/dashboard/${eventId}/launch` },
    };
  }
  if (key === 'live') {
    /* The controller is chrome-less, outside /dashboard (`liveStudioControlPath`) — its own door. */
    return { state, href, line: { strong: 'On' }, door: { label: 'Open controller', href: liveStudioControlPath(eventId) } };
  }
  return { state, href, line: { strong: 'On' } };
}
/**
 * `name` is the plain name (first), `brand` the Setnayan name (small under) — `lib/service-names.ts`.
 * Nikah essentials is not a Setnayan service, so it carries no brand line.
 */
export type HomeService = {
  key: HomeServiceKey;
  name: string;
  brand?: string;
  status: string;
  /**
   * 🎨 Papic's row is the service glance (owner 2026-10-14): its status line, a
   * meter, and its two doors — "Buy more" (the shipped stepper in a sheet) and
   * "See N photos" (the gallery, opened directly). Absent = the plain row.
   */
  papic?: PapicRowDoors;
  /** 🧾 A paid row (Planner · Live stream · Music · Video booth) — its one state. */
  paid?: PaidRow;
  /** 💎 The Event Hub card — its Pro row (null: not held, nothing waiting), drawn as the card's ◆ line. */
  hub?: { pro: PaidRow | null };
};

/** What the Papic row draws beyond its name — from `papicGlance` (lib/papic-glance.ts). */
export type PapicRowDoors = {
  glance: Pick<ServiceGlance, 'count' | 'total' | 'mood' | 'pct' | 'result'>;
  /** The status line, the count bold — whole; its doubled tail is marked by `whileNext`. */
  line: GlanceLine;
  /** Offer "Buy more" here (false only when the viewer may not buy). */
  buy: boolean;
  /**
   * What the Papic Next card already says (`papicRowDoubled`): drawn, but marked
   * `data-while-next` so it stands down ONLY while that card is on screen — a
   * "Later" brings it straight back (walk-b6 F1, 2026-10-14).
   */
  whileNext?: { buy: boolean; tail: boolean };
};

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
  // 25 Oct: was "Free camera ready" — there is no free camera with credits of its own; cameras are unlimited and
  // every photo spends the event's credits (owner: "unlimited camera but papic credits is used").
  if (tile.preCapture || tile.photosGathered === 0) return 'Ready';
  return `On · ${formatCount(tile.photosGathered)} ${tile.photosGathered === 1 ? 'photo' : 'photos'}`;
}

/**
 * `null` = the entitlement could not be resolved.
 *
 * 🏷 `comebackHoursLeft` — the comeback offer used to be a card on Home's second
 * section (its only surface). That section is gone, so the one line that must
 * survive is here: while the couple's one comeback window is open, the row says
 * so, and the row opens the page that sells it. A number of hours only — the
 * price stays on the page that charges it.
 */
export function aiStatus(active: boolean | null, comebackHoursLeft: number | null = null): string {
  if (active === null) return '—';
  if (active) return 'On';
  if (comebackHoursLeft !== null && comebackHoursLeft > 0) {
    return `Comeback price · ${formatCount(comebackHoursLeft)}h left`;
  }
  return 'Try it';
}

/**
 * 🕌 Nikah essentials — the one status line a Muslim wedding's Home keeps of the
 * card that used to sit in Home's second section. `done` is the tracked-pillar
 * count (wali · two witnesses · mahr · imam); consent is not trackable.
 */
export const NIKAH_TRACKED_TOTAL = 4;
/** The name of that row and of its page (`/dashboard/[eventId]/nikah`) — written once, here. Not a Setnayan service, so not in `SERVICE_NAMES`. */
export const NIKAH_NAME = 'Nikah essentials';
export function nikahStatus(done: number | null): string {
  if (done === null) return '—';
  return `${formatCount(done)} of ${formatCount(NIKAH_TRACKED_TOTAL)} in place`;
}

/** Each paid row's names — `lib/service-names.ts` (one list); Event Hub Pro is not a service card. */
function paidNames(key: HomeSkuKey): { name: string; brand: string } {
  if (key === 'hub') return { name: EVENT_HUB_NAME, brand: '' };
  const n = SERVICE_NAMES[HOME_PAID_CARD[key] as ServiceNameKey];
  return { name: n.plain, brand: n.brand };
}

export function homeServices(input: {
  next: HomeNextKind;
  storeShell: boolean;
  /**
   * 🍎 Apple sells in this app (`getIapGate().iap`, owner 2026-10-23). Then the store shell keeps the paid rows whose
   * facts passed the page's ONE door rule (`isStoreShellHiddenAddon` + `isStoreShellWebOnlyPath(path, iap)` — Setnayan
   * AI · Music Maker · Patiktok), each opening its page where Apple's sheet is the pay step. Absent/false = none.
   */
  iap?: boolean;
  papic: string;
  /** 📍 Papic's doors (Buy more · See N photos), when the glance offers them. */
  papicDoors?: PapicRowDoors | null;
  /** Setnayan AI's plain status — the row as it was before `paid` (kept for a caller that has no facts). */
  ai: string;
  /**
   * 🧾 EVERY PAID SERVICE + EVENT HUB PRO (owner 2026-10-14). When given, the Planner ·
   * Live stream · Music · Video booth · Event Hub Pro rows come from these facts — one
   * state each (`homePaidState`) — and `ai` above is not used. Absent = yesterday's two rows.
   */
  paid?: Partial<Record<HomeSkuKey, HomePaidFact | null>> | null;
  eventId?: string;
  /** 🕌 Set ONLY for a Muslim wedding — the Nikah essentials' status line. Free, so it is also in the store shell. */
  nikah?: string | null;
}): HomeService[] {
  const papicRow: HomeService = {
    key: 'papic',
    name: SERVICE_NAMES.papic.plain,
    brand: SERVICE_NAMES.papic.brand,
    status: input.papic,
    ...(input.papicDoors ? { papic: input.papicDoors } : {}),
  };
  const rest: HomeService[] = input.paid
    ? (HOME_PAID_KEYS.filter((k): k is HomeSkuKey => k !== 'papic')).flatMap((key): HomeService[] => {
        const row = paidRow(key, input.paid?.[key], input.eventId ?? '');
        if (key === 'hub') {
          // 💎 The Event Hub is always a card where the event has one; its Pro row is the card's ◆ line, never a slim "Add".
          if (!row) return [];
          const { name } = paidNames(key);
          return [{ key, name, status: hubProLine(row.state === 'add' ? null : row), hub: { pro: row.state === 'add' ? null : row } }];
        }
        return row ? [{ key, ...paidNames(key), status: row.price ?? glanceLineText(row.line), paid: row }] : [];
      })
    : [{ key: 'ai', name: SERVICE_NAMES['setnayan-ai'].plain, brand: SERVICE_NAMES['setnayan-ai'].brand, status: input.ai }];
  /* 🔒 NOT IN THE STORE SHELL — every paid row's page is web-only there (STORE_SHELL_HIDDEN_ADDON_KEYS), and the
     iPhone app sells only through Apple (the `apple` rows HomeFirstScreen draws on their own).
     🍎 Where Apple sells (`iap`), the rows the facts let through stay — never Papic or Live Watch (their `apple` rows
     draw them) and never the Event Hub (the control row's tile; Pro is asked for at the Maker's Apply). Never the
     facts-less fallback either: no facts, no row. */
  const appSold = input.storeShell && input.iap && input.paid ? rest.filter((s) => s.key !== 'hub' && s.key !== 'live') : [];
  const paid: HomeService[] = input.storeShell ? appSold : [papicRow, ...rest];
  const all: HomeService[] = [
    /* ⛔ NEVER TWICE — for Papic the row STAYS and drops the button the Next
       card offers, while it is on screen (owner 2026-10-14, `papicRowDoubled`); a service with no
       doors (Setnayan AI) still leaves the row while it is the Next card. */
    ...paid.filter((s) => s.key !== input.next || (s.key === 'papic' && s.papic)),
    ...(input.nikah != null ? [{ key: 'nikah' as const, name: NIKAH_NAME, status: input.nikah }] : []),
  ];
  /* Owned first, then the slim "not added" lines — the approved prototype's order (owned · Not added). */
  return [...all.filter((s) => s.paid?.state !== 'add'), ...all.filter((s) => s.paid?.state === 'add')];
}

/** A status line as plain words (the row's `status`, for guards and the plain tile). */
export function glanceLineText(line: GlanceLine): string {
  return `${line.lead ?? ''}${line.strong ?? ''}${line.tail ?? ''}`;
}

/**
 * 📷 PAPIC ON THE EVENT DAY (owner 22 Oct 2026, on a just-created event's Home on its day: *"Fix
 * both"* — the event-day console had no Papic at all, because Home's first screen, which holds Your
 * services, is not mounted on the day). The console now draws Home › Your services' OWN Papic row —
 * the same `HomeService` entry `homeServices` built, rendered by the same row — right beside the Live
 * photo wall card. This picks which face it shows; it reads nothing.
 *
 *   hidden  · no Papic entry in Your services — the store shell (the iPhone app shows no paid row,
 *             App Review 3.1.1), exactly as Your services hides it there.
 *   off     · the host answered "Photos from your guests? — No" (`papic_on = false`): it says so,
 *             with the door to that answer (Event Details) to switch it back on.
 *   none    · no pool, no camera, no photo yet (`tile === null`): "not on yet", door = the Papic page,
 *             which arms the free pool on its first view.
 *   failed  · the credits read threw: "Couldn't read your credits" — NEVER 0, never a meter.
 *   row     · the glance row itself: credits left · meter · Buy more · See N photos.
 *   plain   · a viewer the figures are not shared with: the plain door, as Your services draws it.
 */
export type DayPapicFace = 'hidden' | 'off' | 'none' | 'failed' | 'row' | 'plain';

export function dayPapicFace(input: {
  /** Home › Your services' Papic entry (`homeServices(...)`), or undefined when it built none. */
  svc: HomeService | undefined;
  /** `events.papic_on` read with `papicIsOn` — null when the column was not read. */
  papicOn: boolean | null;
  /** May this viewer see Papic's figures (couple · coordinator) — the page's `canViewPapicCounts`. */
  permitted: boolean;
  /** `resolvePapicHomeTile`'s answer as the page holds it: an object, null (no Papic yet) or 'failed'. */
  tile: object | null | 'failed';
}): DayPapicFace {
  if (!input.svc) return 'hidden';
  if (input.papicOn === false) return 'off';
  if (!input.permitted || !input.svc.papic) return 'plain';
  if (input.tile === 'failed') return 'failed';
  if (input.tile === null) return 'none';
  return 'row';
}

/** The day card's words for the faces that are not the glance row (one place, so a guard can read them). */
export const DAY_PAPIC_WORDS = {
  off: 'Off for this event',
  none: 'Not on for this event yet',
  failed: 'Couldn’t read your credits',
  switchOn: 'Switch on',
} as const;

/**
 * What the day card draws for a face — the whole decision, pure, so a guard can hold it without
 * rendering the row (its Buy more sheet imports server actions). `DayPapicRow` only paints this.
 *   row    · Your services' glance row itself, its own Buy more kept (no Next card is on screen on the day);
 *   say    · one plain line (no meter — a failed read is not "0 credits left") + its door, if any;
 *   plain  · the plain door Your services draws for a viewer the figures are not shared with.
 */
export type DayPapicView =
  | { kind: 'hidden' }
  | { kind: 'row'; doors: PapicRowDoors }
  | { kind: 'say'; face: 'off' | 'none' | 'failed'; words: string; href: string; door: { label: string; href: string } | null; meter: false }
  | { kind: 'plain'; href: string; status: string };

export function dayPapicView(face: DayPapicFace, svc: HomeService | undefined, eventId: string): DayPapicView {
  if (face === 'hidden' || !svc) return { kind: 'hidden' };
  const papicHref = `/dashboard/${eventId}/studio/papic`;
  if (face === 'row' && svc.papic) return { kind: 'row', doors: { ...svc.papic, whileNext: undefined } };
  if (face === 'off' || face === 'none' || face === 'failed') {
    const href = face === 'off' ? recordFieldHref(eventId, 'papic-answer') : papicHref;
    return {
      kind: 'say',
      face,
      words: DAY_PAPIC_WORDS[face],
      href,
      door: face === 'failed' ? null : { label: DAY_PAPIC_WORDS.switchOn, href },
      meter: false,
    };
  }
  return { kind: 'plain', href: papicHref, status: svc.status };
}
