'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

/**
 * Share the vendor page. Uses the native share sheet where available
 * (mobile / Safari), else copies the URL to the clipboard with a brief
 * "Copied" confirmation. `url` is resolved on the client so it carries the
 * real host (works on the bare-root alias and custom domains).
 */
export function ShareButton({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no-op */
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
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Share
        </>
      )}
    </button>
  );
}
