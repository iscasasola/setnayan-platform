'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { SENT_SCREEN_SECONDS, sentScreenWords } from '@/lib/pay-sent-screen';

/**
 * The screen right after a receipt is sent — FULL SCREEN, and it leaves by itself.
 *
 * ⚖ OWNER 2026-11-17, verbatim: *"Returning to home in 5 seconds. tap to return
 * to Gifts."* So:
 *   · it covers the whole page (nothing behind it is still asking them to pay);
 *   · a VISIBLE countdown from 5 goes to their Home;
 *   · a tap ANYWHERE goes back to where they came from — Gifts for a gift order
 *     (`payable.back`, the same way-out the page has always used).
 *
 * 🔑 IT IS A LINK FIRST. With JavaScript off or still loading the whole screen is
 * a real `<a href>` to where they came from, so it is never a dead end; the
 * countdown is what JavaScript adds.
 */
export function SentScreen({
  homeHref,
  backHref,
  backLabel,
}: {
  homeHref: string;
  backHref: string;
  /** `payable.back.label` — "Back to Gifts" → "tap to return to Gifts". */
  backLabel: string;
}) {
  const router = useRouter();
  const [left, setLeft] = useState(SENT_SCREEN_SECONDS);
  const words = sentScreenWords(left, backLabel);

  useEffect(() => {
    if (left <= 0) {
      router.replace(homeHref);
      return;
    }
    const t = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left, homeHref, router]);

  return (
    <a
      href={backHref}
      data-pay-sent-screen=""
      aria-label={words.tap}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        router.push(backHref);
      }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-cream px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-center"
    >
      <CheckCircle2 aria-hidden className="h-14 w-14 text-mulberry" strokeWidth={1.75} />
      <h1 className="mt-5 text-2xl font-semibold text-ink">{words.title}</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-ink/65">{words.body}</p>
      <p role="status" aria-live="polite" className="mt-8 text-[15px] font-semibold text-ink">
        {words.countdown}
      </p>
      <span
        aria-hidden
        className="mt-3 grid h-12 w-12 place-items-center rounded-full border-2 border-ink/15 font-mono text-xl font-bold text-ink"
      >
        {Math.max(left, 0)}
      </span>
      <p className="mt-8 text-sm text-ink/55 underline underline-offset-4">{words.tap}</p>
    </a>
  );
}
