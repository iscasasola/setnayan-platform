/**
 * supplier-invite-status.ts — WHERE THE COUPLE'S LINK STANDS, in the couple's
 * own words, on the row of a supplier they added themselves.
 *
 * Owner, 2026-10-10 (`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`): "the couple IS
 * told when the supplier declines or never opens the link". Until now the
 * couple was told nothing: `declineVendorInviteByToken` wrote `declined` and no
 * surface read it, and a link nobody used simply ran out after its 90 days.
 *
 * ── ONLY WHAT `vendor_invites` RECORDS ─────────────────────────────────────
 * The table holds `status` (pending · claimed · declined · expired · revoked),
 * `sent_at`, `expires_at`, `declined_at` and `claimed_at`. It does NOT record
 * that a link was OPENED — there is no such column — so this module never says
 * "opened" and never says "not opened". A pending link reads "no answer yet",
 * which is exactly what is known: they have neither joined nor declined.
 * 🔌 SEAM: an `opened_at` stamp (a migration, proposed in the build plan) is
 * what would let this say "opened · not joined yet" / "not opened yet".
 *
 * ── EXPIRY IS LAZY IN THE DATABASE, SO IT IS DECIDED HERE TOO ──────────────
 * A `pending` row is only flipped to `expired` when somebody opens the link
 * (`fetchClaimLandingByToken`). A link nobody ever opened therefore stays
 * `pending` for ever. Reading `status` alone would call a dead link "sent", so
 * a pending row past its `expires_at` is `expired` here.
 *
 * PURE: no clock of its own (the caller passes `nowMs`), no server import — the
 * page computes it and the bench only draws the result.
 */

/** `vendor_invites.status`, as stored. */
export type StoredInviteStatus = 'pending' | 'claimed' | 'declined' | 'expired' | 'revoked';

export type InviteStatusInput = {
  status: StoredInviteStatus;
  /** `vendor_invites.sent_at` (ISO). */
  sentAt: string | null;
  /** `vendor_invites.expires_at` (ISO). */
  expiresAt: string | null;
};

export type SupplierInviteStatusKey = 'sent' | 'joined' | 'declined' | 'expired';

export type SupplierInviteStatus = {
  key: SupplierInviteStatusKey;
  /** The whole sentence the row shows. */
  line: string;
  /** How loud it is: amber waits on them · red needs the couple · green is done. */
  tone: 'warn' | 'danger' | 'ok';
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two instants; never negative. */
function wholeDays(fromIso: string | null, nowMs: number): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return null;
  return Math.max(0, Math.floor((nowMs - from) / DAY_MS));
}

/** "today" · "yesterday" · "3 days ago" — or '' when the date is unknown. */
function sentWhen(sentAt: string | null, nowMs: number): string {
  const d = wholeDays(sentAt, nowMs);
  if (d == null) return '';
  if (d === 0) return ' today';
  if (d === 1) return ' yesterday';
  return ` ${d} days ago`;
}

/**
 * The line for a supplier's latest link, or `null` when there is nothing to say
 * (no link was ever made, or the only one was revoked): the row then keeps its
 * own "your record" sentence and offers the link from the record sheet.
 */
export function supplierInviteStatus(
  invite: InviteStatusInput | null,
  nowMs: number,
): SupplierInviteStatus | null {
  if (!invite) return null;
  switch (invite.status) {
    case 'claimed':
      // Joined — that much the link records. Whether their own card is up yet
      // is the row's to say (`joinedLine`), because the link cannot know it.
      return { key: 'joined', line: joinedLine(false), tone: 'ok' };
    case 'declined':
      return {
        key: 'declined',
        line: 'They said they are not this supplier · your link is closed',
        tone: 'danger',
      };
    case 'expired':
      return { key: 'expired', line: 'Your link ran out with no answer', tone: 'danger' };
    case 'pending': {
      const expires = invite.expiresAt ? new Date(invite.expiresAt).getTime() : NaN;
      if (Number.isFinite(expires) && expires <= nowMs) {
        return { key: 'expired', line: 'Your link ran out with no answer', tone: 'danger' };
      }
      return {
        key: 'sent',
        line: `Link sent${sentWhen(invite.sentAt, nowMs)} · no answer yet`,
        tone: 'warn',
      };
    }
    case 'revoked':
      return null;
  }
}

/**
 * What the page hands the bench: one entry per self-added supplier whose link
 * could be read, and `null` for the WHOLE map when the read failed — a failed
 * read must not look like "no link was ever sent".
 */
export type InviteStatusByVendorId = Readonly<Record<string, SupplierInviteStatus>> | null;

/** The sentence a self-added row shows when the links could not be read. */
export const INVITE_STATUS_UNREAD_LINE = 'Could not check their link just now';

/**
 * The record's own sentence (the prototype's, verbatim): what the couple typed
 * is their note until the supplier joins — or a booking they made by hand.
 */
export function ownRecordLine(booked: boolean): string {
  return booked ? 'Added by you · booked by hand' : 'Added by you · your record, not a booking';
}

/**
 * A supplier who joined through the couple's link. `vendor_invites` says they
 * joined; only the row knows whether they have put their own card up
 * (`event_vendors.service_id`, drawn as the row's service card). The second
 * sentence is the approved prototype's (case E5) and is only true once that
 * card exists — said before then, it would describe a card nobody can open.
 */
export function joinedLine(hasOwnCard: boolean): string {
  return hasOwnCard ? 'Now on Setnayan — their own card' : 'Joined through your link · their card is not up yet';
}
