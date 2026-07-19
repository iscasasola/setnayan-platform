'use client';

import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

/**
 * Screen-only toolbar for the A3 broadsheet print keepsake. Hidden under
 * `@media print` (the `.keepsake-toolbar` class is display:none in the sheet's
 * print stylesheet), so it never appears on the printed page / PDF.
 *
 * The ONLY interactive script on the whole route: `window.print()` opens the
 * browser's Print / Save-as-PDF dialog. Everything else on the page is pure
 * server-rendered static markup.
 */
export function PrintToolbar({ backHref }: { backHref: string }): React.ReactElement {
  return (
    <div className="keepsake-toolbar">
      <Link href={backHref} className="keepsake-toolbar-link" prefetch={false}>
        <ArrowLeft aria-hidden width={16} height={16} strokeWidth={1.75} />
        <span>Back to the story</span>
      </Link>
      <div className="keepsake-toolbar-actions">
        <span className="keepsake-toolbar-hint">Best printed A3 · full page</span>
        <button type="button" className="keepsake-toolbar-print" onClick={() => window.print()}>
          <Printer aria-hidden width={16} height={16} strokeWidth={1.75} />
          <span>Print / Save as PDF</span>
        </button>
      </div>
    </div>
  );
}
