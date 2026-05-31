'use client';

/**
 * PlanBudgetAccordion — the couple-side Vendors tab, FULL VISUAL MATCH to the
 * design prototype Plan_Budget_Accordion_2026-05-31.html (owner directive
 * 2026-05-31: "does not look like this" → port the prototype's exact look).
 *
 * The prototype is a standalone 393px phone frame with its own top-menu +
 * bottom-nav. The real app's dashboard [eventId]/layout.tsx already provides
 * those (EventSwitcher top bar on desktop, CustomerBottomNav on mobile), so
 * this component renders ONLY the prototype's inner surfaces:
 *   1. Dark budget top bar (sticky) — Chosen · Range · target · meter.
 *   2. Intro overview "Here's where you are" (first screen).
 *   3. 10 taxonomy categories as sticky-stacking heads + always-on bodies,
 *      each child = a horizontal rail of vendor cards + an Add card.
 *   4. Bottom recap "Look how far you've come".
 *
 * STYLING: the prototype's CSS is ported verbatim into PBA_CSS below, every
 * selector scoped under `.pba` to avoid leaking into the app's globals. The
 * prototype's :root palette maps onto the app's already-loaded Clean Editorial
 * vars (--m-paper/-ink/-orange/-mulberry) + fonts (--font-display Cormorant /
 * --font-sans Manrope / --font-mono DM Mono). Colors + type match 1:1.
 *
 * DATA: real, from buildPlanBudgetModel (lib/vendors-plan-budget.ts). Cards
 * show the prototype's gradient-placeholder image (the mock has no real photos
 * either), the vendor name, city (when known), price, and the "eyeing" chip
 * (only when count > 0 — aggregate-only, never fabricated). Stars / review
 * counts / verified+Setnayan badges / distance-in-km render ONLY when that
 * data exists; until the vendor_profiles join lands they're simply absent
 * rather than faked.
 *
 * INTERACTIONS wired to the existing server actions:
 *   - tap a card → vendor detail route
 *   - long-press a card → "Lock as your pick?" → updateVendorStatus(contracted)
 *     (mirrors the prototype's long-press-to-set-primary)
 *   - card × (tap to arm, tap to confirm) → deleteVendor
 *   - Add card → marketplace, folder-scoped
 *   - tap the budget bar / Estimate box → /settings (set the estimated budget)
 * The compare screen, in-app search screen, sort sheet, and vendor-detail
 * screen from the prototype are follow-up passes (Stage 4) — the cards link
 * out to the existing routes for now.
 */

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
const isLocked = (p: AccordionPick) =>
  p.raw_status !== null && LOCKED.has(p.raw_status);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ── Ported prototype CSS, scoped under .pba ───────────────────────────────
const PBA_CSS = `
.pba{
  --paper:var(--m-paper,#FBFBFA); --ink:var(--m-ink,#1E2229); --ink-soft:#4F535B;
  --gold:var(--m-orange,#C5A059); --gold-deep:var(--m-orange-2,#8C6932);
  --mulberry:var(--m-mulberry,#5C2542); --mulberry-deep:var(--m-mulberry-2,#4A1D36);
  --line:rgba(30,34,41,.12); --line-soft:rgba(30,34,41,.07);
  --topbar-h:62px; --head-h:38px;
  --serif:var(--font-display),"Cormorant Garamond",Georgia,serif;
  --sans:var(--font-sans),"Manrope",-apple-system,system-ui,sans-serif;
  --mono:var(--font-mono),"DM Mono",ui-monospace,Menlo,monospace;
  --spring:cubic-bezier(.34,1.3,.5,1); --ease:cubic-bezier(.22,.61,.36,1);
  position:relative; background:var(--paper); color:var(--ink); font-family:var(--sans);
}
.pba *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}

/* dark budget top bar */
.pba .topbar{position:sticky;top:0;z-index:30;background:var(--ink);color:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--topbar-h);padding:0 18px;border-bottom:1px solid rgba(255,255,255,.08)}
.pba .bleft{display:flex;flex-direction:column;gap:3px;min-width:0;padding:9px 0}
.pba .fig{display:flex;align-items:baseline;gap:7px;white-space:nowrap;line-height:1.18}
.pba .figk{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);width:46px;flex:0 0 auto}
.pba .figv{font-family:var(--serif);font-style:italic;font-size:19px;font-weight:600;color:var(--paper)}
.pba .rangev{font-family:var(--serif);font-style:italic;font-size:13px;font-weight:600;color:rgba(255,255,255,.6)}
.pba .bright{text-align:right;cursor:pointer;flex:0 0 auto;padding:9px 0;border:0;background:none}
.pba .tgt{font-family:var(--serif);font-style:italic;font-size:14px;font-weight:600;color:var(--paper);white-space:nowrap}
.pba .status{font-family:var(--mono);font-size:8px;letter-spacing:.06em;text-transform:uppercase;margin-top:3px;white-space:nowrap;color:rgba(255,255,255,.55)}
.pba .status.ok{color:#7fd49a}.pba .status.near{color:var(--gold)}.pba .status.over{color:#ef9a9a}
.pba .meter{position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.12)}
.pba .meter .fill{height:100%;width:0;background:var(--gold);transition:width .55s var(--ease)}
.pba .meter .fill.ok{background:#7fd49a}.pba .meter .fill.near{background:var(--gold)}.pba .meter .fill.over{background:#ef9a9a}

/* intro overview */
.pba .intro{display:flex;flex-direction:column;gap:14px;padding:26px 22px 24px;background:var(--paper)}
.pba .intro-eyebrow{font-family:var(--mono);font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-deep)}
.pba .intro-h{font-family:var(--serif);font-style:italic;font-size:29px;line-height:1.05;color:var(--ink);margin:2px 0 4px}
.pba .intro-grid{display:flex;flex-direction:column;gap:10px}
.pba .irow2{display:flex;gap:10px}
.pba .irow2 .ibox{flex:1;min-width:0}
.pba .ibox{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px 15px}
.pba .ibox.tap{cursor:pointer}.pba .ibox.tap:active{background:rgba(92,37,66,.05)}
.pba .ik{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.pba .iv{font-family:var(--serif);font-style:italic;font-weight:600;font-size:21px;line-height:1.15;color:var(--ink);margin-top:3px}
.pba .ihint{font-family:var(--mono);font-size:8px;letter-spacing:.05em;color:#a8a39b;margin-top:5px}
.pba .ibox.dl{padding:13px 14px}
.pba .dl-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px}
.pba .dl-tag{font-family:var(--mono);font-size:7.5px;letter-spacing:.04em;color:var(--ink-soft);text-align:right;white-space:nowrap}
.pba .dl-row{display:flex;align-items:center;gap:9px;padding:8px 0;border-top:1px solid var(--line);text-decoration:none}
.pba .dl-dot{width:7px;height:7px;border-radius:50%;flex:none}
.pba .dl-row.over .dl-dot{background:#b23b34}.pba .dl-row.soon .dl-dot{background:var(--gold)}.pba .dl-row.next .dl-dot{background:var(--ink-soft)}
.pba .dl-main{flex:1;min-width:0}
.pba .dl-name{font-family:var(--serif);font-style:italic;font-weight:600;font-size:15px;line-height:1.1;color:var(--ink)}
.pba .dl-sub{font-family:var(--mono);font-size:8px;letter-spacing:.02em;color:var(--ink-soft);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pba .dl-when{flex:none;text-align:right;font-family:var(--mono);font-size:8px;line-height:1.3;letter-spacing:.05em;text-transform:uppercase}
.pba .dl-when.over{color:#b23b34;font-weight:500}.pba .dl-when.soon{color:var(--gold-deep)}.pba .dl-when.next{color:var(--ink-soft)}
.pba .dl-empty{font-family:var(--serif);font-style:italic;font-size:14px;color:var(--ink-soft);padding:6px 2px}
.pba .intro-cta{margin-top:6px;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--mulberry)}
.pba .intro-cta .chev{font-size:18px;line-height:1;animation:pbabob 1.5s var(--ease) infinite}
@keyframes pbabob{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-5px);opacity:1}}

/* category sticky stacking head */
.pba .cat-head{position:sticky;z-index:5;min-height:var(--head-h);background:var(--paper);display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 18px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);cursor:pointer;width:100%;text-align:left;border-left:0;border-right:0}
.pba .cat-head .hl{display:flex;align-items:center;gap:9px;min-width:0}
.pba .cat-head .nm{font-family:var(--sans);font-weight:700;font-size:13px;letter-spacing:.02em}
.pba .cat-head .amt{font-family:var(--serif);font-style:italic;font-size:13.5px;font-weight:600;color:var(--ink)}
.pba .cat-head .amt.zero{font-family:var(--mono);font-style:normal;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep)}
.pba .cat-head.active{background:#fff;box-shadow:0 6px 14px -10px rgba(0,0,0,.4)}
.pba .cat-head.active .nm{color:var(--mulberry)}

.pba .cat-body{padding:14px 0 22px;background:var(--paper)}
.pba .child-block{padding-bottom:6px}
.pba .child-name{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);padding:4px 18px 8px}
.pba .child-name.group span{font-weight:700;color:var(--ink);font-size:11.5px}
.pba .child-name .subtot{font-family:var(--serif);font-style:italic;font-weight:600;font-size:15px;color:var(--mulberry)}
.pba .child-name .subtot.z{font-family:var(--mono);font-style:normal;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-deep)}
.pba .dchip{font-family:var(--mono);font-size:8px;letter-spacing:.05em;text-transform:uppercase;border-radius:999px;padding:3px 8px;white-space:nowrap}
.pba .dchip.locked{background:rgba(197,160,89,.16);color:var(--gold-deep)}
.pba .dchip.over{background:rgba(178,59,52,.1);color:#b23b34}
.pba .dchip.soon{background:rgba(197,160,89,.16);color:var(--gold-deep)}
.pba .dchip.up{background:rgba(30,34,41,.05);color:var(--ink-soft)}

/* horizontal rail + cards */
.pba .rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 18px 6px;scrollbar-width:none}
.pba .rail::-webkit-scrollbar{display:none}
.pba .card{position:relative;flex:0 0 300px;max-width:84vw;scroll-snap-align:start}
.pba .v{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;cursor:pointer;text-align:left;width:100%;border-left:1px solid var(--line);border-right:1px solid var(--line);padding:0;transition:border-color .35s var(--ease),box-shadow .35s var(--ease)}
.pba .v .img{height:128px;background:linear-gradient(135deg,#3a3f47,#565b63);display:flex;align-items:center;justify-content:center}
.pba .v .img .ini{font-family:var(--serif);font-style:italic;font-size:30px;color:rgba(255,255,255,.6)}
.pba .v .meta{padding:13px 15px 15px}
.pba .v .vn{font-family:var(--sans);font-weight:700;font-size:15px;color:var(--ink)}
.pba .v .dist{font-family:var(--mono);font-size:9.5px;letter-spacing:.06em;color:var(--ink-soft);margin-top:2px}
.pba .v .stars{color:var(--gold);font-size:15px;letter-spacing:2px;margin-top:9px}
.pba .v .stars .rcount{font-family:var(--mono);font-size:8px;letter-spacing:.03em;color:var(--ink-soft);margin-left:6px;vertical-align:1px}
.pba .v .badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.pba .bdg{font-family:var(--mono);font-size:7.5px;letter-spacing:.07em;text-transform:uppercase;padding:3px 7px;border-radius:999px;background:rgba(30,34,41,.06);color:var(--ink-soft);white-space:nowrap}
.pba .bdg.setnayan{color:var(--mulberry);background:rgba(92,37,66,.1)}
.pba .v .price{font-family:var(--serif);font-style:italic;font-weight:600;font-size:21px;margin-top:7px;color:var(--ink)}
.pba .v .price.noprice{font-family:var(--mono);font-style:normal;font-size:11px;letter-spacing:.04em;color:var(--ink-soft);font-weight:500}
.pba .eye{display:inline-block;font-family:var(--mono);font-size:7.5px;letter-spacing:.02em;color:#b23b34;background:rgba(178,59,52,.08);border-radius:6px;padding:3px 6px;margin-top:9px}
.pba .pcorner{position:absolute;top:10px;right:10px;z-index:3;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--mulberry);border-radius:999px;padding:5px 9px;box-shadow:0 2px 10px rgba(0,0,0,.28)}
.pba .card.is-primary .v{border:3px solid var(--gold);box-shadow:0 0 0 3px rgba(197,160,89,.32)}
.pba .vx{position:absolute;top:10px;left:10px;z-index:4;min-width:26px;height:26px;padding:0 8px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(30,34,41,.5);color:#fff;font-family:var(--sans);font-size:17px;line-height:1;cursor:pointer;border:0;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
.pba .vx.armed{font-family:var(--mono);font-size:8px;letter-spacing:.1em;text-transform:uppercase;background:var(--mulberry)}

/* add card */
.pba .card.add{flex:0 0 124px}
.pba .add-inner{height:100%;min-height:191px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center;background:rgba(92,37,66,.05);border:1.5px dashed rgba(92,37,66,.4);border-radius:18px;color:var(--mulberry);cursor:pointer;width:100%}
.pba .add-inner .plus{font-size:24px;line-height:1;font-weight:300}
.pba .add-inner .at{font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;text-transform:uppercase;line-height:1.45;padding:0 6px}

/* empty child row */
.pba .empty-child{display:flex;align-items:center;gap:10px;margin:0 18px 8px;padding:10px 14px;border:1.5px dashed rgba(92,37,66,.3);border-radius:12px;background:rgba(92,37,66,.03);cursor:pointer;text-decoration:none}
.pba .empty-child .ep{font-size:17px;color:var(--mulberry);font-weight:300;line-height:1}
.pba .empty-child .en{font-family:var(--sans);font-size:13.5px;font-weight:600;color:var(--mulberry)}
.pba .empty-child .eh{margin-left:auto;font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:#b8b4ac}

/* recap */
.pba .end-spacer{display:flex;align-items:flex-start;justify-content:center;padding:18px 16px 20px}
.pba .endcard{width:100%;max-width:520px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:7px;background:var(--mulberry);color:#fff;border-radius:22px;padding:24px 20px 20px}
.pba .end-eyebrow{font-family:var(--mono);font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.pba .end-num{font-family:var(--serif);font-style:italic;font-weight:700;font-size:48px;line-height:.9;color:#fff;margin:2px 0}
.pba .end-line{font-family:var(--sans);font-size:11.5px;line-height:1.5;color:rgba(255,255,255,.8);max-width:280px}
.pba .end-stats{display:flex;width:100%;margin-top:10px;padding-top:13px;border-top:1px solid rgba(255,255,255,.2)}
.pba .end-stats>div{flex:1;border-left:1px solid rgba(255,255,255,.14)}
.pba .end-stats>div:first-child{border-left:0}
.pba .esv{font-family:var(--serif);font-style:italic;font-weight:600;font-size:24px;line-height:1;color:#fff}
.pba .esk{font-family:var(--mono);font-size:7.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-top:5px}
`;

// ── Root ──────────────────────────────────────────────────────────────────
export function PlanBudgetAccordion({
  model,
  eventId,
}: {
  model: PlanBudgetModel;
  eventId: string;
}) {
  const hasAnyPick = model.recap.shortlisted > 0;
  // Sticky-stack offset for category heads: they pin just under the budget bar.
  return (
    <div className="pba">
      <style>{PBA_CSS}</style>
      <TopBar model={model} eventId={eventId} />
      <Intro model={model} eventId={eventId} />
      <div>
        {model.folders.map((folder) => (
          <FolderBlock
            key={folder.folder}
            folder={folder}
            eventId={eventId}
          />
        ))}
      </div>
      {hasAnyPick && <Recap recap={model.recap} />}
    </div>
  );
}

// ── Dark budget top bar ─────────────────────────────────────────────────────
function TopBar({ model, eventId }: { model: PlanBudgetModel; eventId: string }) {
  const hasRange = model.rangeHiCentavos > 0;
  const tone =
    model.budgetStatus === 'over'
      ? 'over'
      : model.budgetStatus === 'near'
        ? 'near'
        : model.budgetStatus === 'within'
          ? 'ok'
          : '';
  const statusText =
    model.budgetStatus === 'over'
      ? 'over your limit'
      : model.budgetStatus === 'near'
        ? 'near your limit'
        : model.budgetStatus === 'within'
          ? 'within budget'
          : 'tap to set budget';
  return (
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
              {formatPesoCompact(model.rangeLoCentavos)} –{' '}
              {formatPesoCompact(model.rangeHiCentavos)}
            </span>
          </div>
        )}
      </div>
      <Link href={`/dashboard/${eventId}/settings`} className="bright">
        <div className="tgt">
          {model.targetCentavos !== null
            ? `of ${formatPesoCompact(model.targetCentavos)}`
            : 'Set target'}
        </div>
        <div className={`status ${tone}`}>{statusText}</div>
      </Link>
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

// ── Intro overview "Here's where you are" ───────────────────────────────────
function Intro({ model, eventId }: { model: PlanBudgetModel; eventId: string }) {
  const due = model.dueList.length > 0 ? model.dueList : [];
  const showUpNext = model.dueList.length === 0 && model.upNext;
  const overdueCount = model.dueList.filter((d) => d.daysLeft < 0).length;
  const soonCount = model.dueList.filter(
    (d) => d.daysLeft >= 0 && d.daysLeft <= 20,
  ).length;
  return (
    <div className="intro">
      <div>
        <p className="intro-eyebrow">Your budget &amp; plan</p>
        <h1 className="intro-h">Here&rsquo;s where you are</h1>
      </div>
      <div className="intro-grid">
        <div className="irow2">
          <Link
            href={`/dashboard/${eventId}/settings`}
            className="ibox tap"
            style={{ textDecoration: 'none' }}
          >
            <div className="ik">Estimated budget</div>
            <div className="iv">
              {model.targetCentavos !== null
                ? formatPesoPrecise(model.targetCentavos)
                : 'Tap to set'}
            </div>
            <div className="ihint">tap to change</div>
          </Link>
          <div className="ibox">
            <div className="ik">Budget chosen</div>
            <div className="iv">{formatPesoPrecise(model.chosenCentavos)}</div>
            <div className="ihint">your locked-in picks</div>
          </div>
        </div>

        {model.rangeHiCentavos > 0 && (
          <div className="ibox">
            <div className="ik">Your plan could land between</div>
            <div className="iv">
              {formatPesoPrecise(model.rangeLoCentavos)} –{' '}
              {formatPesoPrecise(model.rangeHiCentavos)}
            </div>
            <div className="ihint">cheapest vs priciest of your current choices</div>
          </div>
        )}

        <div className="ibox dl">
          <div className="dl-head">
            <div className="ik">
              {due.length > 0 ? 'What to lock next' : 'Next up'}
            </div>
            {due.length > 0 && (
              <div className="dl-tag">
                {overdueCount > 0 ? `${overdueCount} past due · ` : ''}
                {soonCount > 0 ? `${soonCount} within 20 days` : ''}
              </div>
            )}
          </div>
          {due.length === 0 && !showUpNext && (
            <div className="dl-empty">
              Nothing&rsquo;s urgent — you&rsquo;re ahead of the clock.
            </div>
          )}
          {due.map((d) => (
            <DueRow key={d.groupId} item={d} eventId={eventId} />
          ))}
          {showUpNext && model.upNext && (
            <DueRow item={model.upNext} eventId={eventId} calm />
          )}
        </div>
      </div>

      <div className="intro-cta">
        <span>Scroll to begin</span>
        <span className="chev">↓</span>
      </div>
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
  const overdue = item.daysLeft < 0;
  const soon = item.daysLeft >= 0 && item.daysLeft <= 20;
  const cls = calm ? 'next' : overdue ? 'over' : soon ? 'soon' : 'next';
  const when = calm
    ? 'Coming up'
    : overdue
      ? `${Math.abs(item.daysLeft)} days overdue`
      : soon
        ? `lock in ${item.daysLeft} days`
        : `${item.daysLeft} days`;
  const sub =
    item.optionCount > 0
      ? `${item.optionCount} option${item.optionCount === 1 ? '' : 's'} in play`
      : 'no vendor picked yet';
  return (
    <Link
      href={`/dashboard/${eventId}/vendors#group-${item.groupId}`}
      className={`dl-row ${cls}`}
    >
      <span className="dl-dot" />
      <span className="dl-main">
        <span className="dl-name">{item.label}</span>
        <span className="dl-sub">
          {sub}
          {item.maxEyeing > 0 ? ` · 🔥 ${item.maxEyeing} eyeing your date` : ''}
        </span>
      </span>
      <span className={`dl-when ${cls}`}>{when}</span>
    </Link>
  );
}

// ── Category block: sticky head + always-on body ────────────────────────────
function FolderBlock({
  folder,
  eventId,
}: {
  folder: AccordionFolder;
  eventId: string;
}) {
  const router = useRouter();
  const hasLocked = folder.lockedTotal > 0;
  return (
    <section id={`folder-${folder.folder}`}>
      <button
        type="button"
        className="cat-head"
        // Pins just under the sticky 62px-tall dark budget bar so each head
        // replaces the previous at the same line as you scroll (sticky-stack).
        style={{ top: 62 }}
        onClick={() => {
          const el = document.getElementById(`folder-${folder.folder}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        <span className="hl">
          <span className="nm">{folder.label}</span>
        </span>
        <span className={`amt ${hasLocked ? '' : 'zero'}`}>
          {hasLocked
            ? formatPesoCompact(folder.lockedTotal)
            : folder.pickCount > 0
              ? `${folder.pickCount} shortlisted`
              : 'not started'}
        </span>
      </button>
      <div className="cat-body">
        {folder.children.map((child) => (
          <ChildBlock
            key={child.groupId}
            child={child}
            eventId={eventId}
            folderSlug={folder.slug}
            router={router}
          />
        ))}
      </div>
    </section>
  );
}

function ChildBlock({
  child,
  eventId,
  folderSlug,
  router,
}: {
  child: AccordionChild;
  eventId: string;
  folderSlug: string;
  router: ReturnType<typeof useRouter>;
}) {
  const addHref = `/vendors?folder=${folderSlug}&from=plan&group=${child.groupId}`;
  // Empty child → slim one-line "add" row (no tall empty card), like the mock.
  if (child.picks.length === 0) {
    return (
      <div className="child-block" id={`group-${child.groupId}`}>
        <Link href={addHref} className="empty-child">
          <span className="ep">＋</span>
          <span className="en">{child.label}</span>
          <span className="eh">add</span>
        </Link>
      </div>
    );
  }
  return (
    <div className="child-block" id={`group-${child.groupId}`}>
      <div className="child-name">
        <span>{child.label}</span>
        <DeadlineChip child={child} />
      </div>
      <div className="rail">
        {child.picks.map((pick) => (
          <VendorCardAtom
            key={pick.vendor_id}
            pick={pick}
            eventId={eventId}
            router={router}
          />
        ))}
        <Link href={addHref} className="card add">
          <span className="add-inner">
            <span className="plus">＋</span>
            <span className="at">Add a {child.label.split(' ')[0]}</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

function DeadlineChip({ child }: { child: AccordionChild }) {
  if (child.state === 'finalized') {
    return <span className="dchip locked">✓ Locked</span>;
  }
  if (child.daysLeft === null) return null;
  const overdue = child.daysLeft < 0;
  const soon = child.daysLeft >= 0 && child.daysLeft <= 20;
  const cls = overdue ? 'over' : soon ? 'soon' : 'up';
  const label = overdue
    ? `${Math.abs(child.daysLeft)}d overdue`
    : soon
      ? `lock in ${child.daysLeft}d`
      : `${child.daysLeft}d`;
  return <span className={`dchip ${cls}`}>{label}</span>;
}

// ── Vendor card (prototype layout) ──────────────────────────────────────────
function VendorCardAtom({
  pick,
  eventId,
  router,
}: {
  pick: AccordionPick;
  eventId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [armed, setArmed] = useState(false);
  const lockFormRef = useRef<HTMLFormElement>(null);
  const removeRef = useRef<HTMLFormElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

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
  const detailHref = `/dashboard/${eventId}/vendors/${pick.vendor_id}`;

  // tap = open detail · long-press (550ms) = arm "Lock as your pick?" then,
  // on confirm tap, submit updateVendorStatus(contracted). Mirrors the
  // prototype's long-press-to-set-primary without breaking the server-action
  // form flow.
  const onPointerDown = () => {
    if (locked) return;
    longFired.current = false;
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      if (confirm(`Lock ${displayName} as your pick?`)) {
        lockFormRef.current?.requestSubmit();
      }
    }, 550);
  };
  const clearPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };
  const onClick = (e: React.MouseEvent) => {
    if (longFired.current) {
      e.preventDefault();
      longFired.current = false;
      return;
    }
    router.push(detailHref);
  };

  return (
    <div className={`card${locked ? ' is-primary' : ''}`}>
      {locked && <span className="pcorner">★ Chosen</span>}
      {!locked && (
        <button
          type="button"
          className={`vx${armed ? ' armed' : ''}`}
          aria-label="Remove from shortlist"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (armed) {
              removeRef.current?.requestSubmit();
              return;
            }
            setArmed(true);
            setTimeout(() => setArmed(false), 2500);
          }}
        >
          {armed ? 'Remove?' : '×'}
        </button>
      )}

      <button
        type="button"
        className="v"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="img">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              style={{ height: '100%', width: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span className="ini">{initials(displayName)}</span>
          )}
        </span>
        <span className="meta">
          <span className="vn">{displayName}</span>
          {pick.marketplace_city && (
            <span className="dist">{pick.marketplace_city}</span>
          )}
          <span className={`price${price ? '' : ' noprice'}`}>
            {price ?? 'Price on inquiry'}
          </span>
          {pick.eyeing > 0 && (
            <span className="eye">👀 {pick.eyeing} also eyeing this date</span>
          )}
        </span>
      </button>

      {/* hidden server-action forms driven by the gestures above */}
      <RemoveForm eventId={eventId} vendorId={pick.vendor_id} formRef={removeRef} />
      {!locked && (
        <form ref={lockFormRef} action={updateVendorStatus} hidden>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="vendor_id" value={pick.vendor_id} />
          <input type="hidden" name="status" value="contracted" />
        </form>
      )}
    </div>
  );
}

function RemoveForm({
  eventId,
  vendorId,
  formRef,
}: {
  eventId: string;
  vendorId: string;
  formRef: React.RefObject<HTMLFormElement | null>;
}) {
  return (
    <form ref={formRef} action={deleteVendor} hidden>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_id" value={vendorId} />
    </form>
  );
}

// ── Recap ───────────────────────────────────────────────────────────────────
function Recap({ recap }: { recap: RecapStats }) {
  return (
    <div className="end-spacer">
      <div className="endcard">
        <p className="end-eyebrow">Look how far you&rsquo;ve come</p>
        <p className="end-num">~{recap.hoursSaved}</p>
        <p className="end-line">
          <b>hours saved</b> finding &amp; contacting vendors — out of thousands
          in the market.
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
      </div>
    </div>
  );
}
