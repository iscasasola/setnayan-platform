import type { CSSProperties } from 'react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { ShopBadge } from '@/lib/shop-badges';
import { TIERS, type TierPaint } from '@/lib/badge-tiers';
import s from './shop-badge-pill.module.css';

/**
 * 🏅 ShopBadgePill — THE one badge drawing (owner 2026-10-28, *"verified pill is good"*; corpus prototype
 * `prototypes/calling_cards_20_2026-10-28/pill.html`). The official mark — or the badge's number / ★ — in a circle on
 * the left, two tracked caps lines in Jost (the hub face, self-hosted), a rounded pill with a gold-foil edge.
 * It replaces the round seal / the plain "✓ Verified" chip everywhere a shop's badge is drawn.
 *
 *   ground  light (ivory) · white · dark (black, SETNAYAN in foil) · colour (any brand colour, foil) ·
 *           auto (ivory by day, black in the app's dark mode)
 *   size    xs (inline in a line of text) · sm (a chip) · md · lg — or any CSS font-size; the whole pill scales by it,
 *           so the same shape prints on a calling card and an 8 × 8 ft tarp (the print file is
 *           `/api/vendor/badges`, outlined from the same words).
 *
 * A pure view: every word arrives composed (`lib/shop-badges.ts`). No hooks, so a server page mounts it too.
 */
const grad = (stops: readonly string[]) => `linear-gradient(115deg, ${stops.join(', ')})`;
const vars = (p: TierPaint, pre: string): Record<string, string> => ({
  [`--${pre}-bg`]: p.bg,
  [`--${pre}-fg`]: p.fg,
  [`--${pre}-mk`]: p.mk,
  [`--${pre}-mkc`]: p.mkc,
  [`--${pre}-foil`]: grad(p.foil),
  [`--${pre}-edge`]: grad(p.edge),
});

const SIZES = { xs: '9px', sm: '11px', md: '18px', lg: '34px' } as const;

export type PillGround = 'light' | 'white' | 'dark' | 'colour' | 'auto';

export function ShopBadgePill({
  badge,
  ground = 'auto',
  colour,
  size = 'sm',
  title,
  className,
}: {
  badge: ShopBadge;
  ground?: PillGround;
  /** The ground when `ground="colour"` (default the deep green of the prototype). */
  colour?: string;
  size?: keyof typeof SIZES | string;
  /** What the badge means, said on hover — the shop page's load-bearing title. */
  title?: string;
  className?: string;
}) {
  const fontSize = size in SIZES ? SIZES[size as keyof typeof SIZES] : size;
  // A milestone wears its step's material (lib/badge-tiers.ts) on every ground; the tier name is never shown.
  const tier = badge.tier ? (TIERS.find((t) => t.key === badge.tier) ?? null) : null;
  const style: CSSProperties = tier
    ? ({ fontSize, ...vars(tier.light, 'tl'), ...vars(tier.dark, 'td') } as CSSProperties)
    : { fontSize, ...(ground === 'colour' ? { background: colour ?? '#1f3a2c' } : null) };
  const foil = !tier && (ground === 'dark' || ground === 'colour');
  const cls = tier
    ? [s.pill, s.tiered, ground === 'dark' || ground === 'colour' ? s.onDark : ground === 'auto' ? s.auto : '', className]
    : [s.pill, s[ground], className];
  const tick = badge.line2.endsWith(' ✓');
  const line2 = tick ? badge.line2.slice(0, -2) : badge.line2;
  return (
    <span
      className={cls.filter(Boolean).join(' ')}
      style={style}
      role="img"
      aria-label={badge.label}
      title={title}
      data-shop-badge={badge.key}
      data-tier={tier?.key}
    >
      <span aria-hidden className={s.edge} />
      {tier?.laurel ? (
        <svg aria-hidden viewBox="0 0 40 20" className={s.laurel}>
          <g fill="none" stroke="#d9b866" strokeWidth="1.4" strokeLinecap="round">
            <path d="M20 18C12 16 6 10 5 3" />
            <path d="M20 18c8-2 14-8 15-15" />
            <path d="M8 9c2 0 4 1 5 3M6 5c2 0 3 1 4 3M32 9c-2 0-4 1-5 3M34 5c-2 0-3 1-4 3" />
          </g>
        </svg>
      ) : null}
      <span aria-hidden className={s.mk}>
        {badge.glyph === null ? <SetnayanMark /> : <span className={s.glyph}>{badge.glyph}</span>}
      </span>
      <span aria-hidden>
        <span className={[s.t1, foil ? s.foil : ''].filter(Boolean).join(' ')}>{badge.line1}</span>
        <span className={s.t2}>
          {line2}
          {tick ? <i>✓</i> : null}
        </span>
      </span>
    </span>
  );
}
