/**
 * guest-detail-body.tsx — the SHARED guest quick-view body (Inspector P2).
 *
 * ONE body, two frames. The identity block, the branded/default personal-QR
 * doorway (#3262), contact, groups, and details all live here so the two frames
 * that present a guest render byte-identical content + actions:
 *
 *   • the ≥sm / below-xl right slide-in SHEET     (guest-drawer.tsx · Drawer)
 *     — NOT reachable on a phone; its only trigger renders in the `sm:block`
 *     desktop table. See the reach note at the top of guest-drawer.tsx.
 *   • the desktop ≥xl sticky INSPECTOR COLUMN     (guests/page.tsx · server)
 *
 * No client hooks of its own — so it renders happily inside a Server Component
 * (the inspector body is server-rendered from `?inspect=<guestId>`) AND inside
 * the client Drawer. The frame owns its own header/close affordance; this body
 * starts at the identity block. RA-10173 honesty: this renders exactly the
 * fields the P1 quick-view already showed — no new guest data is surfaced.
 *
 * IT CAN NOW ACT, NOT ONLY SHOW (2026-09-06). Every OTHER guest surface can
 * remove somebody — the desktop bulk bar, both phone densities' swipe, and the
 * `[guestId]` page's "Remove guest". This was the one place a host could open a
 * guest, read everything about them, and have no way to act: the only exit was
 * "Open full details", i.e. leave the roster you were working in. It posts the
 * SAME `softDeleteGuest` the full page posts — the RSVP-set gate and the couple
 * block live in that action, so this adds a door, not a second rule.
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
} from '@/lib/guests';

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

export function GuestDetailBody({
  guest,
  groupLabels,
  eventId,
  brandedQrActive = false,
  headingId,
  showFullDetailsLink = true,
  photoDisplayUrl = null,
}: {
  guest: GuestRow;
  groupLabels: string[];
  eventId: string;
  /**
   * The guest's face, ALREADY RESOLVED to a displayable URL by the loader.
   *
   * ⚠ NEVER pass `guest.photo_url` here. That column holds an `r2://…`
   * REFERENCE, and a raw one in an <img> is a broken-image glyph — silent, and
   * exactly the defect three other guest screens shipped with. The loaders all
   * go through `guestPhotoDisplayUrls`; this takes the value out of that map.
   *
   * Null when the guest has no photo, or when the ref could not be signed —
   * both fall back to initials, which is why a miss is safe.
   */
  photoDisplayUrl?: string | null;
  /** Paid CUSTOM_QR_GUEST upgrade admin-approved for this event → offer the
   *  branded PNG download directly (the gated route 403s otherwise, so a
   *  non-owner is routed to the Invitation page instead). */
  brandedQrActive?: boolean;
  /** id for the identity heading — the Drawer sheet points its
   *  aria-labelledby here. Omitted in the inspector (its panel header owns the
   *  accessible name) so no duplicate id ever lands in the DOM. */
  headingId?: string;
  /** The inspector frame supplies its own "Open full page ↗" affordance, so it
   *  suppresses the redundant body link (mirrors Studio's inspector `back`
   *  suppression). The sheet keeps it. */
  showFullDetailsLink?: boolean;
}) {
  const name = guestDisplayName(guest);
  const contact = guest.email ?? guest.mobile ?? null;
  const qrFileName = `qr-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  // The couple can never be removed; `softDeleteGuest` refuses them server-side.
  const isCouple = guest.role === 'bride' || guest.role === 'groom';

  return (
    <>
      {/* Identity */}
      <div className="mb-4 flex items-center gap-3">
        {/* THE FACE, WHEN THERE IS ONE (2026-08-19). This screen read no photo
            at all — every guest showed initials, including one whose selfie was
            sitting in the row it was already given. It is the guest screen where
            you most expect a face: the couple opens it to work out who somebody
            is. */}
        {photoDisplayUrl ? (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-terracotta/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- presigned R2 URL, resolved by the loader */}
            <img
              src={photoDisplayUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-sm font-semibold text-terracotta-700">
            {guestInitials(guest)}
          </span>
        )}
        <div className="min-w-0">
          <h2 id={headingId} className="truncate text-xl font-semibold text-ink">
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

      {showFullDetailsLink ? (
        <Link
          href={`/dashboard/${eventId}/guests/${guest.guest_id}`}
          className="inline-flex w-full items-center justify-center rounded-lg border border-ink/15 px-4 py-2.5 text-sm font-medium text-ink/80 hover:border-terracotta/40 hover:text-terracotta-700"
        >
          Open full details
        </Link>
      ) : null}

      {/* Remove. The couple is the foundation of the event and can never be
          removed — `softDeleteGuest` refuses them server-side, so the button is
          replaced by the same sentence the full detail page shows rather than
          dangling an action that can only fail. A guest who has already RSVP'd
          is also refused (reset them to Pending first); that message comes back
          from the action itself, which is why it is not re-spelled here.
          *
          *  THE SECOND TAP IS THE GUARD (2026-09-06). This shipped hours earlier
          *  as ONE unguarded tap on a full-width danger button directly beneath
          *  the full-width "Open full details" — two stacked full-width targets,
          *  the lower one destructive, on a panel opened casually mid-scan. Every
          *  other delete path here has a guard (the swipe IS the confirm; the
          *  desktop bulk delete has a 6s undo) and this one had none, while being
          *  the LEAST undoable: softDeleteGuest hard-deletes the seat assignment
          *  and only the bulk path can put a seat back. See remove-guest-confirm.tsx. */}
      {isCouple ? (
        <p className="mt-3 text-center text-xs text-ink/50">
          Foundation of the event — can&rsquo;t be removed
        </p>
      ) : (
        <RemoveGuestConfirm
          eventId={eventId}
          guestId={guest.guest_id}
          guestName={guestDisplayName(guest)}
        />
      )}
      <p className="mt-3 text-[11px] text-ink/40">
        The code above is a preview. Every guest&rsquo;s default QR is free —
        branding it with your colors is an upgrade.
      </p>
    </>
  );
}
