/**
 * apps/web/lib/hub-font-shelves.ts
 *
 * 🔤 ONE FONT DROPDOWN, THREE SHELVES — the order every font picker in the
 * Event Hub editor lists its faces in.
 *
 * Owner, 2026-09-29, verbatim: *"the font across all event hub editor. can be
 * one style. A dropdown with the following: 5 recently used · 5 most used fonts
 * on the website · all the rest of the fonts. * all fonts that are being used
 * in the website must have and (actively used) label?"*
 *
 *   1. RECENTLY USED — this couple's last five DISTINCT picks, newest first,
 *      from any font picker in the editor (`pushRecentHubFont`). Kept on this
 *      device for this event (`HUB_FONT_RECENT_KEY`), beside the colour well's
 *      saved colours (`sn-maker-colours:<event>`) — a convenience: a cleared
 *      browser forgets only the shortcut, never a font on the page.
 *   2. MOST USED — `HUB_FONTS_MOST_USED`: the measured five
 *      (`mostUsedHubFontKeys`, `hub-fonts-most-used.test.ts` pins the constant
 *      to the count). A face already on the Recently-used shelf is not shown
 *      again, so this shelf can hold fewer than five.
 *   3. ALL FONTS — every other face, in the catalogue's shelf order
 *      (Serif · Script · Sans · Display), never one already shown above.
 *
 * ⛔ A FACE APPEARS ONCE in the whole list — `hub-font-shelves.test.ts`.
 *
 * "IN USE" (owner: "actively used") marks every face this Event Hub renders
 * right now — `hubFontsInUse` over the SAME draft-over-live data the Maker's
 * canvas draws: the theme's faces, the couple's own typeface
 * (`site_font_key`), every part's and every letter-run's font on every scene,
 * and the logo's text layers.
 *
 * Pure. No I/O. Client-safe: no theme registry here (the page resolves the
 * theme's faces on the server and hands in their family names).
 */
import {
  HUB_FONT_BY_KEY,
  HUB_FONT_GROUPS,
  HUB_FONTS,
  HUB_FONTS_MOST_USED,
  hubFontPreviewStack,
  sanitizeHubFontKey,
  type HubFont,
  type HubFontKey,
} from './hub-fonts';
import type { HubElementStyles } from './element-style';

/** The shelves, in the order the dropdown shows them. */
export const HUB_FONT_SHELVES = ['Recently used', 'Most used', 'All fonts'] as const;
export type HubFontShelf = (typeof HUB_FONT_SHELVES)[number];

/** How many picks the Recently-used shelf keeps. */
export const HUB_FONT_RECENT_MAX = 5;

/** Where the Recently-used shelf is kept — this device, this event. */
export const HUB_FONT_RECENT_KEY = (eventId: string) => `sn-maker-fonts:${eventId}`;

/** The label a face in use carries. */
export const HUB_FONT_IN_USE = 'In use';

/** A stored recent list, cleaned: known faces only, distinct, at most five. Anything else is dropped, never repaired. */
export function sanitizeRecentHubFonts(raw: unknown): HubFontKey[] {
  if (!Array.isArray(raw)) return [];
  const out: HubFontKey[] = [];
  for (const v of raw) {
    const k = sanitizeHubFontKey(v);
    if (k && !out.includes(k)) out.push(k);
    if (out.length === HUB_FONT_RECENT_MAX) break;
  }
  return out;
}

/** A pick, put at the front — the same face picked again moves up, never repeats. */
export function pushRecentHubFont(recent: readonly HubFontKey[], key: HubFontKey): HubFontKey[] {
  return [key, ...recent.filter((k) => k !== key)].slice(0, HUB_FONT_RECENT_MAX);
}

export type HubFontShelfRow = HubFont & { shelf: HubFontShelf; inUse: boolean };

/** Every face once, on its shelf, in order — and whether this Event Hub uses it. */
export function hubFontShelves({
  recent = [],
  inUse = [],
}: {
  recent?: readonly HubFontKey[];
  inUse?: readonly HubFontKey[];
} = {}): HubFontShelfRow[] {
  const used = new Set<HubFontKey>(inUse);
  const shown = new Set<HubFontKey>();
  const out: HubFontShelfRow[] = [];
  const put = (key: HubFontKey, shelf: HubFontShelf) => {
    if (shown.has(key)) return;
    shown.add(key);
    out.push({ ...HUB_FONT_BY_KEY[key], shelf, inUse: used.has(key) });
  };
  for (const k of sanitizeRecentHubFonts(recent)) put(k, 'Recently used');
  for (const k of HUB_FONTS_MOST_USED) put(k, 'Most used');
  for (const g of HUB_FONT_GROUPS) for (const f of HUB_FONTS) if (f.group === g) put(f.key, 'All fonts');
  return out;
}

/** The key the dropdown's lead option ("Event Hub font", "The theme's own") carries. */
export const HUB_FONT_LEAD = 'lead';

/**
 * The dropdown's options, as `PickMenu` takes them: the lead (if any), then every
 * face on its shelf, named in its own face, "In use" where the page uses it.
 */
export function hubFontPickOptions({
  recent,
  inUse,
  lead,
}: {
  recent?: readonly HubFontKey[];
  inUse?: readonly HubFontKey[];
  lead?: string;
}): Array<{
  key: string;
  label: string;
  fontFamily?: string;
  group?: string;
  trail?: { text: string; tone: 'muted' };
}> {
  return [
    ...(lead ? [{ key: HUB_FONT_LEAD, label: lead }] : []),
    ...hubFontShelves({ recent, inUse }).map((f) => ({
      key: f.key,
      label: f.label,
      fontFamily: hubFontPreviewStack(f.key),
      group: f.shelf,
      ...(f.inUse ? { trail: { text: HUB_FONT_IN_USE, tone: 'muted' as const } } : {}),
    })),
  ];
}

/** The offered face a family name is, or null (a theme face we do not ship). */
export function hubFontKeyForFamily(family: string | null | undefined): HubFontKey | null {
  if (!family) return null;
  return HUB_FONTS.find((f) => f.family === family)?.key ?? null;
}

/**
 * Every face this Event Hub renders now, in the catalogue's order.
 *
 * 🔑 THE SAME INPUTS THE CANVAS DRAWS FROM, drafted over live:
 *   · `themeFaces` — the theme's heading · body · labels · script families
 *     (`INVITE_THEMES[theme].fonts`). The couple's own typeface replaces the
 *     theme's HEADING face (`hubFontVars` sets `--pahina-face`), so the heading
 *     counts only while no typeface is chosen.
 *   · `siteFontKey` — `events.site_font_key`.
 *   · `canvases` — every scene's parts (`elements`) and their letter runs.
 *   · `logoFonts` — the logo's text layers.
 */
export function hubFontsInUse({
  themeFaces = null,
  siteFontKey = null,
  canvases = {},
  logoFonts = [],
}: {
  themeFaces?: { heading?: string | null; body?: string | null; labels?: string | null; script?: string | null } | null;
  siteFontKey?: unknown;
  canvases?: Record<string, { elements?: HubElementStyles | null } | null | undefined>;
  logoFonts?: readonly unknown[];
}): HubFontKey[] {
  const used = new Set<HubFontKey>();
  const add = (k: HubFontKey | null) => {
    if (k) used.add(k);
  };
  const site = sanitizeHubFontKey(siteFontKey);
  add(site);
  if (themeFaces) {
    if (!site) add(hubFontKeyForFamily(themeFaces.heading));
    add(hubFontKeyForFamily(themeFaces.body));
    add(hubFontKeyForFamily(themeFaces.labels));
    add(hubFontKeyForFamily(themeFaces.script));
  }
  for (const c of Object.values(canvases)) {
    for (const st of Object.values(c?.elements ?? {})) {
      add(sanitizeHubFontKey(st?.font));
      for (const r of st?.runs ?? []) add(sanitizeHubFontKey(r.font));
    }
  }
  for (const f of logoFonts) add(sanitizeHubFontKey(f));
  return HUB_FONTS.filter((f) => used.has(f.key)).map((f) => f.key);
}
