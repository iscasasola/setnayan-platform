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
export function PrintToolbar({
  backHref,
  format = 'a3',
}: {
  backHref: string;
  /** Which sheet is on screen — only changes the hint text and the switch
   *  link's target/label. Defaults to 'a3' so existing callers (there were
   *  none passing this prop before the A4 booklet existed) keep behaving
   *  exactly as before. */
  format?: 'a3' | 'a4';
}): React.ReactElement {
  const otherFormat = format === 'a4' ? 'a3' : 'a4';
  const switchHref = otherFormat === 'a4' ? '?format=a4' : '?format=a3';
  return (
    <div className="keepsake-toolbar">
      <Link href={backHref} className="keepsake-toolbar-link" prefetch={false}>
        <ArrowLeft aria-hidden width={16} height={16} strokeWidth={1.75} />
        <span>Back to the story</span>
      </Link>
      <div className="keepsake-toolbar-actions">
        <span className="keepsake-toolbar-hint">
          {format === 'a4' ? 'Best printed A4 · one page per minute' : 'Best printed A3 · full page'}
        </span>
        <Link href={switchHref} className="keepsake-toolbar-link" prefetch={false}>
          <span>{otherFormat === 'a4' ? 'Switch to A4 booklet' : 'Switch to A3 sheet'}</span>
        </Link>
        <button type="button" className="keepsake-toolbar-print" onClick={() => window.print()}>
          <Printer aria-hidden width={16} height={16} strokeWidth={1.75} />
          <span>Print / Save as PDF</span>
        </button>
      </div>
    </div>
  );
}
