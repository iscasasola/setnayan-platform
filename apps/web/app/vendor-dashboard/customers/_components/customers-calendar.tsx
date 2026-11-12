'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { CalendarGrid, CalendarLegend } from '@/app/_components/calendar';
import { DayBox, feelDay, glideScrollTo, scrollerOf, useCalendarSwipe } from '@/app/_components/calendar-day-box';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useTabReselect } from '@/app/_components/nav/use-chrome-away';
import { monthTitle, stepMonth, type CalendarDay, type CalendarDayState, type CalendarMonth } from '@/lib/calendar-grid';
import type { SchedulePool, VendorCalendarDayState } from '@/lib/vendor-schedule';
import type { WaitlistDateGroup } from '@/lib/vendor-waitlist';
import { buildCustomerCalendarMonth, type CustomerCalendarMonth } from '@/lib/vendor-customers';
import { dayHeadWords, dayLongWords, dayRowsOf, daySheetHref, dayStateOf, nearWord, type DatesBlock, type DatesBooking, type DayRow } from '@/lib/vendor-dates';
import { fetchCustomerCalendarMonth } from '../actions';
import { DatesRow } from './dates-row';
import { DayBar } from './day-bar';
import { DATES_FIGURES_EVENT, DATES_JUMP_EVENT } from './customers-figures';
import { datesDayIs, datesFiguresOf, type DatesFigureKey } from '../dates-figures';
import { ALL_SCHEDULES, CLIENTS_SCHEDULE_EVENT, CLIENTS_SCHEDULING_EVENT, scheduleScopeOptions, schedulesOffered } from '../clients-show-sort';

/**
 * CUSTOMERS › DATES — the month (S-PR3; plan § 2 "one month grid (booked · holding · blocked), the day's rows under
 * it"; prototype frame 04; control templates round 2, kind 31).
 *
 * THE SHARED MONTH GRID (`app/_components/calendar.tsx`, kind 8 extended to kind 31) — the picked day is the one
 * terracotta circle; a green dot says something is booked, an amber dot that couples are waiting on the day, a
 * hatched square that nothing new can be booked; a full day is bold. The legend says every mark in words. Under the
 * month: the picked day's eyebrow ("Sat 3 · Tomorrow") with the ONE dropdown of calendars (plan § 2: "One dropdown
 * for 'All calendars'"), then that day's rows — each opens the day (`?seg=dates&day=`, frame 35).
 *
 * 🔑 ONE SOURCE FOR THE DAY'S TRUTH. Every mark is `buildCustomerCalendarMonth` (`lib/vendor-customers.ts`, the same
 * derivation the shop's other date surfaces read) folded by `dayStateOf` (`lib/vendor-dates.ts`). Nothing here
 * counts a booking.
 *
 * 2026-10-14 (owner ✅ "APPROVE" the simpler dashboard; prototype `supplier_easy_dashboard_2026-10-14_fable.html`
 * `datesBody` + `monthGrid`): the ONE dropdown is "All schedules ▾" (a shop with one schedule reads "One schedule · N
 * events a day" instead) — since 2026-11-12 no longer ABOVE the month: it is Show & sort's Schedule row plus a 44px chip
 * under the legend (`Build_Schedules_2026-11-12` part a); the month's title is itself a dropdown between ‹ and ›; the legend
 * says Booked here · Outside (its own grey dot) · Asking · Not available · Full; a part-day block hatches the top half;
 * under the month, the picked day's long date with "Open the day ›", then its rows.
 *
 * 📌 v13 (APPROVED 2026-10-29, prototype `custDates()`; DECISION_LOG "EVERY SUPPLIER-DASHBOARD PAGE: THE TOP ROWS
 * COMPRESS INTO ONE PINNED ROW ON SCROLL" — *"after the Dates ruling: month → one pinned week row with ‹ › a day"*):
 *   · THE FIGURES — booked · asking · days off for the month on show sit on Customers' pinned row
 *     (`customers-figures.tsx`); the month counts them (`dates-figures.ts`) and says so on every ‹ ›, and a tap on one
 *     picks the first day of its kind here.
 *   · THE WEEK STRIP — once the month has scrolled up under the pinned row, the picked day's week (Sun–Sat) pins under
 *     it as ONE row, ‹ › stepping a day at a time (across a month's edge too). Scrolling back up, the month is there.
 *     Everything under the month (`after`: the Dates folds) sits inside this block so the strip stays pinned over it.
 *
 * Month nav is client-driven (kept from the shipped calendar): the month-independent inputs (pools · bookings ·
 * blocks) ship once; a new month fetches only its day states + waiting list (`fetchCustomerCalendarMonth`), cached
 * per month. Without a fetcher (the dev lab), another month draws from the inputs it has.
 */

/** Raw, filter-agnostic month inputs cached per month for instant re-derive. */
/** `dayStatesRead: false` ⇒ the month's held / approve-first days were refused (G7) — said over the month, never drawn free. */
type MonthInputs = { dayStates: VendorCalendarDayState[]; dayStatesRead?: boolean; waitlist: WaitlistDateGroup[] };

const ym = (m: CalendarMonth) => `${m.y}-${String(m.m).padStart(2, '0')}`;

/**
 * 🔘 LET THE PICKED DAY GO, from outside the month (Build 2 #43): the ONE Clients screen's tiles sit under the month, and
 * pressing one while a day is picked shows its whole list — so the day is let go first. A window event, like
 * `DATES_JUMP_EVENT`, because the tiles and the month are siblings, not parent and child.
 */
export const CLIENTS_LET_GO_DAY_EVENT = 'sn:clients-let-go-day';

export function CustomersCalendar({
  initialDayStates,
  initialDayStatesRead = true,
  initialWaitlist,
  inquiries = [],
  initialMonth,
  initialDay,
  todayIso,
  pools,
  bookings,
  blocks,
  agents = [],
  agentCategories = {},
  fetchMonth = fetchCustomerCalendarMonth,
  halls = false,
  dayActions = null,
  closuresComplete = true,
  after = null,
  place = 'clients',
  oneScreen = false,
  between = null,
  onPicked,
  asksRead = false,
}: {
  /** Schedule place: the asks were read in the month's one request (Build 2 #43g) — the legend may say "Asking". */
  asksRead?: boolean;
  /**
   * 📅 THE ONE CLIENTS SCREEN (Build 2 row #43a, v113): the month heads Clients itself — calendar → tiles →
   * Overdue/Unread → the day-headed list. The month then draws no list of its own when no day is picked (the clients'
   * list below IS the list), no legend (the tiles' dots name the marks), writes `?m=` (not `?seg=dates`), and the picked
   * day's head gets an × that lets the day go. Off = Clients › Dates as it shipped (the dev lab still mounts it).
   */
  oneScreen?: boolean;
  /** Drawn right under the month (and its week strip) — the one screen's tiles and quick buttons. */
  between?: ReactNode;
  /** Told whenever the picked day changes (null = let go) — the one screen hides the full list while a day is picked. */
  onPicked?: (day: CalendarDay | null) => void;
  /**
   * 📅 WHERE THIS MONTH IS DRAWN — one part, two places (controller 2026-11-08: the picked client's Schedule draws "the
   * Clients calendar component, not a second calendar"; v113 `calC`):
   *   · 'clients'  — Clients › Dates: the pinned row's figures, the URL, the day bar, every day still to come when
   *                  none is picked; the Schedule chip speaks with Show & sort's Schedule row (2026-11-12).
   *   · 'schedule' — the picked client's Schedule page: the same month, week strip, toggle and Schedule chip (its own
   *                  pick — no Show & sort here), its event's day picked on arrival; no figures, no URL writes (the
   *                  picked client owns the URL), no day bar;
   *                  the picked day's rows only, and nothing listed when none is picked (the schedule follows).
   */
  place?: 'clients' | 'schedule';
  /** False ⇒ some closures did not load — "days off" says "—", never a short count. */
  closuresComplete?: boolean;
  /** What follows the picked day (the Dates folds) — inside this block, so the week strip stays pinned over it. */
  after?: ReactNode;
  /**
   * The picked day's "You can take bookings" switch (2026-10-28) — the shipped `addManualBlock` / `removeBlock`, in
   * place. Absent → no switch (the dev lab's fixtures without actions).
   */
  dayActions?: { addManualBlock: (fd: FormData) => void | Promise<void>; removeBlock: (fd: FormData) => void | Promise<void> } | null;
  /** Every schedule is a venue's hall (2026-10-14 🏛) — the dropdown says "All halls" and each hall by its name. */
  halls?: boolean;
  /** The first-painted month's raw day states + waiting list (server-fetched). */
  initialDayStates: VendorCalendarDayState[];
  /** False ⇒ those day states were refused — the month says so (G7: "2026-11-31" drew November as all free). */
  initialDayStatesRead?: boolean;
  initialWaitlist: WaitlistDateGroup[];
  /** Dates couples are asking about, counted (`pendingInquiryDates`). */
  inquiries?: { requestedDate: string; count: number }[];
  /** 'YYYY-MM' of the first-painted month. */
  initialMonth: string;
  /** The day picked on arrival; null = none (the one Clients screen opens on its whole list, v113). */
  initialDay: CalendarDay | null;
  /** PH civil "today" (YYYY-MM-DD). */
  todayIso: string;
  pools: SchedulePool[];
  /** Trimmed to what the month and the day's rows read. */
  bookings: DatesBooking[];
  /** Trimmed: a closure's own label and an outside client's name — never their contact or note. */
  blocks: DatesBlock[];
  /** Team members (Pro+): picking one narrows to the schedules of the services they are assigned. */
  agents?: { value: string; label: string }[];
  agentCategories?: Record<string, string[]>;
  /** The month fetcher — the shipped server action; null draws other months from what is already here. */
  fetchMonth?: ((month: string) => Promise<MonthInputs | null>) | null;
}) {
  const [month, setMonth] = useState(initialMonth);
  /*
    🔘 A PICKED DAY CAN BE LET GO (v113, B1 step 1): tapping the picked day again — on the month or the week strip —
    clears it, and the rows under the month become EVERY day still to come in it, each under its own pinned heading.
    Null = no day picked.
  */
  const onClients = place === 'clients';
  const [picked, setPicked] = useState<CalendarDay | null>(initialDay);
  const toggleDay = (d: CalendarDay) => setPicked((was) => (was === d ? null : d));
  /*
    📅 SCHEDULE ▾ (2026-11-12) — which schedules the month marks. Picked in Show & sort's Schedule row or this month's chip
    (the SAME choices, `scheduleScopeOptions`); on-screen only, never the address. On Clients the sheet and the month
    are siblings, so the pick crosses on window events (like `CLIENTS_SHOW_EVENT`); the Schedule page's month keeps its
    own (the Clients list is still mounted under it and must not hear it).
  */
  const [scope, setScope] = useState(ALL_SCHEDULES);
  useEffect(() => {
    if (!onClients) return;
    const pick = (e: Event) => setScope((e as CustomEvent<string>).detail || ALL_SCHEDULES);
    window.addEventListener(CLIENTS_SCHEDULE_EVENT, pick);
    return () => window.removeEventListener(CLIENTS_SCHEDULE_EVENT, pick);
  }, [onClients]);
  useEffect(() => {
    if (onClients) window.dispatchEvent(new CustomEvent(CLIENTS_SCHEDULING_EVENT, { detail: scope }));
  }, [scope, onClients]);
  const [pending, startTransition] = useTransition();
  // 🗓 "Try again" under a booked row whose hours could not be read — the page's server read runs again.
  const router = useRouter();
  const [rereading, startReread] = useTransition();
  const [monthInputs, setMonthInputs] = useState<Map<string, MonthInputs>>(
    () => new Map([[initialMonth, { dayStates: initialDayStates, dayStatesRead: initialDayStatesRead, waitlist: initialWaitlist }]]),
  );

  /* The ONE dropdown: every calendar, one of them, or (Pro+) one person's calendars. */
  const shownPools = useMemo(() => {
    if (scope.startsWith('pool:')) return pools.filter((p) => p.poolId === scope.slice(5));
    if (scope.startsWith('agent:')) {
      const cats = agentCategories[scope.slice(6)] ?? [];
      return pools.filter((p) => p.categories.some((c) => cats.includes(c)));
    }
    return pools;
  }, [pools, scope, agentCategories]);
  const shownIds = useMemo(() => new Set(shownPools.map((p) => p.poolId)), [shownPools]);
  const poolLabel = useCallback(
    (id: string | null) => (id === null ? 'Every schedule' : (pools.find((p) => p.poolId === id)?.label ?? 'A schedule')),
    [pools],
  );

  const data = useMemo<CustomerCalendarMonth>(() => {
    const inputs = monthInputs.get(month);
    return buildCustomerCalendarMonth(
      shownPools,
      bookings,
      blocks,
      inputs?.dayStates ?? [],
      inputs?.waitlist ?? [],
      month,
      todayIso,
      inquiries,
    );
  }, [month, monthInputs, shownPools, bookings, blocks, todayIso, inquiries]);

  const readStates = useMemo(() => {
    const out = new Map<CalendarDay, CalendarDayState>();
    for (const d of data.days) {
      const st = dayStateOf(d);
      if (st) out.set(d.date, st);
    }
    return out;
  }, [data.days]);

  // 🎉 #29 ACCEPT BOOKINGS IS FELT: the day bar's switch is flipped → the day's cell (month + week strip) is struck /
  // un-struck AT ONCE, in the picked fill too, from what the switch now SHOWS — not when the write's re-read lands.
  // The overlay goes when the re-read arrives (`blocks` changes: the read is the truth again) or the write is
  // refused. Then the mark moves (`feelDay`: squash off · pop + confetti on; nothing under reduced motion).
  const rootRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState<ReadonlyMap<CalendarDay, boolean>>(() => new Map());
  useEffect(() => setFlipped((f) => (f.size ? new Map() : f)), [blocks]);
  const states = useMemo(() => {
    if (flipped.size === 0) return readStates;
    const out = new Map(readStates);
    for (const [d, open] of flipped) out.set(d, { ...(out.get(d) ?? {}), blocked: !open });
    return out;
  }, [readStates, flipped]);
  const feel = useRef<{ day: CalendarDay; off: boolean } | null>(null);
  const onFlip = useCallback((day: string, open: boolean, how: 'flip' | 'refused') => {
    feel.current = how === 'flip' ? { day, off: !open } : null;
    setFlipped((f) => {
      const next = new Map(f);
      if (how === 'flip') next.set(day, open);
      else next.delete(day);
      return next;
    });
  }, []);
  useLayoutEffect(() => {
    const f = feel.current;
    feel.current = null;
    if (!f || !rootRef.current) return;
    const marks = rootRef.current.querySelectorAll<HTMLElement>(
      `[data-calendar-day="${f.day}"] [data-calendar-dn], [data-dates-week-day="${f.day}"] [data-calendar-dn]`,
    );
    feelDay([...marks], f.off);
  }, [flipped]);

  const goToMonth = useCallback(
    (m: CalendarMonth, day?: CalendarDay) => {
      const next = ym(m);
      /*
        🧊 THE ADDRESS IS WRITTEN WITH THE ROUTER'S OWN HISTORY STATE — NEVER `null` (2026-11-12, "I cannot leave the
        page"). Next patches `history.replaceState`: a state without its `__NA` mark is read as an outside URL change and
        dispatched as a router RESTORE, and a RESTORE DISCARDS whatever router action is still pending — here the month
        fetch (a server action) the previous ‹ › started. A discarded action's promise is never settled, so the router
        sat on it forever: two quick taps of ‹ › and no tab, link or Back could navigate again, even after returning to
        the first month. Passing `window.history.state` (it carries `__NA`) only rewrites the address bar, the house
        pattern (`picked-shell.tsx`, `toast-from-params.tsx`). Reproduced on next@15.5.28 + react@19.2.6 before the fix.
        🔒 ../a-month-tap-never-freezes-the-page.test.ts
      */
      const syncUrl = () => {
        if (!oneScreen)
          return window.history.replaceState(window.history.state, '', `${window.location.pathname}?seg=dates&m=${next}#calendar`);
        // The one screen keeps everything else the address says (a search, a Show & sort choice) and names the month.
        const u = new URL(window.location.href);
        u.searchParams.set('m', next);
        u.searchParams.delete('seg');
        window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}`);
      };
      setMonth(next);
      // The picked day moves with the month (today when it is on show, else the 1st) — its rows are always this month's.
      // A step of the week strip names the day itself (the 31st's next day is the 1st of the next month).
      // With no day picked, the month changes and still no day is picked (every day of the new month is listed).
      setPicked((was) => day ?? (was === null ? null : todayIso.startsWith(next) ? todayIso : `${next}-01`));
      if (onClients) syncUrl();
      if (monthInputs.has(next) || !fetchMonth) return;
      startTransition(async () => {
        const res = await fetchMonth(next);
        // Refused whole: nothing of this month is here — it is SAID unread, never drawn as a month of free days.
        if (!res) return setMonthInputs((prev) => new Map(prev).set(next, { dayStates: [], dayStatesRead: false, waitlist: [] }));
        setMonthInputs((prev) =>
          new Map(prev).set(next, { dayStates: res.dayStates, dayStatesRead: res.dayStatesRead !== false, waitlist: res.waitlist }),
        );
      });
    },
    [monthInputs, fetchMonth, todayIso, onClients, oneScreen],
  );

  /*
    🔁 THE CLIENTS TAB, TAPPED AGAIN, PUTS THE MONTH BACK (2026-11-12, owner: "Pressing the clients should return to the
    original state"). The tab's own navigation still runs (it clears the address); the month is client state that
    navigation alone never resets, so it goes back here: this month, no day picked, every schedule.
  */
  const backToStart = useCallback(() => {
    setScope(ALL_SCHEDULES);
    goToMonth({ y: Number(todayIso.slice(0, 4)), m: Number(todayIso.slice(5, 7)) });
    setPicked(null);
  }, [goToMonth, todayIso]);
  useTabReselect(
    'customers',
    useCallback(() => {
      if (onClients && oneScreen) backToStart();
    }, [onClients, oneScreen, backToStart]),
  );

  // The one screen hears its picked day, and lets it go when a tile asks to show a whole list.
  useEffect(() => {
    onPicked?.(picked);
  }, [picked, onPicked]);
  useEffect(() => {
    if (!oneScreen) return;
    const letGo = () => setPicked(null);
    window.addEventListener(CLIENTS_LET_GO_DAY_EVENT, letGo);
    return () => window.removeEventListener(CLIENTS_LET_GO_DAY_EVENT, letGo);
  }, [oneScreen]);

  /* 📌 THE FIGURES — counted here, for the month on show, and handed to the pinned row; a tap there picks a day here. */
  const figures = useMemo(() => datesFiguresOf(data.days, closuresComplete), [data.days, closuresComplete]);
  useEffect(() => {
    // The Schedule page's month never speaks for Clients' pinned row (the list is still mounted under it).
    if (onClients) window.dispatchEvent(new CustomEvent(DATES_FIGURES_EVENT, { detail: figures }));
  }, [figures, onClients]);
  useEffect(() => {
    if (!onClients) return;
    const onJump = (e: Event) => {
      const key = (e as CustomEvent<DatesFigureKey>).detail;
      const first = data.days.find((d) => datesDayIs(key, d));
      if (first) setPicked(first.date);
    };
    window.addEventListener(DATES_JUMP_EVENT, onJump);
    return () => window.removeEventListener(DATES_JUMP_EVENT, onJump);
  }, [data.days, onClients]);

  /* 📌 THE WEEK STRIP — shown once the month is up under the pinned row; it pins right under that row. */
  const monthRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [folded, setFolded] = useState(false);
  /** The pinned row's height — the week strip pins under it, and the day headings under both. */
  const [pinH, setPinH] = useState(0);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const grid = monthRef.current;
      const strip = stripRef.current;
      if (!grid || !strip) return;
      // Clients: under the Customers pinned row. Schedule: the picked client's pinned row sits OUTSIDE its scroller, so
      // the strip pins at the scroller's own top.
      const pin = onClients ? document.querySelector<HTMLElement>('[data-customers-pin]') : null;
      const box = onClients ? null : grid.closest<HTMLElement>('[data-picked-body]');
      const under = pin ? pin.getBoundingClientRect().bottom : box ? box.getBoundingClientRect().top : 0;
      strip.style.top = `${pin ? pin.offsetHeight : 0}px`;
      setPinH(pin ? pin.offsetHeight : 0);
      // Hysteresis: fold once the month's last week is under the row, unfold as soon as a week of it shows again.
      const bottom = grid.getBoundingClientRect().bottom;
      setFolded((was) => (was ? bottom < under + 48 : bottom < under));
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    document.addEventListener('scroll', soon, { passive: true, capture: true });
    window.addEventListener('resize', soon);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
    };
  }, [onClients]);
  // The week the strip draws: the picked day's, or — none picked — today's when it is in this month, else the 1st's.
  const anchor: CalendarDay = picked ?? (todayIso.startsWith(month) ? todayIso : `${month}-01`);
  // #37: a swipe on the strip moves the WEEK on show (± 7 days), never the picked day; the next pick or ‹ › re-centres it.
  const [weekShift, setWeekShift] = useState<{ at: CalendarDay; by: number }>({ at: anchor, by: 0 });
  const shift = weekShift.at === anchor ? weekShift.by : 0;
  const stepDay = (by: number) => {
    setWeekShift({ at: anchor, by: 0 });
    const at = new Date(`${anchor}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + by);
    const next = at.toISOString().slice(0, 10);
    if (next.slice(0, 7) === month) setPicked(next);
    else goToMonth({ y: Number(next.slice(0, 4)), m: Number(next.slice(5, 7)) }, next);
  };
  const week = useMemo(() => {
    const at = new Date(`${anchor}T00:00:00Z`);
    at.setUTCDate(at.getUTCDate() + 7 * shift);
    const sunday = new Date(at);
    sunday.setUTCDate(at.getUTCDate() - at.getUTCDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setUTCDate(sunday.getUTCDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [anchor, shift]);

  // 👆 #37 THE ONE SWIPE: the month's days and the week's days, sideways — old and new slide together (320 ms).
  const slideMonth = useCalendarSwipe(
    monthRef,
    (side) => goToMonth(stepMonth({ y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) }, side)),
    '[data-calendar-days]',
  );
  const slideWeek = useCalendarSwipe(stripRef, (side) => setWeekShift({ at: anchor, by: shift + side }), '[data-dates-week-days]');
  useLayoutEffect(() => {
    slideMonth();
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    slideWeek();
  }, [week]); // eslint-disable-line react-hooks/exhaustive-deps

  // ↩ #27 THE RETURN RULE: picking a day (from none) remembers where the scroller stood; letting it go — ×, the day
  // tapped again, a tile — glides back there (and so to the month's open/compact state), 520 ms, never a jump. Stepping
  // from one day to another keeps the first memory, so the return is to the state before ANY day opened.
  const scroller = useRef<HTMLElement | null>(null);
  const lastTop = useRef(0);
  const returnTop = useRef<number | null>(null);
  useEffect(() => {
    const sc = scrollerOf(monthRef.current);
    scroller.current = sc;
    const target: HTMLElement | Window = sc === document.scrollingElement ? window : sc;
    const read = () => {
      lastTop.current = sc.scrollTop;
    };
    read();
    target.addEventListener('scroll', read, { passive: true });
    return () => target.removeEventListener('scroll', read);
  }, []);
  const wasPicked = useRef(picked);
  useLayoutEffect(() => {
    const was = wasPicked.current;
    wasPicked.current = picked;
    if (was === null && picked !== null) returnTop.current = lastTop.current;
    else if (was !== null && picked === null && returnTop.current !== null && scroller.current) {
      const top = returnTop.current;
      returnTop.current = null;
      return glideScrollTo(scroller.current, top);
    }
  }, [picked]);

  const holds = (monthInputs.get(month)?.dayStates ?? []).map((s) => ({
    poolId: s.poolId,
    stateDate: s.stateDate,
    dayState: s.dayState,
  }));
  const rowsOf = (day: CalendarDay) => {
    const at = data.days.find((d) => d.date === day) ?? null;
    return dayRowsOf(day, {
      today: todayIso,
      poolIds: shownIds,
      poolLabel,
      namePools: pools.length > 1,
      bookings,
      blocks,
      holds,
      asking: at?.inquiryCount ?? 0,
      waiting: at?.waitlistCount ?? 0,
    });
  };
  /* No day picked: every day of the month still to come that has something on it, in order (v113 `listAll`). */
  const allDays = picked || !onClients || oneScreen
    ? []
    : data.days
        .filter((d) => d.date >= todayIso)
        .map((d) => ({ day: d.date, rows: rowsOf(d.date).filter((r) => r.kind !== 'nothing') }))
        .filter((g) => g.rows.length > 0);
  const drawRow = (r: DayRow, day: CalendarDay) => {
    const row = (
    <DatesRow
      key={r.key}
      data={r.kind}
      title={r.title}
      line={r.line || undefined}
      line2={r.line2 || undefined}
      badge={r.hours ? { tone: 'quiet', word: r.hours } : r.badge}
      href={onClients ? daySheetHref(day) : undefined}
      lead={
        r.kind === 'blocked' || r.kind === 'held' ? (
          // #28: the calendar draws a closure as the day's struck number (no hatch, no soft fill) — so does its row.
          <b
            aria-hidden
            className={`grid h-6 w-7 shrink-0 place-items-center text-[13px] font-semibold tabular-nums text-ink/45 ${r.hours ? '' : 'line-through decoration-2'}`}
            data-dates-row-day={r.hours ? 'part' : 'struck'}
          >
            {Number(day.slice(8))}
          </b>
        ) : undefined
      }
    />
    );
    if (!r.unread) return row;
    // 🗓 A refused hours read SAYS so under the plain row (approved prototype) — outside the row's link, so the press
    // means one thing. Try again re-reads the page's own month (the server reads the hours again).
    return (
      <div key={r.key} data-dates-row-hours-unread="">
        {row}
        <p role="status" className="-mt-1.5 pb-2 text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
          Couldn&rsquo;t read the hours ·{' '}
          <button
            type="button"
            className="sn-press min-h-0 font-semibold text-sn-accent underline-offset-2 hover:underline"
            disabled={rereading}
            onClick={() => startReread(() => router.refresh())}
            data-testid="dates-hours-try-again"
          >
            {rereading ? 'Reading…' : 'Try again'}
          </button>
        </p>
      </div>
    );
  };
  // 📌 A day heading pins under the pinned row, and under the week strip once it shows.
  const headTop = pinH + (folded ? 54 : 0);

  const options = scheduleScopeOptions({ pools, agents, halls });
  const scopeWords = options.find((o) => o.key === scope)?.label ?? options[0]!.label;
  // The month dropdown: last month to a year ahead (prototype: the month as a dropdown with ‹ ›).
  const base = { y: Number(todayIso.slice(0, 4)), m: Number(todayIso.slice(5, 7)) };
  const monthsOffered = Array.from({ length: 14 }, (_, i) => stepMonth(base, i - 1));
  const near = picked ? nearWord(todayIso, picked) : '';
  // 🔴 G7: a month whose held / approve-first days were refused is SAID unread — the grid alone would read it as free.
  const dayStatesUnread = monthInputs.get(month)?.dayStatesRead === false;

  return (
    <div ref={rootRef} data-dates-month={place} aria-busy={pending}>
      {/* Nothing picks a schedule ABOVE the month any more (2026-11-12): the pick is Show & sort's Schedule row and the
          chip under the month. One schedule (Clients › Dates): its one line. */}
      {onClients && !schedulesOffered(options) && pools.length === 1 && !oneScreen ? (
        <p className="mb-2 mt-1 text-[14px] font-medium text-ink" data-dates-one-schedule="">
          {halls ? 'One hall' : 'One schedule'} · {pools[0]!.capacity} {pools[0]!.capacity === 1 ? 'event' : 'events'} a day
        </p>
      ) : null}
      {dayStatesUnread ? (
        <p role="status" className="mb-2 text-[13px]" style={{ color: 'rgb(var(--color-warn))' }} data-dates-month-unread="">
          This month&rsquo;s held days couldn&rsquo;t load, so a day you held may show as open here. Reload the page to try again.
        </p>
      ) : null}
      {/* 🔦 The Dates tour's first stop — the month itself (lib/tours.ts vendor_dates_v1). */}
      <div ref={monthRef} style={{ opacity: pending ? 0.6 : 1 }} className="relative touch-pan-y overflow-x-clip transition-opacity" data-tour="dates-calendar">
        {/* Keyed by the month on show: the grid keeps its own month, so a step of the week strip across a month's edge
            (or the Schedule page's ‹ ›) must land it on the same month as the rows — not leave it on the old one. */}
        <CalendarGrid
          key={month}
          mark="box"
          value={picked}
          today={todayIso}
          startAt={`${month}-01`}
          states={states}
          onPick={toggleDay}
          onMonth={goToMonth}
          monthPicker={(view, go) => (
            <PickMenu
              label="Month"
              value={ym(view)}
              options={[
                ...(monthsOffered.some((m) => ym(m) === ym(view)) ? [] : [{ key: ym(view), label: monthTitle(view) }]),
                ...monthsOffered.map((m) => ({ key: ym(m), label: monthTitle(m) })),
              ]}
              onPick={(k) => go({ y: Number(k.slice(0, 4)), m: Number(k.slice(5, 7)) })}
              dataAttr="data-dates-month-pick"
              className="!min-h-11"
            />
          )}
          data="dates"
        />
      </div>
      {/* The Schedule month has no "asking" marks (its one read skips the shop's threads) — its legend says only what it draws. */}
      {oneScreen ? null : <CalendarLegend dots={onClients || asksRead ? ['booked', 'outside', 'asking'] : ['booked', 'outside']} blocked full mark="box" />}
      {/* 📅 THE CHIP (prototype `.chipv`): one 44px pill under the month's legend saying which schedules it marks —
          "All schedules", or "Showing · Video team schedule" — and opening the SAME choices as Show & sort's row.
          A shop with one schedule has nothing to pick, so no chip. The ONE Clients screen draws no chip (owner
          2026-11-12: "all schedules under the calendar should be inside the show and sort and remove it from the page
          under the calendar") — there the pick lives only in Show & sort's Schedule row. */}
      {schedulesOffered(options) && !oneScreen ? (
        <div className="mt-2 flex min-h-11 items-center" data-dates-schedule-chip={scope === ALL_SCHEDULES ? 'all' : 'on'}>
          <PickMenu
            label="Schedule"
            value={scope}
            options={options}
            onPick={setScope}
            buttonText={scope === ALL_SCHEDULES ? scopeWords : `Showing · ${scopeWords}`}
            dataAttr="data-dates-schedule"
            // The prototype's `.chipv`: a bordered 44px pill; narrowed (`.on`) it wears the accent border and a faint tint.
            className={`!h-11 !min-h-11 max-w-full border !pl-3.5 !pr-2.5 !text-[14px] ${
              scope === ALL_SCHEDULES ? 'border-ink/15 !bg-white dark:!bg-raised' : '!border-sn-accent !bg-sn-accent/[0.08]'
            }`}
          />
        </div>
      ) : null}

      {/* 📌 THE WEEK STRIP (v13 `.weekstrip`): the picked day's week, ‹ › a day. Drawn always, shown only once folded —
          height and opacity glide, so the page under it never jumps; hidden from the tab order while folded away. */}
      <div
        ref={stripRef}
        className={`sticky z-[4] -mx-4 flex touch-pan-y items-center gap-1 overflow-hidden px-2 transition-[height,opacity] duration-300 motion-reduce:transition-none sm:-mx-6 sm:px-4 lg:-mx-8 lg:px-6 ${
          folded ? 'h-[54px] sn-pin-hair opacity-100' : 'pointer-events-none h-0 opacity-0'
        }`}
        style={{ background: 'var(--sn-canvas)' }}
        aria-hidden={!folded}
        inert={!folded}
        data-dates-week-strip={folded ? 'shown' : 'folded-away'}
      >
        <button type="button" className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" aria-label="A day earlier" onClick={() => stepDay(-1)} data-dates-step="-1">
          <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
        <div className="relative flex min-w-0 flex-1 gap-1" data-dates-week-days="">
        {week.map((d) => {
          const inMonth = d.slice(0, 7) === month;
          const st = inMonth ? states.get(d) : undefined;
          const on = d === picked;
          const dot = st?.dots?.includes('asking') ? 'rgb(var(--color-warn))' : st?.dots?.length ? 'rgb(var(--color-ok))' : null;
          return (
            <button
              key={d}
              type="button"
              // #37: the ONE picked mark (the number's ink box) — today's thin ring, a blocked day struck through.
              className={`sn-press relative grid h-11 min-w-0 flex-1 content-center justify-items-center rounded-md text-[13.5px] leading-tight tabular-nums text-ink ${
                d === todayIso && !on ? 'ring-[1.5px] ring-inset ring-ink/[0.34]' : ''
              } ${st?.blocked && !on ? 'text-ink/45' : ''}`}
              aria-pressed={on}
              aria-label={dayLongWords(d)}
              onClick={() => (inMonth ? toggleDay(d) : goToMonth({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) }, d))}
              data-dates-week-day={d}
            >
              <small className="text-[9.5px] leading-none text-ink/55">{'SMTWTFS'[new Date(`${d}T00:00:00Z`).getUTCDay()]}</small>
              <span className={`justify-self-center ${st?.full || on ? 'font-bold' : ''}`}>
                <DayBox on={on} struck={st?.blocked === true}>
                  {Number(d.slice(8))}
                </DayBox>
              </span>
              {dot ? <i aria-hidden className="absolute bottom-0.5 block h-1 w-1 rounded-full" style={{ background: dot }} /> : null}
            </button>
          );
        })}
        </div>
        <button type="button" className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" aria-label="A day later" onClick={() => stepDay(1)} data-dates-step="1">
          <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {between}

      {/* Schedule (v113 `calC`): the month marks the event's day; the schedule follows — no day rows of the shop here. */}
      {!onClients ? null : picked ? (
        <>
          {/* The picked day: its long date and "Open the day ›", then what is on it (prototype datesBody). */}
          <div className="mt-4 flex min-h-11 items-center gap-3" data-dates-picked-head="">
            <span className="home-k2 min-w-0 flex-1 truncate" data-dates-picked={picked}>
              {dayHeadWords(picked, todayIso)}
              {near === 'Today' ? ' · today' : ''}
            </span>
            {onClients ? (
              <Link href={daySheetHref(picked)} scroll className="sn-press inline-flex min-h-11 flex-none items-center gap-1 text-[14px] font-semibold text-sn-accent" data-dates-open-day="">
                Open the day
                <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
            ) : null}
            {oneScreen ? (
              // v118 `.dh1 .dx`: the × lets the day go — back to the whole list (tapping the day again does too).
              <button
                type="button"
                className="sn-press grid h-11 w-11 flex-none place-items-center rounded-full text-ink/70"
                aria-label="Back to every day"
                onClick={() => setPicked(null)}
                data-dates-let-go=""
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={2} />
              </button>
            ) : null}
          </div>
          {/* 📅 THE DAY BAR (v113 `.dayact`): Accept bookings + Book a client, for the picked day. */}
          {dayActions && onClients ? <DayBar day={picked} today={todayIso} blocks={blocks} actions={dayActions} onFlip={onFlip} /> : null}
          <div data-dates-rows="">{rowsOf(picked).map((r) => drawRow(r, picked))}</div>
        </>
      ) : oneScreen ? null : (
        <div className="mt-4" data-dates-all-days="">
          {allDays.length === 0 ? (
            <p className="py-3 text-[14px] text-ink/70" data-dates-all-empty="">
              Nothing booked, asked or closed for the rest of {monthTitle({ y: Number(month.slice(0, 4)), m: Number(month.slice(5, 7)) })}.
            </p>
          ) : (
            allDays.map((g) => (
              <section key={g.day} data-dates-day-group={g.day}>
                {/* 📌 STICKY DAY HEADING (v113): the day's name stays at the top while its rows scroll under it. */}
                <h3
                  className="sticky z-[3] -mx-4 my-0 flex min-h-10 items-center px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/60 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
                  style={{ top: headTop, background: 'var(--sn-canvas)' }}
                  data-dates-day-heading={g.day}
                >
                  <button type="button" className="sn-press min-h-10 text-left" onClick={() => setPicked(g.day)} data-dates-heading-pick={g.day}>
                    {dayHeadWords(g.day, todayIso)}
                    {nearWord(todayIso, g.day) === 'Today' ? ' · today' : ''}
                  </button>
                </h3>
                {g.rows.map((r) => drawRow(r, g.day))}
              </section>
            ))
          )}
        </div>
      )}
      {after}
    </div>
  );
}

