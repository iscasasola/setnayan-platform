'use client';

/**
 * SupplierConnectPanel — the supplier's portal into Setnayan. (2026-09-21)
 *
 * Owner: "create a way for the user to give the vendor a portal to connect
 * this to their new account."
 *
 * The claim QR + link a self-added supplier scans to sign up. When they do,
 * `applyClaimAutoLink` stamps `marketplace_vendor_id` on the booking and the
 * couple's card seeds their first service (`buildCanvasInitialFromCoupleCard`)
 * — the price, inclusions and crew the couple recorded carry over, and the
 * supplier's card stops being self-added.
 *
 * ── EXTRACTED, NOT WRITTEN ────────────────────────────────────────────────
 * This UI lived inside the Add-manually sheet's post-save step, which is ONE
 * render: close the sheet and it was gone. That one-shot is what the owner hit
 * on 2026-09-20 ("i dont have access for this qr and link"). It now lives here
 * and is mounted twice — by that post-save step, and by the [Connect] button
 * on the supplier's card — so the portal is always one tap away and there is
 * one implementation of it.
 *
 * ⚠ LOOKING DOES NOT CREATE. `initial` is the result of `readSupplierInvite`,
 * a read. The only write is the "Create their link" button, which calls
 * `createManualVendorInvite` (idempotent). Opening [Connect] to check whether a
 * link exists must never mint one.
 */

import { useState, useTransition } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { useSaveLoader } from '@/components/sd-loader';
import { createManualVendorInvite, type SupplierInviteView } from '../vendors/actions';

export function SupplierConnectPanel({
  eventId,
  vendorId,
  vendorName,
  initial,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  /** An existing link, read without writing. Null → offer to create one. */
  initial?: SupplierInviteView;
}) {
  const [pending, startTransition] = useTransition();
  const [invite, setInvite] = useState<SupplierInviteView>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const save = useSaveLoader();

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  function create() {
    setErr(null);
    startTransition(async () => {
      const res = await save.run(() => createManualVendorInvite({ eventId, vendorId }), {
        steps: ['Creating their link'],
        hint: 'Saving',
      });
      if (res.ok) setInvite({ url: res.url, qrSvg: res.qrSvg });
      else setErr(res.error);
    });
  }

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is visible and selectable below.
    }
  }

  function share() {
    if (!invite) return;
    navigator
      .share({ title: `Join me on Setnayan, ${vendorName}!`, url: invite.url })
      .catch(() => {
        // Dismissed — nothing to do.
      });
  }

  return (
    <div className="rounded-xl border border-ink/10 bg-paper p-3">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink/65">
        Connect {vendorName} to Setnayan
      </p>

      {invite ? (
        <div className="sn-canvas-rise">
          <div className="mt-2 flex flex-col items-center gap-1.5 rounded-lg border border-ink/10 bg-cream p-3">
            <span
              role="img"
              aria-label={`QR code — ${vendorName} scans this to create their account`}
              className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
            />
            <p className="max-w-[15rem] text-center text-[10px] leading-snug text-ink/55">
              Show this to {vendorName} — they scan it to make their free account. Or send
              the link below.
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={invite.url}
              aria-label="Connect link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-ink/15 bg-cream px-3 py-2 font-mono text-[11px] text-ink/80 focus:border-terracotta focus:outline-none"
            />
            <button
              type="button"
              onClick={copy}
              aria-label="Copy connect link"
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/75 transition-colors hover:text-ink"
            >
              {copied ? (
                <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
              ) : (
                <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={share}
                aria-label="Share connect link"
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1 rounded-md border border-ink/15 bg-cream px-3 text-xs font-medium text-ink/75 transition-colors hover:text-ink"
              >
                <Share2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
                Share
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-ink/45">
            When they join through this link, everything you recorded — price, what&apos;s
            included, your payment plan — carries over to their account. Nothing is
            re-entered.
          </p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={create}
            disabled={pending}
            className="mt-2 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-mulberry/40 bg-mulberry/5 px-3.5 text-sm font-medium text-mulberry transition-colors hover:bg-mulberry/10 disabled:opacity-60"
          >
            <Share2 aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            {pending ? 'Creating…' : 'Create their link'}
          </button>
          <p className="mt-1.5 text-[10px] leading-snug text-ink/45">
            Not on Setnayan yet? When they join through your link, everything you recorded
            carries over — nothing is re-entered.
          </p>
        </>
      )}

      {err ? (
        <p role="alert" className="mt-1.5 text-[11px] text-danger-900">
          {err}
        </p>
      ) : null}
    </div>
  );
}
