'use client';

import { Download, QrCode } from 'lucide-react';
import { SaveFileLink } from '@/app/_components/save-file-link';

/**
 * guest-save-links.tsx — the guest list's two "save this file" buttons, as
 * CLIENT components.
 *
 * 🔑 WHY THIS FILE EXISTS. `SaveFileLink` takes its children as a FUNCTION of
 * its saving state (`(state) => …`). A function cannot cross from a server
 * component to a client component — React refuses to serialise it — so when
 * `roster-tabs.tsx` and `guest-detail-body.tsx` (both server components) wrote
 * `<SaveFileLink>{() => …}</SaveFileLink>` directly, the whole guest list
 * failed with "Functions cannot be passed directly to Client Components"
 * (production, digest 3329950423, 2026-09-27) whenever the QR-sheet door or a
 * branded guest QR was on screen. Every prop below is a plain string, so a
 * server component can render these safely; the render function lives here,
 * on the client side of the line.
 */

const DOOR =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink';

/** The free guest-QR PDF sheet — the roster's "QR codes" door. */
export function GuestQrPdfLink({ href, label }: { href: string; label: string }) {
  return (
    <SaveFileLink href={href} filename="guest-qr-codes.pdf" data-guest-qr-pdf="" title={label} className={DOOR}>
      {() => (
        <>
          <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          <span className="hidden sm:inline">{label}</span>
          <span className="sr-only sm:hidden">{label}</span>
        </>
      )}
    </SaveFileLink>
  );
}

/** One guest's branded QR PNG — the drawer's "Download QR". */
export function GuestQrDownloadLink({ href, filename }: { href: string; filename: string }) {
  return (
    <SaveFileLink
      href={href}
      filename={filename}
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/80 underline-offset-4 hover:text-terracotta-700 hover:underline"
    >
      {(state) => (
        <>
          <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {state === 'saving' ? 'Saving…' : 'Download QR'}
        </>
      )}
    </SaveFileLink>
  );
}
