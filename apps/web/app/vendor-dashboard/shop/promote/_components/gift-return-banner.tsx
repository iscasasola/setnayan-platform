'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/**
 * 🎁 THE WAY BACK FROM THE GIFT STORE (#7823, owner 21 Nov: "make them jump to the page where to buy gifts. after they
 * buy, we can return to the booking fee"). The Agree step's "0 left · Buy more ›" opens the store with `?gift=&back=`;
 * the `back` path is kept for this tab (sessionStorage) so it survives the pay page, whose own exit for a gift order is
 * "Back to your shop". Wherever the supplier lands — the store or the shop home — this one line takes them back to the
 * booking, which reopens on the gift they bought (`agree_gift=`). Same-site `/vendor-dashboard/` paths only.
 *
 * Storage can be blocked (private window): then the line shows only while `?back=` is in the URL — never an error.
 */
export const GIFT_RETURN_KEY = 'sn.gift-return';
export const GIFT_RETURN_WORDS = 'Back to the booking ›';

export function safeGiftReturn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith('/vendor-dashboard/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : null;
}

function readKept(): string | null {
  try {
    return safeGiftReturn(window.sessionStorage.getItem(GIFT_RETURN_KEY));
  } catch {
    return null;
  }
}

export function forgetGiftReturn(): void {
  try {
    window.sessionStorage.removeItem(GIFT_RETURN_KEY);
  } catch {
    /* storage blocked: nothing kept */
  }
}

export function GiftReturnBanner({ className = '' }: { className?: string }) {
  const fromUrl = safeGiftReturn(useSearchParams().get('back'));
  const [back, setBack] = useState<string | null>(fromUrl);

  useEffect(() => {
    if (fromUrl) {
      try {
        window.sessionStorage.setItem(GIFT_RETURN_KEY, fromUrl);
      } catch {
        /* storage blocked: the URL still carries it */
      }
      setBack(fromUrl);
    } else {
      setBack(readKept());
    }
  }, [fromUrl]);

  if (!back) return null;
  return (
    <p className={`rounded-xl bg-frame px-4 py-3 text-[13.5px] text-ink shadow-sn-frame ${className}`} data-gift-return="">
      <Link href={back} onClick={forgetGiftReturn} className="font-semibold text-terracotta-700 underline underline-offset-2">
        {GIFT_RETURN_WORDS}
      </Link>
    </p>
  );
}
