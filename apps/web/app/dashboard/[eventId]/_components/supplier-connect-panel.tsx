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
 * strip.
 *
 * 📨 SHARE IS THE APPROVED INVITE (DECISION_LOG 2026-10-30, "…A SELF-ADDED SUPPLIER GETS A SHARE BUTTON, AN AUTOMATIC
 * CLAIM LINK AND A DIGITAL CARD"): the guest card's own share (`SupplierShareButton` → `shareInvite`) with the
 * approved message and their digital card — no longer the bare link. It is drawn on every device: where there is no
 * share sheet it copies the message, as the guest's Send does.
 *
 * ⚠ LOOKING DOES NOT CREATE. `initial` is the result of `readSupplierInvite`,
 * a read. The only write is the "Create their link" button, which calls
 * `createManualVendorInvite` (idempotent). Opening [Connect] to check whether a
 * link exists must never mint one.
 */

import { useId, useState, useTransition } from 'react';
import { Check, Copy, Share, Share2, X } from 'lucide-react';
import { SupplierShareButton } from './supplier-share-button';
import { InfoTip } from '@/app/_components/info-tip';
import { GuestPopup } from '../guests/_components/guest-popup';
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
  layout = 'panel',
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  /** An existing link, read without writing. Null → offer to create one. */
  initial?: SupplierInviteView;
  /**
   * 'top' — THE RECORD CARD'S HEAD, drawn like the guest ticket (Booked prototype v4, owner-approved 2026-10-29): the
   * QR small at the left (a tap shows it big, with Download), at the right the eyebrow + ⓘ, the three icon presses
   * Download · Copy link · Share, and the state line. Same reads, same one writer, same words — only the layout moves.
   * 'panel' (default) — the panel as it always was (the walk's last step, the card's Connect).
   */
  layout?: 'panel' | 'top';
}) {
  const [pending, startTransition] = useTransition();
  const [invite, setInvite] = useState<SupplierInviteView>(initial ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'failed'>('idle');
  const save = useSaveLoader();
  const words = claimLinkWords(vendorName);

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

  // ── THE CONTROLS (INTERACTION_RULES § 9, 2026-10-12) ──────────────────────
  // Every press is the one `ActionButton`; nothing read-only sits in a box
  // (owner 2026-10-11: "only have frames if something needs to be clicked") —
  // the heading, the words, the QR and the link sit on the sheet. The QR keeps
  // its white square in Dark: that is the code's own quiet zone (a scanner
  // needs light around dark modules), not a frame.
  if (layout === 'top') {
    return (
      <ConnectTop
        eventId={eventId}
        vendorId={vendorId}
        vendorName={vendorName}
        heading={words.heading}
        how={words.how}
        invite={invite}
        pending={pending}
        err={err}
        copied={copied}
        saved={saved}
        onCreate={create}
        onCopy={copy}
        onDownload={download}
      />
    );
  }

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
              icon={Share}
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
            <SupplierShareButton eventId={eventId} vendorId={vendorId} vendorName={vendorName} prepareOnMount />
          </div>
          {saved === 'failed' ? (
            <p role="alert" className="mt-1.5 text-center text-[12px] text-danger-800 dark:text-danger-200">
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
        <p role="alert" className="mt-1.5 text-[12px] text-danger-800 dark:text-danger-200">
          {err}
        </p>
      ) : null}
    </div>
  );
}

/** The record card's head — see `layout="top"` above. Presentation only; every press is the panel's own. */
function ConnectTop({
  eventId,
  vendorId,
  vendorName,
  heading,
  how,
  invite,
  pending,
  err,
  copied,
  saved,
  onCreate,
  onCopy,
  onDownload,
}: {
  eventId: string;
  vendorId: string;
  vendorName: string;
  heading: string;
  how: string;
  invite: SupplierInviteView;
  pending: boolean;
  err: string | null;
  copied: boolean;
  saved: 'idle' | 'saving' | 'failed';
  onCreate: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const [big, setBig] = useState(false);
  const titleId = useId();
  return (
    <div data-supplier-connect="" data-supplier-connect-top="" className="flex items-start gap-3">
      {invite ? (
        <button
          type="button"
          onClick={() => setBig(true)}
          aria-label={`Their QR — tap to see it big`}
          className="sn-press block h-[92px] w-[92px] shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-ink/10" // no-card-ok: the QR's quiet zone, pressable
        >
          <span aria-hidden className="block h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: invite.qrSvg }} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <InfoTip label={heading} labelClassName="sn-eye" align="start" ariaLabel="What the link does">
          {how}
        </InfoTip>
        {invite ? (
          <>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ActionButton
                tone="neutral"
                iconOnly
                icon={Share}
                label={saved === 'saving' ? 'Saving…' : 'Download the QR as a picture'}
                onClick={onDownload}
                disabled={saved === 'saving'}
              />
              <ActionButton tone="neutral" iconOnly icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy link'} onClick={onCopy} />
              <SupplierShareButton eventId={eventId} vendorId={vendorId} vendorName={vendorName} iconOnly prepareOnMount />
            </div>
            <p className="mt-1 text-[12px] text-ink/60">{copied ? 'Link copied' : 'Not joined yet'}</p>
            <p className="select-all break-all font-mono text-[11px] text-ink/55" aria-label="Their claim link" data-claim-link-url="">
              {invite.url.replace(/^https?:\/\//, '')}
            </p>
            {saved === 'failed' ? (
              <p role="alert" className="mt-1 text-[12px] text-danger-800 dark:text-danger-200">
                The picture could not be saved. Copy the link instead.
              </p>
            ) : null}
          </>
        ) : (
          /* The record card hands this a link that is already made (owner 2026-10-30: "create an automatic link"), so
             there is no "no link yet" state to draw — reaching here means it could not be made, and that is said. */
          <div role="alert" className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] font-medium text-danger-800 dark:text-danger-200">Their link is not ready yet.</p>
            <ActionButton tone="neutral" icon={Share2} label={pending ? 'Trying…' : 'Try again'} onClick={onCreate} disabled={pending} />
          </div>
        )}
        {err ? (
          <p role="alert" className="mt-1.5 text-[12px] text-danger-800 dark:text-danger-200">
            {err}
          </p>
        ) : null}
      </div>
      {big && invite ? (
        <GuestPopup
          onClose={() => setBig(false)}
          rootClassName="fixed inset-0 z-[96] flex items-center justify-center p-4"
          panelClassName="relative flex w-full max-w-[380px] flex-col items-center gap-3 rounded-3xl bg-cream p-4 shadow-[0_30px_80px_-30px_rgba(26,26,26,0.5)]"
          labelledById={titleId}
        >
          <div className="flex w-full items-center justify-between">
            <p id={titleId} className="sn-eye">
              {heading}
            </p>
            <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close" onClick={() => setBig(false)} />
          </div>
          <span
            role="img"
            aria-label={`QR code — ${vendorName} scans this to create their account`}
            className="block aspect-square w-full max-w-[300px] rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" // no-card-ok: the QR's quiet zone
            dangerouslySetInnerHTML={{ __html: invite.qrSvg }}
          />
          <p className="text-center text-xs text-ink/55">{vendorName} scans this to create their account</p>
          <ActionButton
            tone="brand"
            main
            icon={Share}
            label={saved === 'saving' ? 'Saving…' : 'Download'}
            name="Download the QR as a picture"
            onClick={onDownload}
            disabled={saved === 'saving'}
            className="w-full"
          />
        </GuestPopup>
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
