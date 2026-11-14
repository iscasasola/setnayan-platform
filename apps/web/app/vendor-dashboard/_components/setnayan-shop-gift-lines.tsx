import { Gift } from 'lucide-react';
import { giftEndsSoonNotice, runningGiftLine } from '@/lib/setnayan-shop-gift';
import type { ShopGiftsRead } from '@/lib/setnayan-shop-gift.server';
import { SetnayanPlanGiftEndsSoon, SetnayanShopGiftWaiting } from './setnayan-shop-gift-moment';

/**
 * 🎁 SETNAYAN GIFTS ON TODAY (owner 14 Nov 2026; drawing frames "Today, after Later" · "During the gift" · "Before it
 * ends"): a gift not yet opened waits as one line with Open (only claiming closes it); a plan gift running shows
 * "Ultra · gift · 21 of 28 days left"; in its last 7 days a notice offers Stay on <plan> (catalogue price) or Go back.
 * A refused read SAYS so rather than drawing as "no gift" — a gift that waits must never vanish.
 */
export function SetnayanShopGiftLines({ read, now }: { read: ShopGiftsRead; now: number }) {
  if (!read.ok) {
    return (
      <p role="status" className="mb-3 border-b border-ink/10 py-3 text-[13px] text-danger-700">
        Your gifts from Setnayan couldn’t be read just now. Refresh to try again — nothing is lost.
      </p>
    );
  }
  const line = read.running ? runningGiftLine(read.running, now) : null;
  const soon = read.running ? giftEndsSoonNotice(read.running, now, read.stayPricePhp) : null;
  return (
    <>
      <SetnayanShopGiftWaiting gifts={read.waiting} />
      {soon && read.running ? (
        <SetnayanPlanGiftEndsSoon giftId={read.running.giftId} {...soon} />
      ) : line ? (
        <p className="mb-3 flex items-center gap-2 border-b border-ink/10 py-2 text-[14px] text-ink" data-setnayan-plan-gift-line="">
          <Gift aria-hidden className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
          {line}
        </p>
      ) : null}
    </>
  );
}
