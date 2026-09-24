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
import { ArrowRight, Download, QrCode } from 'lucide-react';
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

// ── decorative QR (seeded from the real qr_token) ──────────────────────────

/** Stable 32-bit hash of the guest's real qr_token → the QR pattern seed. This
 *  code is an aesthetic PREVIEW only (never scannable) — the guest's REAL QR is
 *  reached via the section's actions (branded PNG download when the upgrade is
 *  active, else the Invitation page). Seeding from the token keeps each guest's
 *  decorative code distinct and stable. */
function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function DecorativeQr({ token }: { token: string }) {
  const N = 13;
  const m = 7;
  const SZ = N * m;
  let r = (hashToken(token) + 7) >>> 0;
  const rnd = () => {
    r ^= r << 13;
    r >>>= 0;
    r ^= r >>> 17;
    r ^= r << 5;
    r >>>= 0;
    return r / 4294967296;
  };
  const inEye = (x: number, y: number) => {
    const e = (cx: number, cy: number) => x >= cx && x < cx + 3 && y >= cy && y < cy + 3;
    return e(0, 0) || e(N - 3, 0) || e(0, N - 3);
  };
  const cells: string[] = [];
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (inEye(x, y)) continue;
      if (rnd() > 0.5) cells.push(`M${x * m} ${y * m}h${m}v${m}h${-m}z`);
    }
  }
  const eye = (cx: number, cy: number) =>
    `M${cx * m} ${cy * m}h${3 * m}v${3 * m}h${-3 * m}z`;
  return (
    <svg
      viewBox={`-4 -4 ${SZ + 8} ${SZ + 8}`}
      width="96"
      height="96"
      className="shrink-0 rounded-lg border border-ink/10 bg-paper"
      aria-hidden
    >
      <path d={cells.join('')} fill="currentColor" className="text-terracotta-700" />
      <path
        d={`${eye(0, 0)} ${eye(N - 3, 0)} ${eye(0, N - 3)}`}
        fill="currentColor"
        className="text-terracotta-700"
      />
    </svg>
  );
}

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
  brandedQrActive = false,
}: {
  guest: GuestRow;
  eventId: string;
  invitationBase?: string | null;
  brandedQrActive?: boolean;
}) {
  const name = guestDisplayName(guest);
  const qrFileName = `qr-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  // Personal QR — decorative preview + the real-QR doorway (2026-07-15).
  return (
    <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-3.5">
    <div className="flex items-start gap-3">
      <DecorativeQr token={guest.qr_token} />
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
        download={
          brandedQrActive
            ? {
                href: `/api/website/qr/guest/${guest.guest_id}`,
                filename: qrFileName,
                label: 'Download QR',
              }
            : null
        }
      />
    ) : null}
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/[0.06] pt-3">
      {brandedQrActive ? (
        // Owner of the branded upgrade: one-click download of the REAL
        // palette-tinted PNG — same gated route the Invitation surface uses.
        <a
          href={`/api/website/qr/guest/${guest.guest_id}`}
          download={qrFileName}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/80 underline-offset-4 hover:text-terracotta-700 hover:underline"
        >
          <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Download QR
        </a>
      ) : (
        // No branded upgrade — the gated PNG would 403. Route to the
        // Invitation page, where every guest's free default scannable QR
        // renders (and can be re-issued / printed).
        <Link
          href={`/dashboard/${eventId}/invitation`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/80 underline-offset-4 hover:text-terracotta-700 hover:underline"
        >
          <QrCode aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          View scannable QR
        </Link>
      )}
      <Link
        href={`/dashboard/${eventId}/studio/custom-qr-guest`}
        className="inline-flex items-center gap-1 text-[13px] text-ink/55 underline-offset-4 hover:text-ink hover:underline"
      >
        Customize guest QRs
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      </Link>
    </div>
  </div>
  );
}
