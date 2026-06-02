'use client';

/**
 * PlanBudgetAccordion — the couple-side Vendors tab (FULL VISUAL MATCH).
 *
 * Ports the design prototype Plan_Budget_Accordion_2026-05-31.html into the
 * live surface. Scoped CSS (PBA_CSS, under `.pba`) reproduces the prototype
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

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';

import { formatPhp } from '@/lib/vendors';
import { formatDistanceKm } from '@/lib/distance';
import { deleteVendor } from '../actions';
import { haptic } from '@/lib/haptics';
import { CategorySearchOverlay } from './category-search-overlay';
import { AccordionLockButton, ChangePickButton } from './accordion-lock';
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

function isLocked(pick: AccordionPick): boolean {
  return pick.raw_status !== null && LOCKED.has(pick.raw_status);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Scoped CSS ported from the prototype. Prototype design vars are aliased to
 * the app's Clean Editorial `--m-*` tokens (already loaded in globals.css)
 * + next/font CSS vars. Everything is namespaced under `.pba` so it can't
 * leak into the rest of the dashboard.
 */
const PBA_CSS = `
.pba{
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
@media (min-width:1024px){.pba{--pba-header-offset:0px;margin-bottom:-24px}.pba .topbar,.pba .meter{margin-left:0;margin-right:0}.pba .end-spacer{padding-bottom:30px}}
.pba *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

/* ---- Dark top budget bar ---- */
.pba .topbar{position:sticky;top:0;z-index:60;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--topbar-h);padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08);margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.pba .topbar .bleft{display:flex;flex-direction:column;gap:3px;min-width:0;padding:9px 0}
.pba .topbar .fig{display:flex;align-items:baseline;gap:7px;white-space:nowrap;line-height:1.18}
.pba .topbar .figk{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);width:46px;flex:0 0 auto}
.pba .topbar .figv{font-family:var(--serif);font-style:italic;font-size:19px;font-weight:600;color:var(--paper)}
.pba .topbar .rangev{font-family:var(--serif);font-style:italic;font-size:13px;font-weight:600;color:rgba(255,255,255,.6)}
.pba .topbar .bright{text-align:right;flex:0 0 auto;padding:9px 0}
.pba .topbar .tgt{font-family:var(--serif);font-style:italic;font-size:14px;font-weight:600;color:var(--paper);white-space:nowrap}
.pba .topbar .status{font-family:var(--mono);font-size:8px;letter-spacing:.06em;text-transform:uppercase;margin-top:3px;white-space:nowrap;color:rgba(255,255,255,.55)}
.pba .topbar .status.ok{color:#7fd49a}
.pba .topbar .status.near{color:var(--gold)}
.pba .topbar .status.over{color:#ef9a9a}
.pba .meter{position:relative;height:3px;background:rgba(30,34,41,.1);margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw)}
.pba .meter .fill{height:100%;width:0;background:var(--gold);transition:width .55s var(--ease),background .4s var(--ease)}
.pba .meter .fill.ok{background:#7fd49a}
.pba .meter .fill.near{background:var(--gold)}
.pba .meter .fill.over{background:#ef9a9a}

/* ---- Scroll body wrap ---- */
/* No bottom padding: the recap is the terminal element. Its own bottom
   padding (= --botnav-h) clears the fixed mobile nav, so the recap ends just
   above the nav with NO dead scroll below it (owner 2026-05-31). */
.pba .body{max-width:760px;margin:0 auto;padding:0}

/* ---- Landing overview ---- */
/* Cover page — the landing overview is the default FIRST view. It fills the
   screen BETWEEN the black bar (top) and the fixed bottom nav, so the ↓ cue
   (margin-top:auto) snaps just above the nav's top border and is never hidden
   behind it (owner 2026-05-31). */
.pba .intro{display:flex;flex-direction:column;gap:14px;padding:26px 22px 16px;min-height:calc(100svh - var(--topbar-h) - var(--botnav-h));background:var(--paper)}
.pba .intro-eyebrow{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep)}
.pba .intro-h{font-family:var(--serif);font-style:italic;font-size:29px;line-height:1.05;color:var(--ink);margin:2px 0 4px}
.pba .intro-grid{display:flex;flex-direction:column;gap:10px}
.pba .irow3{display:flex;gap:10px}
.pba .irow3 .ibox{flex:1;min-width:0}
.pba .ibox{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 15px}
.pba .ik{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.pba .iv{font-family:var(--serif);font-style:italic;font-weight:600;font-size:19px;line-height:1.15;color:var(--ink);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* deadline list box */
.pba .ibox.dl{padding:13px 15px}
.pba .dl-tag{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:2px}
.pba .dl-row{display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit}
.pba .dl-row:first-of-type{border-top:0}
.pba .dl-dot{width:7px;height:7px;border-radius:50%;flex:none}
.pba .dl-row.over .dl-dot{background:#b23b34}
.pba .dl-row.soon .dl-dot{background:var(--gold)}
.pba .dl-row.start .dl-dot{background:var(--gold)}
.pba .dl-row.next .dl-dot{background:var(--ink-soft)}
.pba .dl-main{flex:1;min-width:0}
.pba .dl-name{font-family:var(--serif);font-style:italic;font-weight:600;font-size:15px;line-height:1.1;color:var(--ink)}
.pba .dl-sub{font-family:var(--mono);font-size:8px;letter-spacing:.02em;color:var(--ink-soft);margin-top:2px}
.pba .dl-when{flex:none;text-align:right;font-family:var(--mono);font-size:8px;line-height:1.3;letter-spacing:.05em;text-transform:uppercase}
.pba .dl-when.over{color:#b23b34;font-weight:500}
.pba .dl-when.soon{color:var(--gold-deep)}
.pba .dl-when.start{color:var(--gold-deep)}
.pba .dl-when.next{color:var(--ink-soft)}
.pba .dl-empty{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--ink-soft);padding:6px 2px}
.pba .intro-cta{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.pba .intro-cta .chev{font-size:18px;line-height:1;animation:pba-bob 1.5s var(--ease) infinite}
/* Slide-up "to start" entrance — the cover's content rises in on arrival,
   staggered. (Targets the children, not .intro itself, so it never fights
   the scroll-linked shrink/fade on .intro.) */
@keyframes pba-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.pba .intro-eyebrow{animation:pba-rise .5s var(--ease) both}
.pba .intro-h{animation:pba-rise .55s var(--ease) .07s both}
.pba .intro-grid{animation:pba-rise .6s var(--ease) .14s both}
.pba .intro-cta{animation:pba-rise .6s var(--ease) .24s both}
@keyframes pba-bob{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-6px);opacity:1}}
/* Cover — empty state (no picks yet): an intro + a 3-step "how it works" that
   gives direction instead of zeroed-out stats (owner 2026-06-01). Lives inside
   .intro-grid so it inherits the slide-up entrance. */
.pba .intro-lead{font-family:var(--sans);font-size:14px;line-height:1.55;color:var(--ink-soft)}
.pba .intro-steps{display:flex;flex-direction:column;gap:12px;margin-top:4px}
.pba .istep{display:flex;align-items:center;gap:12px}
.pba .istep-n{flex:0 0 auto;width:27px;height:27px;border-radius:999px;background:rgba(92,37,66,.08);color:var(--mulberry);font-family:var(--serif);font-style:italic;font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:center}
.pba .istep-h{font-family:var(--sans);font-weight:700;font-size:13.5px;color:var(--ink);line-height:1.15}
.pba .istep-d{font-family:var(--mono);font-size:9px;letter-spacing:.04em;color:var(--ink-soft);margin-top:1px}
/* Cover — populated state: a budget progress bar (owner 2026-06-01). Tracks
   Range-high vs target, same tone as the top-bar meter. */
.pba .intro-meter{display:flex;flex-direction:column;gap:7px}
.pba .intro-meter .pm-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.pba .intro-meter .pm-k{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.pba .intro-meter .pm-v{font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft)}
.pba .intro-meter .pm-v.ok{color:#2e7d4f}
.pba .intro-meter .pm-v.near{color:var(--gold-deep)}
.pba .intro-meter .pm-v.over{color:#b23b34}
.pba .intro-meter .pm-track{height:7px;border-radius:999px;background:rgba(30,34,41,.07);overflow:hidden}
.pba .intro-meter .pm-fill{height:100%;border-radius:999px;background:var(--gold);transition:width .6s var(--ease)}
.pba .intro-meter .pm-fill.ok{background:#7fd49a}
.pba .intro-meter .pm-fill.near{background:var(--gold)}
.pba .intro-meter .pm-fill.over{background:#ef9a9a}

/* ---- Category sticky stacking head + body ---- */
.pba .cat{border-top:1px solid var(--line)}
/* Stack-and-stay folder pile: every folder head + body is a flat sibling in
   one shared .cats scroll container (see the render), so each head pins at
   top = topbar-h + idx*head-h and STAYS — heads stack under the budget bar
   as you scroll (Venue→…→Transport) rather than replacing one another.
   scroll-margin-top clears the bar + the heads piled above this one so a
   folder anchor (#folder-*) jump lands the head just below them, never hidden. */
.pba .cat-head{position:sticky;top:calc(var(--topbar-h) + var(--idx,0) * var(--head-h));z-index:25;width:100%;height:var(--head-h);background:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px;border:0;border-bottom:1px solid var(--line);text-align:left;transition:background .4s var(--ease),box-shadow .45s var(--ease);scroll-margin-top:calc(var(--pba-header-offset) + var(--topbar-h) + var(--idx,0) * var(--head-h) + 2px)}
/* Group anchor jumps (#group-* from "What to lock next") land the child rail
   just below the budget bar + the folder heads piled above it. --folder-idx is
   set inline on each group wrapper (ChildRail) = its folder's index, so the
   offset is exact per folder (heads 0..idx are all pinned at that scroll). */
.pba [id^="group-"]{scroll-margin-top:calc(var(--pba-header-offset) + var(--topbar-h) + (var(--folder-idx,0) + 1) * var(--head-h) + 8px)}
.pba .cat-head .nm{font-family:var(--serif);font-style:italic;font-size:18px;font-weight:600;color:var(--ink);letter-spacing:.01em}
.pba .cat-head .amt{font-family:var(--serif);font-style:italic;font-size:13.5px;font-weight:600;color:var(--ink)}
.pba .cat-head .amt.zero{font-family:var(--mono);font-style:normal;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep)}
.pba .cat-head .chev{flex:0 0 auto;color:var(--ink-soft);transition:transform .3s var(--ease)}
.pba .cat-head.active{background:var(--card);box-shadow:0 6px 14px -10px rgba(0,0,0,.4)}
.pba .cat-head.active .nm{color:var(--mulberry)}
.pba .cat-head.active .chev{transform:rotate(180deg);color:var(--mulberry)}
.pba .cat-body{padding:14px 0 22px;background:var(--paper)}
.pba .cat-empty{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--ink-soft);padding:6px 20px 4px}

/* ---- Child row header ---- */
.pba .child-name{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:4px 20px 8px}
.pba .child-name .cn{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}

/* deadline chip */
.pba .chip{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 8px;font-family:var(--mono);font-size:8px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.pba .chip.locked{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.pba .chip.over{color:#b23b34;background:rgba(178,59,52,.1)}
.pba .chip.soon{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.pba .chip.start{color:var(--gold-deep);background:rgba(197,160,89,.1);box-shadow:inset 0 0 0 1px rgba(197,160,89,.4)}
.pba .chip.next{color:var(--ink-soft);background:rgba(30,34,41,.06)}

/* ---- Carousel rail + 300px cards ---- */
.pba .rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 20px 6px;scrollbar-width:none}
.pba .rail::-webkit-scrollbar{display:none}
.pba .card{position:relative;flex:0 0 300px;scroll-snap-align:center;display:flex;flex-direction:column}
.pba .v{position:relative;display:flex;flex-direction:column;flex:1 1 auto;min-height:300px;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;text-decoration:none;color:inherit;transition:border-color .35s var(--ease),box-shadow .35s var(--ease)}
.pba .v:hover{box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}
.pba .v .img{height:128px;flex:0 0 128px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center}
.pba .v .img img{width:100%;height:100%;object-fit:cover}
.pba .v .img .ini{font-family:var(--serif);font-style:italic;font-size:30px;color:rgba(255,255,255,.7)}
.pba .v .meta{padding:13px 15px 15px;flex:1 1 auto;display:flex;flex-direction:column}
.pba .v .vn{font-family:var(--sans);font-weight:700;font-size:15px;color:var(--ink)}
.pba .v .dist{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;color:var(--ink-soft);margin-top:2px}
.pba .v .stars{color:var(--gold);font-size:15px;letter-spacing:2px;margin-top:9px}
.pba .v .stars .rcount{font-family:var(--mono);font-size:8px;letter-spacing:.03em;color:var(--ink-soft);margin-left:6px;vertical-align:1px}
.pba .v .badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.pba .bdg{font-family:var(--mono);font-size:7.5px;letter-spacing:.07em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:rgba(30,34,41,.06);color:var(--ink-soft);white-space:nowrap}
.pba .bdg.verified{color:#2e7d4f;background:rgba(46,125,79,.1)}
.pba .bdg.setnayan{color:var(--mulberry);background:rgba(92,37,66,.1)}
.pba .bdg.rec{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.pba .v .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:21px;color:var(--ink);margin-top:auto;padding-top:7px}
.pba .v .linked{margin-top:auto;padding-top:9px;font-family:var(--mono);font-size:10px;letter-spacing:.03em;color:var(--mulberry);font-weight:500;line-height:1.4}
/* "👀 N also eyeing your date" — an interest/in-demand cue, NOT an error. Gentle
   gold (not the overdue/danger red it used to share) so it reads as gentle
   social proof, never alarming. Aggregate-only + never fabricated (model §6a). */
.pba .v .eyeing{margin-top:9px;font-family:var(--mono);font-size:9px;letter-spacing:.02em;color:var(--gold-deep);background:rgba(197,160,89,.12);border-radius:6px;padding:3px 7px;display:inline-block}
/* chosen state — gold border + glow + corner badge */
.pba .card.chosen .v{border:3px solid var(--gold);box-shadow:0 0 0 3px rgba(197,160,89,.32)}
.pba .pcorner{position:absolute;top:10px;right:10px;z-index:3;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--mulberry);border-radius:999px;padding:5px 9px;box-shadow:0 2px 10px rgba(0,0,0,.28)}
/* remove × (top-left), hidden once chosen */
.pba .vx{position:absolute;top:10px;left:10px;z-index:4;min-width:26px;height:26px;padding:0 8px;border:0;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(30,34,41,.5);color:#fff;font-family:var(--sans);font-size:16px;line-height:1;cursor:pointer;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);transition:background .2s var(--ease)}
.pba .vx.armed{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;background:var(--mulberry)}
.pba .vx-keep{position:absolute;top:10px;left:62px;z-index:4;height:26px;padding:0 10px;border:0;border-radius:999px;background:rgba(30,34,41,.5);color:#fff;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
/* lock CTA */
.pba .lockbar{margin-top:10px;padding:0 1px}
.pba .lockbtn{width:100%;border:0;border-radius:11px;background:var(--mulberry);color:#fff;font-family:var(--sans);font-weight:700;font-size:12.5px;padding:11px;cursor:pointer;transition:background .2s var(--ease)}
.pba .lockbtn:active{background:var(--mulberry-deep)}
.pba .lockbtn:disabled{opacity:.6;cursor:default}
.pba .changebtn{width:100%;border:1px solid color-mix(in srgb,var(--mulberry) 45%,transparent);border-radius:11px;background:transparent;color:var(--mulberry);font-family:var(--sans);font-weight:600;font-size:11.5px;padding:9px;cursor:pointer;transition:background .2s var(--ease)}
.pba .changebtn:active{background:color-mix(in srgb,var(--mulberry) 9%,transparent)}
.pba .changebtn:disabled{opacity:.6;cursor:default}
/* dashed find-more card */
.pba .add{flex:0 0 132px;scroll-snap-align:center;display:flex;text-decoration:none}
.pba .add .inner{flex:1;min-height:191px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;background:rgba(92,37,66,.05);border:1.5px dashed rgba(92,37,66,.4);border-radius:18px;color:var(--mulberry)}
.pba .add .plus{font-size:26px;line-height:1;font-weight:300}
.pba .add .at{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;line-height:1.4}
/* empty child — slim one-line row */
.pba .empty-child{display:flex;align-items:center;gap:10px;margin:0 20px 8px;padding:11px 14px;border:1.5px dashed rgba(92,37,66,.3);border-radius:12px;background:rgba(92,37,66,.03);text-decoration:none;color:inherit}
.pba .empty-child .ep{font-size:17px;color:var(--mulberry);font-weight:300;line-height:1}
.pba .empty-child .en{font-family:var(--sans);font-size:13.5px;font-weight:600;color:var(--mulberry)}
.pba .empty-child .eh{margin-left:auto;font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:#b8b4ac}
/* .add + .empty-child are <button>s (open the in-place Category Search
   overlay) — neutralize UA button chrome so they render exactly as the
   former anchors did. */
.pba .add,.pba .empty-child{appearance:none;-webkit-appearance:none;font:inherit;cursor:pointer;text-align:left;width:auto}
.pba .add{border:0;background:none;padding:0}
/* Empty-category "Find …" rows stretch full width (minus the 20px side
   margins) instead of shrink-wrapping their label (owner 2026-05-31). */
.pba .empty-child{width:calc(100% - 40px)}

/* ---- Compare (like-for-like; read-only — never sets the pick) ---- */
.pba .cn-right{display:flex;align-items:center;gap:8px}
.pba .cmpbtn{display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(92,37,66,.4);background:rgba(92,37,66,.06);color:var(--mulberry);border-radius:999px;padding:4px 10px;font-family:var(--mono);font-size:8px;letter-spacing:.08em;text-transform:uppercase;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .2s var(--ease)}
.pba .cmpbtn:active{background:rgba(92,37,66,.14)}
.pba .cmpsheet{position:fixed;inset:0;z-index:90;background:var(--paper);display:flex;flex-direction:column;animation:cmpup .3s var(--ease)}
@keyframes cmpup{from{transform:translateY(100%)}to{transform:none}}
.pba .cmpwrap{width:100%;max-width:620px;margin:0 auto;flex:1;display:flex;flex-direction:column;min-height:0}
.pba .cmphead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:calc(18px + env(safe-area-inset-top)) 20px 12px;border-bottom:1px solid var(--line)}
.pba .cmptitle{display:flex;flex-direction:column;gap:3px;min-width:0}
.pba .cmpcat{font-family:var(--serif);font-style:italic;font-size:22px;color:var(--ink);line-height:1}
.pba .cmpsub{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft)}
.pba .cmpclose{border:none;background:rgba(30,34,41,.06);color:var(--ink);width:32px;height:32px;border-radius:999px;font-size:15px;cursor:pointer;flex:0 0 auto}
.pba .cmpbody{flex:1;overflow:auto}
.pba .cmptable{width:100%;border-collapse:collapse;font-family:var(--sans)}
.pba .cmptable tr{border-bottom:1px solid var(--line-soft)}
.pba .cmptable th{text-align:left;vertical-align:top;font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);font-weight:500;padding:12px 8px 12px 20px;width:84px;white-space:nowrap}
.pba .cmptable td{vertical-align:top;padding:12px 14px 12px 8px;font-size:13px;color:var(--ink);line-height:1.35}
.pba .cmptable td+td{border-left:1px solid var(--line-soft)}
.pba .cmprow-name td{font-weight:700;font-size:13.5px}
.pba .cmprow-price td{font-family:var(--serif);font-style:italic;font-size:16px;color:var(--mulberry)}
.pba .cmpwin{color:var(--gold-deep);font-family:var(--mono);font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;display:block;margin-top:3px}
.pba .cmpfoot{padding:12px 20px calc(16px + env(safe-area-inset-bottom)) 20px;font-size:11px;line-height:1.45;color:var(--ink-soft);border-top:1px solid var(--line);background:rgba(197,160,89,.06)}

/* ---- Press feedback (owner 2026-05-31: taps must feel responsive). The
   tap-highlight is killed globally, so the link-cards (.v/.add/.empty-child,
   which are <a> and miss the global button rule) + the in-card buttons get a
   quick scale-down on :active. .card itself carries the coverflow transform, so
   we scale the inner .v — never the .card — to avoid fighting it. ---- */
.pba .v,.pba .add,.pba .empty-child{transition:transform .13s cubic-bezier(.2,.7,.2,1),border-color .35s var(--ease),box-shadow .35s var(--ease)}
.pba .lockbtn,.pba .changebtn,.pba .cmpbtn,.pba .cmpclose,.pba .vx{transition:transform .13s cubic-bezier(.2,.7,.2,1),background .2s var(--ease)}
.pba .v:active,.pba .add:active,.pba .empty-child:active{transform:scale(.98)}
.pba .lockbtn:active,.pba .changebtn:active,.pba .cmpbtn:active,.pba .cmpclose:active,.pba .vx:active{transform:scale(.93)}
/* Keyboard focus ring (a11y) — the global tap-highlight is killed, so define a
   visible :focus-visible outline for every interactive element (cards, lock,
   compare, remove, find, due-rows). Gold accent at 2px offset; the outline
   auto-rounds to each element's border-radius. */
.pba a:focus-visible,.pba button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}

/* ---- Recap ---- */
/* Bottom padding = nav height so the recap's bottom sits just above the fixed
   mobile nav — recap is the terminal element, no dead scroll (owner 2026-05-31). */
.pba .end-spacer{padding:30px 18px var(--botnav-h)}
/* Unlock-more-categories affordance — under the recap (has picks) and in the
   empty-state cover (no picks). Owner 2026-06-02: keep the Vendors page to the
   categories the couple is shopping; this is the door to add the rest. */
.pba .catunlock{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:16px;padding:15px 18px;border-radius:16px;border:1.5px solid var(--gold);background:transparent;color:var(--ink);font-family:var(--sans);font-size:14px;font-weight:600;text-decoration:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}
.pba .catunlock:hover{background:rgba(197,160,89,0.12);border-color:var(--gold-deep)}
.pba .catunlock .cu-ico{font-size:17px;line-height:1;color:var(--gold-deep)}
.pba .endcard{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;background:var(--mulberry);color:#fff;border-radius:22px;padding:24px 22px 22px}
.pba .end-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.pba .end-h{font-family:var(--serif);font-style:italic;font-weight:600;font-size:26px;line-height:1.05;color:#fff;margin:2px 0}
.pba .end-line{font-family:var(--sans);font-size:11.5px;line-height:1.5;color:rgba(255,255,255,.8);max-width:280px}
.pba .end-stats{display:flex;width:100%;margin-top:10px;padding-top:14px;border-top:1px solid rgba(255,255,255,.2)}
.pba .end-stats>div{flex:1;border-left:1px solid rgba(255,255,255,.14)}
.pba .end-stats>div:first-child{border-left:0}
.pba .esv{font-family:var(--serif);font-style:italic;font-weight:600;font-size:24px;line-height:1;color:#fff}
.pba .esk{font-family:var(--mono);font-size:7.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:5px}
/* Randomized feel-good line — different on every open (owner 2026-06-01). */
.pba .end-motivate{font-family:var(--serif);font-style:italic;font-size:17px;line-height:1.35;color:#fff;margin-top:16px;max-width:300px}

/* ---- Scroll-driven motion (transforms set per-frame from JS; CSS only
   smooths + declares will-change + the reduced-motion reset). All targets
   are always-rendered + always visible — these effects are cosmetic, so a
   miscalc degrades to "looks flat", never "content hidden"). ---- */
.pba .intro{transform-origin:top center;will-change:transform,opacity;transition:transform .15s var(--ease),opacity .15s var(--ease)}
.pba .child-block{transform-origin:top center;will-change:transform,opacity;transition:transform .12s linear,opacity .12s linear}
.pba .card{will-change:transform,opacity;transition:transform .08s linear,opacity .08s linear}
.pba .rail{perspective:1200px}
@media (prefers-reduced-motion:reduce){
  .pba .intro,.pba .child-block,.pba .card{transform:none!important;opacity:1!important;transition:none!important}
  .pba .intro-eyebrow,.pba .intro-h,.pba .intro-grid,.pba .intro-cta{animation:none!important;opacity:1!important;transform:none!important}
}

/* ───────── Dark mode (owner 2026-06-01: the black budget bar — and the whole
   sheet — flip to a light surface when the theme is dark). Light mode is
   untouched: every rule here only ADDS under html.dark. The bar is
   background:var(--ink)/color:var(--paper), so re-aliasing the local tokens
   flips it (and the sheet) automatically; the rest are the hardcoded
   light/white values that don't ride a token. ───────── */
html.dark .pba{
  --paper:#1E2229; --ink:#FBFBFA; --ink-soft:#B6B9BE;
  --line:rgba(251,251,250,.16); --line-soft:rgba(251,251,250,.1);
  --card:#2A2E36; --gold:#E0CCA0; --gold-deep:#C5A059;
}
/* bar is now a light surface → flip its muted white text + hairline + accents */
html.dark .pba .topbar{border-bottom-color:rgba(30,34,41,.1)}
html.dark .pba .topbar .figk{color:rgba(30,34,41,.5)}
html.dark .pba .topbar .rangev{color:rgba(30,34,41,.6)}
html.dark .pba .topbar .status{color:rgba(30,34,41,.5)}
html.dark .pba .topbar .status.ok{color:#2e7d4f}
html.dark .pba .topbar .status.near{color:#8C6932}
html.dark .pba .topbar .status.over{color:#b23b34}
/* dark-tinted tracks/buttons that vanish on a dark sheet → light-tinted */
html.dark .pba .meter{background:rgba(251,251,250,.12)}
html.dark .pba .intro-meter .pm-track{background:rgba(251,251,250,.1)}
html.dark .pba .chip.next{background:rgba(251,251,250,.08)}
html.dark .pba .chip.start{background:rgba(197,160,89,.14)}
html.dark .pba .cmpclose{background:rgba(251,251,250,.1)}
html.dark .pba .cat-head.active{box-shadow:0 6px 16px -10px rgba(0,0,0,.7)}
/* --mulberry stays dark as a FILL (recap card + CTAs keep white text); but
   mulberry-as-TEXT needs to lighten so it reads on the dark sheet/cards */
html.dark .pba .cat-head.active .nm,
html.dark .pba .empty-child .en,
html.dark .pba .istep-n,
html.dark .pba .cmpbtn,
html.dark .pba .cmprow-price td{color:#C99DB0}
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

  // Scroll-driven motion (prototype Plan_Budget_Accordion_2026-05-31.html):
  //   · sizeIntro   — the "Where your day stands" overview scales + fades as it
  //                   scrolls up under the sticky topbar.
  //   · syncStates  — each .child-block curve-zooms (scale + fade by distance
  //                   from a focus line) so child categories visually merge into
  //                   their sticky parent header as you scroll past them.
  //   · curveRail   — per horizontal rail, cards get a coverflow rotateY/scale/
  //                   opacity by offset from rail-center + a haptic buzz when the
  //                   centered card changes.
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
          card.style.transform = `perspective(1200px) rotateY(${(n * -16).toFixed(2)}deg) scale(${(1 - Math.abs(n) * 0.12).toFixed(4)})`;
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
    <div className="pba" ref={rootRef}>
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
          {model.folders.map((folder, index) => (
            <FolderSection
              key={folder.folder}
              folder={folder}
              eventId={eventId}
              index={index}
              onCompare={setCompare}
              onOpenSearch={openSearch}
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
      </div>
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
  // of .pba so the sticky bar's containing block is .pba (tall, spans the
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
          Swipe to start viewing the services
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

        <WhatToLockNext model={model} eventId={eventId} />
      </div>

      <p className="intro-cta">
        Swipe to start viewing the services
        <span className="chev" aria-hidden>
          ↓
        </span>
      </p>
    </section>
  );
}

function WhatToLockNext({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  const hasDue = model.dueList.length > 0;
  const calmUpNext = !hasDue && model.upNext ? model.upNext : null;

  if (!hasDue && !calmUpNext) {
    return (
      <div className="ibox dl">
        <div className="dl-tag">What to lock next</div>
        <p className="dl-empty">
          Nothing&rsquo;s urgent right now — you&rsquo;re ahead of the clock.
        </p>
      </div>
    );
  }

  return (
    <div className="ibox dl">
      <div className="dl-tag">{hasDue ? 'What to lock next' : 'Next up'}</div>
      {hasDue
        ? model.dueList.map((d) => (
            <DueRow key={d.groupId} item={d} eventId={eventId} />
          ))
        : calmUpNext && (
            <DueRow item={calmUpNext} eventId={eventId} calm />
          )}
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
}: {
  folder: AccordionFolder;
  eventId: string;
  index: number;
  onCompare: (child: AccordionChild) => void;
  onOpenSearch: (groupId: string, label: string) => void;
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
          <p className="cat-empty">Nothing here yet for your wedding.</p>
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
              />
            </div>
          ))
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
}) {
  const empty = child.picks.length === 0;
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
          <DeadlineChip status={child.timelineStatus} daysLeft={child.daysLeft} />
        </span>
      </div>

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
          {child.picks.map((pick) => (
            <VendorCardAtom
              key={pick.vendor_id}
              pick={pick}
              eventId={eventId}
              groupId={child.groupId}
              groupLabel={child.label}
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
}: {
  pick: AccordionPick;
  eventId: string;
  groupId: PlanGroupId;
  groupLabel: string;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const locked = isLocked(pick);
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

  return (
    <div className={`card${locked ? ' chosen' : ''}`}>
      <Link
        href={`/dashboard/${eventId}/vendors/${pick.vendor_id}/workspace`}
        className="v"
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

          {(verified || setnayan || recommendedReason) && (
            <div className="badges">
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
    return {
      id: pick.vendor_id,
      name,
      priceNum,
      price,
      rating,
      reviewCount,
      dist,
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
