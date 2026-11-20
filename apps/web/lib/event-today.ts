/**
 * lib/event-today.ts — THE EVENT'S TODAY AS ONE LIST (pure: no I/O, no clock of its own).
 *
 * Owner, 20 Nov 2026: *"make the Today of the event dashboard run like the Focus of Admin and Today of Suppliers
 * Dashboard"* · *"Yes, build it"*. Drawing `prototypes/event_today_focus_2026-11-20/` v3, part D ("Where each row comes
 * from"). The 19 Nov Today v3 rules apply as they do for a shop and for admin Focus:
 *
 *   · ONE list by urgency — red (Overdue · Today), amber (Soon), then the rest (`orderByUrgency`), always a word plus
 *     the colour;
 *   · the item the event card's strip holds is LEFT OUT ("Now never repeats below");
 *   · a row put off with "Do it tomorrow" sits under "Tomorrow N", out of the count — for THE PERSON WHO PUSHED IT only
 *     (`event_today_put_offs`); a RED row ignores any record, and an UNREAD record list holds nothing off;
 *   · a read that failed is a "Couldn't load …" row — never folded into "nothing needs you";
 *   · NO NEW NUMBER: every red or amber comes from a deadline the app already keeps (a payment's `dueState` /
 *     `daysUntilDue`, a plan task's `daysUntilDue` and the shipped seven-day "this week", a date change's `dueAt`).
 *
 * Everything here is worded from what Home ALREADY read (`HomeControlInput`, `homeToday`); the only new read behind it
 * is the person's own put-off records.
 *
 * 🔒 lib/event-today.test.ts · app/dashboard/[eventId]/event-today-is-focus-shaped.test.ts
 */
import { formatCount } from '@/lib/format-number';
import { formatPhpRounded } from '@/lib/php';
import { planningTodoHref } from '@/lib/checklist-anchor';
import { budgetPageHref, schedulePageHref } from '@/lib/pillar-parts';
import { orderByUrgency, type TodayUrgency } from '@/lib/supplier-today-v2';
import { EVENT_PUT_OFF_KEY, activePutOffs, canPutOff, type PutOffRecord } from '@/lib/today-put-off';
import {
  dueWords,
  homeNowAction,
  homeToday,
  paymentsToSettle,
  paysHeldByToday,
  payUrgency,
  shortDay,
  type HomeChecklistFacts,
  type HomeControlInput,
  type HomeToday,
} from '@/app/dashboard/[eventId]/_components/home-control-faces';

export { paysHeldByToday, payUrgency };

/** How many plan tasks the list shows before "N more plan tasks this week ›" (the shipped To do's three). */
export const EVENT_TODAY_TASK_ROWS = 3;
/** A plan task is "this week" inside this many days — the shipped rule behind "All N this week" (`lib/preparation.ts`). */
export const EVENT_TODAY_WEEK_DAYS = 7;

export type EventTodayIcon = 'pay' | 'person' | 'mail' | 'cal' | 'list' | 'image' | 'shop' | 'hub' | 'phone' | 'warn';

export type EventTodayRow = {
  /** The row's own key — what "Do it tomorrow" records (`pay:<line item>` · `task:<id>` · `ask:<what>`). */
  key: string;
  kind: 'pay' | 'task' | 'ask' | 'approve' | 'decide' | 'setup' | 'unread';
  title: string;
  /** The line under the title, WITHOUT the level word (the row draws "Overdue · " in front of it). */
  line: string;
  urgency: TodayUrgency | null;
  icon: EventTodayIcon;
  /** The row's own page — "Open in … ›" and a drag right. null = it has no page of its own (an offer). */
  href: string | null;
  /** The page's name in "Open in <page> ›"; "page" where it has no short name. */
  page: string;
  /** May it go to tomorrow? Never a red row, never a "couldn't load" row, never a key the record cannot hold. */
  putOff: boolean;
  /** A payment: the amount as words, what it is for, and the shipped Pay door (`?pay=<line item>`). */
  pay?: { id: string; amount: string; what: string; href: string };
  /** A plan task: its id and the row Planning Stage's tick writes (null = a computed step — it opens its row). */
  task?: { id: string; tick: { kind: 'task' | 'manual'; id: string } | null };
  /** The answer when it is ONE door ("Send the invitations", "Answer"). */
  door?: { label: string; href: string };
  /** One short sentence for the open card. */
  say?: string;
  /** A read that failed: the press runs Home's reads again. */
  reload?: boolean;
  /** An offer, not a task (“Prepare for event day”): listed, never counted. */
  offer?: boolean;
};

/** An ask the page already read (an access request, a coordinator's level, the Mood Board, a date change …). */
export type EventTodayAsk = {
  key: string;
  title: string;
  line: string;
  icon: EventTodayIcon;
  href: string | null;
  page?: string;
  urgency?: TodayUrgency | null;
  /** The read behind it failed — the row SAYS so; its press opens `href`, or runs the reads again (`reload`). */
  unread?: boolean;
  reload?: boolean;
  door?: { label: string; href: string };
  say?: string;
  /** An offer, not a task ("Prepare for event day"): listed, never counted. */
  offer?: boolean;
};

export type EventToday = {
  /** The rows still on Today, most urgent first. */
  list: EventTodayRow[];
  /** The rows this person put off — under "Tomorrow N", out of the count. */
  tomorrow: EventTodayRow[];
  /** "N more plan tasks this week ›" — null when the three shown are all of this week's. */
  more: { count: number; href: string } | null;
  /** "N% of the plan done · All N this week ›" — null when the plan was never seeded or could not be read. */
  foot: { pct: number | null; week: number; href: string } | null;
  /** The heading's figure: the rows on Today that are tasks (a "couldn't load" row and an offer are not counted). */
  listCount: number;
  /** The card's figure: the strip's item + `listCount`. */
  count: number;
  /** Something could not be read, so "nothing needs you" cannot be said. */
  unread: boolean;
  /** The strip's own level — its word replaces "Now" ("Overdue" · "Today" · "Soon"); null = "Now". */
  nowUrgency: TodayUrgency | null;
  /** The payments Today holds as RED rows or in the strip — the Budget card leaves these out. */
  paysHeld: string[];
  /** 👻 The plan was READ and holds nothing at all — the list may show its Example (never on a refused read). */
  planEmpty: boolean;
};

const n = (v: number) => formatCount(v);
const RED_OVERDUE: TodayUrgency = { level: 'red', word: 'Overdue' };
const RED_TODAY: TodayUrgency = { level: 'red', word: 'Today' };
const AMBER_SOON: TodayUrgency = { level: 'amber', word: 'Soon' };

/** A plan task's level, from its own due date: past → red Overdue · today → red Today · this week → amber Soon. */
export function taskUrgency(daysUntilDue: number | null): TodayUrgency | null {
  if (daysUntilDue === null || !Number.isFinite(daysUntilDue)) return null;
  if (daysUntilDue < 0) return RED_OVERDUE;
  if (daysUntilDue === 0) return RED_TODAY;
  if (daysUntilDue <= EVENT_TODAY_WEEK_DAYS) return AMBER_SOON;
  return null;
}

/** A level from a reply deadline the app keeps (`dueAt`): past → red Overdue · inside a day → red Today · else amber Soon. */
export function deadlineUrgency(dueAt: string | null | undefined, now: number): TodayUrgency | null {
  if (!dueAt) return null;
  const ms = new Date(dueAt).getTime() - now;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return RED_OVERDUE;
  if (ms < 24 * 3_600_000) return RED_TODAY;
  return AMBER_SOON;
}

/** The setup steps that are rows (drawing part D: pick a date · add guests · send invitations · finish your Event Hub). */
const SETUP_KINDS: ReadonlySet<string> = new Set(['guide', 'date', 'guests', 'invite']);
const SETUP_ICON: Readonly<Record<string, EventTodayIcon>> = { guide: 'hub', date: 'cal', guests: 'person', invite: 'mail' };
const SETUP_PAGE: Readonly<Record<string, string>> = { guide: 'Event Hub', date: 'page', guests: 'Guests', invite: 'Guests' };

const unreadRow = (key: string, title: string, href: string, page: string): EventTodayRow => ({
  key,
  kind: 'unread',
  title,
  line: 'not empty — unread · tap to try again',
  urgency: null,
  icon: 'warn',
  href,
  page,
  putOff: false,
  reload: true,
});

/**
 * The event's one list. `today` is the strip's item (`homeToday`); `asks` are the asks the page already read; `putOffs`
 * are THIS PERSON'S records on this event (`null` = they could not be read — then nothing is held off).
 */
export function buildEventToday(i: {
  control: HomeControlInput;
  today: HomeToday;
  asks?: readonly EventTodayAsk[];
  putOffs: readonly PutOffRecord[] | null;
  /** Manila's day, `YYYY-MM-DD`. */
  todayIso: string;
}): EventToday {
  const { control, today } = i;
  const e = control.eventId;
  const rows: EventTodayRow[] = [];
  let unread = false;

  /* ── Payments — the Budget card's own read (`HomePayLine`) ── */
  const budget = control.budget;
  const pays = budget && budget !== 'unread' && budget.pays !== 'unread' ? budget.pays : null;
  let nowUrgency: TodayUrgency | null = null;
  if (budget === 'unread' || (budget && budget.pays === 'unread')) {
    unread = true;
    rows.push(unreadRow('unread:pay', 'Your payments couldn’t load', budgetPageHref(e), 'Budget'));
  }
  for (const p of pays ? paymentsToSettle(pays) : []) {
    const urgency = payUrgency(p);
    if (p.id === today.holds?.pay) {
      nowUrgency = urgency;
      continue;
    }
    if (!urgency) continue;
    const amount = formatPhpRounded(p.owedPhp);
    rows.push({
      key: `pay:${p.id}`,
      kind: 'pay',
      title: `Pay ${p.who}`,
      line: `${amount} · ${dueWords(p)}`,
      urgency,
      icon: 'pay',
      href: budgetPageHref(e),
      page: 'Budget',
      putOff: true,
      pay: { id: p.id, amount, what: p.what, href: budgetPageHref(e, { pay: p.id }) },
    });
  }

  /* ── Plan tasks — the plan's own soonest (`HomeChecklistFacts.next`) ── */
  const checklist: HomeChecklistFacts | null = control.checklist && control.checklist !== 'unread' ? control.checklist : null;
  let more: EventToday['more'] = null;
  if (control.checklist === 'unread') {
    unread = true;
    rows.push(unreadRow('unread:plan', 'Your plan couldn’t load', planningTodoHref(e), 'Schedule'));
  }
  if (checklist) {
    const held = today.holds?.task ? (checklist.next.find((t) => t.id === today.holds?.task) ?? null) : null;
    if (held) nowUrgency = taskUrgency(held.daysUntilDue);
    const shown = checklist.next.filter((t) => t.id !== today.holds?.task).slice(0, EVENT_TODAY_TASK_ROWS);
    for (const t of shown) {
      rows.push({
        key: `task:${t.id}`,
        kind: 'task',
        title: t.title,
        line: t.dueDate ? `due ${shortDay(t.dueDate)}` : 'no date yet',
        urgency: taskUrgency(t.daysUntilDue),
        icon: 'list',
        href: planningTodoHref(e, t.id),
        page: 'Schedule',
        putOff: true,
        task: { id: t.id, tick: t.tick ?? null },
      });
    }
    // "N more" is the plan's own "this week" figure less the ones already on screen — never a number of its own.
    const thisWeek = (d: number | null) => d !== null && d <= EVENT_TODAY_WEEK_DAYS;
    const onScreen = shown.filter((t) => thisWeek(t.daysUntilDue)).length + (held && thisWeek(held.daysUntilDue) ? 1 : 0);
    const left = checklist.dueThisWeek - onScreen;
    if (left > 0) more = { count: left, href: planningTodoHref(e) };
  }

  /* ── The asks the page read (access · the coordinator's level · the Mood Board · a date change …) ── */
  for (const a of i.asks ?? []) {
    if (today.target === 'asks' && a.key === 'ask:access') continue; // the strip holds it
    if (a.unread) {
      unread = true;
      rows.push({ ...unreadRow(a.key, a.title, a.href ?? '', a.page ?? 'page'), href: a.href, line: a.line, reload: a.reload === true || !a.href });
      continue;
    }
    rows.push({
      key: a.key,
      kind: 'ask',
      title: a.title,
      line: a.line,
      urgency: a.urgency ?? null,
      icon: a.icon,
      href: a.href,
      page: a.page ?? 'page',
      putOff: true,
      ...(a.door ? { door: a.door } : {}),
      ...(a.say ? { say: a.say } : {}),
      ...(a.offer ? { offer: true } : {}),
    });
  }

  /* ── Supplier changes to approve — the Schedule's `toApprove` ── */
  const sched = control.schedule;
  if (sched === 'unread') {
    unread = true;
    rows.push(unreadRow('unread:schedule', 'Your Schedule couldn’t load', schedulePageHref(e), 'Schedule'));
  } else if (sched && sched.toApprove > 0 && today.target !== 'sched') {
    const href = schedulePageHref(e, { sheet: 'requests' });
    rows.push({
      key: 'approve:schedule',
      kind: 'approve',
      title: `Answer ${n(sched.toApprove)} supplier ${sched.toApprove === 1 ? 'change' : 'changes'} in Schedule`,
      line: 'Your suppliers asked to change the day',
      urgency: null,
      icon: 'cal',
      href,
      page: 'Schedule',
      putOff: true,
      door: { label: 'Answer', href },
    });
  }

  /* ── Suppliers waiting for your pick — Suppliers' `toDecide` ── */
  const sup = control.suppliers;
  if (sup === 'unread') {
    unread = true;
    rows.push(unreadRow('unread:suppliers', 'Your suppliers couldn’t load', `/dashboard/${e}/vendors`, 'Suppliers'));
  } else if (sup && sup.toDecide.length > 0 && today.target !== 'sup') {
    const href = `/dashboard/${e}/vendors?tab=shortlist`;
    const one = sup.toDecide.length === 1 ? sup.toDecide[0]! : null;
    rows.push({
      key: 'decide:suppliers',
      kind: 'decide',
      title: one ? `${one.name} waits on your answer` : `${n(sup.toDecide.length)} quotes wait on your answer`,
      line: one ? 'Their quote' : 'In Suppliers',
      urgency: null,
      icon: 'shop',
      href,
      page: 'Suppliers',
      putOff: true,
      door: { label: 'Answer', href },
    });
  }

  /* ── The setup step — the shipped picker's own (`pickHomeNext`), when the strip holds something else ── */
  if (control.guests === 'unread' || control.hub === 'unread') unread = true;
  if (SETUP_KINDS.has(control.next.kind)) {
    const step = homeToday(control.next, control.guests, null);
    const action = homeNowAction(step, control);
    if (step.words !== today.words && action?.href) {
      const guests = control.guests && control.guests !== 'unread' ? control.guests : null;
      const invite = control.next.kind === 'invite';
      rows.push({
        key: `setup:${control.next.kind}`,
        kind: 'setup',
        title: step.words,
        line: invite && guests ? `${n(guests.toInvite)} not invited yet` : step.tail,
        urgency: null,
        icon: SETUP_ICON[control.next.kind] ?? 'list',
        href: invite || control.next.kind === 'guests' ? `/dashboard/${e}/guests` : action.href,
        page: SETUP_PAGE[control.next.kind] ?? 'page',
        putOff: true,
        door: { label: invite ? 'Send the invitations' : action.verb, href: action.href },
        ...(invite && guests ? { say: `${n(guests.toInvite)} ${guests.toInvite === 1 ? 'guest has' : 'guests have'} not been sent their invitation.` } : {}),
      });
    }
  }

  /* ── One list by urgency; then this person's put-offs leave it ── */
  const held = activePutOffs(i.putOffs, i.todayIso, EVENT_PUT_OFF_KEY);
  const list: EventTodayRow[] = [];
  const tomorrow: EventTodayRow[] = [];
  for (const raw of orderByUrgency(rows)) {
    // A red row can never go to tomorrow, and neither can a "couldn't load" row or a key the record cannot hold.
    const putOff = raw.kind !== 'unread' && EVENT_PUT_OFF_KEY.test(raw.key);
    const row = { ...raw, putOff };
    if (putOff && held.has(row.key)) tomorrow.push(row);
    else list.push(row);
  }

  const counted = (r: EventTodayRow) => r.kind !== 'unread' && !r.offer;
  const listCount = list.filter(counted).length;
  // The strip counts when it holds a real thing to do — not when it is calm, and not when it only says "couldn't load".
  const nowAction = homeNowAction(today, control);
  const nowCounts = !today.calm && nowAction !== null && (nowAction.href !== null || Boolean(nowAction.point) || Boolean(nowAction.tick));
  if (!today.calm && !nowCounts) unread = true;

  return {
    list,
    tomorrow,
    more,
    foot: checklist ? { pct: checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : null, week: checklist.dueThisWeek, href: planningTodoHref(e) } : null,
    listCount,
    count: listCount + (nowCounts ? 1 : 0),
    unread,
    nowUrgency,
    paysHeld: paysHeldByToday(pays, today.holds?.pay),
    planEmpty: checklist !== null && checklist.total === 0 && checklist.next.length === 0,
  };
}

/** The card's count line: "8 things need you" · "1 thing needs you" · calm · or said when a read failed. */
export function eventTodayNeedWords(t: Pick<EventToday, 'count' | 'unread'>): { figure: string | null; words: string } {
  if (t.count > 0) return { figure: `${n(t.count)} ${t.count === 1 ? 'thing' : 'things'}`, words: t.count === 1 ? 'needs you' : 'need you' };
  if (t.unread) return { figure: null, words: 'Part of Today couldn’t load' };
  return { figure: null, words: 'Nothing needs you today' };
}
