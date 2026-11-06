'use client';

import { openEventHub } from '@/lib/open-external';

/**
 * OpenFileLink — a file that lives on R2 behind a PRESIGNED URL (a contract PDF, a chat attachment, a rendered video,
 * a memory) and is opened to look at, then kept.
 *
 * 🐞 Owner, 2026-10-27 (iPhone app): a file link *"opened the file with no close button and it did not download"*.
 * In the app's web view a bare `<a href={r2Url} download>` / `target="_blank"` RENDERS the file in the app's only view
 * — the `download` attribute is ignored cross-origin — and there is no way back.
 *
 * In the iOS / Android app the tap opens the file in the IN-APP BROWSER SHEET (SFSafariViewController / Custom Tabs,
 * through `openEventHub` in `lib/open-external.ts`): it shows PDFs, video and images itself, has "Done" to return to
 * exactly where the person was, and its Share button saves the file or opens it in another app. A presigned URL needs
 * no session and no CORS, so the sheet — which keeps its own cookies — can open it.
 *
 * On the web and the desktop app nothing changes: the anchor's own `href` / `target` / `download` do what they did.
 *
 * NOT for a same-origin route or a `data:` URI — those need the signed-in session or are not a URL a sheet can open;
 * they go through `SaveFileLink`.
 */
export function OpenFileLink({
  href,
  children,
  ...rest
}: { href: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick' | 'children'>) {
  return (
    <a
      {...rest}
      href={href}
      data-open-file=""
      onClick={(e) => {
        const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
        if (!cap?.isNativePlatform?.()) return; // the web: the link's own behaviour
        e.preventDefault();
        openEventHub(href);
      }}
    >
      {children}
    </a>
  );
}
