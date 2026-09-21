/**
 * profile-personal-info-patch.ts — which `users` columns a personal-info save
 * may write, decided by WHAT THE FORM POSTED.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `updatePersonalInfo` used to back ONE form holding every personal field, and
 * it wrote every column on every save: a field that was not posted became
 * NULL (or `false`). The grouped redesign (owner-approved prototype,
 * 2026-09-21) split that form across Profile · Guest details · Privacy ·
 * Preferences. Unchanged, saving your meal preference would have wiped your
 * display name, your full name and your phone, and saving your name would have
 * withdrawn your RA 10173 consents for religion and dietary needs.
 *
 * 🔑 THE RULE: a column is written only when its field is ON the submitted
 * form. `FormData.has(name)` answers that for text inputs and selects, which
 * always post (an empty one posts ''). Two kinds of control post NOTHING in a
 * legitimate state, so "absent" cannot mean "not on this form" for them:
 *
 *   · an UNCHECKED checkbox (or a switch that submits only when turning on);
 *   · the photo <FileUpload>, which emits no hidden input once cleared.
 *
 * Those carry a hidden PRESENCE MARKER (PRESENCE_MARKERS below). Marker
 * present + value absent = "unchecked / cleared"; marker absent = "not on this
 * form, leave the column alone".
 *
 * Consent stamps (`*_consent_at`) keep the exact transition rule they had —
 * stamp on the first value, clear on withdrawal, untouched when unchanged —
 * but are now computed ONLY for fields that were posted, so a save that never
 * showed a field can never stamp or clear its consent.
 *
 * Pure (no `server-only`, no Supabase) so the unit test can execute it.
 */

import { MEAL_PREFERENCES, type MealPreference } from '@/lib/guests';
import { FORMAL_NAME_FIELDS, normalizeNamePart } from '@/lib/formal-name';
import {
  consentPatch,
  normalizeCivilStatus,
  normalizeReligion,
  normalizeSex,
} from '@/lib/profile-personalization';

/** Hidden inputs that say "this control is on the form" for controls that can post nothing. */
export const PRESENCE_MARKERS = {
  marketing_opt_in: 'has_marketing_opt_in',
  public_greeting_opt_in: 'has_public_greeting_opt_in',
  profile_photo_url: 'has_profile_photo_url',
} as const;

export type FormLike = {
  has(name: string): boolean;
  get(name: string): FormDataEntryValue | null;
};

/** The current row, read before the write, for the consent transitions. */
export type ExistingPersonalInfo = {
  marketing_opt_in?: boolean | null;
  religion?: string | null;
  civil_status?: string | null;
  sex?: string | null;
  dietary_restrictions?: string | null;
} | null;

export type PersonalInfoPlan =
  | { ok: true; patch: Record<string, unknown> }
  | { ok: false; error: string };

function trimmedOrNull(raw: FormDataEntryValue | null, max: number): string | null {
  if (typeof raw !== 'string') return null;
  return raw.trim().slice(0, max) || null;
}

export function planPersonalInfoPatch(
  form: FormLike,
  existing: ExistingPersonalInfo,
  nowIso: string,
): PersonalInfoPlan {
  const patch: Record<string, unknown> = {};

  // ── Profile ──────────────────────────────────────────────────────────────
  if (form.has('display_name')) {
    patch.display_name = trimmedOrNull(form.get('display_name'), 128);
  }
  // The formal name (owner 2026-09-21) — five parts, self-declared, never
  // verified. Each part only when posted.
  for (const f of FORMAL_NAME_FIELDS) {
    if (form.has(f)) patch[f] = normalizeNamePart(form.get(f));
  }
  if (form.has('phone')) {
    patch.phone = trimmedOrNull(form.get('phone'), 32);
  }
  // Clearing the photo emits no hidden input → the marker is what tells a
  // cleared photo (→ NULL, avatar falls back to the initial) from a form that
  // never showed the photo at all.
  if (form.has(PRESENCE_MARKERS.profile_photo_url)) {
    const raw = form.get('profile_photo_url');
    patch.profile_photo_url = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  }
  // Birthday: empty → NULL; anything that is not a clean YYYY-MM-DD is
  // refused rather than half-saved.
  if (form.has('birth_date')) {
    const raw = form.get('birth_date');
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return { ok: false, error: 'Birthday must be a valid date (YYYY-MM-DD).' };
    }
    patch.birth_date = s || null;
  }

  // ── Guest details — optional, REFERENCE-ONLY sensitive PI (RA 10173 §3(l)).
  // Unknown/empty → null (the "prefer not to say" / withdrawal state). Consent
  // is stamped per field on the transition to a value, cleared on withdrawal.
  const sensitive: Array<{
    field: 'religion' | 'civil_status' | 'sex' | 'dietary_restrictions';
    consentColumn: string;
    value: () => string | null;
  }> = [
    { field: 'religion', consentColumn: 'religion_consent_at', value: () => normalizeReligion(form.get('religion')) },
    {
      field: 'civil_status',
      consentColumn: 'civil_status_consent_at',
      value: () => normalizeCivilStatus(form.get('civil_status')),
    },
    { field: 'sex', consentColumn: 'sex_consent_at', value: () => normalizeSex(form.get('sex')) },
    // ⚠ Dietary text is HEALTH DATA under RA 10173 — bounded to the column's
    // 300-char CHECK so a long paste is refused here, not by the database.
    {
      field: 'dietary_restrictions',
      consentColumn: 'dietary_restrictions_consent_at',
      value: () => trimmedOrNull(form.get('dietary_restrictions'), 300),
    },
  ];
  for (const { field, consentColumn, value } of sensitive) {
    if (!form.has(field)) continue;
    const next = value();
    patch[field] = next;
    const c = consentPatch(next, existing?.[field] ?? null, nowIso);
    if (c.consent_at !== undefined) patch[consentColumn] = c.consent_at;
  }
  // Meal: the SAME enum the guest row uses — an unrecognised value is dropped.
  if (form.has('meal_preference')) {
    const raw = form.get('meal_preference');
    patch.meal_preference =
      typeof raw === 'string' && MEAL_PREFERENCES.includes(raw as MealPreference)
        ? (raw as MealPreference)
        : null;
  }

  // ── The two opt-ins — markered, because unchecked posts nothing ─────────
  if (form.has(PRESENCE_MARKERS.public_greeting_opt_in)) {
    patch.public_greeting_opt_in = form.get('public_greeting_opt_in') === 'on';
  }
  if (form.has(PRESENCE_MARKERS.marketing_opt_in)) {
    const optIn = form.get('marketing_opt_in') === 'on';
    patch.marketing_opt_in = optIn;
    // RA 10173 durable proof-of-consent: stamp only on an actual transition.
    const wasOptedIn = existing?.marketing_opt_in === true;
    if (optIn && !wasOptedIn) patch.marketing_consent_at = nowIso;
    else if (!optIn && wasOptedIn) patch.marketing_consent_at = null;
  }

  patch.updated_at = nowIso;
  return { ok: true, patch };
}
