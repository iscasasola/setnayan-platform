'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { ReportPageButton } from '@/app/_components/report-page-button';

/**
 * PublicPageActions — the discreet floating chrome cluster for a PUBLIC event
 * page (social-share follow-through item #8). Two controls:
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
 * It's CHROME, kept out of the sacred hero: a small pill fixed to the bottom of
 * the viewport, low z-index so any cinematic Save-the-Date reveal overlay sits
 * on top of it until dismissed.
 */
export function PublicPageActions({
  canShare,
  reportTargetId,
  shareTitle,
  aboveMenuBar = false,
}: {
  canShare: boolean;
  reportTargetId: string;
  shareTitle: string;
  /**
   * Is a fixed bottom menu bar on this page? (PR11, 2026-08-05.)
   *
   * This pill sits at `bottom-4` — INSIDE the ~4rem footprint of the guest
   * site's bottom bar — and both are `z-30`, with the bar later in the DOM, so
   * it wins on paint order. Share and Report were drawn underneath it: tapping
   * Share hit whichever tab happened to be there. Lifted clear when a bar is
   * present, left where it is on every page that has none.
   */
  aboveMenuBar?: boolean;
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
    <>
      {/* 🔴 A FIXED PILL COVERS WHATEVER IS UNDER IT, AND NOTHING RESERVED ITS
          SPACE. Measured on the live invitation (2026-08-21, 375px): this bar
          sat over **85% of the "Sign up free" button** — `elementsFromPoint` at
          that button's centre returned SHARE — and over three-quarters of the
          wedding date on the hero. Two of the most consequential things on the
          page: the action that creates an account, and the single fact an
          invitation exists to convey.
          🪤 THE PREVIOUS FIX MOVED THE COLLISION RATHER THAN ENDING IT. The
          docblock above records the pill being lifted clear of the menu BAR —
          correct, and it landed it squarely on the CONTENT instead. Anything
          `fixed` needs its footprint reserved in the flow; lifting it just
          chooses a different victim.
          This is the pattern `site-menu-bar.tsx` already uses for its own bar:
          an in-flow, aria-hidden spacer the height of what floats above it.
          3.5rem clears the pill in both positions — stacked on top of the menu
          bar's own 3.5rem spacer when a menu is present, and standing alone
          when it is not. */}
      <div aria-hidden className="h-14 print:hidden" />
      <div
        className={`pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4 print:hidden ${
          aboveMenuBar
            ? 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))]'
            : 'bottom-4'
        }`}
      >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-ink/15 bg-cream/85 px-3 py-1.5 shadow-lg backdrop-blur">
        {canShare && (
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/75 hover:text-ink"
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
          className="inline-flex"
        />
        </div>
      </div>
    </>
  );
}
