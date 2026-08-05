/**
 * vendor-compatibility.ts — the ONE vocabulary behind a shop's two "what am I
 * a fit for" declarations: `vendor_profiles.compatible_venue_settings` and
 * `vendor_profiles.compatible_ceremony_types`.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Both columns shipped in iteration 0043 with a reader, a filter, a validator
 * and a public badge — and **no writer**. The full-form editor that once posted
 * them (`/vendor-dashboard/profile`) was retired 2026-07-05, its action
 * (`saveVendorProfile`) has had no caller since, and the inline editor that
 * replaced it never carried these two fields. So for months every shop matched
 * on whatever the seed happened to leave in the column: both live profiles hold
 * the IDENTICAL array `["banquet_hall","garden","heritage"]` and one of them is
 * literally named "(FIXTURE)". The marketplace's venue matching was running on
 * a fixture nobody chose and nobody could change.
 *
 * That is the fourth instance of the same shape in one week — a column with a
 * reader and no writer (`live_media_public`, `papic_face_mode`, the admin venue
 * picker). The fix is a control; this file is the vocabulary it speaks, kept in
 * one place so the picker, the server allowlist and the public badge cannot
 * disagree about what a value is called.
 *
 * ── EMPTY MEANS "OPEN TO ALL", AND THAT IS LOAD-BEARING ─────────────────────
 * `parseCompatibility` returns NULL, never `[]`, when nothing is ticked —
 * because the read side asks `compatible_venue_settings.is.null,…cs.{setting}`.
 * A NULL matches every couple; an empty array matches nobody. Getting this
 * backwards would silently delete a shop from the marketplace rather than open
 * it up, and the shop owner would see a saved form and no explanation.
 */

import { FAITH_LABELS, ALLOWED_CEREMONY_VALUES } from './faith-registry';
import { VENUE_SETTINGS, VENUE_SETTING_LABEL } from './venue-settings';

/**
 * Every reception setting a shop may declare, in the couple's own order.
 * Re-exported (not re-typed) from `venue-settings.ts` on purpose: the couple's
 * list IS the vendor's list, or the two sides can never match.
 */
export const COMPATIBLE_VENUE_SETTINGS = VENUE_SETTINGS;

/** Long-form venue labels — the same words the couple saw when they chose. */
export const COMPATIBLE_VENUE_SETTING_LABEL = VENUE_SETTING_LABEL;

/**
 * Every ceremony a shop may declare: all 16 registry faiths plus the two
 * non-faith forms. Derived from `ALLOWED_CEREMONY_VALUES`, which is itself
 * locked to the `events_ceremony_type_check` DB constraint — so this list can
 * never offer a value the database would reject.
 *
 * Unlaunched faiths ARE offered here. A photographer saying "yes, I shoot Hindu
 * weddings" is useful information before we open that faith to couples, and the
 * server allowlist accepts all 18 regardless.
 */
export const COMPATIBLE_CEREMONY_TYPES: readonly string[] = ALLOWED_CEREMONY_VALUES;

/**
 * key → display label. Faith labels come from the registry (one source with the
 * couple's own chips); the two non-faith forms are named here because they are
 * not faiths and have no registry entry.
 */
export const COMPATIBLE_CEREMONY_TYPE_LABEL: Readonly<Record<string, string>> = {
  ...FAITH_LABELS,
  civil: 'Civil',
  mixed: 'Mixed / interfaith',
};

/** Server-side allowlists. Built FROM the vocabulary, never re-typed beside it. */
export const ALLOWED_VENUE_SETTINGS: ReadonlySet<string> = new Set(COMPATIBLE_VENUE_SETTINGS);
export const ALLOWED_CEREMONY_TYPES: ReadonlySet<string> = new Set(COMPATIBLE_CEREMONY_TYPES);

/**
 * Parse repeated checkbox values into a clean compatibility array.
 *
 * Returns NULL (not `[]`) when nothing survives, so the marketplace filter
 * reads this shop as "open to all" rather than "compatible with none" — see the
 * header. Anything outside `allowed` is dropped rather than rejected: a stale
 * client posting a retired key should not block a shop from saving the keys it
 * got right.
 */
export function parseCompatibility(
  raw: readonly unknown[],
  allowed: ReadonlySet<string>,
): string[] | null {
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!allowed.has(trimmed)) continue;
    if (out.includes(trimmed)) continue;
    out.push(trimmed);
  }
  return out.length > 0 ? out : null;
}
