/**
 * lib/site-role-look.ts — WHAT THE COUPLE'S FOUR FONTS DO ON A GUEST'S PAGE.
 *
 *   Names            `events.site_font_key`      → `--hub-names-face`, worn by the big names on the three hero
 *                                                   surfaces (`[data-hub-names]`) — mark `names`
 *   Headings         `site_roles.heading.font`   → `--font-display` · `--pahina-face` (every heading that reads them)
 *   Text             `site_roles.body.font`      → `--font-body` — mark `body`
 *   Labels & buttons `site_roles.highlight.font` → `--font-mono` (eyebrows — mark `eyebrow`) and
 *                                                   `--hub-role-button-font` (buttons — mark `button`)
 *
 * The marks are what the look scope wears as `data-hub-roles`; `globals.css` ("THE COUPLE'S FOUR FONTS") keys one
 * small rule on each, for the things no existing variable reaches. The values ride the scope's inline bag.
 *
 * 🔑 NOTHING CHOSEN, NOTHING EMITTED: no font → `{}` and no mark, and the page is byte for byte what it was.
 *
 * 📌 THE FACT THIS FILE IS BUILT ON (measured in a browser, 2026-10-08 — on record in the changelog): until now
 * the couple's one "Headings font" (`site_font_key`) set `--font-display` and `--pahina-face` and so moved about two
 * hundred headings — but NOT their own names on the hero, which are drawn with `font-pahina`, a fixed Fraunces.
 * So:
 *   · HEADINGS FOLLOW NAMES WHILE THEY HAVE NO FONT OF THEIR OWN — the two variables stay `site_font_key`'s
 *     (`hubFontVars`, unchanged), exactly today's page; a Headings font, once chosen, takes them over;
 *   · NAMES NOW REACH THE NAMES — `data-hub-names` + one rule, only where a Names font was chosen.
 * The other ~100 `font-pahina` texts (venue names, small titles) are not touched by any row.
 *
 * Pure. Held by `lib/the-four-fonts-reach-the-page.test.ts`.
 */
import { HUB_FONT_BY_KEY, sanitizeHubFontKey, type HubFontKey } from '@/lib/hub-fonts';
import { sanitizeSiteRoles } from '@/lib/site-roles';

const face = (key: HubFontKey) => `var(${HUB_FONT_BY_KEY[key].cssVar}), ${HUB_FONT_BY_KEY[key].fallback}`;

export type SiteFontLook = {
  /** Custom properties for the scope's inline bag — `{}` when no font was chosen. Spread AFTER `hubFontVars`. */
  vars: Record<string, string>;
  /** `data-hub-roles` — the marks, space-separated; null when none is needed. */
  marks: string | null;
};

const NOTHING: SiteFontLook = { vars: {}, marks: null };

/** The four fonts → what the page wears for them. `fontKey` is `events.site_font_key`, `roles` is `events.site_roles`. */
export function siteFontLook(fontKey: unknown, rolesRaw: unknown): SiteFontLook {
  const names = sanitizeHubFontKey(fontKey);
  const roles = sanitizeSiteRoles(rolesRaw);
  if (!names && !roles) return NOTHING;
  const vars: Record<string, string> = {};
  const marks: string[] = [];
  if (names) {
    vars['--hub-names-face'] = face(names);
    marks.push('names');
  }
  if (roles?.heading) {
    /* Bare `var()`, as `hubFontVars` writes them — the consumers add their own fallbacks. */
    vars['--font-display'] = `var(${HUB_FONT_BY_KEY[roles.heading.font].cssVar})`;
    vars['--pahina-face'] = `var(${HUB_FONT_BY_KEY[roles.heading.font].cssVar})`;
  }
  if (roles?.body) {
    vars['--font-body'] = face(roles.body.font);
    marks.push('body');
  }
  if (roles?.highlight) {
    vars['--font-mono'] = face(roles.highlight.font);
    vars['--hub-role-button-font'] = face(roles.highlight.font);
    marks.push('eyebrow', 'button');
  }
  return { vars, marks: marks.length > 0 ? marks.join(' ') : null };
}
