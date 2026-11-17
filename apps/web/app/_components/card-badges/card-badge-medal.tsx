import { CARD_BADGE_ART } from '@/lib/card-badges-art';
import type { CardBadgeKey } from '@/lib/card-badges';

/** One medal: a filled circle in the badge's colour with its white stroke icon (v86 `.awi i` + `awIcon`). */
export function CardBadgeMedal({ badge, size, on = false }: { badge: CardBadgeKey; size: number; on?: boolean }) {
  const art = CARD_BADGE_ART[badge];
  return (
    <i
      aria-hidden
      data-card-badge-medal={badge}
      data-on={on ? '' : undefined}
      className="card-badge-medal grid shrink-0 place-items-center rounded-full not-italic"
      style={{ width: size, height: size, background: art.fill }}
    >
      <CardBadgeIcon badge={badge} size={Math.round(size * 0.6)} className="text-white" />
    </i>
  );
}

/** The badge's icon alone (v86 `awIcon`), drawn in currentColor — the medal's, and the rules / congratulations' icon. */
export function CardBadgeIcon({ badge, size, className }: { badge: CardBadgeKey; size: number; className?: string }) {
  const art = CARD_BADGE_ART[badge];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {art.icon.map((p, i) =>
        'd' in p ? <path key={i} d={p.d} /> : <rect key={i} x={p.rect[0]} y={p.rect[1]} width={p.rect[2]} height={p.rect[3]} rx={p.rect[4]} />,
      )}
    </svg>
  );
}
