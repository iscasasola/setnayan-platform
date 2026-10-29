'use client';

/**
 * home-parts.tsx — the few pieces of the couple's Home that need the browser. Everything else on Home stays a server
 * component (`home-first-screen.tsx`, `home-control-row.tsx`).
 *
 *   HomeTodayFold / HomeToday — THE TODAY LINE (owner-approved 2026-10-24, `home_control_center_2026-10-24_fable.html`,
 *                    option A): one line on top naming the ONE thing to do now — the shipped picker's choice
 *                    (`pickHomeNext`) — and a POINTER, not a door: a tap scrolls Home to the widget it names and rings
 *                    it for a moment. It replaces the "Your next step" card (removed with the aggregate What's next).
 *   HomeLater      — "Later" folds the Today line to "Back tomorrow · Undo", for today, on this device. No server
 *                    write (opening never writes; +0 server actions).
 *   HomeReload     — "⟳ Reload": re-runs the page's reads (`router.refresh()`).
 *   HomeTodayItem  — ONE MORE LINE OF THE TODAY LIST (owner 2026-10-29: *"The popup for the access and other popups
 *                    above the header can be presented better"*): every prompt Home used to stack ABOVE the cover is
 *                    now a line here, under it, in the Today line's own pill — a door (`href`) or a press that opens
 *                    the house Sheet (`onPress`). Action-needed lines sort before the Today line.
 *   TodaySheetItem — a Today item whose answer is more than one press: the line opens the house Sheet holding the
 *                    caller's own body (the date change's suppliers and choices).
 *
 *   (The Next card, its fold and the What's next row were REMOVED 2026-10-24 — the verb now sits on the widget it is
 *    about, and the Checklist widget holds only the plan.)
 */
import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import Link from 'next/link';
import { ArrowDown, CalendarDays, ChevronRight, RotateCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';

/* ─── Later — folds the Today line for today, on this device ──────────────── */

function todayKey(eventId: string, kind: string): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `home-later:${eventId}:${kind}:${day}`;
}

type Fold = { folded: boolean; fold: () => void; undo: () => void };
const TodayFold = createContext<Fold | null>(null);

/**
 * 📅 The Today line's fold (owner 2026-10-23: *"Later collapses to 'Back tomorrow · Undo'"*), shared by the line and the
 * Later beside the verb it names. Device storage only: a private window or a cleared site simply shows the line again,
 * which is the safe direction. Keyed on the picker's KIND, so tomorrow — or a different thing to do — shows again.
 */
export function HomeTodayFold({ eventId, kind, children }: { eventId: string; kind: string; children: ReactNode }) {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(todayKey(eventId, kind)) === '1') setFolded(true);
    } catch {
      /* storage refused — the line stays, which is the honest default */
    }
  }, [eventId, kind]);
  const fold = useCallback(() => {
    try {
      window.localStorage.setItem(todayKey(eventId, kind), '1');
    } catch {
      /* storage refused — folded for this visit only */
    }
    setFolded(true);
  }, [eventId, kind]);
  const undo = useCallback(() => {
    try {
      window.localStorage.removeItem(todayKey(eventId, kind));
    } catch {
      /* nothing stored — nothing to clear */
    }
    setFolded(false);
  }, [eventId, kind]);
  return <TodayFold.Provider value={{ folded, fold, undo }}>{children}</TodayFold.Provider>;
}

/** The widget the line names, as it is drawn at this width (the compact tile below md, the card from md up). */
function visibleTarget(target: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-home-tile="${target}"], [data-home-card-key="${target}"], [data-home-service="${target}"]`);
  for (const el of all) if (el.offsetParent !== null || el.getClientRects().length > 0) return el;
  return null;
}

/**
 * ☀ THE TODAY LINE — one line high, on top. A pointer: it scrolls to and spotlights the widget it names (1.8 s ring),
 * never opens another page. Calm (green) when nothing waits.
 */
export function HomeToday({ target, words, tail, calm }: { target: string; words: string; tail: string; calm: boolean }) {
  const f = useContext(TodayFold);
  if (f?.folded) {
    return (
      <p className="hc-today-later" data-home-today="later" role="status">
        <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.9} />
        <span>Back tomorrow</span>
        <span aria-hidden>·</span>
        <button type="button" onClick={f.undo} className="font-medium text-mulberry" data-testid="home-today-undo">
          Undo
        </button>
      </p>
    );
  }
  const point = () => {
    const el = visibleTarget(target);
    if (!el) return;
    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* no matchMedia */
    }
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    el.setAttribute('data-home-spot', '');
    window.setTimeout(() => el.removeAttribute('data-home-spot'), 1800);
  };
  return (
    <button
      type="button"
      className={`hc-today${calm ? ' hc-calm' : ''}`}
      data-home-today={target}
      data-tour="home-today"
      onClick={point}
      aria-label={`Today: ${words}${tail ? ` · ${tail}` : ''} — show it`}
    >
      <span className="hc-today-k">Today</span>
      <span className="hc-today-t">
        {words}
        {tail ? <span className="hc-today-w"> · {tail}</span> : null}
      </span>
      <span className="hc-today-arrow" aria-hidden>
        <ArrowDown strokeWidth={1.9} />
      </span>
    </button>
  );
}

/**
 * ☀ A TODAY ITEM — the Today line's pill, for a prompt that waits on the hosts (owner 2026-10-29). Unlike the Today line
 * it WRAPS (`hc-today-item`): a shop's full name is never cut. `href` = a door to the page that answers it; `onPress` =
 * the caller opens its house Sheet. `tone`: `ask` waits on you (the Today kicker's mulberry), `warn` a read that failed
 * (said, never silent), `calm` done. Server-safe props only when `href` is used (the doorways are server components).
 */
export function HomeTodayItem({
  words,
  tail,
  kicker = 'Today',
  tone = 'ask',
  href,
  onPress,
  reload = false,
  disabled = false,
  dataAttr,
}: {
  words: string;
  tail?: string | null;
  kicker?: string;
  tone?: 'ask' | 'warn' | 'calm';
  href?: string;
  onPress?: () => void;
  /** A read that failed: the press runs the page's reads again (as ⟳ Reload does) — usable from a server component. */
  reload?: boolean;
  disabled?: boolean;
  /** One `data-*` hook for tests and walks, e.g. `['data-coordinator-level', 'ask']`. */
  dataAttr?: readonly [string, string];
}) {
  const router = useContext(AppRouterContext);
  const cls = `hc-today hc-today-item${tone === 'calm' ? ' hc-calm' : tone === 'warn' ? ' hc-warn' : ''}`;
  const data = dataAttr ? { [dataAttr[0]]: dataAttr[1] } : {};
  const body = (
    <>
      <span className="hc-today-k">{kicker}</span>
      <span className="hc-today-t">
        {words}
        {tail ? <span className="hc-today-w"> · {tail}</span> : null}
      </span>
      <span className="hc-today-arrow" aria-hidden>
        <ChevronRight strokeWidth={1.9} />
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} data-home-today-item="" {...data}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      data-home-today-item=""
      // one-render: keep (retry) — a Today line whose read failed, pressed by the person; no write came before it.
      onClick={reload ? () => (router ? router.refresh() : window.location.reload()) : onPress}
      disabled={disabled}
      aria-busy={disabled || undefined}
      {...data}
    >
      {body}
    </button>
  );
}

/**
 * ☀ A TODAY ITEM THAT OPENS THE HOUSE SHEET — for a prompt whose answer is more than one press (a date change's
 * suppliers, keep waiting · drop · withdraw). The line is the Today pill; the body is the caller's own, unchanged,
 * inside the shared `Sheet` (bottom on a portrait phone, the right panel from the couple dashboard's `tab:` line up).
 * Server-rendered children (forms posting server actions) are fine: the Sheet only holds them.
 */
export function TodaySheetItem({
  words,
  tail,
  tone = 'ask',
  title,
  dataAttr,
  children,
}: {
  words: string;
  tail?: string | null;
  tone?: 'ask' | 'warn' | 'calm';
  /** The sheet's heading (its ⓘ is the caller's). */
  title: string;
  dataAttr?: readonly [string, string];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <>
      <HomeTodayItem words={words} tail={tail} tone={tone} onPress={() => setOpen(true)} dataAttr={dataAttr} />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
        <div className="px-4 pb-4 pt-3.5">
          <h3 id={headingId} className="pr-12 text-[19px] font-semibold tracking-tight text-ink">
            {title}
          </h3>
          <div className="mt-3">{children}</div>
        </div>
      </Sheet>
    </>
  );
}

/** 📅 Later — beside the verb the Today line names; folds the line for today. */
export function HomeLater() {
  const f = useContext(TodayFold);
  return <ActionButton tone="neutral" icon={CalendarDays} label="Later" data-testid="home-today-later" onClick={() => f?.fold()} />;
}

/** "⟳ Reload" — runs the page's reads again. Never claims the read worked. */
export function HomeReload({ main = false }: { main?: boolean }) {
  // Read the router's context rather than `useRouter()`, which throws outside the app
  // router (a render test, the dev lab's static paint). No router → reload the page,
  // which re-runs the reads too.
  const router = useContext(AppRouterContext);
  return (
    <ActionButton
      tone="neutral"
      main={main}
      icon={RotateCw}
      label="Reload"
      data-testid="home-reload"
      // one-render: keep (retry) — the person’s Reload on a Home that could not be read; no write came before it.
      onClick={() => (router ? router.refresh() : window.location.reload())}
    />
  );
}
