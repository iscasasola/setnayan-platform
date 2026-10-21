/**
 * lib/print-hub-look.ts — EVERY PRINT WEARS THE EVENT'S OWN HUB LOOK.
 *
 * Owner, 2026-10-21, on Studio › Prints (the Entourage 5 × 7 in row, a plain cream card beside an Event Hub that
 * wears a picture, its own colours and its own fonts): *"shouldn't this mimic the event hub design? and so does the
 * other prints?"*
 *
 * Until now a print took its look from the THEME alone (`printLookFor`: the theme's type, ornament and still) dressed
 * in the Mood Board palette (`themeColours`). The Hub stopped being a theme on 2026-10-05 (DECISION_LOG "THEMES ARE
 * REPLACED BY THREE DIRECT GLOBAL SETTINGS: BACKGROUND · COLOURS · FONT") — so a couple's Background, their page
 * colour and their four fonts reached the page and never the paper.
 *
 * 🔑 ONE RESOLVER, NEVER A COPY. Nothing here decides a colour, a font or a background. It is handed what the Hub
 * itself resolved and only puts it on paper:
 *   · COLOURS — the guest page's own painted bag (`guestLookFrom(…).vars`, app/[slug]/_lib/loaders.ts: the board,
 *     the couple's page colour, the blend, the words re-measured on the paper) read back as hexes by the page's own
 *     reader (`boardColours`, lib/theme-colours.ts);
 *   · FONTS — `events.site_font_key` + `events.site_roles` through the page's own sanitisers, in the page's own
 *     roles (`lib/site-role-look.ts`): Names → the couple's names · Headings → a card's title (following Names while
 *     it has no face of its own, as on the page) · Text → every body line · Labels & buttons → the small caps;
 *   · BACKGROUND — the picture the Hub lays behind the event (`mainGroundPictureFor`, main-ground-layer.tsx — the
 *     page's own `pictureOf`, Pro rule and all) with the scrim the page measured over it (`resolveAdaptiveTheme`).
 *
 * 🖨 WHAT PAPER ADDS — and only this:
 *   · a picture runs to the bleed under the Hub's own scrim; the words sit on a feathered paper panel inset from the
 *     trim (`PrintLook.frame`), veiled never less than the Hub's scrim and as much more as every ink needs to read
 *     on the picture's lightest AND darkest measured colour. Text never sits on a busy picture without that veil;
 *   · every ink is held to `MIN_CONTRAST` (4.5 : 1) on the ground it prints on — the same least-change rule the
 *     pass uses (`legibleInk`, lib/print-ground.ts): the Hub's gold stays gold, only deeper.
 * Trim, bleed, die cut, the minimum type size and the fit are the layouts' own and are not touched here.
 *
 * Pure. Held by `lib/every-print-wears-the-hub.test.ts`.
 */
import { sanitizeHubFontKey, type HubFontKey } from './hub-fonts';
import type { InviteThemeId } from './invite-themes';
import { hexRgb, legibleInk, lum, MIN_CONTRAST, over, rgbHex, worstContrast, type RGB } from './print-ground';
import { hubPrintFont, type PrintLook } from './print-pieces';
import { sanitizeSiteRoles } from './site-roles';
import { boardColours, dressedTheme } from './theme-colours';

/** The couple's four faces, as the page reads them (`siteFontLook`). Null = the role wears what it wore. */
export type PrintHubFonts = {
  names: HubFontKey | null;
  heading: HubFontKey | null;
  body: HubFontKey | null;
  highlight: HubFontKey | null;
};

/** `events.site_font_key` + `events.site_roles`, through the very sanitisers the page reads them with. */
export function printHubFonts(siteFontKey: unknown, siteRoles: unknown): PrintHubFonts {
  const roles = sanitizeSiteRoles(siteRoles);
  return {
    names: sanitizeHubFontKey(siteFontKey),
    heading: roles?.heading?.font ?? null,
    body: roles?.body?.font ?? null,
    highlight: roles?.highlight?.font ?? null,
  };
}

/** The Hub's picture background, as measured: its colours (`HubTint.frame`) and the paper veil the page lays over it. */
export type PrintHubPicture = { samples: readonly string[]; scrim: number | null };

export type PrintHubInput = {
  /** The theme the Hub wears (`resolveHubTheme`). */
  theme: InviteThemeId;
  /** `events.role_palette` — the theme as the Mood Board dresses it is the colours' fallback (`dressedTheme`). */
  rolePalette: unknown;
  /** The guest page's painted bag (`guestLookFrom(…).vars`), or null when the page paints the dressed theme alone. */
  vars: Record<string, string> | null;
  fonts: PrintHubFonts;
  /** The couple's picture behind the event as the Hub draws it for guests; null = a colour, a pattern, none. */
  picture: PrintHubPicture | null;
  /**
   * With no picture of theirs: does the page still wear the THEME's own loop behind the event? False when the couple
   * chose "Just the colour" or a pattern (`mainGroundIsNone`) — the page then shows no loop, so the paper shows none.
   */
  wearsThemeLoop: boolean;
};

/**
 * The least veil the words' panel ever has over a picture. The Hub's scrim is measured over a handful of a photo's
 * colours (`measureFrame`); paper must also survive the texture between them, at the smallest print size.
 */
export const PANEL_FLOOR = 0.85;

/** The panel starts this far in from the trim — inside the 5 mm safe area, so the picture shows as a margin. */
export const FRAME_INSET_PT = 12;

/** `r g b` (a page variable's triplet) → `#rrggbb`; anything else → null. */
function channelsHex(v: string | undefined): string | null {
  const m = /^\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*$/.exec(v ?? '');
  return m ? rgbHex([Number(m[1]), Number(m[2]), Number(m[3])]) : null;
}

/** The least paper over the picture at which every ink reads on every measured colour of it. */
function panelOpacity(paper: RGB, samples: readonly RGB[], inks: readonly string[], floor: number): number {
  for (let a = floor; a < 1; a = Math.round((a + 0.02) * 100) / 100) {
    const grounds = samples.map((s) => over(paper, s, a));
    if (inks.every((ink) => worstContrast(hexRgb(ink), 1, grounds) >= MIN_CONTRAST + 0.05)) return a;
  }
  return 1;
}

/** An ink that reads on every ground — the least change (`legibleInk`), else the page's darker or lighter word. */
function readable(hex: string, grounds: readonly RGB[]): string {
  const ink = legibleInk(hex, grounds);
  if (ink) return ink;
  const light = grounds.every((g) => lum(g) > 0.18);
  return light ? '#1a1a1a' : '#ffffff';
}

/**
 * The print's look, worn from the Hub. `base` is the theme's print look (`printLookFor` — the die, the ornament, the
 * theme's own still placement and type); every field the Hub decides is replaced by the Hub's answer.
 */
export function printLookFromHub(base: PrintLook, hub: PrintHubInput): PrintLook {
  const dressed = dressedTheme(hub.theme, hub.rolePalette);
  const c = hub.vars ? boardColours(hub.vars, dressed) : dressed.palette;
  const paper = hexRgb(c.canvas);
  /* The names wear what the page's names wear — `rgb(var(--hub-names-ink, var(--color-ink)))` (globals.css): the
     board's Dominant where the page keeps it, the page's ink where it does not (a colour of the couple's own, a blend,
     Candlelight — `guestLookFrom` drops it — and over a picture, where the scrim sets it to `initial`). Nothing of
     the couple's on the page → the theme's own heading, as the print always drew it. */
  const namesInk = channelsHex(hub.vars?.['--hub-names-ink']);
  const ownPaper = Boolean(hub.vars && '--color-cream' in hub.vars);
  const heading = hub.picture ? c.ink : (namesInk ?? (ownPaper ? c.ink : c.heading));

  const { names, heading: headings, body, highlight } = hub.fonts;
  const headFont = names ? hubPrintFont(names) : base.headFont;
  const fonts: Pick<PrintLook, 'headFont' | 'bodyFont' | 'headingFont' | 'labelFont'> = {
    headFont,
    bodyFont: body ? hubPrintFont(body) : base.bodyFont,
    /* Headings follow Names while they have no face of their own — the page's own rule (`siteFontLook`). */
    ...(headings ? { headingFont: hubPrintFont(headings) } : names ? { headingFont: headFont } : {}),
    ...(highlight ? { labelFont: hubPrintFont(highlight) } : {}),
  };

  const samples = (hub.picture?.samples ?? []).map(hexRgb);
  if (hub.picture && samples.length > 0) {
    const outer = Math.max(0, Math.min(1, hub.picture.scrim ?? 0));
    /* The panel: never less than the Hub's own scrim, never less than `PANEL_FLOOR` — a few measured colours are not
       the whole of a photo, and 7 pt type on paper has no hover and no zoom — and raised until every ink, in its own
       hue, reads on the picture's lightest and darkest parts. The muted ink — the page's `ink/60`, which sits at the
       floor on bare paper and so reads on no veil short of solid — instead takes the least deepening that reads. */
    const inner = panelOpacity(paper, samples, [c.ink, c.accent, heading], Math.max(outer, PANEL_FLOOR));
    const grounds = samples.map((s) => over(paper, s, inner));
    return {
      ...base,
      ...fonts,
      paper: c.canvas,
      ink: readable(c.ink, grounds),
      muted: readable(c.muted, grounds),
      accent: readable(c.accent, grounds),
      heading: readable(heading, grounds),
      still: 'full',
      sepia: false,
      scrim: { color: c.canvas, opacity: inner },
      frame: { inset: FRAME_INSET_PT, outer, inner },
    };
  }

  /* A colour: the page's paper, edge to edge. The theme's own still stays where the theme puts it (a loop theme's
     first frame is the page's own ground when nothing of the couple's is stored) — its fade is drawn in this paper. */
  const grounds = [paper];
  return {
    ...base,
    ...fonts,
    paper: c.canvas,
    ink: readable(c.ink, grounds),
    muted: readable(c.muted, grounds),
    accent: readable(c.accent, grounds),
    heading: readable(heading, grounds),
    still: hub.wearsThemeLoop ? base.still : 'none',
    scrim: base.scrim ? { color: c.canvas, opacity: base.scrim.opacity } : null,
    frame: null,
  };
}

/** For a caller that measured a picture itself (the lab, a test): its colours as hexes. */
export const sampleHexes = (rgbs: readonly RGB[]): string[] => rgbs.map(rgbHex);

/** What wearing the Hub needs, read by the caller: the Hub's own answers (`PrintHubInput`) and the picture's bytes. */
export type WornHub = { hub: PrintHubInput; picture: Uint8Array | null };

/**
 * 🔒 THE HUB LOOK ON PAPER IS EVENT HUB PRO — THE ONE DOOR TO IT (owner 2026-10-21, on the gate contact sheet: *"yes wire all,
 * and yes it's Pro"*; DECISION_LOG 2026-09-25 "EVERY PRINT IS FREE IN THE CLASSIC LOOK; THE THEMED VERSION IS PRO").
 *
 * A print wearing the event's own Hub look IS the themed print. So:
 *   · `ownsPro` false (a free event, a lapsed one, an internal viewer viewing as free — `printOwnsPro`, as viewed) → the
 *     print's own classic look, `base`, the very object — and the Hub is never even READ (`wear` is not called);
 *   · `ownsPro` true → the Hub's look (`printLookFromHub`), and the Hub's picture when it has one. A Hub that cannot be
 *     read (`wear` answers null or throws) prints the classic look — paper is never held hostage to a background.
 * An unlock belongs to the EVENT: `ownsPro` is the event's entitlement, the same for every host on it.
 *
 * Every Hub-worn print goes through here (`lib/every-print-wears-the-hub.test.ts` holds that nothing else calls
 * `printLookFromHub`).
 */
export async function printLookForEvent(
  base: PrintLook,
  ownsPro: boolean,
  wear: () => Promise<WornHub | null>,
): Promise<{ look: PrintLook; picture: Uint8Array | null; wearsHub: boolean }> {
  if (ownsPro !== true) return { look: base, picture: null, wearsHub: false };
  const worn = await wear().catch((err: unknown) => {
    console.error('[print-hub-look] the Hub look could not be read — printing the classic look', String(err));
    return null;
  });
  if (!worn) return { look: base, picture: null, wearsHub: false };
  /* A picture the Hub draws but whose bytes did not arrive: the colours still follow the Hub, never a panel over nothing. */
  const hub = worn.picture ? worn.hub : { ...worn.hub, picture: null };
  return { look: printLookFromHub(base, hub), picture: worn.picture, wearsHub: true };
}
