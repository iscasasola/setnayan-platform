'use client';

/**
 * 🎗 THE CARD-BADGE CONGRATULATIONS, OPENED FROM ITS TODAY LINE (badge build J3; v86: *"Each time a card earns one, the
 * shop gets one line on Today: 'Congratulations, your [card] service card earned [badge]' — tapping it opens the
 * congratulations. Nothing opens by itself."*). The line's link is `cardBadgeCongratsHref` (lib/card-badges.ts); Today
 * reads it back, checks the hold is this shop's and open (`readCardBadgeCongrats`), and mounts this — main's
 * award-kit `CardBadgeCongrats`, filled with J3's data. Closing drops the link, so a reload does not reopen it.
 */
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CardBadgeCongrats } from '@/app/_components/award/card-badge-congrats';
import { CardBadgeIcon } from '@/app/_components/card-badges/card-badge-medal';
import { CARD_BADGE_ART } from '@/lib/card-badges-art';
import type { EarnedCardBadgeKey } from '@/lib/card-badges';

export function CardBadgeCongratsMount({
  cardName,
  badge,
  name,
  tag,
  rule,
}: {
  cardName: string;
  badge: EarnedCardBadgeKey;
  name: string;
  tag: string;
  rule: string;
}) {
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  if (!open) return null;
  return (
    <CardBadgeCongrats
      cardName={cardName}
      badgeName={name}
      tag={tag}
      rule={rule}
      color={CARD_BADGE_ART[badge].fill}
      icon={<CardBadgeIcon badge={badge} size={44} />}
      onClose={() => {
        setOpen(false);
        router.replace(pathname ?? '/vendor-dashboard', { scroll: false });
      }}
    />
  );
}
