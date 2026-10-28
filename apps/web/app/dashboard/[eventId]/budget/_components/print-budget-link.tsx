'use client';

import type { ReactNode } from 'react';

/**
 * 🖨 "Print budget" — the print page (`/api/budget/<id>/export`, HTML, signed-in only).
 *
 * Owner 2026-10-28, asked how it should open in the app: *"signed in"*. On the web it opens in a new tab, as it always
 * has. In the iPhone / Android app it opens in the app's OWN view (`location.assign`), which carries the person's
 * session — NOT the in-app browser sheet (`openEventHub`), which keeps its own cookies and would answer "Sign in". The
 * page's bar leads with "‹ Done" back to Budget (`budgetExportHtml`'s `backHref`), since the app's view has no browser
 * chrome of its own.
 */
export function PrintBudgetLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className={className}
      data-print-budget=""
      onClick={(e) => {
        const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
        if (!cap?.isNativePlatform?.()) return; // the web: a new tab
        e.preventDefault();
        window.location.assign(href);
      }}
    >
      {children}
    </a>
  );
}
