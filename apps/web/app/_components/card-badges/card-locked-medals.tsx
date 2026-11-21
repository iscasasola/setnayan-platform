/**
 * 🔒 THE MEDALS A CARD HAS NOT EARNED YET — the supplier's own screens only (Card Maker v36, "The medals on the card").
 *
 * Owner 18 Nov: *"we still want to see how they look like"* — so a locked medal is drawn in its REAL art: full colour,
 * the same size as an earned one, with a small lock at the bottom-right. This replaces v84's grey look.
 *
 * ⛔ NEVER ON A COUPLE'S CARD. v84: "Locked ones are never shown to couples on the shop's website." This component lives
 * beside `CardBadgeRow` but is imported only from `app/vendor-dashboard/**`; `lib/card-locked-medals.test.ts` fails if a
 * couple-facing tree (`app/v/`, `app/[slug]/`, `app/dashboard/`) ever imports it.
 *
 * Server-renderable (no state, no effect): it only draws. Setnayan Verified is not listed here — it is not earned by a
 * card, and the shop's own badge page already says what it takes.
 */
import { Lock } from 'lucide-react';
import { CARD_BADGE_KEYS, CARD_BADGES, type CardBadgeView, type EarnedCardBadgeKey } from '@/lib/card-badges';
import { CardBadgeMedal } from './card-badge-medal';

/** The earned-by-a-card medals this card does not hold, in the fixed order. */
export function lockedCardMedals(held: readonly Pick<CardBadgeView, 'key'>[]): EarnedCardBadgeKey[] {
  const has = new Set(held.map((b) => b.key));
  return CARD_BADGE_KEYS.filter((k) => !has.has(k));
}

/** Same size as the earned row (`CardBadgeRow` draws medals at 20 px). */
const MEDAL = 20;

export function CardLockedMedals({ held }: { held: readonly Pick<CardBadgeView, 'key'>[] }) {
  const locked = lockedCardMedals(held);
  if (locked.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0" data-card-locked-medals="" aria-label="Medals this card can still earn">
      {locked.map((k) => (
        <li key={k} className="flex min-h-[28px] items-center gap-1.5 text-[12px] font-semibold" style={{ color: 'var(--m-slate-2)' }}>
          <span className="relative inline-flex shrink-0" aria-hidden>
            <CardBadgeMedal badge={k} size={MEDAL} />
            <span
              className="absolute -bottom-1 -right-1 grid h-3 w-3 place-items-center rounded-full bg-white shadow-sm"
              data-card-medal-lock=""
            >
              <Lock size={8} strokeWidth={2.5} className="text-ink" />
            </span>
          </span>
          <span>
            {CARD_BADGES[k].name} <span className="font-normal">· Locked</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
