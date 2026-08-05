import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * IS THIS GUEST SOMEONE WE KNOW TO BE UNDER 18?
 *
 * ── THE RULE (owner, 2026-08-05) ────────────────────────────────────────────
 * *"i am 18 or older will be the only starting enabler. under 18 will not allow
 * face tagging."*
 *
 * The tickbox is the enabler. This is the other half: where the system already
 * KNOWS a guest is a child, no tickbox may override that. A fifteen-year-old at
 * a debut can tick "I am 18 or older" — an attestation records that we asked,
 * it does not check. When we have a birth date, we can do better than ask.
 *
 * ── WHAT "KNOW" MEANS, EXACTLY ──────────────────────────────────────────────
 * A guest row may carry `person_id`, linking to a `people` record with a
 * `birth_date` (recorded by the couple building their guest list, or by a
 * guardian who holds that person's profile). That is the only source. Most
 * guests have neither, and for them the attestation is the whole gate — which
 * is the owner's stated model, not a gap this module pretends to close.
 *
 * ── IT ONLY EVER REFUSES ────────────────────────────────────────────────────
 * A `true` here blocks an enrolment. It can never permit one: the consent tick,
 * the 18+ attestation and `face_recognition_excluded` all still apply on top.
 * So a wrong answer costs a guest their auto-tagging, never a child their
 * privacy — which is the direction this has to fail in.
 */

/** Whole years from a `YYYY-MM-DD` birth date to a reference day. */
export function ageOnDate(birthDate: string, on: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!m) return null;
  const [, y, mo, d] = m;
  // Compared as calendar days, never as instants — a birth date is a DATE, and
  // reading it as a moment shifts it a day west of Greenwich.
  const born = { y: Number(y), m: Number(mo), d: Number(d) };
  const nowY = on.getUTCFullYear();
  const nowM = on.getUTCMonth() + 1;
  const nowD = on.getUTCDate();
  let age = nowY - born.y;
  if (nowM < born.m || (nowM === born.m && nowD < born.d)) age -= 1;
  return age;
}

/** Under this, no face data is kept for them, whatever they ticked. */
export const FACE_ENROLMENT_MIN_AGE = 18;

/**
 * True when this guest's linked person record shows them under 18.
 *
 * Returns FALSE when we simply do not know — no person link, no birth date, or
 * a read that failed. That is deliberate and it is the honest shape: this
 * function answers "do we KNOW they are a child", and a failed lookup is not
 * knowledge. The attestation and the host's exclusion flag remain in force
 * either way, so an unknown guest is not unprotected — they are exactly as
 * protected as the owner's model says they should be.
 */
export async function isKnownMinorGuest(
  admin: Pick<SupabaseClient, 'from'>,
  eventId: string,
  guestId: string,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    const { data: guest, error: guestErr } = await admin
      .from('guests')
      .select('person_id')
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .maybeSingle();
    if (guestErr || !guest) return false;

    const personId = (guest as { person_id: string | null }).person_id;
    if (!personId) return false;

    const { data: person, error: personErr } = await admin
      .from('people')
      .select('birth_date')
      .eq('person_id', personId)
      .maybeSingle();
    if (personErr || !person) return false;

    const birthDate = (person as { birth_date: string | null }).birth_date;
    if (!birthDate) return false;

    const age = ageOnDate(birthDate, now);
    return age !== null && age < FACE_ENROLMENT_MIN_AGE;
  } catch {
    return false;
  }
}
