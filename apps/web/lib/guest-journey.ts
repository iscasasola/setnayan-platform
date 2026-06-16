/**
 * Guest journey — the single source of truth for the couple's people flow.
 *
 * Owner direction 2026-06-16: the Guests area is a JOURNEY, not a pile of tools —
 * Build → Invite → Confirm → Seat → Day-of. This module is the one place that
 * defines the stages (label · icon · route · active-match) so the desktop strip
 * (lifecycle-ribbon.tsx) and the mobile docked sub-nav (guests-section-subnav.tsx)
 * can never drift apart. Neutral module (no `'use client'`) so a Server Component
 * AND a Client Component can both import it — same pattern as customer-nav-config.ts
 * (lucide icon refs render in both contexts; the boundary issue was only ever the
 * `'use client'` file wrapping, not the icons).
 *
 * Stage → surface (all already built; this just sequences them):
 *   Build   → /guests           make the list + group it
 *   Invite  → /guests/invite    share ONE join link; guests complete + auto-match
 *   Confirm → /guests/claims    approve a request → that guest gets their QR
 *   Seat    → /seating          auto-seated first, drag to re-route
 *   Day-of  → /guests/checkin   live check-in desk + arrivals (TIME-GATED)
 *
 * Day-of is the one stage gated by TIME, not completion: it shows muted until the
 * event window opens, then becomes the live surface. Every other stage stays
 * visible always (guest work is non-linear — late adds, re-seats), changing state
 * not visibility. (Event QR is a crew-pairing tool and Hosts is a team surface —
 * neither is a journey stage, so neither lives here; both stay reachable from the
 * Home tiles grid.)
 */

import {
  PencilLine,
  Send,
  CircleCheck,
  LayoutGrid,
  QrCode,
  type LucideIcon,
} from 'lucide-react';

export type GuestJourneyKey = 'build' | 'invite' | 'confirm' | 'seat' | 'dayof';

export type GuestJourneyStage = {
  key: GuestJourneyKey;
  label: string;
  icon: LucideIcon;
  href: string;
  /**
   * Active-state prefix. Matched via `pathname === match || pathname.startsWith(
   * match + '/')`; when several match, the LONGEST wins (so /guests/invite lights
   * Invite, not Build, even though /guests is a prefix of it).
   */
  match: string;
  /** Time-gated stage rendered muted until its window opens (Day-of). */
  muted?: boolean;
};

/**
 * The five guest-journey stages for an event. Pass `dayOfOpen` to un-mute Day-of
 * once the live window is open (see {@link isDayOfOpen}).
 */
export function buildGuestJourney(
  eventId: string,
  opts?: { dayOfOpen?: boolean },
): GuestJourneyStage[] {
  const base = `/dashboard/${eventId}`;
  return [
    { key: 'build', label: 'Build', icon: PencilLine, href: `${base}/guests`, match: `${base}/guests` },
    { key: 'invite', label: 'Invite', icon: Send, href: `${base}/guests/invite`, match: `${base}/guests/invite` },
    { key: 'confirm', label: 'Confirm', icon: CircleCheck, href: `${base}/guests/claims`, match: `${base}/guests/claims` },
    { key: 'seat', label: 'Seat', icon: LayoutGrid, href: `${base}/seating`, match: `${base}/seating` },
    {
      key: 'dayof',
      label: 'Day-of',
      icon: QrCode,
      href: `${base}/guests/checkin`,
      match: `${base}/guests/checkin`,
      muted: !(opts?.dayOfOpen ?? false),
    },
  ];
}

/** The stage whose match-prefix best (longest) covers `pathname`, or null. */
export function activeJourneyKey(
  pathname: string,
  stages: GuestJourneyStage[],
): GuestJourneyKey | null {
  let best: GuestJourneyStage | null = null;
  for (const s of stages) {
    if (pathname === s.match || pathname.startsWith(`${s.match}/`)) {
      if (!best || s.match.length > best.match.length) best = s;
    }
  }
  return best?.key ?? null;
}

/** True while a path sits inside the guest journey (drives nav visibility). */
export function isGuestJourneyPath(pathname: string, eventId: string): boolean {
  const base = `/dashboard/${eventId}`;
  return (
    pathname === `${base}/guests` ||
    pathname.startsWith(`${base}/guests/`) ||
    pathname === `${base}/seating` ||
    pathname.startsWith(`${base}/seating/`)
  );
}

/**
 * Day-of "live mode" window: from the eve of the event through the day after.
 * `now` is injected so callers stay deterministic (and so a client component can
 * defer the read to an effect, avoiding an SSR/client hydration mismatch).
 */
export function isDayOfOpen(
  eventDate: string | null | undefined,
  now: Date,
): boolean {
  if (!eventDate) return false;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return false;
  const dayMs = 24 * 60 * 60 * 1000;
  const t = now.getTime();
  return t >= d.getTime() - dayMs && t <= d.getTime() + dayMs;
}
