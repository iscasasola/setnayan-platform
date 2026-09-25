/**
 * lib/invite-themes.ts — THE ONE THEME REGISTRY: the ten Event Hub themes.
 *
 * Owner, 2026-09-24/25 (DECISION_LOG): *"Classic · Rustic · Modern · Cinderella ·
 * Luxe · Vintage · Whimsical · Bridgerton · Great Gatsby · Cyber (Neon)"* — each a
 * WHOLE look, not a colour swap (*"we want the overall look"*), chosen ONCE in the
 * Event Hub Maker and read by every other surface. Classic is free and has no
 * photo or video (*"classic has no photo or video"*); the other nine are Event Hub
 * Pro (*"themes are part of pro except classic"*).
 *
 * Values are COPIED from `assets/theme-backgrounds-2026-09-24/THEMES-2026-09-24.md`
 * (palettes measured off each loop, contrast re-measured over the text zone) —
 * never re-derived here. `lib/invite-themes.test.ts` holds that the CSS in
 * `app/globals.css` paints exactly these palettes, and `lib/hub-legibility.test.ts`
 * holds that every theme reads at WCAG AA over a light and a dark background.
 *
 * ── WHY THE MODULE KEPT ITS NAME AND ITS IDS ─────────────────────────────────
 * `events.invite_theme` stores the id, pinned by a DB CHECK, so an id that
 * already meant the same look KEEPS its key (build plan §3 Phase 3): `house` →
 * Classic · `abaca` → Rustic · `galeriya` → Modern · `velvet` → Luxe · `vintage`
 * → Vintage. The five new ids are `cinderella` · `whimsical` · `regency` (public
 * name Regency; "Bridgerton" is a trademark — DECISION_LOG D3) · `gatsby` ·
 * `cyber`. What a couple READS is `name`, one line; renaming a key costs a
 * migration of live choices for nothing a guest can see.
 *
 * ── THE RETIRED FOUR ────────────────────────────────────────────────────────
 * `capiz` (Elegant), `minimalist`, `fairytale` and `custom` are not themes any
 * more (owner: *"these are not our themes anymore"*). Only `capiz` was ever
 * saveable, and prod held exactly one such row on 2026-09-25 — the owner's own
 * public wedding page. It is READ as its nearest new theme (`LEGACY_THEME_ALIASES`)
 * instead of being rewritten under a deploy, so the page renders correctly
 * whichever of the migration and the code lands first. Nothing ever writes a
 * legacy id again.
 *
 * ── THE DOOR IS A COMPOSITION, THE THEME IS A LOOK ──────────────────────────
 * `/[slug]/invite` (the invite door) has four owner-approved compositions —
 * capiz / velvet / galeriya / abaca — each a card-on-a-ground drawn at door
 * scale. A theme names which one it opens through (`door`); the door's material
 * stays keyed on the composition, so ten themes need no ten doors. The Event Hub
 * pages wear the THEME (`[data-hub-theme]`).
 *
 * 🔑 NO PRICE IS WRITTEN HERE. Pro themes ride `COUPLE_WEBSITE_PRO`; the gate is
 * ownership, read by the caller (`app/[slug]/_lib/hub-look.ts`).
 *
 * Pure. No I/O. Type-only imports, so the Node test runner can load it.
 */
import type { HubMotionPreset } from '@/lib/hub-canvas';
import type { HubAutoSpeed, HubTransition } from '@/lib/hub-scenes';
import type { RevealTemplateId } from '@/lib/reveal-config-pure';

/** The ten, in the order the owner named them — the picker's order. */
export const INVITE_THEME_IDS = [
  'house',
  'abaca',
  'galeriya',
  'cinderella',
  'velvet',
  'vintage',
  'whimsical',
  'regency',
  'gatsby',
  'cyber',
] as const;
export type InviteThemeId = (typeof INVITE_THEME_IDS)[number];

/**
 * A retired id → the theme it is READ as. Stored values only; never offered,
 * never written. D3 (build plan §4): capiz→Vintage · minimalist→Modern ·
 * fairytale→Cinderella · custom→Classic.
 */
export const LEGACY_THEME_ALIASES: Readonly<Record<string, InviteThemeId>> = Object.freeze({
  capiz: 'vintage',
  minimalist: 'galeriya',
  fairytale: 'cinderella',
  custom: 'house',
});

/** The invite door's four compositions, plus House's bare door. */
export const INVITE_DOOR_IDS = ['house', 'capiz', 'velvet', 'galeriya', 'abaca'] as const;
export type InviteDoorId = (typeof INVITE_DOOR_IDS)[number];

/** Every colour the spec measured for a theme, as `#rrggbb`. */
export type HubThemePalette = {
  /** The page ground (the spec's "canvas", or "canvas/panel"). */
  canvas: string;
  /** Cards, chips and plates. */
  surface: string;
  /** Body text on the canvas. */
  ink: string;
  /** Secondary text. */
  muted: string;
  /** The theme's metal / signature colour — buttons, rules, ornaments. */
  accent: string;
  /** Text ON an accent fill (a button label). */
  accentInk: string;
  /** Headings — the spec's gold/green/plum heading, or the ink. */
  heading: string;
  /**
   * The two inks the legibility rule flips between (owner 2026-09-25: text colour
   * adapts to every background, free for everyone). One of them IS `ink`.
   */
  lightInk: string;
  darkInk: string;
};

export type HubThemeFonts = {
  /** The spec's faces, by family name — what the theme IS. */
  heading: string;
  body: string;
  labels: string;
  script: string | null;
};

/**
 * One scene-to-scene transition in the theme's preset pattern (owner 2026-09-24:
 * *"some of the themes would work better with hybrid animation, some would work
 * better with scroll or scrubbing"*). `speed` only for Auto.
 */
export type HubThemeTransition = { mode: HubTransition; speed?: HubAutoSpeed };

export type HubThemeMedia = {
  /** The seamless muted loop behind the Event Hub — an `r2://setnayan-media/…` ref. */
  loop: string;
  /** Its first frame, for paper and for the moment before the loop plays. */
  poster: string;
  /**
   * The loop's lightest and darkest measured clusters (spec "Video" line). The
   * legibility guard composites the scrim over BOTH and holds body text at AA —
   * a measured worst case, not a mean.
   */
  samples: { light: string; dark: string };
};

export type InviteTheme = {
  id: InviteThemeId;
  /** What a couple sees on the picker. */
  name: string;
  /** The style register a couple uses to describe their wedding. */
  word:
    | 'Classic'
    | 'Rustic'
    | 'Modern'
    | 'Cinderella'
    | 'Luxe'
    | 'Vintage'
    | 'Whimsical'
    | 'Regency'
    | 'Great Gatsby'
    | 'Cyber Neon';
  tier: 'free' | 'pro';
  /**
   * The onboarding feels (`events.mood_feel_key`, lib/match-criteria.ts
   * FEEL_OPTIONS) this theme is SUGGESTED for. Every feel belongs to exactly one
   * theme — the test holds that, so no couple is suggested nothing.
   */
  feels: readonly string[];
  /**
   * The theme's default opening, one of the five SHIPPED reveal mechanics (or
   * none). A couple's own `std_reveal_template` always wins. Every reveal is Pro.
   */
  opening: 'none' | RevealTemplateId;
  /**
   * The theme's OWN signature reveal (spec: "new"), not built yet — Phase 10.
   * Until it lands, `opening` (the dressed shipped mechanic) plays instead.
   */
  signatureReveal: string | null;
  /** Whether its look has shipped. All ten have (2026-09-25). */
  ready: boolean;
  /** One line for the picker, in the couple's terms. */
  blurb: string;
  /** Which invite-door composition the theme opens through. */
  door: InviteDoorId;
  palette: HubThemePalette;
  fonts: HubThemeFonts;
  /** The ornament set, by key — frames, rules, flourishes (spec "Ornament / frame"). */
  ornament: string;
  /** The loop and still — `null` for Classic, which is plain colour. */
  media: HubThemeMedia | null;
  /** Content motion (`HUB_MOTION_PRESETS`). */
  motion: HubMotionPreset;
  /**
   * Scene-to-scene transitions, in order from the hero; every scene after the
   * last listed one takes `rest`.
   */
  transitions: { pattern: readonly HubThemeTransition[]; rest: HubTransition };
  /** Radius of pressables (buttons, chips), in px — 999 is a pill. */
  radius: number;
  /**
   * The veil laid over the loop so text reads — the spec's panel or scrim, in
   * the canvas colour. `null` for Classic, which has nothing under its paper.
   */
  scrim: { color: string; opacity: number } | null;
  /** Gold-foil shimmer on the couple's names by default (owner 2026-09-25: Luxe + Gatsby). */
  foilNames: boolean;
  /** The spec's measured contrast over the text zone (5th percentile). Documentation, re-checked by the guard. */
  measured: { body: number; muted: number; heading: number; button: number };
};

const LOOP_PREFIX = 'r2://setnayan-media/theme-backgrounds/2026-09-24/';

function mediaFor(slug: string, samples: { light: string; dark: string }): HubThemeMedia {
  return { loop: `${LOOP_PREFIX}${slug}-loop.mp4`, poster: `${LOOP_PREFIX}${slug}-poster.jpg`, samples };
}

const SCROLL = { mode: 'scroll' } as const;
const SCRUB = { mode: 'scrub' } as const;

export const INVITE_THEMES: Record<InviteThemeId, InviteTheme> = {
  house: {
    id: 'house',
    name: 'Classic',
    word: 'Classic',
    tier: 'free',
    feels: ['others'],
    opening: 'none',
    signatureReveal: null,
    ready: true,
    blurb: 'Ivory paper, gold hairlines, your words set beautifully. Free.',
    door: 'house',
    palette: {
      canvas: '#f6f1e7',
      surface: '#ffffff',
      ink: '#2b241c',
      muted: '#6f665a',
      accent: '#b8934a',
      accentInk: '#2b241c',
      heading: '#8a6a2b',
      lightInk: '#f6f1e7',
      darkInk: '#2b241c',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'EB Garamond', labels: 'Cormorant SC', script: 'Great Vibes' },
    ornament: 'engraved-gold',
    media: null,
    motion: 'still',
    transitions: { pattern: [SCROLL, SCROLL, SCROLL], rest: 'scroll' },
    radius: 4,
    scrim: null,
    foilNames: false,
    measured: { body: 13.6, muted: 5.0, heading: 4.5, button: 5.3 },
  },
  abaca: {
    id: 'abaca',
    name: 'Rustic',
    word: 'Rustic',
    tier: 'pro',
    feels: ['rustic'],
    opening: 'two-flap-vertical',
    signatureReveal: null,
    ready: true,
    blurb: 'Linen, kraft and twine over a long sunset table.',
    door: 'abaca',
    palette: {
      canvas: '#fbf0e4',
      surface: '#f0d5b4',
      ink: '#2b1d10',
      muted: '#6a4a2e',
      accent: '#8b5333',
      accentInk: '#fbf0e4',
      heading: '#8b5333',
      lightInk: '#fbf0e4',
      darkInk: '#2b1d10',
    },
    fonts: { heading: 'Fraunces', body: 'Lora', labels: 'Lora', script: 'Kaushan Script' },
    ornament: 'twine-sprig',
    media: mediaFor('rustic', { light: '#f0d5b4', dark: '#291d10' }),
    motion: 'calm',
    transitions: { pattern: [SCROLL, SCROLL, SCROLL], rest: 'scroll' },
    radius: 6,
    scrim: { color: '#fbf0e4', opacity: 0.86 },
    foilNames: false,
    measured: { body: 11.4, muted: 5.6, heading: 4.3, button: 5.5 },
  },
  galeriya: {
    id: 'galeriya',
    name: 'Modern',
    word: 'Modern',
    tier: 'pro',
    feels: ['modern'],
    opening: 'veil-sheer',
    signatureReveal: 'acrylic-slide',
    ready: true,
    blurb: 'Plaster, acrylic and one green line — a gallery that breathes.',
    door: 'galeriya',
    palette: {
      canvas: '#f5f0eb',
      surface: '#d6cec9',
      ink: '#2b2b1a',
      muted: '#5c574f',
      accent: '#3a4a1c',
      accentInk: '#ffffff',
      heading: '#3a4a1c',
      lightInk: '#f5f0eb',
      darkInk: '#2b2b1a',
    },
    fonts: { heading: 'Instrument Serif', body: 'Jost', labels: 'Jost', script: null },
    ornament: 'hairline-arch',
    media: mediaFor('modern', { light: '#f5f0eb', dark: '#242c0b' }),
    motion: 'still',
    transitions: { pattern: [SCRUB], rest: 'scroll' },
    radius: 999,
    scrim: { color: '#f5f0eb', opacity: 0.86 },
    foilNames: false,
    measured: { body: 10.8, muted: 5.4, heading: 7.2, button: 6.2 },
  },
  cinderella: {
    id: 'cinderella',
    name: 'Cinderella',
    word: 'Cinderella',
    tier: 'pro',
    feels: [],
    opening: 'veil-sheer',
    signatureReveal: 'midnight-sparkle',
    ready: true,
    blurb: 'Moonlit ice-blue, silver sparkle and an arched frosted frame.',
    door: 'capiz',
    palette: {
      canvas: '#eef3f8',
      surface: '#d4dfe7',
      ink: '#253039',
      muted: '#49586a',
      accent: '#8a9eae',
      accentInk: '#253039',
      heading: '#253039',
      lightInk: '#eef3f8',
      darkInk: '#253039',
    },
    fonts: { heading: 'Italiana', body: 'Cormorant Garamond', labels: 'Cormorant SC', script: 'Alex Brush' },
    ornament: 'silver-arch',
    media: mediaFor('cinderella', { light: '#d4dfe7', dark: '#253039' }),
    motion: 'cinematic',
    transitions: { pattern: [{ mode: 'auto', speed: 'slow' }, SCRUB], rest: 'scroll' },
    radius: 999,
    scrim: { color: '#eef3f8', opacity: 0.82 },
    foilNames: false,
    measured: { body: 9.0, muted: 4.8, heading: 9.0, button: 4.9 },
  },
  velvet: {
    id: 'velvet',
    name: 'Luxe',
    word: 'Luxe',
    tier: 'pro',
    feels: ['glam'],
    opening: 'four-flap',
    signatureReveal: 'velvet-curtains',
    ready: true,
    blurb: 'Velvet, chandeliers and gold foil — black tie.',
    door: 'velvet',
    palette: {
      canvas: '#0e0504',
      surface: '#34130c',
      ink: '#f3e7dc',
      muted: '#e6cdb9',
      accent: '#e3a86f',
      accentInk: '#0e0504',
      heading: '#e3a86f',
      lightInk: '#f3e7dc',
      darkInk: '#0e0504',
    },
    fonts: { heading: 'Bodoni Moda', body: 'Cormorant Garamond', labels: 'Cormorant SC', script: 'Pinyon Script' },
    ornament: 'gilt-double',
    media: mediaFor('luxe', { light: '#f8cc95', dark: '#0e0504' }),
    motion: 'cinematic',
    transitions: { pattern: [{ mode: 'auto', speed: 'slow' }, SCRUB], rest: 'scroll' },
    radius: 999,
    scrim: { color: '#0e0504', opacity: 0.62 },
    foilNames: true,
    measured: { body: 5.9, muted: 4.7, heading: 3.4, button: 9.7 },
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage',
    word: 'Vintage',
    tier: 'pro',
    feels: ['timeless', 'filipiniana'],
    opening: 'four-flap',
    signatureReveal: null,
    ready: true,
    blurb: 'Capiz light on old pews — sepia, lace and a wax seal.',
    door: 'capiz',
    palette: {
      canvas: '#eadbc6',
      surface: '#e1cdb9',
      ink: '#33261a',
      muted: '#5a4128',
      accent: '#634b2f',
      accentInk: '#f8efe0',
      heading: '#634b2f',
      lightInk: '#f8efe0',
      darkInk: '#33261a',
    },
    fonts: { heading: 'Playfair Display', body: 'Libre Baskerville', labels: 'Libre Baskerville', script: 'Mrs Saint Delafield' },
    ornament: 'lace-postmark',
    media: mediaFor('vintage', { light: '#e8d9c4', dark: '#382918' }),
    motion: 'calm',
    transitions: { pattern: [SCRUB], rest: 'scroll' },
    radius: 2,
    scrim: { color: '#eadbc6', opacity: 0.88 },
    foilNames: false,
    measured: { body: 8.5, muted: 5.5, heading: 4.7, button: 7.1 },
  },
  whimsical: {
    id: 'whimsical',
    name: 'Whimsical',
    word: 'Whimsical',
    tier: 'pro',
    feels: ['boho'],
    opening: 'veil-sheer',
    signatureReveal: null,
    ready: true,
    blurb: 'Pastel lanterns over a meadow — confetti, butterflies, joy.',
    door: 'galeriya',
    palette: {
      canvas: '#fbf7f0',
      surface: '#faf6ee',
      ink: '#3f3626',
      muted: '#6e6146',
      accent: '#c9aab3',
      accentInk: '#3f3626',
      heading: '#5a4a5e',
      lightInk: '#fbf7f0',
      darkInk: '#3f3626',
    },
    fonts: { heading: 'Yeseva One', body: 'Quicksand', labels: 'Quicksand', script: 'Cookie' },
    ornament: 'confetti-butterfly',
    media: mediaFor('whimsical', { light: '#faf6ee', dark: '#828444' }),
    motion: 'editorial',
    transitions: { pattern: [SCROLL, SCROLL, SCROLL], rest: 'scroll' },
    radius: 999,
    scrim: { color: '#fbf7f0', opacity: 0.84 },
    foilNames: false,
    measured: { body: 9.1, muted: 4.6, heading: 6.2, button: 5.6 },
  },
  regency: {
    id: 'regency',
    name: 'Regency',
    word: 'Regency',
    tier: 'pro',
    feels: ['royalty'],
    opening: 'four-flap',
    signatureReveal: null,
    ready: true,
    blurb: 'A ballroom of cream and gilt, tied with a lilac ribbon.',
    door: 'capiz',
    palette: {
      canvas: '#f6efe6',
      surface: '#e2b997',
      ink: '#33261f',
      muted: '#6d5043',
      accent: '#dcac7d',
      accentInk: '#33261f',
      heading: '#33261f',
      lightInk: '#f6efe6',
      darkInk: '#33261f',
    },
    fonts: { heading: 'Prata', body: 'Crimson Pro', labels: 'Crimson Pro', script: 'Parisienne' },
    ornament: 'gilt-ribbon',
    media: mediaFor('regency', { light: '#e2b997', dark: '#8a624e' }),
    motion: 'editorial',
    transitions: { pattern: [SCRUB], rest: 'scroll' },
    radius: 999,
    scrim: { color: '#f6efe6', opacity: 0.86 },
    foilNames: false,
    measured: { body: 10.1, muted: 5.1, heading: 10.1, button: 7.1 },
  },
  gatsby: {
    id: 'gatsby',
    name: 'Great Gatsby',
    word: 'Great Gatsby',
    tier: 'pro',
    feels: [],
    opening: 'church-doors',
    signatureReveal: 'deco-gates',
    ready: true,
    blurb: 'Champagne light, art-deco gold and an opening number.',
    door: 'velvet',
    palette: {
      canvas: '#110504',
      surface: '#331610',
      ink: '#f7e6cf',
      muted: '#dcbf9d',
      accent: '#ecbf8f',
      accentInk: '#110504',
      heading: '#ecbf8f',
      lightInk: '#f7e6cf',
      darkInk: '#110504',
    },
    fonts: { heading: 'Limelight', body: 'Josefin Sans', labels: 'Poiret One', script: null },
    ornament: 'deco-fan',
    media: mediaFor('great-gatsby', { light: '#f9e0bb', dark: '#110504' }),
    motion: 'cinematic',
    transitions: { pattern: [{ mode: 'auto', speed: 'normal' }, SCRUB], rest: 'scroll' },
    radius: 4,
    scrim: { color: '#110504', opacity: 0.64 },
    foilNames: true,
    measured: { body: 7.4, muted: 5.2, heading: 5.4, button: 11.9 },
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon',
    word: 'Cyber Neon',
    tier: 'pro',
    feels: [],
    opening: 'two-flap-horizontal',
    signatureReveal: 'neon-flicker',
    ready: true,
    blurb: 'Neon magenta and cyan on a rain-wet night street.',
    door: 'velvet',
    palette: {
      canvas: '#0b0a12',
      surface: '#26222d',
      ink: '#f1ecf7',
      muted: '#c9bcd4',
      accent: '#ec8cd6',
      accentInk: '#0b0a12',
      heading: '#ffffff',
      lightInk: '#f1ecf7',
      darkInk: '#0b0a12',
    },
    fonts: { heading: 'Syne', body: 'Outfit', labels: 'Outfit', script: 'Monoton' },
    ornament: 'hud-glow',
    media: mediaFor('cyber-neon', { light: '#ec8cd6', dark: '#0b0a12' }),
    motion: 'cinematic',
    transitions: { pattern: [SCRUB, SCRUB], rest: 'scrub' },
    radius: 8,
    scrim: { color: '#0b0a12', opacity: 0.58 },
    foilNames: false,
    measured: { body: 8.1, muted: 5.2, heading: 4.2, button: 8.7 },
  },
};

/** The ten, as a list in the owner's order — what the Maker's Theme panel mounts. */
export const HUB_THEMES: readonly InviteTheme[] = INVITE_THEME_IDS.map((id) => INVITE_THEMES[id]);

export function isInviteThemeId(value: unknown): value is InviteThemeId {
  return typeof value === 'string' && (INVITE_THEME_IDS as readonly string[]).includes(value);
}

/**
 * A STORED value → the theme it means, or null. A live id is itself; a retired
 * id is its alias (`capiz` → Vintage); anything else is not a theme. Case is not
 * folded — a value this product did not write is not guessed at.
 */
export function normalizeThemeId(value: unknown): InviteThemeId | null {
  if (isInviteThemeId(value)) return value;
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_THEME_ALIASES, value)) {
    return LEGACY_THEME_ALIASES[value] ?? null;
  }
  return null;
}

/** The door composition a theme opens through. */
export function inviteDoorFor(theme: InviteThemeId): InviteDoorId {
  return INVITE_THEMES[theme].door;
}

/**
 * An `r2://setnayan-media/<key>` media ref → `<key>`, for the server to build the
 * public URL from (`r2PublicUrl`). Null for anything that is not a public-bucket ref.
 */
export function themeMediaKey(ref: string): string | null {
  const prefix = 'r2://setnayan-media/';
  return ref.startsWith(prefix) && ref.length > prefix.length ? ref.slice(prefix.length) : null;
}

/**
 * 🔒 WEDDINGS ONLY, FOR NOW (owner Q7 = A, 2026-09-11 · DECISION_LOG "the seven
 * invite-theme questions"): *"the event types that carry the Save-the-Date film,
 * the same fence the reveal uses. Every other celebration gets House."*
 *
 * The caller measures it — `resolveWeddingOnlyParts(profile).save_the_date_film`
 * — and hands the answer in, for the same reason `ownsPro` is a boolean and not
 * an event id: a gate that can only ever answer one way is indistinguishable, in
 * the render, from a gate that works.
 *
 * ⛔ IT IS NOT A SECOND OPINION ABOUT THE REVEAL. `lib/invite-reveal.ts` asks
 * whether a reveal may PLAY NOW (a calendar question, on the venue's clock);
 * this asks only whether this KIND of celebration has a Save-the-Date film at
 * all. Same profile answer, two different questions — do not collapse them, and
 * do not restate `cinematicRevealPlays` here.
 *
 * NOT optional. A default of `true` would let a birthday through on the day
 * somebody forgets to pass it, and that failure renders as a working page.
 */
type WeddingFence = {
  /** `resolveWeddingOnlyParts(profile).save_the_date_film`. */
  mayShowStdFilm: boolean;
};

/** Free themes are for everyone; a Pro theme needs the unlock AND the fence. */
function themeIsAvailable(
  theme: InviteTheme,
  input: { ownsPro: boolean } & WeddingFence,
): boolean {
  if (!theme.ready) return false;
  if (theme.tier === 'free') return true;
  return input.ownsPro && input.mayShowStdFilm;
}

/**
 * The theme a guest actually sees. House (Classic) unless the couple SAVED a
 * theme — a retired id read as its alias — and, for a Pro theme, the event holds
 * Event Hub Pro right now AND its type may carry the Save-the-Date film. A lapse
 * (of either) falls back to House and the choice is restored when it returns,
 * with no write in between.
 */
export function resolveInviteTheme(
  input: { saved: unknown; ownsPro: boolean } & WeddingFence,
): InviteThemeId {
  const id = normalizeThemeId(input.saved);
  if (!id) return 'house';
  const theme = INVITE_THEMES[id];
  return themeIsAvailable(theme, input) ? theme.id : 'house';
}

/**
 * The picker's PRE-SELECTION — never written on its own. The couple's saved
 * choice if there is one; otherwise the shipped theme their onboarding feel
 * points at, if they can use it; otherwise House. The couple already told us
 * their feel once, so they are not asked about style twice.
 */
export function suggestedInviteTheme(
  input: { saved: unknown; moodFeelKey: unknown; ownsPro: boolean } & WeddingFence,
): InviteThemeId {
  // ⚠ THE SAVED VALUE GOES THROUGH THE FENCE TOO — a radio pre-selected on a
  // theme their guests are not being shown is the picker contradicting the door.
  const saved = normalizeThemeId(input.saved);
  if (saved && themeIsAvailable(INVITE_THEMES[saved], input)) return saved;
  if (saved) return 'house';
  const feel = typeof input.moodFeelKey === 'string' ? input.moodFeelKey : null;
  if (!feel) return 'house';
  const match = HUB_THEMES.find((t) => t.feels.includes(feel) && themeIsAvailable(t, input));
  return match?.id ?? 'house';
}

/**
 * The themes a couple can pick right now, in the order the owner named them.
 *
 * Pro themes are LISTED-BUT-DISABLED for a couple who simply has not bought the
 * unlock — *"never hidden, so a couple knows what they would get"*. They are
 * absent entirely where the event TYPE cannot have them (Q7 = A), and — the
 * caller's job — inside the store shell, where Pro is hidden, not locked.
 */
export function pickableInviteThemes(input: WeddingFence): InviteTheme[] {
  return HUB_THEMES.filter((t) => t.ready && (t.tier === 'free' || input.mayShowStdFilm));
}
