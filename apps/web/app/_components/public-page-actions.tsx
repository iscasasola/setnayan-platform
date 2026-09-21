'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { ReportPageButton } from '@/app/_components/report-page-button';

/**
 * PublicPageActions — Share and Report, in a quiet FOOTER at the very end of a
 * PUBLIC event page (social-share follow-through item #8). Two controls:
 *
 *   • Share (only when `canShare`) — ONE tap: the native share sheet
 *     (navigator.share) on mobile, a copy-link fallback everywhere else. URL-
 *     share only; the shared artifact is the couple's page UNBRANDED (no "made
 *     with Setnayan" watermark on the hero/monogram — brand rule #4). Rendered
 *     ONLY when the event is effectively public (the couple launched their
 *     Save-the-Date); never on a private/unlisted page.
 *   • Report this page — always present here so a public invitation page carries
 *     an abuse-report path (the prerequisite the share button was gated on).
 *
 * 🔑 A PLACE AT THE BOTTOM, NOT A PILL OVER THE PAGE (owner 2026-09-21: "make
 * a place at the bottom for report and share"). It used to float, fixed to the
 * viewport, and every fix to that moved the collision instead of ending it —
 * over the menu bar, then over "Sign up free" and the wedding date. In the flow
 * it covers nothing and needs no spacer: it is simply the last thing on the
 * page, where a reader who has seen everything looks for what to do next.
 */
export function PublicPageActions({
  canShare,
  reportTargetId,
  shareTitle,
  clearOfMenuBar = false,
}: {
  canShare: boolean;
  reportTargetId: string;
  shareTitle: string;
  /**
   * Is the fixed bottom menu bar on this page? It covers the last ~3.5rem of
   * the viewport, so the page's LAST element has to carry that much room
   * beneath it or the bar sits on top of it at full scroll. This footer is
   * that last element, so it carries the room. The bar is hidden from `xl`
   * up, and so is the room.
   */
  clearOfMenuBar?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    // The exact page the visitor is on — correct across custom domains and the
    // /u/ nesting scheme, minus any transient query (e.g. ?phase=).
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : '';
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;

    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title: shareTitle, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to copy.
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — nothing else to do */
    }
  }

  return (
    <footer
      aria-label="Share or report this page"
      className={`mx-auto mt-16 max-w-md border-t border-ink/10 px-4 pt-4 text-center print:hidden ${
        clearOfMenuBar
          ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] xl:pb-8'
          : 'pb-8'
      }`}
    >
      <div className="flex min-h-[44px] items-center justify-center gap-5">
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium text-ink/70 hover:text-ink"
            aria-label="Share this invitation"
          >
            {copied ? (
              <>
                <Check aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
                Link copied
              </>
            ) : (
              <>
                <Share2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Share
              </>
            )}
          </button>
        )}
        {canShare && <span aria-hidden className="h-3 w-px bg-ink/15" />}
        <ReportPageButton
          targetType="event"
          targetId={reportTargetId}
          label="Report"
          className="inline-flex min-h-[44px] items-center"
        />
      </div>
    </footer>
  );
}
