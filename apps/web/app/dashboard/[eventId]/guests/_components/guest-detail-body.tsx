/**
 * guest-detail-body.tsx — the guest's personal QR card.
 *
 * ── Why the filename says "detail body" ─────────────────────────────────────
 * It used to hold `GuestDetailBody`, the read-only quick view that two frames
 * rendered. On 2026-09-22 the quick view and the edit form merged into one card
 * (`guest-card-body.tsx`) and that component was deleted; what is left is the
 * QR doorway the card renders near the top.
 *
 * 🔑 THE PATH IS LOad-BEARING, so it did not get a tidier name.
 * `app/_components/every-qr-carries-the-strip.test.ts` keys its per-file mount
 * baseline on this exact path. Renaming the file for neatness would move a
 * guard's anchor and prove nothing; see CLAUDE.md on guards pinned to paths.
 */

import Link from 'next/link';
import { ArrowRight, QrCode } from 'lucide-react';
import { RemoveGuestConfirm } from './remove-guest-confirm';
import {
  guestDisplayName,
  guestInitials,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  type GuestRow,
  plusOneSeats,
} from '@/lib/guests';
import { QrActions } from '@/app/_components/qr-actions';
import { GuestQrDownloadLink } from './guest-save-links';

// ── chips ─────────────────────────────────────────────────────────────────

function MiniChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-ink/10 bg-ink/[0.03] px-2 py-0.5 text-xs text-ink/70">
      {children}
    </span>
  );
}

// ── body ────────────────────────────────────────────────────────────────────

/**
 * GuestQrCard — the guest's personal QR and the one control strip, extracted
 * 2026-09-22 so the merged guest card and this quick-view body render the SAME
 * doorway rather than two that can drift.
 *
 * 🔑 IT STAYS IN THIS FILE ON PURPOSE. `every-qr-carries-the-strip.test.ts`
 * counts the strip's mounts PER FILE and expects exactly one here; moving this
 * component to a module of its own would move that baseline entry for no gain.
 *
 * 🪤 And do not write the element's name with its opening angle bracket in any
 * comment in this file: that guard counts the raw string and does NOT strip
 * comments, so prose about the mount reads to it as a second mount.
 */
export function GuestQrCard({
  guest,
  eventId,
  invitationBase,
  sendSlot,
}: {
  guest: GuestRow;
  eventId: string;
  invitationBase?: string | null;
  /** Send invite · Copy message (owner 2026-09-29), drawn under the strip —
   *  "the thing you send them" and the way to send it, in one place. */
  sendSlot?: React.ReactNode;
}) {
  const name = guestDisplayName(guest);
  const qrFileName = `qr-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  // The SAME route Download uses below (2026-09-25, owner: the drawer's QR
  // "is not real... it should already be the real QR"). Until 2026-09-25 this
  // slot held a decorative pattern seeded from a hash of the token — visually
  // guest-distinct, but never encoding anything, so scanning it did nothing.
  // An <img> of the PNG route is trivially the same generator and the same
  // payload as the download: it IS the download, rendered inline. The route
  // draws every member's guest in the event's LOOK (lib/qr-look.ts — the
  // Setnayan mark, or the couple's own on Event Hub Pro) and gates on nothing
  // but membership, so a token this component was handed is a code that exists;
  // there is no "not yet".
  const qrImageSrc = `/api/website/qr/guest/${guest.guest_id}`;
  return (
    <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-3.5">
    <div className="flex items-start gap-3">
      {guest.qr_token ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own gated API route, not an optimizable static asset; same bytes as Download.
        <img
          src={qrImageSrc}
          alt={`${name}'s real, scannable QR — opens their invitation`}
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 rounded-lg border border-ink/10 bg-white object-contain p-1"
        />
      ) : (
        // Plain text, no border — a fallback message is not a card
        // (lint:no-card). The h-24/w-24 footprint matches the <img> above it
        // so the row does not jump when a code shows up.
        <div
          role="status"
          className="flex h-24 w-24 shrink-0 items-center justify-center p-2 text-center text-[10px] leading-tight text-ink/50"
        >
          No QR code yet
        </div>
      )}
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
          Personal QR
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink/70">
          Opens {guest.first_name}&rsquo;s own page — invitation &amp; RSVP,
          their tagged gallery, and find-my-seat.
        </p>
      </div>
    </div>
    {invitationBase ? (
      // Download · Write to NFC · Copy link — the same strip every other QR
      // surface carries, on the guest's OWN link.
      <QrActions
        className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink/[0.06] pt-3"
        url={`${invitationBase}?invite=${guest.qr_token}`}
        download={{
          href: qrImageSrc,
          filename: qrFileName,
          label: 'Download QR',
        }}
      />
    ) : null}
    {sendSlot}
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/[0.06] pt-3">
      {/* One-click download of the REAL PNG — the same route the Invitation
          surface uses, and the same one the preview above is an <img> of. Goes
          through SaveFileLink (2026-09-25) rather than a bare `<a download>` —
          see save-file-link.tsx: iOS Safari / the Capacitor shell can ignore
          `download` on a same-origin GET and open the file as a page instead of
          saving it, which is the exact bug the owner reported. No ownership
          branch any more: the route draws every guest in the event's look. */}
      <GuestQrDownloadLink href={qrImageSrc} filename={qrFileName} />
      <Link
        href={`/dashboard/${eventId}/invitation`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/80 underline-offset-4 hover:text-terracotta-700 hover:underline"
      >
        <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        All guest QRs
      </Link>
      <Link
        // Shape · pattern · colour · your logo live beside the Event Hub address
        // on the Maker's Details page (Event Hub Pro).
        href={`/dashboard/${eventId}/launch?tool=details&item=qr`}
        className="inline-flex items-center gap-1 text-[13px] text-ink/55 underline-offset-4 hover:text-ink hover:underline"
      >
        Customize guest QRs
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      </Link>
    </div>
  </div>
  );
}
