'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ActionButton } from '@/components/action-button';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { GrowthRec } from '@/lib/vendor-growth-recs';
import { BodyPanel } from '../../_components/body-panel';
import { impactChipStyle } from './growth-recs-card';

/**
 * 📈 EVERY GRAPH IS A TILE, AND A TILE RISES TO OUR RECOMMENDATION (Build 6 Lane I — owner 10 Nov: *"we want graphs
 * that will help them. tapping shows a recommendation from us on what they need to do."*; prototype
 * `build6_makers_analytics_2026-11-10` frame "Proposed · one Analytics", approved 10 Nov).
 *
 *   TILE    title · its data, named, in one small line · the picture · one line in words. A frame, because it presses.
 *   RISE    the shipped in-body panel (`BodyPanel`, `lib/rise-motion.ts` — 0.7 s, the reverse on ✕): the graph larger,
 *           then ONE recommendation — Problem (the graph's own number) → Solution → one door — only when its rule
 *           fired in `buildGrowthRecs`; otherwise "Nothing to fix right now." Then the section's details (the approved
 *           6 Nov fold bodies, carried as is — each says its own empty and "Couldn’t load" lines), then the one door.
 *   EXAMPLE an empty graph draws the REAL picture with sample data, faded, marked "Example", one line and a door to
 *           start (Build 5 Lane H). A refused read is never an example — it says "Couldn’t load".
 *
 * 🔒 performance/every-graph-is-a-tile.test.ts
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

export function GraphTile({ g, window }: { g: GraphSpec; window?: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const door = g.state === 'ok' && g.rec ? { label: g.rec.ctaLabel, href: g.rec.ctaHref } : g.door;
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${g.title}${g.state === 'empty' ? ' — example' : ''} — open`}
        className={g.state === 'empty' ? 'ag-gtile sn-press ag-ex' : 'ag-gtile sn-press'} // no-card-ok: a graph tile is a <button> (it rises to our recommendation) — frames only on what you press
        data-graph={g.k}
        data-graph-state={g.state}
      >
        {g.state === 'empty' ? <span className="ag-exc">Example</span> : null}
        <span className="ag-th">
          <b>{g.title}</b>
          {g.state !== 'empty' && g.tag === 'new' ? <span className="ag-tag">new</span> : null}
          {g.state !== 'empty' ? <ChevronRight aria-hidden className="ag-chev" strokeWidth={1.9} /> : null}
        </span>
        <span className="ag-src">{g.src}</span>
        {g.state === 'unread' ? (
          <span className="ag-ln" role="status">
            Couldn’t load.
          </span>
        ) : (
          <>
            <span className="ag-gp" aria-hidden={g.state === 'empty' ? true : undefined}>
              {g.pic}
            </span>
            <span className="ag-ln">{g.line}</span>
          </>
        )}
        {g.state === 'empty' ? (
          <span className="ag-dr">
            {g.door.label} <ChevronRight aria-hidden strokeWidth={1.9} />
          </span>
        ) : null}
      </button>
      {open ? (
        <BodyPanel origin={ref.current} frame={ref.current?.closest<HTMLElement>('[data-growth]') ?? null} title={g.title} sub={g.state === 'empty' ? 'Example' : undefined} onClose={() => setOpen(false)} data={`graph-${g.k}`}>
          <div data-growth="" className="ag-risen" data-graph-risen={g.k}>
            {window ? <div className="ag-topctl">{window}</div> : null}
            <div className={g.state === 'empty' ? 'ag-gbig ag-ex' : 'ag-gbig'}>
              <span className="ag-src">{g.src}</span>
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
            <div className="ag-onedoor" data-graph-door={g.k}>
              <ActionButton tone="brand" main icon={ArrowRight} label={door.label} href={door.href} />
            </div>
          </div>
        </BodyPanel>
      ) : null}
    </>
  );
}

/** A section's eyebrow, then its tiles (the six-section order a supplier asks, approved 6 Nov). */
export function GraphSection({ id, title, when, children }: { id: string; title: string; when?: string; children: ReactNode }) {
  return (
    <section className="ag-gsec" aria-label={title} data-graph-section={id}>
      <p className="ag-gsech">
        <span className="ag-eye">{title}</span>
        {when ? <small>{when}</small> : null}
      </p>
      <div className="ag-gtiles">{children}</div>
    </section>
  );
}
