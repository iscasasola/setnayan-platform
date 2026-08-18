'use client';

/**
 * ServicesTakeover — the couple Services tab as a full-screen FOCUS MODE
 * takeover (Budget "Build"). Spec: `Budget_Build_Services_Takeover_2026-06-08.md`.
 *
 * Mirrors the Guests focus-mode shell (`guests/page.tsx`):
 *   - a `<style>` hides the global top bar on MOBILE only (desktop keeps it for
 *     the EventSwitcher + notifications; the takeover is full-screen on mobile).
 *   - the global 5-tab bottom nav stays VISIBLE at the screen bottom
 *     (nav-everywhere 2026-06-13). On mobile the docked section sub-nav
 *     (`customer-section-subnav.tsx`, layout-mounted) is the section switcher.
 *
 * INTEGRATED SINGLE-SCROLL (2026-07-09): the three sections no longer swap one
 * mount at a time. All three slots render STACKED in one vertical scroll surface
 * — `#svc-shortlist` ("Browse the bench") · `#svc-build` ("Build your team") ·
 * `#svc-compare` ("Compare saved builds", collapsed by default). The `BB_TAB_EVENT`
 * bus + `?tab=` contract is UNCHANGED — the mobile dock (`customer-section-subnav.tsx`)
 * and any `goToBuildTab` callers keep working verbatim; the bus listener now
 * SCROLLS instead of swapping mounts. Slot component internals (the 3-state Build
 * engine, Compare, the Shortlist accordion) are UNTOUCHED — they render as
 * section bodies exactly as before.
 *
 * DESKTOP TAB STRIP REMOVED (2026-07-15, owner): with the two-column desktop
 * layout every section is already on screen (shortlist left, build/budget/compare
 * in the sticky right rail), so the in-page anchor nav duplicated what the eye
 * can see. The bus/?tab= scrolling stays for the mobile dock + goToBuildTab.
 *
 * The old floating focus-mode "back X" (top-left) was REMOVED 2026-06-15
 * (nav-surfaces follow-up to #1470): the global journey bottom nav is always
 * present here, so a dedicated "back to home" affordance is vestigial.
 *
 * Entirely behind `BUDGET_BUILD_ENABLED` — the flag-OFF path (legacy
 * `PlanBudgetAccordion`) lives in `page.tsx` and is unchanged.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Info, Sparkles, X } from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import {
  BUDGET_BUILD_TABS,
  TAB_META,
  tabLabel,
  tabBlurb,
  BB_TAB_EVENT,
  goToBuildTab,
  type BudgetBuildTab,
} from '@/lib/budget-build';
import { isExploreReplanEnabled } from '@/lib/explore-replan-flag';
import {
  EXPLORE_INFO_BUTTON_LABEL,
  EXPLORE_INFO_HANDSHAKE,
  EXPLORE_INFO_STRIP,
  EXPLORE_INFO_TITLE,
  EXPLORE_INFO_WHAT,
  EXPLORE_STATE_LEGEND,
} from '@/lib/explore-info-copy';

// The cross-tab bus (BB_TAB_EVENT + goToBuildTab) and TAB_META moved to
// @/lib/budget-build 2026-06-16: the docked mobile section sub-nav is now
// mounted in the EVENT LAYOUT (customer-section-subnav.tsx) — not here — so it
// paints and responds BEFORE this server-built panel resolves (owner: "the sub
// nav should always respond first"). The dock shares the bus + meta from the lib
// without importing across _components. Re-exported here so the existing
// imperative consumer (build-compare.tsx) keeps importing
// goToBuildTab from './services-takeover' unchanged.
export { BB_TAB_EVENT, goToBuildTab };

/** DOM id for a section's scroll anchor. Keyed by the same tab keys the mobile
 *  dock dispatches over the bus, so `goToBuildTab('build')` resolves to `#svc-build`. */
const sectionId = (tab: BudgetBuildTab) => `svc-${tab}`;

/** Per-section intro copy — the single-scroll headings the strip scrolls between.
 *  Behind the Explore-Replan flag (`Explore_Integration_BUILD_SPEC_2026-07-29.md`
 *  §2 — one word, one concept): `compare` is reframed as "Your plans" (PR-F) and
 *  `budget` as "Payments" — on this page the section is the payments lens, while
 *  "budget" stays the money TARGET (the tile + `/budget`). The section KEYS /
 *  anchors / bus events stay `compare` and `budget`. */
const SECTION_HEADING: Record<BudgetBuildTab, string> = {
  shortlist: 'Browse the bench',
  // "Build your team" → **"Your team"** (2026-07-29 §2). The section is the
  // people you chose — locked, mid-handshake, and candidates — not a verb. The
  // owner's complaint was literal: "why does the build your team has build your
  // plan and your team?" It named itself twice and then named a THIRD thing.
  build: isExploreReplanEnabled() ? 'Your team' : 'Build your team',
  budget: isExploreReplanEnabled() ? 'Payments' : 'Your budget',
  compare: isExploreReplanEnabled() ? 'Your plans' : 'Compare saved builds',
};

export function ServicesTakeover({
  // `eventId` is READ AGAIN as of B1 (2026-08-14): the masthead's back chevron
  // needs the event root. It had been undestructured since 2026-06-15, when the
  // floating "back X" that previously used it was removed.
  // `initialTab` still stays in the props contract but is not read: it only
  // seeded the removed desktop strip's highlight — the on-mount ?tab=
  // adoption below still handles deep-link scrolling.
  eventId,
  shortlistSlot,
  buildSlot,
  budgetSlot,
  compareSlot,
  premium = false,
}: {
  eventId: string;
  shortlistSlot?: ReactNode;
  buildSlot?: ReactNode;
  budgetSlot?: ReactNode;
  compareSlot?: ReactNode;
  initialTab?: BudgetBuildTab;
  /** Setnayan AI active for this event → the Merkado wears its premium tier: a
   *  gold-accented crest strip signalling smart matching / watch guard are on
   *  (PR-4 · S5). Purely presentational; gated on the AI subscription upstream. */
  premium?: boolean;
}) {
  // Read once so the whole surface agrees within a render (same contract as
  // `build-compare.tsx` / `build-locked.tsx`).
  const replan = isExploreReplanEnabled();
  // Compare is the least-used + longest section → collapsed by default,
  // expandable in place. Selecting/scrolling to Compare auto-expands it.
  const [compareOpen, setCompareOpen] = useState(false);
  // Budget is a collapsible lens too (calm rail by default; opens on select).
  const [budgetOpen, setBudgetOpen] = useState(false);

  // Scroll a section into view + mirror ?tab= for refresh/deep-links.
  // Shared by the bus listener and the on-mount ?tab= adopt.
  const goToSection = useCallback((next: BudgetBuildTab, smooth = true) => {
    if (next === 'compare') setCompareOpen(true);
    if (next === 'budget') setBudgetOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url);
    } catch {
      // URL/history unavailable — the scroll still happens, client-only.
    }
    const el = document.getElementById(sectionId(next));
    if (el) {
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    }
  }, []);

  // The docked section sub-nav (event layout) writes ?tab= via replaceState and
  // may do so while THIS page is still loading — before this panel mounts. On
  // mount, adopt the live ?tab= if it points at a non-default section, scrolling
  // there so a tab tapped during the load is honored. Deferred to an effect (not
  // a lazy initializer) so SSR + first client paint agree — no hydration flash.
  // `compare` also expands. Runs once.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && (BUDGET_BUILD_TABS as readonly string[]).includes(t)) {
      const next = t as BudgetBuildTab;
      if (next === 'compare') setCompareOpen(true);
      if (next === 'budget') setBudgetOpen(true);
      // Only jump for a non-shortlist target — shortlist is the top of the page
      // and scrolling to it on every load would be pointless jank.
      if (next !== 'shortlist') {
        // Defer one frame so the sections have laid out before we measure.
        requestAnimationFrame(() => goToSection(next, false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let slots + the mobile dock request a section via the `bb:tab` CustomEvent
  // (see goToBuildTab). The contract is UNCHANGED for callers — the listener now
  // SCROLLS to the section instead of swapping the mounted panel.
  useEffect(() => {
    const onTab = (e: Event) => {
      const next = (e as CustomEvent<BudgetBuildTab>).detail;
      if (next && BUDGET_BUILD_TABS.includes(next)) goToSection(next);
    };
    window.addEventListener(BB_TAB_EVENT, onTab);
    return () => window.removeEventListener(BB_TAB_EVENT, onTab);
  }, [goToSection]);

  return (
    <section
      className="-mt-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] lg:pt-0"
      data-budget-build-takeover=""
    >
      {/* Hide the global top bar on MOBILE only — the takeover is full-screen
          there. On desktop the top bar is the only host of the EventSwitcher +
          notifications bell (no sidebar fallback), so keep it; the desktop tab
          strip lives in the content area and won't collide. (Review 2026-06-09.) */}
      <style>{`@media (max-width:1023px){.shell-topbar{display:none}}`}</style>

      {/* ── B1 · PAGE IDENTITY ────────────────────────────────────────────────
          This page had NO <h1> at all (measured 2026-08-14: the only h1s under
          `vendors/` are its SUB-routes — review, workspace, categories,
          packages). The shell supplies the <main> landmark and no heading, the
          desktop tab strip went in 2026-07-15 and the mobile dock went under the
          replan flag, so on a phone — where there is no sidebar to read — nothing
          on screen said which page this was.

          `<PageMasthead>` is the shipped component for exactly this (8 sibling
          dashboard pages already use it); it is NOT re-drawn here. Its back
          chevron is the "crumb" the plan asks for — this product has no
          breadcrumb component and the masthead's own docblock says so. */}
      {replan ? (
        <PageMasthead
          className="mb-4"
          title="Marketplace"
          back={`/dashboard/${eventId}`}
          backLabel="Back to your event"
        />
      ) : null}

      {/* Premium tier crest (S5) — shows only when Setnayan AI is active, marking
          the Marketplace as the couple's premium planning surface.
          Presentational; the AI features it names are live behind the same gate.

          ── B2 · THE HONESTY STRING (2026-08-14) ──────────────────────────────
          This read "Your Marketplace is on the premium tier" to EVERY couple.
          `premium` is `aiActive`, and while the AI paywall is off `aiActive` is
          true for every event — so a line meant to mark a paid tier was telling
          all of them they had bought something. The features named are genuinely
          on; what was false was "premium tier". It now says the features are on
          and free right now, which is true in both worlds and does not have to
          be revisited when the paywall flips.

          Chrome moves off the amber warn-* ramp onto the warm-editorial card
          (`.sn-tile`, 14px + cream + line), keeping gold as the ACCENT only —
          gold has 0.29 of contrast headroom on cream, so it may never become a
          fill or a tint behind text (design#6, 2026-08-13). */}
      {premium ? (
        <div className="sn-tile mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2.5">
          {/* `terracotta` is the token that HOLDS gold #A9834B (globals.css
              `--color-terracotta`) — the same class this file already uses for
              its accent. Gold is 3.37:1 and is UI-ONLY: legal on an icon, never
              on the sentence beside it. */}
          <Sparkles className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} aria-hidden />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/70">
            Setnayan&nbsp;AI
          </span>
          <span className="text-xs text-ink/60">
            Smart matching, fit scoring, and the watch guard are on — free while we are in launch.
          </span>
        </div>
      ) : null}

      {/* ── B1 · SECTION CHIPS ───────────────────────────────────────────────
          The desktop strip was removed 2026-07-15 because the two-column layout
          shows every section at once. That reasoning never held on a PHONE,
          where the columns stack and Plans + Payments sit below a bench that is
          ~10 folders and ~53 tiles long — so reaching your money meant scrolling
          past all of it (seam S1). The dock that used to solve this was removed
          under the replan flag and is not coming back (owner lock, twice).

          These are NOT tabs and they swap nothing. Each chip calls the SHIPPED
          `goToBuildTab`, which dispatches the existing BB_TAB_EVENT that the
          `goToSection` listener above already consumes — so a chip does exactly
          what the mobile dock did: scroll, mirror `?tab=`, and expand a
          collapsed section. No new key, no new anchor, no new bus.

          Not sticky, deliberately: the bottom nav and the team chip already dock
          on mobile, and a third pinned bar is the stacked-bars defect
          `lint-no-stacked-pinned-bars.mjs` exists to prevent. */}
      {replan ? <SectionChips /> : null}

      {/* Merkado layout (S1 · 2026-07-09): MOBILE stacks (shortlist → build →
          compare) exactly as before — the grid collapses to one column and the
          right wrapper is a normal block, so the docked sub-nav + scroll-spy keep
          working. DESKTOP (lg+) becomes TWO COLUMNS: the tall shortlist on the
          left, the build + compare in a STICKY right rail that stays in view while
          you browse categories. Same single DOM — the slots are never mounted
          twice (no duplicate client state) — only reflowed by grid + sticky. The
          BB_TAB_EVENT bus, anchor nav, and scroll-spy are untouched.

          DO NOT ADD `.sn-col` HERE (asked twice — 2026-08-01). The 64rem reading
          column that caps the 13 text-led event routes is WRONG for this one,
          because the right rail is a FIXED 380px: every pixel the cap removes
          comes out of the shortlist column, not the rail.
            today   @1440px viewport → 1120px content → 1120-380-24 = 716px left
            .sn-col @1440px viewport → 1024px content → 1024-380-24 = 620px left
          That is a 13% narrowing of the browse surface. Worse, `.sn-col` only
          binds ABOVE a ~1344px viewport — exactly where this two-column layout
          finally has room — so it can only ever hurt. Same category as `suite`
          (deliberate `2xl:grid-cols-4`): a real wide layout, not an unfixed one.
          See globals.css `.sn-col`. */}
      <div className="grid min-w-0 gap-8 pb-[calc(env(safe-area-inset-bottom)+40px)] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6 lg:pb-0">
        <div className="min-w-0">
          <ServiceSection tab="shortlist" heading={SECTION_HEADING.shortlist}>
            {shortlistSlot ?? <SectionStub tab="shortlist" />}
          </ServiceSection>
        </div>

        <div className="min-w-0 space-y-8 lg:sticky lg:top-4 lg:self-start">
          <ServiceSection tab="build" heading={SECTION_HEADING.build}>
            {buildSlot ?? <SectionStub tab="build" />}
          </ServiceSection>

          {/* ORDER — Bench → Your team → Your plans → Payments
              (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §3, finally executing
              the §2.2 ruling the code never caught up to). Plans sits next to the
              team it branches from; Payments closes the journey rather than
              interrupting it. Flag OFF keeps the shipped build → budget → compare.
              Both are collapsed by default either way, and neither the `#svc-*`
              anchors, the `?tab=` deep links nor the BB_TAB_EVENT bus care about
              DOM order — they resolve by id. */}
          {replan ? (
            <>
              {/* B3 moved "Your plans" OUT of this rail — it is now the
                  full-width row below the grid (see the `compare` mount after
                  this grid closes). Payments stays, and is now the last thing
                  in the rail. */}
              <ServiceSection
                tab="budget"
                heading={SECTION_HEADING.budget}
                collapsible
                open={budgetOpen}
                onToggle={() => setBudgetOpen((v) => !v)}
              >
                {budgetSlot ?? <SectionStub tab="budget" />}
              </ServiceSection>
            </>
          ) : (
            <>
              {/* Budget — a compact lens of the full budget surface, right where the
                  spend decisions happen. Collapsible (like Compare) to keep the rail calm. */}
              <ServiceSection
                tab="budget"
                heading={SECTION_HEADING.budget}
                collapsible
                open={budgetOpen}
                onToggle={() => setBudgetOpen((v) => !v)}
              >
                {budgetSlot ?? <SectionStub tab="budget" />}
              </ServiceSection>

              {/* Compare — collapsed by default (least-used + longest). Expands in
                  place; selecting/scrolling to it auto-opens (compareOpen). */}
              <ServiceSection
                tab="compare"
                heading={SECTION_HEADING.compare}
                collapsible
                open={compareOpen}
                onToggle={() => setCompareOpen((v) => !v)}
              >
                {compareSlot ?? <SectionStub tab="compare" />}
              </ServiceSection>
            </>
          )}
        </div>

        {/* ── B3 · "YOUR PLANS" LEAVES THE 380px RAIL ──────────────────────────
            Plans is a SIDE-BY-SIDE TABLE — one column per saved plan plus
            Current, each carrying a name, a total, an over/under and (B5) a date
            verdict. The rail is a FIXED 380px, so that table had ~330px of
            usable width and an `overflow-x-auto`: the one thing the panel exists
            to do was the one thing its home could not accommodate.

            It is a THIRD GRID CHILD spanning both columns, not a second copy.
            `lg:hidden` + `hidden lg:block` would have been two mounts — and
            because those are `display`, not conditional rendering, BOTH would
            sit in the DOM: duplicate `#svc-compare` ids and two mounts of the
            panel's client state. One mount, placed by the grid.

            Safe to move because every key resolves BY ID, never by DOM position:
            `#svc-compare`, `?tab=compare`, BB_TAB_EVENT and `?open=` all still
            find it. `scroll-mt-24` on the section keeps the deep-link landing
            correct in its new position.

            ⚖ ONE CONSEQUENCE, DELIBERATE AND OWNER-VISIBLE: Plans now comes
            AFTER Payments at every width, where the 2026-07-29 §3 order put it
            between Your team and Payments. Moving it full-width under both
            columns already reorders it on desktop — that IS the requested
            change — and leaving mobile alone would have meant two mounts. So
            mobile follows desktop rather than the two disagreeing. The §3
            reasoning that Plans "sits next to the team it branches from" is what
            is being traded for a table that fits; the owner is judging exactly
            this. */}
        {replan ? (
          <div className="min-w-0 lg:col-span-2">
            <ServiceSection
              tab="compare"
              heading={SECTION_HEADING.compare}
              collapsible
              open={compareOpen}
              onToggle={() => setCompareOpen((v) => !v)}
            >
              {compareSlot ?? <SectionStub tab="compare" />}
            </ServiceSection>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * One stacked section of the single-scroll surface: an anchored `<section>` with
 * a serif heading. Compare AND Budget/Payments pass `collapsible` → the body sits
 * behind a plain "Show" / "Hide" disclosure (controlled by the parent so the nav
 * can open it). The label was hardcoded `'Show comparison'` until 2026-07-29 —
 * a live copy bug, since the SAME button opens the Payments section
 * (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §5). The heading already names
 * the section, so the button only has to name the verb.
 */
function ServiceSection({
  tab,
  heading,
  children,
  collapsible = false,
  open = true,
  onToggle,
}: {
  tab: BudgetBuildTab;
  heading: string;
  children: ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const blurb = tabBlurb(tab);
  const bodyId = `${sectionId(tab)}-body`;
  // Page-level ⓘ (Explore Replan PR-B · spec §11.1) — the bench only, and only
  // behind the flag. The heading keeps its exact pre-replan classes when the ⓘ
  // is absent, so the flag-OFF render is byte-identical.
  const showInfo = tab === 'shortlist' && isExploreReplanEnabled();
  return (
    // scroll-mt clears the sticky desktop `.shell-topbar` when scrolled into view.
    <section id={sectionId(tab)} aria-labelledby={`${sectionId(tab)}-h`} className="scroll-mt-24">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
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
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/5"
          >
            {open ? 'Hide' : 'Show'}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        )}
      </header>
      {(!collapsible || open) && <div id={bodyId}>{children}</div>}
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
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-ink/20 text-ink/55 transition hover:bg-ink/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
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

/**
 * SectionChips (B1) — the in-page wayfinding row.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 * NOT tabs, and it swaps nothing. The desktop tab strip was removed 2026-07-15
 * because the two-column layout already shows every section, and rebuilding
 * panel-switching is the paid-twice mistake this surface already made once.
 * Each chip calls the SHIPPED `goToBuildTab`, which dispatches the existing
 * `BB_TAB_EVENT` that `goToSection` above already handles — so a chip does
 * exactly what the removed mobile dock did: scroll to `#svc-<tab>`, mirror
 * `?tab=`, and expand the section if it is collapsed. No new key, no new
 * anchor, no new bus, no new state.
 *
 * ── WHY IT READS `tabLabel()` ───────────────────────────────────────────────
 * `tabLabel()` is the single label authority (`lib/budget-build.ts`) and is
 * itself flag-gated, so the chips say "Payments" and "Plans" with the flag on
 * and the pre-rename words with it off — the two can never drift. Authoring
 * strings here is exactly what that helper exists to prevent.
 *
 * The section HEADINGS are deliberately longer than these chips ("Your team"
 * vs "Build"): a chip wants a short word, a heading wants a sentence's worth of
 * orientation. Both are flag-aware, so neither can outlive a rename.
 *
 * ── ORDER ───────────────────────────────────────────────────────────────────
 * `BUDGET_BUILD_TABS` is `shortlist · build · budget · compare`, which after B3
 * moved Plans below the grid is the on-page order exactly. Iterated, never
 * re-listed, so a future reorder happens in one place.
 */
function SectionChips() {
  return (
    <nav aria-label="Jump to a section" className="mb-6 flex flex-wrap gap-2">
      {BUDGET_BUILD_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => goToBuildTab(tab)}
          className="inline-flex items-center rounded-full border border-ink/15 bg-cream px-3.5 py-1.5 text-xs font-medium text-ink/70 transition hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {tabLabel(tab)}
        </button>
      ))}
    </nav>
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
