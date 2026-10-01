/**
 * lib/role-names.server.ts — reading one event's role words.
 *
 * ⚠ NO `import 'server-only'`, deliberately: it holds no secret (the caller
 * hands in the client), and the Wedding March panel that reads it is imported
 * by a unit test (`a-pair-walks-as-one-line.test.ts`), where `server-only`
 * does not resolve.
 *
 * `events.role_names` holds the couple's own words for entourage roles (owner
 * 2026-09-30 — Bridesmaid → "Bride's Crew"). See `lib/role-names.ts` for what
 * the words mean; this file only reads them.
 *
 * 🔑 A FAILED READ IS "THE USUAL WORDS", LOGGED — NEVER A BROKEN PAGE. A role
 * word is presentation, like the Wedding March's section order: if it cannot
 * be read, every screen still shows every person under the role's usual word.
 * It is logged so the gap is visible to us even though it is not to a guest.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ROLE_LABELS } from '@/lib/guests';
import { sanitizeRoleNames, type RoleNames } from '@/lib/role-names';
import { logQueryError } from '@/lib/supabase/error-detect';

/** Is this string a role the vocabulary knows? (The sanitiser's `isKnownRole`.) */
export function isKnownGuestRole(v: string): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, v);
}

/** Sanitise a stored `role_names` value against the real vocabulary. */
export function readRoleNames(raw: unknown): RoleNames {
  return sanitizeRoleNames(raw, isKnownGuestRole);
}

/**
 * The couple's role words for one event. Pass the session client on the
 * dashboard (the column is granted SELECT to `authenticated`) and the admin
 * client on every public surface (anon holds nothing here).
 */
export async function loadRoleNames(
  client: SupabaseClient,
  eventId: string,
  callSite = 'loadRoleNames',
): Promise<RoleNames> {
  const { data, error } = await client
    .from('events')
    .select('role_names')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    logQueryError(callSite, error, { event_id: eventId }, 'graceful_degrade');
    return {};
  }
  return readRoleNames((data as { role_names?: unknown } | null)?.role_names);
}
