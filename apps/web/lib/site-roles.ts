/**
 * lib/site-roles.ts — THE FONTS A COUPLE CHOSE BEYOND THEIR NAMES (`events.site_roles`).
 *
 * Owner, 2026-10-08, round 5 (DECISION_LOG "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E): *"i think there are more than just 2 types of fonts to
 * edit"* → four rows in Studio › Look › Elements:
 *
 *   Names            → `events.site_font_key`            (its own column, since before this — NOT in here)
 *   Headings         → `site_roles.heading.font`
 *   Text             → `site_roles.body.font`
 *   Labels & buttons → `site_roles.highlight.font`
 *
 * FONTS ONLY (controller's ruling, 2026-10-08): `{ heading:{font}, body:{font}, highlight:{font} }`. The column was
 * first drawn for per-role colours and a separate button font (#6442, never shipped; measured on production the
 * night this was written: 0 of 16 events held any value) — every other key, and every other field, is dropped on
 * read. An absent role = the page wears what it wears today; an empty value is never stored — that IS `null`.
 * What a font does on the page is `lib/site-role-look.ts`.
 *
 * Pure, and deliberately tiny: the draft library reads this sanitiser, and the draft library is in the Maker's
 * first load.
 */
import { isHubFontKey, type HubFontKey } from '@/lib/hub-fonts';

export const SITE_FONT_ROLES = ['heading', 'body', 'highlight'] as const;
export type SiteFontRole = (typeof SITE_FONT_ROLES)[number];
export type SiteRoles = Partial<Record<SiteFontRole, { font: HubFontKey }>>;

/** The stored value, made safe: the three roles, a real font key each, nothing else. `null` = nothing chosen. */
export function sanitizeSiteRoles(raw: unknown): SiteRoles | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: SiteRoles = {};
  for (const role of SITE_FONT_ROLES) {
    const font = (raw as Record<string, { font?: unknown } | null | undefined>)[role]?.font;
    if (isHubFontKey(font)) out[role] = { font };
  }
  return Object.keys(out).length > 0 ? out : null;
}
