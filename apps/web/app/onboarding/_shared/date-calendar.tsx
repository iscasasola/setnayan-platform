/**
 * THE CELEBRATION-DATE CALENDAR — shared by every onboarding flow.
 *
 * ── WHY THIS FILE EXISTS (owner, 2026-08-21) ────────────────────────────────
 * *"our date of celebration should have that calendar with the hot date legend.
 * as before, but i do not see that on the on boarding of any event. We used to
 * allow multiple single dates and a 30 days range date."*
 *
 * He is right, and the cause was WIRING, not a missing feature. This calendar
 * — up to 4 candidate dates, a range capped at 30 days, and the predicted
 * demand ("hot date") tint — has shipped since 2026-06-09 (PR #1167). It was
 * declared INSIDE the 3,800-line wedding onboarding shell, so it could only
 * ever appear on a wedding. Every other event type reached
 * `/onboarding/[type]`, which asked for ONE date in a plain box and then hard-
 * coded `dateMode:'specific'`, one candidate and a null window on commit —
 * even though the commit payload had carried all four fields the whole time.
 *
 * So this file MOVES the component; it does not redraw it. The wedding markup
 * is byte-identical (`chrome: 'wedding'` is the default and reproduces the
 * .viewzone/.tapzone skeleton the wedding stylesheet expects).
 *
 * ── THE STYLING TRAP, WHICH IS WRITTEN DOWN AND WAS PAID ONCE ───────────────
 * DECISION_LOG 2026-07-12 records it: reusing a wedding onboarding component
 * elsewhere "would ship UNSTYLED (its classes are `.onbw`-scoped to the
 * onboarding-only stylesheet)". So the calendar's rules move with it, into
 * `date-calendar.css`, re-scoped to `.sn-datecal` — a class the root carries in
 * BOTH flows. The rules are MOVED, not copied: there is one source, so the two
 * flows cannot drift.
 *
 * ⚠ `.onbw` CANNOT be reused as the scope. That class is not a namespace — it
 * paints a full-height flex page (`background:#E9E6DF; min-height:100vh;
 * display:flex`). Wrapping the generic date screen in it would repaint the
 * whole screen.
 *
 * ── ONE JUDGEMENT CALL, FLAGGED ────────────────────────────────────────────
 * `heatTier` is tuned for WEDDINGS (Saturday prime, Dec/Jan/Feb/Nov peak,
 * repeating MM·DD, Valentine's). Those pressures are real for any Philippine
 * celebration that hires suppliers, so the same ramp now shows on every type
 * rather than none. If a type deserves its own curve, that is a product
 * decision and a new tier function — not a reason to leave the calendar off.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import './date-calendar.css';

/**
 * What the calendar reports upward. Structurally the same four fields the
 * wedding shell's `OnboardingState` already carries and the generic flow's
 * commit payload has ALWAYS carried — the generic flow simply hard-coded them
 * to one date and a null window. Declared here so the shared component does
 * not depend on either flow's state type.
 */
export type DateCalendarValue = {
  dateMode?: 'specific' | 'window';
  dateCandidates?: string[];
  windowStart?: string | null;
  windowEnd?: string | null;
};

/* ── date helpers (prototype initCal) ── */
const DAY = 86400000;
export const MAXSPAN = 29;
export const MAXMULTI = 4;
const CLUSTER = 90;
export const M_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromISO = (s: string) => {
  const p = s.split('-').map(Number);
  return new Date(p[0] ?? 1970, (p[1] ?? 1) - 1, p[2] ?? 1);
};
const fmtFull = (d: Date) => `${M_FULL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
const fmtShort = (d: Date) => `${(M_FULL[d.getMonth()] ?? '').slice(0, 3)} ${d.getDate()}`;
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);

/* ── predicted demand "heat" (deterministic · cold-start-safe · spec Date-Aligner §L.1).
   Stacks the calendar signals (peak month · weekday ·
   repeating/symbolic) into a 0–4 tier driving the cell colour ramp. This is the PREDICTED half only — the observed
   inquiry/relative-to-supply escalation (§L.2) is deferred until the marketplace has
   inquiry data (founder-only today → it would be dead code). Mirrors the verified
   prototype Hot_Date_Heat_Calendar_Prototype_2026-06-09.html. */
const HEAT_PEAK: Record<number, number> = { 11: 2, 0: 2, 1: 2, 10: 2, 3: 1, 4: 1, 9: 1 }; // getMonth() idx: Dec/Jan/Feb/Nov=2 · Apr/May/Oct=1
export function heatTier(d: Date): 0 | 1 | 2 | 3 | 4 {
  const m = d.getMonth();
  const dow = d.getDay();
  const n = d.getDate();
  let s = HEAT_PEAK[m] ?? 0;
  if (dow === 6) s += 2; // Saturday — the prime wedding day
  else if (dow === 5 || dow === 0) s += 1; // Friday / Sunday
  if (m + 1 === n) s += 2; // repeating MM·DD (12/12, 11/11…)
  if (m === 1 && n === 14) s += 2; // Valentine's
  if (dow === 6 && m + 1 === n) s += 1; // Saturday + repeating combo
  return s <= 0 ? 0 : s <= 2 ? 1 : s === 3 ? 2 : s <= 5 ? 3 : 4;
}

/* ── DATE CALENDAR — port of the prototype initCal() IIFE ──
 * Working state (multi / window / view month) lives locally; the captured
 * values (dateMode + dateCandidates + windowStart/End) are lifted to the parent
 * via onChange so they persist + Phase 4 can commit them. */
export function DateCalendar({
  mode,
  candidates,
  windowStart,
  windowEnd,
  onChange,
  chrome = 'wedding',
  eyebrow = 'Your wedding',
  title = 'When\u2019s the big day?',
}: {
  mode: 'specific' | 'window';
  candidates: string[];
  windowStart: string | null;
  windowEnd: string | null;
  onChange: (p: DateCalendarValue) => void;
  /**
   * 'wedding' reproduces the .viewzone/.tapzone skeleton the wedding
   * stylesheet expects — the DEFAULT, so that flow is unchanged. 'bare'
   * renders the calendar alone, for a flow that supplies its own heading and
   * page chrome (the generic onboarding already asks the question above it).
   */
  chrome?: 'wedding' | 'bare';
  /** Wedding-only chrome words. A birthday must not be told "Your wedding". */
  eyebrow?: string;
  title?: string;
}) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const maxD = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + 3);
    return d;
  }, [today]);
  const minD = today;

  /* seed: a date ~6 months out (clamped), used when nothing is picked yet */
  const seed = useMemo(() => {
    const s = new Date(today);
    s.setMonth(s.getMonth() + 6);
    return s > maxD ? new Date(maxD) : s;
  }, [today, maxD]);

  /* working state — seeded once from props (resume), then local source of truth */
  const [multi, setMulti] = useState<Date[]>(() =>
    candidates.length ? candidates.map(fromISO) : [],
  );
  /**
   * ── THE PROP IS ALLOWED TO SPEAK AFTER MOUNT ───────────────────────────────
   *
   * 🔴 `multi` is seeded ONCE and was then the sole source of truth, so a
   * `candidates` prop that changed later was IGNORED. That is the deeper half of
   * the 2026-08-28 defect: even once the day chips were taught to write the
   * candidate list, the calendar would have gone on drawing what it had at
   * mount. **The chip would still have appeared to do nothing.**
   *
   * 🔑 THIS CANNOT LOOP, and the reason is structural rather than a guard: every
   * local click `lift`s the new list upward, so the parent's value and this
   * state are already equal by the time the prop comes back — the comparison is
   * a no-op on the path a person actually takes. It differs only when something
   * OUTSIDE the calendar changed the answer, which is exactly when the calendar
   * should redraw.
   *
   * ⚖ IT ADOPTS, IT NEVER LIFTS. Writing back from here would let a mounting
   * calendar rewrite its parent's state, which is how a "sync" turns into a
   * second author. Reading is safe; writing is not.
   */
  const lastAdopted = useRef(candidates.join('|'));
  useEffect(() => {
    const incoming = candidates.join('|');
    if (incoming === lastAdopted.current) return;
    lastAdopted.current = incoming;
    setMulti(candidates.map(fromISO));
  }, [candidates]);

  const [rStart, setRStart] = useState<Date | null>(() => (windowStart ? fromISO(windowStart) : null));
  const [rEnd, setREnd] = useState<Date | null>(() => (windowEnd ? fromISO(windowEnd) : null));
  const [pickingEnd, setPickingEnd] = useState(false);
  const [view, setView] = useState(() => {
    const base = candidates.length ? fromISO(candidates[0]!) : windowStart ? fromISO(windowStart) : seed;
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  const clampMax = (d: Date) => (d > maxD ? new Date(maxD) : d);
  const atMin = view.y === minD.getFullYear() && view.m === minD.getMonth();
  const atMax = view.y === maxD.getFullYear() && view.m === maxD.getMonth();

  /* push captured values up (persist + Phase-4 commit). */
  const lift = useCallback(
    (m: Date[], rs: Date | null, re: Date | null) => {
      const sorted = [...m].sort((a, b) => a.getTime() - b.getTime());
      onChange({
        dateCandidates: sorted.map(toISO),
        windowStart: rs ? toISO(rs) : null,
        windowEnd: re ? toISO(re) : null,
      });
    },
    [onChange],
  );

  const setMode = (m: 'specific' | 'window') => {
    // Switching to the flexible window seeds a starter range to nudge (responds to
    // the explicit mode choice). Specific mode never auto-seeds a date — the screen
    // opens with nothing selected (owner 2026-06-05: no prefilled onboarding values).
    if (m === 'window' && !rStart) {
      const s = new Date(seed);
      const e = clampMax(new Date(seed.getTime() + 13 * DAY));
      setRStart(s);
      setREnd(e);
      setPickingEnd(false);
      lift(multi, s, e);
    }
    onChange({ dateMode: m });
  };

  const clickDay = (cur: Date) => {
    if (mode === 'specific') {
      const k = keyOf(cur);
      const idx = multi.findIndex((d) => keyOf(d) === k);
      let next: Date[];
      if (idx >= 0) next = multi.filter((_, i) => i !== idx);
      else if (multi.length < MAXMULTI) next = [...multi, new Date(cur)];
      else next = multi;
      setMulti(next);
      lift(next, rStart, rEnd);
      return;
    }
    if (!pickingEnd) {
      setRStart(cur);
      setREnd(null);
      setPickingEnd(true);
      lift(multi, cur, null);
      return;
    }
    if (rStart && cur <= rStart) {
      setRStart(cur);
      setREnd(null);
      lift(multi, cur, null);
      return;
    }
    const span = rStart ? daysBetween(rStart, cur) : 0;
    let end = cur;
    if (rStart && span > MAXSPAN) end = clampMax(new Date(rStart.getTime() + MAXSPAN * DAY));
    setREnd(end);
    setPickingEnd(false);
    lift(multi, rStart, end);
  };

  const prevMonth = () => {
    if (atMin) return;
    setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  };
  const nextMonth = () => {
    if (atMax) return;
    setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));
  };

  /* ── derived: grid cells ── */
  const sorted = [...multi].sort((a, b) => a.getTime() - b.getTime());
  let clo = minD;
  let chi = maxD;
  let locked = false;
  if (mode === 'specific' && multi.length >= 1) {
    const ts = multi.map((d) => d.getTime());
    clo = new Date(Math.max(minD.getTime(), Math.max(...ts) - CLUSTER * DAY));
    chi = new Date(Math.min(maxD.getTime(), Math.min(...ts) + CLUSTER * DAY));
    locked = multi.length >= MAXMULTI;
  }
  const first = new Date(view.y, view.m, 1).getDay();
  const dim = new Date(view.y, view.m + 1, 0).getDate();
  const cells: { d?: number; cur?: Date; cls: string; disabled: boolean }[] = [];
  for (let i = 0; i < first; i++) cells.push({ cls: 'calday empty', disabled: true });
  for (let d = 1; d <= dim; d++) {
    const cur = new Date(view.y, view.m, d);
    const isPicked = mode === 'specific' && multi.some((x) => keyOf(x) === keyOf(cur));
    let disabled = cur < minD || cur > maxD;
    if (mode === 'specific' && !disabled && !isPicked) {
      if (locked) disabled = true;
      else if (multi.length >= 1 && (cur < clo || cur > chi)) disabled = true;
    }
    let cls = 'calday';
    if (disabled) cls += ' disabled';
    if (keyOf(cur) === keyOf(today)) cls += ' today';
    if (mode === 'specific') {
      if (isPicked) cls += ' sel';
    } else if (rStart) {
      if (keyOf(cur) === keyOf(rStart)) cls += ' rstart';
      if (rEnd && keyOf(cur) === keyOf(rEnd)) cls += ' rend';
      if (rEnd && cur > rStart && cur < rEnd) cls += ' inrange';
    }
    // predicted-demand heat tint — only on enabled, non-selected, non-range cells
    // (selection/range mulberry fill always wins). tier 0 = no tint.
    const ht = heatTier(cur);
    if (ht > 0 && !disabled && !/\b(sel|rstart|rend|inrange)\b/.test(cls)) cls += ` heat-${ht}`;
    cells.push({ d, cur, cls, disabled });
  }


  let pickHtml: ReactNode;
  let warn: string | null = null;
  if (mode === 'specific') {
    if (multi.length === 0) {
      pickHtml = 'Pick your date — or up to 4 within 3 months';
    } else if (multi.length === 1) {
      const dd = daysBetween(today, sorted[0]!);
      pickHtml = (
        <>
          Your date: <b>{fmtFull(sorted[0]!)}</b> · {dd <= 0 ? 'today' : `${dd} days`}{' '}
          <span className="addhint">· or add up to 3 nearby</span>
        </>
      );
    } else {
      const lk = multi.length >= MAXMULTI;
      pickHtml = (
        <>
          Your dates: <b>{sorted.map(fmtShort).join(' · ')}</b>{' '}
          <span className="addhint">· {lk ? '4 set' : `add ${MAXMULTI - multi.length} more`}</span>
        </>
      );
      if (lk) warn = '4 dates set — tap one to swap.';
    }
  } else if (!rEnd) {
    pickHtml = (
      <>
        Window start: <b>{rStart ? fmtFull(rStart) : '—'}</b> · tap an end date
      </>
    );
  } else if (rStart) {
    const span = daysBetween(rStart, rEnd) + 1;
    pickHtml = (
      <>
        Your window: <b>{fmtShort(rStart)} – {fmtShort(rEnd)}</b> · {span} days{' '}
        <span className="addhint">· we find the shared date</span>
      </>
    );
  }

  const setRangeMsg =
    mode === 'specific'
      ? 'Up to 4 dates within ~3 months — we lock the one all your vendors share.'
      : 'Tap a start + end (≤30 days) — we lock the shared date inside it.';

  const hint = chrome === 'wedding' ? 'micro' : 'sn-datecal-hint';

  const inner = (
    <>
      <div className="calpick">{pickHtml}</div>
      {warn && <div className="rangewarn">{warn}</div>}
      <div className={hint}>{setRangeMsg}</div>
      <div className="calmode">
        <button type="button" className={mode === 'specific' ? 'on' : undefined} onClick={() => setMode('specific')}>
          Specific dates<span className="ms">1–4 days</span>
        </button>
        <button type="button" className={mode === 'window' ? 'on' : undefined} onClick={() => setMode('window')}>
          Flexible window<span className="ms">a range</span>
        </button>
      </div>
      <div className="cal">
        <div className="calhead">
          <button className="calnav" type="button" onClick={prevMonth} disabled={atMin} aria-label="Previous month">‹</button>
          <div className="calmonth">{M_FULL[view.m]} {view.y}</div>
          <button className="calnav" type="button" onClick={nextMonth} disabled={atMax} aria-label="Next month">›</button>
        </div>
        <div className="caldow"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div>
        <div className="calgrid">
          {cells.map((c, i) =>
            c.d == null ? (
              <div key={`e${i}`} className={c.cls} />
            ) : (
              <button
                key={`d${i}`}
                type="button"
                className={c.cls}
                disabled={c.disabled}
                aria-pressed={c.cls.split(' ').some((t) => t === 'sel' || t === 'rstart' || t === 'rend')}
                onClick={() => c.cur && clickDay(c.cur)}
              >
                {c.d}
              </button>
            ),
          )}
        </div>
      </div>
      {/* THE LEGEND. The tint has been on these cells since 2026-06-09 with
          nothing anywhere saying what it meant — the owner calls it "the hot
          date legend", which is the name of a thing you can READ. A colour
          ramp nobody can decode is decoration. */}
      <ul className="sn-datecal-legend" aria-label="What the shading means">
        <li><span className="swatch heat-0" aria-hidden />Open</li>
        <li><span className="swatch heat-1" aria-hidden />Quiet</li>
        <li><span className="swatch heat-2" aria-hidden />Popular</li>
        <li><span className="swatch heat-3" aria-hidden />In demand</li>
        <li><span className="swatch heat-4" aria-hidden />Hottest</li>
      </ul>
      <p className="sn-datecal-legendnote">
        Shading shows how busy suppliers usually are. A quieter day often costs
        less and gives you more choice.
      </p>
    </>
  );

  if (chrome === 'bare') return <div className="sn-datecal">{inner}</div>;

  return (
    <>
      {/* viewzone — title only; the "why these dates" nugget was removed (owner 2026-06-21: clear question, clear answer, no side notes) */}
      <div className="viewzone">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="q">{title}</h1>
      </div>
      <div className="tapzone sn-datecal">{inner}</div>
    </>
  );
}
