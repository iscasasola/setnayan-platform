'use client';

import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';

/**
 * The two things a guest actually does with a gift method: copy the number, or
 * save the QR.
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * `PabuyaCardList` is deliberately presentational and carries NO 'use client':
 * it is rendered by the SERVER guest page AND by the couple's CLIENT dashboard
 * preview, and its docblock keeps it inert so those two cannot drift. Its own
 * comment already named the shape — "a route that wants it wraps the handle in
 * its own small client control". This is that control.
 *
 * 🔑 A SERVER COMPONENT MAY RENDER A CLIENT ONE. So the card stays inert and
 * the interactivity lives here, in the only file that ships JS. The guard on
 * the card (`no 'use client'`, `no onClick=`) keeps meaning what it says.
 *
 * ── WHY THE DOWNLOAD IS AN <a> AND NOT A HANDLER ───────────────────────────
 * Saving the QR needs no JavaScript: `/api/pabuya/qr/<id>?download=1` answers
 * with `Content-Disposition: attachment`, so a plain link saves the file with
 * a sensible name. That matters on a phone at a reception — a link works while
 * JS is still booting, and it survives a wallet browser that blocks scripts.
 * Only the clipboard genuinely needs a handler.
 *
 * ⚠ THE COPY BUTTON MUST NEVER LOOK LIKE IT WORKED WHEN IT DID NOT.
 * `navigator.clipboard` is undefined on an insecure origin and throws when the
 * document is not focused or permission is refused. A catch that silently
 * showed "Copied" would be the same lie this codebase keeps hunting: a failure
 * rendered as success. On failure the number is SELECTED instead, so the guest
 * can copy it by hand, and the label says so.
 */
export function PabuyaMethodActions({
  handle,
  qrUrl,
  label,
  handleElementId,
}: {
  /** The account number / wallet handle, or null when the method has none. */
  handle: string | null;
  /** Permanent QR route URL, or null when no image was uploaded. */
  qrUrl: string | null;
  /** The method's display label, used for the saved filename and a11y text. */
  label: string;
  /** id of the <p> holding the number, so a failed copy can select it. */
  handleElementId?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  async function copy() {
    if (!handle) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(handle);
      setState('copied');
      window.setTimeout(() => setState('idle'), 2000);
    } catch {
      // Select the digits so copying by hand is one gesture, and SAY so.
      if (handleElementId) {
        const el = document.getElementById(handleElementId);
        if (el) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }
      setState('manual');
    }
  }

  if (!handle && !qrUrl) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {handle ? (
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3.5 py-2 text-xs font-medium text-ink/80 transition hover:border-terracotta hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {state === 'copied' ? (
            <>
              <Check aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
              Copied
            </>
          ) : state === 'manual' ? (
            <>
              <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Selected — copy it
            </>
          ) : (
            <>
              <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Copy number
            </>
          )}
        </button>
      ) : null}

      {qrUrl ? (
        <a
          href={`${qrUrl}${qrUrl.includes('?') ? '&' : '?'}download=1`}
          /* `download` is belt-and-braces: the route already sends
             Content-Disposition: attachment, which is what actually works on
             iOS Safari where the attribute alone is unreliable. */
          download
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3.5 py-2 text-xs font-medium text-ink/80 transition hover:border-terracotta hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          aria-label={`Save the ${label} QR code to your photos`}
        >
          <Download aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Save QR
        </a>
      ) : null}
    </div>
  );
}
