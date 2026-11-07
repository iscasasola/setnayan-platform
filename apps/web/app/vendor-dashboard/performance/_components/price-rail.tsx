'use client';

import { EASE_FILL, useTween } from './growth-motion';

/**
 * §6 "How I compare" — the low · median · high rail from `PricePositionCard` (`BandRail`) with the shop's marker sliding
 * onto it (its `left` moves like a `Fill`, 700 ms, +100 ms) (Shop › Analytics, owner-approved 6 Nov 2026). Not enough
 * market data → a dashed rail with one line — never a range estimated from a handful.
 */
function Marker({ at }: { at: number }) {
  const x = useTween('ag:price:x', at, { dur: 700, ease: EASE_FILL, delay: 100 });
  return <span className="ag-me" style={{ left: `${x}%` }} />;
}

export function PriceRail({
  positioned,
  unread,
}: {
  positioned: { low: string; med: string; high: string; at: number | null } | null;
  unread: boolean;
}) {
  if (!positioned) {
    return (
      <div data-price-rail="empty">
        <div className="ag-rail ag-ghost" />
        <div className="ag-rail-l">
          <span>low</span>
          <span>median</span>
          <span>high</span>
        </div>
        <p className="ag-ghost-t" style={{ marginTop: 6 }}>
          {unread
            ? 'Couldn’t load the market just now.'
            : 'Appears once enough suppliers in your region publish a price — never estimated from a handful.'}
        </p>
      </div>
    );
  }
  return (
    <div data-price-rail="positioned">
      <div className="ag-rail">{positioned.at === null ? null : <Marker at={positioned.at} />}</div>
      <div className="ag-rail-l">
        <span>low {positioned.low}</span>
        <span>median {positioned.med}</span>
        <span>high {positioned.high}</span>
      </div>
    </div>
  );
}
