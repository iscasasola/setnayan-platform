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

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ChevronDown,
  Star,
  MapPin,
  MapPinOff,
  Wallet,
  CalendarCheck,
  CalendarX2,
  BadgeCheck,
  Sparkles,
  Pencil,
  SlidersHorizontal,
} from 'lucide-react';
import { formatPhp } from '@/lib/vendors';
import {
  BENCH_SORTS,
  sortWithReasons,
  type BenchSort,
  type SortReason,
} from '@/lib/bench-sort';
import {
  FREE_VENUE_ASSIST_CHIP,
  isSuriAssistFreeForCategory,
} from '@/lib/setnayan-ai-free-assist';
import { NewManualVendorModal } from '@/app/dashboard/[eventId]/_components/new-manual-vendor-modal';
import type { ShortlistFolder, ShortlistVendor } from '@/lib/shortlist-taxonomy';
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
.slcat{--paper:var(--m-paper,#FBFBFA);--ink:var(--m-ink,#1E2229);--ink-soft:#4F535B;
  --gold:var(--m-orange,#C5A059);--gold-deep:var(--m-orange-2,#8C6932);
  --mulberry:var(--m-mulberry,#1E2229);--line:var(--m-line,rgba(30,34,41,.12));
  --line-soft:rgba(30,34,41,.07);--card:#fff;
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --ease:cubic-bezier(.22,.61,.36,1);
  color:var(--ink);font-family:var(--sans)}
.slcat *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

/* ── Level 1 · folder card (collapsible) ── */
.slcat .fold{margin:0 0 8px;background:var(--card);border:0.5px solid var(--line);border-radius: var(--m-r-md);overflow:hidden;transition:box-shadow .3s var(--ease),border-color .3s var(--ease)}
.slcat .fold.open{box-shadow:0 8px 22px -16px rgba(30,34,41,.4);border-color:rgba(30,34,41,.16)}
.slcat .fold-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:transparent;border:0;cursor:pointer;padding:13px 16px;font:inherit;text-align:left;min-height:48px}
.slcat .fold-nm{font-family:var(--serif);font-style:italic;font-size:18px;font-weight:600;color:var(--ink);line-height:1;letter-spacing:.01em}
.slcat .fold.open .fold-nm{color:var(--mulberry)}
.slcat .fold-rt{display:flex;align-items:center;gap:11px;flex:0 0 auto}
.slcat .fold-meta{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.slcat .fold-meta.has{color:var(--gold-deep)}
.slcat .fold-chev{color:var(--ink-soft);transition:transform .28s var(--ease);flex:0 0 auto}
.slcat .fold.open .fold-chev{transform:rotate(180deg);color:var(--mulberry)}

/* ── Level 2 · category rows inside an open folder (connecting rail) ── */
.slcat .fold-body{position:relative;padding:0 0 8px}
.slcat .fold-body::before{content:'';position:absolute;left:22px;top:0;bottom:14px;width:2px;background:rgba(30, 34, 41,.16);border-radius: var(--m-r-xs);pointer-events:none}
/* smooth expand/collapse (2026-07-10): the body is ALWAYS mounted inside a
   grid-rows wrapper, so toggling the parent's .open class animates height 0fr↔1fr
   BOTH ways. overflow clips the body while collapsing; a delayed visibility flip
   pulls collapsed content out of the tab order without cutting the animation. */
.slcat .fold-collapse,.slcat .cat-collapse{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s var(--ease)}
.slcat .fold.open .fold-collapse,.slcat .cat.open .cat-collapse{grid-template-rows:1fr}
.slcat .fold-collapse>.fold-body,.slcat .cat-collapse>.cat-body{overflow:hidden;min-height:0;opacity:.4;visibility:hidden;transition:opacity .26s var(--ease),visibility 0s .3s}
.slcat .fold.open .fold-body,.slcat .cat.open .cat-body{opacity:1;visibility:visible;transition:opacity .26s var(--ease),visibility 0s 0s}
@media (prefers-reduced-motion:reduce){.slcat .fold-collapse,.slcat .cat-collapse,.slcat .fold-collapse>.fold-body,.slcat .cat-collapse>.cat-body{transition:none}}
.slcat .cat{margin:0 14px 0 34px;border-top:1px solid var(--line-soft)}
.slcat .fold-body .cat:first-child{border-top:0}
.slcat .cat-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:transparent;border:0;cursor:pointer;padding:10px 4px;font:inherit;text-align:left;min-height:42px}
.slcat .cat-nm{font-family:var(--sans);font-weight:600;font-size:14px;color:var(--ink);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slcat .cat.open .cat-nm{color:var(--mulberry)}
.slcat .cat-rt{display:flex;align-items:center;gap:9px;flex:0 0 auto}
.slcat .cat-count{font-family:var(--mono);font-size:9.5px;letter-spacing:.04em;color:#fff;background:var(--mulberry);border-radius: var(--m-r-full);padding:3px 9px;font-weight:600;min-width:21px;text-align:center}
/* "saved request" icon — view/edit the couple's saved requirements for this leaf */
.slcat .cat-req{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:0 0 auto;border:1px solid rgba(30, 34, 41,.3);background:rgba(30, 34, 41,.07);color:var(--mulberry);border-radius: var(--m-r-full);cursor:pointer;transition:background .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .cat-req:hover{background:rgba(30, 34, 41,.13)}
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
.slcat .vc .img{height:108px;flex:0 0 108px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center;position:relative}
.slcat .vc .img img{width:100%;height:100%;object-fit:cover}
.slcat .vc .ini{font-family:var(--serif);font-style:italic;font-size:26px;color:rgba(255,255,255,.7)}
.slcat .vc .pcorner{position:absolute;top:8px;right:8px;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--mulberry);border-radius: var(--m-r-full);padding:4px 8px}
/* reason-labeled sort — the "why it's here" ribbon (top-left of the card) */
.slcat .vc .rpill{position:absolute;top:8px;left:8px;display:inline-flex;align-items:center;font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--m-r-full);padding:4px 8px;line-height:1}
.slcat .vc .rpill.ok{color:#fff;background:var(--gold-deep)}
.slcat .vc .rpill.soft{color:var(--ink);background:rgba(255,255,255,.82);backdrop-filter:blur(2px)}
html.dark .slcat .vc .rpill.soft{color:#FBFBFA;background:rgba(30,34,41,.7)}
/* sort toggle — pill segmented control (databerry "Brand addition / Upcoming" feel) */
.slcat .sortbar{display:flex;align-items:center;gap:9px;margin:0 0 13px;flex-wrap:wrap}
.slcat .sortbar-lbl{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.slcat .sortseg{display:inline-flex;gap:3px;padding:3px;background:rgba(30,34,41,.05);border:0.5px solid var(--line);border-radius:var(--m-r-full)}
.slcat .sortseg button{appearance:none;-webkit-appearance:none;border:0;cursor:pointer;font:inherit;font-family:var(--sans);font-size:12px;font-weight:600;color:var(--ink-soft);background:transparent;border-radius:var(--m-r-full);padding:6px 13px;transition:background .18s var(--ease),color .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .sortseg button:active{transform:scale(.96)}
.slcat .sortseg button.on{color:#fff;background:var(--mulberry)}
html.dark .slcat .sortseg{background:rgba(251,251,250,.05)}
html.dark .slcat .sortseg button.on{color:#1E2229;background:#C99DB0}
.slcat .vc .meta{padding:11px 13px 13px;flex:1 1 auto;display:flex;flex-direction:column;gap:5px}
.slcat .vc .vn{font-family:var(--sans);font-weight:700;font-size:13.5px;color:var(--ink);line-height:1.2}
.slcat .vc .sub{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;letter-spacing:.03em;color:var(--ink-soft)}
.slcat .vc .stars{display:flex;align-items:center;gap:3px;font-family:var(--mono);font-size:9px;color:var(--gold-deep)}
.slcat .vc .badges{display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
.slcat .vc .bdg{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:7.5px;letter-spacing:.06em;text-transform:uppercase;padding:3px 6px;border-radius: var(--m-r-full);background:rgba(30,34,41,.06);color:var(--ink-soft)}
.slcat .vc .bdg.verified{color:#2e7d4f;background:rgba(46,125,79,.1)}
.slcat .vc .bdg.setnayan{color:var(--mulberry);background:rgba(30, 34, 41,.1)}
/* ── fit-badges (2026-07-09): live reach + budget checks on the bench ── */
.slcat .vc .fits{display:flex;flex-wrap:wrap;gap:4px;margin-top:1px}
.slcat .vc .fit{display:inline-flex;align-items:center;gap:3px;font-family:var(--mono);font-size:7.5px;letter-spacing:.05em;text-transform:uppercase;padding:3px 6px;border-radius:var(--m-r-full);font-weight:600;line-height:1}
.slcat .vc .fit.ok{color:#2e7d4f;background:rgba(46,125,79,.1)}
.slcat .vc .fit.warn{color:#9a6a12;background:rgba(197,160,89,.16)}
html.dark .slcat .vc .fit.ok{color:#7bc79a;background:rgba(46,125,79,.18)}
html.dark .slcat .vc .fit.warn{color:#e2b968;background:rgba(197,160,89,.2)}
.slcat .vc .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:17px;color:var(--ink);margin-top:auto;padding-top:4px}
/* dashed action cards (in the rail, after the vendors) */
.slcat .act{flex:0 0 116px;scroll-snap-align:start;display:flex}
.slcat .act>*{flex:1;min-height:182px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;border-radius: var(--m-r-md);text-decoration:none;font:inherit;cursor:pointer;transition:transform .13s cubic-bezier(.2,.7,.2,1),background .2s var(--ease)}
.slcat .act>*:active{transform:scale(.97)}
.slcat .act.find>*{background:rgba(30, 34, 41,.05);border:1.5px dashed rgba(30, 34, 41,.4);color:var(--mulberry)}
.slcat .act.manual>*{background:rgba(30,34,41,.03);border:1.5px dashed var(--line);color:var(--ink-soft)}
.slcat .act .at{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;line-height:1.4;padding:0 8px}
/* empty category — Find + Add-manually share a row */
.slcat .find-set{display:flex;flex-wrap:wrap;gap:8px;padding:2px 16px 2px 0}
.slcat .fr{display:flex;align-items:center;gap:9px;flex:1 1 150px;padding:12px 14px;border-radius: var(--m-r-md);text-decoration:none;color:inherit;font:inherit;cursor:pointer;text-align:left;appearance:none;-webkit-appearance:none;transition:transform .13s cubic-bezier(.2,.7,.2,1)}
.slcat .fr:active{transform:scale(.99)}
.slcat .fr.find{border:1.5px dashed rgba(30, 34, 41,.32);background:rgba(30, 34, 41,.03)}
.slcat .fr.manual{border:1.5px dashed var(--line);background:rgba(30,34,41,.025)}
.slcat .fr .fr-i{display:inline-flex;flex:0 0 auto}
.slcat .fr.find .fr-i,.slcat .fr.find .fr-t{color:var(--mulberry)}
.slcat .fr.manual .fr-i,.slcat .fr.manual .fr-t{color:var(--ink-soft)}
.slcat .fr .fr-t{font-family:var(--sans);font-size:13px;font-weight:600}
.slcat a:focus-visible,.slcat button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

/* ── "Your plan" strip — the couple's onboarding category picks, surfaced atop
   the bench so the plan the reveal promised is one tap from acting on it ── */
.slcat .plan-strip{margin:0 0 14px;padding:13px 15px;background:rgba(30,34,41,.035);border:0.5px solid var(--line);border-radius:var(--m-r-md)}
.slcat .plan-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--gold-deep);margin:0 0 9px;display:flex;align-items:center;gap:6px}
.slcat .plan-chips{display:flex;flex-wrap:wrap;gap:7px}
.slcat .plan-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:var(--card);border:1px solid var(--line);border-radius:var(--m-r-full);font:inherit;font-family:var(--sans);font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer;transition:border-color .18s var(--ease),transform .12s cubic-bezier(.2,.7,.2,1)}
.slcat .plan-chip:hover{border-color:rgba(30,34,41,.32)}
.slcat .plan-chip:active{transform:scale(.97)}
.slcat .plan-chip .pc-dot{width:6px;height:6px;border-radius:var(--m-r-full);background:var(--gold);flex:0 0 auto}
.slcat .plan-chip.done .pc-dot{background:#2e7d4f}
/* "In your plan" marker beside a category name */
.slcat .cat-plan{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep);background:rgba(197,160,89,.13);border-radius:var(--m-r-full);padding:3px 8px;font-weight:600;white-space:nowrap}
/* Free first-venue-shortlist marker (owner 2026-07-09 · Pricing.md § 00) —
   presentational chip on the venue category while its shortlist is empty */
.slcat .cat-free{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mulberry);background:rgba(30,34,41,.08);border-radius:var(--m-r-full);padding:3px 8px;font-weight:600;white-space:nowrap}

html.dark .slcat .cat-free{color:#C99DB0;background:rgba(201,157,176,.14)}
html.dark .slcat .plan-strip{background:rgba(251,251,250,.04)}
html.dark .slcat .plan-chip{background:#2A2E36}
html.dark .slcat{--paper:#1E2229;--ink:#FBFBFA;--ink-soft:#B6B9BE;--line:rgba(251,251,250,.16);--line-soft:rgba(251,251,250,.1);--card:#2A2E36}
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
}: {
  v: ShortlistVendor;
  reason?: SortReason | null;
}) {
  return (
    <Link href={v.href} className="vc" prefetch={false}>
      <span className="img">
        {v.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photoUrl} alt="" loading="lazy" />
        ) : (
          <span className="ini">{initials(v.name)}</span>
        )}
        {v.status === 'locked' ? <span className="pcorner">★ Chosen</span> : null}
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
      </span>
    </Link>
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
  const reach =
    v.reachesVenue === true
      ? { cls: 'ok', icon: <MapPin size={9} strokeWidth={2.25} aria-hidden />, text: 'Reaches you' }
      : v.reachesVenue === false
        ? {
            cls: 'warn',
            icon: <MapPinOff size={9} strokeWidth={2.25} aria-hidden />,
            text: v.serviceRadiusKm ? `Beyond ${v.serviceRadiusKm}km` : 'Travel fee likely',
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
  if (!reach && !budget && !date) return null;
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
    </span>
  );
}

export function ShortlistCategories({
  folders,
  eventId,
  initialOpenTile = null,
  savedRequirementCanonicalByTile = {},
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
}) {
  const router = useRouter();
  // The folder that holds the deep-linked tile (if any) — used to pre-open it.
  // Known minor: the takeover unmounts inactive tab slots, so tabbing away from
  // Shortlist and back re-seeds this from the (server-fixed) prop and re-opens the
  // folder even if the couple collapsed it. Acceptable for a deep-link entry; a
  // persistent-mount fix on the takeover is a deferred follow-up.
  const deepLinkFolder = initialOpenTile
    ? (folders.find((f) => f.tiles.some((t) => t.tile === initialOpenTile))?.folder ?? null)
    : null;
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
  // Reason-labeled sort lens for every category rail (2026-07-09). Default 'fit'
  // — the bench leads with what best matches the couple's date/venue/budget.
  const [sort, setSort] = useState<BenchSort>('fit');

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

  function openPlan(folder: string, tile: string, slug: string) {
    setOpenFolder(folder);
    setOpenTile(tile);
    // Scroll the folder into view after it expands (next frame).
    window.setTimeout(() => {
      document.getElementById(`slfold-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  return (
    <div className="slcat">
      <style>{SLCAT_CSS}</style>
      {plannedList.length > 0 ? (
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
      <div className="sortbar">
        <span className="sortbar-lbl">Sort by</span>
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
      </div>
      {folders.map((folder) => {
        const folderOpen = openFolder === folder.folder;
        return (
          <section
            key={folder.folder}
            id={`slfold-${folder.slug}`}
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
              <span className="fold-nm">{folder.label}</span>
              <span className="fold-rt">
                <span className={`fold-meta${folder.pickCount > 0 ? ' has' : ''}`}>
                  {folder.pickCount > 0
                    ? `${folder.pickCount} considering`
                    : `${folder.tiles.length} categories`}
                </span>
                <ChevronDown className="fold-chev" size={17} strokeWidth={1.75} aria-hidden />
              </span>
            </button>
            <div className="fold-collapse">
              <div className="fold-body">
                {folder.tiles.map((t) => {
                  const tileOpen = openTile === t.tile;
                  // Phase 1b PR-4 — the leaf canonical with a saved requirements
                  // row for this tile (if any) drives the "saved request" icon.
                  const savedCanonical = savedRequirementCanonicalByTile[t.tile] ?? null;
                  return (
                    <div key={t.tile} className={`cat${tileOpen ? ' open' : ''}`}>
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
                          <span className="cat-nm">{t.label}</span>
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
                            {t.vendors.length > 0 ? (
                              <span className="cat-count">{t.vendors.length}</span>
                            ) : null}
                            <ChevronDown className="cat-chev" size={16} strokeWidth={1.75} aria-hidden />
                          </span>
                        </button>
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
                      <div className="cat-collapse">
                        <div className="cat-body">
                          {t.vendors.length > 0 ? (
                            <div className="rail">
                              {sortWithReasons(t.vendors, sort).map(({ v, reason }) => (
                                <VendorCard key={v.vendorId} v={v} reason={reason} />
                              ))}
                              <span className="act find">
                                <Link href={t.exploreHref} prefetch={false}>
                                  <Search size={20} strokeWidth={1.75} aria-hidden />
                                  <span className="at">Find more</span>
                                </Link>
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
                            </div>
                          ) : (
                            <div className="find-set">
                              <Link href={t.exploreHref} className="fr find" prefetch={false}>
                                <span className="fr-i">
                                  <Search size={16} strokeWidth={1.75} aria-hidden />
                                </span>
                                <span className="fr-t">Find {t.label}</span>
                              </Link>
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
                        </div>
                      </div>
                    </div>
                  );
                })}
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
