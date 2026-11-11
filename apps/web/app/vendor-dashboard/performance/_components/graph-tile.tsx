'use client';

import { useState, type ReactNode } from 'react';
import { ActionButton } from '@/components/action-button';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { GrowthRec } from '@/lib/vendor-growth-recs';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { impactChipStyle } from './growth-recs-card';
import { Reanimate, useReanimate } from './reanimate';

/**
 * 📈🎠 EVERY GRAPH IS A CARD OF THE ONE ANALYTICS CAROUSEL, AND A CARD RISES TO OUR RECOMMENDATION (Build 6 Lane I —
 * owner 10 Nov: *"tapping shows a recommendation from us on what they need to do."*; owner 11 Nov: *"Analytics should be
 * the carousel."*, the window *"inside each card"*; prototype `analytics_option_b_2026-11-11`, option 3).
 *
 *   CARD    title (the whole card is the button) · its number and its OWN window switch (or a fixed-window label) ·
 *           the picture, animated when the card is swiped into view (`Reanimate` + `WhenSeen`) · one line in words.
 *   RISE    THE one Rise full screen (`RiseScreen`, Build 5 Lane A — out of the tapped card, the reverse on ✕, the bars
 *           away; the same window switch rides its head, the one door its thumb zone): the graph larger, then ONE
 *           recommendation — Problem (the graph's own number) → Solution → one door — only when its rule fired in
 *           `buildGrowthRecs`; otherwise "Nothing to fix right now." Then the graph's details, then the one door.
 *   EXAMPLE an empty graph draws the REAL picture with sample data, faded, marked "Example", one line and a door to
 *           start (Build 5 Lane H). A refused read is never an example — it says "Couldn’t load".
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
  /** The picture — real rows when `ok`, the sample when `empty`; unused when `unread`. */
  pic: ReactNode;
  /** The one line in words (`ok`), or the example's line (`empty`). */
  line: ReactNode;
  /** The same line as plain text — the recommendation's Problem. */
  problem: string;
  /** This graph's rule, ONLY if it fired (from the window's `buildGrowthRecs`). */
  rec: GrowthRec | null;
  /** The approved section's details, shown in the risen view under the recommendation. */
  details?: ReactNode;
  /** The door when no rule fired (and the empty state's start). */
  door: { label: string; href: string };
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
 * Draws its picture only once the card has been SEEN (the `Reanimate` around it says so), so the bars grow, the lines
 * draw and the counts tick when the supplier swipes to it — never finishing off-screen while it waited in the carousel.
 * Reduced motion: the CSS keeps everything still (the house rules in globals.css / analytics-growing.css).
 */
function WhenSeen({ children }: { children: ReactNode }) {
  const seen = useReanimate();
  return seen === false ? <span className="ag-gp-wait" aria-hidden /> : <>{children}</>;
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
      <Reanimate className={g.state === 'empty' ? 'ag-card ag-ex' : 'ag-card'}>
        <div className="ag-card-in" data-graph={g.k} data-graph-state={g.state}>
          {g.state === 'empty' ? <span className="ag-exc">Example</span> : null}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`${g.title}${g.state === 'empty' ? ' — example' : ''} — open`}
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
            <>
              <span className="ag-gp" aria-hidden={g.state === 'empty' ? true : undefined}>
                <WhenSeen>{g.pic}</WhenSeen>
              </span>
              <span className="ag-ln">{g.line}</span>
            </>
          )}
          {g.state === 'empty' ? (
            <span className="ag-dr">
              {g.door.label} <ChevronRight aria-hidden strokeWidth={1.9} />
            </span>
          ) : null}
        </div>
      </Reanimate>
      {open ? (
        <RiseScreen
          title={g.title}
          line={g.state === 'empty' ? 'Example' : undefined}
          actions={control}
          onClose={() => setOpen(false)}
          data={`graph-${g.k}`}
          thumb={
            <div className="ag-onedoor" data-graph-door={g.k}>
              <ActionButton tone="brand" main icon={ArrowRight} label={door.label} href={door.href} />
            </div>
          }
        >
          <div data-growth="" className="ag-risen" data-graph-risen={g.k}>
            <div className={g.state === 'empty' ? 'ag-gbig ag-ex' : 'ag-gbig'}>
              <span className="ag-src">{g.src}</span>
              {figure ? <span className="ag-ctlrow">{figure}</span> : null}
              {g.state === 'unread' ? (
                <p className="ag-ln" role="status">
                  Couldn’t load.
                </p>
              ) : (
                <>
                  <div className="ag-gp">{g.pic}</div>
                  <p className="ag-ln">{g.line}</p>
                </>
              )}
            </div>
            <RecBox g={g} />
            {g.details ? <div className="ag-body">{g.details}</div> : null}
            <p className="ag-cap">{g.state === 'empty' ? 'The picture is a sample, faded — it goes with your first real row.' : 'One recommendation per graph · never advice on a number we do not have.'}</p>
          </div>
        </RiseScreen>
      ) : null}
    </>
  );
}
