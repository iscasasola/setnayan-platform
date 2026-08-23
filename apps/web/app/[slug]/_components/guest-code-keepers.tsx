'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';

/**
 * "Save the code" + "Copy link" — the two ways a guest takes their invitation
 * QR away with them.
 *
 * ONE component for all three surfaces that show a guest their code (the
 * invitation QR card, the My QR modal, the day-of hub's Me panel). They each
 * used to show the code and offer nothing; giving each its own pair of buttons
 * would be three chances to forget one, and the next surface would make four.
 *
 * The save is a plain anchor with `download` pointed at /api/guest/qr — the
 * same shape the host dashboard already uses for its branded PNG, so the
 * browser does the saving and no JavaScript is required for the half that
 * matters most. Only the clipboard needs a client.
 */
export function GuestCodeKeepers({
  invitationUrl,
  className,
}: {
  invitationUrl: string;
  className?: string;
}) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invitationUrl);
      } else {
        throw new Error('no clipboard');
      }
      setCopied('done');
      setTimeout(() => setCopied('idle'), 2500);
    } catch {
      // Say the copy failed. A button that silently does nothing reads as a
      // broken page, and the guest has no way to tell it apart from a success
      // — the address is still sitting right above it either way.
      setCopied('failed');
      setTimeout(() => setCopied('idle'), 4000);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <a
          href="/api/guest/qr"
          download
          className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-terracotta hover:text-terracotta-700"
        >
          <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Save the code
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-terracotta hover:text-terracotta-700"
        >
          {copied === 'done' ? (
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {copied === 'done' ? 'Copied' : 'Copy link'}
        </button>
      </div>
      {copied === 'failed' ? (
        <p role="alert" className="mt-2 text-xs text-ink/70">
          Couldn&rsquo;t copy it for you — the address above can be selected and copied by hand.
        </p>
      ) : (
        // Announced to a screen reader on success; the visible tick above is
        // the sighted equivalent.
        <p role="status" className="sr-only">
          {copied === 'done' ? 'Invitation link copied.' : ''}
        </p>
      )}
    </div>
  );
}
