'use client';

import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { PASS_CARD_ROUTE, PASS_CARD_WORDS } from '@/lib/pass-card';

/**
 * 🎫 One guest's PASS CARD — the 1080 × 1440 PNG they save themselves, named
 * after them (lib/pass-card.ts). FREE, one at a time (owner 2026-09-29:
 * "downloading them individually is free") — only the couple's zip of every
 * card is Event Hub Pro, and that lives in Details › Pass. The route decides
 * who has a card (accepted, coming) and says so when this guest has none.
 */
export function GuestPassCardLink({ guestId }: { guestId: string }) {
  return (
    <SavePassCardButton
      hrefs={[`${PASS_CARD_ROUTE}?guest=${encodeURIComponent(guestId)}`]}
      label={PASS_CARD_WORDS.downloadOne}
      variant="link"
      className="!min-h-0 text-[13px] text-ink/80 no-underline hover:text-terracotta-700 hover:underline"
    />
  );
}

/*
 * Its own file (not \`guest-save-links.tsx\`): the guest card draws it through a
 * prop the page hands in (\`PassCardLink\`) — the Guest list this module, the
 * Maker its lazy stand-in (\`launch/_components/details-lazy.tsx\`) — so the
 * pass card's code is never in the Maker's first load.
 */
