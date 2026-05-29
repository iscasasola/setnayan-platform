'use client';

// ============================================================================
// ClaimLinkShare — copy-link CTA for the per-vendor workspace page.
//
// Renders the auto-share claim URL alongside a Copy button, plus a Web Share
// API fallback for mobile (where browsers expose native share sheet). The
// shared URL is the public /vendor/claim/[token] route which the vendor
// opens to register a free vendor account + auto-link to the host's
// event_vendors row via applyClaimAutoLink (in vendor-invite-actions.ts).
//
// Owner directive 2026-05-22: the host shares this link via whatever channel
// (Viber, Messenger, FB, SMS, email) — Setnayan doesn't automate delivery
// for the auto_share_link source. The Web Share API on mobile lets the host
// hit the native share sheet with one tap; desktop falls back to Copy.
// ============================================================================

import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';

type Props = {
  claimUrl: string;
  shareTitle: string;
  shareText: string;
};

export function ClaimLinkShare({ claimUrl, shareTitle, shareText }: Props) {
  const [copied, setCopied] = useState(false);

  // Detect Web Share API at runtime, NOT at render time — server doesn't
  // have navigator. Falls back to Copy when not available (desktop).
  const canNativeShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { share?: unknown }).share === 'function';

  function handleCopy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(claimUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // Clipboard write can fail on insecure context. The visible URL
        // remains selectable so the host can copy manually.
      },
    );
  }

  async function handleShare() {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: claimUrl,
      });
    } catch {
      // User cancelled the share sheet, or the platform rejected. No-op —
      // they can hit Copy as the explicit fallback.
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2 rounded-lg border border-amber-200/80 bg-white p-2">
        <code
          className="flex-1 self-center truncate text-xs text-ink/70"
          aria-label="Claim link"
        >
          {claimUrl}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-md border border-ink/10 bg-cream px-3 py-1.5 text-xs font-medium text-ink/80 transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          aria-label={copied ? 'Copied' : 'Copy claim link'}
        >
          {copied ? (
            <>
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Copy
            </>
          )}
        </button>
      </div>
      {canNativeShare ? (
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-amber-400/60 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <Share2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Share invite link
        </button>
      ) : null}
    </div>
  );
}
