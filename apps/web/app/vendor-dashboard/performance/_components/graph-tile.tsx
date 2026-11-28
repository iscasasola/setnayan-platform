'use client';

import { useState, type ReactNode } from 'react';
import { ActionButton } from '@/components/action-button';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { GrowthRec } from '@/lib/vendor-growth-recs';
import { ShopDoorScreen } from '@/app/vendor-dashboard/_components/shop-door-screen';
import { impactChipStyle } from './growth-recs-card';
import { Reanimate } from './reanimate';

/**
 * 📈🎠 EVERY GRAPH IS A CARD OF THE ONE ANALYTICS CAROUSEL, AND A CARD RISES TO OUR RECOMMENDATION (Build 6 Lane I —
 * owner 10 Nov: *"tapping shows a recommendation from us on what they need to do."*; owner 11 Nov: *"Analytics should be
 * the carousel."*, the window *"inside each card"*; prototype `analytics_option_b_2026-11-11`, option 3).
 *
 *   CARD    title (the whole card is the button) · its number and its OWN window switch (or a fixed-window label) ·
 *           the picture, drawn at its final size from the first paint, animated when the card is swiped into view (`Reanimate`) · one line in words.
 *   RISE    THE one Rise full screen (`RiseScreen`, Build 5 Lane A — out of the tapped card, the reverse on ✕, the bars
 *           away; the same window switch rides its head, the one door its thumb zone): the graph larger, then ONE
 *           recommendation — Problem (the graph's own number) → Solution → one door — only when its rule fired in
 *           `buildGrowthRecs`; otherwise "Nothing to fix right now." Then the graph's details, then the one door.
 *   EMPTY   an empty graph draws NO picture — its fixed box stays, blank — then one honest line and a door to start
 *           (owner R3, 27 Nov 2026: "a fixed app, not an app with guidelines"; no sample shown as if real). A refused read
 *           still says "Couldn’t load".
 *
 * 🔒 performance/every-graph-is-a-tile.test.ts · shop/analytics-is-the-carousel.test.ts
 */
export type GraphState = 'ok' | 'empty' | 'unread';

export type GraphSpec = {
  k: string;
  title: string;
  /** What the graph reads, named (drawn under the title). */
  src: string;
  /** "new" for the five Build 6 graphs; "absorb" for a tile that was a live Shop carousel card. */
  tag?: 'new' | 'absorb' | null;
  state: GraphState;
  /** The picture — real rows when `ok`; never drawn when `empty` or `unread`. */
  pic: ReactNode;
  /** The one line in words (`ok`), or the empty graph's one honest line (`empty`). */
  line: ReactNode;
  /** The same line as plain text — the recommendation's Problem. */
  problem: string;
  /** This graph's rule, ONLY if it fired (from the window's `buildGrowthRecs`). */
  rec: GrowthRec | null;
  /** The approved section's details, shown in the risen view under the recommendation. */
  details?: ReactNode;
  /** The door when no rule fired (and the empty state's start). */
  door: { label: string; href: string };
  /** 📈 "Three years" — the count cards' risen view only, drawn under the graph and before the recommendation. */
  years?: ReactNode;
};

function RecBox({ g }: { g: GraphSpec }) {
  const rec = g.state === 'ok' ? g.rec : null;
  return (
    <div className="ag-recbox" data-graph-rec={rec ? rec.key : 'none'}>
      <p className="ag-eye">Our recommendation</p>
      {rec ? (
        <>
          <h5 className="ag-rech">
            {rec.title}
            <span className="ag-ichip" style={impactChipStyle(rec.impact)}>
              {rec.impactLabel}
            </span>
          </h5>
          <dl className="ag-ps">
            <dt>Problem</dt>
            <dd>{g.problem}</dd>
            <dt>Solution</dt>
            <dd>{rec.body}</dd>
          </dl>
        </>
      ) : (
        <p className="ag-calm">{g.state === 'empty' ? `Nothing to fix yet — ${g.problem.charAt(0).toLowerCase()}${g.problem.slice(1)}` : 'Nothing to fix right now.'}</p>
      )}
    </div>
  );
}

/**
 * 🎠 ONE CARD OF THE ANALYTICS CAROUSEL (owner 11 Nov: *"Analytics should be the carousel"* · *"inside each card"* ·
 * *"Sliding switch"*; prototype `analytics_option_b_2026-11-11` option 3). The whole card opens it — its title is the one
 * button, stretched over the card — and the window switch inside it is its own control (never a button inside a button).
 * `figure` = the card's big number (Opened · Asked · Booked); `control` = the 30 days / 12 months switch, or the fixed
 * window as a label. The SAME control rides the risen head, so the window can change from either place.
 */
export function GraphCard({ g, control, figure }: { g: GraphSpec; control: ReactNode; figure?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const door = g.state === 'ok' && g.rec ? { label: g.rec.ctaLabel, href: g.rec.ctaHref } : g.door;
  return (
    <>
      <Reanimate className="ag-card">
        <div className="ag-card-in" data-graph={g.k} data-graph-state={g.state}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`${g.title} — open`}
            className="ag-th ag-open sn-press"
            data-graph-open={g.k}
          >
            <b>{g.title}</b>
            <ChevronRight aria-hidden className="ag-chev" strokeWidth={1.9} />
          </button>
          <span className="ag-ctlrow">
            {figure ?? <span />}
            {control}
          </span>
          {g.state === 'unread' ? (
            <span className="ag-ln" role="status">
              Couldn’t load.
            </span>
          ) : (
            /* 📐 THE PICTURE IS DRAWN FROM THE FIRST PAINT, IN ITS FIXED 144-PX BOX (owner 21 Nov 2026: *"the graphs when
               scrolled goes up and down"* · *"graphs look better and balance"*). Every card is one shape — head 24 ·
               number row 44 · picture 144 · line 36 — so no card can stretch the carousel, seen or not. The motion still
               waits for the card to be seen: `useTween` holds its values and analytics-growing.css pauses the CSS
               motion until `.perf-play`. 🔒 shop/the-analytics-carousel-never-changes-height.test.ts */
            <span className="ag-gp" aria-hidden={g.state === 'empty' ? true : undefined}>{g.state === 'empty' ? null : g.pic}</span>
          )}
          <span className="ag-foot">
            {g.state === 'unread' ? null : <span className="ag-ln">{g.line}</span>}
            {g.state === 'empty' ? (
              <span className="ag-dr">
                {g.door.label} <ChevronRight aria-hidden strokeWidth={1.9} />
              </span>
            ) : null}
          </span>
        </div>
      </Reanimate>
      {open ? (
        <ShopDoorScreen
          title={g.title}
          actions={control}
          onClose={() => setOpen(false)}
          data={`graph-${g.k}`}
          thumb={
            <div className="ag-onedoor" data-graph-door={g.k}>
              <ActionButton tone="brand" main icon={ArrowRight} label={door.label} href={door.href} className="!h-11" />
            </div>
          }
        >
          <div data-growth="" className="ag-risen" data-graph-risen={g.k}>
            <div className="ag-gbig">
              <span className="ag-src">{g.src}</span>
              {figure ? <span className="ag-ctlrow">{figure}</span> : null}
              {g.state === 'unread' ? (
                <p className="ag-ln" role="status">
                  Couldn’t load.
                </p>
              ) : (
                <>
                  {g.state === 'empty' ? null : <div className="ag-gp">{g.pic}</div>}
                  <p className="ag-ln">{g.line}</p>
                </>
              )}
            </div>
            {g.years ?? null}
            <RecBox g={g} />
            {g.details ? <div className="ag-body">{g.details}</div> : null}
            <p className="ag-cap">One recommendation per graph · never advice on a number we do not have.</p>
          </div>
        </ShopDoorScreen>
      ) : null}
    </>
  );
}
