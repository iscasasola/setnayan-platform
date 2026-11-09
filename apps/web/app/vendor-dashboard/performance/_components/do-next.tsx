'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { GrowthRec } from '@/lib/vendor-growth-recs';
import { REC_ICON, impactChipStyle } from './growth-recs-card';
import { EASE_OUT, useTween } from './growth-motion';

/**
 * ⏭ DO NEXT (Shop › Analytics, owner-approved 6 Nov 2026 — owner: "where are the recommendations?"). The shipped growth
 * recommendations (`buildGrowthRecs`, `lib/vendor-growth-recs.ts`) in the open: the top three under the hero sentence,
 * and each one again under the section it belongs to — only when its rule fired. Same icon, impact chip and CTA as
 * `GrowthRecsCard` (its `REC_ICON` / `impactChipStyle`, not a second copy), re-laid as house rows.
 *
 * Motion = the section's own fade-rise per row (500 ms ease-out, 120 ms apart) starting after the lanes (~950 ms), or
 * 650 ms after a section's picture starts. Remembered per key, so a window change never replays them.
 */
export function RecRow({ rec, sm = false, delay }: { rec: GrowthRec; sm?: boolean; delay: number }) {
  const v = useTween(`ag:rec:${sm ? 's:' : ''}${rec.key}`, 1, { dur: 500, ease: EASE_OUT, delay });
  return (
    <div className={sm ? 'ag-rec ag-sm' : 'ag-rec'} style={{ opacity: v, transform: `translateY(${((1 - v) * 8).toFixed(2)}px)` }} data-rec={rec.key}>
      <span className="ag-ic" aria-hidden>
        {REC_ICON[rec.key]}
      </span>
      <span className="ag-ttl">
        {sm ? <span className="ag-dnk">Do next ·</span> : null}
        {rec.title}
        <span className="ag-ichip" style={impactChipStyle(rec.impact)}>
          {rec.impactLabel}
        </span>
      </span>
      <span className="ag-ln">{rec.body}</span>
      <span>
        <Link className="ag-door" href={rec.ctaHref}>
          {rec.ctaLabel}
          <ArrowRight aria-hidden strokeWidth={1.9} />
        </Link>
      </span>
    </div>
  );
}

export function DoNext({ recs }: { recs: GrowthRec[] }) {
  return (
    <div className="ag-donext" data-do-next={recs.length ? recs.length : 'none'}>
      <p className="ag-dn-k">Do next</p>
      {recs.length ? (
        recs.slice(0, 3).map((r, i) => <RecRow key={r.key} rec={r} delay={950 + i * 120} />)
      ) : (
        <p className="ag-calm">Nothing to fix right now.</p>
      )}
    </div>
  );
}
