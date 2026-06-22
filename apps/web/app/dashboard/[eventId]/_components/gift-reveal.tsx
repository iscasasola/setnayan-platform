'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Sparkles, Heart, X, ArrowRight } from 'lucide-react';
import { markNotificationRead } from '@/lib/notification-actions';
import { useEscapeKey } from '@/lib/use-escape-key';

/**
 * GiftReveal — the couple-facing "an early wedding gift from the Setnayan Team"
 * pop-up (PR 2 of the gift experience · Admin_Account_Access_Model_2026-06-22.md).
 *
 * Fires once on the couple's dashboard when an UNREAD `gift` notification exists
 * (dropped by the comp-grant fulfillment bridge in PR 1). The sealed box opens
 * to reveal what was unlocked; opening / dismissing / using-it marks the
 * notification read (via the existing markNotificationRead action) so it shows
 * once. The unread bell remains the backstop if they navigate away first.
 *
 * Copy locked with owner 2026-06-22: "An early wedding gift · from the Setnayan
 * Team · Wishing you a beautiful wedding."
 */
export type GiftRevealData = {
  notificationId: string;
  title: string;
  body: string | null;
  relatedUrl: string | null;
};

export function GiftReveal({ gift }: { gift: GiftRevealData | null }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [lifting, setLifting] = useState(false);
  const [opened, setOpened] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
    if (gift) setOpen(true);
  }, [gift]);

  function markRead() {
    if (!gift) return;
    const fd = new FormData();
    fd.append('notification_id', gift.notificationId);
    // No return_to → the action just stamps read_at (no redirect).
    startTransition(() => {
      void markNotificationRead(fd);
    });
  }

  function close() {
    markRead();
    setOpen(false);
  }

  function openGift() {
    setLifting(true);
    window.setTimeout(() => setOpened(true), 480);
  }

  function useIt() {
    markRead();
    setOpen(false);
    if (gift?.relatedUrl) router.push(gift.relatedUrl);
  }

  useEscapeKey(close, open);

  if (!mounted || !gift || !open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="An early wedding gift from the Setnayan Team"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 p-4"
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-gold/30 bg-cream p-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink/70"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>

        {!opened ? (
          <>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.12em] text-gold">
              An early wedding gift
            </p>

            <div className="relative mx-auto mb-6 h-28 w-28">
              <div
                className="absolute bottom-0 left-1/2 h-24 w-24 -translate-x-1/2 rounded-xl bg-gold/80"
                aria-hidden
              />
              <div
                className="absolute bottom-0 left-1/2 h-24 w-5 -translate-x-1/2 bg-gold"
                aria-hidden
              />
              <div
                aria-hidden
                className="absolute left-1/2 top-0 h-8 w-28 -translate-x-1/2 rounded-lg bg-gold transition-transform duration-500 ease-out"
                style={lifting ? { transform: 'translateX(-50%) translateY(-44px) rotate(-8deg)' } : undefined}
              />
              <span className="absolute left-1/2 top-[42px] inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-gold bg-cream text-mulberry">
                <Gift aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </span>
            </div>

            <button
              type="button"
              onClick={openGift}
              disabled={lifting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink/90 disabled:opacity-70"
            >
              <Gift aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {lifting ? 'Opening…' : 'Open your gift'}
            </button>
          </>
        ) : (
          <div>
            <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Sparkles aria-hidden className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.12em] text-gold">
              An early wedding gift
            </p>
            <h2 className="mb-5 font-serif text-xl text-ink">from the Setnayan Team</h2>

            <div className="rounded-2xl bg-paper/60 p-4 text-left">
              <p className="text-sm leading-relaxed text-ink/80">
                {gift.body ?? 'You’ve unlocked a free feature for your wedding.'}
              </p>
            </div>

            <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-ink/60">
              <Heart aria-hidden className="h-4 w-4 text-mulberry" strokeWidth={1.75} />
              Wishing you a beautiful wedding
            </p>

            <button
              type="button"
              onClick={useIt}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink/90"
            >
              {gift.relatedUrl ? 'Start using it' : 'Lovely, thank you'}
              {gift.relatedUrl ? <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} /> : null}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
