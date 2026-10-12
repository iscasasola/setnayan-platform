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
 * ── THE WORDS AND THE TWO BUTTONS ARE THE APPROVED PROTOTYPE'S (2026-10-10) ──
 * `prototypes/suppliers_add_your_own_2026-10-10.html`, "Their claim link":
 * the QR, the link, **Download · Copy link**, and the sentence that the
 * supplier fills in THEIR OWN card and price, starting from what the couple
 * wrote. (The line it replaces promised that the price "carries over … nothing
 * is re-entered", which the owner's 2026-10-10 ruling makes untrue: the
 * supplier's price box waits for their photo and what's included.) No "Write
 * to NFC" here (build plan, 2026-10-07 late), so this is NOT the `QrActions`
 * strip. Share stays where the phone offers it — it shipped, and it is how a
 * link reaches Viber or Messenger in one tap.
 *
 * ⚠ LOOKING DOES NOT CREATE. `initial` is the result of `readSupplierInvite`,
 * a read. The only write is the "Create their link" button, which calls
 * `createManualVendorInvite` (idempotent). Opening [Connect] to check whether a
 * link exists must never mint one.
 */

import { useState, useTransition } from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { useSaveLoader } from '@/components/sd-loader';
import { ActionButton } from '@/components/action-button';
import { shareBlobToDevice } from '@/lib/save-to-device';
import { claimLinkWords } from '@/lib/add-your-own';
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
  const [saved, setSaved] = useState<'idle' | 'saving' | 'failed'>('idle');
  const save = useSaveLoader();
  const words = claimLinkWords(vendorName);

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

  /** The QR as a PICTURE (PNG) — what a chat app can show, drawn from the SVG in hand. */
  async function download() {
    if (!invite || saved === 'saving') return;
    setSaved('saving');
    const blob = await qrSvgToPng(invite.qrSvg);
    const result = blob ? await shareBlobToDevice(blob, words.fileBase) : 'failed';
    setSaved(result === 'failed' ? 'failed' : 'idle');
  }

  function share() {
    if (!invite) return;
    navigator
      .share({ title: `Join me on Setnayan, ${vendorName}!`, url: invite.url })
      .catch(() => {
        // Dismissed — nothing to do.
      });
  }

  // ── THE CONTROLS (INTERACTION_RULES § 9, 2026-10-12) ──────────────────────
  // Every press is the one `ActionButton`; nothing read-only sits in a box
  // (owner 2026-10-11: "only have frames if something needs to be clicked") —
  // the heading, the words, the QR and the link sit on the sheet. The QR keeps
  // its white square in Dark: that is the code's own quiet zone (a scanner
  // needs light around dark modules), not a frame.
  return (
    <div data-supplier-connect="">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-ink/65">{words.heading}</p>
      <p className="mt-1 text-[13px] leading-snug text-ink/65">{words.how}</p>

      {invite ? (
        <div className="sn-canvas-rise">
          <div className="mt-3 flex justify-center">
            <span
              role="img"
              aria-label={`QR code — ${vendorName} scans this to create their account`}
              className="block h-44 w-44 rounded-md bg-white p-2 [&>svg]:h-full [&>svg]:w-full" // no-card-ok: the QR's quiet zone, not a frame
              dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
            />
          </div>
          <p
            className="mt-2 select-all break-all text-center font-mono text-[11.5px] text-ink/70"
            aria-label="Their claim link"
            data-claim-link-url=""
          >
            {invite.url.replace(/^https?:\/\//, '')}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <ActionButton
              tone="neutral"
              icon={Download}
              label={saved === 'saving' ? 'Saving…' : 'Download'}
              name="Download the QR as a picture"
              onClick={download}
              disabled={saved === 'saving'}
            />
            <ActionButton
              tone="neutral"
              icon={copied ? Check : Copy}
              label={copied ? 'Copied' : 'Copy link'}
              onClick={copy}
            />
            {canShare ? (
              <ActionButton tone="neutral" icon={Share2} label="Share" name="Share their link" onClick={share} />
            ) : null}
          </div>
          {saved === 'failed' ? (
            <p role="alert" className="mt-1.5 text-center text-[12px] text-danger-800">
              The picture could not be saved. Copy the link instead.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <ActionButton
            tone="brand"
            main
            icon={Share2}
            label={pending ? 'Creating…' : 'Create their link'}
            onClick={create}
            disabled={pending}
          />
        </div>
      )}

      {err ? (
        <p role="alert" className="mt-1.5 text-[12px] text-danger-800">
          {err}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The QR's SVG drawn onto a canvas and handed back as a PNG — a picture a chat
 * app shows inline, which an .svg is not. Null when the browser cannot draw it;
 * the caller then says so instead of pretending a file was saved.
 */
async function qrSvgToPng(svg: string, size = 720): Promise<Blob | null> {
  try {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('qr image failed to load'));
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}
