/**
 * apps/web/app/[slug]/_lib/pro-site-vars.ts
 *
 * `proSiteVarsFor` — split out of `loaders.ts` (owner 2026-09-25 bg-colour
 * fix) so the couple's-colours math can be exercised directly in a test
 * without pulling in `loaders.ts`'s own import graph (the admin Supabase
 * client, `next/server`, and everything else a request-scoped loader needs).
 * Pure. No I/O, no `server-only` — every import below is a pure lib module.
 *
 * `loaders.ts` re-exports this so `proSiteVarsFor` stays a named export of
 * that module for any existing caller/comment that names it there.
 */
import { hubFontVars } from '@/lib/hub-fonts';
import { buildCustomSiteColorVars } from '@/lib/site-palette';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { hubLegibility } from '@/lib/hub-legibility';
import { themeBlockVars } from '@/lib/theme-colours';

/** `#rrggbb` → the `r g b` triplet every `--color-*` custom property holds —
 *  the same tiny formatter `lib/scene-legibility.ts` keeps privately, copied
 *  rather than imported so this stays a self-contained, directly-testable
 *  module (see the file docblock). */
function channels(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1]!, 16) : 0;
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/**
 * The couple's Event Hub colours and face, as inline custom properties — or
 * `null` when there is nothing to add.
 *
 * Website Pro net-new manual site colours (Launch settings §4.4 · PR-C).
 *
 * ⚠ owner 2026-09-25 "okay drop the numbers" / bg-colour fix: background
 * colour is FREE and paints for EVERY event (Event Hub Pro feature list:
 * "Free: … bg colour") — it used to be gated behind `proWatermarkHidden` along
 * with everything else here, so a free couple's saved `site_bg_color` was
 * silently never painted for a guest. The BUTTON colour joined it 2026-09-28
 * (the free-vs-Pro redraw), and the couple's FONT on 2026-10-05 ("Colors, and
 * Fonts are all free"). Candlelight / magic move (elsewhere) stay Pro-only.
 *
 * 🔑 TEXT COLOUR ADAPTS TO THE COUPLE'S OWN BACKGROUND TOO (lib/hub-legibility.ts
 * — owner 2026-09-25: *"did you already make the font color adapt also based
 * on the background?"*, ruled free for everyone). `buildSitePaletteVars` keeps
 * `--color-ink` a fixed espresso on purpose ("always dark → always high-
 * contrast on a light page") — safe only because a Mood-Board paper is always
 * near-white. A couple's own hex has no such guarantee, so once a background
 * colour is set, `hubLegibility`'s already-shipped flat-colour rule (the same
 * one the theme ground and the Maker's scene canvas already use) picks the
 * readable ink instead, keyed to the couple's active theme (Classic/House when
 * they have none).
 *
 * 🔴 AND `--color-ink-on-plate` MUST STAY PINNED, OR A PLATE GOES BLANK THE
 * OTHER WAY. `.pahina-plate` (the "When/Where" box, the reply card, …) keeps
 * its OWN light paper background regardless of the page's — `buildSitePaletteVars`
 * never darkens `--color-paper-deep`, and this function never touches it
 * either. `.pahina-plate`'s CSS reads `color: rgb(var(--color-ink-on-plate,
 * var(--color-ink)))` — a FALLBACK to the page ink. Screenshotted while
 * building this fix: once `--color-ink` above flips light (for a couple's
 * dark background), that fallback made every plate's "WHEN"/"WHERE" value
 * light text on the plate's OWN still-light paper — invisible, the same shape
 * `the-site-wears-the-doors-theme.test.ts` already guards for the ten themes
 * ("`--color-ink` must also declare `--color-ink-on-plate`, or the card
 * inherits the ground's ink and goes blank"). The fix there is NOT to reuse
 * the adapted page ink (that IS the bug): a plate is always light paper, so
 * its ink is pinned to the theme's own — the SAME dark ink every plate has
 * always used, decoupled from whatever the page background does.
 */
export function proSiteVarsFor(
  event: { site_bg_color?: unknown; site_button_color?: unknown; site_font_key?: unknown },
  proWatermarkHidden: boolean,
  themeId: InviteThemeId = 'house',
): Record<string, string> | null {
  const bgHex = typeof event.site_bg_color === 'string' ? event.site_bg_color : null;
  const theme = INVITE_THEMES[themeId] ?? INVITE_THEMES.house;
  // Built by plain assignment, never by spreading a conditional object —
  // a `cond ? {a} : {}` ternary infers a union where `a` is optional/undefined
  // on the empty branch, which `Record<string, string>` below then refuses.
  const proSiteVars: Record<string, string> = {};

  // FREE, for every event: the background colour itself, plus the page ink
  // that keeps text legible on it, plus a PINNED plate ink so a plate's own
  // still-light paper never inherits that adapted (possibly light) page ink.
  // 🎨 AND THE BUTTON COLOUR, since 2026-09-28 (owner: *"free to change …
  // color, background color, only when you start adding themes will it be
  // pro"*) — built in the same call as the background, for every event.
  /* 🔘 ONE SOURCE FOR THE BUTTONS' COLOUR (owner 2026-10-08, round 3: *"button color will be taken from their 5
     palette"*): a colour stored before that ruling (`events.site_button_color`) is NO LONGER READ — the buttons wear
     the palette's Accent, as the page deepens it. The column stays (no migration); nothing offers it any more.
     Measured on production the day this changed: 0 of 16 events held one. */
  const bgVars = buildCustomSiteColorVars(bgHex, null);
  if (bgVars) {
    Object.assign(proSiteVars, bgVars);
    if (bgHex) {
      const inkHex = hubLegibility(theme, { kind: 'color', hex: bgHex }).ink;
      proSiteVars['--color-ink'] = channels(inkHex);
      proSiteVars['--color-ink-on-plate'] = channels(theme.palette.ink);
    }
  }

  // 🔤 THE COUPLE'S OWN TYPEFACE RIDES THE SAME BAG (behind the Pro gate until
  // 2026-10-05; the button colour shared that gate until 2026-09-28). `hubFontVars` contributes `--pahina-face` / `--font-display`, which
  // `globals.css` and `tailwind.config.ts` already read; a theme's MATERIAL
  // (its colour tokens) is untouched, because a theme carries colour and this
  // carries type. One bag rather than two: it is delivered to the same
  // element, under the same Pro check, and a second would be a second place
  // for the two to disagree.
  // ⛔ An unset face contributes `{}`, so a couple who never chose one gets
  // markup byte-identical to before this existed — and `null` still means
  // "add no style attribute at all".
  // 🆓 FREE SINCE 2026-10-05 (owner, DECISION_LOG "THEMES ARE REPLACED BY THREE
  // DIRECT GLOBAL SETTINGS": *"Colors, and Fonts are all free"*): the couple's
  // face paints for every event, Pro or not. `proWatermarkHidden` no longer
  // gates anything in this bag.
  void proWatermarkHidden;
  Object.assign(proSiteVars, hubFontVars(event.site_font_key));

  return Object.keys(proSiteVars).length > 0 ? proSiteVars : null;
}

// ── THE PLATE KEEPS A READABLE INK (owner 2026-09-30, "I cannot see the venues") ──
//
// Measured on the live page (`cale-ice`, 390 px, 2026-09-30): the venue plates
// painted their NAME in rgb(243 231 220) on their own paper, rgb(240 237 232) —
// 1.1 : 1, i.e. invisible. Two layers disagreed about one fact:
//
//   · the theme (`[data-hub-theme='velvet']`, a DARK theme) pins the plate ink
//     LIGHT — right for velvet's own dark plate (`--color-paper-deep: 52 19 12`);
//   · the couple's mood-board palette (`buildSitePaletteVars`, spread inline on
//     the SAME element, so it wins) repaints the plate paper LIGHT and never
//     names a plate ink — so the theme's light one leaked onto light paper.
//
// No one layer is wrong on its own; the COMBINATION is. So the answer is taken
// where every layer has already been spread: `pinPlateInk` looks at the plate
// paper that will actually paint and keeps the plate ink only if it reads on
// it; otherwise it takes the first readable ink the theme itself offers. An
// event whose plate already reads is returned UNCHANGED (byte-identical).
//
// 🔒 Held by `lib/the-venue-cards-are-readable.test.ts`, which runs every
// theme × every colour source through `guestLookFrom` (the function the guest
// page itself calls) and measures the blended pixel of every venue word.

/** `r g b` channels (or `#rrggbb`) → relative luminance. */
function luminanceOf(value: string): number | null {
  const rgb = rgbOf(value);
  if (!rgb) return null;
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** `"r g b"` or `#rrggbb` → [r, g, b], or null. */
export function rgbOf(value: string): [number, number, number] | null {
  const v = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = v.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((p) => Number.isFinite(p)) ? (parts as [number, number, number]) : null;
}

/** WCAG contrast of two colours (channels or hex). 1 when either is unreadable. */
export function contrastOf(a: string, b: string): number {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  if (la == null || lb == null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The pixel `ink` at `alpha` paints over an opaque `ground`, as channels. */
export function blendOver(ink: string, ground: string, alpha: number): string {
  const i = rgbOf(ink);
  const g = rgbOf(ground);
  if (!i || !g) return ink;
  return i.map((c, k) => Math.round(c * alpha + g[k]! * (1 - alpha))).join(' ');
}

/**
 * The faintest a plate's words are drawn: `text-ink/65` (a venue's address, the
 * "When"/"Where" small print). An ink that reads at this alpha reads at every
 * stronger one (the name, the buttons).
 */
export const PLATE_MUTED_ALPHA = 0.65;
/** WCAG AA for body text. */
export const PLATE_MIN_CONTRAST = 4.5;

/** Does `ink` read on `plate` even at the faintest alpha a plate uses? */
export function plateInkReads(ink: string, plate: string): boolean {
  return contrastOf(blendOver(ink, plate, PLATE_MUTED_ALPHA), plate) >= PLATE_MIN_CONTRAST;
}

/**
 * The composed vars with `--color-ink-on-plate` guaranteed readable on the plate
 * paper that will actually paint (`--color-paper-deep` from `vars`, else the
 * theme's own surface). Unchanged when it already reads.
 */
export function pinPlateInk(
  vars: Record<string, string> | null,
  themeId: InviteThemeId = 'house',
): Record<string, string> | null {
  if (!vars) return vars;
  const theme = INVITE_THEMES[themeId] ?? INVITE_THEMES.house;
  const plate = vars['--color-paper-deep'] ?? channels(theme.palette.surface);
  const current = vars['--color-ink-on-plate'] ?? channels(theme.palette.ink);
  if (plateInkReads(current, plate)) return vars;
  const candidates = [
    channels(theme.palette.ink),
    channels(theme.palette.darkInk),
    channels(theme.palette.lightInk),
    ...(vars['--color-ink'] ? [vars['--color-ink']] : []),
    '17 17 17',
    '255 255 255',
  ];
  const readable = candidates.find((c) => plateInkReads(c, plate));
  const best =
    readable ?? candidates.reduce((a, b) => (contrastOf(b, plate) > contrastOf(a, plate) ? b : a));
  return { ...vars, '--color-ink-on-plate': best };
}

// ── THE WORDS FOLLOW THE PAPER THE PAGE ENDS WITH (2026-10-08, "dark on dark") ──
//
// Measured on the live page (`maria-and-jose`, 375 px, 2026-10-08), a Mood Board
// on a light paper wearing a DARK ombré: "Reply to the invitation" and "Get
// inside" painted rgb(30 34 41) on rgb(55 59 49) — 1.4 : 1 — and the footer's
// "See you soon." rgb(42 45 37) on the same dark page. Two layers disagreed
// about one fact, the same shape as the plate above:
//
//   · the theme block and the Mood Board size their coloured WORD tokens against
//     THEIR OWN paper — the button fill (`--color-mulberry*`) is "the colour its
//     `text-cream` label reads on" (the label IS the page's paper), and the
//     accent's deeper steps (`--color-terracotta-600/-700`) are moved AWAY from
//     that paper, darker on a light one;
//   · the couple's background (a plain colour, `proSiteVarsFor`; an ombré,
//     `ombreLook`) then replaces the paper and the ink — and nothing else. The
//     label became the new dark paper on a fill sized for a light one, and the
//     sign-off kept a step that had been moved toward black.
//
// No one layer is wrong on its own; the COMBINATION is. So, as for the plate,
// the answer is taken where every layer has already been spread.
//
// 🔑 THE RULE: A BACKGROUND NEVER MAKES A WORD HARDER TO READ THAN THE PAGE IT
// WAS LAID OVER DID — up to AA. (`lib/hub-theme-tokens.ts` holds the same rule
// one layer down: "a theme never makes a word harder to read than House makes
// it".) Each token is measured on the paper the page ends with, against what it
// read at on the paper it was sized for; one that still reads is left exactly as
// it is, and one that does not is moved AWAY from the paper — its own hue,
// lighter on a dark page and darker on a light one — only as far as it needs.
//
//   · a look whose paper never moved is returned UNCHANGED (the same object);
//   · a token the couple's own layer set (their button colour, the ombré's
//     accent) is that layer's answer and is never moved.
//
// 🔒 Held by `lib/a-dark-look-keeps-its-words.test.ts`, which resolves the
// cascade the browser resolves and measures every pair on every theme × every
// colour source.

/**
 * The tokens a guest page sets coloured WORDS in:
 *   · `--color-mulberry*`   — `.button-primary` (`bg-mulberry text-cream`: the
 *     label is the paper, so the FILL is what must read against it; `-600` is
 *     its hover) and every `text-mulberry` word — one pair, read both ways;
 *   · `--color-terracotta*` — eyebrows, links and the footer's sign-off;
 *   · `--color-link*`       — `.button-secondary` (`bg-cream text-link`) and inline links;
 *   · `--color-gild-text`   — every `text-gild` word: the "and" between the names,
 *     the programme's times, "Our colours" (`tailwind.config.ts` textColor.gild
 *     reads it before the ornament's `--color-gild`).
 *
 * 🔴 THE LAST ONE WAS MISSING UNTIL 2026-10-11. `--color-gild-text` became a WORD
 * token on 2026-10-05 (`buildSitePaletteVars`: the ornament's hue "moved until it
 * reads on the paper and the cards") and was never added here. So when a
 * background took the page to the other side, every other word followed and
 * this one stayed where the Mood Board had sized it for a LIGHT paper. Measured
 * on the live sample event (a rose board under a dark ombré): the "and" between
 * the names, the programme's times and "Our colours" all painted rgb(63 58 52)
 * on rgb(30 34 41) — 1.4 : 1. The ombré names the ORNAMENT (`--color-gild`) and
 * says nothing about its words; that is this list's job.
 */
export const WORD_INK_TOKENS: readonly string[] = [
  '--color-mulberry',
  '--color-mulberry-600',
  '--color-mulberry-700',
  '--color-terracotta',
  '--color-terracotta-600',
  '--color-terracotta-700',
  '--color-link',
  '--color-link-600',
  '--color-gild-text',
];

/**
 * The same tokens as the STYLESHEET gives them before any theme: House's
 * `:root`, and Pahina's candlelight direction, which re-points the button and
 * the accent's deeper steps at its gild. (A theme's are `themeBlockVars`; a
 * Mood Board's are `buildSitePaletteVars`.) The test re-reads `globals.css` and
 * fails if a channel here drifts from it.
 */
export const HOUSE_WORD_TOKENS: Readonly<Record<string, string>> = {
  '--color-cream': '255 255 255',
  '--color-mulberry': '194 78 37',
  '--color-mulberry-600': '176 71 34',
  '--color-mulberry-700': '157 63 30',
  '--color-terracotta': '169 131 75',
  '--color-terracotta-600': '168 131 64',
  '--color-terracotta-700': '140 105 50',
  '--color-link': '59 78 103',
  '--color-link-600': '48 64 85',
  // House names only the ornament's gild; its words fall back to it (`pageWordBase`).
  '--color-gild': '169 131 75',
  // The two surfaces that keep a ground of their own under the page's (`pinSurfaceWordInks`).
  '--color-paper-deep': '241 241 240',
  '--color-veil': '243 236 225',
};
export const CANDLELIGHT_WORD_TOKENS: Readonly<Record<string, string>> = {
  '--color-cream': '24 22 20',
  '--color-gild': '201 163 106',
  '--color-gild-text': '201 163 106',
  '--color-paper-deep': '33 30 27',
  '--color-veil': '44 39 34',
  '--color-mulberry': '201 163 106',
  '--color-mulberry-600': '201 163 106',
  '--color-mulberry-700': '201 163 106',
  '--color-terracotta-600': '201 163 106',
  '--color-terracotta-700': '201 163 106',
};

/**
 * What the cascade resolves for the word tokens UNDER the couple's background:
 * `:root` → candlelight → the theme's block → the Mood Board (inline). The
 * paper in it (`--color-cream`) is the one those tokens were sized against.
 */
export function pageWordBase(
  themeId: InviteThemeId,
  palette: Readonly<Record<string, string>> | null,
  art: 'candlelight' | null = null,
): Record<string, string> {
  const theme = INVITE_THEMES[themeId] ?? INVITE_THEMES.house;
  /* A theme's STYLESHEET block names the ornament's gild and not its words (`globals.css`, "THE TEN
     THEMES ON THE PAGE") — `themeBlockVars` carries both because it is also what a seeded palette
     writes inline. Modelling a name the stylesheet does not set would hide the fallback the browser
     takes: under an ombré the words become the OMBRÉ's gild, whatever the theme's was. */
  const { '--color-gild-text': _notInTheStylesheet, ...themeSheet } = theme.id === 'house' ? ({} as Record<string, string>) : themeBlockVars(theme);
  void _notInTheStylesheet;
  return {
    ...HOUSE_WORD_TOKENS,
    ...(art === 'candlelight' ? CANDLELIGHT_WORD_TOKENS : {}),
    ...themeSheet,
    ...(palette ?? {}),
  };
}

/**
 * The colour `text-gild` paints for a resolved bag: `var(--color-gild-text, var(--color-gild))`
 * (`tailwind.config.ts`) — the WORDS' gild where a layer names one, else the ornament's
 * (House's `:root` and a theme's stylesheet block name only the ornament).
 */
export function gildWordsOf(v: Readonly<Record<string, string>>): string | undefined {
  return v['--color-gild-text'] ?? v['--color-gild'];
}

/** The worst contrast of `colour` over every ground it is read on. */
function worstOver(colour: string, grounds: readonly string[]): number {
  return Math.min(...grounds.map((g) => contrastOf(colour, g)));
}

/** Black or white — whichever stands further from every ground. */
function poleAwayFrom(grounds: readonly string[]): string {
  return worstOver('255 255 255', grounds) >= worstOver('0 0 0', grounds) ? '255 255 255' : '0 0 0';
}

/** `colour` moved `t` of the way toward `pole`, as whole channels (what is written is what is measured). */
function towardPole(colour: string, pole: string, t: number): string {
  const c = rgbOf(colour);
  const p = rgbOf(pole);
  if (!c || !p) return colour;
  return c.map((v, k) => Math.round(v + (p[k]! - v) * t)).join(' ');
}

/** `colour` moved away from `grounds` only as far as `target` needs (the pole itself when nothing less reads). */
export function wordInkOn(colour: string, grounds: readonly string[], target: number): string {
  const pole = poleAwayFrom(grounds);
  for (let step = 0; step <= 50; step++) {
    const candidate = towardPole(colour, pole, step / 50);
    if (worstOver(candidate, grounds) >= target) return candidate;
  }
  return pole;
}

/**
 * The composed vars with every coloured word token readable on the paper the
 * page ends with — see the rule above. `base` is `pageWordBase(…)`: what those
 * tokens resolve to under the couple's background.
 *
 * `ramp`: an OMBRÉ paints more than one colour behind the words — the whole
 * ramp, under the veil its own legibility rule baked in (`ombreLook`).
 *   · While the page stays on the side its tokens were sized for (light on
 *     light, dark on dark), a word is measured on the PAPER token alone
 *     (`--color-cream`, the ramp's middle) and moved only as far as that needs —
 *     a look that already reads is not repainted for the sake of a ramp's edge.
 *   · When the page CHANGED SIDES under them (a dark ombré over a light board,
 *     or the reverse), no word sized for the old side could be read at all, so
 *     each is re-sized for everything the ombré paints: its WORST colour, as the
 *     ombré measures its own ink.
 *
 * Returns `vars` itself when the paper did not move, or when every word still reads.
 */
export function pinWordInks(
  vars: Record<string, string> | null,
  base: Readonly<Record<string, string>>,
  ramp: readonly string[] = [],
): Record<string, string> | null {
  if (!vars) return vars;
  const basePaper = base['--color-cream'];
  const paper = vars['--color-cream'] ?? basePaper;
  if (!paper || !basePaper || !rgbOf(paper) || !rgbOf(basePaper)) return vars;
  // The paper is the one the tokens were sized for: every word reads as it always did.
  if (paper === basePaper) return vars;

  const changedSides = poleAwayFrom([paper]) !== poleAwayFrom([basePaper]);
  const grounds = changedSides ? [paper, ...ramp.filter((c) => rgbOf(c))] : [paper];
  const pinned: Record<string, string> = {};
  for (const token of WORD_INK_TOKENS) {
    const gildWords = token === '--color-gild-text';
    const sized = gildWords ? gildWordsOf(base) : base[token];
    if (!sized || !rgbOf(sized)) continue;
    // The couple's own layer set this one — its answer stands.
    if (vars[token] !== undefined && vars[token] !== sized) continue;
    // …and so does an ornament gild their layer re-set (the ombré's), where the words fall back to it.
    if (gildWords && vars[token] === undefined && vars['--color-gild'] !== undefined && vars['--color-gild'] !== base['--color-gild']) continue;
    // AA — or what the word read at before the paper moved, when that was less.
    const target = Math.min(PLATE_MIN_CONTRAST, contrastOf(sized, basePaper));
    if (worstOver(sized, grounds) >= target) continue;
    pinned[token] = wordInkOn(sized, grounds, target);
  }
  // The page's words are settled; now the surfaces that keep a ground of their own under them
  // (`pinSurfaceWordInks`, below) — the gold date card must not inherit a word moved for the dark page.
  return pinSurfaceWordInks(Object.keys(pinned).length > 0 ? { ...vars, ...pinned } : vars, base);
}

// ── A WORD FOLLOWS THE GROUND IT IS DRAWN ON, NOT THE PAGE'S (2026-10-11) ─────────────
//
// `pinWordInks` above moves a word token for the PAPER the page ends with. But a page
// is not one ground: a plate (`.pahina-plate`, `.pahina-deckle`, `bg-paper-deep`) and a
// veil row (`bg-veil`, `/60`, `/50`) keep a ground of their OWN, which a background does
// not touch. Measured on the preview of this very branch: the dark sample event's
// "WHEN" label and calendar icon sit on its GOLD date card. Live they read
// rgb(63 58 52) on rgb(197 160 89) — 4.58 : 1. Once the words' gild followed the dark
// page (167 164 162), they read 1.01 : 1 on the gold — invisible. One token, two
// grounds, and the fix for one broke the other.
//
// 🔑 THE RULE: A SURFACE WITH ITS OWN GROUND KEEPS A WORD THAT READS ON *THAT* GROUND.
// `pinWordInks` ends by calling this, so every caller of it — the guest page, the Look
// sample, a dark shade — gets both halves and cannot take one without the other.
// The stylesheet makes each such surface shadow `--color-gild-text` for its subtree
// (`globals.css`, beside `--color-ink-page` — the same idiom the plate's ink already
// uses): `var(--color-gild-text-on-plate, var(--color-gild-text-page))`. With nothing
// pinned that is the page's value, exactly as before. This function pins the surface's
// own token ONLY where the page's value no longer reads there — and then to the colour
// the surface was sized with (the Mood Board sized its gild words on the paper AND the
// plate), moved only if even that does not read. So a look whose surfaces still read is
// returned UNCHANGED, and no word on a surface is ever harder to read than it was
// before the couple's background, up to AA.
//
// 🔒 Held by `lib/a-dark-look-keeps-its-words.test.ts` (9): every gild word on the REAL
// rendered page, against the ground of its nearest surface, on every Look.

/**
 * The surfaces that keep a ground of their own, the token their gild words read, and what paints them:
 * the plate (opaque `--color-paper-deep`), and a veil ROW — the veil at its strength over the card, whose
 * ground is the page's paper. Each strength has its own token: on a mid-tone ground a word that reads at
 * one strength can be unreadable at the next, and one colour cannot serve both.
 * (The opaque `bg-veil` is a picture well — a map, a portrait — and holds no words.)
 * The test re-reads the guest components and fails if one paints a plate or a veil row not listed here.
 */
export const GILD_SURFACES = [
  { key: 'plate', token: '--color-gild-text-on-plate', classes: ['pahina-plate', 'pahina-deckle', 'bg-paper-deep', 'bg-paper-deep/95'], veil: null },
  { key: 'veil-60', token: '--color-gild-text-on-veil-60', classes: ['bg-veil/60'], veil: 0.6 },
  { key: 'veil-50', token: '--color-gild-text-on-veil-50', classes: ['bg-veil/50'], veil: 0.5 },
] as const;
export type GildSurface = (typeof GILD_SURFACES)[number];

/** The colour a surface paints behind its words, for a resolved bag — or null when the bag cannot say. */
export function surfaceGround(v: Readonly<Record<string, string>>, surface: GildSurface): string | null {
  const paper = v['--color-cream'];
  const own = surface.veil === null ? v['--color-paper-deep'] : v['--color-veil'];
  if (!paper || !own || !rgbOf(paper) || !rgbOf(own)) return null;
  return surface.veil === null ? own : blendOver(own, paper, surface.veil);
}

/**
 * The composed vars with the words' gild readable on each surface that keeps its own
 * ground — see the rule above. `base` is `pageWordBase(…)`: what the tokens resolve to
 * UNDER the couple's background. Returns `vars` itself when nothing had to be pinned.
 */
export function pinSurfaceWordInks(
  vars: Record<string, string> | null,
  base: Readonly<Record<string, string>>,
): Record<string, string> | null {
  if (!vars) return vars;
  const after = { ...base, ...vars };
  const words = gildWordsOf(after);
  const sized = gildWordsOf(base);
  if (!words || !sized || !rgbOf(words) || !rgbOf(sized)) return vars;
  const pinned: Record<string, string> = {};
  for (const surface of GILD_SURFACES) {
    if (vars[surface.token] !== undefined) continue; // a layer named it — its answer stands
    const now = surfaceGround(after, surface);
    const was = surfaceGround(base, surface);
    if (!now || !was) continue;
    // AA — or what the word read at on this surface before the background, when that was less.
    const target = Math.min(PLATE_MIN_CONTRAST, contrastOf(sized, was));
    if (contrastOf(words, now) >= target) continue; // the page's value still reads here
    // The colour the surface was sized with — moved away from its ground only if even that no longer reads.
    pinned[surface.token] = wordInkOn(sized, [now], target);
  }
  return Object.keys(pinned).length > 0 ? { ...vars, ...pinned } : vars;
}

/**
 * 🌗 THE SAME RULE UNDER A DARK SHADE (Studio › Look › Background › Shade ▾).
 * Darker · Dark veil the main background with the page's INK and flip the paper
 * and the ink for the whole scope (`shadeWordVars`, `lib/main-ground-shade.ts`)
 * — the page changes sides under every coloured word exactly as it does under a
 * dark ombré, and the button's label becomes the dark ink on a fill sized for a
 * light one (House: #1e2229 on #c24e25, 3.85 : 1).
 *
 * `flip` is `shadeWordVars(…)`; `base` is what the word tokens resolve to on the
 * page before it (`pageWordBase`, plus the footage tint when the page wears it);
 * `veiled` is the footage as the veil leaves it — the colours the words actually
 * sit on; `own` is the couple's own button colour, which stands here as it does
 * everywhere (Look › Buttons measures its label). Returns ONLY the tokens that
 * had to move (`{}` for a paper veil, which flips nothing), to be spread after
 * the flip in the same stylesheet.
 */
export function shadeWordInks(
  flip: Readonly<Record<string, string>>,
  base: Readonly<Record<string, string>>,
  veiled: readonly string[] = [],
  own: Readonly<Record<string, string>> = {},
): Record<string, string> {
  if (!flip['--color-cream']) return {};
  const pinned = pinWordInks({ ...own, ...flip }, base, veiled) ?? {};
  return Object.fromEntries(Object.entries(pinned).filter(([token]) => !(token in flip) && !(token in own)));
}
