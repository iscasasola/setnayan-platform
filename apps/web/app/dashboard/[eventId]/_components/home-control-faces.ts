/**
 * home-control-faces.ts — HOME'S CONTROL ROW, AS DATA (owner-approved 2026-10-24, "ok":
 * `Setnayan/prototypes/home_control_center_2026-10-24_fable.html`, corpus 10067d39 — its "Review notes" are the contract).
 *
 * ONE DATA SHAPE PER WIDGET, DRAWN TWO WAYS (the notes' build plan, PR-D): below 768 px each widget is a compact TILE
 * whose faces rotate (`home-tile.tsx`); from `md` up it is a detail CARD (`home-control-row.tsx`). Both are drawn from
 * what this file returns, so the phone and the desktop can never say two things about one fact.
 *
 *   ① Countdown → Event Details · ② Guests → Guests · ③ Event Hub → the page guests see (Edit → the Maker)
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
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import type { CountFormat } from '@/components/count';
import { PUBLIC_STAGE_LABELS, PUBLIC_STAGE_ORDER } from '@/lib/public-site-stage-labels';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { HomeNext } from '@/lib/home-first-screen';
import type { MoneyLine } from '@/lib/budget-truth';

/** The six upper widgets, in the owner's order (notes: "The order, top to bottom — and the one reason"). */
export const HOME_CONTROL_KEYS = ['count', 'guests', 'hub', 'sup', 'budget', 'plan'] as const;
export type HomeControlKey = (typeof HOME_CONTROL_KEYS)[number];

/** The ONE page each widget opens (notes: "One widget → the ONE page it opens"). */
export const HOME_CONTROL_PAGE: Readonly<Record<HomeControlKey, string>> = {
  // The page titled Event Details — its one name (owner 2026-10-23: "only keep the Event Details button").
  count: 'Event Details',
  guests: 'Guests',
  hub: 'Event Hub',
  sup: 'Suppliers',
  budget: 'Budget',
  plan: 'Checklist',
};

/** A face's one tiny action — an icon (the compact tile) or icon + word (the detail card). */
export type FaceIcon = 'mail' | 'plus' | 'check' | 'pay' | 'reload' | 'pen' | 'eye' | 'cal';
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
};

export type HomeTileModel = {
  key: HomeControlKey;
  /** The small quiet label — only where the figure would not say what it is (none on Countdown · Guests · Budget). */
  label: string | null;
  /** The tile's one page (its first face's door when a tap lands between faces). */
  door: string;
  faces: HomeFace[];
  /** The read failed: one face, ⟳ Reload, never rotates. */
  failed: boolean;
  /** Spans both columns in the compact grid (Countdown · Budget). */
  span: boolean;
  /** Event Hub's two small icons (Edit · View) — the tile's buttons, never other pages' doors. */
  side?: FaceAction[];
  /** The Today strip points here. */
  today: boolean;
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
  toDecide: Array<{ name: string; vendorId: string; tile: string | null }>;
  /** Suppliers who answered and wait on the couple — `standingRollUp` ("2 suppliers replied"). */
  replied: number;
};

export type HomeChecklistFacts = {
  /** done / total — `fetchChecklistProgress`'s shape; total 0 = never seeded (no percentage exists). */
  done: number;
  total: number;
  /** Open (pending) tasks, all of them. */
  open: number;
  /** The open tasks the plan ranks first (`rankUrgentChecklistItems`), soonest first — at most three. */
  next: Array<{ id: string; title: string; dueDate: string | null; daysUntilDue: number | null }>;
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
  countdown: { value: string; label: string; days: number | null; hasDate: boolean; placeLine: string | null; long: string | null };
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

export type HomeTodayTarget = HomeControlKey | 'papic' | 'ai';
export type HomeToday = { target: HomeTodayTarget; words: string; tail: string; calm: boolean };

/**
 * What the Today strip says — the SHIPPED picker's choice (`pickHomeNext`, `HOME_NEXT_ORDER`), not a new ranking, and
 * which widget it points at (notes: "Where each of today's 'Next step' kinds … goes now").
 */
export function homeToday(next: HomeNext, guests: HomeControlInput['guests']): HomeToday {
  const counts = guests && guests !== 'unread' ? guests : null;
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
      return { target: 'plan', words: 'Nothing waits on you', tail: 'the plan has the rest', calm: true };
  }
}

/* ─── The six tiles ────────────────────────────────────────────────────────── */

const RELOAD: FaceAction = { icon: 'reload', label: 'Reload', href: null };

function failedTile(key: HomeControlKey, label: string, big: string, sm: string, door: string, today: boolean, span = false): HomeTileModel {
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

/** ① THE COUNTDOWN — the presentation piece: one face, never moves, no label (owner: "presentation is key"). */
export function countdownTile(input: HomeControlInput, today: HomeToday): HomeTileModel {
  const e = input.eventId;
  const c = input.countdown;
  if (!c.hasDate) {
    return {
      key: 'count',
      label: null,
      door: `/dashboard/${e}/details`,
      failed: false,
      span: true,
      today: today.target === 'count',
      faces: [
        {
          id: 'count-none',
          big: 'No date yet',
          sm: c.placeLine ?? '',
          href: `/dashboard/${e}/date-selection`,
          action: { icon: 'cal', label: 'Set your date', href: `/dashboard/${e}/date-selection`, main: today.target === 'count' },
        },
      ],
    };
  }
  return {
    key: 'count',
    label: null,
    door: `/dashboard/${e}/details`,
    failed: false,
    span: true,
    today: today.target === 'count',
    faces: [{ id: 'count', big: c.value, count: c.days !== null ? { value: c.days, format: 'int' } : null, unit: c.label, sm: [c.long, c.placeLine].filter(Boolean).join(' · '), href: `/dashboard/${e}/details` }],
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

/** ③ EVENT HUB — what guests see now · what comes next; its two buttons: Edit in Maker · View Event Hub. */
export function hubTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const h = input.hub;
  const isToday = today.target === 'hub';
  if (h === null) return null;
  if (h === 'unread') return failedTile('hub', 'Event Hub', 'Couldn’t load', 'unread · not private', `/dashboard/${e}/launch`, isToday);
  // When Today is "Finish your Event Hub", Edit in Maker opens the Maker on its guided "What's left" — the same door the
  // Next card's "Pick a stage" was (`?tool=details&guide=1`).
  const edit: FaceAction = {
    icon: 'pen',
    label: 'Edit in Maker',
    href: input.next.kind === 'guide' ? `/dashboard/${e}/launch?tool=details&guide=1` : `/dashboard/${e}/launch`,
    main: true,
  };
  const view: FaceAction | null = h.publicUrl ? { icon: 'eye', label: 'View Event Hub', href: h.publicUrl, external: true } : null;
  const faces: HomeFace[] = [];
  if (h.stage) {
    faces.push({
      id: 'hub-now',
      big: PUBLIC_STAGE_LABELS[h.stage],
      unit: 'live',
      sm: h.publicUrl ? 'guests see it' : 'not shared yet',
      href: h.publicUrl ?? `/dashboard/${e}/launch`,
      external: Boolean(h.publicUrl),
    });
  } else {
    faces.push({ id: 'hub-now', big: 'Not set', unit: 'yet', sm: 'pick your date to place it', href: `/dashboard/${e}/launch` });
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
      href: `/dashboard/${e}/launch?stage=${after}`,
    });
  }
  return {
    key: 'hub',
    label: 'Event Hub',
    door: h.publicUrl ?? `/dashboard/${e}/launch`,
    failed: false,
    span: false,
    today: isToday,
    faces,
    side: view ? [edit, view] : [edit],
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
    },
  ];
  const first = s.toDecide[0];
  if (first) {
    const decide = first.tile
      ? `/dashboard/${e}/vendors?open=${encodeURIComponent(first.tile)}&inspect=v:${first.vendorId}`
      : `/dashboard/${e}/vendors?inspect=v:${first.vendorId}`;
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
  return { key: 'sup', label: 'Suppliers', door: `/dashboard/${e}/vendors`, failed: false, span: false, today: isToday, faces };
}

/** ⑥ CHECKLIST — only the plan: % done · open · due this week. */
export function checklistTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const c = input.checklist;
  const isToday = today.target === 'plan';
  if (c === null) return null;
  if (c === 'unread') return failedTile('plan', 'Checklist', 'Couldn’t load', 'not zero · unread', `/dashboard/${e}/checklist`, isToday);
  const pct = c.total > 0 ? Math.round((c.done / c.total) * 100) : null;
  const faces: HomeFace[] = [];
  if (pct !== null) faces.push({ id: 'plan-pct', big: `${n(pct)}%`, count: { value: pct, format: 'pct' }, unit: 'done', sm: 'of the plan', href: `/dashboard/${e}/checklist`, meter: pct });
  const first = c.next[0];
  if (c.open > 0) {
    faces.push({ id: 'plan-open', big: n(c.open), count: { value: c.open, format: 'int' }, unit: 'open', sm: first ? `${first.title} first` : 'the next step is yours', href: `/dashboard/${e}/checklist` });
  }
  const soon = c.next.find((t) => t.daysUntilDue !== null && t.daysUntilDue <= 7);
  if (c.dueThisWeek > 0 && soon) {
    faces.push({ id: 'plan-week', big: n(c.dueThisWeek), count: { value: c.dueThisWeek, format: 'int' }, unit: 'due this week', sm: [soon.title, shortDay(soon.dueDate)].filter(Boolean).join(' · '), href: `/dashboard/${e}/checklist` });
  }
  if (faces.length === 0) return null;
  return { key: 'plan', label: 'Checklist', door: `/dashboard/${e}/checklist`, failed: false, span: false, today: isToday, faces };
}

/** ⑤ BUDGET — every payment still to settle (soonest first, overdue in red, each with Pay), then the summary. */
export function budgetTile(input: HomeControlInput, today: HomeToday): HomeTileModel | null {
  const e = input.eventId;
  const b = input.budget;
  const isToday = today.target === 'budget';
  if (b === null) return null;
  if (b === 'unread') return failedTile('budget', 'Budget', 'Money couldn’t load', 'paid and owing are unread, not ₱0', `/dashboard/${e}/vendors?part=budget`, isToday, true);
  const agreed = b.paidPhp + b.owingPhp;
  const pct = agreed > 0 ? Math.round((b.paidPhp / agreed) * 100) : null;
  const faces: HomeFace[] = [];
  if (b.pays !== 'unread') {
    const pays = paymentsToSettle(b.pays);
    const shown = pays.length > BUDGET_MAX_PAY_FACES ? pays.slice(0, BUDGET_MAX_PAY_FACES - 1) : pays;
    shown.forEach((p, i) => {
      const late = p.state === 'overdue' || (p.days !== null && p.days < 0);
      faces.push({
        id: `pay-${p.id}`,
        big: formatPhpRounded(p.owedPhp),
        count: { value: p.owedPhp, format: 'peso' },
        unit: `· ${dueWords(p)}`,
        sm: `${p.who} · ${p.what}`,
        href: `/dashboard/${e}/vendors?part=budget`,
        late,
        action: { icon: 'pay', label: 'Pay', href: `/dashboard/${e}/vendors?part=budget`, pill: true, main: late || (isToday && i === 0) },
      });
    });
    if (pays.length > BUDGET_MAX_PAY_FACES) {
      const more = pays.length - (BUDGET_MAX_PAY_FACES - 1);
      faces.push({ id: 'pay-more', big: `+${n(more)}`, unit: 'more to settle', sm: 'see them all in Budget', href: `/dashboard/${e}/vendors?part=budget` });
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
    href: `/dashboard/${e}/vendors?part=budget`,
    meter: pct,
  });
  return { key: 'budget', label: null, door: `/dashboard/${e}/vendors?part=budget`, failed: false, span: true, today: isToday, faces };
}

/**
 * The control row in the compact grid's order (notes: "Countdown / Guests · Event Hub / Suppliers · Checklist /
 * Budget") — so no half tile is left alone; a widget that is absent for this event closes its gap by spanning.
 */
export function homeControlTiles(input: HomeControlInput): { today: HomeToday; tiles: HomeTileModel[] } {
  const today = homeToday(input.next, input.guests);
  const built = [
    countdownTile(input, today),
    guestsTile(input, today),
    hubTile(input, today),
    suppliersTile(input, today),
    checklistTile(input, today),
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
}): HomeControlInput {
  const hasDate = i.days.value !== '—';
  return {
    eventId: i.eventId,
    next: i.next,
    countdown: { value: i.days.value, label: i.days.label, days: i.daysN, hasDate, long: longDay(i.eventDate, hasDate), placeLine: i.venueName?.trim() || null },
    guests:
      i.needs.guestList === false
        ? null
        : i.roster
          ? { coming: i.roster.yes, noReply: i.roster.none, toInvite: i.roster.toInvite, declined: i.roster.no, total: i.roster.total }
          : 'unread',
    hub: i.hub,
    suppliers: i.suppliers,
    // 'hidden' = the budget is not shared with this viewer: ABSENT, never "—". null = the read failed: SAID.
    budget:
      i.needs.suppliers === false || i.money === 'hidden'
        ? null
        : i.money === null
          ? 'unread'
          : { paidPhp: i.money.paid, owingPhp: i.money.owing, pays: homePaysFrom(i.ledger) },
    checklist: i.checklist,
  };
}
