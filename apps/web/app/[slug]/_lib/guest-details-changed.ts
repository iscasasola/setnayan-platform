/**
 * WHICH HOST-ACTIONABLE DETAILS THIS SUBMIT ACTUALLY MOVED.
 *
 * Pure and dependency-free so it can be unit-tested with real values — which
 * matters, because this comparison is the whole difference between "the couple
 * is told about an allergy" and "the couple is emailed every time a guest opens
 * their own reply card".
 *
 * 🔑 EVERY FIELD ON THE REPLY CARD IS `defaultValue=`. A guest who opens the
 * card and taps Save reposts their own meal, allergy and note byte-for-byte, and
 * the update runs unconditionally with `updated_at` always moving. So NEITHER
 * the write NOR the timestamp is a change signal — only this comparison is.
 */
export type DetailField = 'meal' | 'dietary' | 'note' | 'email' | 'mobile' | 'name';

export function guestDetailsChanged(
  before: {
    meal_preference?: string | null;
    dietary_restrictions?: string | null;
    guest_note?: string | null;
    email?: string | null;
    mobile?: string | null;
    display_name?: string | null;
  } | null,
  next: {
    meal: string;
    dietary: string | null;
    guestNote: string | null;
    email: string | null;
    mobile: string | null;
    displayName: string | null;
  },
): DetailField[] {
  const norm = (v: string | null | undefined) => (v ?? '').trim();
  const out: DetailField[] = [];

  // 🪤 NULL MEANS "NEVER ASKED", AND THE WRITE COERCES IT TO 'no_preference'.
  // `guests.meal_preference` is nullable with NO default, while the action
  // stores `meal_raw || 'no_preference'` — so comparing raw would report that
  // phantom flip as a change on the first save of every guest who never opened
  // the dropdown, and email the couple about nothing.
  if ((before?.meal_preference ?? 'no_preference') !== next.meal) out.push('meal');

  // 🪤 `clean(...) || null` turns '' into null on the way in, so a stored ''
  // would otherwise read as a change on every single submit, forever.
  if (norm(before?.dietary_restrictions) !== norm(next.dietary)) out.push('dietary');
  if (norm(before?.guest_note) !== norm(next.guestNote)) out.push('note');

  // The three the guest could never give until 2026-08-21. Same '' -> null
  // normalisation: `clean(...) || null` on the way in means a stored '' would
  // otherwise report a change on every submit for the rest of the guest's life.
  // 🪤 Email is compared CASE-INSENSITIVELY. Addresses are case-insensitive in
  // the half that matters, so a guest whose keyboard capitalises the first
  // letter would otherwise tell the couple their email "changed" every time
  // they opened their own card.
  if (norm(before?.email).toLowerCase() !== norm(next.email).toLowerCase()) out.push('email');
  if (norm(before?.mobile) !== norm(next.mobile)) out.push('mobile');
  if (norm(before?.display_name) !== norm(next.displayName)) out.push('name');

  return out;
}
