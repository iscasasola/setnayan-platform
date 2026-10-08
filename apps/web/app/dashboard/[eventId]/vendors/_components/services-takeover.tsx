'use client';

/**
 * ServicesTakeover — THE SUPPLIERS SHELL: one screen, the Maker's shape (owner
 * 2026-10-07 — *"a uni screen interface … which handles everything we have and
 * still keeps it un clumped"*; corpus `SUPPLIERS_HANDOFF_2026-10-07_fable.md`
 * PR1; prototype `prototypes/suppliers_page_2026-10-07_fable.html`).
 *
 *   the date · place line        the ONLY place the date and the place appear
 *   Find · Build N/M · Booked N  ONE segmented control (`ISegmented`, wine)
 *   one body                     that swaps — nothing else on the page
 *   the cart peek                `build-cart.tsx` — rises when a supplier is
 *                                added to the build
 *
 * The line and the control are pinned under the app's top bar as the body
 * scrolls. The page's own name ("Suppliers") is the masthead's h1 for a screen
 * reader at every width and a visible title row from 1024 px only — on a phone
 * the bottom bar already names the page.
 *
 * ── EACH BODY IS A STUB, FOR NOW ───────────────────────────────────────────
 * PR1 builds the shell only. Each body mounts the SHIPPED section it will
 * replace, unchanged, so nothing is unreachable while PR2–PR4 land:
 *   Find    `shortlistSlot`  — the bench ("Cover your event"), and the door to
 *                              the category marketplace
 *   Build   `buildSlot`      — the picks, then `compareSlot`, the saved builds
 *   Booked  `teamSlot`       — the team's rows, then `budgetSlot`, the payments
 * A body is drawn when it is first shown and then KEPT (hidden, not unmounted),
 * so its own client state — an open category, a typed build name — survives a
 * switch, and nothing is drawn twice. The first paint draws ONE body.
 *
 * ── THE BUS STAYS ──────────────────────────────────────────────────────────
 * `BB_TAB_EVENT` / `goToBuildTab` (`lib/budget-build.ts`) and `?tab=` are
 * UNCHANGED for every caller. The segmented control drives the bus (a press
 * dispatches its mode's own tab key), and the bus drives the control: any tab
 * key resolves to the body that holds it (`suppliersModeOfTab`), `#svc-<tab>`
 * anchors still resolve by id, and `compare` is scrolled to inside Build.
 *
 * Retired here (PR1): the five-row "Your planning" menu, the hidden
 * `#team-find-area` and the second chat icon — the top bar's Messages icon is
 * the only inbox door.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { Info, Sparkles, X } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { Count } from '@/components/count';
import { ISeg, ISegmented } from '../../website/editor/_components/inspector-kit';
import {
  BUDGET_BUILD_TABS,
  TAB_META,
  tabLabel,
  tabBlurb,
  BB_TAB_EVENT,
  goToBuildTab,
  type BudgetBuildTab,
} from '@/lib/budget-build';
import {
  SUPPLIERS_MODES,
  SUPPLIERS_MODE_LABEL,
  SUPPLIERS_MODE_TAB,
  isModeTab,
  suppliersModeOfTab,
  type BuildTally,
  type SuppliersMode,
} from '@/lib/suppliers-shell';
import { isExploreReplanEnabled } from '@/lib/explore-replan-flag';
import {
  EXPLORE_INFO_BUTTON_LABEL,
  EXPLORE_INFO_HANDSHAKE,
  EXPLORE_INFO_STRIP,
  EXPLORE_INFO_TITLE,
  EXPLORE_INFO_WHAT,
  EXPLORE_STATE_LEGEND,
} from '@/lib/explore-info-copy';
import { BuildCart } from './build-cart';
import { SuppliersModeContext, THUMB_SLIDE_MS } from './suppliers-mode';

// The cross-tab bus (BB_TAB_EVENT + goToBuildTab) and TAB_META live in
// @/lib/budget-build (2026-06-16) so the layout-mounted nav shares them without
// importing across _components. Re-exported here so the existing imperative
// consumer (build-compare.tsx) keeps importing goToBuildTab from
// './services-takeover' unchanged.
export { BB_TAB_EVENT, goToBuildTab };

/** DOM id for a section's scroll anchor. Keyed by the same tab keys the bus
 *  dispatches, so `goToBuildTab('compare')` resolves to `#svc-compare`. */
const sectionId = (tab: BudgetBuildTab) => `svc-${tab}`;

/** Per-section intro copy. Behind the Explore-Replan flag
 *  (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §2 — one word, one concept):
 *  `compare` is "Your plans" and `budget` is "Payments". The section KEYS /
 *  anchors / bus events stay `compare` and `budget`. (PR2–PR4 redraw each
 *  body with its own heading; these are the shipped sections' own.) */
const SECTION_HEADING: Record<BudgetBuildTab, string> = {
  shortlist: 'Saved',
  build: isExploreReplanEnabled() ? 'Picks' : 'Build your suppliers',
  budget: isExploreReplanEnabled() ? 'Payments' : 'Your budget',
  compare: isExploreReplanEnabled() ? 'Your plans' : 'Compare saved builds',
};

/** The bench's own anchors (`slfold-…` / `sltile-…`) and every `#svc-*` section
 *  land BELOW the pinned block: `--stick-h` is the top bar plus the block,
 *  measured (as the prototype measures it). */
const LANDING_CSS =
  '[data-budget-build-takeover] .slcat [id^="slfold-"],[data-budget-build-takeover] .slcat [id^="sltile-"]{scroll-margin-top:calc(var(--stick-h,150px) + 14px)}' +
  '[data-budget-build-takeover] [id^="svc-"]{scroll-margin-top:calc(var(--stick-h,150px) + 8px)}';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function ServicesTakeover({
  eventId,
  initialTab = 'shortlist',
  factsSlot,
  tally,
  bookedCount,
  shortlistSlot,
  buildSlot,
  budgetSlot,
  compareSlot,
  premium = false,
  teamSlot,
}: {
  eventId: string;
  /** The `?tab=` the page arrived with (the lock door, a checklist deep link,
   *  the finished-event summary) — the FIRST paint is already that body. */
  initialTab?: BudgetBuildTab;
  /**
   * The date · place line (`date-place-line.tsx`). Server-rendered by the page
   * — it owns the event read — and only PLACED here, pinned with the control.
   */
  factsSlot?: ReactNode;
  /** "Build 2/5" and the build's money — `buildTally` over the page's own plan
   *  model (`lib/suppliers-shell.ts`). */
  tally: BuildTally;
  /** "Booked 2" — counted from the same rows the Booked body draws. */
  bookedCount: number;
  /** The team, as rows — booked first, one next step each (`team-rows.tsx`). */
  teamSlot?: ReactNode;
  shortlistSlot?: ReactNode;
  buildSlot?: ReactNode;
  budgetSlot?: ReactNode;
  compareSlot?: ReactNode;
  /** Setnayan AI active for this event → the crest strip saying smart matching
   *  and the watch guard are on. Purely presentational. */
  premium?: boolean;
}) {
  const firstMode = suppliersModeOfTab(initialTab);
  const [mode, setMode] = useState<SuppliersMode>(firstMode);
  // Drawn when first shown, then kept: a body's own state survives a switch.
  const [seen, setSeen] = useState<ReadonlySet<SuppliersMode>>(() => new Set([firstMode]));
  const modeRef = useRef<SuppliersMode>(firstMode);
  const rootRef = useRef<HTMLElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);

  // ── A BODY'S FLOATING ROW LEAVES FIRST (BUTTON_RULE rule 5) ───────────────
  // Find draws a thumb row into <body> (`find-thumb-row.tsx`). It says here
  // whether it is up (`thumbUp`); when the couple asks for another body while
  // it is, the shell says `leaving`, the row slides down, and only then does
  // the body swap. No row up → no wait.
  const thumbUp = useRef(false);
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  // ── ONE DOOR INTO A SECTION: the segmented control, the bus, `?tab=` ─────
  const goToSection = useCallback((next: BudgetBuildTab, smooth = true) => {
    const nextMode = suppliersModeOfTab(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url);
    } catch {
      // URL/history unavailable — the body still swaps, client-only.
    }
    const land = () => {
      // The body swaps with NO scroll jump: a mode opens at its top (as the
      // prototype does); only a section INSIDE a mode (`compare`) is scrolled to.
      if (isModeTab(next)) {
        window.scrollTo({ top: 0 });
        return;
      }
      document.getElementById(sectionId(next))?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    };
    const swap = () => {
      leaveTimer.current = null;
      modeRef.current = nextMode;
      // Committed NOW, not on the next render: a caller that scrolls to a row
      // of the body it just asked for (the Build body's "open this category"
      // doorway → the bench) must find that body on screen.
      flushSync(() => {
        setMode(nextMode);
        setSeen((s) => (s.has(nextMode) ? s : new Set(s).add(nextMode)));
        // The wait is over — and a second press on the body being left ends it
        // too, so its row comes back up.
        setLeaving(false);
      });
      land();
    };
    if (leaveTimer.current != null) window.clearTimeout(leaveTimer.current);
    if (nextMode !== modeRef.current && thumbUp.current && !prefersReducedMotion()) {
      setLeaving(true);
      leaveTimer.current = window.setTimeout(swap, THUMB_SLIDE_MS);
      return;
    }
    swap();
  }, []);

  // `?tab=` may have been written (replaceState) while this page was still
  // loading — after the server chose the first body. Adopt the live one once.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (!t || !(BUDGET_BUILD_TABS as readonly string[]).includes(t)) return;
    const tab = t as BudgetBuildTab;
    if (suppliersModeOfTab(tab) === modeRef.current && isModeTab(tab)) return;
    // One frame later, so the body has laid out before anything is measured.
    const r = requestAnimationFrame(() => goToSection(tab, false));
    return () => cancelAnimationFrame(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slots and the nav request a section via the `bb:tab` CustomEvent (see
  // goToBuildTab). The contract is UNCHANGED for callers — the listener swaps
  // the body that holds the section.
  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<BudgetBuildTab>).detail;
      if (next && BUDGET_BUILD_TABS.includes(next)) goToSection(next);
    };
    window.addEventListener(BB_TAB_EVENT, onTab);
    return () => window.removeEventListener(BB_TAB_EVENT, onTab);
  }, [goToSection]);

  // ── THE PINNED BLOCK SITS UNDER THE APP'S TOP BAR ────────────────────────
  // The bar slides away on a phone as the page scrolls (`data-hidden`), so its
  // height is MEASURED, never assumed (the Guests screen does the same):
  //   --sup-top   the top bar's height while it shows, else 0
  //   --stick-h   that plus this block — where a pinned row under it sits
  useEffect(() => {
    const root = rootRef.current;
    const stick = stickRef.current;
    if (!root || !stick) return;
    const bar = document.querySelector<HTMLElement>('.shell-topbar');
    // Written only when a value CHANGES: this runs on every scroll frame, and a
    // custom property re-set to itself still costs the page a style pass.
    let lastTop = -1;
    let lastStick = -1;
    const sync = () => {
      const shown = bar && bar.getAttribute('data-hidden') !== 'true' && getComputedStyle(bar).display !== 'none';
      const top = shown ? bar.getBoundingClientRect().height : 0;
      if (top !== lastTop) {
        lastTop = top;
        root.style.setProperty('--sup-top', `${top}px`);
      }
      if (top + stick.offsetHeight !== lastStick) {
        lastStick = top + stick.offsetHeight;
        root.style.setProperty('--stick-h', `${top + stick.offsetHeight}px`);
      }
      stick.toggleAttribute('data-stuck', window.scrollY > 0 && stick.getBoundingClientRect().top <= top + 1);
    };
    sync();
    const mo = bar ? new MutationObserver(sync) : null;
    if (bar) mo?.observe(bar, { attributes: true, attributeFilter: ['data-hidden', 'style', 'class'] });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(stick);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, { passive: true });
    return () => {
      mo?.disconnect();
      ro?.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync);
    };
  }, []);

  const drawn = (m: SuppliersMode) => m === mode || seen.has(m);
  const modeState = useMemo(() => ({ mode, leaving, thumbUp }), [mode, leaving]);

  return (
    /* 🔴 THE APP'S TOP BAR STAYS ON SUPPLIERS (owner 2026-10-05). This section
       once injected `.shell-topbar{display:none}` below 1024 px, from the days
       it was a full-screen "focus mode" takeover. It is a tab like Guests —
       the pinned block below sits UNDER the bar, never instead of it.
       `suppliers-keeps-the-shell-bar.test.ts` stops the hide coming back. */
    <section ref={rootRef} data-budget-build-takeover="" data-suppliers-mode={mode}>
      <style>{LANDING_CSS}</style>

      {/* The page's name: the shared masthead's h1 (screen readers, every
          width). `<PageMasthead>` is the shipped component — never re-drawn. */}
      <PageMasthead title="Suppliers" />
      {/* …and a visible title row from 1024 px only. On a phone the bottom
          bar names the page and the Maker has no title row either (owner
          2026-10-07). aria-hidden: the h1 above already says it. */}
      <p aria-hidden className="mb-1 hidden font-display text-[28px] leading-none text-ink lg:block">
        Suppliers
      </p>

      {/* ── PINNED: the date · place line, then Find · Build · Booked ──────
          `.sn-ambient` is the page's own ground, so the block reads as the
          page, not a box; it spans the column's gutters so rows scroll clean
          under it. */}
      <div
        ref={stickRef}
        data-suppliers-stick=""
        className="sn-ambient sticky top-[var(--sup-top,0px)] z-[15] -mx-4 px-4 pb-2 pt-2.5 transition-[top,box-shadow] duration-300 ease-out data-[stuck]:shadow-[0_1px_0_rgb(var(--color-ink)/0.1)] motion-reduce:transition-none sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {factsSlot}
        <div className="mt-2.5 flex">
          <ISegmented label="Find, Build or Booked">
            {SUPPLIERS_MODES.map((m) => (
              <ISeg
                key={m}
                tone="wine"
                on={mode === m}
                data={m}
                // The segmented control DRIVES THE BUS: a press dispatches the
                // mode's own tab key, and the listener above swaps the body.
                onClick={() => goToBuildTab(SUPPLIERS_MODE_TAB[m])}
              >
                {SUPPLIERS_MODE_LABEL[m]}
                {m === 'build' && tally.filled > 0 ? (
                  <span className="ml-0.5 font-medium opacity-80" data-seg-count="build">
                    <Count value={tally.filled} id="sup-seg-filled" />/<Count value={tally.total} id="sup-seg-total" />
                  </span>
                ) : null}
                {m === 'booked' && bookedCount > 0 ? (
                  <span className="ml-0.5 font-medium opacity-80" data-seg-count="booked">
                    <Count value={bookedCount} id="sup-seg-booked" />
                  </span>
                ) : null}
              </ISeg>
            ))}
          </ISegmented>
        </div>
      </div>

      {/* ── ONE BODY ────────────────────────────────────────────────────────
          One column at every width (the prototype's 820 px on a computer). */}
      <SuppliersModeContext.Provider value={modeState}>
      <div className="min-w-0 pt-4 lg:max-w-[820px]">
        {drawn('find') ? (
          <div data-suppliers-body="find" hidden={mode !== 'find'}>
            {/* Room for Find's thumb row, so the last row is never under it. */}
            <div className="max-lg:pb-16">
              {/* ONE Find a supplier opens the Find page — only this event
                  type's categories, grouped the way hosts think (P3,
                  2026-10-01). PR2 unfolds that marketplace in place. */}
              <Link
                href={`/dashboard/${eventId}/vendors/categories`}
                data-find-supplier=""
                className="mb-5 inline-flex w-full items-center justify-center rounded-full border-[1.5px] border-ink bg-cream px-4 py-3.5 font-display text-base text-ink transition hover:bg-ink/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry lg:w-auto lg:px-8"
              >
                Find a supplier
              </Link>

              {/* ── THE HONESTY STRING (B2, 2026-08-14) ──────────────────────
                  `premium` is `aiActive`, and while the AI paywall is off that
                  is true for every event — so this says the features are on
                  and free right now, which holds in both worlds. Gold is the
                  ACCENT only (UI-only at 3.37:1): legal on the icon, never on
                  the sentence beside it. */}
              {premium ? (
                <div className="sn-tile mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} aria-hidden />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/70">
                    Setnayan&nbsp;AI
                  </span>
                  <span className="text-xs text-ink/60">
                    Smart matching, fit scoring, and the watch guard are on — free while we are in launch.
                  </span>
                </div>
              ) : null}

              <ServiceSection tab="shortlist" heading={SECTION_HEADING.shortlist}>
                {shortlistSlot ?? <SectionStub tab="shortlist" />}
              </ServiceSection>
            </div>
          </div>
        ) : null}

        {drawn('build') ? (
          <div data-suppliers-body="build" hidden={mode !== 'build'}>
            <div className="space-y-8">
              <ServiceSection tab="build" heading={SECTION_HEADING.build}>
                {buildSlot ?? <SectionStub tab="build" />}
              </ServiceSection>
              {/* The saved builds, side by side — its own key on the bus
                  (`compare`), so "Your plans" doorways still land on it. */}
              <ServiceSection tab="compare" heading={SECTION_HEADING.compare}>
                {compareSlot ?? <SectionStub tab="compare" />}
              </ServiceSection>
            </div>
          </div>
        ) : null}

        {drawn('booked') ? (
          <div data-suppliers-body="booked" hidden={mode !== 'booked'}>
            <div className="space-y-8">
              {teamSlot ? <div data-team-slot="">{teamSlot}</div> : null}
              <ServiceSection tab="budget" heading={SECTION_HEADING.budget}>
                {budgetSlot ?? <SectionStub tab="budget" />}
              </ServiceSection>
            </div>
          </div>
        ) : null}
      </div>
      </SuppliersModeContext.Provider>

      <BuildCart tally={tally} />
    </section>
  );
}

/**
 * One section of a body: an anchored `<section>` with a serif heading — the
 * shipped section, drawn whole. (The "Show" / "Hide" disclosure that used to
 * fold Payments and Your plans is gone with the one tall scroll that needed
 * it: a body shows one thing, so nothing of it is folded away.)
 */
function ServiceSection({
  tab,
  heading,
  children,
}: {
  tab: BudgetBuildTab;
  heading: string;
  children: ReactNode;
}) {
  const blurb = tabBlurb(tab);
  // Page-level ⓘ (Explore Replan PR-B · spec §11.1) — the bench only, and only
  // behind the flag. The heading keeps its exact pre-replan classes when the ⓘ
  // is absent, so the flag-OFF render is byte-identical.
  const showInfo = tab === 'shortlist' && isExploreReplanEnabled();
  return (
    // Lands below the pinned block when scrolled to (`LANDING_CSS`).
    <section
      id={sectionId(tab)}
      aria-labelledby={`${sectionId(tab)}-h`}
      // 💾 The budget and the plans' totals are money — never kept as
      // last-seen data (lib/last-seen).
      data-money={tab === 'budget' || tab === 'compare' ? '' : undefined}
    >
      <header className="mb-4">
        <h2
          id={`${sectionId(tab)}-h`}
          className={`font-serif text-xl italic leading-tight text-ink sm:text-2xl${
            showInfo ? ' flex items-center gap-2' : ''
          }`}
        >
          {heading}
          {/* The ONE explanatory affordance on the bench: what this page does,
              the state-glyph legend, the lock handshake in a line, and what
              the Coverage Strip means. Every string comes from
              lib/explore-info-copy.ts; none is authored here. */}
          {showInfo ? <ExploreInfoToggle /> : null}
        </h2>
        <p className="mt-0.5 text-sm text-ink/55">{blurb}</p>
      </header>
      <div id={`${sectionId(tab)}-body`}>{children}</div>
    </section>
  );
}

/**
 * The page-level ⓘ (Explore Replan PR-B · spec §11).
 *
 * Rules encoded here: a REAL button with an aria-label + visible focus ring; a
 * DISMISSIBLE panel (close button + Escape + click the toggle again); state is
 * NEVER persisted — it is help, not a setting, so it always starts closed.
 *
 * Everything is `<span>`-based because the toggle is rendered inside the
 * section's `<h2>`, which only admits phrasing content; `block`/`grid` classes
 * do the layout. All copy is imported — none is authored in this file.
 */
function ExploreInfoToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span className="relative inline-flex not-italic">
      <button
        type="button"
        aria-label={EXPLORE_INFO_BUTTON_LABEL}
        aria-expanded={open}
        aria-controls="explore-info-panel"
        onClick={() => setOpen((v) => !v)}
        className="sn-dot-btn inline-flex h-6 w-6 items-center justify-center rounded-full border border-ink/20 text-ink/55 transition hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <span
          id="explore-info-panel"
          className="absolute left-0 top-8 z-30 block w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-ink/10 bg-cream p-4 font-sans text-sm not-italic leading-relaxed text-ink/75 shadow-xl"
        >
          <span className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">{EXPLORE_INFO_TITLE}</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink/45 transition hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </span>
          <span className="block text-[13px]">{EXPLORE_INFO_WHAT}</span>
          <span className="mt-2.5 block text-[13px]">{EXPLORE_INFO_STRIP}</span>
          <span className="mt-2.5 block text-[13px]">{EXPLORE_INFO_HANDSHAKE}</span>
          <span className="mt-3 grid gap-1 border-t border-ink/10 pt-3">
            {EXPLORE_STATE_LEGEND.map((row) => (
              <span key={row.state} className="flex items-baseline gap-2 text-[12.5px]">
                <span className="w-3 shrink-0 text-center font-mono text-ink" aria-hidden>
                  {row.glyph}
                </span>
                <span>
                  <span className="font-semibold text-ink">{row.label}</span> — {row.meaning}
                </span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Fallback body when a slot isn't supplied (e.g. a slot still being built). */
function SectionStub({ tab }: { tab: BudgetBuildTab }) {
  const { icon: Icon } = TAB_META[tab];
  const blurb = tabBlurb(tab);
  const label = tabLabel(tab);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
        <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="text-lg font-semibold text-ink">{label}</h3>
      <p className="text-sm text-ink/60">{blurb}</p>
      <p className="mt-1 text-xs text-ink/40">Coming together as we build this out.</p>
    </div>
  );
}
