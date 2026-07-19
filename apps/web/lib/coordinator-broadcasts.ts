/**
 * Coordinator P3 — day-of broadcast + email call-times, PURE core
 * (Coordinator_Role_Feature_Spec_2026-07-18 §P3).
 *
 * No 'server-only', no DB/email runtime imports — unit-testable under
 * `tsx --test` (same split as save-the-date-emails-core.ts). The server halves
 * live in lib/coordinator-broadcasts-server.ts (reads + authority probe) and
 * app/dashboard/[eventId]/_actions/day-of-broadcast.ts (writes + sends).
 *
 * This module owns:
 *   1. The UI flag (`isCoordinatorP3Enabled`) — default OFF; absent/other =
 *      today's behavior exactly (the broadcast card keeps rendering its
 *      pre-P3 stub). Owner flips after pushing migration 20270825364600.
 *   2. Broadcast body validation (`validateBroadcastBody`) — mirrors the
 *      table's CHECK (1..500 chars) so bad input fails in-process, not in RLS.
 *   3. Call-time derivation (`deriveVendorCallTimes`) — per-vendor call time
 *      from the master run-of-show: the EARLIEST block each vendor is tagged
 *      responsible on (P2's responsible_vendor_ids lens, never a copy).
 *      Vendors with no tagged rows or no contact email simply drop out.
 *   4. Call-time email shaping (`buildCallTimeEmail`) — plain-text body in
 *      Asia/Manila wall-clock time. EMAIL-ONLY per the no-SMS V1 lock.
 */

import type { RosMetaMap } from '@/lib/schedule-ros';

/** UI gate for the P3 surfaces (broadcast composer + feed, call-time email
 *  button). Default OFF — absent/other = today's behavior exactly. Owner
 *  flips after pushing migration 20270825364600 (coordinator_broadcasts). */
export function isCoordinatorP3Enabled(): boolean {
  return process.env.NEXT_PUBLIC_COORDINATOR_P3_ENABLED === 'true';
}

// ───────────────────────────── broadcasts ─────────────────────────────

export const BROADCAST_MAX_LENGTH = 500;

export type BroadcastSenderRole = 'couple' | 'coordinator';

/** The card's render shape — resolved server-side, passed as props (the
 *  day-of grid's existing read model: server fetch → props into cards). */
export type CoordinatorBroadcastItem = {
  broadcastId: string;
  body: string;
  senderRole: BroadcastSenderRole;
  createdAt: string;
};

/** Everything the day-of broadcast card needs, resolved server-side by the
 *  day-of page (the grid's existing read model: server fetch → props into
 *  cards). Absent prop = the card renders its pre-P3 stub. */
export type BroadcastCardData = {
  items: CoordinatorBroadcastItem[];
  /** Non-null = this viewer may compose (couple or schedule-'edit' delegate). */
  senderRole: BroadcastSenderRole | null;
  /** Vendors with a derivable call time (tagged rows + contact email). */
  callTimeCount: number;
  /** Resend configured? False renders the email button disabled with a hint. */
  emailConfigured: boolean;
};

/**
 * Trim + length-check a broadcast body against the table's CHECK constraint.
 * Returns the normalized body, or an error string safe to surface in the UI.
 */
export function validateBroadcastBody(
  raw: unknown,
): { ok: true; body: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Write a message first.' };
  const body = raw.trim();
  if (body.length === 0) return { ok: false, error: 'Write a message first.' };
  if (body.length > BROADCAST_MAX_LENGTH) {
    return {
      ok: false,
      error: `Keep it under ${BROADCAST_MAX_LENGTH} characters — broadcasts are short updates.`,
    };
  }
  return { ok: true, body };
}

// ──────────────────────────── call-times ────────────────────────────

/** Minimal block shape the derivation needs — structural subset of
 *  ScheduleBlockRow, so tests need no full fixture. */
export type CallTimeBlock = {
  block_id: string;
  label: string;
  start_at: string;
  location: string | null;
};

/** Minimal event_vendors shape the derivation needs. */
export type CallTimeVendor = {
  vendor_id: string;
  vendor_name: string;
  contact_email: string | null;
};

export type VendorCallTime = {
  vendorId: string;
  vendorName: string;
  contactEmail: string;
  /** ISO start of the earliest block this vendor is tagged responsible on. */
  callTimeAt: string;
  blockLabel: string;
  location: string | null;
};

/**
 * Derive each vendor's call time from the master run-of-show: the earliest
 * block (top-level or part) the vendor is tagged responsible on via P2's
 * `responsible_vendor_ids` lens. Deliberately conservative —
 *
 *   • vendors with NO tagged rows are excluded (no invented call times;
 *     tagging in the P2 responsible-party editor is the opt-in), and
 *   • vendors without a contact_email are excluded (nowhere to send).
 *
 * Result is sorted by call time, then vendor name — the order the emails go
 * out and the order any preview lists them.
 */
export function deriveVendorCallTimes(
  blocks: readonly CallTimeBlock[],
  meta: RosMetaMap,
  vendors: readonly CallTimeVendor[],
): VendorCallTime[] {
  const out: VendorCallTime[] = [];
  for (const vendor of vendors) {
    const email = vendor.contact_email?.trim();
    if (!email) continue;
    let earliest: CallTimeBlock | null = null;
    for (const block of blocks) {
      const tagged = meta
        .get(block.block_id)
        ?.responsible_vendor_ids.includes(vendor.vendor_id);
      if (!tagged) continue;
      if (
        earliest === null ||
        new Date(block.start_at).getTime() < new Date(earliest.start_at).getTime()
      ) {
        earliest = block;
      }
    }
    if (!earliest) continue;
    out.push({
      vendorId: vendor.vendor_id,
      vendorName: vendor.vendor_name,
      contactEmail: email,
      callTimeAt: earliest.start_at,
      blockLabel: earliest.label,
      location: earliest.location,
    });
  }
  out.sort((a, b) => {
    const dt = new Date(a.callTimeAt).getTime() - new Date(b.callTimeAt).getTime();
    if (dt !== 0) return dt;
    return a.vendorName.localeCompare(b.vendorName);
  });
  return out;
}

/** "Saturday, June 6 at 2:30 PM" in Asia/Manila (PH has no DST). */
export function formatCallTimePh(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${day} at ${time}`;
}

export type CallTimeEmailContent = {
  to: string;
  subject: string;
  text: string;
};

/**
 * Shape one vendor's call-time email. Plain text only — the recipient is the
 * vendor's free-text contact_email (often not a Setnayan account), so there is
 * no meaningful in-app CTA to deep-link; plain text is the precedented shape
 * (sendVendorInviteEmail). Pure — the server action pairs it with sendEmail().
 */
export function buildCallTimeEmail(args: {
  callTime: VendorCallTime;
  eventDisplayName: string;
}): CallTimeEmailContent {
  const { callTime, eventDisplayName } = args;
  const when = formatCallTimePh(callTime.callTimeAt);
  const whereLine = callTime.location ? ` (${callTime.location})` : '';
  return {
    to: callTime.contactEmail,
    subject: `Call time for ${eventDisplayName}: ${when}`,
    text: [
      `Hi ${callTime.vendorName},`,
      ``,
      `Here's your call time for ${eventDisplayName}:`,
      ``,
      `${when}`,
      `Your part of the day: ${callTime.blockLabel}${whereLine}`,
      ``,
      `This was sent by the event's planning team via Setnayan. If anything changes on the day, they'll reach out again.`,
      ``,
      `—`,
      `Set na 'yan.`,
    ].join('\n'),
  };
}
