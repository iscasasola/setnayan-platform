import { realNameOrNull } from '@/lib/no-name';

/**
 * 👤 THE NAME A GROUP SHOWS FOR AN ACCOUNT (walk 13 Nov 2026, P1 — "both members are labelled Member").
 *
 * The group chat and its member list read `users.display_name` only — and that column is blank on most accounts (the
 * repo's own measurement: none set in production when it was checked), so every person read "Member". The account's
 * own first / last name columns (`users.first_name` / `last_name`) were never consulted. One order, everywhere a group
 * names a person: the display name; else first + last, joined with a space (never a dash — F-W3-22's "Someone —");
 * else null, and the caller says its neutral word. Never the email (RA 10173 — the group reads names only).
 */
export type AccountNameRow = {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** The columns to select beside `user_id`. */
export const ACCOUNT_NAME_COLUMNS = 'display_name, first_name, last_name';

export function accountPersonName(r: AccountNameRow | null | undefined): string | null {
  if (!r) return null;
  // Walk 14 Nov 2026: a stored stand-in ("Someone —") is no name — `realNameOrNull` drops it, so the group falls
  // through to the account's own first + last name, and only then to the caller's neutral word.
  const shown = realNameOrNull(r.display_name);
  if (shown) return shown;
  return realNameOrNull([r.first_name, r.last_name].map((p) => (p ?? '').trim()).filter(Boolean).join(' '));
}
