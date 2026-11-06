'use client';

import { formatCount } from '@/lib/format-number';
import { EASE_FILL, useTween } from './growth-motion';

/**
 * §5 "Reputation & badges" — five outline stars and a clipped filled copy whose width slides like a `Fill` (rating ÷ 5,
 * 700 ms on `.meter-fill`'s curve) (Shop › Analytics, owner-approved 6 Nov 2026). `Fill` draws a bar, not a clip box,
 * so the same slide runs on `useTween`. No reviews → the outline only, "Your first review fills these".
 */
const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z';

function Five({ cls }: { cls: string }) {
  return (
    <svg viewBox="0 0 130 25" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} className={cls} transform={`translate(${i * 26},0) scale(1.02)`} d={STAR} />
      ))}
    </svg>
  );
}

function Filled({ pct }: { pct: number }) {
  const w = useTween('ag:stars', pct, { dur: 700, ease: EASE_FILL });
  return (
    <div className="ag-fillw" style={{ width: `${w}%` }}>
      <Five cls="ag-full" />
    </div>
  );
}

export function StarsFill({ rating, count, unread = false }: { rating: number | null; count: number; /** Not read — never the new shop's "Your first review…". */ unread?: boolean }) {
  return (
    <div data-stars-fill={rating === null ? 'empty' : 'rated'}>
      <div className="ag-stars">
        <Five cls="ag-outl" />
        {rating !== null ? <Filled pct={(rating / 5) * 100} /> : null}
      </div>
      <div className="ag-starl">
        {rating !== null ? (
          <>
            <b className="tabular-nums">{rating.toFixed(1)}</b> across {formatCount(count)} {count === 1 ? 'review' : 'reviews'}
          </>
        ) : unread ? (
          'Couldn’t load your reviews just now'
        ) : (
          'Your first review fills these'
        )}
      </div>
    </div>
  );
}
