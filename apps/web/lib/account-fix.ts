// Admin account-access model — Phase 2 CORE (consent-to-fix).
// Shared, non-server-only contract for the "request the user to allow us to
// fix their account" flow. See Admin_Account_Access_Model_2026-06-22.md §1
// (tier 2), §3 (consent-to-fix rows), §8 (approval = RA 10173 lawful basis).
//
// THE FIELD ALLOWLIST is the single source of truth for what an admin may
// propose a fix to. It is deliberately tiny in Phase 2 CORE: the verified,
// couple-EDITABLE, low-risk fields whose write is bounded by the couple's
// OWN row-level security (users.user_owns_row / events.couple_can_update_event).
// We never write an arbitrary column: target_table + field_key are validated
// against this map both when an admin proposes and when the couple's approve
// action applies. The money/identity/payout consent-to-fix rows from §3 — which
// ALSO require a DB-enforced two-admin gate — are intentionally OUT of scope
// here and are NOT added to this allowlist until the two-admin trigger ships
// (deferred Phase-2 sub-piece).

export type AccountFixStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'applied'
  | 'cancelled';

export type AccountFixTargetTable = 'users' | 'events';

export type AccountFixFieldDef = {
  /** Stable key used in the form + stored on the row. */
  key: string;
  /** Which table the field lives on. */
  table: AccountFixTargetTable;
  /** The actual DB column the apply step writes (never user-supplied). */
  column: string;
  /** Human label shown to the couple in the notification + approval card. */
  label: string;
  /** Whether this field is scoped to an event (date/venue) or the user account. */
  scope: 'user' | 'event';
  /** How to coerce the stored TEXT proposed_value into the column's type. */
  valueType: 'text' | 'date';
};

// Keyed by `${table}:${key}` so a single lookup validates both halves at once.
export const ACCOUNT_FIX_FIELDS: Record<string, AccountFixFieldDef> = {
  'users:display_name': {
    key: 'display_name',
    table: 'users',
    column: 'display_name',
    label: 'Your name',
    scope: 'user',
    valueType: 'text',
  },
  'events:display_name': {
    key: 'display_name',
    table: 'events',
    column: 'display_name',
    label: 'Event name',
    scope: 'event',
    valueType: 'text',
  },
  'events:event_date': {
    key: 'event_date',
    table: 'events',
    column: 'event_date',
    label: 'Event date',
    scope: 'event',
    valueType: 'date',
  },
};

export function lookupFixField(
  table: string,
  key: string,
): AccountFixFieldDef | null {
  return ACCOUNT_FIX_FIELDS[`${table}:${key}`] ?? null;
}

/**
 * Validate + coerce a proposed TEXT value against a field definition. Returns a
 * value safe to hand to a single-column .update(). Throws a user-readable error
 * on bad input so both the admin (proposing) and the apply step (on approve)
 * reject malformed values the same way.
 */
export function coerceFixValue(
  field: AccountFixFieldDef,
  proposedValue: string,
): string {
  const trimmed = proposedValue.trim();
  if (trimmed.length === 0) {
    throw new Error('The proposed value cannot be empty.');
  }
  if (field.valueType === 'date') {
    // Expect ISO calendar date (YYYY-MM-DD) — matches <input type="date"> and
    // the events.event_date DATE column. Reject anything else rather than let
    // Postgres coerce a surprising value.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error('The proposed date must be in YYYY-MM-DD format.');
    }
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('The proposed date is not a valid calendar date.');
    }
    return trimmed;
  }
  if (trimmed.length > 200) {
    throw new Error('The proposed value is too long (max 200 characters).');
  }
  return trimmed;
}

export type AccountFixRequestRow = {
  id: string;
  target_user_id: string;
  event_id: string | null;
  target_table: AccountFixTargetTable;
  field_key: string;
  field_label: string;
  current_value: string | null;
  proposed_value: string;
  requested_by: string | null;
  status: AccountFixStatus;
  reason: string | null;
  consent_at: string | null;
  created_at: string;
  resolved_at: string | null;
};
