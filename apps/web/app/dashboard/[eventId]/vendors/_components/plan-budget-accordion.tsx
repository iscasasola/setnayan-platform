'use client';

/**
 * PlanBudgetAccordion — the couple-side Vendors tab (FULL VISUAL MATCH).
 *
 * Ports the design prototype Plan_Budget_Accordion_2026-05-31.html into the
 * live surface. Scoped CSS (PBA_CSS, under `.pbacc`) reproduces the prototype
 * look, with the prototype's bare design vars (--paper/--ink/--gold/
 * --mulberry/--serif/--sans/--mono) aliased to the app's Clean Editorial
 * `--m-*` tokens + next/font families so it inherits the platform palette.
 *
 * The five surfaces from Vendors_Plan_Budget_Tab_Spec_2026-05-31.md §2:
 *   1. Dark sticky top budget bar — Chosen Σ · Range vs target · meter.
 *   2. "Where your day stands" overview — estimate · chosen · could-land ·
 *      what-to-lock-next deadline list · scroll cue.
 *   3. 10 sticky-stacking category folders (the taxonomy shrink).
 *   4. Per-category vendor rails — 300px cards (photo · name · city ·
 *      stars · badges · price/linked · eyeing) + a dashed Find-more card.
 *   5. Bottom recap "Look how far you've come".
 *
 * REAL DATA / REAL ACTIONS: tap card → detail route, × → deleteVendor
 * (tap-to-confirm), Lock → finalizeVendor (the canonical lock — hard-single
 * conflict gate · soft-hold gate · auto-archive losers · auto-cascade ·
 * claim-invite; see accordion-lock.tsx), "↩ Change pick" →
 * revertVendorToConsidering. Stars / verified+Setnayan badges / distance
 * render only when the model carries them (vendor_profiles join is a later
 * page-fetch pass) — never fabricated. On a hard-single finalize the rail
 * collapses to the chosen card (the losers are auto-archived); the curve-zoom
 * coverflow + compare drawer are the §4 interaction-polish pass.
 *
 * The page returns this component directly; the dashboard layout provides the
 * tab chrome + outer <main>. The sticky budget bar pins at top-0 of the
 * scroll container (the shared mobile app header sits above it; the bar
 * offsets below it on mobile via --pba-header-offset).
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { LoadingStatus } from '@/components/loading-status';
import { formatPhp } from '@/lib/vendors';
import { formatDistanceKm } from '@/lib/distance';
import { computeCompatScore } from '@/lib/compat-score';
import { deleteVendor } from '../actions';
import { haptic } from '@/lib/haptics';
import { CategorySearchOverlay } from './category-search-overlay';
import { AccordionLockButton, ChangePickButton } from './accordion-lock';
import { ADD_ONS, addOnHref, type AddOnEntry } from '@/lib/add-ons-catalog';
import type { PlanGroupId } from '@/lib/wedding-plan-groups';
import {
  formatPesoCompact,
  formatPesoPrecise,
  type PlanBudgetModel,
  type AccordionFolder,
  type AccordionChild,
  type AccordionPick,
  type DueItem,
  type RecapStats,
} from '@/lib/vendors-plan-budget';

const LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

// First-run guidance coachmark dismissal flag (owner 2026-06-04). One shared
// key gates BOTH the top-of-list coachmark and the point-of-action Lock helper,
// so dismissing the coachmark retires both.
const COACH_KEY = 'pba_coach_v1';

function isLocked(pick: AccordionPick): boolean {
  return pick.raw_status !== null && LOCKED.has(pick.raw_status);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ── In-app Setnayan services, mapped into the category pile ───────────────
// Digital_Services_Cross_Surface_Map_2026-06-03.md §2: Setnayan services live
// INSIDE their canonical category (✦ Setnayan badge, float-to-top), not in a
// standalone launcher grid. Sourced from the single add-ons catalog — the
// `category` field decides placement (see InAppServiceCategory). Computed once
// at module load (the catalog is static).
//   · SVC_BY_GROUP — PlanGroupId → services, prepended to that category's rail.
//   · DIGITAL_SVCS — the synthetic Design › Digital Services rail.
//   · TOOL_SVCS    — couple tools (not category services) → "Tools & extras"
//                    strip. coming_soon tools are omitted (discoverable on the
//                    full /add-ons page), matching the retired launcher's rule.
const SVC_BY_GROUP: ReadonlyMap<PlanGroupId, AddOnEntry[]> = (() => {
  const m = new Map<PlanGroupId, AddOnEntry[]>();
  for (const a of ADD_ONS) {
    if (a.category === 'tool' || a.category === 'digital_services') continue;
    const arr = m.get(a.category);
    if (arr) arr.push(a);
    else m.set(a.category, [a]);
  }
  return m;
})();
const DIGITAL_SVCS: ReadonlyArray<AddOnEntry> = ADD_ONS.filter(
  (a) => a.category === 'digital_services',
);
const TOOL_SVCS: ReadonlyArray<AddOnEntry> = ADD_ONS.filter(
  (a) => a.category === 'tool' && a.status !== 'coming_soon',
);

/**
 * Scoped CSS ported from the prototype. Prototype design vars are aliased to
 * the app's Clean Editorial `--m-*` tokens (already loaded in globals.css)
 * + next/font CSS vars. Everything is namespaced under `.pbacc`
 * (Plan-Budget-ACCordion) so it can't leak into the rest of the dashboard.
 *
 * ⚠ The scope class is `.pbacc`, NOT `.pba`, on purpose — do NOT rename it
 * back. The wedding onboarding flow ships a *global* stylesheet
 * (apps/web/app/onboarding/wedding/_styles/onboarding.css) that was scoped
 * under `.pba` with `.pba{display:flex;justify-content:center}` on its root.
 * That CSS loads once and persists app-wide, so sharing `.pba` leaked the flex
 * in and turned this surface's sticky top budget bar into a left-hand side-nav
 * column (2026-06-03). Onboarding now scopes under `.onbw` and this surface
 * under `.pbacc` — two unique, collision-proof scopes. Keep them distinct.
 */
const PBA_CSS = `
.pbacc{
  --paper:var(--m-paper,#FBFBFA); --ink:var(--m-ink,#1E2229); --ink-soft:#4F535B;
  --gold:var(--m-orange,#C5A059); --gold-deep:var(--m-orange-2,#8C6932);
  --mulberry:var(--m-mulberry,#5C2542); --mulberry-deep:var(--m-mulberry-2,#4A1D36);
  --line:rgba(30,34,41,.12); --line-soft:rgba(30,34,41,.07);
  --card:#fff; /* white card surface in light; flips to lifted obsidian in dark */
  --topbar-h:62px; --head-h:38px;
  /* fixed mobile bottom nav height (≈66px + iOS safe-area). The cover reserves
     this below it so the ↓ cue snaps just above the nav, and the recap clears
     it so its bottom sits just above the nav with no dead scroll. */
  --botnav-h:calc(66px + env(safe-area-inset-bottom, 0px));
  /* mobile: shared app header (sticky, ~64px, lg:hidden) sits above the
     accordion; offset our sticky budget bar + category heads below it.
     desktop: header is lg:hidden, so the @media override below sets 0. */
  --pba-header-offset:64px;
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --spring:cubic-bezier(.34,1.3,.5,1); --ease:cubic-bezier(.22,.61,.36,1);
  /* Full-bleed top: the dashboard <main> adds py-6 (24px) above us; pull up so
     the budget bar sits flush under the sticky app header (no gap on top).
     Full-bleed bottom: cancel the <main> py-6 bottom (24px) AND the EventLayout
     wrapper's pb-20 (80px) so the recap is the TERMINAL element and snaps flush
     above the fixed bottom nav. The page already provides its own exact nav
     clearance via the end-spacer's --botnav-h; without cancelling the outer
     pair the clearance was DOUBLED, leaving ~104px of white dead space below
     the recap ("snap under Transport, not go past it" — owner 2026-06-01).
     Verified in the _pba_verify mirror: gapAboveNav 104 → 0. The lg block
     below resets to -24px (desktop has no pb-20 + no fixed bottom nav). */
  position:relative; margin-top:-24px; margin-bottom:-104px; background:var(--paper); color:var(--ink); font-family:var(--sans);
}
@media (min-width:1024px){.pbacc{--pba-header-offset:0px;margin-bottom:-24px}.pbacc .topbar,.pbacc .meter{margin-left:0;margin-right:0}.pbacc .end-spacer{padding-bottom:30px}}
.pbacc *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

/* ---- Dark top budget bar ---- */
.pbacc .topbar{position:sticky;top:0;z-index:60;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--topbar-h);padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08);margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.pbacc .topbar .bleft{display:flex;flex-direction:column;gap:3px;min-width:0;padding:9px 0}
.pbacc .topbar .fig{display:flex;align-items:baseline;gap:7px;white-space:nowrap;line-height:1.18}
.pbacc .topbar .figk{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);width:46px;flex:0 0 auto}
.pbacc .topbar .figv{font-family:var(--serif);font-style:italic;font-size:19px;font-weight:600;color:var(--paper)}
.pbacc .topbar .rangev{font-family:var(--serif);font-style:italic;font-size:13px;font-weight:600;color:rgba(255,255,255,.6)}
.pbacc .topbar .bright{text-align:right;flex:0 0 auto;padding:9px 0}
.pbacc .topbar .tgt{font-family:var(--serif);font-style:italic;font-size:14px;font-weight:600;color:var(--paper);white-space:nowrap}
.pbacc .topbar .status{font-family:var(--mono);font-size:8px;letter-spacing:.06em;text-transform:uppercase;margin-top:3px;white-space:nowrap;color:rgba(255,255,255,.55)}
.pbacc .topbar .status.ok{color:#7fd49a}
.pbacc .topbar .status.near{color:var(--gold)}
.pbacc .topbar .status.over{color:#ef9a9a}
.pbacc .meter{position:relative;height:3px;background:rgba(30,34,41,.1);margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.pbacc .meter .fill{height:100%;width:0;background:var(--gold);transition:width .55s var(--ease),background .4s var(--ease)}
.pbacc .meter .fill.ok{background:#7fd49a}
.pbacc .meter .fill.near{background:var(--gold)}
.pbacc .meter .fill.over{background:#ef9a9a}

/* ---- Scroll body wrap ---- */
/* No bottom padding: the recap is the terminal element. Its own bottom
   padding (= --botnav-h) clears the fixed mobile nav, so the recap ends just
   above the nav with NO dead scroll below it (owner 2026-05-31). */
.pbacc .body{max-width:760px;margin:0 auto;padding:0}

/* ---- Landing overview ---- */
/* Cover page — the landing overview is the default FIRST view. It fills the
   screen BETWEEN the black bar (top) and the fixed bottom nav, so the ↓ cue
   (margin-top:auto) snaps just above the nav's top border and is never hidden
   behind it (owner 2026-05-31). */
.pbacc .intro{display:flex;flex-direction:column;gap:14px;padding:26px 22px 16px;min-height:calc(100svh - var(--topbar-h) - var(--botnav-h));background:var(--paper)}
.pbacc .intro-eyebrow{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep)}
.pbacc .intro-h{font-family:var(--serif);font-style:italic;font-size:29px;line-height:1.05;color:var(--ink);margin:2px 0 4px}
.pbacc .intro-grid{display:flex;flex-direction:column;gap:10px}
.pbacc .irow3{display:flex;gap:10px}
.pbacc .irow3 .ibox{flex:1;min-width:0}
.pbacc .ibox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 15px}
.pbacc .ik{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.pbacc .iv{font-family:var(--serif);font-style:italic;font-weight:600;font-size:19px;line-height:1.15;color:var(--ink);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* deadline list box */
.pbacc .ibox.dl{padding:13px 15px}
.pbacc .dl-tag{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:2px}
.pbacc .dl-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit}
.pbacc .dl-row:first-of-type{border-top:0}
.pbacc .dl-dot{width:7px;height:7px;border-radius:50%;flex:none}
.pbacc .dl-row.over .dl-dot{background:#b23b34}
.pbacc .dl-row.soon .dl-dot{background:var(--gold)}
.pbacc .dl-row.start .dl-dot{background:var(--gold)}
.pbacc .dl-row.next .dl-dot{background:var(--ink-soft)}
.pbacc .dl-main{flex:1;min-width:0}
.pbacc .dl-name{font-family:var(--serif);font-style:italic;font-weight:600;font-size:15px;line-height:1.1;color:var(--ink)}
.pbacc .dl-sub{font-family:var(--mono);font-size:8px;letter-spacing:.02em;color:var(--ink-soft);margin-top:2px}
.pbacc .dl-when{flex:none;text-align:right;font-family:var(--mono);font-size:8px;line-height:1.3;letter-spacing:.05em;text-transform:uppercase}
.pbacc .dl-when.over{color:#b23b34;font-weight:500}
.pbacc .dl-when.soon{color:var(--gold-deep)}
.pbacc .dl-when.start{color:var(--gold-deep)}
.pbacc .dl-when.next{color:var(--ink-soft)}
.pbacc .dl-empty{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--ink-soft);padding:6px 2px}
.pbacc .intro-cta{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.pbacc .intro-cta .chev{font-size:18px;line-height:1;animation:pba-bob 1.5s var(--ease) infinite}
/* Slide-up "to start" entrance — the cover's content rises in on arrival,
   staggered. (Targets the children, not .intro itself, so it never fights
   the scroll-linked shrink/fade on .intro.) */
@keyframes pba-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.pbacc .intro-eyebrow{animation:pba-rise .5s var(--ease) both}
.pbacc .intro-h{animation:pba-rise .55s var(--ease) .07s both}
.pbacc .intro-grid{animation:pba-rise .6s var(--ease) .14s both}
.pbacc .intro-cta{animation:pba-rise .6s var(--ease) .24s both}
@keyframes pba-bob{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-6px);opacity:1}}
/* Cover — empty state (no picks yet): an intro + a 3-step "how it works" that
   gives direction instead of zeroed-out stats (owner 2026-06-01). Lives inside
   .intro-grid so it inherits the slide-up entrance. */
.pbacc .intro-lead{font-family:var(--sans);font-size:14px;line-height:1.55;color:var(--ink-soft)}
.pbacc .intro-steps{display:flex;flex-direction:column;gap:12px;margin-top:4px}
.pbacc .istep{display:flex;align-items:center;gap:12px}
.pbacc .istep-n{flex:0 0 auto;width:27px;height:27px;border-radius:999px;background:rgba(92,37,66,.08);color:var(--mulberry);font-family:var(--serif);font-style:italic;font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:center}
.pbacc .istep-h{font-family:var(--sans);font-weight:700;font-size:13.5px;color:var(--ink);line-height:1.15}
.pbacc .istep-d{font-family:var(--mono);font-size:9px;letter-spacing:.04em;color:var(--ink-soft);margin-top:1px}
/* Cover — populated state: a budget progress bar (owner 2026-06-01). Tracks
   Range-high vs target, same tone as the top-bar meter. */
.pbacc .intro-meter{display:flex;flex-direction:column;gap:7px}
.pbacc .intro-meter .pm-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.pbacc .intro-meter .pm-k{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.pbacc .intro-meter .pm-v{font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.pbacc .intro-meter .pm-v.ok{color:#2e7d4f}
.pbacc .intro-meter .pm-v.near{color:var(--gold-deep)}
.pbacc .intro-meter .pm-v.over{color:#b23b34}
.pbacc .intro-meter .pm-track{height:7px;border-radius:999px;background:rgba(30,34,41,.07);overflow:hidden}
.pbacc .intro-meter .pm-fill{height:100%;border-radius:999px;background:var(--gold);transition:width .6s var(--ease)}
.pbacc .intro-meter .pm-fill.ok{background:#7fd49a}
.pbacc .intro-meter .pm-fill.near{background:var(--gold)}
.pbacc .intro-meter .pm-fill.over{background:#ef9a9a}

/* ---- Category sticky stacking head + body ---- */
.pbacc .cat{border-top:1px solid var(--line)}
/* Stack-and-stay folder pile: every folder head + body is a flat sibling in
   one shared .cats scroll container (see the render), so each head pins at
   top = topbar-h + idx*head-h and STAYS — heads stack under the budget bar
   as you scroll (Venue→…→Transport) rather than replacing one another.
   scroll-margin-top clears the bar + the heads piled above this one so a
   folder anchor (#folder-*) jump lands the head just below them, never hidden. */
.pbacc .cat-head{position:sticky;top:calc(var(--topbar-h) + var(--idx,0) * var(--head-h));z-index:25;width:100%;height:var(--head-h);background:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px;border:0;border-bottom:1px solid var(--line);text-align:left;transition:background .4s var(--ease),box-shadow .45s var(--ease);scroll-margin-top:calc(var(--pba-header-offset) + var(--topbar-h) + var(--idx,0) * var(--head-h) + 2px)}
/* Group anchor jumps (#group-* from "What to lock next") land the child rail
   just below the budget bar + the folder heads piled above it. --folder-idx is
   set inline on each group wrapper (ChildRail) = its folder's index, so the
   offset is exact per folder (heads 0..idx are all pinned at that scroll). */
.pbacc [id^="group-"]{scroll-margin-top:calc(var(--pba-header-offset) + var(--topbar-h) + (var(--folder-idx,0) + 1) * var(--head-h) + 8px)}
.pbacc .cat-head .nm{font-family:var(--serif);font-style:italic;font-size:18px;font-weight:600;color:var(--ink);letter-spacing:.01em}
.pbacc .cat-head .amt{font-family:var(--serif);font-style:italic;font-size:13.5px;font-weight:600;color:var(--ink)}
.pbacc .cat-head .amt.zero{font-family:var(--mono);font-style:normal;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep)}
.pbacc .cat-head .chev{flex:0 0 auto;color:var(--ink-soft);transition:transform .3s var(--ease)}
.pbacc .cat-head.active{background:var(--card);box-shadow:0 6px 14px -10px rgba(0,0,0,.4)}
.pbacc .cat-head.active .nm{color:var(--mulberry)}
.pbacc .cat-head.active .chev{transform:rotate(180deg);color:var(--mulberry)}
.pbacc .cat-body{padding:14px 0 22px;background:var(--paper)}
.pbacc .cat-empty{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--ink-soft);padding:6px 20px 4px}

/* ---- Child row header ---- */
.pbacc .child-name{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 20px 8px}
.pbacc .child-name .cn{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}

/* dependency nudge (Setnayan AI §4B) — soft sequencing hint per category */
.pbacc .dep-nudge{display:flex;align-items:flex-start;gap:7px;margin:0 20px 9px;padding:8px 11px;border-radius:11px;border:1px solid;font-family:var(--sans,system-ui);font-size:11.5px;line-height:1.32}
.pbacc .dep-nudge .di{flex:0 0 auto;font-size:12px;line-height:1.3}
.pbacc .dep-nudge.blocked{color:var(--gold-deep);background:rgba(197,160,89,.08);border-color:rgba(197,160,89,.32)}
.pbacc .dep-nudge.blocked.soft{color:var(--ink-soft);background:rgba(30,34,41,.035);border-color:rgba(30,34,41,.1)}
.pbacc .dep-nudge.ready{color:var(--mulberry);background:rgba(92,37,66,.055);border-color:rgba(92,37,66,.22)}
.pbacc .dep-nudge strong{font-weight:600}

/* deadline chip */
.pbacc .chip{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 8px;font-family:var(--mono);font-size:8px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.pbacc .chip.locked{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.pbacc .chip.over{color:#b23b34;background:rgba(178,59,52,.1)}
.pbacc .chip.soon{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.pbacc .chip.start{color:var(--gold-deep);background:rgba(197,160,89,.1);box-shadow:inset 0 0 0 1px rgba(197,160,89,.4)}
.pbacc .chip.next{color:var(--ink-soft);background:rgba(30,34,41,.06)}

/* ---- Carousel rail + peek cards ----
   Card width = min(300px, calc(100vw - 96px)). On phones the card is the
   viewport minus ~96px, so the PREVIOUS + NEXT cards always peek ~20px at each
   edge — the "there's more to swipe" cue (owner 2026-06-03). Applies to EVERY
   rail card: vendor picks (.card), in-app Setnayan service cards (.card.svc) and
   the Digital Services rail, since they all share .card. The old fixed 300px
   filled the rail (rail width = 100vw - 32px, the <main> px-4 inset) — and on the
   narrowest phones OVERFLOWED it — leaving no peek. Capped at 300px so on the
   760px .body (tablet/desktop) the design width is unchanged and several cards
   show at once.
   Leading/trailing runway = max(32px, calc(50% - 150px)) so the FIRST + LAST
   cards still reach the CENTER snap: on phones the card is 64px narrower than the
   rail, so 32px (half that gap) centers the end cards exactly; calc(50% - 150px)
   takes over once the card hits its 300px cap. (Was max(20px, …) for the 300px
   card; the 20px floor under-ran the runway for the now-narrower phone card.) */
.pbacc .rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 max(32px, calc(50% - 150px)) 6px;scrollbar-width:none}
.pbacc .rail::-webkit-scrollbar{display:none}
.pbacc .card{position:relative;flex:0 0 min(300px, calc(100vw - 96px));scroll-snap-align:center;display:flex;flex-direction:column}
.pbacc .v{position:relative;display:flex;flex-direction:column;flex:1 1 auto;min-height:300px;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;text-decoration:none;color:inherit;transition:border-color .35s var(--ease),box-shadow .35s var(--ease)}
.pbacc .v:hover{box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}
.pbacc .v .img{height:128px;flex:0 0 128px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center}
.pbacc .v .img img{width:100%;height:100%;object-fit:cover}
.pbacc .v .img .ini{font-family:var(--serif);font-style:italic;font-size:30px;color:rgba(255,255,255,.7)}
.pbacc .v .meta{padding:13px 15px 15px;flex:1 1 auto;display:flex;flex-direction:column}
.pbacc .v .vn{font-family:var(--sans);font-weight:700;font-size:15px;color:var(--ink)}
.pbacc .v .dist{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;color:var(--ink-soft);margin-top:2px}
.pbacc .v .stars{color:var(--gold);font-size:15px;letter-spacing:2px;margin-top:9px}
.pbacc .v .stars .rcount{font-family:var(--mono);font-size:8px;letter-spacing:.03em;color:var(--ink-soft);margin-left:6px;vertical-align:1px}
.pbacc .v .badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.pbacc .bdg{font-family:var(--mono);font-size:7.5px;letter-spacing:.07em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:rgba(30,34,41,.06);color:var(--ink-soft);white-space:nowrap}
.pbacc .bdg.verified{color:#2e7d4f;background:rgba(46,125,79,.1)}
.pbacc .bdg.setnayan{color:var(--mulberry);background:rgba(92,37,66,.1)}
.pbacc .bdg.rec{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.pbacc .bdg.match{font-weight:700}
.pbacc .bdg.match.strong{color:#2e7d4f;background:rgba(46,125,79,.16)}
.pbacc .bdg.match.good{color:var(--gold-deep);background:rgba(197,160,89,.2)}
.pbacc .bdg.match.fair{color:var(--ink-soft);background:rgba(30,34,41,.08)}
.pbacc .v .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:21px;color:var(--ink);margin-top:auto;padding-top:7px}
.pbacc .v .linked{margin-top:auto;padding-top:9px;font-family:var(--mono);font-size:10px;letter-spacing:.03em;color:var(--mulberry);font-weight:500;line-height:1.4}
/* "👀 N also eyeing your date" — an interest/in-demand cue, NOT an error. Gentle
   gold (not the overdue/danger red it used to share) so it reads as gentle
   social proof, never alarming. Aggregate-only + never fabricated (model §6a). */
.pbacc .v .eyeing{margin-top:9px;font-family:var(--mono);font-size:9px;letter-spacing:.02em;color:var(--gold-deep);background:rgba(197,160,89,.12);border-radius:6px;padding:3px 7px;display:inline-block}
/* chosen state — gold border + glow + corner badge */
.pbacc .card.chosen .v{border:3px solid var(--gold);box-shadow:0 0 0 3px rgba(197,160,89,.32)}
.pbacc .pcorner{position:absolute;top:10px;right:10px;z-index:3;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--mulberry);border-radius:999px;padding:5px 9px;box-shadow:0 2px 10px rgba(0,0,0,.28)}
/* remove × (top-left), hidden once chosen */
.pbacc .vx{position:absolute;top:10px;left:10px;z-index:4;min-width:26px;height:26px;padding:0 8px;border:0;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(30,34,41,.5);color:#fff;font-family:var(--sans);font-size:16px;line-height:1;cursor:pointer;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);transition:background .2s var(--ease)}
.pbacc .vx.armed{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;background:var(--mulberry)}
.pbacc .vx-keep{position:absolute;top:10px;left:62px;z-index:4;height:26px;padding:0 10px;border:0;border-radius:999px;background:rgba(30,34,41,.5);color:#fff;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
/* lock CTA */
.pbacc .lockbar{margin-top:10px;padding:0 1px}
.pbacc .lockbtn{width:100%;border:0;border-radius:11px;background:var(--mulberry);color:#fff;font-family:var(--sans);font-weight:700;font-size:12.5px;padding:11px;cursor:pointer;transition:background .2s var(--ease)}
.pbacc .lockbtn:active{background:var(--mulberry-deep)}
.pbacc .lockbtn:disabled{opacity:.6;cursor:default}
.pbacc .changebtn{width:100%;border:1px solid color-mix(in srgb,var(--mulberry) 45%,transparent);border-radius:11px;background:transparent;color:var(--mulberry);font-family:var(--sans);font-weight:600;font-size:11.5px;padding:9px;cursor:pointer;transition:background .2s var(--ease)}
.pbacc .changebtn:active{background:color-mix(in srgb,var(--mulberry) 9%,transparent)}
.pbacc .changebtn:disabled{opacity:.6;cursor:default}
/* dashed find-more card */
.pbacc .add{flex:0 0 132px;scroll-snap-align:center;display:flex;text-decoration:none}
.pbacc .add .inner{flex:1;min-height:191px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;background:rgba(92,37,66,.05);border:1.5px dashed rgba(92,37,66,.4);border-radius:18px;color:var(--mulberry)}
.pbacc .add .plus{font-size:26px;line-height:1;font-weight:300}
.pbacc .add .at{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;line-height:1.4}
/* empty child — slim one-line row */
.pbacc .empty-child{display:flex;align-items:center;gap:10px;margin:0 20px 8px;padding:11px 14px;border:1.5px dashed rgba(92,37,66,.3);border-radius:12px;background:rgba(92,37,66,.03);text-decoration:none;color:inherit}
.pbacc .empty-child .ep{font-size:17px;color:var(--mulberry);font-weight:300;line-height:1}
.pbacc .empty-child .en{font-family:var(--sans);font-size:13.5px;font-weight:600;color:var(--mulberry)}
.pbacc .empty-child .eh{margin-left:auto;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#b8b4ac}
/* .add + .empty-child are <button>s (open the in-place Category Search
   overlay) — neutralize UA button chrome so they render exactly as the
   former anchors did. */
.pbacc .add,.pbacc .empty-child{appearance:none;-webkit-appearance:none;font:inherit;cursor:pointer;text-align:left;width:auto}
.pbacc .add{border:0;background:none;padding:0}
/* Empty-category "Find …" rows stretch full width (minus the 20px side
   margins) instead of shrink-wrapping their label (owner 2026-05-31). */
.pbacc .empty-child{width:calc(100% - 40px)}

/* ---- Compare (like-for-like; read-only — never sets the pick) ---- */
.pbacc .cn-right{display:flex;align-items:center;gap:8px}
.pbacc .cmpbtn{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(92,37,66,.4);background:rgba(92,37,66,.06);color:var(--mulberry);border-radius:999px;padding:4px 10px;font-family:var(--mono);font-size:8px;letter-spacing:.08em;text-transform:uppercase;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .2s var(--ease)}
.pbacc .cmpbtn:active{background:rgba(92,37,66,.14)}
.pbacc .cmpsheet{position:fixed;inset:0;z-index:90;background:var(--paper);display:flex;flex-direction:column;animation:cmpup .3s var(--ease)}
@keyframes cmpup{from{transform:translateY(100%)}to{transform:none}}
.pbacc .cmpwrap{width:100%;max-width:620px;margin:0 auto;flex:1;display:flex;flex-direction:column;min-height:0}
.pbacc .cmphead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:calc(18px + env(safe-area-inset-top)) 20px 12px;border-bottom:1px solid var(--line)}
.pbacc .cmptitle{display:flex;flex-direction:column;gap:3px;min-width:0}
.pbacc .cmpcat{font-family:var(--serif);font-style:italic;font-size:22px;color:var(--ink);line-height:1}
.pbacc .cmpsub{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.pbacc .cmpclose{border:none;background:rgba(30,34,41,.06);color:var(--ink);width:32px;height:32px;border-radius:999px;font-size:15px;cursor:pointer;flex:0 0 auto}
.pbacc .cmpbody{flex:1;overflow:auto}
.pbacc .cmptable{width:100%;border-collapse:collapse;font-family:var(--sans)}
.pbacc .cmptable tr{border-bottom:1px solid var(--line-soft)}
.pbacc .cmptable th{text-align:left;vertical-align:top;font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);font-weight:500;padding:12px 8px 12px 20px;width:84px;white-space:nowrap}
.pbacc .cmptable td{vertical-align:top;padding:12px 14px 12px 8px;font-size:13px;color:var(--ink);line-height:1.35}
.pbacc .cmptable td+td{border-left:1px solid var(--line-soft)}
.pbacc .cmprow-name td{font-weight:700;font-size:13.5px}
.pbacc .cmprow-price td{font-family:var(--serif);font-style:italic;font-size:16px;color:var(--mulberry)}
.pbacc .cmpwin{color:var(--gold-deep);font-family:var(--mono);font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;display:block;margin-top:3px}
.pbacc .cmpfoot{padding:12px 20px calc(16px + env(safe-area-inset-bottom)) 20px;font-size:11px;line-height:1.45;color:var(--ink-soft);border-top:1px solid var(--line);background:rgba(197,160,89,.06)}

/* ---- Press feedback (owner 2026-05-31: taps must feel responsive). The
   tap-highlight is killed globally, so the link-cards (.v/.add/.empty-child,
   which are <a> and miss the global button rule) + the in-card buttons get a
   quick scale-down on :active. .card itself carries the coverflow transform, so
   we scale the inner .v — never the .card — to avoid fighting it. ---- */
.pbacc .v,.pbacc .add,.pbacc .empty-child{transition:transform .13s cubic-bezier(.2,.7,.2,1),border-color .35s var(--ease),box-shadow .35s var(--ease)}
.pbacc .lockbtn,.pbacc .changebtn,.pbacc .cmpbtn,.pbacc .cmpclose,.pbacc .vx{transition:transform .13s cubic-bezier(.2,.7,.2,1),background .2s var(--ease)}
.pbacc .v:active,.pbacc .add:active,.pbacc .empty-child:active{transform:scale(.98)}
.pbacc .lockbtn:active,.pbacc .changebtn:active,.pbacc .cmpbtn:active,.pbacc .cmpclose:active,.pbacc .vx:active{transform:scale(.93)}
/* Keyboard focus ring (a11y) — the global tap-highlight is killed, so define a
   visible :focus-visible outline for every interactive element (cards, lock,
   compare, remove, find, due-rows). Gold accent at 2px offset; the outline
   auto-rounds to each element's border-radius. */
.pbacc a:focus-visible,.pbacc button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

/* ---- Recap ---- */
/* Bottom padding = nav height so the recap's bottom sits just above the fixed
   mobile nav — recap is the terminal element, no dead scroll (owner 2026-05-31). */
.pbacc .end-spacer{padding:30px 18px var(--botnav-h)}
/* Unlock-more-categories affordance — under the recap (has picks) and in the
   empty-state cover (no picks). Owner 2026-06-02: keep the Vendors page to the
   categories the couple is shopping; this is the door to add the rest. */
.pbacc .catunlock{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:16px;padding:15px 18px;border-radius:16px;border:1.5px solid var(--gold);background:transparent;color:var(--ink);font-family:var(--sans);font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.pbacc .catunlock:hover{background:rgba(197,160,89,0.12);border-color:var(--gold-deep)}
.pbacc .catunlock .cu-ico{font-size:17px;line-height:1;color:var(--gold-deep)}
.pbacc .endcard{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;background:var(--mulberry);color:#fff;border-radius:22px;padding:24px 22px 22px}
.pbacc .end-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.pbacc .end-h{font-family:var(--serif);font-style:italic;font-weight:600;font-size:26px;line-height:1.05;color:#fff;margin:2px 0}
.pbacc .end-line{font-family:var(--sans);font-size:11.5px;line-height:1.5;color:rgba(255,255,255,.8);max-width:280px}
.pbacc .end-stats{display:flex;width:100%;margin-top:10px;padding-top:14px;border-top:1px solid rgba(255,255,255,.2)}
.pbacc .end-stats>div{flex:1;border-left:1px solid rgba(255,255,255,.14)}
.pbacc .end-stats>div:first-child{border-left:0}
.pbacc .esv{font-family:var(--serif);font-style:italic;font-weight:600;font-size:24px;line-height:1;color:#fff}
.pbacc .esk{font-family:var(--mono);font-size:7.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:5px}
/* Randomized feel-good line — different on every open (owner 2026-06-01). */
.pbacc .end-motivate{font-family:var(--serif);font-style:italic;font-size:17px;line-height:1.35;color:#fff;margin-top:16px;max-width:300px}

/* ---- Scroll-driven motion (transforms set per-frame from JS; CSS only
   smooths + declares will-change + the reduced-motion reset). All targets
   are always-rendered + always visible — these effects are cosmetic, so a
   miscalc degrades to "looks flat", never "content hidden"). ---- */
.pbacc .intro{transform-origin:top center;will-change:transform,opacity;transition:transform .15s var(--ease),opacity .15s var(--ease)}
.pbacc .child-block{transform-origin:top center;will-change:transform,opacity;transition:transform .12s linear,opacity .12s linear}
.pbacc .card{will-change:transform,opacity;transition:transform .08s linear,opacity .08s linear}
/* No .rail{perspective} — the rotateY coverflow tilt was removed (owner
   2026-06-05); perspective only mattered for that 3-D rotation. */
@media (prefers-reduced-motion:reduce){
  .pbacc .intro,.pbacc .child-block,.pbacc .card{transform:none!important;opacity:1!important;transition:none!important}
  .pbacc .intro-eyebrow,.pbacc .intro-h,.pbacc .intro-grid,.pbacc .intro-cta{animation:none!important;opacity:1!important;transform:none!important}
}

/* ───────── Dark mode (owner 2026-06-01: the black budget bar — and the whole
   sheet — flip to a light surface when the theme is dark). Light mode is
   untouched: every rule here only ADDS under html.dark. The bar is
   background:var(--ink)/color:var(--paper), so re-aliasing the local tokens
   flips it (and the sheet) automatically; the rest are the hardcoded
   light/white values that don't ride a token. ───────── */
html.dark .pbacc{
  --paper:#1E2229; --ink:#FBFBFA; --ink-soft:#B6B9BE;
  --line:rgba(251,251,250,.16); --line-soft:rgba(251,251,250,.1);
  --card:#2A2E36; --gold:#E0CCA0; --gold-deep:#C5A059;
}
/* bar is now a light surface → flip its muted white text + hairline + accents */
html.dark .pbacc .topbar{border-bottom-color:rgba(30,34,41,.1)}
html.dark .pbacc .topbar .figk{color:rgba(30,34,41,.5)}
html.dark .pbacc .topbar .rangev{color:rgba(30,34,41,.6)}
html.dark .pbacc .topbar .status{color:rgba(30,34,41,.5)}
html.dark .pbacc .topbar .status.ok{color:#2e7d4f}
html.dark .pbacc .topbar .status.near{color:#8C6932}
html.dark .pbacc .topbar .status.over{color:#b23b34}
/* dark-tinted tracks/buttons that vanish on a dark sheet → light-tinted */
html.dark .pbacc .meter{background:rgba(251,251,250,.12)}
html.dark .pbacc .intro-meter .pm-track{background:rgba(251,251,250,.1)}
html.dark .pbacc .chip.next{background:rgba(251,251,250,.08)}
html.dark .pbacc .chip.start{background:rgba(197,160,89,.14)}
html.dark .pbacc .cmpclose{background:rgba(251,251,250,.1)}
html.dark .pbacc .cat-head.active{box-shadow:0 6px 16px -10px rgba(0,0,0,.7)}
/* --mulberry stays dark as a FILL (recap card + CTAs keep white text); but
   mulberry-as-TEXT needs to lighten so it reads on the dark sheet/cards */
html.dark .pbacc .cat-head.active .nm,
html.dark .pbacc .empty-child .en,
html.dark .pbacc .istep-n,
html.dark .pbacc .cmpbtn,
html.dark .pbacc .cmprow-price td{color:#C99DB0}

/* ===== Guidance layer (owner 2026-06-04) — make the populated cover DIRECTIVE
   and teach the loop in the rails. (1) .intro-next = action-first "do this next"
   banner promoting the single most-urgent category to a tappable jump; (2)
   .intro-loop = persistent Find→Shortlist→Lock legend so the mechanic no longer
   vanishes after the first pick; (3) .pba-coach + .lockhint = one-time first-run
   coachmark + point-of-action Lock helper, shown only while the couple has
   shortlisted but locked nothing, dismissible (localStorage 'pba_coach_v1'). */
.pbacc .intro-next{display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:16px;background:rgba(92,37,66,.06);border:1px solid rgba(92,37,66,.22);text-decoration:none;color:inherit}
.pbacc .intro-next.calm{background:var(--card);border-color:var(--line)}
.pbacc .intro-next .nx-ico{flex:0 0 auto;width:34px;height:34px;border-radius:999px;background:var(--mulberry);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1}
.pbacc .intro-next.calm .nx-ico{background:rgba(92,37,66,.12);color:var(--mulberry)}
.pbacc .intro-next .nx-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.pbacc .intro-next .nx-k{font-family:var(--mono);font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:var(--mulberry)}
.pbacc .intro-next.calm .nx-k{color:var(--ink-soft)}
.pbacc .intro-next .nx-h{font-family:var(--serif);font-style:italic;font-weight:600;font-size:17px;line-height:1.12;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pbacc .intro-next .nx-d{font-family:var(--mono);font-size:9px;letter-spacing:.02em;color:var(--ink-soft);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pbacc .intro-next .nx-go{flex:0 0 auto;color:var(--mulberry);font-size:20px;line-height:1}
.pbacc .intro-next.calm .nx-go{display:none}
.pbacc .intro-loop{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 4px}
.pbacc .intro-loop .lp{display:flex;align-items:center;gap:6px;min-width:0}
.pbacc .intro-loop .lp-n{flex:0 0 auto;width:18px;height:18px;border-radius:999px;background:rgba(92,37,66,.1);color:var(--mulberry);font-family:var(--mono);font-size:9px;font-weight:600;display:flex;align-items:center;justify-content:center}
.pbacc .intro-loop .lp-t{font-family:var(--mono);font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);white-space:nowrap}
.pbacc .intro-loop .lp-sep{flex:0 0 auto;color:var(--ink-soft);opacity:.45;font-size:11px}
.pbacc .pba-coach{position:relative;margin:14px 18px 2px;padding:14px 42px 14px 15px;border-radius:16px;background:rgba(197,160,89,.1);border:1px solid rgba(197,160,89,.4);animation:pba-rise .5s var(--ease) both}
.pbacc .pba-coach .pc-k{font-family:var(--mono);font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-deep)}
.pbacc .pba-coach .pc-h{font-family:var(--serif);font-style:italic;font-weight:600;font-size:16px;color:var(--ink);margin:2px 0 9px;line-height:1.2}
.pbacc .pba-coach .pc-list{display:flex;flex-direction:column;gap:7px}
.pbacc .pba-coach .pc-row{display:flex;gap:8px;font-family:var(--sans);font-size:12.5px;line-height:1.42;color:var(--ink-soft)}
.pbacc .pba-coach .pc-b{flex:0 0 auto;font-weight:700;color:var(--mulberry)}
.pbacc .pba-coach .pc-x{position:absolute;top:9px;right:9px;width:25px;height:25px;border:0;border-radius:999px;background:rgba(30,34,41,.07);color:var(--ink-soft);font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pbacc .lockhint{margin-top:7px;font-family:var(--mono);font-size:8.5px;line-height:1.5;letter-spacing:.015em;color:var(--gold-deep);background:rgba(197,160,89,.1);border-radius:8px;padding:7px 9px}
html.dark .pbacc .intro-next .nx-k,
html.dark .pbacc .intro-next.calm .nx-ico,
html.dark .pbacc .intro-next .nx-go,
html.dark .pbacc .intro-loop .lp-n,
html.dark .pbacc .pba-coach .pc-b{color:#C99DB0}
html.dark .pbacc .pba-coach{background:rgba(197,160,89,.14);border-color:rgba(197,160,89,.45)}
html.dark .pbacc .lockhint{background:rgba(197,160,89,.14)}

/* ---- In-app Setnayan service cards (nested, supplementary, float-to-top) ----
   Rendered as the FIRST cards in a category rail (Papic/Panood/Save-the-Date →
   Photography & Video · Patiktok → Photobooth · LED → LED Background) + in the
   synthetic Design › Digital Services rail. A full-bleed cinema poster (not the
   white vendor card) so they read instantly as a Setnayan first-party
   production, distinct from external-vendor picks — same 300px rail-card sizing
   so the coverflow snap stays aligned. Supplementary + non-saturating: never a
   "pick", no Lock / Remove (Digital_Services_Cross_Surface_Map §2-3). */
.pbacc .card.svc .v{padding:0;border:1px solid var(--line);color:#fff}
.pbacc .card.svc .v:hover{box-shadow:0 12px 32px -16px rgba(0,0,0,.5)}
.pbacc .svc-poster,.pbacc .svc-motion,.pbacc .svc-scrim{position:absolute;inset:0}
.pbacc .svc-motion{mix-blend-mode:screen}
.pbacc .svc-scrim{background:linear-gradient(to top,rgba(18,16,14,.92) 4%,rgba(18,16,14,.5) 44%,rgba(18,16,14,.08) 80%)}
.pbacc .svc-top{position:absolute;top:12px;left:12px;right:12px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px}
.pbacc .svc-badge{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:rgba(92,37,66,.62);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 9px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pbacc .svc-pill{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:rgba(255,255,255,.18);border-radius:999px;padding:4px 8px;white-space:nowrap;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.pbacc .svc-body{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:14px 16px 16px}
.pbacc .svc-name{font-family:var(--serif);font-style:italic;font-weight:600;font-size:21px;line-height:1.08;color:#fff}
.pbacc .svc-blurb{font-family:var(--sans);font-size:11px;line-height:1.4;color:rgba(255,255,255,.82);margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pbacc .svc-cta{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#fff;margin-top:10px}
.pbacc .card.svc.soon .v{filter:saturate(.9)}
.pbacc .svc-cta.soon{color:rgba(255,255,255,.72)}
/* Digital Services synthetic rail header — same row as .child-name. */
.pbacc .ds-tag{color:var(--mulberry)}
html.dark .pbacc .ds-tag{color:#C99DB0}

/* ---- Tools & extras strip (inside the end-spacer, above the recap) ----
   Couple tools that aren't category services (Orders / Playlist / QR / Indoor
   Blueprint / Photo Delivery / Paprint). A compact horizontal chip row so they
   stay reachable without competing with the category pile. */
.pbacc .tools{margin:2px 0 24px}
.pbacc .tools-tag{font-family:var(--mono);font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-soft);margin:0 2px 11px}
.pbacc .tools-row{display:flex;gap:9px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.pbacc .tools-row::-webkit-scrollbar{display:none}
.pbacc .tool{flex:0 0 auto;display:inline-flex;align-items:center;gap:9px;padding:10px 13px;border-radius:13px;border:1px solid var(--line);background:var(--card);text-decoration:none;color:var(--ink)}
.pbacc .tool:hover{border-color:rgba(92,37,66,.35)}
.pbacc .tool-ico{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:rgba(92,37,66,.08);color:var(--mulberry)}
html.dark .pbacc .tool-ico{color:#C99DB0;background:rgba(201,157,176,.14)}
.pbacc .tool-tx{display:flex;flex-direction:column;line-height:1.2}
.pbacc .tool-nm{font-family:var(--sans);font-weight:600;font-size:13px;color:var(--ink)}
.pbacc .tool-cta{font-family:var(--mono);font-size:8px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin-top:2px}
.pbacc .tools-all{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;padding:0 16px;border-radius:13px;border:1.5px dashed rgba(92,37,66,.4);background:transparent;color:var(--mulberry);font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;white-space:nowrap}
html.dark .pbacc .tools-all{color:#C99DB0}
.pbacc .tool,.pbacc .tools-all{transition:transform .13s cubic-bezier(.2,.7,.2,1),border-color .2s var(--ease)}
.pbacc .tool:active,.pbacc .tools-all:active{transform:scale(.97)}

/* ---- "Dig deeper" open transition (owner 2026-06-05: "when we tap, the card
   enlarges to show that we are digging deeper to that service … make sure to
   have a loading screen"). On tap the card enlarges — scale-up on the inner .v
   (NOT .card) so it never fights the per-frame scroll-zoom the engine writes to
   .card — and a full-screen loading overlay covers the page. The overlay is
   lifted to root (see ServiceOpenOverlay) so its position:fixed escapes the
   curve-transformed .child-block ancestors. Placed AFTER the :active press rules
   so .opening wins the tapped card's transform. ---- */
.pbacc .card.opening{z-index:40}
.pbacc .card.opening .v{transform:scale(1.06);border-color:var(--gold);box-shadow:0 26px 60px -22px rgba(0,0,0,.5);transition:transform .24s var(--spring),box-shadow .24s var(--ease),border-color .24s var(--ease)}
.pbacc .pbopen{position:fixed;inset:0;z-index:95;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;padding:0 28px;background:color-mix(in srgb,var(--paper) 86%,transparent);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);animation:pba-openfade .22s var(--ease) both}
@keyframes pba-openfade{from{opacity:0}to{opacity:1}}
.pbacc .pbopen-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(197,160,89,.28);border-top-color:var(--gold);animation:pba-openrot .7s linear infinite}
@keyframes pba-openrot{to{transform:rotate(360deg)}}
.pbacc .pbopen-k{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep)}
.pbacc .pbopen-nm{font-family:var(--serif);font-style:italic;font-size:22px;line-height:1.2;color:var(--ink);text-align:center;max-width:340px}
.pbacc .pbopen-status{margin-top:1px;font-family:var(--sans);font-size:12.5px;font-weight:600;letter-spacing:.01em;color:var(--ink-soft);text-align:center}
@media (prefers-reduced-motion:reduce){
  .pbacc .card.opening .v{transition:none}
  .pbacc .pbopen{animation:none}
}
`;

// ── Root ────────────────────────────────────────────────────────────────
export function PlanBudgetAccordion({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Compare sheet — which child category (≥2 shortlisted) is being compared.
  // Lifted to root so the fixed-position sheet escapes the curve-transformed
  // .child-block ancestors (a transform would make position:fixed local).
  const [compare, setCompare] = useState<AccordionChild | null>(null);
  // Category-search overlay: opened in-place from the Find / Add buttons
  // (replaces the marketplace jump). Scoped to one plan group.
  const [search, setSearch] = useState<{ groupId: string; label: string } | null>(null);
  const openSearch = (groupId: string, label: string) => setSearch({ groupId, label });

  // ── "Dig deeper" open transition (owner 2026-06-05) ──────────────────────
  // Tapping a service/vendor card enlarges it (local .opening state on the card)
  // then opens its detail. The full-screen loading overlay is lifted to root —
  // like CompareSheet — so its position:fixed escapes the curve-transformed
  // .child-block ancestors (a transform would make it position relative to the
  // ancestor, not the viewport). The brief delay lets the tapped card's enlarge
  // play before we navigate; the destination route's loading.tsx then carries
  // the same loading screen until the detail page is ready.
  const router = useRouter();
  const [opening, setOpening] = useState<{ label: string } | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openService = (href: string, label: string) => {
    if (opening) return; // a navigation is already in flight — ignore re-taps
    haptic('select');
    setOpening({ label });
    openTimer.current = setTimeout(() => router.push(href), 220);
  };
  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );

  // ── First-run guidance (owner 2026-06-04) ────────────────────────────────
  // The cover only taught the Find→Shortlist→Lock loop on its EMPTY state; once
  // the couple had a single pick it vanished. This coachmark fills that gap. It
  // shows at the top of the category list (what the eye hits on swipe-up) ONLY
  // while they've shortlisted something but locked nothing yet — the "I have
  // cards, now what?" moment — and self-retires after the first lock.
  // Dismissible → localStorage. Default false on SSR (no hydration mismatch); a
  // mount effect flips it on when eligible + not previously dismissed.
  const coachEligible =
    model.recap.shortlisted > 0 && model.recap.finalized === 0;
  const [showCoach, setShowCoach] = useState(false);
  useEffect(() => {
    if (!coachEligible) {
      setShowCoach(false);
      return;
    }
    try {
      setShowCoach(localStorage.getItem(COACH_KEY) !== 'dismissed');
    } catch {
      setShowCoach(true);
    }
  }, [coachEligible]);
  const dismissCoach = () => {
    setShowCoach(false);
    try {
      localStorage.setItem(COACH_KEY, 'dismissed');
    } catch {
      /* private mode — the dismissal just won't persist */
    }
  };
  // The first card the couple can lock (first non-finalized child with an
  // unlocked pick) — anchors the one-time "what Lock does" helper to the exact
  // point of action. Keyed "groupId|vendorId" so a single string threads down.
  const firstLockTarget = (() => {
    for (const folder of model.folders) {
      for (const child of folder.children) {
        if (child.state === 'finalized') continue;
        const pick = child.picks.find((p) => !isLocked(p));
        if (pick) return `${child.groupId}|${pick.vendor_id}`;
      }
    }
    return null;
  })();
  const lockHintKey = showCoach ? firstLockTarget : null;

  // Scroll-driven motion (prototype Plan_Budget_Accordion_2026-05-31.html):
  //   · sizeIntro   — the "Where your day stands" overview scales + fades as it
  //                   scrolls up under the sticky topbar.
  //   · syncStates  — each .child-block curve-zooms (scale + fade by distance
  //                   from a focus line) so child categories visually merge into
  //                   their sticky parent header as you scroll past them.
  //   · curveRail   — per horizontal rail, cards get a scale/opacity zoom by
  //                   offset from rail-center (the centered card is largest; NO
  //                   3-D tilt — owner 2026-06-05 "no need for the tilt … it is
  //                   shaking") + a haptic buzz when the centered card changes.
  // Fail-safe by construction: every target is always rendered + visible; these
  // are cosmetic transforms set per-frame. A null ref / bad calc degrades to
  // "flat", never "hidden". prefers-reduced-motion → no-op. rAF-throttled; all
  // listeners + the pending frame are torn down on unmount / model change.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let raf = 0;
    const snapIndex = new WeakMap<Element, number>();

    // Cache the scroll-driven targets ONCE per effect-run. The folders + rails
    // all render up-front (no lazy mount), and the effect re-runs on [model]
    // change — the only time the set changes — so per-frame querySelectorAll +
    // tree-walks (3 of them, plus a `.card,.add` query per rail) were pure
    // waste. Each rail's cards are cached too (the heaviest per-frame loop).
    const intro = root.querySelector<HTMLElement>('.intro');
    const childBlocks = Array.from(
      root.querySelectorAll<HTMLElement>('.child-block'),
    );
    const rails = Array.from(root.querySelectorAll<HTMLElement>('.rail')).map(
      (rail) => ({
        rail,
        cards: Array.from(rail.querySelectorAll<HTMLElement>('.card, .add')),
      }),
    );

    const frame = () => {
      raf = 0;
      const vh = window.innerHeight || 1;

      // sizeIntro
      if (intro) {
        const r = intro.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
        intro.style.transform = `scale(${(1 - p * 0.06).toFixed(4)})`;
        intro.style.opacity = (1 - p * 0.55).toFixed(3);
      }

      // syncStates — child-block curve-merge into the sticky parent header
      const focus = vh * 0.38;
      for (const el of childBlocks) {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const norm = Math.min(1, Math.abs(center - focus) / vh);
        el.style.transform = `scale(${(1 - norm * 0.12).toFixed(4)})`;
        el.style.opacity = (1 - norm * 0.45).toFixed(3);
      }

      // curveRail — coverflow + snap buzz
      for (const { rail, cards } of rails) {
        const rr = rail.getBoundingClientRect();
        // Off-screen rail → skip its per-card transforms (the heaviest work).
        // Its cards keep their last transform until it re-enters view; the
        // effect is cosmetic, so a stale-while-offscreen transform is harmless.
        if (rr.bottom < 0 || rr.top > vh) continue;
        const railCenter = rr.left + rr.width / 2;
        const half = rr.width / 2 || 1;
        let nearest = -1;
        let nearestDist = Infinity;
        cards.forEach((card, i) => {
          const cr = card.getBoundingClientRect();
          const d = cr.left + cr.width / 2 - railCenter;
          const n = Math.max(-1, Math.min(1, d / half));
          // Scale-only zoom (owner 2026-06-05). The rotateY coverflow tilt was
          // removed — its per-frame sign-flip near rail-center read as a wobble
          // ("it is shaking"). Scale + opacity alone stay smooth and the centred
          // card still reads as the focused one ("we can do the enlarge").
          card.style.transform = `scale(${(1 - Math.abs(n) * 0.12).toFixed(4)})`;
          card.style.opacity = (1 - Math.abs(n) * 0.4).toFixed(3);
          const ad = Math.abs(d);
          if (ad < nearestDist) {
            nearestDist = ad;
            nearest = i;
          }
        });
        const prev = snapIndex.get(rail) ?? -1;
        if (nearest !== -1 && nearest !== prev) {
          snapIndex.set(rail, nearest);
          // Rail-snap tick. Scroll context (not a tap), so iOS-switch is skipped
          // — Android-only here; iOS scroll haptics need the native app (0052).
          if (prev !== -1) haptic('tick', { iosSwitch: false });
        }
      }
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(frame);
    };

    frame(); // initial paint
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [model]);

  return (
    <div className="pbacc" ref={rootRef}>
      <style>{PBA_CSS}</style>
      {/* This page replaces the app top-nav with its own persistent black
          budget bar. Hide the SidebarShell sticky top strip while the
          Vendors tab is mounted (the rule lives only in this page's DOM, so
          the nav returns the moment you navigate away). Bottom nav stays for
          tab switching.

          overscroll-behavior-y:none — the page scrolls on the WINDOW
          (SidebarShell main is min-h-screen, no inner overflow), so dragging
          past the recap rubber-banded the document down into the bare html
          background (a gap below the dark sheet — owner 2026-06-01 "should not
          move up like this"). Pinning the document over-scroll stops that
          bounce. Scoped to this tab via this injected rule (removed on nav
          away), so pull-to-refresh elsewhere is untouched. PR #720 moved the
          recap inside .cats (the pile fix); this is the separate over-scroll
          half it did not cover. */}
      <style>{`.shell-topbar{display:none}html,body{overscroll-behavior-y:none}`}</style>
      <TopBar model={model} />
      <div className="body">
        <Overview model={model} eventId={eventId} />

        {/* Single shared scroll container: every category head + body is a
            flat sibling here, so each sticky head piles UNDER the black bar
            (top = topbar-h + idx*head-h) and STAYS — a true stack-and-stay
            pile (Venue→…→Transport). Bounded per-folder <section>s would
            un-stick each head the moment its own section scrolled out. */}
        <div className="cats">
          {showCoach && (
            <div className="pba-coach" role="note">
              <button
                type="button"
                className="pc-x"
                aria-label="Dismiss tip"
                onClick={dismissCoach}
              >
                ✕
              </button>
              <div className="pc-k">How this works</div>
              <div className="pc-h">
                You&rsquo;ve shortlisted some vendors — here&rsquo;s the next
                move.
              </div>
              <div className="pc-list">
                <div className="pc-row">
                  <span className="pc-b">Tap</span>
                  <span>a card to open the vendor and see the full details.</span>
                </div>
                <div className="pc-row">
                  <span className="pc-b">Compare</span>
                  <span>two or more side by side before you decide.</span>
                </div>
                <div className="pc-row">
                  <span className="pc-b">Lock this pick</span>
                  <span>
                    on the one you choose — your budget updates and the vendor
                    is notified. You can change it anytime.
                  </span>
                </div>
              </div>
            </div>
          )}
          {model.folders.map((folder, index) => (
            <FolderSection
              key={folder.folder}
              folder={folder}
              eventId={eventId}
              index={index}
              onCompare={setCompare}
              onOpenSearch={openSearch}
              onOpen={openService}
              lockHintKey={lockHintKey}
            />
          ))}
          {/* Recap lives INSIDE .cats (not a sibling after it): the pile's
              containing block then spans through the recap, so EVERY category
              head — including Prints + Transport — STAYS pinned at max scroll
              instead of un-pinning as the recap arrives. Also stops the
              headers detaching/floating on over-scroll. (owner 2026-06-01) */}
          {/* Recap always caps the pile (owner 2026-06-02): the summary is the
              terminal element regardless of picks. searched + hoursSaved derive
              from the market pool, so a no-pick event still shows a meaningful
              summary instead of nothing. */}
          <div className="end-spacer">
            <InAppToolsStrip eventId={eventId} />
            <Recap recap={model.recap} />
            {model.inactiveCategoryCount > 0 && (
              <a className="catunlock" href={`/dashboard/${eventId}/vendors/categories`}>
                <span className="cu-ico" aria-hidden>
                  +
                </span>
                Unlock {model.inactiveCategoryCount} more categor
                {model.inactiveCategoryCount === 1 ? 'y' : 'ies'}
              </a>
            )}
          </div>
        </div>

        {compare && (
          <CompareSheet child={compare} onClose={() => setCompare(null)} />
        )}

        {search && (
          <CategorySearchOverlay
            eventId={eventId}
            groupId={search.groupId}
            label={search.label}
            onClose={() => setSearch(null)}
          />
        )}

        {/* Full-screen loading screen shown while we open a tapped card's
            detail. Lifted here (root) so position:fixed escapes the
            curve-transformed .child-block ancestors. */}
        {opening && <ServiceOpenOverlay label={opening.label} />}
      </div>
    </div>
  );
}

// Full-screen "opening this service" loading overlay (owner 2026-06-05). Shows
// during the brief enlarge-then-navigate window after a card tap; the
// destination route's loading.tsx continues the same spinner after the swap, so
// the hand-off is seamless. role=status + aria-live announce it to AT.
const OPEN_MESSAGES = [
  'Setting things up…',
  'Loading the details…',
  'Almost there…',
];

function ServiceOpenOverlay({ label }: { label: string }) {
  return (
    <div
      className="pbopen"
      role="status"
      aria-live="polite"
      aria-label={`Opening ${label}`}
    >
      <div className="pbopen-spin" aria-hidden />
      <div className="pbopen-k">Opening</div>
      <div className="pbopen-nm">{label}</div>
      <LoadingStatus className="pbopen-status" messages={OPEN_MESSAGES} />
    </div>
  );
}

// ── Surface 1 · Dark top budget bar ───────────────────────────────────────
function TopBar({ model }: { model: PlanBudgetModel }) {
  const hasRange = model.rangeHiCentavos > 0;
  const tone: 'ok' | 'near' | 'over' =
    model.budgetStatus === 'over'
      ? 'over'
      : model.budgetStatus === 'near'
        ? 'near'
        : 'ok';
  const statusWord =
    model.targetCentavos === null
      ? null
      : model.budgetStatus === 'over'
        ? 'over target'
        : model.budgetStatus === 'near'
          ? 'close to target'
          : 'on track';

  // Fragment (not a wrapper <div>): the bar + meter must be DIRECT children
  // of .pbacc so the sticky bar's containing block is .pbacc (tall, spans the
  // whole list) and it stays pinned at top:0 for the entire scroll. A wrapper
  // <div> would be only ~65px tall, so the sticky bar would un-stick the
  // moment you scroll past it (the "black row goes up" bug).
  return (
    <>
      <div className="topbar">
        <div className="bleft">
          <div className="fig">
            <span className="figk">Chosen</span>
            <span className="figv">{formatPesoCompact(model.chosenCentavos)}</span>
          </div>
          {hasRange && (
            <div className="fig">
              <span className="figk">Range</span>
              <span className="rangev">
                {formatPesoCompact(model.rangeLoCentavos)}–
                {formatPesoCompact(model.rangeHiCentavos)}
              </span>
            </div>
          )}
        </div>

        {model.targetCentavos !== null && (
          <div className="bright">
            <div className="tgt">of {formatPesoCompact(model.targetCentavos)}</div>
            {statusWord && <div className={`status ${tone}`}>{statusWord}</div>}
          </div>
        )}
      </div>
      {model.targetCentavos !== null && (
        <div className="meter">
          <div
            className={`fill ${tone}`}
            style={{ width: `${Math.round(model.meterFill * 100)}%` }}
          />
        </div>
      )}
    </>
  );
}

// ── Surface 2 · Landing overview ──────────────────────────────────────────
function Overview({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  // Two-state cover (owner 2026-06-01): with no picks yet, introduce the page
  // + give direction instead of zeroed-out stats. Once there's any pick, show
  // the budget stats (Estimated / Chosen / Range) + a progress bar + what-next.
  const hasAnyPick = model.recap.shortlisted > 0;

  if (!hasAnyPick) {
    return (
      <section className="intro">
        <div>
          <p className="intro-eyebrow">Your service plan</p>
          <h1 className="intro-h">Plan every service, in one place.</h1>
        </div>

        <div className="intro-grid">
          <p className="intro-lead">
            Shortlist the vendors you love, line them up side by side, and lock
            in your favourites. Your budget keeps count as you go — so you
            always know where you stand.
          </p>
          <div className="intro-steps">
            <div className="istep">
              <span className="istep-n">1</span>
              <div>
                <div className="istep-h">Shortlist</div>
                <div className="istep-d">Save the vendors you&rsquo;re considering</div>
              </div>
            </div>
            <div className="istep">
              <span className="istep-n">2</span>
              <div>
                <div className="istep-h">Compare</div>
                <div className="istep-d">Line them up side by side</div>
              </div>
            </div>
            <div className="istep">
              <span className="istep-n">3</span>
              <div>
                <div className="istep-h">Lock it in</div>
                <div className="istep-d">Choose the one — your budget updates</div>
              </div>
            </div>
          </div>
        </div>

        <a className="catunlock" href={`/dashboard/${eventId}/vendors/categories`}>
          <span className="cu-ico" aria-hidden>
            +
          </span>
          Add your first category
        </a>

        <p className="intro-cta">
          Swipe up to view your services
          <span className="chev" aria-hidden>
            ↓
          </span>
        </p>
      </section>
    );
  }

  const tone: 'ok' | 'near' | 'over' =
    model.budgetStatus === 'over'
      ? 'over'
      : model.budgetStatus === 'near'
        ? 'near'
        : 'ok';
  const statusWord =
    model.budgetStatus === 'over'
      ? 'Over budget'
      : model.budgetStatus === 'near'
        ? 'Getting close'
        : 'On track';

  return (
    <section className="intro">
      <div>
        <p className="intro-eyebrow">Your budget &amp; plan</p>
        <h1 className="intro-h">Where your day stands</h1>
      </div>

      <div className="intro-grid">
        {/* "Do this next" deadline hero — hidden in Manual mode (Setnayan
            Assist off · owner 2026-06-05). */}
        {model.personalizationEnabled ? (
          <NextAction model={model} eventId={eventId} />
        ) : null}
        <LoopLegend />

        <div className="irow3">
          <div className="ibox">
            <div className="ik">Estimate</div>
            <div className="iv">
              {model.targetCentavos !== null
                ? formatPesoPrecise(model.targetCentavos)
                : 'Not set'}
            </div>
          </div>
          <div className="ibox">
            <div className="ik">Chosen</div>
            <div className="iv">{formatPesoPrecise(model.chosenCentavos)}</div>
          </div>
          <div className="ibox">
            <div className="ik">Could land</div>
            <div className="iv">
              {model.rangeHiCentavos > 0
                ? `${formatPesoCompact(model.rangeLoCentavos)}–${formatPesoCompact(
                    model.rangeHiCentavos,
                  )}`
                : '—'}
            </div>
          </div>
        </div>

        {model.targetCentavos !== null && (
          <div className="intro-meter">
            <div className="pm-top">
              <span className="pm-k">Plan vs budget</span>
              <span className={`pm-v ${tone}`}>{statusWord}</span>
            </div>
            <div className="pm-track">
              <div
                className={`pm-fill ${tone}`}
                style={{ width: `${Math.round(model.meterFill * 100)}%` }}
              />
            </div>
          </div>
        )}

        <AlsoComingUp model={model} eventId={eventId} />
      </div>

      <p className="intro-cta">
        Swipe up to view your services
        <span className="chev" aria-hidden>
          ↓
        </span>
      </p>
    </section>
  );
}

// Surface-2 cover · the remaining due categories. NextAction promotes
// dueList[0] into the hero banner, so this lists dueList[1..] under "Also
// coming up" (and renders nothing when there's only the one). The calm / empty
// cases are handled by NextAction's reassuring state — no list needed.
function AlsoComingUp({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  const more = model.dueList.slice(1);
  if (more.length === 0) return null;
  return (
    <div className="ibox dl">
      <div className="dl-tag">Also coming up</div>
      {more.map((d) => (
        <DueRow key={d.groupId} item={d} eventId={eventId} />
      ))}
    </div>
  );
}

// Action-first "do this next" banner (owner 2026-06-04). Promotes the single
// most-urgent category — dueList[0], else the calm upNext — into a tappable
// jump to its rail, so the populated cover answers "what do I do?", not just
// "what's the score?". Falls back to a reassuring, non-link calm state when
// nothing's pressing. Verb adapts: never-locked → "Start with", overdue →
// "Lock your", otherwise "Choose your".
function NextAction({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  const primary = model.dueList[0] ?? model.upNext ?? null;

  if (!primary) {
    return (
      <div className="intro-next calm">
        <span className="nx-ico" aria-hidden>
          ✓
        </span>
        <span className="nx-main">
          <span className="nx-k">You&rsquo;re on pace</span>
          <span className="nx-h">
            Nothing&rsquo;s urgent — browse any category below.
          </span>
        </span>
      </div>
    );
  }

  const overdue = primary.timelineStatus === 'overdue';
  const neverLocked = model.recap.finalized === 0;
  const head = overdue
    ? `Lock your ${primary.label}`
    : neverLocked
      ? `Start with ${primary.label}`
      : `Choose your ${primary.label}`;
  // optionCount = how many they've already shortlisted in this category.
  const n = primary.optionCount;
  const shortlistLine =
    n === 0
      ? 'Find one to shortlist'
      : n === 1
        ? '1 shortlisted — ready to lock'
        : `${n} shortlisted — compare & lock one`;
  const timeLine = overdue
    ? `${Math.abs(primary.daysLeft)}d overdue`
    : primary.timelineStatus === 'due_soon'
      ? `${primary.daysLeft}d left`
      : primary.timelineStatus === 'start_now'
        ? 'time to start'
        : null;
  const sub = timeLine ? `${shortlistLine} · ${timeLine}` : shortlistLine;

  return (
    <Link
      href={`/dashboard/${eventId}/vendors#group-${primary.groupId}`}
      className="intro-next"
    >
      <span className="nx-ico" aria-hidden>
        →
      </span>
      <span className="nx-main">
        <span className="nx-k">{overdue ? 'Now overdue' : 'Do this next'}</span>
        <span className="nx-h">{head}</span>
        <span className="nx-d">{sub}</span>
      </span>
      <span className="nx-go" aria-hidden>
        ›
      </span>
    </Link>
  );
}

// Persistent Find → Shortlist → Lock legend (owner 2026-06-04). The 3-step
// "how it works" used to live ONLY on the empty cover; this keeps the mechanic
// in view once the couple is actually working the rails.
function LoopLegend() {
  return (
    <div
      className="intro-loop"
      aria-label="How it works: find, then shortlist, then lock"
    >
      <span className="lp">
        <span className="lp-n">1</span>
        <span className="lp-t">Find</span>
      </span>
      <span className="lp-sep" aria-hidden>
        →
      </span>
      <span className="lp">
        <span className="lp-n">2</span>
        <span className="lp-t">Shortlist</span>
      </span>
      <span className="lp-sep" aria-hidden>
        →
      </span>
      <span className="lp">
        <span className="lp-n">3</span>
        <span className="lp-t">Lock</span>
      </span>
    </div>
  );
}

function DueRow({
  item,
  eventId,
  calm = false,
}: {
  item: DueItem;
  eventId: string;
  calm?: boolean;
}) {
  const status = item.timelineStatus;
  const rowTone = calm
    ? 'next'
    : status === 'overdue'
      ? 'over'
      : status === 'due_soon'
        ? 'soon'
        : status === 'start_now'
          ? 'start'
          : 'next';
  const when = calm
    ? 'Coming up'
    : status === 'overdue'
      ? `${Math.abs(item.daysLeft)}d overdue`
      : status === 'due_soon'
        ? `${item.daysLeft}d left`
        : status === 'start_now'
          ? 'Time to start'
          : `${item.daysLeft}d`;
  return (
    <Link
      href={`/dashboard/${eventId}/vendors#group-${item.groupId}`}
      className={`dl-row ${rowTone}`}
    >
      <span className="dl-dot" aria-hidden />
      <span className="dl-main">
        <span className="dl-name">{item.label}</span>
        {item.maxEyeing > 0 && (
          <span className="dl-sub">👀 {item.maxEyeing} eyeing your date</span>
        )}
      </span>
      <span className={`dl-when ${rowTone}`}>{when}</span>
    </Link>
  );
}

// ── Surface 3 · Folder section ────────────────────────────────────────────
function FolderSection({
  folder,
  eventId,
  index,
  onCompare,
  onOpenSearch,
  onOpen,
  lockHintKey,
}: {
  folder: AccordionFolder;
  eventId: string;
  index: number;
  onCompare: (child: AccordionChild) => void;
  onOpenSearch: (groupId: string, label: string) => void;
  onOpen: (href: string, label: string) => void;
  lockHintKey: string | null;
}) {
  const hasLocked = folder.lockedTotal > 0;
  // Folders render always-open (the prototype model) so the scroll engine can
  // curve-merge each .child-block into this sticky parent header as the couple
  // scrolls past it. The .cat-head is a non-interactive sticky label, not a
  // collapse toggle.
  return (
    <>
      <div
        id={`folder-${folder.folder}`}
        className="cat-head"
        style={{ ['--idx']: index, zIndex: 25 - index } as CSSProperties}
      >
        <span className="nm">{folder.label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className={`amt${hasLocked ? '' : ' zero'}`}>
            {hasLocked
              ? formatPesoCompact(folder.lockedTotal)
              : folder.pickCount > 0
                ? `${folder.pickCount} shortlisted`
                : 'Not started'}
          </span>
        </span>
      </div>

      <div className="cat-body">
        {folder.children.length === 0 ? (
          // Design always has children + the Digital Services rail below, so
          // skip the "nothing here" line for it even in the (unreachable) empty
          // case — the rail still renders.
          folder.folder === 'design' ? null : (
            <p className="cat-empty">Nothing here yet for your wedding.</p>
          )
        ) : (
          folder.children.map((child) => (
            <div className="child-block" key={child.groupId}>
              <ChildRail
                child={child}
                eventId={eventId}
                folderSlug={folder.slug}
                folderIndex={index}
                onCompare={onCompare}
                onOpenSearch={onOpenSearch}
                onOpen={onOpen}
                lockHintKey={lockHintKey}
              />
            </div>
          ))
        )}
        {/* Setnayan's digital/AI productions (Animated Monogram · Pakanta · Pro
            Website) group under a synthetic Design › Digital Services rail —
            the couple-side reflection of the marketplace's Digital Services
            tile (Digital_Services_Cross_Surface_Map §2). */}
        {folder.folder === 'design' && DIGITAL_SVCS.length > 0 && (
          <div className="child-block">
            <DigitalServicesRail
              eventId={eventId}
              services={DIGITAL_SVCS}
              onOpen={onOpen}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Surface 4 · Child rail ────────────────────────────────────────────────
function ChildRail({
  child,
  eventId,
  folderSlug,
  folderIndex,
  onCompare,
  onOpenSearch,
  onOpen,
  lockHintKey,
}: {
  child: AccordionChild;
  eventId: string;
  folderSlug: string;
  /** Index of the parent folder (0-based). Used by CSS --folder-idx so the
   *  scroll-margin-top on #group-* IDs clears the piled headers above this
   *  group (topbar + folderIndex+1 category heads). */
  folderIndex: number;
  onCompare: (child: AccordionChild) => void;
  onOpenSearch: (groupId: string, label: string) => void;
  onOpen: (href: string, label: string) => void;
  lockHintKey: string | null;
}) {
  // Setnayan in-app services that belong to this category — prepended to the
  // rail as supplementary ✦ Setnayan cards (float-to-top). A category with a
  // Setnayan service but no vendor picks still shows its rail (not the slim
  // empty row) so the service stays visible (Digital_Services_Cross_Surface_Map
  // §2). Supplementary: the service never counts as a pick, so Compare + the
  // budget rollup are unaffected.
  const inApp = SVC_BY_GROUP.get(child.groupId) ?? [];
  const empty = child.picks.length === 0 && inApp.length === 0;
  const canCompare = child.picks.length >= 2;
  return (
    <div
      id={`group-${child.groupId}`}
      style={{ ['--folder-idx']: folderIndex } as CSSProperties}
    >
      <div className="child-name">
        <span className="cn">{child.label}</span>
        <span className="cn-right">
          {canCompare && (
            <button
              type="button"
              className="cmpbtn"
              onClick={() => onCompare(child)}
            >
              ⇄ Compare {child.picks.length}
            </button>
          )}
          {child.personalizationEnabled ? (
            <DeadlineChip status={child.timelineStatus} daysLeft={child.daysLeft} />
          ) : null}
        </span>
      </div>

      {child.dependency ? <DependencyNudge dep={child.dependency} label={child.label} /> : null}

      {empty ? (
        <button
          type="button"
          className="empty-child"
          onClick={() => onOpenSearch(child.groupId, child.label)}
        >
          <span className="ep">＋</span>
          {/* Keep the label's own casing — lowercasing mangles acronym/proper
              category names ("LED Background"→"led background", "DJ"→"dj"). */}
          <span className="en">Find {child.label}</span>
          <span className="eh">Search</span>
        </button>
      ) : (
        <div className="rail">
          {/* Setnayan first-party services float to the TOP of the rail. */}
          {inApp.map((addon) => (
            <InAppServiceCard
              key={`svc-${addon.key}`}
              addon={addon}
              eventId={eventId}
              onOpen={onOpen}
            />
          ))}
          {child.picks.map((pick) => (
            <VendorCardAtom
              key={pick.vendor_id}
              pick={pick}
              eventId={eventId}
              groupId={child.groupId}
              groupLabel={child.label}
              onOpen={onOpen}
              lockHintKey={lockHintKey}
              personalizationEnabled={child.personalizationEnabled}
            />
          ))}
          {/* Collapse on a hard-single finalize: the slot is filled (one
              venue/officiant/coordinator/host/LED), and finalizeVendor already
              auto-archived the losing shortlist — so drop the Find-more card.
              "↩ Change pick" on the chosen card re-opens it. Multi-pick groups
              keep Find-more (co-locks are the happy path there). */}
          {!(child.state === 'finalized' && child.hardSingle) && (
            <AddCard
              label={child.label}
              groupId={child.groupId}
              onOpenSearch={onOpenSearch}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Dependency-awareness nudge (Setnayan AI §4B) — a soft, per-category
// sequencing hint. `blocked` tells the couple which prerequisite to finalize
// first (loud for `H`, gentle "Tip" for `s`); `ready` is the go-signal once the
// prerequisites are met. NEVER a gate — the couple can still add/book here. The
// model only attaches `dependency` when Setnayan AI is on + the category is in
// its action window, so this just renders what it's handed.
function DependencyNudge({
  dep,
  label,
}: {
  dep: NonNullable<AccordionChild['dependency']>;
  label: string;
}) {
  if (dep.status === 'ready') {
    return (
      <div className="dep-nudge ready">
        <span className="di" aria-hidden>
          ✓
        </span>
        <span>
          Ready — your prerequisites are set. Time to book your {label}.
        </span>
      </div>
    );
  }
  const soft = dep.prominence === 's';
  return (
    <div className={`dep-nudge blocked${soft ? ' soft' : ''}`}>
      <span className="di" aria-hidden>
        {soft ? '↪' : '⏳'}
      </span>
      <span>
        {soft ? 'Tip: lock your ' : 'Lock your '}
        <strong>{dep.prereqLabel}</strong>
        {soft
          ? ` first — it sharpens your ${label} matches.`
          : ` first — your ${label} matches better once it’s set.`}
      </span>
    </div>
  );
}

// Per-category timeline chip. Quiet while the category is still 'upcoming';
// nudges "Start now" the moment its START window opens; counts down through
// 'due_soon'; warns clearly once 'overdue'. Reads timelineStatus so the chip,
// the cover's "What to lock next" row, and the model stay one source of truth.
function DeadlineChip({
  status,
  daysLeft,
}: {
  status: AccordionChild['timelineStatus'];
  daysLeft: number | null;
}) {
  if (status === 'locked') {
    return <span className="chip locked">✓ Locked</span>;
  }
  if (status === 'overdue' && daysLeft !== null) {
    return <span className="chip over">⚠ {Math.abs(daysLeft)}d overdue</span>;
  }
  if (status === 'due_soon' && daysLeft !== null) {
    return <span className="chip soon">{daysLeft}d left</span>;
  }
  if (status === 'start_now') {
    return <span className="chip start">Start now</span>;
  }
  return null; // upcoming → stay quiet until the START window opens
}

// ── The §4 vendor card atom (300px prototype card) ────────────────────────
function VendorCardAtom({
  pick,
  eventId,
  groupId,
  groupLabel,
  onOpen,
  lockHintKey,
  personalizationEnabled,
}: {
  pick: AccordionPick;
  eventId: string;
  groupId: PlanGroupId;
  groupLabel: string;
  onOpen: (href: string, label: string) => void;
  lockHintKey: string | null;
  /** Setnayan Assist on? When false (Manual mode) the "% match" pill is hidden. */
  personalizationEnabled: boolean;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [opening, setOpening] = useState(false);
  const locked = isLocked(pick);
  // The one-time "what Lock does" helper attaches to exactly one card — the
  // first lockable pick — while the first-run coachmark is live (see root).
  const showLockHint =
    lockHintKey !== null && lockHintKey === `${groupId}|${pick.vendor_id}`;
  const displayName =
    pick.marketplace_business_name ?? pick.vendor_name ?? 'Vendor';
  const photo =
    pick.service_primary_photo_url ??
    pick.manual_vendor_photo_url ??
    pick.marketplace_logo_url ??
    null;
  const price =
    pick.rolled_cost_php !== null ? formatPhp(pick.rolled_cost_php) : null;

  // Optional enrichment — render only what the model actually carries.
  const rating =
    typeof pick.rating === 'number' && pick.rating > 0 ? pick.rating : null;
  const reviewCount =
    typeof pick.review_count === 'number' ? pick.review_count : null;
  const distanceKm =
    typeof pick.distance_km === 'number' && pick.distance_km > 0
      ? pick.distance_km
      : null;
  // Distance slot: "X km from reception" when real coords exist; else the
  // vendor's city; else nothing (off-platform picks with neither).
  const distLine =
    distanceKm !== null
      ? `${formatDistanceKm(distanceKm)} from reception`
      : (pick.marketplace_city ?? null);
  const verified = pick.is_verified === true;
  const setnayan = pick.is_setnayan_service === true;

  // Per-candidate compatibility % (Architecture §2 · GATE+SCORE). Shown only
  // for marketplace candidates — off-platform/manual picks carry no signal,
  // and 1st-party Setnayan services are supplementary (never ranked against the
  // market). The scorer admits-unknown: distance + reviews + verification drive
  // it today; refinement + date-headroom sit at a neutral baseline until 0044
  // per-service detail data lands, then the spread sharpens on its own.
  const match =
    personalizationEnabled && pick.marketplace_business_name && !setnayan
      ? computeCompatScore({
          distanceKm,
          avgRating: rating,
          reviewCount,
          verified,
        })
      : null;
  const recommendedReason =
    typeof pick.recommended_reason === 'string' && pick.recommended_reason
      ? pick.recommended_reason
      : null;
  const linked = pick.linked_to_name ?? null;

  // Accept-gate status (#1c, CLAUDE.md 2026-06-02). Surfaces where the
  // auto-inquiry for this marketplace vendor stands. pending → gold (in
  // flight, matches the eyeing register); accepted → emerald; declined →
  // muted ink. Absent (off-platform / custom / no thread) → no badge.
  const inquiryBadge =
    pick.inquiry_status === 'pending'
      ? { label: '⏳ Inquiry sent · waiting for vendor', color: null as string | null, bg: null as string | null }
      : pick.inquiry_status === 'accepted'
        ? { label: '✓ Vendor accepted · chat open', color: '#2f6f4e', bg: 'rgba(47,111,78,.12)' }
        : pick.inquiry_status === 'declined'
          ? { label: 'Not available — see similar', color: 'rgba(30,34,41,.6)', bg: 'rgba(30,34,41,.08)' }
          : null;

  const stars = rating !== null ? '★★★★★'.slice(0, Math.round(rating)) : null;
  const starsEmpty = rating !== null ? '★★★★★'.slice(Math.round(rating)) : '';

  // Tap the card body → enlarge it + open the workspace behind the loading
  // overlay. Keep the <Link> (prefetch + ⌘/middle-click open a new tab); only a
  // plain left-click is intercepted for the enlarge-then-navigate transition.
  const workspaceHref = `/dashboard/${eventId}/vendors/${pick.vendor_id}/workspace`;
  const handleOpen = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    setOpening(true);
    onOpen(workspaceHref, displayName);
  };

  return (
    <div className={`card${locked ? ' chosen' : ''}${opening ? ' opening' : ''}`}>
      <Link
        href={workspaceHref}
        className="v"
        onClick={handleOpen}
        aria-busy={opening || undefined}
      >
        <div className="img">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" />
          ) : (
            <span className="ini">{initials(displayName)}</span>
          )}
        </div>
        <div className="meta">
          <div className="vn">{displayName}</div>
          {distLine && <div className="dist">{distLine}</div>}

          {stars && (
            <div className="stars" aria-label={`${rating} stars`}>
              {stars}
              <span style={{ color: 'rgba(30,34,41,.18)' }}>{starsEmpty}</span>
              {reviewCount !== null && (
                <span className="rcount">{reviewCount}</span>
              )}
            </div>
          )}

          {(match || verified || setnayan || recommendedReason) && (
            <div className="badges">
              {match && (
                <span
                  className={`bdg match ${match.tier}`}
                  title="How well this candidate fits your event — based on distance, reviews, and verification. Sharpens as vendors fill in their service details."
                >
                  {match.score}% match
                </span>
              )}
              {verified && <span className="bdg verified">Verified</span>}
              {setnayan && <span className="bdg setnayan">Setnayan</span>}
              {recommendedReason && (
                <span className="bdg rec">{recommendedReason}</span>
              )}
            </div>
          )}

          {linked ? (
            <div className="linked">🔗 Linked with {linked}</div>
          ) : (
            <div className="price">{price ?? 'Price on inquiry'}</div>
          )}

          {pick.eyeing > 0 && (
            <div className="eyeing">👀 {pick.eyeing} also eyeing your date</div>
          )}

          {inquiryBadge && (
            <div
              className="eyeing"
              style={
                inquiryBadge.color
                  ? { color: inquiryBadge.color, background: inquiryBadge.bg ?? undefined }
                  : undefined
              }
            >
              {inquiryBadge.label}
            </div>
          )}
        </div>
      </Link>

      {/* Chosen badge (top-right) */}
      {locked && <span className="pcorner">★ Chosen</span>}

      {/* Remove × (top-left) — tap-to-confirm, hidden once chosen */}
      {!locked &&
        (confirmRemove ? (
          <>
            <form action={deleteVendor} style={{ display: 'contents' }}>
              <input type="hidden" name="event_id" value={eventId} />
              <input type="hidden" name="vendor_id" value={pick.vendor_id} />
              <button
                type="submit"
                className="vx armed"
                aria-label="Confirm remove"
                onClick={() => haptic('select')}
              >
                Remove
              </button>
            </form>
            <button
              type="button"
              className="vx-keep"
              onClick={() => setConfirmRemove(false)}
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            className="vx"
            aria-label="Remove from shortlist"
            onClick={() => {
              haptic('tick');
              setConfirmRemove(true);
            }}
          >
            ×
          </button>
        ))}

      {/* Lock CTA — the canonical finalizeVendor (conflict + soft-hold gates +
          auto-archive + cascade), one-tap happy path, exception modals. */}
      {!locked && (
        <AccordionLockButton
          eventId={eventId}
          groupId={groupId}
          groupLabel={groupLabel}
          vendorId={pick.vendor_id}
          vendorName={displayName}
        />
      )}

      {/* One-time helper under the first lockable card — demystifies what
          "Lock this pick" actually commits to (owner 2026-06-04). */}
      {!locked && showLockHint && (
        <p className="lockhint">
          Locking sets this as your pick, updates your budget, and lets the
          vendor know — you can change it anytime.
        </p>
      )}

      {/* Locked → "↩ Change pick" reverts to considering (re-expands the rail). */}
      {locked && (
        <ChangePickButton eventId={eventId} vendorId={pick.vendor_id} />
      )}
    </div>
  );
}

function AddCard({
  label,
  groupId,
  onOpenSearch,
}: {
  label: string;
  groupId: string;
  onOpenSearch: (groupId: string, label: string) => void;
}) {
  return (
    <button
      type="button"
      className="add"
      onClick={() => onOpenSearch(groupId, label)}
    >
      <span className="inner">
        <span className="plus">＋</span>
        <span className="at">Find more</span>
      </span>
    </button>
  );
}

// ── In-app Setnayan service card (rail atom) ──────────────────────────────
// A full-bleed cinema-poster card that sits among the vendor cards in a
// category rail (and in the Digital Services rail). Reuses the .card/.v rail
// sizing so the coverflow snap + stretch stay aligned, but renders the
// service's animated poster + a ✦ Setnayan badge instead of the white vendor
// layout. live / web_v1 → a Link to the service's setup page; coming_soon →
// a static card (its /add-ons route may not exist yet, so it is never linked).
function InAppServiceCard({
  addon,
  eventId,
  onOpen,
}: {
  addon: AddOnEntry;
  eventId: string;
  onOpen: (href: string, label: string) => void;
}) {
  const [opening, setOpening] = useState(false);
  const motionClass =
    addon.poster.motion === 'drift'
      ? 'poster-motion-drift'
      : addon.poster.motion === 'pulse'
        ? 'poster-motion-pulse'
        : 'poster-motion-scan';
  const soon = addon.status === 'coming_soon';
  const href = addOnHref(addon.key, eventId);
  // Tap → enlarge + open behind the loading overlay (same transition as the
  // vendor cards). coming_soon cards have no route, so they stay static below.
  const handleOpen = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    setOpening(true);
    onOpen(href, addon.label);
  };

  const inner = (
    <>
      <div
        aria-hidden
        className="svc-poster"
        style={{ background: addon.poster.baseBackground }}
      />
      <div
        aria-hidden
        className={`svc-motion ${motionClass}`}
        style={{ background: addon.poster.motionBackground }}
      />
      <div aria-hidden className="svc-scrim" />
      <div className="svc-top">
        <span className="svc-badge">✦ Setnayan</span>
        {soon ? (
          <span className="svc-pill">Coming soon</span>
        ) : addon.status === 'web_v1' ? (
          <span className="svc-pill">Web V1</span>
        ) : null}
      </div>
      <div className="svc-body">
        <div className="svc-name">{addon.label}</div>
        <div className="svc-blurb">{addon.blurb}</div>
        <div className={`svc-cta${soon ? ' soon' : ''}`}>
          {soon ? 'In the works' : addon.cta}
          {!soon && <span aria-hidden>→</span>}
        </div>
      </div>
    </>
  );

  return (
    <div className={`card svc${soon ? ' soon' : ''}${opening ? ' opening' : ''}`}>
      {soon ? (
        <div className="v" aria-label={`${addon.label} — coming soon`}>
          {inner}
        </div>
      ) : (
        <Link
          className="v"
          href={href}
          aria-label={addon.label}
          onClick={handleOpen}
          aria-busy={opening || undefined}
        >
          {inner}
        </Link>
      )}
    </div>
  );
}

// ── Design › Digital Services rail (synthetic) ────────────────────────────
// Groups Setnayan's digital/AI productions under one rail at the foot of the
// Design folder. Lighter than ChildRail (no picks / compare / deadline) — just
// the in-app service cards.
function DigitalServicesRail({
  eventId,
  services,
  onOpen,
}: {
  eventId: string;
  services: ReadonlyArray<AddOnEntry>;
  onOpen: (href: string, label: string) => void;
}) {
  if (services.length === 0) return null;
  return (
    <div>
      <div className="child-name">
        <span className="cn ds-tag">✦ Digital Services</span>
      </div>
      <div className="rail">
        {services.map((addon) => (
          <InAppServiceCard
            key={`svc-${addon.key}`}
            addon={addon}
            eventId={eventId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tools & extras strip (end-spacer) ─────────────────────────────────────
// Couple tools that aren't category services (Orders / Playlist / QR / Indoor
// Blueprint / Photo Delivery / Paprint). A compact chip row above the recap so
// they stay one tap away without crowding the category pile. coming_soon tools
// are omitted (the full /add-ons page lists them); "See all" links there.
function InAppToolsStrip({ eventId }: { eventId: string }) {
  if (TOOL_SVCS.length === 0) return null;
  return (
    <section className="tools" aria-label="Tools & extras">
      <div className="tools-tag">Tools &amp; extras</div>
      <div className="tools-row">
        {TOOL_SVCS.map((addon) => (
          <Link
            key={addon.key}
            className="tool"
            href={addOnHref(addon.key, eventId)}
          >
            <span className="tool-ico">
              <addon.Icon aria-hidden size={16} strokeWidth={1.75} />
            </span>
            <span className="tool-tx">
              <span className="tool-nm">{addon.label}</span>
              <span className="tool-cta">{addon.cta}</span>
            </span>
          </Link>
        ))}
        <Link className="tools-all" href={`/dashboard/${eventId}/add-ons`}>
          See all →
        </Link>
      </div>
    </section>
  );
}

// ── Compare sheet — like-for-like, read-only (never sets the pick) ────────
function CompareSheet({
  child,
  onClose,
}: {
  child: AccordionChild;
  onClose: () => void;
}) {
  // Full-screen sheet: lock background scroll while open; Escape closes.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Same field extraction as VendorCardAtom so screen-name/real-name
  // resolution + enrichment stay identical to the cards.
  const vendors = child.picks.map((pick) => {
    const name = pick.marketplace_business_name ?? pick.vendor_name ?? 'Vendor';
    const priceNum = pick.rolled_cost_php;
    const price =
      priceNum !== null
        ? formatPhp(priceNum)
        : pick.linked_to_name
          ? `Linked with ${pick.linked_to_name}`
          : 'On inquiry';
    const rating =
      typeof pick.rating === 'number' && pick.rating > 0 ? pick.rating : null;
    const reviewCount =
      typeof pick.review_count === 'number' ? pick.review_count : null;
    const distanceKm =
      typeof pick.distance_km === 'number' && pick.distance_km > 0
        ? pick.distance_km
        : null;
    const dist =
      distanceKm !== null
        ? `${formatDistanceKm(distanceKm)} from reception`
        : (pick.marketplace_city ?? '—');
    const badges: string[] = [];
    if (pick.is_verified === true) badges.push('Verified');
    if (pick.is_setnayan_service === true) badges.push('Setnayan');
    if (typeof pick.recommended_reason === 'string' && pick.recommended_reason) {
      badges.push(pick.recommended_reason);
    }
    // Same per-candidate compatibility % the cards show (Architecture §2).
    // Hidden in Manual mode (child.personalizationEnabled === false).
    const match =
      child.personalizationEnabled &&
      pick.marketplace_business_name &&
      pick.is_setnayan_service !== true
        ? computeCompatScore({
            distanceKm,
            avgRating: rating,
            reviewCount,
            verified: pick.is_verified === true,
          })
        : null;
    return {
      id: pick.vendor_id,
      name,
      priceNum,
      price,
      rating,
      reviewCount,
      dist,
      match,
      badges: badges.length ? badges.join(' · ') : '—',
    };
  });

  const prices = vendors
    .map((v) => v.priceNum)
    .filter((n): n is number => n !== null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const ratings = vendors
    .map((v) => v.rating)
    .filter((n): n is number => n !== null);
  const maxRating = ratings.length ? Math.max(...ratings) : null;
  const matchScores = vendors
    .map((v) => v.match?.score ?? null)
    .filter((n): n is number => n !== null);
  const maxMatch = matchScores.length ? Math.max(...matchScores) : null;

  return (
    <div
      className="cmpsheet"
      role="dialog"
      aria-modal="true"
      aria-label={`Compare ${child.label}`}
    >
      <div className="cmpwrap">
        <div className="cmphead">
          <div className="cmptitle">
            <span className="cmpcat">{child.label}</span>
            <span className="cmpsub">Side by side &middot; pick when you&rsquo;re ready</span>
          </div>
          <button
            type="button"
            className="cmpclose"
            onClick={onClose}
            aria-label="Close compare"
          >
            ✕
          </button>
        </div>

        <div className="cmpbody">
          <table className="cmptable">
            <tbody>
              <tr className="cmprow-name">
                <th>Vendor</th>
                {vendors.map((v) => (
                  <td key={v.id}>{v.name}</td>
                ))}
              </tr>
              <tr>
                <th>Match</th>
                {vendors.map((v) => (
                  <td key={v.id}>
                    {v.match !== null ? `${v.match.score}%` : '—'}
                    {v.match !== null &&
                      v.match.score === maxMatch &&
                      matchScores.length > 1 && (
                        <span className="cmpwin">Best match</span>
                      )}
                  </td>
                ))}
              </tr>
              <tr className="cmprow-price">
                <th>Price</th>
                {vendors.map((v) => (
                  <td key={v.id}>
                    {v.price}
                    {v.priceNum !== null &&
                      v.priceNum === minPrice &&
                      prices.length > 1 && <span className="cmpwin">Lowest</span>}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Reviews</th>
                {vendors.map((v) => (
                  <td key={v.id}>
                    {v.rating !== null ? `★ ${v.rating}` : '—'}
                    {v.reviewCount !== null ? ` · ${v.reviewCount} reviews` : ''}
                    {v.rating !== null &&
                      v.rating === maxRating &&
                      ratings.length > 1 && (
                        <span className="cmpwin">Top rated</span>
                      )}
                  </td>
                ))}
              </tr>
              <tr>
                <th>Distance</th>
                {vendors.map((v) => (
                  <td key={v.id}>{v.dist}</td>
                ))}
              </tr>
              <tr>
                <th>Highlights</th>
                {vendors.map((v) => (
                  <td key={v.id}>{v.badges}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="cmpfoot">
          Comparing only shows what you&rsquo;ve shortlisted — it never changes
          your pick. Lock a vendor from its card.
        </div>
      </div>
    </div>
  );
}

// ── Surface 5 · Recap ─────────────────────────────────────────────────────
// Feel-good lines — one shown at random on every open (owner 2026-06-01:
// "different and randomized every time… we want to make them feel good").
const RECAP_LINES = [
  'Every pick brings your day into focus.',
  'You’re closer than you think.',
  'This is your wedding, taking shape.',
  'Look at you, making it happen.',
  'Each choice is one less thing to carry.',
  'It’s all coming together beautifully.',
  'Small steps, big day.',
  'One vendor at a time — you’ve got this.',
  'Future-you is grateful for today.',
  'The hard part was starting. Done.',
  'Set na ’yan — you’re almost there.',
];

function Recap({ recap }: { recap: RecapStats }) {
  // Default to the first line for SSR (stable → no hydration mismatch), then
  // swap to a random one once mounted, so it's fresh on each visit.
  const [line, setLine] = useState(RECAP_LINES[0]);
  useEffect(() => {
    setLine(RECAP_LINES[Math.floor(Math.random() * RECAP_LINES.length)]);
  }, []);
  return (
    <section className="endcard">
      <p className="end-eyebrow">Look how far you&rsquo;ve come</p>
      <h2 className="end-h">~{recap.hoursSaved} hours saved so far</h2>
      <p className="end-line">
        roughly what it&rsquo;d take to find and vet this many vendors yourself.
      </p>
      <div className="end-stats">
        <div>
          <div className="esv">{recap.searched}</div>
          <div className="esk">Searched</div>
        </div>
        <div>
          <div className="esv">{recap.shortlisted}</div>
          <div className="esk">Shortlisted</div>
        </div>
        <div>
          <div className="esv">{recap.finalized}</div>
          <div className="esk">Chosen</div>
        </div>
      </div>
      <p className="end-motivate">{line}</p>
    </section>
  );
}
