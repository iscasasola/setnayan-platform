'use client';

/**
 * 🏅 THE CARD'S BADGE ROW — layout D (owner-approved prototypes 15 Nov; DECISION_LOG row "layout D on every card").
 * No ribbon, no binder: a row of up to SIX medals in the fixed order (Hot Booking · Quick Responder · Trending Now ·
 * Rave Reviews · Generous Giver · Setnayan Verified, always last) and ONE label beside it. Every 2.6 s the next medal
 * lifts with a gold rim and the label changes to that badge's name and time held, in that badge's colour. A card with
 * one badge shows its medal and its name · time, still. Reduced motion: nothing turns — the first badge stays named.
 *
 * The whole row is ONE button (44 px tall) that opens the rules pop-up drawn in v86 (`#cbDlg`) — main's award-kit shell
 * `CardBadgeRules`, filled here from J3's data (names, held time, rules, colours, icons). It is loaded and mounted on the
 * tap, so a page of cards carries no pop-up until somebody asks, and it unmounts when closed.
 */
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { CARD_BADGE_ART, CARD_BADGE_RIM } from '@/lib/card-badges-art';
import { badgeLabel, CARD_BADGES, heldLine, type CardBadgeView } from '@/lib/card-badges';
import { CardBadgeIcon, CardBadgeMedal } from './card-badge-medal';

const CardBadgeRules = dynamic(() => import('@/app/_components/award/card-badge-rules').then((m) => m.CardBadgeRules), {
  ssr: false,
});

/** The design's beat (v86: `setInterval(…, 2600)`). */
export const CARD_BADGE_TURN_MS = 2600;

export function CardBadgeRow({
  badges,
  cardName,
  shopName,
  now,
}: {
  badges: readonly CardBadgeView[];
  cardName: string;
  shopName: string | null;
  /** The server's clock, so the label renders the same on the server and the first client paint. */
  now: number;
}) {
  const [on, setOn] = useState(0);
  const [open, setOpen] = useState(false);
  const n = badges.length;

  useEffect(() => {
    if (n < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setOn((i) => (i + 1) % n), CARD_BADGE_TURN_MS);
    return () => window.clearInterval(t);
  }, [n]);

  if (n === 0) return null;
  const names = badges.map((b) => CARD_BADGES[b.key].name).join(', ');

  return (
    <>
      <button
        type="button"
        data-card-badge-row=""
        aria-haspopup="dialog"
        aria-label={`${cardName}: ${names}. Show what these badges mean`}
        onClick={() => setOpen(true)}
        className="relative flex min-h-[44px] w-full items-center gap-1.5 rounded-xl px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <span className="flex shrink-0 items-center" aria-hidden>
          {badges.map((b, i) => (
            <span
              key={b.key}
              className={`card-badge-slot rounded-full transition-transform duration-300 motion-reduce:transition-none ${
                i > 0 ? '-ml-1' : ''
              } ${n > 1 && i === on ? 'relative z-[1] -translate-y-[3px] scale-110' : ''}`}
              style={{
                boxShadow: n > 1 && i === on ? CARD_BADGE_RIM.on : CARD_BADGE_RIM.off,
              }}
            >
              <CardBadgeMedal badge={b.key} size={20} on={n > 1 && i === on} />
            </span>
          ))}
        </span>
        <span className="grid min-w-0 flex-1 text-[12px] font-bold leading-tight" aria-hidden>
          {badges.map((b, i) => (
            <span
              key={b.key}
              data-card-badge-label={b.key}
              className={`card-badge-label truncate [grid-area:1/1] transition-opacity duration-300 motion-reduce:transition-none ${
                i === on ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ color: CARD_BADGE_ART[b.key].ink }}
            >
              {badgeLabel(b, now)}
            </span>
          ))}
        </span>
      </button>
      {open ? (
        <CardBadgeRules
          cardLine={shopName ? `${cardName} · ${shopName}` : cardName}
          badges={badges.map((b) => ({
            key: b.key,
            name: CARD_BADGES[b.key].name,
            held: heldLine(b, now),
            rule: CARD_BADGES[b.key].rule,
            color: CARD_BADGE_ART[b.key].fill,
            icon: <CardBadgeIcon badge={b.key} size={16} />,
          }))}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
