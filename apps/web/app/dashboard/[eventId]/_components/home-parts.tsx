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
import { createContext, useCallback, useContext, useEffect, useId, useState, useTransition, type ReactNode } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Check, ChevronRight, Eye, Mail, PenLine, Plus, RotateCw, SlidersHorizontal } from 'lucide-react';
import type { FaceIcon, HomeNowAction } from './home-control-faces';
import { planningRowAction } from '../checklist-actions';
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
 * ☀ NOW — THE EVENT CARD'S ONE THING TO DO (owner-approved Home redraw 2026-11-02, round 3,
 * `prototypes/home_controller_2026-11-02/` `.ecard .now`): the Today line moved INTO the card, under the countdown — the
 * kicker "Now", the words, and ONE filled button with its verb that opens the one place that settles it (Pay → that
 * payment, Answer → the request, Done → ticks the overdue task in place). Papic and Setnayan AI keep their controls on
 * Home, so their button points at the widget (scroll + a 1.8 s ring). Calm (nothing waits): the words alone, no button.
 * `data-home-today` keeps the target, so a walk still reads what Now names.
 */
export function HomeToday({
  target,
  words,
  tail,
  calm,
  action = null,
  eventId,
}: {
  target: string;
  words: string;
  tail: string;
  calm: boolean;
  action?: HomeNowAction | null;
  eventId?: string;
}) {
  const f = useContext(TodayFold);
  const router = useContext(AppRouterContext);
  const [ticked, setTicked] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (f?.folded) {
    return (
      <p className="hc-now hc-today-later" data-home-today="later" role="status">
        <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.9} />
        <span>Back tomorrow</span>
        <span aria-hidden>·</span>
        <button type="button" onClick={f.undo} className="font-medium" data-testid="home-today-undo">
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
  // ✅ Done on the overdue task — Planning Stage's own write (`planningRowAction`, op tick-*); a refusal is said.
  const tick = () => {
    const t = action?.tick;
    if (!t || !eventId) return;
    setRefused(null);
    setTicked(true);
    const fd = new FormData();
    fd.set('op', t.kind === 'task' ? 'tick-task' : 'tick-step');
    fd.set('event_id', eventId);
    fd.set('item_id', t.id);
    fd.set('desired', 'done');
    start(async () => {
      const r = await planningRowAction(fd).catch(() => ({ ok: false as const, error: 'This did not save. Try again.' }));
      if (!r.ok) {
        setTicked(false);
        setRefused(r.error);
      }
    });
  };
  const Icon = action ? NOW_ICONS[action.icon] : null;
  const button =
    action && Icon ? (
      action.tick ? (
        <ActionButton tone="brand" main icon={Icon} label={ticked ? 'Done ✓' : action.verb} name={`${words} — ${action.verb}`} onClick={tick} disabled={pending || ticked} data-testid="home-now-tick" />
      ) : action.point ? (
        <ActionButton tone="brand" main icon={Icon} label={action.verb} name={`${words} — show it`} onClick={point} data-testid="home-now-point" />
      ) : action.href ? (
        <ActionButton tone="brand" main icon={Icon} label={action.verb} name={`${words} — ${action.verb}`} href={action.href} data-testid="home-now-door" />
      ) : (
        <ActionButton
          tone="brand"
          main
          icon={Icon}
          label={action.verb}
          name={`${words} — ${action.verb}`}
          // one-render: keep (retry) — Now says a read failed; the person asks for the reads again. No write came before it.
          onClick={() => (router ? router.refresh() : window.location.reload())}
          data-testid="home-now-reload"
        />
      )
    ) : null;
  return (
    <div className={`hc-now${calm ? ' hc-calm' : ''}`} data-home-today={target} data-tour="home-today" role="group" aria-label={`Now: ${words}${tail ? ` · ${tail}` : ''}`}>
      <span className="hc-now-k">Now</span>
      <span className="hc-now-t">
        {refused ? <span role="alert">{refused}</span> : words}
        {!refused && tail ? <span className="hc-now-w"> · {tail}</span> : null}
      </span>
      {button}
    </div>
  );
}

const NOW_ICONS: Record<FaceIcon, typeof ArrowRight> = {
  mail: Mail,
  plus: Plus,
  check: Check,
  pay: ArrowRight,
  reload: RotateCw,
  pen: PenLine,
  eye: Eye,
  cal: CalendarDays,
  sliders: SlidersHorizontal,
};

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
