'use client';

import { useState } from 'react';
import { saveImageToDevice } from '@/lib/save-to-device';

export type SaveFileState = 'idle' | 'saving';

/**
 * SaveFileLink — the one safe way this app hands the visitor a same-origin
 * file: a QR PNG, the guest list's QR-codes PDF, anything served with a
 * `Content-Disposition: attachment` on the other end.
 *
 * ── WHY A PLAIN `<a download>` WASN'T ENOUGH ────────────────────────────────
 * Owner, 2026-09-25, on the Guest list: *"When we try to download the QR
 * code, when that button is pressed. it should just save and not open a new
 * page."* A bare `<a href download>` is enough on most desktop browsers, but
 * iOS Safari and the Capacitor iOS shell can both ignore the `download`
 * attribute on a same-origin GET and just navigate to (render) the file
 * instead — which is exactly "opens a new page" from the chair holding the
 * phone. fetch → blob → object-URL (`saveImageToDevice`, already shipped for
 * Papic photo saves) sidesteps that, and prefers the native share sheet
 * ("Save to Photos" / "Save file") on a device that can share a File but has
 * no silent write to Downloads.
 *
 * `href` + `download` stay on the anchor as a working fallback for the instant
 * before hydration and for anyone browsing with scripting off; `onClick`
 * takes over — and calls `preventDefault` — the moment it can, so the browser
 * never gets to navigate.
 *
 * Deliberately NOT a `<Link>`: this is a FILE, never a route Next should try
 * to own client-side (see roster-doors.test.ts, "the tab row renders it as a
 * DOWNLOAD, not a navigation").
 */
export function SaveFileLink({
  href,
  filename,
  className,
  children,
  ...rest
}: {
  href: string;
  filename: string;
  className?: string;
  /** Render prop so the caller can swap icon/label while saving. */
  children: (state: SaveFileState) => React.ReactNode;
} & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'download' | 'onClick' | 'className' | 'children'
>) {
  const [state, setState] = useState<SaveFileState>('idle');
  return (
    <a
      {...rest}
      href={href}
      download={filename}
      aria-busy={state === 'saving' || undefined}
      className={className}
      onClick={async (e) => {
        e.preventDefault();
        if (state === 'saving') return;
        setState('saving');
        await saveImageToDevice(href, filename);
        setState('idle');
      }}
    >
      {children(state)}
    </a>
  );
}
