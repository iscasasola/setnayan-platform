/**
 * lib/site-role-look.ts — WHAT A ROLE'S OWN FONT AND COLOUR DO ON THE PAGE.
 *
 * `events.site_roles` (`lib/site-roles.ts`) → the custom properties the guest
 * page already reads, layered LAST over the palette and the couple's colours
 * (`app/[slug]/_lib/loaders.ts` `guestLookFrom`), plus the marks the look scope
 * wears (`data-hub-roles`) for the three things no existing variable reaches:
 *
 *   Details    font   → `--font-body` (+ mark `body`: the scope's own
 *                        `font-family` and `--font-sans` follow it)
 *              colour → `--color-ink` — the page's ink, which every scene with a
 *                        ground of its own re-sets for itself (`sceneLegibilityVars`)
 *   Highlights font   → `--font-mono` (eyebrows; + mark `eyebrow`)
 *              colour → `--color-terracotta` and its two steps (eyebrows · links)
 *   Buttons    font   → `--hub-role-button-font` (+ mark `button`)
 *   Headings   colour → `--hub-heading` (+ mark `heading`: the headings that
 *                        wear the PAGE's ink wear it instead — `globals.css`)
 *
 * 🔑 NOTHING SET, NOTHING EMITTED. `null` roles give `{}` and no mark, so a page
 * whose couple never chose is byte-identical to before this existed.
 *
 * A role's colour is worn AS PICKED — the Maker says, beside the pick, whether
 * it reads (the AA badge, `siteRoleContrast`); the page never moves it.
 *
 * Pure. Held by `lib/elements-are-roles.test.ts`.
 */
import { contrastRatio } from '@/lib/hub-legibility';
import { HUB_FONT_BY_KEY, HUB_FONTS, type HubFontKey } from '@/lib/hub-fonts';
import { INVITE_THEMES, INVITE_THEME_IDS, type InviteTheme, type InviteThemeId } from '@/lib/invite-themes';
import { channels, hubThemePageTokens } from '@/lib/hub-theme-tokens';
import { SITE_ROLES, type SiteRole, type SiteRoles } from '@/lib/site-roles';

export const SITE_ROLE_LABEL: Readonly<Record<SiteRole, string>> = {
  heading: 'Headings',
  body: 'Details',
  button: 'Buttons',
  highlight: 'Highlights',
};

function mix(hex: string, toward: 0 | 255, t: number): string {
  return [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + toward * t)).join(' ');
}
const face = (key: HubFontKey) => `var(${HUB_FONT_BY_KEY[key].cssVar}), ${HUB_FONT_BY_KEY[key].fallback}`;

/** A role's face as CSS — for the role's own sample in the Maker (the page gets it through `siteRoleVars`). */
export const siteRoleFaceStack = face;

/** The custom properties a page's roles add — `{}` when nothing is overridden. */
export function siteRoleVars(roles: SiteRoles | null, page: { paper: string }): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!roles) return vars;
  if (roles.body?.font) vars['--font-body'] = face(roles.body.font);
  if (roles.body?.color) vars['--color-ink'] = channels(roles.body.color);
  if (roles.highlight?.font) vars['--font-mono'] = face(roles.highlight.font);
  if (roles.highlight?.color) {
    /* The hover and pressed steps move AWAY from the paper, as the palette's do (`buildSitePaletteVars`). */
    const away = contrastRatio('#000000', page.paper) >= contrastRatio('#ffffff', page.paper) ? 0 : 255;
    vars['--color-terracotta'] = channels(roles.highlight.color);
    vars['--color-terracotta-600'] = mix(roles.highlight.color, away, 0.12);
    vars['--color-terracotta-700'] = mix(roles.highlight.color, away, 0.24);
  }
  if (roles.button?.font) vars['--hub-role-button-font'] = face(roles.button.font);
  if (roles.heading?.color) vars['--hub-heading'] = roles.heading.color;
  return vars;
}

/** The marks the look scope wears (`data-hub-roles`, space-separated) — `null` when none is needed. */
export function siteRoleMarks(roles: SiteRoles | null): string | null {
  if (!roles) return null;
  const marks = [
    roles.heading?.color ? 'heading' : null,
    roles.body?.font ? 'body' : null,
    roles.button?.font ? 'button' : null,
    roles.highlight?.font ? 'eyebrow' : null,
  ].filter(Boolean);
  return marks.length > 0 ? marks.join(' ') : null;
}

/* ── AA — said beside the pick, never enforced on the page ─────────────── */

/** The least a role's words may stand off their ground: body-size words 4.5, large words (names, titles, eyebrows) 3. */
export const SITE_ROLE_AA: Readonly<Record<SiteRole, number>> = { heading: 3, body: 4.5, button: 4.5, highlight: 3 };

/** A role's contrast against what it sits on, and whether it clears its bar. */
export function siteRoleContrast(role: SiteRole, colour: string, ground: string): { ratio: number; passes: boolean } {
  const ratio = contrastRatio(colour, ground);
  return { ratio, passes: ratio >= SITE_ROLE_AA[role] };
}

/* ── PAIRING ▾ — the shipped theme pairings, applied as a set ──────────── */

export type FontPairing = {
  id: InviteThemeId;
  /** "Luxe". */
  name: string;
  /** "Bodoni Moda & Cormorant Garamond". */
  faces: string;
  /** The catalogue key of each role's face — null where the page's own theme supplies it. */
  heading: HubFontKey | null;
  body: HubFontKey | null;
  labels: HubFontKey | null;
};

const keyOfFamily = (family: string): HubFontKey | null => HUB_FONTS.find((f) => f.family === family)?.key ?? null;

/**
 * The pairings a page may pick: its OWN theme's (nothing overridden — the theme
 * supplies every face) and every other theme's whose three faces are in the
 * font catalogue, so the set can be worn exactly. No new data: a pairing is
 * `INVITE_THEMES[id].fonts`, and Buttons wear the body face.
 */
export function fontPairings(own: InviteThemeId): FontPairing[] {
  const out: FontPairing[] = [];
  for (const id of INVITE_THEME_IDS) {
    const t = INVITE_THEMES[id];
    const faces = `${t.fonts.heading} & ${t.fonts.body}`;
    if (id === own) {
      out.push({ id, name: t.name, faces, heading: null, body: null, labels: null });
      continue;
    }
    const heading = keyOfFamily(t.fonts.heading);
    const body = keyOfFamily(t.fonts.body);
    const labels = keyOfFamily(t.fonts.labels);
    if (heading && body && labels) out.push({ id, name: t.name, faces, heading, body, labels });
  }
  return out;
}

/** Which pairing the page wears now — its own while no font is overridden, a theme's when all four match, else none. */
export function fontPairingOf(own: InviteThemeId, fonts: { heading: HubFontKey | null; roles: SiteRoles | null }): InviteThemeId | null {
  const now = { heading: fonts.heading, body: fonts.roles?.body?.font ?? null, labels: fonts.roles?.highlight?.font ?? null, button: fonts.roles?.button?.font ?? null };
  const match = fontPairings(own).find((p) => p.heading === now.heading && p.body === now.body && p.labels === now.labels && p.body === now.button);
  return match?.id ?? null;
}

/**
 * What ONE pairing pick writes: the Headings font (its own column) and the
 * roles with every font set to the pairing's and every colour handed back to
 * the Mood Board's — "sets every role at once; a pairing never locks anything".
 */
export function fontPairingWrite(pairing: FontPairing): { site_font_key: HubFontKey | null; site_roles: SiteRoles | null } {
  const roles: SiteRoles = {};
  if (pairing.body) {
    roles.body = { font: pairing.body };
    roles.button = { font: pairing.body };
  }
  if (pairing.labels) roles.highlight = { font: pairing.labels };
  return { site_font_key: pairing.heading, site_roles: Object.keys(roles).length > 0 ? roles : null };
}

/* ── WHAT THE PAGE WEARS WITH NOTHING OVERRIDDEN — the defaults Elements shows ── */

/** What each role wears while the couple has overridden nothing — measured from the page's own look. */
export type ElementsWears = {
  /** The page colour the words sit on. */
  paper: string;
  /** The page's ink — what Details AND Headings wear today. */
  ink: string;
  /** The accent eyebrows and links wear. */
  accent: string;
  /** The button as it paints: its label over its fill (or, for an outline, its colour over the paper). */
  button: { fg: string; bg: string };
  /** The catalogue key of each face the page's theme supplies — null where it is not in the catalogue. */
  faces: { heading: HubFontKey | null; body: HubFontKey | null; labels: HubFontKey | null };
};

/**
 * What House's page wears with no palette — `globals.css` `:root` `--color-ink` and `--color-terracotta`, read
 * here as hex and HELD EQUAL to the stylesheet by the guard (a default shown in the Maker must be the colour
 * the page paints, never a neighbour of it).
 */
export const HOUSE_ROOT = { ink: '#2c2a29', accent: '#a9834b' } as const;

const HEX6 = /^#[0-9a-f]{6}$/i;
const hexOfChannels = (ch: string | undefined, fallback: string): string => {
  const parts = (ch ?? '').trim().split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ? `#${parts.map((n) => n.toString(16).padStart(2, '0')).join('')}`
    : fallback;
};

/**
 * Read what the page wears off its OWN resolved look — the variables the guest
 * page paints with (`guestLookFrom`, asked WITHOUT the roles), the buttons as
 * resolved (`resolveHubButtons`), and the theme's own tokens where the look
 * sets none. Never a second derivation of a colour.
 */
export function elementsWears(input: {
  /** The theme the page wears, as the Mood Board dresses it (`dressedTheme`). */
  theme: InviteTheme;
  /** The look's variables with no role override (`GuestLook.vars`). */
  vars: Record<string, string> | null;
  /** The resolved buttons' variables (`GuestLook.buttons?.vars`) — null = the theme's own button. */
  buttonVars: Record<string, string> | null;
  /** The page as its buttons are measured (`hubButtonPage`): the paper they sit on and the fill they wear by default. */
  page: { paper: string; fill: string };
}): ElementsWears {
  const v = input.vars ?? {};
  const paper = input.page.paper;
  /* What the look leaves to the STYLESHEET: a painted theme's block is generated from `hubThemePageTokens`
     (held to the stylesheet by `invite-themes.test.ts`); House has no block — its page wears the root tokens. */
  const sheet = input.theme.id === 'house' ? HOUSE_ROOT : { ink: hubThemePageTokens(input.theme).ink, accent: hubThemePageTokens(input.theme).eyebrow };
  const ink = hexOfChannels(v['--color-ink'], sheet.ink);
  const accent = hexOfChannels(v['--color-terracotta'], sheet.accent);
  const b = input.buttonVars ?? {};
  const fill = b['--hub-btn-fill'];
  const label = b['--hub-btn-label'];
  /* A chosen paint: its label over its fill — or, an outline, its colour over the page. Else the theme's own
     button: the page colour as the label over the call-to-action colour (`.button-primary`). */
  const button =
    label && HEX6.test(label)
      ? { fg: label, bg: fill && HEX6.test(fill) ? fill : paper }
      : { fg: paper, bg: input.page.fill };
  const t = input.theme;
  return {
    paper,
    ink,
    accent,
    button,
    faces: { heading: keyOfFamily(t.fonts.heading), body: keyOfFamily(t.fonts.body), labels: keyOfFamily(t.fonts.labels) },
  };
}

export { SITE_ROLES };
