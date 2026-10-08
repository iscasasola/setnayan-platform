/**
 * lib/site-roles.ts — A ROLE'S OWN FONT AND COLOUR (`events.site_roles`).
 *
 * Owner 2026-10-08 (DECISION_LOG "APPROVED — THE LOOK RESTUDY: BACKGROUND ·
 * ELEMENTS · MUSIC"; contract `BACKGROUND_RESTUDY_2026-10-08_fable.md` § 2.2,
 * § 3.5, § 6 row 3), verbatim: *"colors here is not color of the background but
 * the colors of the different fonts, and buttons and highlights"* · *"fonts
 * will be multiple fonts like, details, button font, header font, etc."*
 *
 * Elements is organised by ROLE — Headings · Details · Buttons · Highlights —
 * and each role may wear a font and a colour of its own. This file is the
 * SHAPE and its one sanitiser; what a role does on the guest page is
 * `lib/site-role-look.ts`.
 *
 * 🔑 ONLY WHAT HAD NO HOME. Three role facts already have a column and are NOT
 * in here — one fact, one column (migration `20271266068325`):
 *   · the Headings FONT is `events.site_font_key`;
 *   · the Buttons FILL is `events.site_button_color`, their SHAPE `site_button_style`.
 * And the Mood Board's five (`events.role_palette.reception`) are the palette
 * every role's DEFAULT is derived from — not a role's own pick.
 *
 *   { heading:   { color },
 *     body:      { font, color },
 *     button:    { font },
 *     highlight: { font, color } }
 *
 * Absent = nothing overridden: the page wears exactly what it wears today. An
 * empty role, and an empty object, are never stored — that IS `null`.
 *
 * Pure, and deliberately small: the draft library reads the sanitiser, and the
 * draft library is in the Maker's first load.
 */
import { isHubFontKey, type HubFontKey } from '@/lib/hub-fonts';

export const SITE_ROLES = ['heading', 'body', 'button', 'highlight'] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

/** What each role may override — nothing else is ever kept. */
export const SITE_ROLE_FIELDS = {
  heading: ['color'],
  body: ['font', 'color'],
  button: ['font'],
  highlight: ['font', 'color'],
} as const satisfies Record<SiteRole, readonly ('font' | 'color')[]>;

export type SiteRoleField = 'font' | 'color';
export type SiteRoles = {
  heading?: { color?: string };
  body?: { font?: HubFontKey; color?: string };
  button?: { font?: HubFontKey };
  highlight?: { font?: HubFontKey; color?: string };
};

const HEX6 = /^#[0-9a-f]{6}$/i;

/** The stored value, made safe: known roles, known fields, a real font key, a plain hex. `null` = nothing. */
export function sanitizeSiteRoles(raw: unknown): SiteRoles | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, Record<string, string>> = {};
  for (const role of SITE_ROLES) {
    const given = (raw as Record<string, unknown>)[role];
    if (!given || typeof given !== 'object' || Array.isArray(given)) continue;
    const kept: Record<string, string> = {};
    for (const field of SITE_ROLE_FIELDS[role] as readonly SiteRoleField[]) {
      const v = (given as Record<string, unknown>)[field];
      if (field === 'font' && isHubFontKey(v)) kept.font = v;
      if (field === 'color' && typeof v === 'string' && HEX6.test(v.trim())) kept.color = v.trim().toLowerCase();
    }
    if (Object.keys(kept).length > 0) out[role] = kept;
  }
  return Object.keys(out).length > 0 ? (out as SiteRoles) : null;
}

/** One field of one role, set (or, with `null`, handed back to the page's own). The whole value, sanitised. */
export function withSiteRole(roles: SiteRoles | null, role: SiteRole, field: SiteRoleField, value: string | null): SiteRoles | null {
  const next: Record<string, Record<string, string>> = {};
  for (const r of SITE_ROLES) next[r] = { ...((roles?.[r] as Record<string, string> | undefined) ?? {}) };
  if (value === null) delete next[role]![field];
  else next[role]![field] = value;
  return sanitizeSiteRoles(next);
}
