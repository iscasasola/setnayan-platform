'use client';

/**
 * 🏅 THE RULES EXPLAINER — the pop-up a tap on a card's badge row opens (v86 `cbDlg`, "This card's badges").
 * One row per badge: its medal, its name, "Held 4 mos · since 15 Jul 2026", then its rule in the design's own words.
 * Drawn in the house `Sheet` (never a second dialog primitive), with the design's "Got it" (48 px).
 *
 * ⚠ One sentence differs from v86 on purpose: the design says each badge "is checked every day". It is checked each
 * time the card is shown (lib/card-badges.server.ts) — so that is what this says. Named in the PR.
 */
import { useId } from 'react';
import { Sheet } from '@/app/_components/sheet';
import { CARD_BADGES, PARTNER_HELD_WORDS, heldWords, sinceWords, type CardBadgeView } from '@/lib/card-badges';
import { CardBadgeMedal } from './card-badge-medal';

const DAY_MS = 86_400_000;

export function CardBadgesExplainer({
  open,
  onClose,
  badges,
  cardName,
  shopName,
  now,
}: {
  open: boolean;
  onClose: () => void;
  badges: readonly CardBadgeView[];
  cardName: string;
  shopName: string | null;
  now: number;
}) {
  const headingId = useId();
  const title = badges.length > 1 ? 'This card’s badges' : CARD_BADGES[badges[0]!.key].name;
  return (
    <Sheet open={open} onClose={onClose} labelledById={headingId}>
      <div className="space-y-4 p-1" data-card-badges-explainer="">
        <header className="space-y-1 pr-12">
          <h3 id={headingId} className="font-display text-[22px] leading-tight text-ink">
            {title}
          </h3>
          <p className="text-[14px] text-ink/70">{shopName ? `${cardName} · ${shopName}` : cardName}</p>
        </header>
        <ul className="grid gap-3">
          {badges.map((b) => {
            const def = CARD_BADGES[b.key];
            const t = b.since ? Date.parse(b.since) : NaN;
            return (
              <li key={b.key} className="grid grid-cols-[26px_1fr] items-start gap-2 text-[13px] leading-snug text-ink/80">
                <CardBadgeMedal badge={b.key} size={26} />
                <span>
                  <b className="block text-[13.5px] text-ink">{def.name}</b>
                  {b.key === 'partner' ? (
                    <em className="block not-italic text-ink/70">Held {PARTNER_HELD_WORDS}</em>
                  ) : Number.isFinite(t) ? (
                    <em className="block not-italic text-ink/70">
                      Held {heldWords((now - t) / DAY_MS)} · since {sinceWords(b.since!)}
                    </em>
                  ) : null}
                  {def.rule}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[13px] leading-snug text-ink/70">
          Each badge is checked each time this card is shown. It comes off the moment the card stops passing; the time it
          was held stays in the shop’s record, and the card can earn it again.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[48px] w-full rounded-full bg-ink text-[15px] font-bold text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          Got it
        </button>
      </div>
    </Sheet>
  );
}
