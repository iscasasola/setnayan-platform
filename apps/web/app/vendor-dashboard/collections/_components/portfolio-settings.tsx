'use client';

import { useState } from 'react';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
import { DatesRow } from '../../customers/_components/dates-row';
import { walletRowTitle } from '@/lib/shop-wallet';
import { portfolioCountLabel } from '@/lib/portfolio-count-label';

/**
 * 🖼 PORTFOLIO ⚙ — the shipped `MenuSettingsButton` sheet for the Portfolio tab (THE ONE BUILD A3 W15 Phase A, lane C4;
 * spec §9 #12: C4 creates this file and the `portfolio` menu-settings entry).
 *
 * What it holds — only what is TRUE today:
 *   · Your free photos: "12 of 50 free photos" (the uploader's own cap) and the rule in the uploader's own words
 *     (`lib/shop-portfolio-credits.ts`: past the free room, 1 Papic credit a photo from the shop wallet, paid once);
 *   · the shop wallet those photos spend (`walletRowTitle` — unread says so, never 0);
 *   · Storage plans: NOT ON SALE YET. Storage purchase is out of this build (spec §1, owner 8 Nov "later") and its
 *     catalog rows are switched off — no price is shown or typed here.
 * ✂ No "What Show includes" toggles (map row 70 INVENTED; spec §9 #18).
 */
export function PortfolioSettings({
  photos,
  free,
  allowanceUnread,
  walletBalance,
  cover = false,
}: {
  /** Drawn on the Portfolio band: the cover's ink (`MenuSettingsButton`'s own `cover` look). */
  cover?: boolean;
  photos: number;
  free: number;
  allowanceUnread: boolean;
  walletBalance: number | null;
}) {
  const [open, setOpen] = useState(false);
  const n = (x: number) => x.toLocaleString('en-PH');
  return (
    <MenuSettingsButton menu="portfolio" open={open} onOpenChange={setOpen} cover={cover}>
      <div className="divide-y divide-ink/10 px-4 pb-6 pt-1" data-portfolio-settings="">
        <DatesRow
          data="portfolio-free"
          title={allowanceUnread ? 'Couldn’t read your photo allowance' : portfolioCountLabel(photos, free)}
          line={`The first ${n(free)} are free. After that each photo uses 1 Papic credit from your shop wallet — paid once, kept while your shop exists. Taking one off frees a free spot.`}
        />
        <DatesRow data="portfolio-wallet" title={walletRowTitle(walletBalance)} line={walletBalance == null ? 'Couldn’t read your wallet just now' : 'Pays for photos past your free room'} />
        <DatesRow data="portfolio-storage" title="Storage plans" line="Not on sale yet" />
      </div>
    </MenuSettingsButton>
  );
}
