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
 * (tap-to-confirm), Lock → updateVendorStatus(status=contracted). Stars /
 * verified+Setnayan badges / distance render only when the model carries
 * them (vendor_profiles join is a later page-fetch pass) — never fabricated.
 * The long-press finalize gesture + curve-zoom coverflow + compare drawer
 * are the §4 interaction-polish pass; the Lock button is the accessible
 * Stage-now equivalent.
 *
 * The page returns this component directly; the dashboard layout provides the
 * tab chrome + outer <main>. The sticky budget bar pins at top-0 of the
 * scroll container (the shared mobile app header sits above it; the bar
 * offsets below it on mobile via --pba-header-offset).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { formatPhp } from '@/lib/vendors';
import { deleteVendor, updateVendorStatus } from '../actions';
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
  --topbar-h:62px; --head-h:34px;
  /* The dashboard chrome bar (EventSwitcher + utilities) is rendered by
     SidebarShell as `sticky top-0 z-20` on BOTH mobile and desktop (it is
     NOT lg:hidden). So our sticky budget bar (z-30) must offset BELOW it on
     every breakpoint, else it pins on top of the chrome at top:0. ~56px is
     the chrome row height (py-3 + ~32px content); set as a JS-measured var
     at runtime (see useEffect) with this as the SSR/no-JS fallback. */
  --pba-header-offset:56px;
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --spring:cubic-bezier(.34,1.3,.5,1); --ease:cubic-bezier(.22,.61,.36,1);
  position:relative; background:var(--paper); color:var(--ink); font-family:var(--sans);
}
.pba *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

/* ---- Dark top budget bar ---- */
.pba .topbar{position:sticky;top:var(--pba-header-offset);z-index:30;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--topbar-h);padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08)}
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
.pba .meter{position:relative;height:3px;background:rgba(30,34,41,.1)}
.pba .meter .fill{height:100%;width:0;background:var(--gold);transition:width .55s var(--ease),background .4s var(--ease)}
.pba .meter .fill.ok{background:#7fd49a}
.pba .meter .fill.near{background:var(--gold)}
.pba .meter .fill.over{background:#ef9a9a}

/* ---- Scroll body wrap ---- */
.pba .body{max-width:760px;margin:0 auto;padding:0 0 120px}

/* ---- Landing overview ---- */
.pba .intro{display:flex;flex-direction:column;justify-content:center;gap:14px;padding:26px 22px 30px;background:var(--paper);min-height:calc(100svh - var(--pba-header-offset) - var(--topbar-h))}
.pba .intro-eyebrow{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep)}
.pba .intro-h{font-family:var(--serif);font-style:italic;font-size:29px;line-height:1.05;color:var(--ink);margin:2px 0 4px}
.pba .intro-grid{display:flex;flex-direction:column;gap:10px}
.pba .irow3{display:flex;gap:10px}
.pba .irow3 .ibox{flex:1;min-width:0}
.pba .ibox{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px 15px}
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
.pba .dl-row.next .dl-dot{background:var(--ink-soft)}
.pba .dl-main{flex:1;min-width:0}
.pba .dl-name{font-family:var(--serif);font-style:italic;font-weight:600;font-size:15px;line-height:1.1;color:var(--ink)}
.pba .dl-sub{font-family:var(--mono);font-size:8px;letter-spacing:.02em;color:var(--ink-soft);margin-top:2px}
.pba .dl-when{flex:none;text-align:right;font-family:var(--mono);font-size:8px;line-height:1.3;letter-spacing:.05em;text-transform:uppercase}
.pba .dl-when.over{color:#b23b34;font-weight:500}
.pba .dl-when.soon{color:var(--gold-deep)}
.pba .dl-when.next{color:var(--ink-soft)}
.pba .dl-empty{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--ink-soft);padding:6px 2px}
.pba .intro-cta{margin-top:4px;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft)}
.pba .intro-cta .chev{font-size:18px;line-height:1;animation:pba-bob 1.5s var(--ease) infinite}
@keyframes pba-bob{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-6px);opacity:1}}

/* ---- Category sticky stacking head + body ---- */
.pba .cat{border-top:1px solid var(--line)}
.pba .cat-head{position:sticky;top:calc(var(--pba-header-offset) + var(--topbar-h));z-index:5;width:100%;min-height:var(--head-h);background:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 18px;border:0;border-bottom:1px solid var(--line);cursor:pointer;text-align:left;transition:background .4s var(--ease),box-shadow .45s var(--ease)}
.pba .cat-head .nm{font-family:var(--serif);font-style:italic;font-size:18px;font-weight:600;color:var(--ink);letter-spacing:.01em}
.pba .cat-head .amt{font-family:var(--serif);font-style:italic;font-size:13.5px;font-weight:600;color:var(--ink)}
.pba .cat-head .amt.zero{font-family:var(--mono);font-style:normal;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep)}
.pba .cat-head .chev{flex:0 0 auto;color:var(--ink-soft);transition:transform .3s var(--ease)}
.pba .cat-head.active{background:#fff;box-shadow:0 6px 14px -10px rgba(0,0,0,.4)}
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
.pba .chip.next{color:var(--ink-soft);background:rgba(30,34,41,.06)}

/* ---- Carousel rail + 300px cards ---- */
.pba .rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 20px 6px;scrollbar-width:none}
.pba .rail::-webkit-scrollbar{display:none}
.pba .card{position:relative;flex:0 0 300px;scroll-snap-align:center}
.pba .v{position:relative;display:block;background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;text-decoration:none;color:inherit;transition:border-color .35s var(--ease),box-shadow .35s var(--ease)}
.pba .v:hover{box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}
.pba .v .img{height:128px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center}
.pba .v .img img{width:100%;height:100%;object-fit:cover}
.pba .v .img .ini{font-family:var(--serif);font-style:italic;font-size:30px;color:rgba(255,255,255,.7)}
.pba .v .meta{padding:13px 15px 15px}
.pba .v .vn{font-family:var(--sans);font-weight:700;font-size:15px;color:var(--ink)}
.pba .v .dist{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;color:var(--ink-soft);margin-top:2px}
.pba .v .stars{color:var(--gold);font-size:15px;letter-spacing:2px;margin-top:9px}
.pba .v .stars .rcount{font-family:var(--mono);font-size:8px;letter-spacing:.03em;color:var(--ink-soft);margin-left:6px;vertical-align:1px}
.pba .v .badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.pba .bdg{font-family:var(--mono);font-size:7.5px;letter-spacing:.07em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:rgba(30,34,41,.06);color:var(--ink-soft);white-space:nowrap}
.pba .bdg.verified{color:#2e7d4f;background:rgba(46,125,79,.1)}
.pba .bdg.setnayan{color:var(--mulberry);background:rgba(92,37,66,.1)}
.pba .bdg.rec{color:var(--gold-deep);background:rgba(197,160,89,.16)}
.pba .v .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:21px;color:var(--ink);margin-top:7px}
.pba .v .linked{margin-top:9px;font-family:var(--mono);font-size:10px;letter-spacing:.03em;color:var(--mulberry);font-weight:500;line-height:1.4}
.pba .v .eyeing{margin-top:9px;font-family:var(--mono);font-size:9px;letter-spacing:.02em;color:#b23b34;background:rgba(178,59,52,.08);border-radius:6px;padding:3px 7px;display:inline-block}
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

/* ---- Recap ---- */
.pba .end-spacer{padding:30px 18px 0}
.pba .endcard{display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;background:var(--mulberry);color:#fff;border-radius:22px;padding:24px 22px 22px}
.pba .end-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.pba .end-h{font-family:var(--serif);font-style:italic;font-weight:600;font-size:26px;line-height:1.05;color:#fff;margin:2px 0}
.pba .end-line{font-family:var(--sans);font-size:11.5px;line-height:1.5;color:rgba(255,255,255,.8);max-width:280px}
.pba .end-stats{display:flex;width:100%;margin-top:10px;padding-top:14px;border-top:1px solid rgba(255,255,255,.2)}
.pba .end-stats>div{flex:1;border-left:1px solid rgba(255,255,255,.14)}
.pba .end-stats>div:first-child{border-left:0}
.pba .esv{font-family:var(--serif);font-style:italic;font-weight:600;font-size:24px;line-height:1;color:#fff}
.pba .esk{font-family:var(--mono);font-size:7.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:5px}

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
  const hasAnyPick = model.recap.shortlisted > 0;
  const rootRef = useRef<HTMLDivElement>(null);

  // Measure the real dashboard chrome height so the budget bar + category
  // heads stack BELOW it instead of guessing a fixed px. The dashboard's
  // EventSwitcher bar is rendered by SidebarShell as `sticky top-0` on every
  // breakpoint; with this route full-bleed, at scroll-top the accordion's own
  // top edge sits exactly at the chrome's bottom — so `rect.top` (captured
  // while scrolled to the top) IS the chrome height. We write it to
  // --pba-header-offset. Runs independent of the motion effect below so the
  // sticky stack is correct even under prefers-reduced-motion. The 56px CSS
  // fallback covers SSR / pre-measure / mid-scroll mount. Re-measures on resize
  // (breakpoint flips chrome height). Self-correcting → no per-breakpoint @media.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return;
    const measure = () => {
      if (window.scrollY > 4) return; // only trustworthy at the top
      const top = Math.max(0, Math.round(root.getBoundingClientRect().top));
      if (top > 0) root.style.setProperty('--pba-header-offset', `${top}px`);
    };
    // rAF so the measure runs after the chrome bar has laid out.
    const id = window.requestAnimationFrame(measure);
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener('resize', measure);
    };
  }, []);

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

    const frame = () => {
      raf = 0;
      const vh = window.innerHeight || 1;

      // sizeIntro
      const intro = root.querySelector<HTMLElement>('.intro');
      if (intro) {
        const r = intro.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / (r.height || 1)));
        intro.style.transform = `scale(${(1 - p * 0.06).toFixed(4)})`;
        intro.style.opacity = (1 - p * 0.55).toFixed(3);
      }

      // syncStates — child-block curve-merge into the sticky parent header
      const focus = vh * 0.38;
      root.querySelectorAll<HTMLElement>('.child-block').forEach((el) => {
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const norm = Math.min(1, Math.abs(center - focus) / vh);
        el.style.transform = `scale(${(1 - norm * 0.12).toFixed(4)})`;
        el.style.opacity = (1 - norm * 0.45).toFixed(3);
      });

      // curveRail — coverflow + snap buzz (re-query each frame so newly
      // mounted rails are covered without re-binding listeners)
      root.querySelectorAll<HTMLElement>('.rail').forEach((rail) => {
        const rr = rail.getBoundingClientRect();
        const railCenter = rr.left + rr.width / 2;
        const half = rr.width / 2 || 1;
        const cards = rail.querySelectorAll<HTMLElement>('.card, .add');
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
          if (prev !== -1 && 'vibrate' in navigator) {
            try {
              navigator.vibrate(7);
            } catch {
              /* vibration unsupported / blocked — ignore */
            }
          }
        }
      });
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
      <TopBar model={model} />
      <div className="body">
        <Overview model={model} eventId={eventId} />

        <div>
          {model.folders.map((folder) => (
            <FolderSection
              key={folder.folder}
              folder={folder}
              eventId={eventId}
            />
          ))}
        </div>

        {hasAnyPick && (
          <div className="end-spacer">
            <Recap recap={model.recap} />
          </div>
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

  return (
    <div>
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
    </div>
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

        <WhatToLockNext model={model} eventId={eventId} />
      </div>

      <p className="intro-cta">
        Your categories below
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
  const overdue = !calm && item.daysLeft < 0;
  const soon = !calm && item.daysLeft >= 0 && item.daysLeft <= 20;
  const rowTone = overdue ? 'over' : soon ? 'soon' : 'next';
  const when = calm
    ? 'Coming up'
    : overdue
      ? `${Math.abs(item.daysLeft)}d overdue`
      : soon
        ? `${item.daysLeft}d left`
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
}: {
  folder: AccordionFolder;
  eventId: string;
}) {
  const hasLocked = folder.lockedTotal > 0;
  // Folders render always-open (the prototype model) so the scroll engine can
  // curve-merge each .child-block into this sticky parent header as the couple
  // scrolls past it. The .cat-head is a non-interactive sticky label, not a
  // collapse toggle.
  return (
    <section id={`folder-${folder.folder}`} className="cat">
      <div className="cat-head">
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
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

// ── Surface 4 · Child rail ────────────────────────────────────────────────
function ChildRail({
  child,
  eventId,
  folderSlug,
}: {
  child: AccordionChild;
  eventId: string;
  folderSlug: string;
}) {
  const empty = child.picks.length === 0;
  return (
    <div id={`group-${child.groupId}`}>
      <div className="child-name">
        <span className="cn">{child.label}</span>
        <DeadlineChip daysLeft={child.daysLeft} state={child.state} />
      </div>

      {empty ? (
        <Link
          href={`/vendors?folder=${folderSlug}&from=plan&group=${child.groupId}`}
          className="empty-child"
        >
          <span className="ep">＋</span>
          <span className="en">Find {child.label.toLowerCase()}</span>
          <span className="eh">Browse</span>
        </Link>
      ) : (
        <div className="rail">
          {child.picks.map((pick) => (
            <VendorCardAtom key={pick.vendor_id} pick={pick} eventId={eventId} />
          ))}
          <AddCard folderSlug={folderSlug} groupId={child.groupId} />
        </div>
      )}
    </div>
  );
}

function DeadlineChip({
  daysLeft,
  state,
}: {
  daysLeft: number | null;
  state: AccordionChild['state'];
}) {
  if (state === 'finalized') {
    return <span className="chip locked">✓ Locked</span>;
  }
  if (daysLeft === null) return null;
  const overdue = daysLeft < 0;
  const soon = daysLeft >= 0 && daysLeft <= 20;
  const tone = overdue ? 'over' : soon ? 'soon' : 'next';
  const label = overdue
    ? `${Math.abs(daysLeft)}d overdue`
    : soon
      ? `${daysLeft}d left`
      : `${daysLeft}d`;
  return <span className={`chip ${tone}`}>{label}</span>;
}

// ── The §4 vendor card atom (300px prototype card) ────────────────────────
function VendorCardAtom({
  pick,
  eventId,
}: {
  pick: AccordionPick;
  eventId: string;
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
  const city = pick.marketplace_city ?? null;
  const verified = pick.is_verified === true;
  const setnayan = pick.is_setnayan_service === true;
  const recommendedReason =
    typeof pick.recommended_reason === 'string' && pick.recommended_reason
      ? pick.recommended_reason
      : null;
  const linked = pick.linked_to_name ?? null;

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
          {city && <div className="dist">{city}</div>}

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
              <button type="submit" className="vx armed" aria-label="Confirm remove">
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
            onClick={() => setConfirmRemove(true)}
          >
            ×
          </button>
        ))}

      {/* Lock CTA — accessible Stage-now equivalent of long-press finalize */}
      {!locked && (
        <div className="lockbar">
          <form action={updateVendorStatus}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={pick.vendor_id} />
            <input type="hidden" name="status" value="contracted" />
            <button type="submit" className="lockbtn">
              Lock this pick
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function AddCard({
  folderSlug,
  groupId,
}: {
  folderSlug: string;
  groupId: string;
}) {
  return (
    <Link
      href={`/vendors?folder=${folderSlug}&from=plan&group=${groupId}`}
      className="add"
    >
      <span className="inner">
        <span className="plus">＋</span>
        <span className="at">Find more</span>
      </span>
    </Link>
  );
}

// ── Surface 5 · Recap ─────────────────────────────────────────────────────
function Recap({ recap }: { recap: RecapStats }) {
  return (
    <section className="endcard">
      <p className="end-eyebrow">Look how far you&rsquo;ve come</p>
      <h2 className="end-h">~{recap.hoursSaved} hours saved so far</h2>
      <p className="end-line">
        out of thousands of suppliers in the market — you narrowed it down.
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
          <div className="esk">Finalized</div>
        </div>
      </div>
    </section>
  );
}
