'use client';

import { useEffect, useState } from 'react';
import { openEventHub } from '@/lib/open-external';

/**
 * 🍎 "Open my ticket to add to Apple Wallet" — INSIDE THE SETNAYAN iOS APP ONLY (`AppleWalletLink.kind === 'sheet'`).
 *
 * The app's own web view cannot hand a `.pkpass` download to Wallet, so a plain link to the route would be a dead
 * tap. This opens the guest's OWN link in the app's in-app browser sheet (SFSafariViewController, through
 * `openEventHub` — the `@capacitor/browser` plugin), which signs them in there and shows their ticket with the
 * ordinary "Add to Apple Wallet", which Safari's sheet hands to Wallet.
 *
 * Drawn only once the page knows the sheet exists in this build (`Capacitor.isPluginAvailable('Browser')`): an app
 * build without it would fall back to navigating this same web view — back to a page with the same dead end — so it
 * shows nothing instead. Never a button with nothing behind it.
 */
export function AppleWalletSheetLink({ href, label, className }: { href: string; label: string; className: string }) {
  const [sheet, setSheet] = useState(false);
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; isPluginAvailable?: (n: string) => boolean } }).Capacitor;
    setSheet(Boolean(cap?.isNativePlatform?.() && cap.isPluginAvailable?.('Browser')));
  }, []);
  if (!sheet) return null;
  return (
    <a
      href={href}
      data-wallet-link="sheet"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        openEventHub(href);
      }}
    >
      {label}
    </a>
  );
}
