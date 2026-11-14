import { planGiftEndedLine, planGiftEndingWords, planGiftNoticeStage } from '@/lib/setnayan-shop-gift';
import type { ShopGiftsRead } from '@/lib/setnayan-shop-gift.server';
import { SetnayanShopGiftNotices } from './setnayan-shop-gift-moment';

/**
 * 🎁 SETNAYAN GIFTS ON TODAY (owner 14 Nov 2026): the gift waiting to be opened, the "ends soon" notice 7 days and 1
 * day before a plan gift ends (one "Stay on <plan>" button, the end date in words), and one plain line on the day it
 * ends — all through the ONE notice system (Today's top slot draws them; the bell keeps the rest). No countdown line.
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
  const r = read.running;
  const stage = r ? planGiftNoticeStage(r, now) : null;
  const ending =
    r && stage !== null
      ? { noticeKey: `plan-gift-ends:${r.giftId}:${stage}`, ...withDetail(planGiftEndingWords(r, read.stayPricePhp)) }
      : null;
  const ended = read.endedToday
    ? { noticeKey: `plan-gift-ended:${read.endedToday.giftId}`, title: planGiftEndedLine(read.endedToday) }
    : null;
  if (read.waiting.length === 0 && !ending && !ended) return null;
  return <SetnayanShopGiftNotices gifts={read.waiting} ending={ending} ended={ended} />;
}

function withDetail(w: { title: string; body: string; stay: string }) {
  return { title: w.title, detail: w.body, stay: w.stay };
}
