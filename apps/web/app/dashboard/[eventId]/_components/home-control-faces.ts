/**
 * home-control-faces.ts — HOME'S CONTROL ROW, AS DATA (owner-approved 2026-10-24, "ok":
 * `Setnayan/prototypes/home_control_center_2026-10-24_fable.html`, corpus 10067d39 — its "Review notes" are the contract).
 *
 * ONE DATA SHAPE PER WIDGET, DRAWN TWO WAYS (the notes' build plan, PR-D): below 768 px each widget is a compact TILE
 * whose faces rotate (`home-tile.tsx`); from `md` up it is a detail CARD (`home-control-row.tsx`). Both are drawn from
 * what this file returns, so the phone and the desktop can never say two things about one fact.
 *
 *   ① Countdown → Event Details · ② Guests → Guests · ③ Event Hub → the page guests see (Pick what shows · Maker)
 *   ④ Suppliers → Suppliers · ⑤ Budget → Budget · ⑥ Checklist → Checklist          — ONE page per widget.
 *
 * 🔒 NOTHING HERE IS NEW KNOWLEDGE, AND NOTHING IS INVENTED. Every count arrives already read by the page (each from
 * the shipped reader named on its input); this file only words it. A read that FAILED arrives as `'unread'` and the
 * widget becomes a single "Couldn't load" face with ⟳ Reload — never 0, never ₱0, never a rotating face over a refusal
 * (`home-control-reads-honestly.test.ts`).
 *
 * 🔗 EVERY DOOR IS A LITERAL `href:` HERE ON PURPOSE — `scripts/port-controls.mjs` reads `href:` literals in a route's
 * `_components/`, so the destinations Home offers stay visible to `lint-port-no-lost-controls`.
 *
 * Pure: no React, no I/O, no clock of its own (`now` is handed in).
 */
import { SAMPLE_FACES } from '@/lib/empty-look-samples';
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import type { CountFormat } from '@/components/count';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { HomeNext } from '@/lib/home-first-screen';
import type { MoneyLine } from '@/lib/budget-truth';
import { planningTodoHref } from '@/lib/checklist-anchor';
import { dateFinderHref } from '@/lib/home-date-finder';
import { budgetPageHref, schedulePageHref } from '@/lib/pillar-parts';
import { releaseOpen, type HomeScheduleFacts } from '@/lib/home-schedule';
import { guestsViewHref } from '@/lib/guests-views';
import { findBoardHref } from '@/lib/find-inspiration';

/** The six upper widgets, in the owner's order (notes: "The order, top to bottom — and the one reason"). */
export const HOME_CONTROL_KEYS = ['count', 'guests', 'hub', 'sup', 'budget', 'plan'] as const;
export type HomeControlKey = (typeof HOME_CONTROL_KEYS)[number];

/** The ONE page each widget opens (notes: "One widget → the ONE page it opens"). */
export const HOME_CONTROL_PAGE: Readonly<Record<HomeControlKey | 'sched', string>> = {
  // 📅 The Date Finder (owner 2026-10-30: *"date finder. because we want them to find the date for their event"*;
  // DECISION_LOG 2026-10-26 "FINAL STRUCTURE" (3)) — Event Details itself is combined into Home's ⚙ Event Settings.
  count: 'Date Finder',
  guests: 'Guests',
  hub: 'Event Hub',
  sup: 'Suppliers',
  budget: 'Budget',
  plan: 'Planning Stage',
  // 📅 The Schedule widget (owner 2026-11-01) opens the Schedule — its doors open their own sheets and pages.
  sched: 'Schedule',
};

/**
 * 🧱 FRAMES ONLY WHERE YOU ACT (owner 2026-11-01, DECISION_LOG "EVENT HOME: FRAMES ONLY WHERE YOU ACT" · "HOME
 * PROTOTYPE APPROVED", `prototypes/home_frames_where_you_act_2026-11-01/`): *"look at how there are widgets with frame
 * and without frame. i looks clean rather than all having frames"*. A heading plus plain tiles has no frame (Safari's
 * Favorites); only a block you act on is a card (its Start Page). On Home the cards are the Schedule (its doors), the
 * Budget (each payment's Pay) and Papic (its own card) — every other widget sits on the page, unframed. One list, read
 * by the tile, the detail card and `only-the-acting-widgets-are-framed.test.ts`.
 */
export const HOME_FRAMED_WIDGETS: ReadonlySet<HomeControlKey | 'sched'> = new Set<HomeControlKey | 'sched'>(['sched', 'budget']);
export function homeWidgetFramed(key: HomeControlKey | 'sched'): boolean {
  return HOME_FRAMED_WIDGETS.has(key);
}

/** A face's one tiny action — an icon (the compact tile) or icon + word (the detail card). */
export type FaceIcon = 'mail' | 'plus' | 'check' | 'pay' | 'reload' | 'pen' | 'eye' | 'cal' | 'sliders';
export type FaceAction = {
  icon: FaceIcon;
  /** The word — the detail card's button and the tiny icon's accessible name. */
  label: string;
  /** null = ⟳ Reload (re-runs the page's reads; no door). */
  href: string | null;
  /** The filled main verb (Today's verb, a late payment). */
  main?: boolean;
  /** The pill with its word, even on the compact tile (Budget's Pay). */
  pill?: boolean;
  /** Opens the couple's PUBLIC Event Hub — a new tab on the web, the app's in-app browser in the app. */
  external?: boolean;
  /**
   * 🎛 Opens a sheet IN PLACE instead of a page (`href` is then null): `hub-pick` = the Event Hub tile's "Pick what
   * shows" — the shipped part switches, page picker and Apply bar (`home-cards/hub-pick-button.tsx`).
   */
  sheet?: 'hub-pick';
};

/** One counter of a tile — one figure, one short line, at most one tiny action, and the EXACT item a tap opens. */
export type HomeFace = {
  id: string;
  big: string;
  /** The figure as a number, so it COUNTS to its value on load and on change (owner 2026-10-07, H2 — `Count`). */
  count?: { value: number; format: CountFormat } | null;
  unit?: string;
  sm: string;
  /** What a tap on this face opens — the exact item (notes: "A face opens the EXACT item"). */
  href: string;
  /** The face's door is the public Event Hub. */
  external?: boolean;
  /** Overdue money: drawn in red. */
  late?: boolean;
  /** A true total only (Checklist % · Budget % paid). */
  meter?: number | null;
  action?: FaceAction | null;
  /**
   * 📅 THE SCHEDULE'S FACE (plan §5 — "overrides the one big figure tile rule for this tile only"): a small kicker
   * ("Happening now" · "What's next" · "Then") over up to three lines, each the chapter and its when · what · where.
   */
  kicker?: string;
  rows?: Array<{ k: string; v: string }>;
  /**
   * 👻 THE EMPTY LOOK (owner 2026-11-09, DECISION_LOG 🧱👻 ×2; Build 5 Lane H): on a face that is honestly EMPTY — a
   * read that answered, nothing in it — the tile's NEXT face on sample figures (`lib/empty-look-samples.ts`), drawn
   * greyed under "Example" beneath this one (`HomeTile` → `ExamplePreview`). Never on a failed read (`failedTile` sets
   * none), and gone the moment the part has real content (the face that carries it is the empty one).
   */
  example?: Pick<HomeFace, 'big' | 'unit' | 'sm' | 'meter' | 'kicker' | 'rows'>;
};

/** A door under the Schedule's faces (owner 1 Nov: *"Keep the doors"*) — a word and the page it opens. */
export type HomeDoor = {
  id: 'approve' | 'release' | 'needyou' | 'owe';
  label: string;
  href: string;
  /** The filled main verb (what waits on the hosts first). */
  main?: boolean;
  /** ◆ PRO beside the word — Release on Free (plan §3b); the door stays usable up to the sheet that names its part. */
  pro?: boolean;
};

export type HomeTileModel = {
  key: HomeControlKey | 'sched';
  /** The small quiet label — only where the figure would not say what it is (none on Countdown · Guests · Budget). */
  label: string | null;
  /** The tile's one page (its first face's door when a tap lands between faces). */
  door: string;
  faces: HomeFace[];
  /** The read failed: one face, ⟳ Reload, never rotates. */
  failed: boolean;
  /** Spans both columns in the compact grid (Countdown · Budget). */
  span: boolean;
  /** Event Hub's two small icons (Pick what shows · Maker) — the tile's buttons, never other pages' doors. */
  side?: FaceAction[];
  /** The tile's ⓘ beside its label — what the tile and its small buttons do (owner 2026-10-23: details go in the ⓘ). */
  info?: string | null;
  /** The Today strip points here. */
  today: boolean;
  /** 📅 The Schedule's doors, under its dots — a wrapping row, never on a rotating face (plan §5). */
  doors?: HomeDoor[];
};

/* ─── The inputs — each from the shipped reader named ─────────────────────── */

export type HomeGuestsCounts = {
  /** `rosterStats().yes` — the Guests summary's own "attending" filter. */
  coming: number;
  /** `rosterStats().none` — `hasNotAnswered`. */
  noReply: number;
  /** `rosterStats().toInvite` — `isToInvite`, the ONE rule ("N to invite"). */
  toInvite: number;
  /** `rosterStats().no` — the "not coming" filter. */
  declined: number;
  /** `rosterStats().total` — guests who count toward the event. */
  total: number;
  /**
   * 🪑 Guests › Seats' own "Unseated" (`unseatedCount`: no seat and not declined) — the seat plan moved to Guests (R4).
   * null/absent = no seat plan yet (no tables), so no line; 'unread' = the plan's read failed (said, never 0).
   */
  unseated?: number | 'unread' | null;
};

export type HomeHubFacts = {
  /** `resolveHubStage` — which of the four pages the link shows now; null when the date cannot place it. */
  stage: LifecyclePhase | null;
  /** The couple's public page (origin + `publicEventPath`) — null when it has no link guests can open. */
  publicUrl: string | null;
  /** "setnayan.com/ana-and-miguel · Public" — the Maker's words. */
  where: string;
  /** The event date in short words ("Dec 12") — The Day's opening. */
  dayShort: string | null;
  /** `readHomeGuide` — the guided flow: the whole setup's count and the stage still to fill, when the reader drew one. */
  guide: { stageTitle: string; left: number; done: number; total: number } | null;
};

export type HomeSuppliersFacts = {
  /** The dashboard's own "N of M booked" (`countUnlockedCategories` over this type's plan groups). */
  booked: number;
  of: number;
  /** Quotes out with the answer the couple's to give — `SupplierStanding.needsYou` (`buildBenchStandings`). */
  toDecide: Array<{ name: string; vendorId: string }>;
  /** Suppliers who answered and wait on the couple — `standingRollUp` ("2 suppliers replied"). */
  replied: number;
  /**
   * 💡 The inspiration board in Suppliers › Find (R5, `readFindInspiration`): its photos and parts. Absent = not read for
   * this viewer; 'unread' = the read failed (said, never 0).
   */
  inspiration?: { photos: number; parts: number } | 'unread' | null;
};

export type HomeChecklistFacts = {
  /** done / total — `fetchChecklistProgress`'s shape; total 0 = never seeded (no percentage exists). */
  done: number;
  total: number;
  /** Open (pending) tasks, all of them. */
  open: number;
  /** The open tasks the plan ranks first (`rankUrgentChecklistItems`), soonest first — at most four (Home's To do shows
   *  three; the fourth fills in when Now holds one). `tick` = the row Planning Stage's own tick writes (`PlanningTick`);
   *  absent/null = a row with no table row to tick (the To do line opens it instead). */
  next: Array<{ id: string; title: string; dueDate: string | null; daysUntilDue: number | null; tick?: { kind: 'task' | 'manual'; id: string } | null }>;
  /** Open tasks due within the next seven days (overdue ones included). */
  dueThisWeek: number;
};

/** One payment still to settle — an `event_vendor_line_items` row, banded by `lib/budget-truth.ts` (`dueState`). */
export type HomePayLine = {
  /** `line_item_id`. */
  id: string;
  vendorId: string | null;
  who: string;
  what: string;
  owedPhp: number;
  dueDate: string | null;
  /** `MoneyLine.daysUntilDue` — negative once the date has passed. */
  days: number | null;
  /** `MoneyLine.dueState`. */
  state: 'overdue' | 'due_soon' | 'upcoming' | 'later' | 'settled' | 'none';
};

export type HomeBudgetFacts = {
  paidPhp: number;
  owingPhp: number;
  /** Every payment still to settle, or 'unread' when the ledger could not be resolved. */
  pays: HomePayLine[] | 'unread';
};

export type HomeControlInput = {
  eventId: string;
  next: HomeNext;
  countdown: {
    value: string;
    label: string;
    days: number | null;
    hasDate: boolean;
    placeLine: string | null;
    long: string | null;
    /** The card's ONE page — absent = the Date Finder on Home (`countdownDoor`). */
    door?: string;
  };
  /** null = this event keeps no guest list (the need is off) — the widget is ABSENT; 'unread' = the read failed. */
  guests: HomeGuestsCounts | 'unread' | null;
  /** null = this event has no Event Hub for this viewer; 'unread' = the read failed. */
  hub: HomeHubFacts | 'unread' | null;
  /** null = this event books no suppliers (or this viewer may not see them); 'unread' = a read failed. */
  suppliers: HomeSuppliersFacts | 'unread' | null;
  /** null = the budget is not shared with this viewer (absent, never "—"); 'unread' = the read failed. */
  budget: HomeBudgetFacts | 'unread' | null;
  /** null = nothing to show (never seeded); 'unread' = the read failed. */
  checklist: HomeChecklistFacts | 'unread' | null;
  /**
   * 📅 THE SCHEDULE (owner 2026-11-01, "Schedule goes to home" · "Gets its own widget in home") — read through the
   * chapters (`readHomeSchedule` → `homeScheduleFrom`). Absent/null = no widget for this viewer; 'unread' = the read
   * failed (said, never "No chapters yet"). `pro` = the event owns Pro (Release wears no ◆ PRO).
   */
  schedule?: (HomeScheduleFacts & { pro: boolean }) | 'unread' | null;
  /** 🔑 Access asks waiting on the hosts (`readAccessAsks`, drawn as Today lines above); 'unread' = the read failed. */
  asks?: number | 'unread' | null;
};

/* ─── Words ────────────────────────────────────────────────────────────────── */

const n = (v: number) => formatCount(v);
const plural = (v: number, one: string, many: string) => (v === 1 ? one : many);

/** A calendar day from its parts — a DATE column must never drift across a timezone. */
function dayOf(iso: string): Date | null {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** "Nov 8" · "Fri" — a date as a face says it. */
export function shortDay(iso: string | null): string | null {
  const d = iso ? dayOf(iso) : null;
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
}

/**
 * How a payment's date reads: "3 days late" · "due today" · "due Fri" (this week) · "due Nov 8" · "pay anytime".
 * `long` adds the date to a weekday ("due Fri, Oct 30") — the detail card has the room.
 */
export function dueWords(p: Pick<HomePayLine, 'dueDate' | 'days' | 'state'>, long = false): string {
  if (!p.dueDate || p.days === null) return 'pay anytime';
  if (p.days < 0 || p.state === 'overdue') {
    const late = Math.max(1, -p.days);
    return `${n(late)} ${plural(late, 'day', 'days')} late`;
  }
  if (p.days === 0) return 'due today';
  const d = dayOf(p.dueDate);
  if (!d) return 'pay anytime';
  if (p.days < 7) {
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    return long ? `due ${wd}, ${shortDay(p.dueDate)}` : `due ${wd}`;
  }
  return `due ${shortDay(p.dueDate)}`;
}

/**
 * Every payment still to settle, soonest first — overdue first of all (its date is the earliest), then the dated ones,
 * then the undated (pay anytime) ones. Settled lines are not "to settle".
 */
export function paymentsToSettle(pays: readonly HomePayLine[]): HomePayLine[] {
  return pays
    .filter((p) => p.owedPhp > 0 && p.state !== 'settled')
    .slice()
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || a.who.localeCompare(b.who);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.who.localeCompare(b.who);
    });
}

/** The Budget's face count rule (notes): more than five → the fifth face is "+N more to settle". */
export const BUDGET_MAX_PAY_FACES = 5;

/* ─── Today — the one pointer (notes: option A, "a pointer, not a door") ───── */

export type HomeTodayTarget = HomeControlKey | 'sched' | 'papic' | 'ai' | 'asks';
export type HomeToday = {
  target: HomeTodayTarget;
  words: string;
  tail: string;
  calm: boolean;
  /**
   * 🔁 NOW NEVER REPEATS BELOW (owner-approved Home redraw 2026-11-02, round 3, `prototypes/home_controller_2026-11-02/`:
   * "Now … is never repeated in To do, Requests or Budget below"). The one payment or task Now holds — its widget leaves
   * it out.
   */
  holds?: { pay?: string; task?: string };
  /** ✅ The overdue task Now holds, ticked in place (`PlanningTick`'s write) — null when the task has no row to tick. */
  task?: HomeChecklistFacts['next'][number] | null;
};

/**
 * ☀ WHAT WAITS ON THE HOSTS, FROM THE WIDGETS' OWN FACTS (audit 2026-11-02 #2: the Today line said "Nothing waits on
 * you" over an overdue payment, a quote waiting on the couple, supplier changes to approve and an access ask — the
 * picker only knew hub · count · guests · papic · ai · plan). Read from what Home already read — no new opinion, no
 * new read. `unread` = a widget's read failed, so "nothing waits" cannot be said.
 */
export type HomeWaiting = {
  asks: number;
  overdue: HomePayLine[];
  toApprove: number;
  toDecide: Array<{ name: string }>;
  /** The plan's soonest task whose date has passed — Now's last pick (round 3: "then an overdue task"). */
  overdueTask?: HomeChecklistFacts['next'][number] | null;
  unread: boolean;
};

export function homeWaiting(input: Pick<HomeControlInput, 'guests' | 'hub' | 'suppliers' | 'budget' | 'checklist' | 'schedule' | 'asks'>): HomeWaiting {
  const budget = input.budget && input.budget !== 'unread' ? input.budget : null;
  const pays = budget && budget.pays !== 'unread' ? budget.pays : [];
  const sched = input.schedule && input.schedule !== 'unread' ? input.schedule : null;
  const sup = input.suppliers && input.suppliers !== 'unread' ? input.suppliers : null;
  return {
    asks: typeof input.asks === 'number' ? input.asks : 0,
    overdue: paymentsToSettle(pays).filter((p) => p.state === 'overdue' || (p.days !== null && p.days < 0)),
    toApprove: sched?.toApprove ?? 0,
    toDecide: sup?.toDecide ?? [],
    overdueTask:
      input.checklist && input.checklist !== 'unread' ? (input.checklist.next.find((t) => t.daysUntilDue !== null && t.daysUntilDue < 0) ?? null) : null,
    unread:
      input.guests === 'unread' ||
      input.hub === 'unread' ||
      input.suppliers === 'unread' ||
      input.budget === 'unread' ||
      (budget !== null && budget.pays === 'unread') ||
      input.checklist === 'unread' ||
      input.schedule === 'unread' ||
      input.asks === 'unread',
  };
}

/**
 * The first thing that waits, in the order the approved Home redraw ranks it (owner 2026-11-02, round 3: *"Now is the
 * single most urgent item across everything — a late payment, then the oldest request waiting, then a setup step, then
 * an overdue task"*) — or null when nothing does. A late payment is named on its own (the soonest late one, Pay opens
 * it); the Budget card leaves that one out (`holds.pay`).
 */
function waitingToday(w: HomeWaiting): HomeToday | null {
  if (w.overdue.length > 0) {
    const first = w.overdue[0]!;
    return { target: 'budget', words: `${formatPhpRounded(first.owedPhp)} to ${first.who}`, tail: dueWords(first), calm: false, holds: { pay: first.id } };
  }
  if (w.asks > 0) {
    return { target: 'asks', words: w.asks === 1 ? 'An access request waits on you' : `${n(w.asks)} access requests wait on you`, tail: 'answer it', calm: false };
  }
  if (w.toApprove > 0) {
    return { target: 'sched', words: `${n(w.toApprove)} supplier ${plural(w.toApprove, 'change', 'changes')} to approve`, tail: 'in Schedule', calm: false };
  }
  if (w.toDecide.length > 0) {
    return w.toDecide.length === 1
      ? { target: 'sup', words: `${w.toDecide[0]!.name} waits on your answer`, tail: 'their quote', calm: false }
      : { target: 'sup', words: `${n(w.toDecide.length)} quotes wait on your answer`, tail: 'Suppliers', calm: false };
  }
  return null;
}

/**
 * What the Today strip says — the SHIPPED picker's choice (`pickHomeNext`, `HOME_NEXT_ORDER`), not a new ranking, and
 * which widget it points at (notes: "Where each of today's 'Next step' kinds … goes now").
 */
export function homeToday(next: HomeNext, guests: HomeControlInput['guests'], waiting: HomeWaiting | null = null): HomeToday {
  const counts = guests && guests !== 'unread' ? guests : null;
  // 🔁 Round 3's order (owner 2026-11-02): a read that failed first (said, never calm) · a late payment · the oldest
  // request · then the picker's setup step · then an overdue task. What waits now outranks the setup step too.
  const waits = waiting ? waitingToday(waiting) : null;
  if (waits && next.kind !== 'unread') return waits;
  const late = waiting?.overdueTask ?? null;
  if (late && (next.kind === 'ai' || next.kind === 'plan')) {
    return { target: 'plan', words: late.title, tail: ['due', shortDay(late.dueDate), '· overdue'].filter(Boolean).join(' '), calm: false, holds: { task: late.id }, task: late };
  }
  switch (next.kind) {
    case 'guide':
      return { target: 'hub', words: 'Finish your Event Hub', tail: next.title.replace(/^Finish your Event Hub — /, ''), calm: false };
    case 'date':
      return { target: 'count', words: next.title, tail: '', calm: false };
    case 'unread':
      return { target: 'guests', words: 'Guests couldn’t load', tail: 'reload', calm: false };
    case 'papic':
      return { target: 'papic', words: next.title, tail: '', calm: false };
    case 'guests':
      return { target: 'guests', words: 'Add your guests', tail: 'your list is empty', calm: false };
    case 'invite':
      return { target: 'guests', words: 'Send the invitations', tail: counts ? `${n(counts.toInvite)} unsent` : '', calm: false };
    case 'ai':
      return { target: 'ai', words: next.title, tail: 'Try it', calm: false };
    default:
      // A widget that could not be read means "nothing waits" is not known — said, never calm.
      if (waiting?.unread) return { target: 'plan', words: 'Part of Home couldn’t load', tail: 'reload to check what waits', calm: false };
      return { target: 'plan', words: 'Nothing waits on you', tail: 'the plan has the rest', calm: true };
  }
}

/**
 * ☀ NOW'S ONE BUTTON (owner-approved Home redraw 2026-11-02, round 3 — the event card's `.now` row: *"the ONE thing to
 * do now"* with its verb). The Today line was a pointer that scrolled to the widget; on the card it is a door with a
 * verb, to the one place that settles it. `href: null` = ⟳ Reload; `tick` = the overdue task, ticked in place; `point`
 * = the widget on Home that holds the control (Papic, Setnayan AI) — scroll to it. null = nothing to press (calm).
 */
export type HomeNowAction = {
  verb: string;
  icon: FaceIcon;
  href: string | null;
  tick?: { kind: 'task' | 'manual'; id: string; title: string } | null;
  point?: boolean;
};

export function homeNowAction(today: HomeToday, input: HomeControlInput): HomeNowAction | null {
  const e = input.eventId;
  if (today.calm) return null;
  if (input.next.kind === 'unread' && today.target === 'guests') return { verb: 'Reload', icon: 'reload', href: null };
  switch (today.target) {
    case 'budget':
      return { verb: 'Pay', icon: 'pay', href: today.holds?.pay ? budgetPageHref(e, { pay: today.holds.pay }) : budgetPageHref(e) };
    case 'asks':
      return { verb: 'Answer', icon: 'check', href: `/dashboard/${e}/access-requests` };
    case 'sched':
      return { verb: 'Answer', icon: 'check', href: schedulePageHref(e, { sheet: 'requests' }) };
    case 'sup':
      return { verb: 'Answer', icon: 'check', href: `/dashboard/${e}/vendors?tab=shortlist` };
    case 'hub':
      return { verb: 'Continue', icon: 'pay', href: `/dashboard/${e}/launch?tool=details&guide=1` };
    case 'count':
      return { verb: 'Pick', icon: 'cal', href: input.countdown.door ?? countdownDoor(e) };
    case 'guests':
      return input.next.kind === 'invite'
        ? { verb: 'Send', icon: 'mail', href: `/dashboard/${e}/guests/send` }
        : { verb: 'Add', icon: 'plus', href: `/dashboard/${e}/guests` };
    case 'plan':
      if (today.task) {
        return today.task.tick
          ? { verb: 'Done', icon: 'check', href: planningTodoHref(e, today.task.id), tick: { ...today.task.tick, title: today.task.title } }
          : { verb: 'Open', icon: 'pay', href: planningTodoHref(e, today.task.id) };
      }
      // "Part of Home couldn't load" — the reads run again.
      return { verb: 'Reload', icon: 'reload', href: null };
    case 'papic':
    case 'ai':
      return { verb: 'Show', icon: 'pay', href: null, point: true };
    default:
      return null;
  }
}

/* ─── The six tiles ────────────────────────────────────────────────────────── */

const RELOAD: FaceAction = { icon: 'reload', label: 'Reload', href: null };

function failedTile(key: HomeControlKey | 'sched', label: string, big: string, sm: string, door: string, today: boolean, span = false): HomeTileModel {
  return {
    key,
    label,
    door,
    failed: true,
    span,
    today,
    faces: [{ id: `${key}-failed`, big, sm, href: door, action: RELOAD }],
  };
}

/**
 * 📅 THE COUNTDOWN'S DOOR — THE DATE FINDER, opened in place on Home (owner 2026-10-30, asked "open the Date row, or
 * jump straight to the Date Finder?": *"date finder. because we want them to find the date for their event"* — the
 * 2026-10-26 "FINAL STRUCTURE" (3) ruling). Until today the card opened the Event Details PAGE — on desktop a card NAMED
 * for it ("Open Event Details"), on the phone an unnamed tile — while the ☰'s mark was dead (owner: *"event details
 * showed on desktop view but not on mobile view"*). Now, for the couple, the phone tile and the desktop card both open
 * Suppliers' own date sheet on Help me choose (`home-date-finder.tsx`), a set date shown by its own UI. A helper (who
 * cannot change the date) is still sent to Event Details (`countdown.door`, set by Home).
 */
export function countdownDoor(eventId: string): string {
  return dateFinderHref(eventId);
}

/** ① THE COUNTDOWN — the presentation piece: one face, never moves, no label (owner: "presentation is key"). */
export function countdownTile(input: HomeControlInput, today: HomeToday): HomeTileModel {
  const e = input.eventId;
  const c = input.countdown;
  const door = c.door ?? countdownDoor(e);
  if (!c.hasDate) {
    return {
      key: 'count',
      label: null,
      door,
      failed: false,
      span: true,
      today: today.target === 'count',
      faces: [
        {
          id: 'count-none',
          big: 'No date yet',
          sm: c.placeLine ?? '',
          // The couple's "Set your date" IS the Date Finder; a helper keeps the date-selection page it had.
          href: c.door ? `/dashboard/${e}/date-selection` : door,
          action: { icon: 'cal', label: 'Set your date', href: c.door ? `/dashboard/${e}/date-selection` : door, main: today.target === 'count' },
        },
      ],
    };
  }
  return {
    key: 'count',
    label: null,
    door,
    failed: false,
    span: true,
    today: today.target === 'count',
    faces: [{ id: 'count', big: c.value, count: c.days !== null ? { value: c.days, format: 'int' } : null, unit: c.label, sm: [c.long, c.placeLine].filter(Boolean).join(' · '), href: door }],
  };
}

/** ② GUESTS — one counter at a time: coming · no reply · not invited yet · can't come · on the list. */
export function guestsTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const g = input.guests;
  const isToday = today.target === 'guests';
  if (g === null) return null;
  if (g === 'unread') return failedTile('guests', 'Guests', 'Couldn’t load', 'not zero · unread', `/dashboard/${e}/guests`, isToday);
  const faces: HomeFace[] = [];
  if (g.total === 0) {
    faces.push({
      id: 'guests-empty',
      big: '0',
      count: { value: 0, format: 'int' },
      unit: 'on the list',
      sm: 'Add your guests',
      href: `/dashboard/${e}/guests`,
      action: { icon: 'plus', label: 'Add guests', href: `/dashboard/${e}/guests`, main: isToday },
      example: { ...SAMPLE_FACES.guests },
    });
  } else {
    faces.push({ id: 'guests-coming', big: n(g.coming), count: { value: g.coming, format: 'int' }, unit: 'coming', sm: `of ${n(g.total)} on the list`, href: `/dashboard/${e}/guests?q=coming` });
    if (g.noReply > 0) {
      faces.push({
        id: 'guests-noreply',
        big: n(g.noReply),
        count: { value: g.noReply, format: 'int' },
        unit: 'no reply',
        sm: 'Remind them',
        href: `/dashboard/${e}/guests?q=no+reply`,
        // No reminder flow exists — "Remind" lands on the filter of who has not answered (notes; no new emails).
        action: { icon: 'mail', label: 'Remind', href: `/dashboard/${e}/guests?q=no+reply` },
      });
    }
    if (g.toInvite > 0) {
      faces.push({
        id: 'guests-toinvite',
        big: n(g.toInvite),
        count: { value: g.toInvite, format: 'int' },
        unit: 'not invited yet',
        sm: 'Send the invitations',
        href: `/dashboard/${e}/guests/send`,
        action: { icon: 'mail', label: 'Send the invitations', href: `/dashboard/${e}/guests/send`, main: input.next.kind === 'invite' },
      });
    }
    /* 🪑 SEATS (R4 moved the seat plan into Guests › Seats): who is coming or still to answer and has no seat yet — the
       plan's own "Unseated" — opens Guests › Seats. No plan yet = no line; a refused read is said. */
    if (g.unseated === 'unread') {
      faces.push({ id: 'guests-seats-unread', big: '—', unit: 'seats', sm: 'Couldn’t load', href: guestsViewHref(e, 'seats') });
    } else if (typeof g.unseated === 'number' && g.unseated > 0) {
      faces.push({
        id: 'guests-unseated',
        big: n(g.unseated),
        count: { value: g.unseated, format: 'int' },
        unit: 'without a seat',
        sm: 'Seat them in Seats',
        href: guestsViewHref(e, 'seats'),
      });
    }
    if (g.declined > 0) {
      faces.push({ id: 'guests-declined', big: n(g.declined), count: { value: g.declined, format: 'int' }, unit: 'can’t come', sm: 'sent their regrets', href: `/dashboard/${e}/guests?q=declined` });
    }
    faces.push({
      id: 'guests-total',
      big: n(g.total),
      count: { value: g.total, format: 'int' },
      unit: 'on the list',
      sm: 'Add guests',
      href: `/dashboard/${e}/guests`,
      action: { icon: 'plus', label: 'Add guests', href: `/dashboard/${e}/guests` },
    });
  }
  return { key: 'guests', label: null, door: `/dashboard/${e}/guests`, failed: false, span: false, today: isToday, faces };
}

/** The stage after `stage` in the order the page lives through them — null after Post Event. */
export function nextHubStage(stage: LifecyclePhase | null): LifecyclePhase | null {
  if (!stage) return null;
  const at = PUBLIC_STAGE_ORDER.indexOf(stage);
  return at >= 0 && at < PUBLIC_STAGE_ORDER.length - 1 ? PUBLIC_STAGE_ORDER[at + 1]! : null;
}

/**
 * ③ EVENT HUB — what guests see now · what comes next. Owner 2026-10-24, on the live Home: A TAP ON THE TILE OPENS THE
 * EVENT HUB (every face — `openEventHub`: a new tab on the web, the in-app sheet in the app); its two small buttons are
 * "Pick what shows" (which of the four pages guests see, in a sheet in place — the shipped `setLaunchPhase`) and "Maker".
 * With no link guests can open yet, the tile opens the Maker instead (there is no page to open).
 */
export const HUB_TILE_INFO =
  'Tap to open your Event Hub — the page your guests see.';

export function hubTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const h = input.hub;
  const isToday = today.target === 'hub';
  if (h === null) return null;
  if (h === 'unread') return failedTile('hub', 'Event Hub', 'Couldn’t load', 'unread · not private', `/dashboard/${e}/launch`, isToday);
  // When Today is "Finish your Event Hub", Maker opens the Maker on its guided "What's left" — the same door the
  // Next card's "Pick a stage" was (`?tool=details&guide=1`).
  const maker = { href: `/dashboard/${e}/launch` };
  const guided = { href: `/dashboard/${e}/launch?tool=details&guide=1` };
  const pick: FaceAction = { icon: 'sliders', label: 'Pick what shows', href: null, sheet: 'hub-pick' };
  const edit: FaceAction = { icon: 'pen', label: 'Maker', href: (input.next.kind === 'guide' ? guided : maker).href, main: true };
  // THE TILE'S ONE DOOR — the page guests see, from every face.
  const door = h.publicUrl ?? `/dashboard/${e}/launch`;
  const external = Boolean(h.publicUrl);
  const faces: HomeFace[] = [];
  if (h.stage) {
    faces.push({
      id: 'hub-now',
      big: PUBLIC_STAGE_LABELS[h.stage],
      unit: 'live',
      sm: h.publicUrl ? 'guests see it' : 'not shared yet',
      href: door,
      external,
    });
  } else {
    faces.push({ id: 'hub-now', big: 'Not set', unit: 'yet', sm: 'pick your date to place it', href: door, external, example: { ...SAMPLE_FACES.hub } });
  }
  const after = nextHubStage(h.stage);
  if (after) {
    const label = PUBLIC_STAGE_LABELS[after];
    const fill = h.guide && h.guide.stageTitle === label && h.guide.left > 0 ? `${n(h.guide.left)} to fill` : null;
    const when = after === 'event' ? h.dayShort : null;
    faces.push({
      id: 'hub-next',
      big: label,
      unit: 'next',
      sm: [when, fill].filter(Boolean).join(' · ') || 'in the Maker',
      href: door,
      external,
    });
  }
  return {
    key: 'hub',
    label: 'Event Hub',
    door,
    failed: false,
    span: false,
    today: isToday,
    faces,
    side: [pick, edit],
    info: HUB_TILE_INFO,
  };
}

/** ④ SUPPLIERS — booked of the plan · a quote to decide · who replied. */
export function suppliersTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const s = input.suppliers;
  const isToday = today.target === 'sup';
  if (s === null) return null;
  if (s === 'unread') return failedTile('sup', 'Suppliers', 'Couldn’t load', 'not zero · unread', `/dashboard/${e}/vendors`, isToday);
  const faces: HomeFace[] = [
    {
      id: 'sup-booked',
      big: n(s.booked),
      count: { value: s.booked, format: 'int' },
      unit: `of ${n(s.of)} booked`,
      sm: s.of > s.booked ? `${n(s.of - s.booked)} still to book` : 'all booked',
      href: `/dashboard/${e}/vendors`,
      // 👻 Nobody booked, asked or replying yet — the honest zero, with the tile's next face greyed under it.
      ...(s.booked === 0 && s.toDecide.length === 0 && s.replied === 0 ? { example: { ...SAMPLE_FACES.suppliers } } : {}),
    },
  ];
  const first = s.toDecide[0];
  if (first) {
    // The exact quote: that supplier's workspace, on its Quote tab (`?tab=quote` — the workspace's own sections).
    const quote = { href: `/dashboard/${e}/vendors/${encodeURIComponent(first.vendorId)}/workspace?tab=quote` };
    const decide = quote.href;
    faces.push({
      id: 'sup-decide',
      big: n(s.toDecide.length),
      count: { value: s.toDecide.length, format: 'int' },
      unit: plural(s.toDecide.length, 'quote to decide', 'quotes to decide'),
      sm: first.name,
      href: decide,
      action: { icon: 'check', label: 'Decide the quote', href: decide },
    });
  }
  if (s.replied > 0) {
    faces.push({ id: 'sup-replied', big: n(s.replied), count: { value: s.replied, format: 'int' }, unit: 'replied', sm: 'waiting on you', href: `/dashboard/${e}/vendors?tab=shortlist` });
  }
  /* 💡 INSPIRATION (R5 moved the board into Suppliers › Find): the looks on the board, opening it there. */
  const ins = s.inspiration;
  if (ins === 'unread') {
    faces.push({ id: 'sup-inspiration-unread', big: '—', unit: 'inspiration', sm: 'Couldn’t load your board', href: findBoardHref(e) });
  } else if (ins) {
    faces.push(
      ins.photos > 0
        ? {
            id: 'sup-inspiration',
            big: n(ins.photos),
            count: { value: ins.photos, format: 'int' },
            unit: plural(ins.photos, 'look on your board', 'looks on your board'),
            sm: plural(ins.parts, `${n(ins.parts)} part`, `${n(ins.parts)} parts`),
            href: findBoardHref(e),
          }
        : { id: 'sup-inspiration', big: '0', count: { value: 0, format: 'int' }, unit: 'looks on your board', sm: 'Save the looks you love', href: findBoardHref(e) },
    );
  }
  return { key: 'sup', label: 'Suppliers', door: `/dashboard/${e}/vendors`, failed: false, span: false, today: isToday, faces };
}

/** What the To do tile's ⓘ says (the approved prototype's words). */
export const TODO_TILE_INFO = 'How far along your plan is, and the next tasks, soonest first. The whole plan is in Schedule.';

/**
 * ⑥ TO DO — only the plan: % done · open · due this week. One list since the owner merged the Checklist into Planning
 * Stage (2026-11-01): the tile is named To do (approved Home prototype `home_frames_where_you_act_2026-11-01`) and
 * every door opens Planning Stage's To do filter — the exact row where there is one.
 */
export function checklistTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const c = input.checklist;
  const isToday = today.target === 'plan';
  const door = planningTodoHref(e);
  if (c === null) return null;
  if (c === 'unread') return failedTile('plan', 'To do', 'Couldn’t load', 'not zero · unread', door, isToday);
  const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : null;
  const faces: HomeFace[] = [];
  if (pct !== null) faces.push({ id: 'plan-pct', big: `${n(pct)}%`, count: { value: pct, format: 'pct' }, unit: 'done', sm: 'of the plan', href: door, meter: pct });
  const first = c.next[0];
  if (c.open > 0) {
    // The exact row: the one the plan ranks first (`#task-<id>`, `lib/checklist-anchor.ts`).
    faces.push({ id: 'plan-open', big: n(c.open), count: { value: c.open, format: 'int' }, unit: 'open', sm: first ? `${first.title} first` : 'the next step is yours', href: planningTodoHref(e, first?.id) });
  }
  const soon = c.next.find((t) => t.daysUntilDue !== null && t.daysUntilDue <= 7);
  if (c.dueThisWeek > 0 && soon) {
    faces.push({ id: 'plan-week', big: n(c.dueThisWeek), count: { value: c.dueThisWeek, format: 'int' }, unit: 'due this week', sm: [soon.title, shortDay(soon.dueDate)].filter(Boolean).join(' · '), href: planningTodoHref(e, soon.id) });
  }
  // 👻 An empty plan (the read answered, nothing in it) keeps its tile — never hidden for being empty (owner
  // 2026-11-09) — with the plan's next face greyed under it (prototype "Event · Today", the To do tile).
  if (faces.length === 0 && c.total === 0) {
    faces.push({ id: 'plan-none', big: 'Nothing', unit: 'yet', sm: 'the next step is yours', href: door, example: { ...SAMPLE_FACES.plan } });
  }
  if (faces.length === 0) return null;
  return { key: 'plan', label: 'To do', door, failed: false, span: false, today: isToday, faces, info: TODO_TILE_INFO };
}

export function budgetTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const b = input.budget;
  const isToday = today.target === 'budget';
  if (b === null) return null;
  if (b === 'unread') return failedTile('budget', 'Budget', 'Money couldn’t load', 'paid and owing are unread, not ₱0', budgetPageHref(e), isToday, true);
  const agreed = b.paidPhp + b.owingPhp;
  const pct = agreed > 0 ? Math.round((b.paidPhp / agreed) * 100) : null;
  const faces: HomeFace[] = [];
  if (b.pays !== 'unread') {
    // 🔁 The payment Now holds is not repeated here (round 3, "Now never repeats below").
    const pays = paymentsToSettle(b.pays).filter((p) => p.id !== today.holds?.pay);
    const shown = pays.length > BUDGET_MAX_PAY_FACES ? pays.slice(0, BUDGET_MAX_PAY_FACES - 1) : pays;
    shown.forEach((p, i) => {
      const late = p.state === 'overdue' || (p.days !== null && p.days < 0);
      // The exact payment: the Budget page opens this line's Pay sheet (`?pay=<line_item_id>`, `payTargetVendor`).
      const thisPayment = { href: budgetPageHref(e, { pay: p.id }) };
      faces.push({
        id: `pay-${p.id}`,
        big: formatPhpRounded(p.owedPhp),
        count: { value: p.owedPhp, format: 'peso' },
        unit: `· ${dueWords(p)}`,
        sm: `${p.who} · ${p.what}`,
        href: thisPayment.href,
        late,
        action: { icon: 'pay', label: 'Pay', href: thisPayment.href, pill: true, main: late || (isToday && i === 0) },
      });
    });
    if (pays.length > BUDGET_MAX_PAY_FACES) {
      const more = pays.length - (BUDGET_MAX_PAY_FACES - 1);
      faces.push({ id: 'pay-more', big: `+${n(more)}`, unit: 'more to settle', sm: 'see them all in Budget', href: budgetPageHref(e) });
    }
  }
  faces.push({
    id: 'budget-summary',
    big: formatPhpRounded(b.owingPhp),
    count: { value: b.owingPhp, format: 'peso' },
    unit: 'owing',
    sm:
      b.pays === 'unread'
        ? `${pct !== null ? `${n(pct)}% paid · ` : ''}payments couldn’t load`
        : pct !== null
          ? `${n(pct)}% paid · ${formatPhpRounded(b.paidPhp)} of ${formatPhpRounded(agreed)}`
          : 'nothing agreed yet',
    href: budgetPageHref(e),
    meter: pct,
    // 👻 Nothing agreed and nothing paid (the money read answered) — the summary's filled face greyed under it.
    ...(agreed === 0 && b.paidPhp === 0 && b.pays !== 'unread' ? { example: { ...SAMPLE_FACES.budget } } : {}),
  });
  return { key: 'budget', label: null, door: budgetPageHref(e), failed: false, span: true, today: isToday, faces };
}

/** What the Schedule card's ⓘ says (the approved prototype's words). */
export const SCHEDULE_TILE_INFO =
  'Every chapter running now with its exact line, then what is next. The doors under it: supplier changes to approve, Release (one week out, Pro), clashes that need you, suppliers who owe their times.';

/** Three lines a face, the rest on further faces — nothing cut (plan §5). */
export const SCHEDULE_LINES_PER_FACE = 3;

/**
 * 📅 THE SCHEDULE — Happening now (every running chapter) · What's next (the next, or all starting together) · Then,
 * and under the faces the doors the owner kept: N to approve · Release · N need you · N owe times (plan §5).
 */
export function scheduleTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const s = input.schedule;
  const isToday = today.target === 'sched';
  if (s === undefined || s === null) return null;
  const door = schedulePageHref(e);
  if (s === 'unread') return failedTile('sched', 'Schedule', 'Schedule couldn’t load', 'not empty · unread', door, isToday, true);
  const faces: HomeFace[] = [];
  const chunk = (kicker: string, id: string, lines: HomeScheduleFacts['now']) => {
    for (let at = 0; at < lines.length; at += SCHEDULE_LINES_PER_FACE) {
      const part = lines.slice(at, at + SCHEDULE_LINES_PER_FACE);
      faces.push({ id: `${id}-${at / SCHEDULE_LINES_PER_FACE}`, big: part[0]!.k, sm: part[0]!.v, kicker, rows: part.map(({ k, v }) => ({ k, v })), href: door });
    }
  };
  chunk('Happening now', 'sched-now', s.now);
  chunk('What’s next', 'sched-next', s.next);
  if (s.now.length === 0) chunk('Then', 'sched-then', s.then);
  if (faces.length === 0) {
    faces.push(
      s.chapters === 0
        ? {
            id: 'sched-none',
            big: 'No chapters yet',
            sm: 'Add the first in your Schedule',
            kicker: 'What’s next',
            rows: [{ k: 'No chapters yet', v: 'Add the first in your Schedule' }],
            href: door,
            example: { big: SAMPLE_FACES.schedule[0].k, sm: SAMPLE_FACES.schedule[0].v, rows: SAMPLE_FACES.schedule.map((r) => ({ ...r })) },
          }
        : { id: 'sched-done', big: 'Every chapter has passed', sm: 'Open the schedule', kicker: 'What’s next', rows: [{ k: 'Every chapter has passed', v: 'Open the schedule' }], href: door },
    );
  }
  const doors: HomeDoor[] = [];
  // ✅ "N to approve" opens the supplier requests sheet — Approve one, Approve all (#7150) — with the Schedule.
  if (s.toApprove > 0) doors.push({ id: 'approve', label: `${n(s.toApprove)} to approve`, href: schedulePageHref(e, { sheet: 'requests' }), main: true });
  if (releaseOpen(input.countdown.days)) doors.push({ id: 'release', label: 'Release', href: schedulePageHref(e, { announce: '1' }), main: true, pro: !s.pro });
  if (s.needYou > 0) doors.push({ id: 'needyou', label: `${n(s.needYou)} need you`, href: door });
  if (s.oweTimes > 0) doors.push({ id: 'owe', label: `${n(s.oweTimes)} owe times`, href: `/dashboard/${e}/vendors?tab=budget` });  // Booked › Team — each row says its call time
  return { key: 'sched', label: 'Schedule', door, failed: false, span: true, today: isToday, faces, info: SCHEDULE_TILE_INFO, doors };
}

/**
 * The control row in the compact grid's order (notes: "Countdown / Guests · Event Hub / Suppliers · Checklist /
 * Budget") — so no half tile is left alone; a widget that is absent for this event closes its gap by spanning.
 */
export function homeControlTiles(input: HomeControlInput): { today: HomeToday; tiles: HomeTileModel[] } {
  const today = homeToday(input.next, input.guests, homeWaiting(input));
  /* 🎴 THE COUNTDOWN AND THE TO DO LEFT THE GRID (owner-approved Home redraw 2026-11-02, round 3): the countdown is the
     event card's own figure and the plan is the ONE To do list under the card (`home-todo-list.tsx`) — a widget for
     either would be the same thing twice. `countdownTile` / `checklistTile` stay for the readers that still word them. */
  const built = [
    scheduleTile(input, today),
    guestsTile(input, today),
    hubTile(input, today),
    suppliersTile(input, today),
    budgetTile(input, today),
  ].filter((t): t is HomeTileModel => t !== null);
  // Pair the half tiles in reading order; a half tile left without a partner spans the row.
  let open: HomeTileModel | null = null;
  const tiles = built.map((t) => ({ ...t }));
  for (const t of tiles) {
    if (t.span) {
      if (open) open.span = true;
      open = null;
      continue;
    }
    open = open ? null : t;
  }
  if (open) open.span = true;
  return { today, tiles };
}

/* ─── The page's facts → the control row's input (ONE composer, the page's and the guards') ─── */

/**
 * Every payment still to settle, from the resolved ledger (`resolveEventMoney`): the supplier lines (`event_vendor_line_items`
 * — a breakdown line or a settled change), committed, with money still owed — each with its own due band
 * (`MoneyLine.dueState`, `lib/budget-truth.ts`). A ledger that is unresolved, or whose sources did not all answer, is
 * 'unread': never "nothing to settle".
 */
export function homePaysFrom(ledger: { allOk: boolean; lines: readonly MoneyLine[] } | null): HomePayLine[] | 'unread' {
  if (!ledger || !ledger.allOk) return 'unread';
  return ledger.lines
    .filter((l) => l.kind === 'committed' && l.stillOwedPhp > 0 && (l.source === 'vendor_line_item' || l.source === 'vendor_change_delta'))
    .map((l) => ({
      id: l.sourceRef,
      vendorId: l.vendorId,
      who: l.vendorName ?? 'Your supplier',
      what: l.label,
      owedPhp: l.stillOwedPhp,
      dueDate: l.dueDate,
      days: l.daysUntilDue,
      state: l.dueState,
    }));
}

/** "Saturday, December 12, 2026" — a firm day only (a month or a year has no countdown, so no long date). */
function longDay(iso: string | null, firm: boolean): string | null {
  const d = iso && firm ? dayOf(iso) : null;
  return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : null;
}

/**
 * THE PAGE'S FACTS, WORDED INTO THE CONTROL ROW'S INPUT — pure, so the page and the guards run the very same chain.
 *
 *   days       `homeFacts().days` / `.figures.days` — the countdown's own rule;
 *   roster     `rosterStats(guests)` — the Guests summary's counts; null = the guest read was NOT measured → 'unread';
 *   money      the one budget read: figures · null (failed → 'unread', SAID) · 'hidden' (not shared → ABSENT);
 *   ledger     the resolved money (`EventMoney`) for the payments to settle;
 *   needs      what the event left off — a widget that is off is ABSENT (null), never greyed.
 */
export function composeHomeControl(i: {
  eventId: string;
  next: HomeNext;
  days: { value: string; label: string };
  daysN: number | null;
  eventDate: string | null;
  venueName: string | null;
  needs: { guestList: boolean; suppliers: boolean };
  roster: { yes: number; none: number; toInvite: number; no: number; total: number } | null;
  money: { paid: number; owing: number } | null | 'hidden';
  ledger: { allOk: boolean; lines: readonly MoneyLine[] } | null;
  hub: HomeControlInput['hub'];
  suppliers: HomeControlInput['suppliers'];
  checklist: HomeControlInput['checklist'];
  /** 📅 The Schedule widget's read (`readHomeSchedule`) and whether the event owns Pro; absent = no widget. */
  schedule?: HomeControlInput['schedule'];
  /** The Countdown's page when it is not Home's ⚙ (a helper has no ⚙) — absent = the ⚙ sheet. */
  countdownDoor?: string;
  /** 🔑 Access asks waiting (`accessAsksWaiting`); absent = not read for this viewer. */
  asks?: number | 'unread' | null;
  /** 🪑 Guests › Seats' unseated count (`homeUnseated`); absent = not read. */
  unseated?: number | 'unread' | null;
  /** 💡 The inspiration board's counts (`readHomeInspiration`); absent = not read. */
  inspiration?: { photos: number; parts: number } | 'unread' | null;
}): HomeControlInput {
  const hasDate = i.days.value !== '—';
  return {
    eventId: i.eventId,
    next: i.next,
    countdown: { value: i.days.value, label: i.days.label, days: i.daysN, hasDate, long: longDay(i.eventDate, hasDate), placeLine: i.venueName?.trim() || null, ...(i.countdownDoor ? { door: i.countdownDoor } : {}) },
    guests:
      i.needs.guestList === false
        ? null
        : i.roster
          ? { coming: i.roster.yes, noReply: i.roster.none, toInvite: i.roster.toInvite, declined: i.roster.no, total: i.roster.total, unseated: i.unseated ?? null }
          : 'unread',
    hub: i.hub,
    suppliers: i.suppliers && i.suppliers !== 'unread' ? { ...i.suppliers, inspiration: i.inspiration ?? null } : i.suppliers,
    // 'hidden' = the budget is not shared with this viewer: ABSENT, never "—". null = the read failed: SAID.
    budget:
      i.needs.suppliers === false || i.money === 'hidden'
        ? null
        : i.money === null
          ? 'unread'
          : { paidPhp: i.money.paid, owingPhp: i.money.owing, pays: homePaysFrom(i.ledger) },
    checklist: i.checklist,
    schedule: i.schedule ?? null,
    asks: i.asks ?? null,
  };
}
