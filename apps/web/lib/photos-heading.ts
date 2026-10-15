/**
 * apps/web/lib/photos-heading.ts
 *
 * ✍ THE PHOTOS SCENE'S OWN HEADING (owner 2026-10-15, DECISION_LOG "GLIMPSE PHOTO STYLE APPROVED; THE PHOTOS SCENE
 * GETS A TYPED HEADING"): *"Add a heading field"* — the couple types a heading for their photos (e.g. "Glimpse of
 * Us") and EVERY Photos style shows it, under the scene's small "Our photos" line. Empty = today's scene, exactly.
 *
 * 🔑 NO MIGRATION, NO COLUMN. It is one key on the scene's own row — `config_json.photos_heading` on the `our_photos`
 * row, the same home the Save the Date's Film · Photos pick has (`config_json.std_lead`, `lib/stage-scenes.ts`). It is
 * drafted like every Maker edit (`HubDraftWidget.photos_heading`, `lib/hub-draft.ts`) and reaches guests at ✓ Apply.
 * Words, never look — never Pro.
 *
 * Pure. No I/O, no imports — the guest page, the draft and the Maker's typing all read it.
 */

export const PHOTOS_HEADING_KEY = 'photos_heading';
/** The longest heading — a scene of their own's heading (`CUSTOM_COLUMN_TITLE_MAX`), held equal by the test. */
export const PHOTOS_HEADING_MAX = 80;
/** What the Photos scene says above the photos, typed or not — its small line, unchanged. */
export const PHOTOS_EYEBROW = 'Our photos';

const isPlain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/**
 * A heading as it is kept: one line, trimmed, inner runs of space made one. Null = no heading (an empty string, a
 * non-string, control characters, or words over the cap — dropped, never cut: a heading nobody typed is not one).
 */
export function sanitizePhotosHeading(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length === 0 || t.length > PHOTOS_HEADING_MAX) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(t)) return null;
  return t;
}

/** The heading kept on a row's `config_json`, or null. */
export function photosHeadingOf(configJson: unknown): string | null {
  return isPlain(configJson) ? sanitizePhotosHeading(configJson[PHOTOS_HEADING_KEY]) : null;
}

/** The heading kept on the `our_photos` row of a list of rows, or null. */
export function storedPhotosHeading(rows: readonly { widget_type: string; config_json?: unknown }[]): string | null {
  const row = rows.find((r) => r.widget_type === 'our_photos');
  return row ? photosHeadingOf(row.config_json) : null;
}

/** `config_json` with the heading set (null = back to none); every sibling key kept. */
export function configWithPhotosHeading(config: unknown, heading: string | null): Record<string, unknown> {
  const base = isPlain(config) ? { ...config } : {};
  if (heading === null) delete base[PHOTOS_HEADING_KEY];
  else base[PHOTOS_HEADING_KEY] = heading;
  return base;
}
