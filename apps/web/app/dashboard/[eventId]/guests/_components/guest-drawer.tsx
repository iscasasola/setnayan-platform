'use client';

/**
 * guest-drawer.tsx — the right slide-in QUICK-VIEW guest sheet (Living Roster
 * P1). Opening a roster row's quick-view no longer navigates to `/[guestId]`;
 * it slides this read-only sheet in over the roster. The full detail/edit route
 * STAYS (a "Open full details" link at the foot of the sheet) — this is the
 * in-context glance, that is the deep surface.
 *
 * READ-ONLY in P1: name, side/RSVP/role, a branded-style personal QR (decorative
 * SVG deterministically seeded from the guest's REAL `qr_token`), contact (moved
 * off the row), groups, plus-one, tier. Inline editing of these lands in P2.
 *
 * QR doorway (2026-07-15): the decorative SVG stays as the aesthetic preview, but
 * the section is now ACTIONABLE — every guest's REAL scannable QR is one tap away.
 * When the paid CUSTOM_QR_GUEST upgrade is active the drawer downloads the branded
 * PNG straight from the same gated /api/website/qr/guest/[guestId] route the
 * Invitation + Custom-QR surfaces use; otherwise it routes to the Invitation page,
 * where every guest's free default QR always renders. A quiet link reaches the
 * Custom-QR studio (default QR is always free; branding is the SKU).
 *
 * State is a module-level store (mirrors guest-selection-store.ts) so a row can
 * open the drawer without threading a context up to the page. ONE host is
 * mounted in page.tsx.
 */

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { ArrowRight, Download, Eye, QrCode, X } from 'lucide-react';
import { Drawer } from './overlay-primitives';
import {
  guestDisplayName,
  guestInitials,
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  type GuestRow,
} from '@/lib/guests';

const TITLE_ID = 'gl-guest-drawer-title';

// ── store ─────────────────────────────────────────────────────────────────

type DrawerPayload = { guest: GuestRow; groupLabels: string[] };

let state: DrawerPayload | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const guestDrawer = {
  open(guest: GuestRow, groupLabels: string[] = []) {
    state = { guest, groupLabels };
    emit();
  },
  close() {
    state = null;
    emit();
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  return state;
}

function useGuestDrawer(): DrawerPayload | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

// ── row trigger ───────────────────────────────────────────────────────────

/** The per-row quick-view affordance. Additive — the name Link to the full
 *  detail route is untouched. */
export function QuickViewButton({
  guest,
  groupLabels,
}: {
  guest: GuestRow;
  groupLabels: string[];
}) {
  return (
    <button
      type="button"
      onClick={() => guestDrawer.open(guest, groupLabels)}
      aria-label={`Quick view ${guestDisplayName(guest)}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/45 hover:bg-terracotta/10 hover:text-terracotta-700"
    >
      <Eye aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

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

// ── host ──────────────────────────────────────────────────────────────────

export function GuestDrawerHost({
  eventId,
  brandedQrActive = false,
}: {
  eventId: string;
  /** Paid CUSTOM_QR_GUEST upgrade admin-approved for this event → offer the
   *  branded PNG download directly (the gated route 403s otherwise, so a
   *  non-owner is routed to the Invitation page instead). */
  brandedQrActive?: boolean;
}) {
  const payload = useGuestDrawer();
  if (!payload) return null;
  const { guest, groupLabels } = payload;
  const name = guestDisplayName(guest);
  const contact = guest.email ?? guest.mobile ?? null;
  const qrFileName = `qr-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;

  return (
    <Drawer onClose={guestDrawer.close} labelledById={TITLE_ID}>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Guest
        </p>
        <button
          type="button"
          onClick={guestDrawer.close}
          aria-label="Close"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Identity */}
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-sm font-semibold text-terracotta-700">
          {guestInitials(guest)}
        </span>
        <div className="min-w-0">
          <h2 id={TITLE_ID} className="truncate text-xl font-semibold text-ink">
            {name}
          </h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <MiniChip>{SIDE_LABELS[guest.side]}</MiniChip>
            <MiniChip>{RSVP_LABELS[guest.rsvp_status]}</MiniChip>
          </div>
        </div>
      </div>

      {/* Personal QR — decorative preview + the real-QR doorway (2026-07-15). */}
      <div className="mb-4 rounded-2xl border border-ink/10 bg-ink/[0.02] p-3.5">
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

      {/* Contact — moved off the roster row into the quick view */}
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
        Contact
      </p>
      <p className="mb-4 text-sm text-ink/80">
        {contact ?? <span className="text-ink/40">No email or mobile yet</span>}
      </p>

      {/* Groups */}
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
        Groups
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {groupLabels.length > 0 ? (
          groupLabels.map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded-full bg-terracotta/10 px-2.5 py-0.5 text-xs text-terracotta-700"
            >
              {label}
            </span>
          ))
        ) : (
          <span className="text-sm text-ink/40">Not in any group yet</span>
        )}
      </div>

      {/* Details */}
      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/50">
        Details
      </p>
      <dl className="mb-5 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink/50">Role</dt>
          <dd className="text-ink/80">{ROLE_LABELS[guest.role]}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink/50">Plus-one</dt>
          <dd className="text-ink/80">
            {guest.plus_one_allowed
              ? `+ ${guest.plus_one_name ?? 'TBA'}`
              : 'None'}
          </dd>
        </div>
      </dl>

      <Link
        href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
        className="inline-flex w-full items-center justify-center rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/80 hover:border-terracotta/40 hover:text-terracotta-700"
      >
        Open full details
      </Link>
      <p className="mt-3 text-[11px] text-ink/40">
        The code above is a preview. Every guest&rsquo;s default QR is free —
        branding it with your colors is an upgrade.
      </p>
    </Drawer>
  );
}
