'use client';

/**
 * 🎁 THE SETNAYAN GIFT MOMENT, FOR A SHOP (owner 14 Nov 2026; approved drawing QSMD9BaefarMRNQAnMFiND frames 4 · 5,
 * "Claiming the gift", "Today, after Later").
 *
 * ⚠ STANDS IN FOR G2's GiftMoment. G2 (the reusable tap-to-open moment and its "waiting" line) is being built in
 * parallel and had not merged when this was written; this is the smallest moment the drawing needs — the seal with
 * Setnayan's mark, Tap to open, the opened card, the buttons, Later — so G2's component can replace the shell here
 * without touching what is pressed or said (`lib/setnayan-shop-gift.ts` holds every word; the press is
 * `startBadgeUpgrade` op=gift_claim). Two stills and a fade, no confetti library (owner: no video).
 *
 * 🔒 THE PRESS IS THE CLAIM (DECISION_LOG "PRESSING REDEEM IS THE CLAIM"): the button goes pressed + "Claiming…" at
 * once and cannot be pressed again while the request is out; a lost connection says so and offers Try again, which
 * re-sends the SAME claim (the database grants once); Later always works and leaves the gift waiting.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Gift } from 'lucide-react';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import { inertBehind } from '@/lib/popup-behind';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { useHydrated } from '@/lib/use-hydrated';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-styles';
import { startBadgeUpgrade } from '@/app/vendor-dashboard/subscription/badge-upgrade-actions';
import {
  SHOP_GIFT_CLAIM_WORDS as W,
  SHOP_GIFT_SEAL,
  SHOP_GIFT_WAITING,
  shopGiftMomentWords,
  type ShopGiftChoice,
  type ShopGiftView,
} from '@/lib/setnayan-shop-gift';

type Phase = 'wrapped' | 'open' | 'claiming' | 'offline' | 'claimed' | 'refused';

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

export function SetnayanShopGiftMoment({ gift, onClose }: { gift: ShopGiftView; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<Phase>('wrapped');
  const [pressed, setPressed] = useState<ShopGiftChoice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hydrated = useHydrated();
  const words = shopGiftMomentWords(gift);

  useLayoutEffect(() => {
    const el = root.current;
    return el ? inertBehind(el) : undefined;
  }, []);
  useModalA11y({ open: true, onClose: close, containerRef: panel, initialFocusRef: first });

  // A claimed gift leaves the waiting line by itself: the action revalidated Today, and its answer carries the render.
  function close() {
    onClose();
  }

  async function claim(choice: ShopGiftChoice) {
    if (phase === 'claiming') return; // two quick taps never send two claims
    setPressed(choice);
    setPhase('claiming');
    const fd = new FormData();
    fd.set('op', 'gift_claim');
    fd.set('gift_id', gift.giftId);
    fd.set('choice', choice);
    try {
      const res = await startBadgeUpgrade({ status: 'idle' }, fd);
      if (res.status === 'gift') {
        setMessage(res.message);
        setPhase('claimed');
      } else {
        setMessage(res.status === 'error' ? res.message : null);
        setPhase('refused');
      }
    } catch {
      setPhase('offline'); // never reached us (or the answer never came back) — Try again sends the SAME claim
    }
  }

  if (!hydrated) return null;
  const busy = phase === 'claiming';
  return createPortal(
    <div ref={root} className="fixed inset-0 z-[96]" data-setnayan-shop-gift-moment={phase}>
      <OverlayBackdrop onClose={close} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={SHOP_GIFT_SEAL.from}
        tabIndex={-1}
        className="absolute left-1/2 top-1/2 flex max-h-[calc(100dvh-48px)] w-[min(360px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-2xl bg-white px-5 pb-4 pt-5 text-center shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)] focus:outline-none dark:bg-cream"
      >
        <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-ink/70">{SHOP_GIFT_SEAL.kicker}</p>
        <p className="mt-1 text-[14px] font-semibold text-ink">{SHOP_GIFT_SEAL.from}</p>

        {phase === 'wrapped' ? (
          <button
            ref={first}
            type="button"
            onClick={() => setPhase('open')}
            className="sn-press sn-press-ring mx-auto mt-5 flex min-h-[176px] w-full flex-col items-center justify-center gap-3 rounded-2xl bg-sn-accent/10 text-ink"
            data-setnayan-shop-gift-seal=""
          >
            <span className="relative inline-grid h-20 w-20 place-items-center rounded-full bg-sn-accent text-sn-on-accent">
              <Gift aria-hidden className="h-9 w-9" strokeWidth={1.75} />
              <SetnayanMark className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white p-1 dark:bg-cream" />
            </span>
            <span className="text-[15px] font-semibold">{SHOP_GIFT_SEAL.tap}</span>
          </button>
        ) : (
          <div className="mt-4 os-rise">
            <span className="mx-auto inline-grid h-14 w-14 place-items-center rounded-full bg-sn-accent/10 text-sn-accent">
              <SetnayanMark className="h-8 w-8" />
            </span>
            <h2 className="mt-3 text-[20px] font-semibold leading-snug text-ink">{words.title}</h2>
            <p className="mt-1 text-[15px] font-semibold text-ink">{words.what}</p>
            {words.lines.map((l) => (
              <p key={l} className="mt-1 text-[14px] leading-snug text-ink/70">
                {l}
              </p>
            ))}

            {phase === 'claimed' ? (
              <p role="status" className="mt-4 text-[14px] font-semibold text-success-700" data-setnayan-shop-gift-claimed="">
                ✓ {W.claimed}
                {message ? ` · ${message}` : ''}
              </p>
            ) : null}
            {phase === 'offline' ? (
              <p role="alert" className="mt-4 text-[13.5px] text-warn-700">
                {W.offline}
              </p>
            ) : null}
            {phase === 'refused' && message ? (
              <p role="alert" className="mt-4 text-[13.5px] text-danger-700">
                {message}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2">
              {phase !== 'claimed'
                ? words.buttons.map((b, i) => {
                    const isPressed = busy && pressed === b.choice;
                    const label = isPressed ? W.claiming : phase === 'offline' && pressed === b.choice ? W.tryAgain : b.label;
                    return (
                      <button
                        key={b.choice}
                        ref={i === 0 ? first : undefined}
                        type="button"
                        disabled={busy}
                        aria-pressed={isPressed}
                        onClick={() => claim(phase === 'offline' && pressed ? pressed : b.choice)}
                        className={`sn-press sn-press-ring inline-flex min-h-12 w-full items-center justify-center rounded-full px-4 text-[15px] font-semibold disabled:opacity-60 ${
                          b.main ? 'bg-sn-accent text-sn-on-accent' : 'border border-ink/20 text-ink'
                        }`}
                        data-setnayan-shop-gift-choice={b.choice}
                      >
                        {label}
                      </button>
                    );
                  })
                : null}
              <button
                type="button"
                onClick={close}
                className="sn-press sn-press-ring inline-flex min-h-11 w-full items-center justify-center rounded-full text-[14px] font-semibold text-link"
              >
                {phase === 'claimed' ? W.close : W.later}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
