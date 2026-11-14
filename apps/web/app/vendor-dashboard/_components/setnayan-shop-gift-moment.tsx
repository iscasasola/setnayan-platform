'use client';

/**
 * 🎁 THE SETNAYAN GIFT MOMENT, FOR A SHOP (owner 14 Nov 2026; approved drawing QSMD9BaefarMRNQAnMFiND frames 4 · 5,
 * "Claiming the gift", "Today, after Later").
 *
 * The popup is G2's GiftMoment (`app/_components/gift-moment/gift-moment.tsx`), reused unchanged: its seal wears
 * Setnayan's mark, its tap-to-open, its pressed / "Claiming…" / no-connection / claimed states. This file supplies the
 * view (`setnayanShopGiftMomentView`), the choices the database allows, and the claim.
 *
 * 🔒 THE PRESS IS THE CLAIM (DECISION_LOG "PRESSING REDEEM IS THE CLAIM"): exactly once, in the database
 * (`setnayan_shop_gift_claim`); Later always works and leaves the gift waiting as its notice line.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import { startBadgeUpgrade } from '@/app/vendor-dashboard/subscription/badge-upgrade-actions';
import {
  SHOP_GIFT_WAITING,
  setnayanShopGiftMomentView,
  shopGiftMomentWords,
  type ShopGiftChoice,
  type ShopGiftView,
} from '@/lib/setnayan-shop-gift';

const GiftMoment = dynamic(() => import('@/app/_components/gift-moment/gift-moment'), { ssr: false });

export type PlanGiftNoticeView = {
  /** Stable, with its FACT in it (the gift and the 7- or 1-day stage), so a new stage comes back after a Hide. */
  noticeKey: string;
  title: string;
  detail: string;
  stay: string;
};

/**
 * 🔔 SETNAYAN GIFTS ON TODAY, THROUGH THE ONE NOTICE SYSTEM (owner 14 Nov 2026; DECISION_LOG "A GIFTED SUPPLIER PLAN
 * SAYS 'ENDS SOON' 7 DAYS BEFORE AND AGAIN 1 DAY BEFORE"). Registers notices only; Today's top slot draws them.
 *   · a gift waiting to be opened — live, no close (only claiming closes it), Open;
 *   · 7 days and 1 day before a plan gift ends — live, the stage in its key, ONE button "Stay on <plan>";
 *   · the day it ends — news, one plain line, Got it.
 * No countdown anywhere else (owner: "no countdown banners on every page").
 */
export function SetnayanShopGiftNotices({
  gifts,
  ending,
  ended,
}: {
  gifts: readonly ShopGiftView[];
  ending: PlanGiftNoticeView | null;
  ended: { noticeKey: string; title: string } | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = gifts.find((g) => g.giftId === openId) ?? null;
  return (
    <>
      {gifts.map((g) => (
        <Notice
          key={g.giftId}
          kind="live"
          tone="info"
          closable={false}
          noticeKey={`setnayan-gift:${g.giftId}`}
          title={SHOP_GIFT_WAITING.line}
          actions={
            <button type="button" onClick={() => setOpenId(g.giftId)} className={NOTICE_ACTION} data-setnayan-shop-gift-open="">
              {SHOP_GIFT_WAITING.open}
            </button>
          }
        />
      ))}
      {ending ? (
        <Notice
          kind="live"
          tone="warning"
          noticeKey={ending.noticeKey}
          title={ending.title}
          detail={ending.detail}
          actions={
            <Link href="/vendor-dashboard/subscription" className={NOTICE_ACTION} data-setnayan-plan-gift-stay="">
              {ending.stay}
            </Link>
          }
        />
      ) : null}
      {ended ? <Notice kind="news" noticeKey={ended.noticeKey} title={ended.title} /> : null}
      {open ? <SetnayanShopGiftMoment gift={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}

/**
 * 🎁 The moment itself is G2's GiftMoment, reused unchanged (loaded only when a gift is opened, as G2's own pages do).
 * The claim is this gift's own door — `startBadgeUpgrade` op=gift_claim → `setnayan_shop_gift_claim`, exactly once —
 * and its answer is G2's shape: claimed / already → "✓ Claimed"; a refusal → refused; no answer → "No connection",
 * whose Try again re-sends the SAME claim (safe: the database grants once).
 */
export function SetnayanShopGiftMoment({ gift, onClose }: { gift: ShopGiftView; onClose: () => void }) {
  const router = useRouter();
  const view = setnayanShopGiftMomentView(gift);
  const choices = shopGiftMomentWords(gift).buttons.map((b) => ({ id: b.choice, label: b.label, main: b.main }));
  async function claim(choiceId: string): Promise<unknown> {
    const fd = new FormData();
    fd.set('op', 'gift_claim');
    fd.set('gift_id', gift.giftId);
    fd.set('choice', choiceId as ShopGiftChoice);
    const res = await startBadgeUpgrade({ status: 'idle' }, fd);
    if (res.status === 'gift') return { status: res.outcome };
    // "Couldn't open it right now" is a failure to answer (Try again); every other refusal is final.
    if (res.status === 'error' && res.message.startsWith('Couldn’t open it right now')) return null;
    return { status: 'refused' };
  }
  return (
    <GiftMoment
      view={view}
      choices={choices}
      claim={claim}
      onClaimed={() => router.push(view.redeemHref)}
      onLater={onClose}
    />
  );
}
