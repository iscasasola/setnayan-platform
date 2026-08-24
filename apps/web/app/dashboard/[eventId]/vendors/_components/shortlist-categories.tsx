'use client';

/**
 * ShortlistCategories — the Explore takeover's "Shortlist" tab (owner 2026-06-16).
 *
 * Presents the COMPLETE taxonomy for the event (folders → all ~53 tiles), faith +
 * event-type scoped upstream by `buildShortlistFolders` (lib/shortlist-taxonomy.ts).
 *
 * NAVIGATION (owner 2026-06-16 "make it easier to understand and navigate"): a
 * TWO-LEVEL single-open accordion so the default view is ~10 calm folder rows, not
 * 53. Tap a folder → it reveals its categories; tap a category → its considered
 * vendors as a horizontal CAROUSEL plus "Find" + "Add manually". One folder open
 * at a time, one category open at a time ("when one opens, the others collapse").
 * Plain height/opacity expand — no sticky-header overlap (the bug in the legacy
 * accordion). No "NOT STARTED" noise: a folder shows "N considering" only once you
 * have picks there (else a quiet category count), a category shows a count badge
 * only when it has picks — calm by default, informative where it matters.
 *
 * This is the BENCH: browse every category, see what's shortlisted, find more.
 * Lock / Build / Compare live on their own tabs, so this surface is read-only about
 * picks (tap a card → detail) and carries none of the plan-group lock/build
 * machinery. Pill / rounded / frosted language matches the app nav + sn-seg menus.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ChevronDown,
  ArrowRight,
  Star,
  MapPin,
  MapPinOff,
  Wallet,
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  BadgeCheck,
  Sparkles,
  Pencil,
  Plus,
  Lock,
  SlidersHorizontal,
} from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import {
  BENCH_SORTS,
  BENCH_PLAIN_SORTS,
  benchCompatInputs,
  persistBenchSort,
  readPersistedBenchSort,
  sortWithReasons,
  type BenchSort,
  type SortReason,
} from '@/lib/bench-sort';
import { isLensKey, visibleLenses } from '@/lib/ranking-lenses';
import {
  FREE_VENUE_ASSIST_CHIP,
  isSuriAssistFreeForCategory,
} from '@/lib/setnayan-ai-free-assist';
import { NewManualVendorModal } from '@/app/dashboard/[eventId]/_components/new-manual-vendor-modal';
import { InspectorTrigger } from '@/app/_components/inspector/inspector-column';
import {
  searchMarketplaceForBench,
  type BenchMarketResult,
} from '../_actions/bench-marketplace-search';
import {
  clearCategoryDecision,
  excludeTileFromPlan,
  restoreTileToPlan,
} from '../category-decision-actions';
import { isExploreReplanEnabled } from '@/lib/explore-replan-flag';
import { benchFolderAnchorId, benchTileAnchorId, scrollBenchAnchor } from '@/lib/bench-anchors';
import { benchSearchScopeForTile } from '@/lib/bench-category-search';
import { CategorySearchOverlay } from './category-search-overlay';
import { folderIcon, tileIcon } from '@/lib/taxonomy-icons';
import {
  coverageBadgeOf,
  coverageStateOf,
  coverageSummary,
  folderSummaryOf,
  orderCoverageTiles,
  type CoverageTile,
} from '@/lib/coverage-strip';
import { canRemoveTileFromPlan, resolveInPlanTiles } from '@/lib/explore-in-plan';
import {
  ADD_TO_PLAN_HEADING,
  addToPlanChipLabel,
  cardAddAnother,
  categoryHintButtonLabel,
  categoryHintForTile,
  COVERAGE_NEXT_FLAG,
  COVERAGE_STRIP_HEADING,
  coverageCountLabel,
  coverageTileLabel,
  folderEmptyInPlan,
  FOLDER_SUMMARY_ALL_COVERED,
  FOLDER_SUMMARY_LOCKED,
  FOLDER_SUMMARY_MORE,
  FOLDER_SUMMARY_TO_DECIDE,
  lockedNamesLabel,
  lockedNamesLine,
  REMOVE_FROM_PLAN_LABEL,
  removeFromPlanButtonLabel,
} from '@/lib/explore-info-copy';
import type { ShortlistFolder, ShortlistVendor } from '@/lib/shortlist-taxonomy';
import { categoryForTile } from '@/lib/shortlist-taxonomy';
import { planGroupForCategory } from '@/lib/wedding-plan-groups';
import {
  railEndIsAddAnother,
  resolveBenchCardActions,
  type BenchCardActions,
} from '@/lib/bench-card-actions';
import {
  DOESNT_FIT_DIVIDER,
  noSharedDateBadge,
  partitionByBuildFit,
  type ConvergenceBanner,
} from '@/lib/build-date-window';
import { BenchVendorActions } from './bench-vendor-actions';
import { resolveReachBadge } from '@/lib/vendor-service-radius';
import {
  RequirementsModal,
  type RequirementsModalPhase,
} from '@/app/_components/requirements-modal';
import type { RequirementField } from '@/lib/requirements-capture';
import {
  loadCategoryRequirements,
  saveCategoryRequirements,
} from '../requirements-actions';

const SLCAT_CSS = `
.slcat{--paper:var(--m-paper,#FBFBFA);--ink:var(--m-ink,#1B1A17);--ink-soft:#4F535B;
  --gold:var(--m-orange,#A9834B);--gold-deep:var(--m-orange-2,#8C6932);
  --mulberry:var(--m-mulberry,#1B1A17);--line:var(--m-line,rgba(30,26,18,.12));
  --line-soft:rgba(30,26,18,.07);--card:#fff;
  /* Card EDGE + resting lift (visual parity 2026-07-28).
     The bench sits on the app-wide .sn-ambient ground. The original defect: the
     champagne wash's base midpoint (#E3DDCF) was within (2,1,2) RGB of the
     border token --m-line (#E1DCD1), so a card outline drawn over it VANISHED,
     and a closed folder had no resting shadow either -- the "washed out, no
     clear edge" the owner reported. Fixed in two halves: the ground is now a
     flat warm white (globals.css .sn-ambient, owner-directed), and the bench
     carries its own slightly stronger NEUTRAL edge plus a resting lift here.
     Re-measured against the warm-white ground: edge|card 1.52:1, edge|ground
     1.40:1 (reference prototype: 1.28 / 1.14) -- the ground change IMPROVED
     the page-side read, so these values stand unchanged.
     --line itself is deliberately untouched, so every dashed rule, separator
     and chip that reads it is byte-identical. */
  /* .20 is measured, not taste. Against the lightened wash the edge has to
     read on BOTH sides. Reference prototype: edge|card 1.28:1, edge|page
     1.14:1. At .14 we beat it on the card side (1.33) but LOST on the page
     side (1.10); .20 gives edge|card 1.52 and edge|page 1.26 — clear of the
     reference on both. (Card|page is 1.25 vs the reference's 1.12.) */
  --edge:rgba(30,26,18,.2);
  --edge-lift:0 1px 2px rgba(30,26,18,.05),0 6px 18px -14px rgba(30,26,18,.35);
  --edge-lift-open:0 10px 26px -16px rgba(30,26,18,.42);
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --ease:cubic-bezier(.22,.61,.36,1);
  color:var(--ink);font-family:var(--sans)}
.slcat *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

/* ── Level 1 · folder card (collapsible) ── */
.slcat .fold{margin:0 0 10px;background:var(--card);border:1px solid var(--edge);border-radius: var(--m-r-md);overflow:hidden;box-shadow:var(--edge-lift);transition:box-shadow .3s var(--ease),border-color .3s var(--ease)}
.slcat .fold.open{box-shadow:var(--edge-lift-open);border-color:rgba(30,26,18,.28)}
.slcat .fold-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:transparent;border:0;cursor:pointer;padding:13px 16px;font:inherit;text-align:left;min-height:48px}
/* Folder head LEFT — icon + name. min-width:0 so the name can still ellipsis
   when the summary pills on the right are wide (mobile). */
.slcat .fold-l{display:flex;align-items:center;gap:10px;min-width:0;flex:1 1 auto}
.slcat .fold-ic{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:0 0 auto;border-radius:var(--m-r-full);background:rgba(169,131,75,.1);color:var(--gold-deep);transition:background .22s var(--ease)}
.slcat .fold.open .fold-ic{background:rgba(169,131,75,.2)}
/* Deliberately NOT truncated: the long folder names ("Insurance & Protection",
   "Logistics & Safety") must stay readable on a narrow phone, so the name keeps
   its shipped WRAPPING behaviour. '.fold-l' carries min-width:0 so the flex
   shrink that makes that wrap possible still happens with the icon present. */
.slcat .fold-nm{font-family:var(--serif);font-style:italic;font-size:18px;font-weight:600;color:var(--ink);line-height:1.15;letter-spacing:.01em;min-width:0}
.slcat .fold.open .fold-nm{color:var(--mulberry)}
.slcat .fold-rt{display:flex;align-items:center;gap:11px;flex:0 0 auto}
.slcat .fold-meta{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.slcat .fold-meta.has{color:var(--gold-deep)}
.slcat .fold-chev{color:var(--ink-soft);transition:transform .24s var(--ease),color .24s var(--ease);flex:0 0 auto}
.slcat .fold.open .fold-chev{transform:rotate(180deg);color:var(--mulberry)}

/* ── Level 2 · category rows inside an open folder (connecting rail) ── */
.slcat .fold-body{position:relative;padding:0 0 8px}
.slcat .fold-body::before{content:'';position:absolute;left:22px;top:0;bottom:14px;width:2px;background:rgba(30, 26, 18,.16);border-radius: var(--m-r-xs);pointer-events:none}
/* smooth expand/collapse (2026-07-10): the body is ALWAYS mounted inside a
   grid-rows wrapper, so toggling the parent's .open class animates height 0fr↔1fr
   BOTH ways. overflow clips the body while collapsing; a delayed visibility flip
   pulls collapsed content out of the tab order without cutting the animation. */
/* ⚠ 'grid-template-columns:minmax(0,1fr)' is LOAD-BEARING (PRs #3799/#3801) —
   it is what stops a wide child (the vendor rail, a long name) from blowing the
   row out horizontally on mobile. Never drop it when tuning this transition.
   Duration tightened .3s → .24s (2026-07-28) so the expand reads as quick on a
   phone; the technique and the track values are untouched. */
.slcat .fold-collapse,.slcat .cat-collapse{display:grid;grid-template-rows:0fr;grid-template-columns:minmax(0,1fr);transition:grid-template-rows .24s var(--ease)}
.slcat .fold.open .fold-collapse,.slcat .cat.open .cat-collapse{grid-template-rows:1fr}
.slcat .fold-collapse>.fold-body,.slcat .cat-collapse>.cat-body{overflow:hidden;min-height:0;min-width:0;opacity:.4;visibility:hidden;transition:opacity .2s var(--ease),visibility 0s .24s}
.slcat .fold.open .fold-body,.slcat .cat.open .cat-body{opacity:1;visibility:visible;transition:opacity .2s var(--ease),visibility 0s 0s}
@media (prefers-reduced-motion:reduce){.slcat .fold-collapse,.slcat .cat-collapse,.slcat .fold-collapse>.fold-body,.slcat .cat-collapse>.cat-body{transition:none}}
.slcat .cat{margin:0 14px 0 34px;border-top:1px solid var(--line-soft)}
.slcat .fold-body .cat:first-child{border-top:0}
/* ── Deep-link landing offset (2026-07-29) ──────────────────────────────────
   '#slfold-*' (folder card) and '#sltile-*' (leaf category row) are the two
   anchors every "jump me to that category" doorway aims at, always with
   block:'start'. Flush at the top of the viewport tucks the row UNDER the
   sticky chrome, so each anchor carries its own clearance instead:

     • MOBILE (<1024px) — ServicesTakeover hides '.shell-topbar' outright
       ('@media (max-width:1023px){.shell-topbar{display:none}}'), so nothing is
       pinned at the top of this page. 14px is breathing room from the viewport
       edge, not a clearance. (The bottom chrome — CustomerBottomNav +
       CustomerSectionSubnav — sits BELOW the landed row and so cannot cover it;
       the takeover already reserves its height with its own bottom padding.)
     • DESKTOP (≥1024px) — '.shell-topbar' is 'sticky top-0' and REVEALS on an
       upward scroll, which is exactly the direction a doorway scrolls. 96px is
       the same clearance the takeover's own section anchors use for it
       ('ServiceSection' → 'scroll-mt-24'); one number, one reason.

   Attribute selectors, not '.cat'/'.fold', so this only ever applies to the
   rows that actually carry an anchor. */
.slcat [id^="slfold-"],.slcat [id^="sltile-"]{scroll-margin-top:14px}
@media (min-width:1024px){.slcat [id^="slfold-"],.slcat [id^="sltile-"]{scroll-margin-top:96px}}
.slcat .cat-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:transparent;border:0;cursor:pointer;padding:10px 4px;font:inherit;text-align:left;min-height:42px}
/* Leaf row LEFT — icon + name. The icon is a bare glyph (no disc): the folder
   head owns the disc, so the two levels stay visually ranked. '.cat-l' carries
   the min-width:0 the row needs; '.cat-nm' keeps its own ellipsis. */
.slcat .cat-l{display:flex;align-items:center;gap:9px;min-width:0;flex:1 1 auto}
.slcat .cat-ic{display:inline-flex;flex:0 0 auto;color:var(--ink-soft);transition:color .18s var(--ease)}
.slcat .cat.open .cat-ic{color:var(--gold-deep)}
.slcat .cat-nm{font-family:var(--sans);font-weight:600;font-size:14px;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slcat .cat.open .cat-nm{color:var(--mulberry)}
.slcat .cat-rt{display:flex;align-items:center;gap:9px;flex:0 0 auto}
.slcat .cat-count{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;color:#fff;background:var(--mulberry);border-radius: var(--m-r-full);padding:3px 9px;font-weight:600;min-width:21px;text-align:center}
/* "saved request" icon — view/edit the couple's saved requirements for this leaf */
.slcat .cat-req{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:0 0 auto;border:1px solid rgba(30, 26, 18,.3);background:rgba(30, 26, 18,.07);color:var(--mulberry);border-radius: var(--m-r-full);cursor:pointer;transition:background .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .cat-req:hover{background:rgba(30, 26, 18,.13)}
.slcat .cat-req:active{transform:scale(.94)}
.slcat .cat-chev{color:var(--ink-soft);transition:transform .22s var(--ease);flex:0 0 auto}
.slcat .cat.open .cat-chev{transform:rotate(180deg);color:var(--mulberry)}
.slcat .cat-body{padding:2px 0 12px}

/* ── Level 3 · vendor carousel + find / add-manually ── */
.slcat .rail{display:flex;gap:11px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 16px 4px 0;scrollbar-width:none}
.slcat .rail::-webkit-scrollbar{display:none}
.slcat .vc{position:relative;flex:0 0 min(206px, calc(100vw - 132px));scroll-snap-align:start;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius: var(--m-r-md);overflow:hidden;text-decoration:none;color:inherit;transition:transform .13s cubic-bezier(.2,.7,.2,1),box-shadow .3s var(--ease)}
.slcat .vc:active{transform:scale(.98)}
.slcat .vc:hover{box-shadow:0 10px 28px -18px rgba(0,0,0,.4)}
/* selected (desktop inspector open on this vendor) — quiet gold ring, kept even
   through the card's own hover shadow (matches the other inspector consumers) */
.slcat .vc[data-inspector-selected='true'],.slcat .vc[data-inspector-selected='true']:hover{border-color:transparent;box-shadow:0 0 0 2px var(--gold),0 10px 28px -18px rgba(0,0,0,.4)}
.slcat .vc .img{height:108px;flex:0 0 108px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center;position:relative}
.slcat .vc .img img{width:100%;height:100%;object-fit:cover}
.slcat .vc .ini{font-family:var(--serif);font-style:italic;font-size:26px;color:rgba(255,255,255,.7)}
.slcat .vc .pcorner{position:absolute;top:8px;right:8px;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--mulberry);border-radius: var(--m-r-full);padding:4px 8px}
/* reason-labeled sort — the "why it's here" ribbon (top-left of the card) */
.slcat .vc .rpill{position:absolute;top:8px;left:8px;display:inline-flex;align-items:center;font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--m-r-full);padding:4px 8px;line-height:1}
.slcat .vc .rpill.ok{color:#fff;background:var(--gold-deep)}
.slcat .vc .rpill.soft{color:var(--ink);background:rgba(255,255,255,.82);backdrop-filter:blur(2px)}
html.dark .slcat .vc .rpill.soft{color:#FBFBFA;background:rgba(30,26,18,.7)}
/* sort toggle — pill segmented control (databerry "Brand addition / Upcoming" feel) */
.slcat .sortbar{display:flex;align-items:center;gap:9px;margin:0 0 13px;flex-wrap:wrap}
.slcat .sortbar-lbl{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.slcat .sortseg{display:inline-flex;gap:3px;padding:3px;background:rgba(30,26,18,.05);border:0.5px solid var(--line);border-radius:var(--m-r-full)}
.slcat .sortseg button{appearance:none;-webkit-appearance:none;border:0;cursor:pointer;font:inherit;font-family:var(--sans);font-size:12px;font-weight:600;color:var(--ink-soft);background:transparent;border-radius:var(--m-r-full);padding:6px 13px;transition:background .18s var(--ease),color .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .sortseg button:active{transform:scale(.96)}
.slcat .sortseg button.on{color:#fff;background:var(--mulberry)}
/* A lens whose driving input is missing across the bench (§15.2). Offered but
   inert: it stays visible so the couple learns what would switch it on, and
   carries that reason on hover / in its accessible name. */
.slcat .sortseg button:disabled{opacity:.42;cursor:not-allowed}
.slcat .sortseg button:disabled:active{transform:none}
/* Divides the RANKING LENSES from the two PLAIN SORTS. The separation is the
   point, not decoration: a lens is a recommendation with a reason pill, a plain
   sort is a comparator the couple asked for. */
.slcat .sortsep{width:1px;height:16px;background:var(--line);flex:0 0 auto}
html.dark .slcat .sortseg{background:rgba(251,251,250,.05)}
html.dark .slcat .sortseg button.on{color:#1B1A17;background:#C99DB0}
/* bench search — client-side filter over categories + considered vendors */
.slcat .bench-search{display:flex;align-items:center;gap:9px;margin:0 0 12px;padding:0 13px;height:42px;background:var(--card);border:1px solid var(--line);border-radius:var(--m-r-md);transition:border-color .18s var(--ease),box-shadow .18s var(--ease)}
.slcat .bench-search:focus-within{border-color:rgba(30,26,18,.28);box-shadow:0 0 0 3px rgba(30,26,18,.06)}
.slcat .bench-search svg{color:var(--ink-faint);flex:0 0 auto}
.slcat .bench-search input{flex:1;min-width:0;border:0;background:none;outline:none;font:inherit;font-family:var(--sans);font-size:14px;color:var(--ink)}
.slcat .bench-search input::placeholder{color:var(--ink-faint)}
.slcat .bench-search .bs-x{flex:0 0 auto;border:0;background:none;color:var(--ink-faint);cursor:pointer;font-size:18px;line-height:1;padding:2px;display:inline-flex}
.slcat .bench-search .bs-x:hover{color:var(--mulberry)}
.slcat .bench-empty{padding:26px 16px;text-align:center;color:var(--ink-faint);font-size:13px}
/* search the WHOLE marketplace — a one-tap jump to /explore?q= (beyond the shortlist) */
.slcat .bench-mkt{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:11px 14px;background:var(--card);border:1px solid var(--line);border-radius:var(--m-r-md);text-decoration:none;color:var(--ink);font-size:13px;transition:border-color .18s var(--ease),background .18s var(--ease)}
.slcat .bench-mkt:hover{border-color:rgba(30,26,18,.28);background:rgba(30,26,18,.02)}
.slcat .bench-mkt>svg{color:var(--mulberry);flex:0 0 auto}
.slcat .bench-mkt>span{flex:1;min-width:0}
.slcat .bench-mkt b{font-weight:600;color:var(--mulberry)}
.slcat .bench-mkt .bench-mkt-arr{color:var(--ink-faint);flex:0 0 auto;transition:transform .18s var(--ease)}
.slcat .bench-mkt:hover .bench-mkt-arr{transform:translateX(2px);color:var(--mulberry)}
html.dark .slcat .bench-mkt{background:#2A2E36}
/* inline whole-marketplace results — top matches below the shortlist filter */
.slcat .bench-mkt-results{margin:0 0 10px;background:var(--card);border:1px solid var(--line);border-radius:var(--m-r-md);overflow:hidden}
.slcat .bmr-head{font-family:var(--mono);font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-faint);padding:10px 14px 6px}
.slcat .bmr-loading{padding:6px 14px 14px;font-size:12.5px;color:var(--ink-soft)}
.slcat .bmr-row{display:flex;align-items:center;gap:11px;padding:9px 14px;border-top:1px solid var(--line-soft);text-decoration:none;color:inherit;transition:background .15s var(--ease)}
.slcat .bmr-row:hover{background:rgba(30,26,18,.03)}
.slcat .bmr-av{width:32px;height:32px;border-radius:var(--m-r-sm);flex:0 0 auto;display:grid;place-items:center;font-family:var(--serif);font-style:italic;font-size:13px;color:#fff;background:linear-gradient(135deg,#3a3f47,#565b63)}
.slcat .bmr-m{flex:1;min-width:0}
.slcat .bmr-m b{font-size:13.5px;font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.slcat .bmr-m span{font-size:11px;color:var(--ink-soft)}
.slcat .bmr-arr{color:var(--ink-faint);flex:0 0 auto;transition:transform .15s var(--ease)}
.slcat .bmr-row:hover .bmr-arr{transform:translateX(2px);color:var(--mulberry)}
html.dark .slcat .bench-mkt-results{background:#2A2E36}
html.dark .slcat .bench-search{background:#2A2E36}
.slcat .vc .meta{padding:11px 13px 13px;flex:1 1 auto;display:flex;flex-direction:column;gap:5px}
.slcat .vc .vn{font-family:var(--sans);font-weight:700;font-size:13.5px;color:var(--ink);line-height:1.2}
.slcat .vc .sub{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;letter-spacing:.03em;color:var(--ink-soft)}
.slcat .vc .stars{display:flex;align-items:center;gap:3px;font-family:var(--mono);font-size:9px;color:var(--gold-deep)}
.slcat .vc .badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
.slcat .vc .bdg{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:7.5px;letter-spacing:.06em;text-transform:uppercase;padding:3px 6px;border-radius: var(--m-r-full);background:rgba(30,26,18,.06);color:var(--ink-soft)}
.slcat .vc .bdg.verified{color:#2e7d4f;background:rgba(46,125,79,.1)}
.slcat .vc .bdg.setnayan{color:var(--mulberry);background:rgba(30, 26, 18,.1)}
/* ── fit-badges (2026-07-09): live reach + budget checks on the bench ── */
.slcat .vc .fits{display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
.slcat .vc .fit{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:7.5px;letter-spacing:.05em;text-transform:uppercase;padding:3px 6px;border-radius:var(--m-r-full);font-weight:600;line-height:1}
.slcat .vc .fit.ok{color:#2e7d4f;background:rgba(46,125,79,.1)}
.slcat .vc .fit.warn{color:#6F5A2E;background:rgba(169,131,75,.16)}
html.dark .slcat .vc .fit.ok{color:#7bc79a;background:rgba(46,125,79,.18)}
html.dark .slcat .vc .fit.warn{color:#e2b968;background:rgba(169,131,75,.2)}
.slcat .vc .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:17px;color:var(--ink);margin-top:auto;padding-top:4px}
/* dashed action cards (in the rail, after the vendors) */
.slcat .act{flex:0 0 116px;scroll-snap-align:start;display:flex}
.slcat .act>*{flex:1;min-height:182px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;border-radius: var(--m-r-md);text-decoration:none;font:inherit;cursor:pointer;transition:transform .13s cubic-bezier(.2,.7,.2,1),background .2s var(--ease)}
.slcat .act>*:active{transform:scale(.97)}
.slcat .act.find>*{background:rgba(30, 26, 18,.05);border:1.5px dashed rgba(30, 26, 18,.4);color:var(--mulberry)}
.slcat .act.manual>*{background:rgba(30,26,18,.03);border:1.5px dashed var(--line);color:var(--ink-soft)}
.slcat .act .at{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;line-height:1.4;padding:0 8px}
/* empty category — Find + Add-manually share a row */
.slcat .find-set{display:flex;flex-wrap:wrap;gap:8px;padding:2px 16px 2px 0}
.slcat .fr{display:flex;align-items:center;gap:9px;flex:1 1 150px;padding:12px 14px;border-radius: var(--m-r-md);text-decoration:none;color:inherit;font:inherit;cursor:pointer;text-align:left;appearance:none;-webkit-appearance:none;transition:transform .13s cubic-bezier(.2,.7,.2,1)}
.slcat .fr:active{transform:scale(.99)}
.slcat .fr.find{border:1.5px dashed rgba(30, 26, 18,.32);background:rgba(30, 26, 18,.03)}
.slcat .fr.manual{border:1.5px dashed var(--line);background:rgba(30,26,18,.025)}
.slcat .fr .fr-i{display:inline-flex;flex:0 0 auto}
.slcat .fr.find .fr-i,.slcat .fr.find .fr-t{color:var(--mulberry)}
.slcat .fr.manual .fr-i,.slcat .fr.manual .fr-t{color:var(--ink-soft)}
.slcat .fr .fr-t{font-family:var(--sans);font-size:13px;font-weight:600}
.slcat a:focus-visible,.slcat button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

/* ── "Your plan" strip — the couple's onboarding category picks, surfaced atop
   the bench so the plan the reveal promised is one tap from acting on it ── */
/* A CARD, not a tinted box (visual parity 2026-07-28). It used to be a
   translucent ink wash on the white page, which is what read as the
   "grey-beige box" beside the white folder cards. Same paper, same edge, same
   lift as '.fold' — one surface language down the whole bench. */
.slcat .plan-strip{margin:0 0 14px;padding:13px 15px;background:var(--card);border:1px solid var(--edge);border-radius:var(--m-r-md);box-shadow:var(--edge-lift)}
.slcat .plan-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--gold-deep);margin:0 0 9px;display:flex;align-items:center;gap:6px}
.slcat .plan-chips{display:flex;flex-wrap:wrap;gap:7px}
.slcat .plan-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:var(--card);border:1px solid var(--line);border-radius:var(--m-r-full);font:inherit;font-family:var(--sans);font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;transition:border-color .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .plan-chip:hover{border-color:rgba(30,26,18,.32)}
.slcat .plan-chip:active{transform:scale(.97)}
.slcat .plan-chip .pc-dot{width:6px;height:6px;border-radius:var(--m-r-full);background:var(--gold);flex:0 0 auto}
.slcat .plan-chip.done .pc-dot{background:#2e7d4f}

/* ── Coverage Strip v2 (Explore Replan PR-B · flag-gated) ──────────────────
   Same .plan-strip shell as the chip strip it upgrades — only the CONTENTS
   change: a progress ring + count in the head, icon tiles below. Structure and
   tokens follow the playable prototype; the emoji there are Lucide here. */
.slcat .cov-hd{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 4px}
.slcat .cov-hl{display:flex;align-items:center;gap:10px;min-width:0}
.slcat .cov-hl b{font-family:var(--sans);font-size:13.5px;font-weight:700;color:var(--ink)}
.slcat .cov-cnt{font-family:var(--mono);font-size:10.5px;color:var(--gold-deep);flex:0 0 auto}
.slcat .cov-ring{width:34px;height:34px;flex:0 0 auto}
.slcat .cov-ring circle{fill:none;stroke-width:3.4}
.slcat .cov-ring .tr{stroke:var(--line)}
.slcat .cov-ring .pr{stroke:var(--gold);stroke-linecap:round;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .4s var(--ease)}
.slcat .cov-ring text{font-family:var(--mono);font-size:9px;fill:var(--gold-deep);font-weight:700}
@media (prefers-reduced-motion:reduce){.slcat .cov-ring .pr{transition:none}}
.slcat .cov-strip{display:flex;gap:10px;overflow-x:auto;padding:8px 2px 4px;scrollbar-width:none}
.slcat .cov-strip::-webkit-scrollbar{display:none}
.slcat .ctile{flex:0 0 auto;width:66px;display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:0;padding:0;font:inherit;cursor:pointer}
/* State changes (not-yet → exploring → locked → covered) animate: a tile that
   just got covered should be SEEN changing, since the couple's own tap caused
   it. transform/opacity-cheap properties plus colour — no layout animation. */
.slcat .ctile .ic{width:48px;height:48px;border-radius:var(--m-r-full);display:flex;align-items:center;justify-content:center;color:var(--ink-soft);background:var(--card);border:1.5px dashed var(--line);position:relative;transition:transform .15s var(--ease),border-color .2s var(--ease),background .2s var(--ease),color .2s var(--ease),box-shadow .2s var(--ease)}
.slcat .ctile .lb{transition:color .2s var(--ease)}
.slcat .ctile:hover .ic{transform:translateY(-2px)}
/* The app-wide 'prefers-reduced-motion' block in globals.css already forces
   every transition here to ~0ms with '!important', so this is defence in depth
   for the motion this stylesheet OWNS — it also kills the hover translate,
   which a duration override alone would leave as an instant jump. */
@media (prefers-reduced-motion:reduce){
  .slcat .ctile:hover .ic{transform:none}
  .slcat .fold-ic,.slcat .cat-ic,.slcat .ctile .ic,.slcat .ctile .lb,
  .slcat .fold-chev,.slcat .cat-chev,.slcat .fold{transition:none}
}
.slcat .ctile .lb{font-family:var(--sans);font-size:9.5px;line-height:1.15;text-align:center;color:var(--ink-soft);max-width:66px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.slcat .ctile.st-exploring .ic,.slcat .ctile.st-picked .ic{border-style:solid;border-color:var(--gold);background:rgba(169,131,75,.1);color:var(--gold-deep)}
.slcat .ctile.st-picked .lb{color:var(--gold-deep)}
.slcat .ctile.st-asked .ic{border-style:dashed;border-width:2px;border-color:var(--gold);background:rgba(169,131,75,.08);color:var(--gold-deep)}
.slcat .ctile.st-asked .lb{color:var(--gold-deep)}
.slcat .ctile.st-locked .ic{border-style:solid;border-width:2.5px;border-color:var(--gold);background:rgba(169,131,75,.16);color:var(--gold-deep);box-shadow:0 2px 8px rgba(169,131,75,.3)}
.slcat .ctile.st-locked .lb{color:var(--gold-deep);font-weight:700}
.slcat .ctile.st-covered .ic{border-style:solid;border-width:2.5px;border-color:#2e7d4f;background:rgba(46,125,79,.12);color:#2e7d4f}
.slcat .ctile.st-covered .lb{color:#2e7d4f;font-weight:700}
.slcat .ctile.is-next .ic{outline:2.5px solid var(--gold);outline-offset:2.5px}
.slcat .ctile .mini{position:absolute;right:-3px;bottom:-3px;min-width:17px;height:17px;padding:0 3px;border-radius:var(--m-r-full);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:9.5px;font-weight:700;color:#fff;border:2px solid var(--card)}
.slcat .ctile .mini.dn{background:#2e7d4f}
.slcat .ctile .mini.lk{background:var(--gold-deep)}
.slcat .ctile .mini.ak{background:var(--card);color:var(--gold-deep);border-color:var(--gold);border-style:dashed}
.slcat .ctile .mini.bd{background:var(--card);color:var(--gold-deep);border-color:var(--gold)}
.slcat .ctile .nx{position:absolute;top:-8px;left:50%;transform:translateX(-50%);font-family:var(--mono);font-size:7.5px;letter-spacing:.12em;background:var(--gold-deep);color:#fff;border-radius:var(--m-r-full);padding:1px 6px;font-weight:700;line-height:1.6}
/* folder-head summary pills — "● N locked · N to decide · ＋N more" */
.slcat .fsum{display:inline-flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
/* 10px, not 9px: at 9px mono these read as texture rather than as the counts
   they are — the reference sets them at 10.5px. */
.slcat .fsum .s{font-family:var(--mono);font-size:10px;letter-spacing:.03em;border-radius:var(--m-r-full);padding:2.5px 9px;font-weight:700;white-space:nowrap;line-height:1.5}
.slcat .fsum .s.lk{background:rgba(169,131,75,.16);color:var(--gold-deep)}
.slcat .fsum .s.td{background:rgba(30,26,18,.07);color:var(--ink-soft)}
.slcat .fsum .s.ad{border:1px dashed var(--line);color:var(--ink-soft)}
.slcat .fsum .s.dn{background:rgba(46,125,79,.12);color:#2e7d4f}
html.dark .slcat .ctile .mini.bd{background:#2A2E36}
html.dark .slcat .fsum .s.td{background:rgba(251,251,250,.08)}

/* ── Adaptive category set + per-category ⓘ (Explore Replan PR-C · gated) ──
   Three quiet affordances on the SHIPPED accordion, not a new surface: the ⓘ
   beside a category name, the "Not needed? Remove" line at the foot of an open
   category, and the "＋ Add to your event" chip pool at the foot of a folder.
   Every token is the bench's own — no new colour, no new type scale. */
.slcat .cat-info{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex:0 0 auto;margin-left:6px;padding:0;border:1px solid var(--line);background:transparent;color:var(--ink-soft);border-radius:var(--m-r-full);cursor:pointer;font:inherit;font-family:var(--serif);font-style:italic;font-size:12px;font-weight:600;line-height:1;transition:background .18s var(--ease),color .18s var(--ease),border-color .18s var(--ease)}
.slcat .cat-info:hover{background:rgba(30,26,18,.07);color:var(--mulberry)}
.slcat .cat-info[aria-expanded='true']{background:rgba(169,131,75,.16);border-color:var(--gold);color:var(--gold-deep)}
.slcat .hintbox{margin:0 4px 9px 4px;padding:9px 12px;background:rgba(169,131,75,.09);border-left:2px solid var(--gold);border-radius:0 var(--m-r-sm) var(--m-r-sm) 0;font-family:var(--sans);font-size:12.5px;line-height:1.5;color:var(--ink-soft)}
.slcat .cat-note{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;padding:2px 16px 0 0}
.slcat .rmv{appearance:none;-webkit-appearance:none;border:0;background:none;padding:4px 0;cursor:pointer;font:inherit;font-family:var(--mono);font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-soft);transition:color .18s var(--ease)}
.slcat .rmv:hover{color:var(--mulberry);text-decoration:underline}
.slcat .rmv[disabled]{opacity:.5;cursor:default;text-decoration:none}
/* An error is a refusal, not an accent. This was gold #9a6a12 — the SECOND
   gold error message on these screens; the first (quote-fill) was fixed in
   #4780 and this one survived because it is written as a hex, which a
   class-name sweep cannot see. danger-700, like every other error here. */
.slcat .plan-err{font-family:var(--sans);font-size:12px;line-height:1.45;color:#974930;text-align:right;flex:1 1 200px}
.slcat .addpool{margin:10px 14px 2px 34px;padding-top:10px;border-top:1px dashed var(--line)}
.slcat .addpool .ap-t{margin:0 0 8px;font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.slcat .addpool .ap-chips{display:flex;flex-wrap:wrap;gap:7px}
.slcat .addchip{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;background:transparent;border:1px dashed var(--line);border-radius:var(--m-r-full);font:inherit;font-family:var(--sans);font-size:12px;font-weight:600;color:var(--ink-soft);cursor:pointer;transition:border-color .18s var(--ease),color .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .addchip:hover{border-color:var(--gold);color:var(--gold-deep)}
.slcat .addchip:active{transform:scale(.97)}
.slcat .addchip[disabled]{opacity:.55;cursor:default}
.slcat .fold-empty{padding:10px 16px 2px 34px;font-size:12.5px;color:var(--ink-soft)}
html.dark .slcat .cat-info:hover{background:rgba(251,251,250,.08);color:#C99DB0}
html.dark .slcat .plan-err{color:#e2b968}

/* "In your plan" marker beside a category name */
.slcat .cat-plan{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep);background:rgba(169,131,75,.13);border-radius:var(--m-r-full);padding:3px 8px;font-weight:600;white-space:nowrap}
/* Free first-venue-shortlist marker (owner 2026-07-09 · Pricing.md § 00) —
   presentational chip on the venue category while its shortlist is empty */
.slcat .cat-free{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mulberry);background:rgba(30,26,18,.08);border-radius:var(--m-r-full);padding:3px 8px;font-weight:600;white-space:nowrap}

/* ── Three-action card (Explore Replan slice D · flag-gated) ────────────────
   The prototype drew these as emoji + red pills; production draws them in the
   bench's OWN language — the same var(--sans) / var(--mono) tokens, gold-deep
   accent and pill radii the rest of this stylesheet uses, with Lucide icons.
   The card itself is untouched: .vcw is a wrapper the rail sizes instead of
   .vc, so the carousel snap, coverflow width and inspector ring all behave as
   before. Flag OFF ⇒ no wrapper, no action rail, this block never matches. */
.slcat .vcw{flex:0 0 min(206px, calc(100vw - 132px));scroll-snap-align:start;display:flex;flex-direction:column;gap:6px}
.slcat .vcw>.vc{flex:1 1 auto;width:100%;min-width:0;scroll-snap-align:none}
.slcat .vacts{display:flex;flex-direction:column;gap:5px}
.slcat .vact-slot{display:flex;flex-direction:column}
.slcat .vact{display:inline-flex;align-items:center;justify-content:center;gap:5px;width:100%;padding:8px 9px;border:1px solid transparent;border-radius:var(--m-r-sm);font:inherit;font-family:var(--sans);font-size:11.5px;font-weight:600;line-height:1.15;text-align:center;text-decoration:none;cursor:pointer;transition:background .18s var(--ease),border-color .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .vact:active{transform:scale(.97)}
.slcat .vact:disabled{opacity:.55;cursor:default}
.slcat .vact.primary{background:var(--mulberry);color:#fff;border-color:var(--mulberry)}
.slcat .vact.ghost{background:var(--card);color:var(--ink);border-color:var(--line)}
.slcat .vact.ghost:hover{border-color:rgba(30,26,18,.3)}
.slcat .vact.quiet{background:rgba(169,131,75,.1);color:var(--gold-deep);border-color:rgba(169,131,75,.42)}
.slcat .vact.quiet:hover{background:rgba(169,131,75,.17)}
.slcat .vact.on{background:rgba(169,131,75,.14);color:var(--gold-deep);border-color:rgba(169,131,75,.42);cursor:default}
.slcat .vact.note{background:transparent;color:var(--ink-soft);border-style:dashed;border-color:var(--line);font-weight:500;font-size:10.5px;cursor:default;text-align:left;justify-content:flex-start}
.slcat .vact.mini{flex:0 0 auto;width:auto;padding:8px 10px;background:transparent;color:var(--ink-soft);border-color:var(--line);font-size:10.5px;font-weight:500}
.slcat .vact.mini:hover{color:var(--ink)}
.slcat .vact-pair{display:flex;gap:5px;align-items:stretch}
.slcat .vact-pair>.vact.on{flex:1 1 auto;min-width:0}
.slcat .vact-err{font-family:var(--sans);font-size:10.5px;line-height:1.3;color:#9a3325;margin:4px 0 0}
html.dark .slcat .vact-err{color:#e9a99d}
html.dark .slcat .vact.primary{background:#C99DB0;color:#1B1A17;border-color:#C99DB0}
/* Locked names on a COLLAPSED category row (decision #8) — the row answers
   "who did we choose here?" without opening the rail. */
.slcat .cat-locked{display:flex;align-items:center;gap:6px;margin:-2px 4px 8px;padding:0 0 0 2px;font-family:var(--mono);font-size:9.5px;letter-spacing:.03em;color:var(--gold-deep);min-width:0}
.slcat .cat-locked span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.slcat .cat-locked svg{flex:0 0 auto}

/* ── Build-candidate schedule convergence · SOFT tier (PR-G1 · flag-gated) ───
   The prototype drew this as a red pill + emoji banner; production draws it in
   the bench's own language — the same .plan-strip shell geometry, var(--sans)
   / var(--mono) tokens, gold-deep accent and Lucide icons as everything above.
   Amber, never red: the vendor is fine, it is the couple's build that narrowed
   past them, and un-narrowing it is one tap away. Flag OFF ⇒ no banner, no
   .is-dim, no divider, and none of these selectors ever match. */
.slcat .convrg{display:flex;gap:10px;align-items:flex-start;margin:0 0 14px;padding:11px 13px;border:0.5px solid var(--line);border-radius:var(--m-r-md);background:rgba(30,26,18,.035)}
.slcat .convrg .cv-i{flex:0 0 auto;display:flex;color:var(--gold-deep);margin-top:1px}
.slcat .convrg .cv-b{display:flex;flex-direction:column;gap:2px;min-width:0}
.slcat .convrg .cv-b b{font-family:var(--sans);font-size:12.5px;font-weight:600;line-height:1.3;color:var(--ink)}
.slcat .convrg .cv-b span{font-family:var(--sans);font-size:11px;line-height:1.4;color:var(--ink-soft)}
.slcat .convrg.t-converged{border-color:rgba(169,131,75,.45);background:rgba(169,131,75,.1)}
.slcat .convrg.t-conflict{border-color:rgba(169,131,75,.45);background:rgba(169,131,75,.14)}
.slcat .convrg.t-conflict .cv-i,.slcat .convrg.t-converged .cv-i{color:var(--gold-deep)}
html.dark .slcat .convrg{background:rgba(251,251,250,.04)}
html.dark .slcat .convrg .cv-b b{color:var(--ink)}
html.dark .slcat .convrg.t-converged,html.dark .slcat .convrg.t-conflict{background:rgba(169,131,75,.16);border-color:rgba(169,131,75,.4)}

/* The sink divider — a vertical rule INSIDE the horizontal rail, so the sunk
   cards stay in the same carousel the couple is already scrolling. */
.slcat .raildiv{flex:0 0 auto;display:flex;align-items:center;align-self:stretch;padding:0 4px;scroll-snap-align:start}
.slcat .raildiv>span{writing-mode:vertical-rl;transform:rotate(180deg);font-family:var(--mono);font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--gold-deep);border-left:0.5px solid rgba(169,131,75,.42);padding:8px 0 8px 7px;white-space:nowrap}

/* DIM, never removed (decision #3): the card stays viewable and its Inquire
   leg stays live — only Add-to-build and Lock stand down. */
.slcat .vcw.is-dim>.vc{opacity:.62;filter:saturate(.8)}
.slcat .vcw.is-dim:hover>.vc,.slcat .vcw.is-dim:focus-within>.vc{opacity:1;filter:none}

/* The vendor's own free days, in the same mono voice as the price/meta rows. */
.slcat .vc .freedays{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.03em;line-height:1.3;color:var(--ink-soft);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* The withheld build CTA — a reason, not an error. Wraps, unlike .vact.note. */
.slcat .vact.note.clash{align-items:flex-start;gap:6px;border-color:rgba(169,131,75,.42);color:var(--gold-deep);white-space:normal}
.slcat .vact.note.clash svg{flex:0 0 auto;margin-top:1px}
.slcat .vact-note-txt{display:flex;flex-direction:column;gap:1px;min-width:0;text-align:left}
.slcat .vact-note-txt b{font-weight:600;color:var(--gold-deep)}
.slcat .vact-note-txt>span{color:var(--ink-soft);font-weight:500;font-size:10px;line-height:1.35}
html.dark .slcat .vact.note.clash{color:#e2b968}
html.dark .slcat .vact-note-txt b{color:#e2b968}

html.dark .slcat .cat-free{color:#C99DB0;background:rgba(201,157,176,.14)}
/* Dark: the card IS lighter than the page here (#2A2E36 on ink-black), so the
   surface separates on its own and a black drop shadow buys nothing — both
   lifts are neutralised via the vars below, which keeps '.fold.open' free to
   change border-colour as its open cue. */
html.dark .slcat .plan-strip{background:var(--card)}
html.dark .slcat .plan-chip{background:#2A2E36}
/* --gold-deep (#8A6B39) is too dark to read on the dark card; the bench already
   uses #e2b968 as its dark gold everywhere else (.fit.warn, .vact.note.clash),
   so the row icons follow it rather than inventing a shade. */
/* The open cue in dark mode. '.fold.open' sets a DARK border (fine on white,
   invisible on #2A2E36) and its shadow is neutralised above, so without this
   an open folder in dark mode had no edge change at all. */
html.dark .slcat .fold.open{border-color:rgba(251,251,250,.3)}
html.dark .slcat .fold-ic{background:rgba(226,185,104,.14);color:#e2b968}
html.dark .slcat .fold.open .fold-ic{background:rgba(226,185,104,.24)}
html.dark .slcat .cat.open .cat-ic{color:#e2b968}
html.dark .slcat{--paper:#1B1A17;--ink:#FBFBFA;--ink-soft:#B6B9BE;--line:rgba(251,251,250,.16);--line-soft:rgba(251,251,250,.1);--card:#2A2E36;--edge:rgba(251,251,250,.16);--edge-lift:none;--edge-lift-open:none}
html.dark .slcat .fold.open .fold-nm,html.dark .slcat .cat.open .cat-nm,html.dark .slcat .act.find>*,html.dark .slcat .fr.find .fr-i,html.dark .slcat .fr.find .fr-t,html.dark .slcat .vc .bdg.setnayan{color:#C99DB0}
html.dark .slcat .cat-req{border-color:rgba(201,157,176,.4);background:rgba(201,157,176,.12);color:#C99DB0}
html.dark .slcat .cat-req:hover{background:rgba(201,157,176,.2)}
`;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function VendorCard({
  v,
  reason,
  eventId,
  tileLabel,
  actions,
}: {
  v: ShortlistVendor;
  reason?: SortReason | null;
  eventId: string;
  /** The category label — the lock modals' "for {this}" copy. */
  tileLabel: string;
  /**
   * Explore Replan slice D — the resolved three-action set, or null when the
   * flag is OFF / nothing applies. Null keeps the pre-replan render EXACTLY:
   * a bare `InspectorTrigger`, no wrapper element, no extra DOM.
   */
  actions?: BenchCardActions | null;
}) {
  const card = (
    // Desktop inspector trigger (Merkado phase 3): at ≥xl a plain click opens the
    // vendor's quick-view in the sticky inspector column instead of navigating;
    // below xl and on modified / new-tab clicks it stays a plain link to `v.href`
    // (the vendor's existing detail room). `?inspect=v:<vendorId>` selects it.
    <InspectorTrigger inspectId={`v:${v.vendorId}`} href={v.href} className="vc">
      <span className="img">
        {v.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="ini">{initials(v.name)}</span>
        )}
        {/* PR-H · "★ Chosen" is a claim about a settled booking. An ask is not
            one, so the corner says what is true instead of borrowing the word
            for a supplier who has not answered and may decline. */}
        {v.status === 'locked' ? (
          <span className="pcorner">★ Chosen</span>
        ) : v.lockRequestState === 'requested' ? (
          <span className="pcorner">Asked</span>
        ) : null}
        {reason && v.status !== 'locked' ? (
          <span className={`rpill ${reason.tone}`}>{reason.label}</span>
        ) : null}
      </span>
      <span className="meta">
        <span className="vn">{v.name}</span>
        {v.city ? (
          <span className="sub">
            <MapPin size={11} strokeWidth={1.75} aria-hidden /> {v.city}
          </span>
        ) : null}
        {v.rating != null ? (
          <span className="stars">
            <Star size={11} strokeWidth={1.75} aria-hidden /> {v.rating.toFixed(1)}
            {v.reviewCount != null ? ` · ${v.reviewCount}` : ''}
          </span>
        ) : null}
        {v.isVerified || v.isSetnayan ? (
          <span className="badges">
            {v.isSetnayan ? (
              <span className="bdg setnayan">
                <Sparkles size={9} strokeWidth={2} aria-hidden /> Setnayan
              </span>
            ) : null}
            {v.isVerified ? (
              <span className="bdg verified">
                <BadgeCheck size={9} strokeWidth={2} aria-hidden /> Verified
              </span>
            ) : null}
          </span>
        ) : null}
        <FitBadges v={v} />
        {v.totalCostPhp != null && v.totalCostPhp > 0 ? (
          <span className="price">{formatPhp(v.totalCostPhp)}</span>
        ) : null}
        {/* PR-G1 — the vendor's own free days inside the couple's date window,
            in the bench's mono voice. Renders only when there IS a signal; a
            calendar we could not read stays silent rather than guessing. */}
        {v.freeDaysLine ? <span className="freedays">{v.freeDaysLine}</span> : null}
      </span>
    </InspectorTrigger>
  );
  // Flag OFF (or nothing to offer) → the card is the whole render, unwrapped,
  // exactly as it shipped. Only when there ARE actions does the rail item
  // become a wrapper: `.vcw` takes over the carousel sizing + snap so `.vc`
  // keeps its look and the actions sit beneath it, inside the same snap unit.
  if (
    !actions ||
    (!actions.build && !actions.inquiry && !actions.lockGroupId && !actions.withdraw)
  ) {
    // A clashing card with nothing to offer still sits behind the divider, so
    // it still reads as sunk. (`buildFit` is only ever populated under the flag,
    // so this branch cannot fire in pre-replan production.)
    return v.buildFit === 'clash' ? <div className="vcw is-dim">{card}</div> : card;
  }
  return (
    // `.is-dim` is the SOFT tier's whole visual: a lowered card, not a removed
    // one (decision #3 — never removed, always viewable, always reversible).
    <div className={`vcw${v.buildFit === 'clash' ? ' is-dim' : ''}`}>
      {card}
      <BenchVendorActions
        actions={actions}
        eventId={eventId}
        vendorId={v.vendorId}
        vendorName={v.name}
        groupLabel={tileLabel}
        verifiedState={v.verifiedState}
        lockRequestExpiresAt={v.lockRequestExpiresAt}
      />
    </div>
  );
}

/**
 * Live fit-badges on a bench card (2026-07-09). Reach + budget + date only
 * render when there's a real signal — reach hides when coords/tier are unknown
 * (never a false "out of range"), budget hides when there's no budget set or no
 * price basis, date hides unless the event has a COMMITTED date and the vendor
 * is marketplace-connected with a calendar (never a false "Booked"). Warn-only
 * by design (owner 2026-07-09): a red badge informs, it never blocks. Date-
 * availability landed 2026-07-09 as the fast-follow to reach+budget — the fit is
 * computed batched upstream (page.tsx, one calendar query for the whole bench).
 */
function FitBadges({ v }: { v: ShortlistVendor }) {
  // INNER / OUTER SERVICE RADIUS (owner 2026-07-27 · spec §17). When the vendor
  // has DECLARED both rings, their own word replaces the tier-derived reach
  // read with a three-state, money-shaped answer:
  //   inside inner → "No travel fee" · inner→outer → "Travel fee applies" ·
  //   beyond outer → "Outside their range".
  // `travelFeeVerdictForVendor` returns null whenever either ring is undeclared
  // or the distance is unknown, and the tier-derived badge below then renders
  // EXACTLY as it does today. A blank is never a penalty and never a new claim.
  // Rings on `ShortlistVendor` are ALREADY tier-clamped by the vendors page, so
  // `resolveReachBadge` is a pure threshold read. It owns the precedence
  // (declaration beats tier inference; no declaration = today's badge verbatim)
  // and the copy, so this component and the quickview inspector cannot drift.
  const badge = resolveReachBadge({
    distanceKm: v.distanceKm,
    innerKm: v.innerRadiusKm,
    outerKm: v.outerRadiusKm,
    reachesVenue: v.reachesVenue,
    serviceRadiusKm: v.serviceRadiusKm,
  });
  const reach = badge
    ? {
        cls: badge.tone,
        icon: badge.inRange ? (
          <MapPin size={9} strokeWidth={2.25} aria-hidden />
        ) : (
          <MapPinOff size={9} strokeWidth={2.25} aria-hidden />
        ),
        text: badge.text,
      }
    : null;
  const budget =
    v.budgetFit === 'fits'
      ? {
          cls: 'ok',
          icon: <Wallet size={9} strokeWidth={2.25} aria-hidden />,
          text: v.budgetEstimated ? 'Fits budget · est.' : 'Fits budget',
        }
      : v.budgetFit === 'over'
        ? {
            cls: 'warn',
            icon: <Wallet size={9} strokeWidth={2.25} aria-hidden />,
            text: v.budgetEstimated ? 'Over budget · est.' : 'Over budget',
          }
        : null;
  const date =
    v.dateFit === 'free'
      ? {
          cls: 'ok',
          icon: <CalendarCheck size={9} strokeWidth={2.25} aria-hidden />,
          text: 'Free on your date',
        }
      : v.dateFit === 'booked'
        ? {
            cls: 'warn',
            icon: <CalendarX2 size={9} strokeWidth={2.25} aria-hidden />,
            text: 'Booked that day',
          }
        : null;
  // SOFT schedule convergence (PR-G1). Amber, never red: the vendor is fine —
  // it is the couple's own build that has narrowed past them, and un-narrowing
  // it is one tap away. The badge NAMES the clashing candidate so that tap is
  // obvious. `buildFit === 'fits'` deliberately renders NOTHING: a green
  // "fits your build" on every card is noise, and the shipped "Free on your
  // date" badge already carries the positive case when there IS a date.
  const schedule =
    v.buildFit === 'clash'
      ? {
          cls: 'warn',
          icon: <CalendarX2 size={9} strokeWidth={2.25} aria-hidden />,
          text: noSharedDateBadge(v.buildClashWith),
        }
      : null;
  if (!reach && !budget && !date && !schedule) return null;
  return (
    <span className="fits">
      {reach ? (
        <span className={`fit ${reach.cls}`}>
          {reach.icon} {reach.text}
        </span>
      ) : null}
      {budget ? (
        <span className={`fit ${budget.cls}`}>
          {budget.icon} {budget.text}
        </span>
      ) : null}
      {date ? (
        <span className={`fit ${date.cls}`}>
          {date.icon} {date.text}
        </span>
      ) : null}
      {schedule ? (
        <span className={`fit ${schedule.cls}`}>
          {schedule.icon} {schedule.text}
        </span>
      ) : null}
    </span>
  );
}

export function ShortlistCategories({
  folders,
  eventId,
  initialOpenTile = null,
  savedRequirementCanonicalByTile = {},
  coveredByTile = {},
  buildPickVendorIds = [],
  daysUntilWedding = null,
  excludedTiles = [],
  convergence = null,
}: {
  folders: ShortlistFolder[];
  eventId: string;
  /**
   * Deep-link target (checklist "Book your caterer" → `?open=catering`). When it
   * matches a tile in `folders`, that tile's folder + the tile open on first
   * render so the couple lands right on the category. Unknown/scoped-out tiles
   * fall back to the collapsed default.
   */
  initialOpenTile?: string | null;
  /**
   * Phase 1b PR-4 — tile → the leaf canonical_service that carries a SAVED
   * event_vendor_preferences row (resolved server-side). A tile present here
   * shows the "saved request" icon; tapping it opens the view/edit modal for
   * that canonical. Absent → no icon (no saved request for that category).
   */
  savedRequirementCanonicalByTile?: Record<string, string>;
  /**
   * Explore Replan slice A — tile → plan_group_id for categories the couple
   * marked "I'm done" (event_category_decisions.decision='complete'). A tile
   * present here renders collapsed as "✓ Covered" with a Reopen affordance.
   * Empty (the default / flag off) → byte-identical pre-replan render.
   */
  coveredByTile?: Record<string, string>;
  /**
   * Explore Replan slice B — vendor_ids pinned to the working build
   * (`event_build_picks`), flattened across plan groups. The page ALREADY reads
   * that table for the plan/budget model, so this is a pass-down, never a new
   * query. Drives the Coverage Strip's ◕ "in your build" state + its candidate
   * count badge. Empty → the strip degrades to ○ / ◔ / ● only.
   */
  buildPickVendorIds?: readonly string[];
  /**
   * Explore Replan slice B — days until the event (already computed on the page
   * for `buildPlanBudgetModel`). Feeds the strip's urgency ordering through
   * `timelineStatusOf`, so the strip reads the SAME planning clock as the
   * accordion. Null (no date set) → every tile reads 'upcoming' and the order
   * falls back to lead-time then taxonomy order.
   */
  daysUntilWedding?: number | null;
  /**
   * Explore Replan slice C — tiles the couple removed with "Not needed?
   * Remove" (`event_category_decisions` rows at TILE grain, decision
   * ='excluded'). They leave the bench and reappear as "＋ Add to your event"
   * chips at the foot of their folder. Empty (the default / flag off) → the
   * pre-replan render, byte for byte.
   */
  excludedTiles?: readonly string[];
  /**
   * Explore Replan PR-G1 — the build's shared-date convergence banner, resolved
   * server-side by `convergenceBanner`. Null = render nothing: an open window
   * has no news, and a status bar that says "no news" is chrome. Sits between
   * the Coverage Strip and the bench, exactly where the narrowing it describes
   * is visible.
   */
  convergence?: ConvergenceBanner | null;
}) {
  const router = useRouter();
  // The folder that holds the deep-linked tile (if any) — used to pre-open it.
  // Known minor: the takeover unmounts inactive tab slots, so tabbing away from
  // Shortlist and back re-seeds this from the (server-fixed) prop and re-opens the
  // folder even if the couple collapsed it. Acceptable for a deep-link entry; a
  // persistent-mount fix on the takeover is a deferred follow-up.
  const deepLinkFolderRow = initialOpenTile
    ? (folders.find((f) => f.tiles.some((t) => t.tile === initialOpenTile)) ?? null)
    : null;
  const deepLinkFolder = deepLinkFolderRow?.folder ?? null;
  // Its SLUG (≠ its key) — the folder anchor is built from the slug, and the
  // mount scroll below needs it as a fallback target.
  const deepLinkFolderSlug = deepLinkFolderRow?.slug ?? null;
  // Level 1: which folder is open. ALL COLLAPSED by default (owner 2026-06-16
  // "we want the parent categories to collapse so we can find the other services
  // faster") — the surface opens as a tight list of the ~10 parent categories, so
  // any one is a single tap away instead of starting mid-expansion. A deep-link
  // pre-opens the requested folder.
  const [openFolder, setOpenFolder] = useState<string | null>(deepLinkFolder);
  // Level 2: which category (tile) is open. Single-open across the whole list.
  const [openTile, setOpenTile] = useState<string | null>(
    deepLinkFolder ? initialOpenTile : null,
  );
  // The category whose "Add manually" modal is open (every category has Find + Add).
  const [manual, setManual] = useState<{ category: string; label: string } | null>(null);
  // ── In-place category search (2026-07-29) ─────────────────────────────────
  // Owner: "clicking find more doesn't search specifically for that category.
  // and it jumps to a new page, it needs to stay on that page."
  //
  // `CategorySearchOverlay` is the shipped answer — an in-place, hard-scoped
  // full-page sheet, built precisely to replace the marketplace JUMP from the
  // Find / Add buttons. It has only ever been mounted by the pre-takeover
  // `plan-budget-accordion.tsx`; when this bench was built its rail-end card
  // kept the old `/explore?tile=` <Link>. This is that same overlay, mounted
  // the same way, with the same state + close handling. Nothing new.
  //
  // `searched` is why the close needs a refresh: the sheet ADDS-AND-STAYS, and
  // `saveVendorToPicks` revalidates `/dashboard/[eventId]` (the overview page)
  // — not this nested route — so nothing repaints the rail on its own. One soft
  // `router.refresh()` on close, and only when something was actually added.
  const [search, setSearch] = useState<{
    groupId: string;
    tile: string;
    label: string;
  } | null>(null);
  const [searchAdded, setSearchAdded] = useState(false);
  const openSearch = (tile: string, label: string) => {
    setSearchAdded(false);
    setSearch({ ...benchSearchScopeForTile(tile), label });
  };
  const closeSearch = () => {
    setSearch(null);
    if (searchAdded) router.refresh();
    setSearchAdded(false);
  };
  // Reason-labeled sort lens for every category rail (2026-07-09). Default 'fit'
  // — the bench leads with what best matches the couple's date/venue/budget.
  const [sort, setSort] = useState<BenchSort>('fit');
  // Bench search (2026-07-10, PR-4 · S3) — a client-side filter over the ~53
  // categories (and their considered vendors). Empty = the normal single-open
  // accordion; a query filters to matching tiles and auto-expands them.
  const [query, setQuery] = useState('');
  // Inline whole-marketplace results (2026-07-10) — debounced server search that
  // shows top matching vendors from the WHOLE marketplace below the shortlist
  // filter, so a couple can discover a vendor they haven't shortlisted.
  const [mktResults, setMktResults] = useState<BenchMarketResult[]>([]);
  const [mktLoading, setMktLoading] = useState(false);

  // ── Per-category requirements view/edit modal (Phase 1b PR-4) ──────────────
  // The leaf whose saved-request modal is open: its canonical_service (the key
  // event_vendor_preferences rows on) + a human label for the header/copy.
  const [reqTarget, setReqTarget] = useState<{ canonicalService: string; label: string } | null>(
    null,
  );
  const [reqLoading, setReqLoading] = useState(false);
  const [reqFields, setReqFields] = useState<RequirementField[]>([]);
  const [reqPayload, setReqPayload] = useState<Record<string, Set<string>>>({});
  const [reqSpecial, setReqSpecial] = useState('');
  const [reqAutoSend, setReqAutoSend] = useState(false);
  const [reqPhase, setReqPhase] = useState<RequirementsModalPhase>('idle');
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqSaving, startReqSave] = useTransition();
  const [, startReopen] = useTransition();

  // ── Adaptive category set (Explore Replan PR-C) ───────────────────────────
  // Which category's ⓘ hint box is open (one at a time — it is help, never a
  // setting, so it always starts closed and never persists), plus the in-flight
  // state and the last refusal message for add/remove.
  const [hintTile, setHintTile] = useState<string | null>(null);
  const [planEditing, startPlanEdit] = useTransition();
  const [planError, setPlanError] = useState<{ tile: string; message: string } | null>(null);

  function removeTileFromPlan(tile: string) {
    setPlanError(null);
    startPlanEdit(async () => {
      const res = await excludeTileFromPlan({ eventId, tile });
      if (!res.ok) {
        setPlanError({ tile, message: res.error });
        return;
      }
      setOpenTile((cur) => (cur === tile ? null : cur));
      router.refresh();
    });
  }

  function addTileToPlan(tile: string, folder: string, slug: string) {
    setPlanError(null);
    startPlanEdit(async () => {
      const res = await restoreTileToPlan({ eventId, tile });
      if (!res.ok) {
        setPlanError({ tile, message: res.error });
        return;
      }
      openPlan(folder, tile, slug);
      router.refresh();
    });
  }
  const reqDialogRef = useRef<HTMLDivElement>(null);

  function closeReqModal() {
    setReqTarget(null);
    setReqLoading(false);
    setReqFields([]);
    setReqPayload({});
    setReqSpecial('');
    setReqAutoSend(false);
    setReqPhase('idle');
    setReqError(null);
  }

  // Open the saved-request modal for a leaf and lazily load its fields + the
  // couple's saved template (the icon only surfaces when a row exists, so this
  // pre-fills from it). Fail-soft: a load error shows the note box anyway.
  function openReqModal(canonicalService: string, label: string) {
    setReqTarget({ canonicalService, label });
    setReqLoading(true);
    setReqPhase('idle');
    setReqError(null);
    setReqFields([]);
    setReqPayload({});
    setReqSpecial('');
    setReqAutoSend(false);
    void loadCategoryRequirements(eventId, canonicalService)
      .then((res) => {
        if (res.status !== 'ok') {
          setReqError(res.message);
          return;
        }
        setReqFields(res.fields);
        const seeded: Record<string, Set<string>> = {};
        if (res.saved?.payload) {
          for (const [k, values] of Object.entries(res.saved.payload)) {
            seeded[k] = new Set(values.filter((v) => typeof v === 'string'));
          }
        }
        setReqPayload(seeded);
        setReqSpecial(res.saved?.specialRequest ?? '');
        setReqAutoSend(res.saved?.autoSend ?? false);
      })
      .catch(() => setReqError('Could not load your saved request.'))
      .finally(() => setReqLoading(false));
  }

  function toggleReqFacet(fieldKey: string, option: string) {
    setReqPayload((prev) => {
      const next = { ...prev };
      const set = new Set(next[fieldKey] ?? []);
      if (set.has(option)) set.delete(option);
      else set.add(option);
      next[fieldKey] = set;
      return next;
    });
  }

  function submitReqModal() {
    if (!reqTarget || reqSaving || reqPhase === 'submitting' || reqPhase === 'sent') return;
    const payload: Record<string, string[]> = {};
    for (const [key, set] of Object.entries(reqPayload)) {
      const picks = Array.from(set);
      if (picks.length > 0) payload[key] = picks;
    }
    setReqPhase('submitting');
    setReqError(null);
    startReqSave(async () => {
      const res = await saveCategoryRequirements(eventId, reqTarget.canonicalService, {
        payload,
        specialRequest: reqSpecial.trim() || null,
        autoSend: reqAutoSend,
      });
      if (res.status === 'ok') {
        setReqPhase('sent');
        // Refresh so the icon reflects the new state (added/kept/cleared), then
        // close shortly after the "Saved" confirmation.
        router.refresh();
        window.setTimeout(closeReqModal, 700);
        return;
      }
      setReqPhase('error');
      setReqError(res.message);
    });
  }

  // ESC closes the requirements modal + locks body scroll while open.
  useEffect(() => {
    if (!reqTarget) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeReqModal();
    };
    window.addEventListener('keydown', handle);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handle);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqTarget]);

  const reqIsSubmitting = reqSaving || reqPhase === 'submitting';

  // "Your plan" — the couple's onboarding category picks (tiles flagged `planned`
  // by buildShortlistFolders), flattened across folders in display order. Drives
  // the strip atop the bench; tapping a chip opens that folder + category so the
  // plan the reveal promised is one tap from finding a vendor. Empty → no strip.
  const plannedList = folders.flatMap((f) =>
    f.tiles
      .filter((t) => t.planned)
      .map((t) => ({
        folder: f.folder,
        slug: f.slug,
        tile: t.tile,
        label: t.label,
        done: t.vendors.length > 0,
      })),
  );

  // ── Coverage Strip v2 + folder summaries (Explore Replan PR-B) ────────────
  // Everything below is DERIVED from data the bench already holds — the tile's
  // own vendor list, slice A's `coveredByTile`, and the build picks / days-out
  // the page already fetched for the plan model. No new query, no new schema.
  // While the flag is OFF none of it renders and the surface is unchanged.
  const replan = isExploreReplanEnabled();
  const buildPickSet = new Set(buildPickVendorIds);
  const plannedTileSet = new Set<string>(plannedList.map((p) => p.tile));

  // ── Ranking lenses (Explore Replan §15) ───────────────────────────────────
  // The control is bench-wide, so the §15.2 visibility gate is measured over
  // EVERY considered vendor on the bench — not per rail. A lens is offered when
  // the bench as a whole can be re-ordered by it; offering "Nearest" on one
  // category and hiding it on the next would read as a bug.
  //
  // Candidates are the SAME `CompatInputs` the scorer consumes, so the gate and
  // the ranking can never disagree about what data exists.
  const lensCandidates = useMemo(
    () =>
      replan
        ? folders.flatMap((f) => f.tiles.flatMap((t) => t.vendors.map((v) => benchCompatInputs(v))))
        : [],
    [folders, replan],
  );
  // Chips in order, each resolved to enabled / disabled-with-reason. A lens with
  // no honest disabled wording (In demand right now) is ABSENT from this list
  // rather than greyed — see `LENSES.demand` for why that is a requirement.
  const lensChips = useMemo(
    () => (replan ? visibleLenses(lensCandidates) : []),
    [lensCandidates, replan],
  );
  // A selected lens that is no longer offered (the couple sorted by "Nearest",
  // then their venue anchor went away) resolves to the default AT RENDER rather
  // than by correcting state — no effect, no risk of a set-state loop, and the
  // couple's stored preference survives in case the data comes back.
  const effectiveSort: BenchSort =
    replan && isLensKey(sort) && !lensChips.some((c) => c.key === sort && !c.disabled)
      ? 'fit'
      : sort;

  // ── Sort persistence (§13.3) ──────────────────────────────────────────────
  // Was `useState('fit')` and nothing else, so every reload or tab-away snapped
  // the bench back to "Best fit". Stored per EVENT. Read once on mount (not
  // during render — localStorage would desync SSR hydration), and only ever
  // restored to a lens the CURRENT bench can actually offer.
  const sortHydrated = useRef(false);
  const sortPersistArmed = useRef(false);
  useEffect(() => {
    if (!replan || sortHydrated.current) return;
    sortHydrated.current = true;
    const offered = new Set<BenchSort>([
      ...BENCH_PLAIN_SORTS.map((s) => s.key as BenchSort),
      ...lensChips.filter((c) => !c.disabled).map((c) => c.key as BenchSort),
    ]);
    const saved = readPersistedBenchSort(
      eventId,
      typeof window === 'undefined' ? null : window.localStorage,
      (mode) => offered.has(mode),
    );
    if (saved) setSort(saved);
  }, [replan, eventId, lensChips]);
  useEffect(() => {
    if (!replan) return;
    // Skip the first run: it fires alongside the hydrate effect above and would
    // otherwise write the DEFAULT over the couple's stored choice before it has
    // been read back.
    if (!sortPersistArmed.current) {
      sortPersistArmed.current = true;
      return;
    }
    persistBenchSort(eventId, sort, typeof window === 'undefined' ? null : window.localStorage);
  }, [replan, eventId, sort]);

  /** Every tile in a folder as a CoverageTile (`order` = taxonomy walk index). */
  const coverageByFolder = new Map<string, CoverageTile[]>();
  {
    let walk = 0;
    for (const f of folders) {
      const rows: CoverageTile[] = [];
      for (const t of f.tiles) {
        rows.push({
          tile: t.tile,
          folder: f.folder,
          slug: f.slug,
          label: t.label,
          vendorCount: t.vendors.length,
          lockedCount: t.vendors.filter((v) => v.status === 'locked').length,
          // PR-H · derived upstream by the one shared core and read here, never
          // re-worked out. Always 0 while the flag is off.
          askedCount: t.vendors.filter((v) => v.lockRequestState === 'requested').length,
          buildCount: t.vendors.filter((v) => buildPickSet.has(v.vendorId)).length,
          covered: Boolean(coveredByTile[t.tile]),
          order: walk++,
        });
      }
      coverageByFolder.set(f.folder, rows);
    }
  }
  // ── Adaptive category set (Explore Replan PR-C · decision #6) ─────────────
  // The bench shows the couple's IN-PLAN tiles; the rest sit in a per-folder
  // "＋ Add to your event" chip pool. The rule itself is pure and unit-tested in
  // lib/explore-in-plan.ts — including the reason `inPlan` and `coverage` are
  // two sets (a wedding has no onboarding plan to seed from, and collapsing its
  // ~53-row bench to whatever is already shortlisted would be an amputation,
  // not an adaptation). Locks pin a tile in plan no matter what; the deep-link
  // target is pinned too so `?open=` always lands on a row.
  const allTilesInOrder = folders.flatMap((f) => f.tiles.map((t) => t.tile));
  const inPlanResolution = resolveInPlanTiles({
    allTiles: allTilesInOrder,
    plannedTiles: plannedTileSet,
    tilesWithVendors: new Set(
      folders.flatMap((f) => f.tiles.filter((t) => t.vendors.length > 0).map((t) => t.tile)),
    ),
    tilesWithLocks: new Set(
      folders.flatMap((f) =>
        f.tiles.filter((t) => t.vendors.some((v) => v.status === 'locked')).map((t) => t.tile),
      ),
    ),
    excludedTiles: new Set(excludedTiles),
    pinnedTiles: initialOpenTile ? new Set([initialOpenTile]) : undefined,
  });
  // Flag OFF → null everywhere below, so every adaptive branch is skipped and
  // the bench renders exactly as it does in production today.
  const inPlanTiles = replan ? inPlanResolution.inPlan : null;

  // The strip shows IN-PLAN categories only (decision #5) — with the flag on
  // that is PR-C's coverage set (which adjusts "Covered X of Y" to the in-plan
  // size, spec §5.2); with it off it stays the onboarding plan the chip strip
  // it replaces already drew, so `openPlan` still reaches every tile.
  const stripSource = inPlanTiles ? inPlanResolution.coverage : plannedTileSet;
  const stripTiles = orderCoverageTiles(
    [...coverageByFolder.values()].flat().filter((t) => stripSource.has(t.tile)),
    daysUntilWedding,
  );
  const stripSummary = coverageSummary(stripTiles);
  // Progress ring geometry (r=13.5 in a 34×34 box — the prototype's numbers).
  const RING_R = 13.5;
  const RING_C = 2 * Math.PI * RING_R;

  function openPlan(folder: string, tile: string, slug: string) {
    setOpenFolder(folder);
    setOpenTile(tile);
    // Scroll the folder into view after it expands (next frame).
    //
    // Target unchanged (the FOLDER anchor): this path expands a folder that was
    // collapsed, and while the 0fr→1fr transition runs the leaf rows have no
    // height yet, so aiming at the leaf here would land on a position that no
    // longer exists 240ms later. The mount path below has no such problem —
    // there the folder is open on the FIRST paint, so nothing animates.
    // Routed through the shared helper only so reduced motion is honoured.
    window.setTimeout(() => {
      scrollBenchAnchor(benchFolderAnchorId(slug));
    }, 60);
  }

  // ── Deep-link landing — THE BENCH OWNS THIS SCROLL (2026-07-29) ────────────
  // Fixes the owner's "still needs your decision doesn't jump to the exact
  // accordion cell". Two defects, one handler:
  //
  //  1. There was no leaf anchor at all — only `#slfold-<slug>` — so the
  //     doorway could not aim at the category even in principle. The leaf row
  //     now renders `#sltile-<tile>` (see `benchTileAnchorId`).
  //  2. The doorway guessed a 220ms `setTimeout` after `router.push`. That push
  //     changes `page.tsx`'s `key={`sl-${sp.open ?? ''}`}`, which REMOUNTS this
  //     component — and a caller cannot observe a remount it does not own. The
  //     miss was silent, because it ended in `?.scrollIntoView()` on a null.
  //
  // So the scroll moves here, where the remount is observable: this effect IS
  // the remount. No millisecond is guessed. `useLayoutEffect` + one frame is
  // exact rather than hopeful, because `openFolder`/`openTile` are seeded in the
  // `useState` initialisers above — `.fold.open` / `.cat.open` are therefore
  // present on the FIRST paint, no expand transition runs, and layout is final
  // by the time the frame callback fires. (The frame is only there to let the
  // browser complete that first paint before we measure it.)
  //
  // Mount-only on purpose: `initialOpenTile` is fixed for a component instance
  // (the page re-keys on it), so a changed deep link arrives as a NEW mount.
  useLayoutEffect(() => {
    // Flag OFF → byte-identical to today, including this doing nothing: the
    // checklist's `?open=` deep link lands the category open but unscrolled,
    // exactly as it ships.
    if (!replan || !deepLinkFolderSlug || !initialOpenTile) return;
    const frame = requestAnimationFrame(() => {
      // Falls back to the folder if the leaf row isn't on the bench (the tile
      // is pinned in-plan by `resolveInPlanTiles`, so this is belt-and-braces).
      if (!scrollBenchAnchor(benchTileAnchorId(initialOpenTile))) {
        scrollBenchAnchor(benchFolderAnchorId(deepLinkFolderSlug));
      }
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bench search — filter folders to tiles (or their considered vendors) matching
  // the query; while searching, every matching folder + tile shows expanded.
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const visibleFolders = searching
    ? folders
        .map((f) => ({
          ...f,
          tiles: f.tiles.filter(
            (t) =>
              t.label.toLowerCase().includes(q) ||
              t.vendors.some((v) => v.name.toLowerCase().includes(q)),
          ),
        }))
        .filter((f) => f.tiles.length > 0)
    : folders;

  // Debounced whole-marketplace search — fires ~280ms after typing settles; a
  // cancel flag drops stale responses so results can't arrive out of order.
  useEffect(() => {
    if (q.length < 2) {
      setMktResults([]);
      setMktLoading(false);
      return;
    }
    let cancelled = false;
    setMktLoading(true);
    const handle = window.setTimeout(() => {
      searchMarketplaceForBench(q)
        .then((res) => {
          if (!cancelled) {
            setMktResults(res);
            setMktLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMktResults([]);
            setMktLoading(false);
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q]);

  return (
    <div className="slcat">
      <style>{SLCAT_CSS}</style>
      {replan && stripTiles.length > 0 ? (
        /* Coverage Strip v2 (Explore Replan PR-B) — the SAME `.plan-strip`
           shell + the SAME `openPlan` doorway as the chip strip it upgrades;
           only the rendering and the ordering change. Icon tile per in-plan
           category, state ring, count badge, NEXT flag, "Covered X of Y" and a
           progress ring. Ordered by the accordion's own planning clock, with
           covered categories sunk to the right. */
        <div className="plan-strip">
          <div className="cov-hd">
            <span className="cov-hl">
              <svg
                className="cov-ring"
                viewBox="0 0 34 34"
                role="img"
                aria-label={coverageCountLabel(stripSummary.covered, stripSummary.total)}
              >
                <circle className="tr" cx="17" cy="17" r={RING_R} />
                <circle
                  className="pr"
                  cx="17"
                  cy="17"
                  r={RING_R}
                  strokeDasharray={RING_C.toFixed(1)}
                  strokeDashoffset={(RING_C * (1 - stripSummary.fraction)).toFixed(1)}
                />
                <text x="17" y="20.5" textAnchor="middle">
                  {stripSummary.covered}
                </text>
              </svg>
              <b>{COVERAGE_STRIP_HEADING}</b>
            </span>
            <span className="cov-cnt">
              {coverageCountLabel(stripSummary.covered, stripSummary.total)}
            </span>
          </div>
          <div className="cov-strip">
            {stripTiles.map((t) => {
              const state = coverageStateOf(t);
              const badge = coverageBadgeOf(t);
              const isNext = stripSummary.nextTile === t.tile;
              const Icon = tileIcon(t.tile);
              return (
                <button
                  key={t.tile}
                  type="button"
                  className={`ctile st-${state}${isNext ? ' is-next' : ''}`}
                  aria-label={coverageTileLabel({
                    label: t.label,
                    state,
                    vendorCount: t.vendorCount,
                    lockedCount: t.lockedCount,
                    buildCount: t.buildCount,
                    askedCount: t.askedCount,
                    isNext,
                  })}
                  onClick={() => openPlan(t.folder, t.tile, t.slug)}
                >
                  <span className="ic">
                    {isNext ? (
                      <span className="nx" aria-hidden>
                        {COVERAGE_NEXT_FLAG}
                      </span>
                    ) : null}
                    <Icon size={21} strokeWidth={1.6} aria-hidden />
                    {badge ? (
                      <span
                        className={`mini ${
                          badge.kind === 'covered'
                            ? 'dn'
                            : badge.kind === 'locked'
                              ? 'lk'
                              : // PR-H · an asked count must not wear the LOCKED
                                // badge's solid gold fill. Its own class, dashed
                                // like the tile it sits on.
                                badge.kind === 'asked'
                                ? 'ak'
                                : 'bd'
                        }`}
                        aria-hidden
                      >
                        {badge.text}
                      </span>
                    ) : null}
                  </span>
                  <span className="lb">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : plannedList.length > 0 ? (
        <div className="plan-strip">
          <p className="plan-eyebrow">
            <Sparkles size={11} strokeWidth={2} aria-hidden /> From your plan
          </p>
          <div className="plan-chips">
            {plannedList.map((p) => (
              <button
                key={p.tile}
                type="button"
                className={`plan-chip${p.done ? ' done' : ''}`}
                onClick={() => openPlan(p.folder, p.tile, p.slug)}
              >
                <span className="pc-dot" aria-hidden />
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {/* PR-G1 · the convergence banner. Between the Coverage Strip and the
          bench, because that is where the narrowing it reports is happening.
          Server-resolved; null on an open window, so the surface stays calm
          until the couple's build actually says something. */}
      {convergence ? (
        <div className={`convrg t-${convergence.tone}`} role="status">
          <span className="cv-i" aria-hidden>
            {convergence.tone === 'conflict' ? (
              <CalendarX2 size={15} strokeWidth={1.9} />
            ) : convergence.tone === 'converged' ? (
              <CalendarCheck size={15} strokeWidth={1.9} />
            ) : (
              <CalendarDays size={15} strokeWidth={1.9} />
            )}
          </span>
          <span className="cv-b">
            <b>{convergence.headline}</b>
            <span>{convergence.detail}</span>
          </span>
        </div>
      ) : null}
      <div className="sortbar">
        <span className="sortbar-lbl">Sort by</span>
        {replan ? (
          <>
            {/* The five RANKING LENSES — one scorer, five named weight vectors,
                every card carrying the reason it is where it is. */}
            <div className="sortseg" role="group" aria-label="Ranking lens">
              {lensChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={effectiveSort === c.key ? 'on' : undefined}
                  aria-pressed={effectiveSort === c.key}
                  disabled={c.disabled}
                  title={c.reason ?? undefined}
                  aria-label={c.reason ? `${c.label} — ${c.reason}` : undefined}
                  onClick={() => setSort(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <span className="sortsep" aria-hidden />
            {/* The two PLAIN SORTS, kept visually separate. They are a user job
                ("just show me the cheapest"), not a recommendation: no score, no
                reason pill. "Lowest price" could not be a lens even if we wanted
                it to be — `priceFitScore` ties every in-budget vendor at 1.0, so
                a "cheapest" weight vector is arithmetically impossible. */}
            <div className="sortseg" role="group" aria-label="Sort vendors">
              {BENCH_PLAIN_SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={effectiveSort === s.key ? 'on' : undefined}
                  aria-pressed={effectiveSort === s.key}
                  onClick={() => setSort(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="sortseg" role="group" aria-label="Sort vendors">
            {BENCH_SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={sort === s.key ? 'on' : undefined}
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="bench-search">
        <Search size={16} strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your shortlist or the whole marketplace…"
          aria-label="Search your shortlist or the marketplace"
        />
        {query ? (
          <button type="button" className="bs-x" aria-label="Clear search" onClick={() => setQuery('')}>
            ×
          </button>
        ) : null}
      </div>
      {searching && (mktLoading || mktResults.length > 0) ? (
        <div className="bench-mkt-results">
          <div className="bmr-head">From the whole marketplace</div>
          {mktLoading && mktResults.length === 0 ? (
            <div className="bmr-loading">Searching the marketplace…</div>
          ) : (
            mktResults.map((r) => (
              <Link
                key={r.vendorProfileId}
                href={r.slug ? `/v/${r.slug}` : '#'}
                prefetch={false}
                className="bmr-row"
              >
                <span className="bmr-av">{initials(r.name)}</span>
                <span className="bmr-m">
                  <b>{r.name}</b>
                  <span>
                    {[r.city, r.rating != null ? `★ ${r.rating.toFixed(1)}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <ArrowRight className="bmr-arr" size={15} strokeWidth={2} aria-hidden />
              </Link>
            ))
          )}
        </div>
      ) : null}
      {searching ? (
        <Link
          href={`/explore?q=${encodeURIComponent(query.trim())}`}
          prefetch={false}
          className="bench-mkt"
        >
          <Search size={15} strokeWidth={1.9} aria-hidden />
          <span>
            See all results in the marketplace for <b>“{query.trim()}”</b>
          </span>
          <ArrowRight className="bench-mkt-arr" size={16} strokeWidth={2} aria-hidden />
        </Link>
      ) : null}
      {searching && visibleFolders.length === 0 ? (
        <div className="bench-empty">
          Nothing in your shortlist matches “{query.trim()}” — try the whole marketplace above.
        </div>
      ) : null}
      {visibleFolders.map((folder) => {
        const folderOpen = searching || openFolder === folder.folder;
        // Folder-head summary (Explore Replan PR-B · decision #8). Computed over
        // the FULL folder (not the search-filtered slice) so the numbers stay
        // true while a query narrows the visible rows.
        const fsum = inPlanTiles
          ? folderSummaryOf(coverageByFolder.get(folder.folder) ?? [], inPlanTiles)
          : replan
            ? folderSummaryOf(coverageByFolder.get(folder.folder) ?? [], plannedTileSet)
            : null;
        // PR-C — split the folder's (already search-filtered) tiles into the
        // rows the couple planned and the "＋ Add to your event" chips. Flag OFF
        // → every tile is a row, exactly as today.
        const rowTiles = inPlanTiles
          ? folder.tiles.filter((t) => inPlanTiles.has(t.tile))
          : folder.tiles;
        const poolTiles = inPlanTiles
          ? folder.tiles.filter((t) => !inPlanTiles.has(t.tile))
          : [];
        const FolderIcon = folderIcon(folder.folder);
        return (
          <section
            key={folder.folder}
            id={benchFolderAnchorId(folder.slug)}
            className={`fold${folderOpen ? ' open' : ''}`}
          >
            <button
              type="button"
              className="fold-head"
              aria-expanded={folderOpen}
              onClick={() => {
                setOpenFolder(folderOpen ? null : folder.folder);
                setOpenTile(null);
              }}
            >
              {/* Visual parity 2026-07-28 — the prototype gives every folder
                  row a glyph and the live bench had none. Lucide, from the
                  SHARED `WEDDING_FOLDER_ICON` the /explore strip already uses;
                  the prototype's emoji are a prototyping shortcut and do not
                  come across. Decorative only: the label beside it is the
                  accessible name, so the icon is aria-hidden. */}
              <span className="fold-l">
                <span className="fold-ic" aria-hidden>
                  <FolderIcon size={17} strokeWidth={1.7} />
                </span>
                <span className="fold-nm">{folder.label}</span>
              </span>
              <span className="fold-rt">
                {fsum ? (
                  <span className="fsum">
                    {fsum.locked > 0 ? (
                      <span className="s lk">{FOLDER_SUMMARY_LOCKED(fsum.locked)}</span>
                    ) : null}
                    {fsum.toDecide > 0 ? (
                      <span className="s td">{FOLDER_SUMMARY_TO_DECIDE(fsum.toDecide)}</span>
                    ) : null}
                    {fsum.allCovered ? (
                      <span className="s dn">{FOLDER_SUMMARY_ALL_COVERED}</span>
                    ) : null}
                    {fsum.more > 0 ? (
                      <span className="s ad">{FOLDER_SUMMARY_MORE(fsum.more)}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className={`fold-meta${folder.pickCount > 0 ? ' has' : ''}`}>
                    {folder.pickCount > 0
                      ? `${folder.pickCount} considering`
                      : `${folder.tiles.length} categories`}
                  </span>
                )}
                <ChevronDown className="fold-chev" size={17} strokeWidth={1.75} aria-hidden />
              </span>
            </button>
            <div className="fold-collapse">
              <div className="fold-body">
                {rowTiles.map((t) => {
                  const tileOpen = searching || openTile === t.tile;
                  const coveredGroup = coveredByTile[t.tile] ?? null;
                  // Phase 1b PR-4 — the leaf canonical with a saved requirements
                  // row for this tile (if any) drives the "saved request" icon.
                  const savedCanonical = savedRequirementCanonicalByTile[t.tile] ?? null;
                  // PR-C — the ⓘ copy (null → no button, never invented copy)
                  // and whether this category may be removed from the plan.
                  const hint = replan ? categoryHintForTile(t.tile) : null;
                  const lockedNames = t.vendors.filter((v) => v.status === 'locked').map((v) => v.name);
                  const removable =
                    replan && canRemoveTileFromPlan({ lockedCount: lockedNames.length });
                  const rowError = planError?.tile === t.tile ? planError.message : null;
                  // Slice D — the rail-end card flips from "Find more" to
                  // "＋ Add another {tile}" once this category has a lock AND
                  // its group allows more picks. The group is resolved at TILE
                  // grain here (the category the couple is looking at), not per
                  // card; null → the rule can't apply and "Find more" stands.
                  const tileGroupId = replan
                    ? planGroupForCategory(categoryForTile(t.tile))
                    : null;
                  const addAnother = railEndIsAddAnother({
                    enabled: replan,
                    lockedCount: lockedNames.length,
                    planGroupId: tileGroupId,
                  });
                  // PR-G1 — sort FIRST (the couple's chosen order), then sink
                  // the schedule clashes to the end. Stable: the sink only
                  // moves the losers, it never reshuffles the winners.
                  //
                  // §15 — "the couple's chosen order" is now their chosen LENS.
                  // The two features compose cleanly and in this order only: the
                  // lens decides merit, the sink is a partition applied AFTER it
                  // and never a term inside the score.
                  const rail = partitionByBuildFit(
                    sortWithReasons(t.vendors, effectiveSort),
                    ({ v }) =>
                      v.buildFit === 'clash'
                        ? { fits: false, clashWith: v.buildClashWith }
                        : null,
                  );
                  const CatIcon = tileIcon(t.tile);
                  return (
                    <div
                      key={t.tile}
                      // THE LEAF ANCHOR (2026-07-29). The bench used to render
                      // only `#slfold-*`, so "jump to this category" doorways
                      // could aim no closer than the folder head — the exact
                      // cell had no scroll target at all. Flag OFF → `undefined`
                      // → the attribute is not emitted and the DOM is
                      // byte-identical to today.
                      id={replan ? benchTileAnchorId(t.tile) : undefined}
                      className={`cat${tileOpen ? ' open' : ''}`}
                    >
                      {/* The category head is a tap target to expand. The
                          "saved request" icon sits beside it as its OWN button
                          (not nested in the head button — buttons can't nest). */}
                      <div className="cat-head-row" style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="cat-head"
                          aria-expanded={tileOpen}
                          onClick={() => setOpenTile(tileOpen ? null : t.tile)}
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          {/* Visual parity 2026-07-28 — a glyph per leaf row,
                              same Lucide source (`tileIcon`) the Coverage Strip
                              tiles already draw from, so a category reads the
                              same in both places. `.cat-l` carries the
                              min-width:0 the ellipsis needs; `.cat-nm` keeps
                              its own truncation. Decorative → aria-hidden. */}
                          <span className="cat-l">
                            <span className="cat-ic" aria-hidden>
                              <CatIcon size={15} strokeWidth={1.7} />
                            </span>
                            <span className="cat-nm">{t.label}</span>
                          </span>
                          <span className="cat-rt">
                            {/* Free first-venue-shortlist carve-out (owner
                                2026-07-09 · Pricing.md § 00): presentational
                                chip, live only while the venue shortlist is
                                empty (the offer's "first" gate). */}
                            {isSuriAssistFreeForCategory(t.category) &&
                            t.vendors.length === 0 ? (
                              <span className="cat-free">{FREE_VENUE_ASSIST_CHIP}</span>
                            ) : null}
                            {t.planned && t.vendors.length === 0 ? (
                              <span className="cat-plan">In your plan</span>
                            ) : null}
                            {coveredGroup ? (
                              <span className="cat-plan" style={{ color: '#41603b' }}>
                                ✓ Covered
                              </span>
                            ) : null}
                            {t.vendors.length > 0 ? (
                              <span className="cat-count">{t.vendors.length}</span>
                            ) : null}
                            <ChevronDown className="cat-chev" size={16} strokeWidth={1.75} aria-hidden />
                          </span>
                        </button>
                        {/* Per-category ⓘ (PR-C · design §5.1). Its own button
                            beside the head — buttons can't nest — resolving to
                            the plan group's shipped `hint` through the
                            many-to-one tile→group bridge. No copy in JSX. */}
                        {hint ? (
                          <button
                            type="button"
                            className="cat-info"
                            aria-expanded={hintTile === t.tile}
                            aria-label={categoryHintButtonLabel(t.label)}
                            title={categoryHintButtonLabel(t.label)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setHintTile((cur) => (cur === t.tile ? null : t.tile));
                            }}
                          >
                            i
                          </button>
                        ) : null}
                        {savedCanonical ? (
                          <button
                            type="button"
                            className="cat-req"
                            style={{ marginLeft: 8, marginRight: 2 }}
                            aria-label={`View or edit your saved request for ${t.label}`}
                            title={`Your saved request for ${t.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openReqModal(savedCanonical, t.label);
                            }}
                          >
                            <SlidersHorizontal size={15} strokeWidth={1.85} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      {/* The hint box stays readable with the category
                          collapsed — it answers "do I even need this?", which
                          is a question you ask BEFORE opening the rail. */}
                      {hint && hintTile === t.tile ? (
                        <div className="hintbox">{hint}</div>
                      ) : null}
                      {/* Collapsed rows NAME what's locked here (decision #8) —
                          "who did we choose for this?" answered without opening
                          the rail. Hidden while the category is open, because
                          the cards themselves say it better ("★ Chosen"). */}
                      {replan && !tileOpen && lockedNames.length > 0 ? (
                        <p
                          className="cat-locked"
                          aria-label={lockedNamesLabel(lockedNames, t.label)}
                        >
                          <Lock size={10} strokeWidth={2.2} aria-hidden />
                          <span>{lockedNamesLine(lockedNames)}</span>
                        </p>
                      ) : null}
                      <div className="cat-collapse">
                        <div className="cat-body">
                          {coveredGroup ? (
                            /* "✓ Covered — reopen" (Explore Replan slice A):
                               the couple answered "I'm done" here, or a
                               hard-single slot filled. Reopen deletes the
                               decision row; the rail returns on refresh. */
                            <div
                              className="find-set"
                              style={{ alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <span className="fr-t" style={{ fontWeight: 600 }}>
                                ✓ Covered — you&apos;re done with {t.label}.
                              </span>
                              <button
                                type="button"
                                className="fr manual"
                                onClick={() =>
                                  startReopen(async () => {
                                    await clearCategoryDecision({
                                      eventId,
                                      planGroupId: coveredGroup,
                                    });
                                    router.refresh();
                                  })
                                }
                              >
                                <span className="fr-t">Reopen</span>
                              </button>
                            </div>
                          ) : t.vendors.length > 0 ? (
                            <div className="rail">
                              {rail.fits.map(({ v, reason }) => (
                                <VendorCard
                                  key={v.vendorId}
                                  v={v}
                                  reason={reason}
                                  eventId={eventId}
                                  tileLabel={t.label}
                                  // Slice D — three-action card. The resolver is
                                  // pure + unit-tested; flag OFF returns nothing
                                  // and the card renders exactly as it shipped.
                                  actions={resolveBenchCardActions({
                                    enabled: replan,
                                    vendor: v,
                                    inBuild: buildPickSet.has(v.vendorId),
                                  })}
                                />
                              ))}
                              {/* Rail-end card. BOTH labels ("Find more" /
                                  "＋ Add another X" — slice D's
                                  `railEndIsAddAnother`, untouched) open the SAME
                                  in-place sheet: it is one job with two framings.
                                  Flag OFF keeps the shipped `/explore?tile=`
                                  <Link> exactly as it ships. `.slcat .act>*`
                                  styles the button and the link identically —
                                  the sibling "Add manually" card is already a
                                  <button> in the same wrapper. */}
                              <span className="act find">
                                {replan ? (
                                  <button
                                    type="button"
                                    onClick={() => openSearch(t.tile, t.label)}
                                  >
                                    {addAnother ? (
                                      <Plus size={20} strokeWidth={1.9} aria-hidden />
                                    ) : (
                                      <Search size={20} strokeWidth={1.75} aria-hidden />
                                    )}
                                    <span className="at">
                                      {addAnother ? cardAddAnother(t.label) : 'Find more'}
                                    </span>
                                  </button>
                                ) : (
                                  <Link href={t.exploreHref} prefetch={false}>
                                    {addAnother ? (
                                      <Plus size={20} strokeWidth={1.9} aria-hidden />
                                    ) : (
                                      <Search size={20} strokeWidth={1.75} aria-hidden />
                                    )}
                                    <span className="at">
                                      {addAnother ? cardAddAnother(t.label) : 'Find more'}
                                    </span>
                                  </Link>
                                )}
                              </span>
                              <span className="act manual">
                                <button
                                  type="button"
                                  onClick={() => setManual({ category: t.category, label: t.label })}
                                >
                                  <Pencil size={18} strokeWidth={1.75} aria-hidden />
                                  <span className="at">Add manually</span>
                                </button>
                              </span>
                              {/* PR-G1 · the SOFT tier's sink. Vendors with no
                                  free day left inside the build's shared-date
                                  window keep their place in the rail — after the
                                  Find/Add cards, behind a labelled divider —
                                  instead of vanishing. Removing the clashing
                                  candidate puts them straight back. */}
                              {rail.clashes.length > 0 ? (
                                <>
                                  <span
                                    className="raildiv"
                                    role="separator"
                                    aria-label={DOESNT_FIT_DIVIDER}
                                  >
                                    <span aria-hidden>{DOESNT_FIT_DIVIDER}</span>
                                  </span>
                                  {rail.clashes.map(({ v, reason }) => (
                                    <VendorCard
                                      key={v.vendorId}
                                      v={v}
                                      reason={reason}
                                      eventId={eventId}
                                      tileLabel={t.label}
                                      actions={resolveBenchCardActions({
                                        enabled: replan,
                                        vendor: v,
                                        inBuild: buildPickSet.has(v.vendorId),
                                      })}
                                    />
                                  ))}
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <div className="find-set">
                              {/* Empty-category doorway — same swap as the
                                  rail-end card above. `.fr` already resets
                                  button chrome (the "Add manually" sibling is a
                                  <button> with the same class). */}
                              {replan ? (
                                <button
                                  type="button"
                                  className="fr find"
                                  onClick={() => openSearch(t.tile, t.label)}
                                >
                                  <span className="fr-i">
                                    <Search size={16} strokeWidth={1.75} aria-hidden />
                                  </span>
                                  <span className="fr-t">Find {t.label}</span>
                                </button>
                              ) : (
                                <Link href={t.exploreHref} className="fr find" prefetch={false}>
                                  <span className="fr-i">
                                    <Search size={16} strokeWidth={1.75} aria-hidden />
                                  </span>
                                  <span className="fr-t">Find {t.label}</span>
                                </Link>
                              )}
                              <button
                                type="button"
                                className="fr manual"
                                onClick={() => setManual({ category: t.category, label: t.label })}
                              >
                                <span className="fr-i">
                                  <Pencil size={16} strokeWidth={1.75} aria-hidden />
                                </span>
                                <span className="fr-t">Add manually</span>
                              </button>
                            </div>
                          )}
                          {/* "Not needed? Remove" (PR-C · decision #6). Quiet,
                              at the foot of an OPEN category, and absent
                              entirely when the category holds a locked vendor —
                              removing one never cancels a booking. The server
                              action re-checks and refuses; that refusal is what
                              `plan-err` renders. */}
                          {replan && !coveredGroup && (removable || rowError) ? (
                            <div className="cat-note">
                              {rowError ? <span className="plan-err">{rowError}</span> : null}
                              {removable ? (
                                <button
                                  type="button"
                                  className="rmv"
                                  disabled={planEditing}
                                  aria-label={removeFromPlanButtonLabel(t.label)}
                                  onClick={() => removeTileFromPlan(t.tile)}
                                >
                                  {REMOVE_FROM_PLAN_LABEL}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* "＋ Add to your event" (PR-C · decision #6) — everything in
                    this folder the couple is NOT planning, as a chip pool at
                    the foot of the folder body. Tapping one clears the
                    exclusion and opens the category. */}
                {inPlanTiles && rowTiles.length === 0 && poolTiles.length > 0 ? (
                  <p className="fold-empty">{folderEmptyInPlan(folder.label)}</p>
                ) : null}
                {inPlanTiles && poolTiles.length > 0 ? (
                  <div className="addpool">
                    <p className="ap-t">{ADD_TO_PLAN_HEADING}</p>
                    <div className="ap-chips">
                      {poolTiles.map((t) => {
                        const PoolIcon = tileIcon(t.tile);
                        return (
                          <button
                            key={t.tile}
                            type="button"
                            className="addchip"
                            disabled={planEditing}
                            aria-label={addToPlanChipLabel(t.label)}
                            onClick={() => addTileToPlan(t.tile, folder.folder, folder.slug)}
                          >
                            <PoolIcon size={13} strokeWidth={1.7} aria-hidden />
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                    {planError && poolTiles.some((t) => t.tile === planError.tile) ? (
                      <p className="plan-err" style={{ textAlign: 'left', marginTop: 8 }}>
                        {planError.message}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}
      {manual ? (
        <NewManualVendorModal
          eventId={eventId}
          category={manual.category}
          categoryLabel={manual.label}
          onClose={() => setManual(null)}
          onCreated={() => {
            setManual(null);
            router.refresh();
          }}
        />
      ) : null}

      {/* In-place category search (2026-07-29) — the SHIPPED overlay, mounted
          the same way `plan-budget-accordion.tsx` mounts it: rendered at the
          component root so its portal + fixed positioning escape the accordion's
          `overflow:hidden` collapse wrappers. It owns its own focus trap,
          scroll-lock and Escape (`useModalA11y`), so nothing extra is needed
          here. Flag-gated by construction: `search` can only be set by the
          replan-only buttons above. */}
      {search ? (
        <CategorySearchOverlay
          eventId={eventId}
          groupId={search.groupId}
          tile={search.tile}
          label={search.label}
          onClose={closeSearch}
          onAdded={() => setSearchAdded(true)}
        />
      ) : null}

      {/* Per-category saved-request view/edit modal (Phase 1b PR-4) */}
      {reqTarget ? (
        reqLoading ? (
          // Lightweight loading shell while fields + saved template resolve.
          <div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            // Transient busy indicator, not a focus-trapping modal: a live
            // region announces the load; it hands off to RequirementsModal
            // (which owns the real dialog a11y) once fields resolve.
            role="status"
            aria-label={`Loading your saved request for ${reqTarget.label}`}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={closeReqModal}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <div className="relative z-10 flex w-full items-center justify-center rounded-t-3xl border border-ink/10 bg-cream px-5 py-10 sm:w-full sm:max-w-lg sm:rounded-2xl">
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-mulberry border-t-transparent"
                aria-hidden
              />
            </div>
          </div>
        ) : (
          <RequirementsModal
            title={`${reqTarget.label} request`}
            subtitle="Review or update what you’re looking for."
            requirementsFields={reqFields}
            reqPayload={reqPayload}
            toggleFacet={toggleReqFacet}
            specialRequest={reqSpecial}
            setSpecialRequest={setReqSpecial}
            autoSend={reqAutoSend}
            setAutoSend={setReqAutoSend}
            categoryName={reqTarget.label}
            submitLabel="Save"
            sentLabel="Saved"
            phase={reqPhase}
            isSubmitting={reqIsSubmitting}
            errorMessage={reqError}
            onClose={closeReqModal}
            onSubmit={submitReqModal}
            dialogRef={reqDialogRef}
          />
        )
      ) : null}
    </div>
  );
}
