'use client';

/**
 * home-parts.tsx — the few pieces of the couple's Home that need the browser
 * (owner 2026-10-07, PR 4e — `prototypes/home_and_guests_2026-10-07_fable.html`
 * `?frame=1&page=home`, `HOME_AND_GUESTS_CHECK_2026-10-07_fable.md` H1–H8).
 * Everything else on the Home stays a server component (`home-first-screen.tsx`).
 *
 *   HomeDoorways   — the three doorway buttons (H1a, owner: *"on home, there will
 *                    be 3 buttons to edit guests, suppliers and event hub"*), each
 *                    wearing THE BOTTOM BAR'S OWN ICON for the tab it opens (owner:
 *                    *"it will have an icon that should be similar to the bottom
 *                    nav"*): `homeDoorwayIcon` (PR 4g, lib/nav-line-icon.ts) —
 *                    the same registry slot (`customer.bottom-nav.<key>`) and the
 *                    same line-only rule the bar uses, so whatever icon the bar
 *                    wears, the door wears, with no second list. The row changes
 *                    state AS ONE (BUTTON_RULE 3a): icon + word → word → icon.
 *   HomeLater      — "Later": hides today's next step for today, on this device.
 *                    No server write (opening never writes; +0 server actions).
 *   HomeReload     — "⟳ Reload": re-runs the page's reads (`router.refresh()`).
 *   HomeWhatsNext  — the What's next row: pop, then unfold IN PLACE under it (H7)
 *                    — no `?sheet=next` portal, no URL change.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CalendarDays, Check, ChevronDown, CreditCard, ListChecks, RotateCw, Sparkles, UserRound, CalendarCheck } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Count } from '@/components/count';
import { homeDoorwayIcon, type HomeDoorwayKey } from '@/lib/nav-line-icon';
import type { NavSlotLite } from '@/lib/nav-registry-types';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/* ─── The doorway row ─────────────────────────────────────────────────────── */

/** The three bottom-bar tabs a doorway opens — the bar's own keys (4g's `HomeDoorwayKey`). */
export type HomeDoorKey = HomeDoorwayKey;

const DOORS: ReadonlyArray<{ key: HomeDoorKey; label: string; path: string }> = [
  { key: 'guests', label: 'Edit your Guest list', path: '/guests' },
  { key: 'explore', label: 'Edit your Suppliers', path: '/vendors' },
  { key: 'launch', label: 'Edit your Event Hub', path: '/launch' },
];

/**
 * One fit pass over a row that changes state AS ONE (BUTTON_RULE 3a, owner
 * 2026-10-07: *"the 3 buttons will all be icons at the same time, or text at the
 * same time or icon with text at the same time. not each"*). Icon + word first;
 * if any button (or the row) overflows, every button drops its icon; if that
 * still overflows, every button drops its word. Returns the state it settled on.
 */
export function fitAsOne(row: HTMLElement): '' | 'text-only' | 'icon-only' {
  const buttons = Array.from(row.querySelectorAll<HTMLElement>('.ab'));
  const set = (c: '' | 'text-only' | 'icon-only') =>
    buttons.forEach((b) => {
      b.classList.remove('text-only', 'icon-only');
      if (c) b.classList.add(c);
    });
  const tight = () => row.scrollWidth > row.clientWidth + 1 || buttons.some((b) => b.scrollWidth > b.clientWidth + 1);
  set('');
  if (!tight()) return '';
  set('text-only');
  if (!tight()) return 'text-only';
  set('icon-only');
  return 'icon-only';
}

export function HomeDoorways({
  eventId,
  navSlots,
}: {
  eventId: string;
  /** The bar's registry slots (plain data from the server; null = the code icons). */
  navSlots: Record<string, NavSlotLite> | null;
}) {
  const row = useRef<HTMLDivElement | null>(null);
  const run = useCallback(() => {
    if (row.current) row.current.dataset.fit = fitAsOne(row.current) || 'full';
  }, []);
  useIsoLayoutEffect(() => {
    run();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
    if (row.current) ro?.observe(row.current);
    return () => ro?.disconnect();
  }, [run]);
  return (
    <div ref={row} className="home-doors" data-home-doors="" data-home-edit-hub="">
      {DOORS.map((d) => {
        const Icon = homeDoorwayIcon(d.key, navSlots);
        return (
          <ActionButton
            key={d.key}
            tone="neutral"
            icon={Icon}
            label={d.label}
            href={`/dashboard/${eventId}${d.path}`}
            data-testid={`home-door-${d.key}`}
          />
        );
      })}
    </div>
  );
}

/* ─── Later · Reload ──────────────────────────────────────────────────────── */

function todayKey(eventId: string, kind: string): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `home-later:${eventId}:${kind}:${day}`;
}

/**
 * Hides today's next step for today, on this device ("Later" — the prototype's
 * "Hides this step for today"). Device storage only: a private window or a
 * cleared site simply shows the step again, which is the safe direction.
 */
export function HomeLater({ eventId, kind }: { eventId: string; kind: string }) {
  const btn = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const hide = useCallback(() => {
    const card = btn.current?.closest<HTMLElement>('[data-home-next]');
    if (card) card.hidden = true;
  }, []);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(todayKey(eventId, kind)) === '1') hide();
    } catch {
      /* storage refused — the step stays, which is the honest default */
    }
  }, [eventId, kind, hide]);
  return (
    <ActionButton
      ref={btn}
      tone="neutral"
      icon={CalendarDays}
      label="Later"
      data-testid="home-next-later"
      onClick={() => {
        try {
          window.localStorage.setItem(todayKey(eventId, kind), '1');
        } catch {
          /* storage refused — hide for this visit only */
        }
        hide();
      }}
    />
  );
}

/** "⟳ Reload" — runs the page's reads again. Never claims the read worked. */
export function HomeReload({ main = false }: { main?: boolean }) {
  // Outside the app router (a render test, the dev lab's static paint) there is no
  // router to ask; the button then reloads the page, which re-runs the reads too.
  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
  return (
    <ActionButton
      tone="neutral"
      main={main}
      icon={RotateCw}
      label="Reload"
      data-testid="home-reload"
      onClick={() => (router ? router.refresh() : window.location.reload())}
    />
  );
}

/* ─── What's next — unfolds in place ──────────────────────────────────────── */

/** The verb a decision row carries — `group.id` from the dashboard's decisions board. */
export type HomeDecisionVerb = 'book' | 'pay' | 'role' | 'date' | 'other';

export type HomeDecisionRow = {
  id: string;
  /** "Book a supplier" · "Settle a payment" · "Fill a role" — the group's title. */
  title: string;
  /** "Catering · 2 quotes in" — the item's own words. */
  sub: string;
  href: string;
  verb: HomeDecisionVerb;
  /** The item's own CTA word, used where the verb has no fixed word. */
  cta: string;
};

/* Per decision: 📅 Book / 💳 Pay / 👤 Pick (H1), toned by meaning. */
const VERB: Record<HomeDecisionVerb, { icon: typeof Check; tone: ActionTone; main: boolean; word?: string }> = {
  book: { icon: CalendarCheck, tone: 'ok', main: true, word: 'Book' },
  pay: { icon: CreditCard, tone: 'ok', main: true, word: 'Pay' },
  role: { icon: UserRound, tone: 'brand', main: false, word: 'Pick' },
  date: { icon: CalendarClock, tone: 'neutral', main: false },
  other: { icon: Sparkles, tone: 'brand', main: false },
};

export function HomeWhatsNext({
  open: openCount,
  rows,
  coming = [],
  checklist,
  emptyNote,
  children,
}: {
  /** Open decisions — `null` while unread (no number is printed, never 0). */
  open: number | null;
  rows: ReadonlyArray<HomeDecisionRow>;
  /** "Coming up" — the dated rows, under their own heading. */
  coming?: ReadonlyArray<HomeDecisionRow>;
  /** The checklist button: its href and, when measured, the % done. */
  checklist: { href: string; pct: number | null } | null;
  /** Said when there is nothing to decide. */
  emptyNote?: string;
  /** Anything the board carries beside its rows (the free-venue offer). */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const row = (r: HomeDecisionRow) => {
    const v = VERB[r.verb];
    return (
      <div key={r.id} className="home-row" data-home-decision={r.verb}>
        <div className="min-w-0">
          <div className="home-t">{r.title}</div>
          <div className="home-s">{r.sub}</div>
        </div>
        <span className="home-acts">
          <ActionButton tone={v.tone} main={v.main} icon={v.icon} label={v.word ?? r.cta} href={r.href} />
        </span>
      </div>
    );
  };
  return (
    <div className={`home-sec${open ? ' open' : ''}`} data-home-whats-next="">
      <button
        type="button"
        className="home-bar"
        aria-expanded={open}
        aria-controls="home-whats-next-fold"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="home-bar-ico" aria-hidden>
          <ListChecks strokeWidth={1.9} />
        </span>
        <span>
          <b>What&rsquo;s next</b>
          {openCount !== null ? (
            <span className="home-s">
              {' · '}
              <Count value={openCount} id="home-open-n" /> open
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden className="home-chev h-4 w-4" strokeWidth={2} />
      </button>
      <div className="home-fold" id="home-whats-next-fold" aria-hidden={!open} inert={!open ? true : undefined}>
        <div>
          {children}
          <p className="home-k2">Decisions waiting on you</p>
          {rows.length > 0 ? rows.map(row) : <p className="home-s pb-2">{emptyNote ?? 'Nothing needs a decision right now.'}</p>}
          {coming.length > 0 ? (
            <>
              <p className="home-k2">Coming up</p>
              {coming.map(row)}
            </>
          ) : null}
          {checklist ? (
            <div className="home-acts" style={{ margin: '12px 0 10px' }}>
              <ActionButton
                tone="ok"
                icon={Check}
                label={checklist.pct !== null ? `Your checklist · ${checklist.pct}% done` : 'Your checklist'}
                href={checklist.href}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
