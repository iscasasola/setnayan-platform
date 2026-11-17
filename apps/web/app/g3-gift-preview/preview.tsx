'use client';
// TEMPORARY — preview-only fixtures. Nothing here reads or writes data; the claim buttons are never pressed.
import { NoticeSlot } from '@/app/_components/notices/notices';
import { SetnayanShopGiftMoment, SetnayanShopGiftNotices } from '@/app/vendor-dashboard/_components/setnayan-shop-gift-moment';
import { SetnayanGiftPicks } from '@/app/admin/gifts/_components/setnayan-gift-picks';
import { planGiftEndingWords, type ShopGiftView } from '@/lib/setnayan-shop-gift';

const SENT = '2026-11-16T02:00:00Z';
const GIFTS: Record<string, ShopGiftView> = {
  stock: { giftId: 'g-stock', type: 'stock', stockLine: '3 × Papic 1000', currentTier: 'pro', choices: ['stock'], claimed: false, sentAt: SENT },
  ultra: { giftId: 'g-ultra', type: 'stock', stockLine: '2 × Event Ultra', currentTier: 'pro', choices: ['stock'], claimed: false, sentAt: SENT },
  start: { giftId: 'g-start', type: 'plan', planTier: 'enterprise', planDays: 28, currentTier: null, choices: ['start'], claimed: false, sentAt: SENT },
  upgrade: { giftId: 'g-up', type: 'plan', planTier: 'enterprise', planDays: 28, currentTier: 'pro', choices: ['now', 'after'], claimed: false, sentAt: SENT },
  extend: { giftId: 'g-ext', type: 'plan', planTier: 'enterprise', planDays: 28, currentTier: 'enterprise', choices: ['extend'], claimed: false, sentAt: SENT },
};

export function G3GiftPreview({ v }: { v: string }) {
  if (v === 'admin') {
    return (
      <main className="mx-auto max-w-xl space-y-3 p-4">
        <h2 className="text-lg font-semibold">Or send a gift from Setnayan</h2>
        <SetnayanGiftPicks
          maxUnits={10}
          gifts={[
            { key: 'stock:PAPIC_GUEST_1000', label: 'Papic 1000 (gift stock)' },
            { key: 'stock:EVENT_ULTRA', label: 'Event Ultra (gift stock)' },
            { key: 'plan:solo', label: '28 days of Plus' },
            { key: 'plan:pro', label: '28 days of Pro' },
            { key: 'plan:enterprise', label: '28 days of Ultra' },
          ]}
        />
      </main>
    );
  }
  const gift = GIFTS[v];
  if (gift) return <main className="min-h-screen p-4"><SetnayanShopGiftMoment gift={gift} onClose={() => {}} /></main>;
  const ending = {
    noticeKey: 'plan-gift-ends:g-run:7',
    ...(() => {
      const w = planGiftEndingWords({ tier: 'enterprise', returnTier: 'pro', extend: false, endsAt: '2026-11-21T15:59:00Z' }, 9990);
      return { title: w.title, detail: w.body, stay: w.stay };
    })(),
  };
  return (
    <main className="min-h-screen">
      <NoticeSlot place="top" className="px-4 pt-3" />
      <SetnayanShopGiftNotices gifts={[GIFTS.upgrade!]} ending={ending} ended={null} />
      <p className="p-4 text-sm text-ink/60">Today (fixture)</p>
    </main>
  );
}
