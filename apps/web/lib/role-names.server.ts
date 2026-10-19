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
import { isRenamableSection } from '@/lib/entourage';
import { sanitizeRoleNames, withOneWord, type RoleName, type RoleNames, type SectionNameKey } from '@/lib/role-names';
import type { GuestRole } from '@/lib/guests';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventRowOnce } from '@/lib/event-row-once';
import { updateJsonColumn, type JsonColumnClient } from '@/lib/update-json-column';

/** Is this string a role the vocabulary knows? (The sanitiser's `isKnownRole`.) */
export function isKnownGuestRole(v: string): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_LABELS, v);
}

/** Sanitise a stored `role_names` value against the real vocabulary — the roles AND the entourage's sections. */
export function readRoleNames(raw: unknown): RoleNames {
  return sanitizeRoleNames(raw, isKnownGuestRole, isRenamableSection);
}

/** One word to change: a role's (`{ one, many? }`) or a section's heading (`section:<key>`, `{ one }`). Blank = the usual word. */
export type RoleWordChange = { key: GuestRole | SectionNameKey; one: string; many?: string | null };

/**
 * 👥 THE ONE WRITER OF `events.role_names` — the Guest list's "Rename this role" and "Rename this section", and the
 * Maker's section headings at ✓ Apply all write through here (owner 2026-10-19: two doors, ONE value). Each word is
 * changed on the names AS THEY ARE when the write lands (`updateJsonColumn`, a compare-and-set on the value), so a word
 * another host changed meanwhile — another role, another section — stays. The caller has already checked the host;
 * `client` is the admin client (the column has no session UPDATE grant, on purpose).
 *
 * Returns the names as written, or `null` when the write did not land (a zero-row UPDATE is not "saved").
 */
export async function writeRoleNames(
  client: JsonColumnClient,
  eventId: string,
  changes: readonly RoleWordChange[],
): Promise<RoleNames | null> {
  let value: Record<string, RoleName> | null = null;
  const wrote = await updateJsonColumn(
    client,
    { table: 'events', row: { event_id: eventId }, column: 'role_names', what: 'The new name' },
    (stored) => {
      let next: RoleNames = readRoleNames(stored);
      for (const c of changes) next = readRoleNames(withOneWord(next, c.key, c.one, c.many));
      value = Object.keys(next).length > 0 ? (next as Record<string, RoleName>) : null;
      return { next: value };
    },
  );
  return wrote.written ? readRoleNames(value) : null;
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
  // From the row the render already holds when there is one (`lib/event-row-once.ts`); else this read, as before.
  const { data, error } = await eventRowOnce(client, eventId, 'role_names', () =>
    client
      .from('events')
      .select('role_names')
      .eq('event_id', eventId)
      .maybeSingle(),
  );
  if (error) {
    logQueryError(callSite, error, { event_id: eventId }, 'graceful_degrade');
    return {};
  }
  return readRoleNames((data as { role_names?: unknown } | null)?.role_names);
}
