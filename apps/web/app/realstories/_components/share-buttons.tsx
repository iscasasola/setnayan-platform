'use client';

import { useState } from 'react';
import { Link2, Check } from 'lucide-react';

/**
 * ShareButtons — one-tap sharing for a Real Story editorial.
 *
 * WHY (owner 2026-06-14, "shareable so vendors and customers can share on their
 * facebook"): couples share out of pride and vendors share for social proof —
 * both drive traffic back to /realstories. Each target opens a share dialog
 * pointed at the editorial's canonical URL; the rich Facebook/Pinterest preview
 * comes from that page's `og:image` (the 1200×630 card from
 * /api/og/realstory/[slug]). The card deep-links to the exact story, so a click
 * bounces straight into the editorial — not a bare link.
 *
 * Facebook = the headline target; Pinterest is included because wedding
 * inspiration lives there (long-tail referral); Copy link covers Messenger /
 * Viber / IG-DM where there's no web share intent. Reusable: the couple's own
 * /[slug] editorial and the vendor "share to your Page" surface drop this same
 * component in.
 */
export function ShareButtons({
  url,
  title,
  image,
  compact = false,
}: {
  /** Absolute canonical URL of the editorial — what gets shared + crawled. */
  url: string;
  /** Share text / Pinterest description. */
  title: string;
  /** Absolute og:image URL — Pinterest pins this directly. */
  image?: string;
  /** Inline icon-only variant — sized to sit in the editorial dateline (where
   *  "Priceless" was) instead of a full row of labelled pills. */
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const pinHref =
    `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}` +
    (image ? `&media=${encodeURIComponent(image)}` : '') +
    `&description=${encodeURIComponent(title)}`;

  function openShare(href: string) {
    window.open(href, '_blank', 'noopener,noreferrer,width=600,height=640');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permission) — no-op; the FB +
      // Pinterest paths still work.
    }
  }

  // Compact dateline variant — a small "Share" word + three icon-only buttons,
  // matching the masthead's mono dateline so it can replace "Priceless".
  if (compact) {
    const iconBtn =
      'inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/55 transition-colors hover:bg-ink/5 hover:text-terracotta';
    return (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink/45">
          Share
        </span>
        <button
          type="button"
          onClick={() => openShare(fbHref)}
          aria-label="Share this story on Facebook"
          className={iconBtn}
        >
          <FacebookGlyph />
        </button>
        <button
          type="button"
          onClick={() => openShare(pinHref)}
          aria-label="Save this story to Pinterest"
          className={iconBtn}
        >
          <PinterestGlyph />
        </button>
        <button
          type="button"
          onClick={copyLink}
          aria-label="Copy link to this story"
          aria-live="polite"
          className={iconBtn}
        >
          {copied ? (
            <Check aria-hidden className="h-3 w-3 text-emerald-600" strokeWidth={2} />
          ) : (
            <Link2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
          )}
        </button>
      </span>
    );
  }

  const pill =
    'inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3.5 text-xs font-medium text-ink transition-colors hover:border-terracotta/40 hover:text-terracotta';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
        Share
      </span>
      <button
        type="button"
        onClick={() => openShare(fbHref)}
        aria-label="Share this story on Facebook"
        className={pill}
      >
        <FacebookGlyph />
        Facebook
      </button>
      <button
        type="button"
        onClick={() => openShare(pinHref)}
        aria-label="Save this story to Pinterest"
        className={pill}
      >
        <PinterestGlyph />
        Pinterest
      </button>
      <button
        type="button"
        onClick={copyLink}
        aria-label="Copy link to this story"
        aria-live="polite"
        className={pill}
      >
        {copied ? (
          <Check aria-hidden className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
        ) : (
          <Link2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}

// Facebook brand glyph (newer lucide dropped brand icons). Inherits
// currentColor so it picks up the pill's hover-terracotta.
function FacebookGlyph() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5"
    >
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

// Pinterest brand glyph (lucide has no Pinterest icon). Inherits currentColor
// so it picks up the pill's hover-terracotta like the lucide icons.
function PinterestGlyph() {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.06 2.42 7.55 5.9 9.11-.08-.77-.15-1.96.03-2.8.17-.74 1.07-4.7 1.07-4.7s-.27-.55-.27-1.36c0-1.27.74-2.22 1.66-2.22.78 0 1.16.59 1.16 1.29 0 .79-.5 1.96-.76 3.05-.21.92.46 1.67 1.36 1.67 1.64 0 2.9-1.73 2.9-4.22 0-2.21-1.59-3.75-3.86-3.75-2.63 0-4.17 1.97-4.17 4.01 0 .79.3 1.64.69 2.1.07.09.08.17.06.26-.07.29-.23.92-.26 1.05-.04.17-.14.21-.32.12-1.2-.56-1.94-2.3-1.94-3.7 0-3.01 2.19-5.78 6.31-5.78 3.31 0 5.89 2.36 5.89 5.51 0 3.29-2.08 5.94-4.96 5.94-.97 0-1.88-.5-2.19-1.1l-.6 2.27c-.21.84-.8 1.89-1.19 2.53.9.28 1.84.43 2.83.43 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  );
}
