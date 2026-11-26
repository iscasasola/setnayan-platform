'use client';

import { useState } from 'react';
import { Check, Share } from 'lucide-react';
import { shareableShopUrl } from '@/lib/shop-back';
import { useToast } from '@/app/_components/toast/toast-provider';

/** A share that could neither open the share sheet nor copy (final check A1-127): said, with the way to try again. */
export const SHARE_FAILED_MESSAGE = 'Couldn’t copy the link on this device. Press Share to try again.';

/**
 * Share the vendor page. Uses the native share sheet where available
 * (mobile / Safari), else copies the URL to the clipboard with a brief
 * "Copied" confirmation. `url` is resolved on the client so it carries the
 * real host (works on the bare-root alias and custom domains).
 */
export function ShareButton({
  title,
  className,
  iconOnly = false,
}: {
  title: string;
  className?: string;
  /** Only the icon on screen (the shop page's top bar); the word stays the button's name for a screen reader. */
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function onShare() {
    // The shop page — never where THIS visitor came from (`?src=` / `?event=`): a friend's copy is a fresh arrival.
    const url = typeof window !== 'undefined' ? shareableShopUrl(window.location.href) : '';
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, url });
        return;
      } catch (e) {
        // The person closed the share sheet: that is their answer, not a failure.
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // The share itself failed — fall through to copy.
      }
    }
    // 🔒 A press always ends in a result the person can see (A1-127): copied, or a plain reason. A phone with no
    // clipboard used to show "Copied" for a copy that never happened; a refused copy did nothing at all.
    try {
      if (!nav?.clipboard?.writeText || !url) throw new Error('no clipboard');
      await nav.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(SHARE_FAILED_MESSAGE);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-xl border border-ink/15 px-4 py-2 text-sm font-medium text-ink/80 transition-colors hover:border-terracotta/40 hover:text-terracotta'
      }
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
          {iconOnly ? <span className="sr-only">Copied</span> : 'Copied'}
        </>
      ) : (
        <>
          <Share className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          {iconOnly ? <span className="sr-only">Share</span> : 'Share'}
        </>
      )}
    </button>
  );
}
