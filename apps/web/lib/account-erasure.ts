/**
 * Pure helpers for the RA 10173 account-erasure + biometric-withdrawal paths.
 *
 * Deliberately imports NO `server-only` module so the logic is unit-testable
 * under tsx (the runner can't import `server-only`). The DB/R2 side effects stay
 * in the server actions; only the pure decisions live here.
 */

/**
 * Distinct, non-null `guest_id`s from a set of `event_members` rows.
 *
 * The account-erasure biometric purge resolves a leaving user's guest
 * identities this way — `event_members.guest_id` is the user→guest link, and
 * their per-event `guest_face_enrollments` are keyed by `guest_id` (no user FK),
 * so this is the only way to reach the biometric rows the subject owns. Dedupes
 * so a user linked to the same guest row twice can't produce a duplicate delete
 * target, and drops null/empty ids (a member row that is not a registered guest).
 */
export function distinctGuestIds(
  rows: ReadonlyArray<{ guest_id?: string | null }>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r?.guest_id;
    if (typeof id !== 'string' || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Distinct, non-null `person_id`s from a set of `people` rows.
 *
 * The account-erasure biometric purge ALSO resolves a leaving user's guest
 * identities through the person spine: an account claims a durable person node
 * (`people.claimed_by_user_id`), and guest rows are auto-linked to that node by
 * email (`guests.person_id`). This dedupes the claimed-person ids (an account
 * claims ≤ 1 person today, but the union is written defensively) before they
 * feed the `guests WHERE person_id IN (…)` lookup, catching enrolments the
 * subject made without ever joining the event (a public-page selfie RSVP).
 */
export function distinctPersonIds(
  rows: ReadonlyArray<{ person_id?: string | null }>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const id = r?.person_id;
    if (typeof id !== 'string' || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Cookie that carries a freshly-reset temp password from `resetUserPassword`
 * (admin/users/actions.ts) to the /admin surface that renders it. Lives here (a
 * non-`server-only`, non-`'use server'` module) so both the action and the page
 * can import the name — a `'use server'` file may export only async functions.
 * httpOnly + short TTL: it REPLACES the old plaintext-in-URL delivery that
 * leaked the secret + email into request logs and browser history.
 */
export const TEMP_PASSWORD_FLASH_COOKIE = 'setnayan_admin_pw_flash';

export type TempPasswordFlash = { password: string; email: string };

/**
 * Serialize the transient temp-password flash for the short-TTL httpOnly cookie
 * that REPLACES the old plaintext-in-URL delivery (the password + email used to
 * ride `/admin/users?temp_password=…&for_email=…`, landing both in Vercel/edge
 * logs and browser history). The cookie keeps them out of the URL entirely.
 */
export function serializeTempPasswordFlash(flash: TempPasswordFlash): string {
  return JSON.stringify({ password: flash.password, email: flash.email });
}

/**
 * Parse the temp-password flash cookie value. Returns null for anything that
 * isn't a well-formed `{ password, email }` object — a corrupt or forged cookie
 * renders nothing rather than crashing (or spoofing) the admin surface.
 */
export function parseTempPasswordFlash(
  raw: string | null | undefined,
): TempPasswordFlash | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { password, email } = parsed as Record<string, unknown>;
  if (typeof password !== 'string' || password.length === 0) return null;
  if (typeof email !== 'string' || email.length === 0) return null;
  return { password, email };
}
