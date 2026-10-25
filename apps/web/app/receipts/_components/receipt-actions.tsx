'use client';

import { useState } from 'react';
import { RECEIPT_ALT as ALT, RECEIPT_CTA } from './receipt-slip';

/**
 * Under the slip: Save as PDF (the browser's own print-to-PDF of the slip — no new service) and Share.
 *
 * SHARE = THIS RECEIPT'S OWN LINK (controller decision 2026-10-25: no public token). The receipt is owner-only by RLS,
 * so the link opens for the person who paid and nobody else — said in the confirmation, so nobody sends it to their
 * accountant believing it will open. The phone's share sheet when there is one, else the link is copied.
 */


export function SaveAsPdfButton() {
  return (
    <button type="button" onClick={() => window.print()} className={RECEIPT_CTA} data-receipt-action="pdf">
      Save as PDF
    </button>
  );
}

export function ShareReceiptButton({ title }: { title: string }) {
  const [said, setSaid] = useState<string | null>(null);
  const share = async () => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid('Link copied — only you can open it.');
    } catch {
      // A dismissed share sheet is not an error; a blocked clipboard is said, not swallowed.
      if (typeof navigator.share !== 'function') setSaid('Could not copy the link. Copy it from the address bar.');
    }
  };
  return (
    <span className="inline-flex flex-col items-center">
      <button type="button" onClick={share} className={ALT} data-receipt-action="share">
        Share
      </button>
      <span aria-live="polite" className="text-xs text-ink/60 empty:hidden">
        {said}
      </span>
    </span>
  );
}
