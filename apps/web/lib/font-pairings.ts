/**
 * lib/font-pairings.ts — STUDIO › LOOK › ELEMENTS: THE FOUR FONT ROWS, AND THE PAIRING THAT FILLS THEM.
 *
 * Owner, 2026-10-08, round 5 (contract `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.E): Names · Headings ·
 * Text · Labels & buttons, each its own ▾, and **Fonts ▾** above them — the shipped themes' own pairings
 * (`INVITE_THEMES[id].fonts`), one tap that fills all four; any row can then be changed alone.
 *
 * WHERE EACH IS STORED (`lib/site-roles.ts`): Names = `events.site_font_key`; Headings · Text · Labels & buttons =
 * `events.site_roles.{heading,body,highlight}.font`. A row with nothing stored wears the page's own.
 *
 * 🔑 HEADINGS FOLLOW NAMES while they have no font of their own (the guest page's rule,
 * `lib/site-role-look.ts`) — so a choice whose Headings equal its Names stores NO heading font: one fact, once.
 *
 * A pairing is `{heading, body, labels}` of a theme: `heading` fills Names and Headings, `body` fills Text,
 * `labels` fills Labels & buttons. The page's OWN theme's pairing is "nothing chosen" — every row handed back.
 * Only pairings whose three faces are in the font catalogue are offered, so the set can be worn exactly.
 *
 * Read only by the lazily-loaded rows — never by the draft library. Pure.
 * Held by `lib/the-four-fonts-reach-the-page.test.ts`.
 */
import type { HubFontKey } from './hub-fonts';
import { hubFontKeyForFamily } from './hub-font-shelves';
import { INVITE_THEMES, INVITE_THEME_IDS, type InviteThemeId } from './invite-themes';
import { sanitizeSiteRoles, type SiteRoles } from './site-roles';

export const FONT_ROWS = ['names', 'heading', 'body', 'highlight'] as const;
export type FontRow = (typeof FONT_ROWS)[number];

export const FONT_ROW_LABEL: Readonly<Record<FontRow, string>> = {
  names: 'Names',
  heading: 'Headings',
  body: 'Text',
  highlight: 'Labels & buttons',
};

/** What a row reads when nothing of its own is stored: the page's own face — or, for Headings, the Names'. */
export const FONT_ROW_LEAD: Readonly<Record<FontRow, string>> = {
  names: 'Event Hub font',
  heading: 'Same as Names',
  body: 'Event Hub font',
  highlight: 'Event Hub font',
};

/** The four rows as the panel holds them — null = nothing of its own. */
export type FontChoice = Record<FontRow, HubFontKey | null>;

/** The stored pair → the four rows. */
export function fontChoiceOf(fontKey: HubFontKey | null, rolesRaw: unknown): FontChoice {
  const roles = sanitizeSiteRoles(rolesRaw);
  return { names: fontKey, heading: roles?.heading?.font ?? null, body: roles?.body?.font ?? null, highlight: roles?.highlight?.font ?? null };
}

/**
 * The four rows → what ONE draft write stores. Headings equal to Names is not stored (it IS "follows Names");
 * a value with no role left is `null`, never `{}`.
 */
export function fontChoiceWrite(choice: FontChoice): { site_font_key: HubFontKey | null; site_roles: SiteRoles | null } {
  const roles: SiteRoles = {};
  if (choice.heading && choice.heading !== choice.names) roles.heading = { font: choice.heading };
  if (choice.body) roles.body = { font: choice.body };
  if (choice.highlight) roles.highlight = { font: choice.highlight };
  return { site_font_key: choice.names, site_roles: sanitizeSiteRoles(roles) };
}

export type FontPairing = { id: InviteThemeId; name: string; faces: string; choice: FontChoice };

const NOTHING: FontChoice = { names: null, heading: null, body: null, highlight: null };

/** The pairings a page may pick: its own theme's (every row handed back) and every other theme's that can be worn exactly. */
export function fontPairings(own: InviteThemeId): FontPairing[] {
  const out: FontPairing[] = [];
  for (const id of INVITE_THEME_IDS) {
    const t = INVITE_THEMES[id];
    const faces = `${t.fonts.heading} & ${t.fonts.body}`;
    if (id === own) {
      out.push({ id, name: t.name, faces, choice: NOTHING });
      continue;
    }
    const heading = hubFontKeyForFamily(t.fonts.heading);
    const body = hubFontKeyForFamily(t.fonts.body);
    const labels = hubFontKeyForFamily(t.fonts.labels);
    /* Headings follow Names — a pairing's heading face is the Names', and the Headings row keeps nothing of its own. */
    if (heading && body && labels) out.push({ id, name: t.name, faces, choice: { names: heading, heading: null, body, highlight: labels } });
  }
  return out;
}

const sameWrite = (a: FontChoice, b: FontChoice) => JSON.stringify(fontChoiceWrite(a)) === JSON.stringify(fontChoiceWrite(b));

/** Which pairing the four rows are, or null — "Your own mix". Compared as they would be STORED. */
export function fontPairingOf(own: InviteThemeId, choice: FontChoice): InviteThemeId | null {
  return fontPairings(own).find((p) => sameWrite(p.choice, choice))?.id ?? null;
}

export const FONT_PAIRING_MIXED = 'Your own mix';

/** Behind the Fonts row's ⓘ — what each row changes, in as few words as it takes. */
export const FONT_ROWS_INFO =
  'Names: your names on the cover. Headings: section titles. Text: details, the date, links. Labels & buttons: small capitals and every button. Codes and countdown digits stay as they are.';
