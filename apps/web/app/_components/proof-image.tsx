/**
 * proof-image.tsx — ONE way a payment receipt is SHOWN.
 *
 * Owner, live on the payment run, 2026-09-20: *"when i upload a photo, i cannot
 * see it. it is too small. let's make it easy to see?"*
 *
 * A receipt is EVIDENCE. Every screen that renders one is a screen where a
 * person is deciding about money — the couple checking they attached the right
 * screenshot, the supplier pressing "Confirm deposit received", an admin ruling
 * on a refused deposit — and before this component four of those five screens
 * offered a text link saying "View proof" and nothing else. A link is not a
 * look: you cannot compare a reference number against a bank app in a new tab
 * you have to open, and on a phone that tab replaces the very button you were
 * about to press.
 *
 * 🔑 THE PATTERN IS NOT NEW — IT WAS SHIPPED ON ONE SCREEN AND NOWHERE ELSE.
 * `app/admin/payments/page.tsx` has rendered a `max-h-64 object-contain` image
 * inside a new-tab link, with "Open full size" under it, since the Setnayan
 * checkout reconciliation queue was built. This file is that markup, lifted
 * verbatim into one place so the other five surfaces get it too and none of
 * them can drift to a 48px thumbnail again.
 *
 * 🔒 PRIVACY IS THE CALLER'S JOB, AND IT ALREADY DOES IT. `url` must ALWAYS be
 * a short-lived presigned link produced by a scoped signer —
 * `depositProofDisplayUrl` (lib/deposit-proof.server.ts) or
 * `displayUrlForPrivateStoredAsset` under `paymentProofPolicy`. This component
 * never signs, never resolves, and never accepts a stored `r2://` value: it
 * takes the URL its caller was already allowed to hand a browser. Nothing here
 * makes a receipt public — see `lib/the-generic-signer-is-public-only.test.ts`
 * for why the generic signer must never be used on this class of file.
 *
 * Server-safe on purpose: no `'use client'`, no hooks, no `server-only` import,
 * so a server page (admin, the supplier's client page) and a client card (the
 * couple's "Amount to pay") can both mount the same picture.
 */
import { ExternalLink } from 'lucide-react';

/**
 * The legible size, as ONE string both the component and its guard read.
 *
 * ⚠ AN IMAGE THIS SMALL IS NOT A PREVIEW, IT IS A DOT. `h-12 w-12` — the
 * filename-row thumbnail this replaces — is 48 CSS pixels; a GCash receipt's
 * reference number is unreadable below roughly 200. `max-h-*` and not `h-*`:
 * a tall bank screenshot must shrink to fit and a small one must not be
 * stretched, which is also why `object-contain` and not `object-cover` (a crop
 * can hide the amount, and the amount is the whole point).
 */
export const PROOF_IMAGE_CLASS =
  'max-h-64 w-auto rounded-md border border-ink/10 object-contain';

export type ProofImageProps = {
  /** A short-lived presigned link. Never a stored `r2://` ref, never a raw URL. */
  url: string;
  /** What this receipt is, for a reader who cannot see it. */
  alt?: string;
  /** Extra classes on the wrapper — spacing only. */
  className?: string;
};

/**
 * A payment receipt, big enough to read, with a way to open it full size.
 *
 * Renders NOTHING for an empty url — a caller that failed to sign a link shows
 * no picture rather than a broken-image glyph, which is the same fail-soft
 * contract `depositProofDisplayUrl` already has.
 */
export function ProofImage({ url, alt = 'Payment proof', className }: ProofImageProps) {
  if (!url) return null;
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className={PROOF_IMAGE_CLASS} />
      </a>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-mulberry hover:underline"
      >
        Open full size
        <ExternalLink aria-hidden className="h-3 w-3" strokeWidth={1.75} />
      </a>
    </div>
  );
}
