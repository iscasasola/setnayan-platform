'use client';

/**
 * home-parts.tsx — the few pieces of the couple's Home that need the browser
 * (owner 2026-10-07, PR 4e — `prototypes/home_and_guests_2026-10-07_fable.html`
 * `?frame=1&page=home`, `HOME_AND_GUESTS_CHECK_2026-10-07_fable.md` H1–H8).
 * Everything else on the Home stays a server component (`home-first-screen.tsx`).
 *
 *   (HomeDoorways — the three door pills Guests · Suppliers · Event Hub — are GONE, owner 2026-10-23: "remove
 *    Home's three pills". The event bar carries all three.)
 *   HomeNextFold / HomeLater — "Later" folds the Next card to "Back tomorrow · Undo", for today, on this device.
 *                    No server write (opening never writes; +0 server actions).
 *   HomeReload     — "⟳ Reload": re-runs the page's reads (`router.refresh()`).
 *   HomeWhatsNext  — the What's next row: pop, then unfold IN PLACE under it (H7)
 *                    — no `?sheet=next` portal, no URL change.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { CalendarClock, CalendarDays, Check, ChevronDown, CreditCard, ListChecks, RotateCw, Sparkles, UserRound, CalendarCheck } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Count } from '@/components/count';

/* ─── Later · Reload ──────────────────────────────────────────────────────── */

function todayKey(eventId: string, kind: string): string {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `home-later:${eventId}:${kind}:${day}`;
}

/**
 * 📅 "LATER" FOLDS THE NEXT CARD TO ONE LINE (owner 2026-10-23: *"Later collapses to 'Back tomorrow · Undo'"*). The
 * card is not hidden without a word any more: it becomes "Back tomorrow · Undo" in its place, for today, on this
 * device. Undo brings it straight back. Device storage only: a private window or a cleared site simply shows the
 * step again, which is the safe direction.
 *
 * `HomeNextFold` wraps the card and owns the fold; `HomeLater` is the card's own Later button and asks it to fold.
 */
const LaterFold = createContext<(() => void) | null>(null);

export function HomeNextFold({ eventId, kind, children }: { eventId: string; kind: string; children: ReactNode }) {
  const [folded, setFolded] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(todayKey(eventId, kind)) === '1') setFolded(true);
    } catch {
      /* storage refused — the step stays, which is the honest default */
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
  const undo = () => {
    try {
      window.localStorage.removeItem(todayKey(eventId, kind));
    } catch {
      /* nothing stored — nothing to clear */
    }
    setFolded(false);
  };
  if (folded) {
    return (
      <p className="flex items-center gap-1.5 px-1 text-[13px] text-ink/60" data-home-next-later="" role="status">
        <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.9} />
        <span>Back tomorrow</span>
        <span aria-hidden>·</span>
        <button type="button" onClick={undo} className="font-medium text-mulberry" data-testid="home-next-undo">
          Undo
        </button>
      </p>
    );
  }
  return <LaterFold.Provider value={fold}>{children}</LaterFold.Provider>;
}

export function HomeLater() {
  const fold = useContext(LaterFold);
  return (
    <ActionButton
      tone="neutral"
      icon={CalendarDays}
      label="Later"
      data-testid="home-next-later"
      onClick={() => fold?.()}
    />
  );
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
