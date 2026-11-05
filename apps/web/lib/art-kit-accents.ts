/**
 * apps/web/lib/art-kit-accents.ts — EACH SCENE'S ACCENT, as data: which scenes take one, what each offers, what a kit
 * look starts with, where the picks are stored, and which change is Pro. No pieces, no stylesheet — the registry
 * (`lib/art-kits.ts`) re-exports all of this, and the draft (`lib/hub-draft.ts`, in the Maker's first load) reads it
 * without shipping the kit.
 */
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import { ART_KIT_IS_PRO, ART_KIT_ORNAMENTS } from '@/lib/art-kit-pro';

/**
 * 🏛 AN ACCENT BELONGS TO ITS SCENE (owner 2026-10-16, DECISION_LOG "AN ACCENT BELONGS TO ITS SCENE AND IS ADDED FROM
 * THAT SCENE'S STYLE"), verbatim: *"it is more like when i am at countdown, then on style we can add accent. the poles,
 * since that is part of the countdown"*. In the Maker: tap the scene → Style → **Accent ◆ ▾**, which lists ONLY that
 * scene's accents. Picking one puts its pieces in their designed slot — no Spot, no drag, no page-level picker.
 *
 * The scenes keyed by the Maker's own words for them (`hero`, `countdown`, `rsvp` are widget types; `gifts` is the
 * E-Gifts part) — and the sign-off, which has no Maker scene of its own yet (its oval follows the look's default).
 */
export const ACCENT_SCENES = ['hero', 'countdown', 'gifts', 'rsvp', 'sign-off'] as const;
export type AccentScene = (typeof ACCENT_SCENES)[number];

/** The slot an accent scene's pieces sit in. */
export const ACCENT_SLOT: Readonly<Record<AccentScene, 'cover' | 'countdown' | 'gifts-card' | 'reply' | 'closing'>> = {
  hero: 'cover',
  countdown: 'countdown',
  gifts: 'gifts-card',
  rsvp: 'reply',
  'sign-off': 'closing',
};

/** "None" — a scene with no accent. Stored as a word so a Vintage scene can say no to the look's default. */
export const ACCENT_NONE = 'none';

/** One choice on a scene's Accent ▾ — the pieces it places (all in that scene's slot). */
export type AccentOption = { id: string; label: string; pieces: readonly string[] };

/**
 * Each scene's accents, in Accent ▾'s order (after None). The pieces are the Vintage kit's — the one library today;
 * any look may pick them (owner via the controller, 2026-10-16: *"Other looks start at None but CAN pick these"*).
 */
export const SCENE_ACCENTS: Readonly<Record<AccentScene, readonly AccentOption[]>> = {
  hero: [
    { id: 'drapes-arana', label: 'Drapes and araña', pieces: ['drape', 'chandelier'] },
    { id: 'drapes', label: 'Drapes', pieces: ['drape'] },
    { id: 'arana', label: 'Araña', pieces: ['chandelier'] },
  ],
  countdown: [{ id: 'narra-columns', label: 'Narra columns', pieces: ['countdown-frame'] }],
  gifts: [
    { id: 'spray-fan', label: 'Corner spray and lace fan', pieces: ['corner-floral', 'fan'] },
    { id: 'spray', label: 'Corner spray', pieces: ['corner-floral'] },
    { id: 'fan', label: 'Lace fan', pieces: ['fan'] },
  ],
  rsvp: [{ id: 'garland', label: 'Garland', pieces: ['rsvp-ornament'] }],
  'sign-off': [{ id: 'oval', label: 'Oval frame', pieces: ['closing-frame'] }],
};

/**
 * The accent each scene STARTS with on a look that brings a kit — the controller's call, reversible (DECISION_LOG
 * 2026-10-16: *"the Vintage look starts with its scenes' accents on, and each scene's Accent ▾ can switch them
 * off"*). Every other look starts at None.
 */
export const KIT_DEFAULT_ACCENTS: Readonly<Record<AccentScene, string>> = {
  hero: 'drapes-arana',
  countdown: 'narra-columns',
  gifts: 'spray-fan',
  rsvp: 'garland',
  'sign-off': 'oval',
};

/** Where the picks live: ONE key of `events.style_preferences` beside the scenes' style picks (`scene_styles`). */
export const SCENE_ACCENTS_PREF_KEY = 'scene_accents';
export type SceneAccents = Partial<Record<AccentScene, string>>;

export function isAccentScene(v: unknown): v is AccentScene {
  return typeof v === 'string' && (ACCENT_SCENES as readonly string[]).includes(v);
}

/** A stored or drafted map, kept to known scenes and their own choices (or None). Anything else is dropped. */
export function sanitizeSceneAccents(raw: unknown): SceneAccents {
  const out: SceneAccents = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [scene, id] of Object.entries(raw as Record<string, unknown>)) {
    if (!isAccentScene(scene) || typeof id !== 'string') continue;
    if (id === ACCENT_NONE || SCENE_ACCENTS[scene].some((o) => o.id === id)) out[scene] = id;
  }
  return out;
}

/** The picks a `style_preferences` blob holds. */
export function sceneAccentsFromPreferences(prefs: unknown): SceneAccents {
  return sanitizeSceneAccents(prefs && typeof prefs === 'object' ? (prefs as Record<string, unknown>)[SCENE_ACCENTS_PREF_KEY] : undefined);
}

/** A scene's accent as the page draws it: the couple's pick, else the look's default (a kit look), else None. */
export function resolvedAccent(scene: AccentScene, picks: SceneAccents, theme: InviteThemeId | null | undefined): string {
  return picks[scene] ?? (theme && ART_KIT_ORNAMENTS.includes(INVITE_THEMES[theme].ornament) ? KIT_DEFAULT_ACCENTS[scene] : ACCENT_NONE);
}

/**
 * Does a drafted map turn an accent ON that the live one does not have? — the Pro half (turning one off is free).
 * While `ART_KIT_IS_PRO`; `isPro` is a parameter so the guard holds both values.
 */
export function accentsTurnOn(live: SceneAccents, drafted: SceneAccents, isPro: boolean = ART_KIT_IS_PRO): AccentScene[] {
  if (!isPro) return [];
  return ACCENT_SCENES.filter((s) => drafted[s] !== undefined && drafted[s] !== ACCENT_NONE && drafted[s] !== live[s]);
}

/** The scene names the Apply sheet reads ("Decorations · Countdown, Cover"). */
export const ACCENT_SCENE_LABEL: Readonly<Record<AccentScene, string>> = {
  hero: 'Cover',
  countdown: 'Countdown',
  gifts: 'E-Gifts',
  rsvp: 'Reply',
  'sign-off': 'Sign-off',
};

