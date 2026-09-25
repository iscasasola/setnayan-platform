'use client';

import { Download } from 'lucide-react';
import { CopyButton } from '@/app/_components/copy-button';
import { NfcWriteButton } from '@/app/_components/nfc-write-button';
import { SaveFileLink } from '@/app/_components/save-file-link';

/**
 * QrActions — the one control strip under every QR that is a link:
 * Download · Write to NFC · Copy link.
 *
 * Before this, each QR surface grew its own subset — the vendor Shortlist had
 * Download and Copy, a guest's card had Download, the website editor's
 * scan-to-view had neither. One strip means one place to add the next
 * control, and one guard (every-qr-carries-the-strip.test.ts) that says which
 * QRs carry it and which — the payment QRs — must not.
 *
 * `download` is optional: a row that only lists a link (the issued Locked QRs
 * list) has no image to save. `hideCopy` is for the one surface that already
 * renders the link in a copyable field beside it.
 *
 * The NFC button decides for itself whether to render (flag + link
 * eligibility), so a payment payload passed here by mistake gets Download and
 * Copy only — but the guard forbids mounting the strip on payment QRs at all.
 *
 * The Download control goes through SaveFileLink (2026-09-25, owner: a
 * download "should just save and not open a new page") rather than a bare
 * `<a download>` — see save-file-link.tsx for why a plain anchor is not
 * enough on iOS Safari / the Capacitor shell. This is a client component for
 * that reason; its two children already were.
 */
export function QrActions({
  url,
  download,
  hideCopy = false,
  className,
}: {
  url: string;
  download?: { href: string; filename: string; label?: string } | null;
  hideCopy?: boolean;
  className?: string;
}) {
  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      {download ? (
        <SaveFileLink
          href={download.href}
          filename={download.filename}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/75 hover:bg-ink/5"
        >
          {(state) => (
            <>
              <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              {state === 'saving' ? 'Saving…' : download.label ?? 'Download QR'}
            </>
          )}
        </SaveFileLink>
      ) : null}
      <NfcWriteButton url={url} />
      {hideCopy ? null : <CopyButton value={url} label="Copy link" />}
    </div>
  );
}
