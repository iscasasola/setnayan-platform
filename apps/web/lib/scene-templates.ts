/**
 * apps/web/lib/scene-templates.ts
 *
 * THE 25 SCENE TEMPLATES — every scene a couple adds starts from one of these.
 *
 * Owner, 2026-09-24 (DECISION_LOG): *"give me me 25 different scenes"* →
 * *"draw all the templates. now editing screen can be just desktop or just
 * mobile or both … if mobile view then templates will show as mobile"* → and,
 * correcting the picker: *"not the arrow down. we do not have the blank
 * anymore"*. So there is no blank scene; "+" opens these 25 and nothing else.
 *
 * Drawn in `prototypes/event_hub_editor_FINAL_2026-09-24.html` (the "Add a
 * scene" sheet). Every number below is read off that file — the default
 * preset + transition table in its v3 notes, and the thumbnail boxes straight
 * from each tile's desktop (`.tth`) and phone (`.tth2`) drawing — so the
 * picker a couple sees is the one the owner approved, not a re-drawing of it.
 *
 * ── WHERE A CHOICE LIVES ───────────────────────────────────────────────────
 * `invitation_widgets.config_json.canvas.template` (+ `slots`), beside the rest
 * of the canvas contract in `lib/hub-canvas.ts`. No table, no migration.
 *
 * ── THE CONTRACT OTHER BUILDERS READ (keep it stable) ──────────────────────
 * The Love Story builder (Phase 7) makes each moment a scene through exactly
 * this module: `SCENE_TEMPLATE_IDS`, `SCENE_TEMPLATES[id]` (family, slot
 * counts, defaults), `sceneTemplateDefaults(id)`, and the guest renderer
 * `renderScene` in `app/[slug]/_components/scene-template.tsx`. Ids are
 * permanent: a stored `template: 18` must mean "Three mosaic" forever, so a
 * template is never renumbered — a retired one would stay reserved.
 *
 * Pure. No I/O. Client-safe (the picker imports it).
 */

import type { HubMotionPreset } from '@/lib/hub-canvas';
import type { HubTransition } from '@/lib/hub-scenes';

/* ── THE FIVE FAMILIES ─────────────────────────────────────────────────────
   Owner's own sentence, in his order: *"most likely, they will create their
   story where there is a media and a text. or just a text. or just a media.
   or a group of photos. or a group of texts."* */
export const SCENE_FAMILIES = ['media_text', 'text', 'media', 'photos', 'texts'] as const;
export type SceneFamily = (typeof SCENE_FAMILIES)[number];

export const SCENE_FAMILY_LABEL: Record<SceneFamily, string> = {
  media_text: 'Media + text',
  text: 'Text only',
  media: 'Media only',
  photos: 'Group of photos',
  texts: 'Group of texts',
};

export const SCENE_TEMPLATE_IDS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
] as const;
export type SceneTemplateId = (typeof SCENE_TEMPLATE_IDS)[number];

/** The most slots any template has (21 · Collage of 5–6). `sanitizeHubCanvas` caps `slots` here. */
export const SCENE_MAX_SLOTS = 6;

/**
 * HOW THE TEMPLATE LAYS OUT, as one word the stylesheet branches on. Several
 * templates share a layout (1 and 6 both put the picture beside the words), so
 * the CSS is one rule per LAYOUT rather than one per template id — 25 rules
 * that were 90 % the same would drift apart one edit at a time.
 */
export const SCENE_LAYOUTS = [
  'side',
  'stack',
  'over',
  'half',
  'words',
  'quote',
  'title',
  'letter',
  'number',
  'bleed',
  'framed',
  'mono',
  'pair',
  'mosaic',
  'grid',
  'strip',
  'collage',
  'cols',
  'timeline',
  'qa',
] as const;
export type SceneLayout = (typeof SCENE_LAYOUTS)[number];

/**
 * ONE BOX OF A THUMBNAIL, in percent of the tile — `[kind, x, y, w, h, tone]`.
 * `photo` stands for the couple's picture, `line` for their words, `txt` for a
 * real word the template prints (names, "85", the monogram), `col` for a flat
 * colour, `play` for the ▶ of a clip, `dot` for a timeline mark. `tone` 'a' is
 * the accent (a pull quote), 'l' a light line over a photo.
 */
export type SceneThumbKind = 'photo' | 'line' | 'txt' | 'col' | 'play' | 'dot';
export type SceneThumbBox = readonly [SceneThumbKind, number, number, number, number, ('a' | 'l' | '')?];

export type SceneTemplate = {
  id: SceneTemplateId;
  /** What the picker prints under the tile — the prototype's words. */
  name: string;
  family: SceneFamily;
  /** ★ — one of the four arrangements the owner approved on 2026-09-23. */
  approved: boolean;
  layout: SceneLayout;
  /** How many picture slots the template has. 0 = words only. */
  media: number;
  /** A slot that expects a clip rather than a photo (5, 14). */
  clip: boolean;
  /** How many separate word blocks (group-of-texts). 0 = the scene's one heading + words. */
  blocks: number;
  /**
   * Built on a part that already ships (owner: "four build on shipped parts"):
   * the words or number come from the event itself, so the scene is never empty.
   */
  builtOn: 'names' | 'special_message' | 'countdown' | 'monogram' | 'milestones' | null;
  /** Default content motion — the shipped `HUB_MOTION_PRESETS`. */
  preset: HubMotionPreset;
  /** Default transition INTO THE NEXT scene. */
  transition: HubTransition;
  /** "staggered" in the prototype's table — the parts arrive in turn. */
  staggered: boolean;
  /** How the phone arrangement differs, when the prototype says so. */
  phoneNote: string | null;
  thumb: { desk: readonly SceneThumbBox[]; phone: readonly SceneThumbBox[] };
};

type Def = Omit<SceneTemplate, 'id'>;

/* The table. Name · preset · transition read from the prototype's v3 notes
   ("★ 1 Photo left, words right · Calm · Scroll — … — 25 Questions & answers ·
   Editorial · Scroll (phone: list)"); boxes from each tile's markup. */
const T: Record<SceneTemplateId, Def> = {
  1: {
    name: 'Photo left, words right', family: 'media_text', approved: true, layout: 'side',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 6, 12, 44, 76], ['line', 56, 32, 36, 7], ['line', 56, 48, 30, 5]],
      phone: [['photo', 10, 6, 80, 42], ['line', 12, 58, 76, 6], ['line', 12, 70, 50, 5]],
    },
  },
  2: {
    name: 'Photo right, words left', family: 'media_text', approved: true, layout: 'side',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 50, 12, 44, 76], ['line', 8, 32, 36, 7], ['line', 8, 48, 30, 5]],
      phone: [['photo', 10, 6, 80, 42], ['line', 12, 58, 76, 6], ['line', 12, 70, 50, 5]],
    },
  },
  3: {
    name: 'Photo above, words below', family: 'media_text', approved: false, layout: 'stack',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 10, 6, 80, 50], ['line', 22, 68, 56, 7], ['line', 30, 82, 40, 5]],
      phone: [['photo', 8, 6, 84, 44], ['line', 14, 60, 72, 6], ['line', 20, 72, 60, 5]],
    },
  },
  4: {
    name: 'Full photo, words on top', family: 'media_text', approved: true, layout: 'over',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'cinematic', transition: 'scrub', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 0, 0, 100, 100], ['line', 10, 70, 50, 7, 'l']],
      phone: [['photo', 0, 0, 100, 100], ['line', 12, 78, 60, 6, 'l']],
    },
  },
  5: {
    name: 'Clip with a caption', family: 'media_text', approved: false, layout: 'stack',
    media: 1, clip: true, blocks: 0, builtOn: null, preset: 'cinematic', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 8, 8, 84, 66], ['play', 46, 32, 0, 0], ['line', 30, 84, 40, 5]],
      phone: [['photo', 8, 8, 84, 52], ['play', 42, 26, 0, 0], ['line', 24, 70, 52, 5]],
    },
  },
  6: {
    name: 'Portrait photo + pull quote', family: 'media_text', approved: false, layout: 'side',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'editorial', transition: 'scrub', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 8, 8, 34, 84], ['line', 50, 30, 42, 9, 'a'], ['line', 56, 50, 30, 5]],
      phone: [['photo', 20, 6, 60, 46], ['line', 14, 60, 72, 7, 'a'], ['line', 26, 74, 48, 5]],
    },
  },
  7: {
    name: 'Half photo, half colour', family: 'media_text', approved: false, layout: 'half',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 0, 0, 50, 100], ['col', 50, 0, 50, 100], ['line', 58, 40, 32, 7], ['line', 58, 54, 24, 5]],
      phone: [['photo', 0, 0, 100, 50], ['col', 0, 50, 100, 50], ['line', 14, 64, 72, 6], ['line', 14, 76, 50, 5]],
    },
  },
  8: {
    name: 'Words only', family: 'text', approved: true, layout: 'words',
    media: 0, clip: false, blocks: 0, builtOn: null, preset: 'editorial', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['line', 14, 26, 72, 9], ['line', 14, 46, 72, 5], ['line', 14, 58, 60, 5]],
      phone: [['line', 12, 30, 76, 7], ['line', 12, 48, 76, 5], ['line', 12, 58, 60, 5]],
    },
  },
  9: {
    name: 'Big quote', family: 'text', approved: false, layout: 'quote',
    media: 0, clip: false, blocks: 0, builtOn: null, preset: 'editorial', transition: 'scrub', staggered: false, phoneNote: null,
    thumb: {
      desk: [['line', 22, 32, 56, 11, 'a'], ['line', 34, 62, 32, 5]],
      phone: [['line', 14, 36, 72, 9, 'a'], ['line', 30, 60, 40, 5]],
    },
  },
  10: {
    name: 'Title card', family: 'text', approved: false, layout: 'title',
    media: 0, clip: false, blocks: 0, builtOn: 'names', preset: 'editorial', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: { desk: [['txt', 0, 38, 100, 0]], phone: [['txt', 0, 40, 100, 0]] },
  },
  11: {
    name: 'Letter', family: 'text', approved: false, layout: 'letter',
    media: 0, clip: false, blocks: 0, builtOn: 'special_message', preset: 'still', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['line', 16, 20, 68, 5], ['line', 16, 32, 68, 5], ['line', 16, 44, 60, 5], ['line', 16, 56, 64, 5], ['line', 52, 74, 32, 6, 'a']],
      phone: [['line', 12, 16, 76, 5], ['line', 12, 28, 76, 5], ['line', 12, 40, 70, 5], ['line', 12, 52, 72, 5], ['line', 12, 64, 60, 5], ['line', 50, 80, 38, 5, 'a']],
    },
  },
  12: {
    name: 'Big number', family: 'text', approved: false, layout: 'number',
    media: 0, clip: false, blocks: 0, builtOn: 'countdown', preset: 'editorial', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['txt', 0, 26, 100, 0], ['line', 36, 72, 28, 5]],
      phone: [['txt', 0, 30, 100, 0], ['line', 30, 72, 40, 5]],
    },
  },
  13: {
    name: 'Full photo', family: 'media', approved: false, layout: 'bleed',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'cinematic', transition: 'scrub', staggered: false, phoneNote: null,
    thumb: { desk: [['photo', 0, 0, 100, 100]], phone: [['photo', 0, 0, 100, 100]] },
  },
  14: {
    name: 'Full clip', family: 'media', approved: false, layout: 'bleed',
    media: 1, clip: true, blocks: 0, builtOn: null, preset: 'cinematic', transition: 'scrub', staggered: false, phoneNote: null,
    thumb: {
      desk: [['photo', 0, 0, 100, 100], ['play', 46, 44, 0, 0]],
      phone: [['photo', 0, 0, 100, 100], ['play', 42, 46, 0, 0]],
    },
  },
  15: {
    name: 'Framed photo', family: 'media', approved: false, layout: 'framed',
    media: 1, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['col', 0, 0, 100, 100], ['photo', 24, 10, 52, 80]],
      phone: [['col', 0, 0, 100, 100], ['photo', 14, 16, 72, 64]],
    },
  },
  16: {
    name: 'Monogram on colour', family: 'media', approved: false, layout: 'mono',
    media: 0, clip: false, blocks: 0, builtOn: 'monogram', preset: 'still', transition: 'scroll', staggered: false, phoneNote: null,
    thumb: {
      desk: [['col', 0, 0, 100, 100], ['txt', 0, 30, 100, 0]],
      phone: [['col', 0, 0, 100, 100], ['txt', 0, 36, 100, 0]],
    },
  },
  17: {
    name: 'Two side by side', family: 'photos', approved: false, layout: 'pair',
    media: 2, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: true, phoneNote: 'stacked',
    thumb: {
      desk: [['photo', 6, 12, 42, 76], ['photo', 52, 12, 42, 76]],
      phone: [['photo', 10, 6, 80, 42], ['photo', 10, 52, 80, 42]],
    },
  },
  18: {
    name: 'Three mosaic', family: 'photos', approved: false, layout: 'mosaic',
    media: 3, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: true, phoneNote: '1 + 2',
    thumb: {
      desk: [['photo', 6, 8, 56, 84], ['photo', 66, 8, 28, 39], ['photo', 66, 53, 28, 39]],
      phone: [['photo', 10, 6, 80, 46], ['photo', 10, 56, 38, 38], ['photo', 52, 56, 38, 38]],
    },
  },
  19: {
    name: 'Grid of four', family: 'photos', approved: false, layout: 'grid',
    media: 4, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: true, phoneNote: '2 × 2',
    thumb: {
      desk: [['photo', 6, 8, 42, 39], ['photo', 52, 8, 42, 39], ['photo', 6, 53, 42, 39], ['photo', 52, 53, 42, 39]],
      phone: [['photo', 8, 8, 40, 40], ['photo', 52, 8, 40, 40], ['photo', 8, 52, 40, 40], ['photo', 52, 52, 40, 40]],
    },
  },
  20: {
    name: 'Photo strip', family: 'photos', approved: false, layout: 'strip',
    media: 3, clip: false, blocks: 0, builtOn: null, preset: 'still', transition: 'scroll', staggered: false, phoneNote: 'swipe',
    thumb: {
      desk: [['photo', 4, 20, 28, 60], ['photo', 36, 20, 28, 60], ['photo', 68, 20, 28, 60]],
      phone: [['photo', 8, 22, 70, 56], ['photo', 84, 22, 30, 56]],
    },
  },
  21: {
    name: 'Collage of 5–6', family: 'photos', approved: false, layout: 'collage',
    media: 6, clip: false, blocks: 0, builtOn: null, preset: 'calm', transition: 'scroll', staggered: true, phoneNote: '2 columns',
    thumb: {
      desk: [['photo', 4, 6, 30, 44], ['photo', 36, 6, 28, 44], ['photo', 66, 6, 30, 44], ['photo', 4, 54, 44, 40], ['photo', 50, 54, 46, 40]],
      phone: [['photo', 8, 6, 40, 28], ['photo', 52, 6, 40, 28], ['photo', 8, 38, 40, 28], ['photo', 52, 38, 40, 28], ['photo', 8, 70, 40, 24], ['photo', 52, 70, 40, 24]],
    },
  },
  22: {
    name: 'Two columns', family: 'texts', approved: false, layout: 'cols',
    media: 0, clip: false, blocks: 2, builtOn: null, preset: 'editorial', transition: 'scroll', staggered: false, phoneNote: 'stacked',
    thumb: {
      desk: [['line', 8, 28, 36, 7], ['line', 8, 46, 36, 5], ['line', 56, 28, 36, 7], ['line', 56, 46, 36, 5]],
      phone: [['line', 12, 20, 76, 6], ['line', 12, 32, 60, 5], ['line', 12, 56, 76, 6], ['line', 12, 68, 60, 5]],
    },
  },
  23: {
    name: 'Three short blocks', family: 'texts', approved: false, layout: 'cols',
    media: 0, clip: false, blocks: 3, builtOn: null, preset: 'editorial', transition: 'scroll', staggered: true, phoneNote: 'list',
    thumb: {
      desk: [['line', 6, 30, 26, 7], ['line', 6, 46, 26, 5], ['line', 37, 30, 26, 7], ['line', 37, 46, 26, 5], ['line', 68, 30, 26, 7], ['line', 68, 46, 26, 5]],
      phone: [['line', 12, 16, 60, 6], ['line', 12, 40, 60, 6], ['line', 12, 64, 60, 6]],
    },
  },
  24: {
    name: 'Timeline', family: 'texts', approved: false, layout: 'timeline',
    media: 0, clip: false, blocks: 6, builtOn: 'milestones', preset: 'editorial', transition: 'scrub', staggered: true, phoneNote: null,
    thumb: {
      desk: [['line', 6, 50, 88, 2, 'a'], ['dot', 14, 44, 0, 0], ['dot', 40, 44, 0, 0], ['dot', 66, 44, 0, 0], ['line', 8, 62, 16, 5], ['line', 34, 62, 16, 5], ['line', 60, 62, 16, 5]],
      phone: [['line', 18, 8, 2, 84, 'a'], ['dot', 14, 14, 0, 0], ['dot', 14, 44, 0, 0], ['dot', 14, 74, 0, 0], ['line', 30, 14, 56, 5], ['line', 30, 44, 56, 5], ['line', 30, 74, 56, 5]],
    },
  },
  25: {
    name: 'Questions & answers', family: 'texts', approved: false, layout: 'qa',
    media: 0, clip: false, blocks: 6, builtOn: null, preset: 'editorial', transition: 'scroll', staggered: false, phoneNote: 'list',
    thumb: {
      desk: [['line', 8, 22, 30, 7, 'a'], ['line', 8, 36, 36, 5], ['line', 56, 52, 30, 7, 'a'], ['line', 56, 66, 36, 5]],
      phone: [['line', 12, 14, 50, 6, 'a'], ['line', 12, 26, 70, 5], ['line', 12, 50, 50, 6, 'a'], ['line', 12, 62, 70, 5]],
    },
  },
};

export const SCENE_TEMPLATES: Readonly<Record<SceneTemplateId, SceneTemplate>> = Object.fromEntries(
  SCENE_TEMPLATE_IDS.map((id) => [id, { id, ...T[id] }]),
) as Record<SceneTemplateId, SceneTemplate>;

/** A stored template id, or null. Nothing is repaired: '18', 18.5, 26 → null. */
export function sceneTemplateId(value: unknown): SceneTemplateId | null {
  return typeof value === 'number' && (SCENE_TEMPLATE_IDS as readonly number[]).includes(value)
    ? (value as SceneTemplateId)
    : null;
}

/** The form-post shape ("18") → an id, or null. Only digits, only 1–25. */
export function sceneTemplateIdFromForm(value: unknown): SceneTemplateId | null {
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value)) return null;
  return sceneTemplateId(Number(value));
}

/** The templates of one family, in the picker's order. */
export function sceneTemplatesIn(family: SceneFamily): SceneTemplate[] {
  return SCENE_TEMPLATE_IDS.map((id) => SCENE_TEMPLATES[id]).filter((t) => t.family === family);
}

/**
 * WHAT A FRESH SCENE FROM THIS TEMPLATE STORES — the owner's "every scene
 * template comes with a default effect … but they can still change it"
 * (DECISION_LOG 2026-09-24).
 *
 * 🔑 THE DEFAULTS ARE WRITTEN, not inferred later, and only where they differ
 * from what an absence already means. Scroll is an absence (`lib/hub-scenes.ts`)
 * and so is "together", so a Calm · Scroll template stores `preset` alone. A
 * staggered Calm stores `sequence` too, because Calm's own body arrives
 * together. This is the canvas's "Auto is an absence" rule applied to the pick.
 *
 * `withMotion` false (a free couple): only the template itself is stored. The
 * motion and the transition are Event Hub Pro, and the renderer would draw a
 * Scrub as Scroll without it anyway — storing it would be a saved value that
 * moves no pixels.
 */
export function sceneTemplateDefaults(
  id: SceneTemplateId,
  withMotion: boolean,
): { template: SceneTemplateId; preset?: HubMotionPreset; transition?: 'scrub' | 'auto'; sequence?: 'one_after_another' } {
  const t = SCENE_TEMPLATES[id];
  if (!withMotion) return { template: id };
  return {
    template: id,
    preset: t.preset,
    ...(t.transition !== 'scroll' ? { transition: t.transition } : {}),
    // Editorial and Cinematic already arrive in turn; only Calm/Still need it said.
    ...(t.staggered && (t.preset === 'calm' || t.preset === 'still') ? { sequence: 'one_after_another' as const } : {}),
  };
}

/**
 * WHICH SLOTS THE EDITOR OFFERS — pictures first, then word blocks. A slot's
 * index is its position in `canvas.slots`; picture slot i and word block i
 * share index i (a template has one kind or the other beyond slot 0, never
 * both at the same index in a way that collides — media templates have no
 * blocks and block templates have no media).
 */
export function sceneSlotCount(id: SceneTemplateId): number {
  const t = SCENE_TEMPLATES[id];
  return Math.max(t.media, t.blocks);
}

/**
 * The words a scene built on a shipped part will print, so the picker can
 * say what fills it ("filled from your event"). `null` when the scene is the
 * couple's own words entirely.
 */
export const SCENE_BUILT_ON_LABEL: Record<NonNullable<SceneTemplate['builtOn']>, string> = {
  names: 'Your names, from your event',
  special_message: 'Your special message, unless you write this one',
  countdown: 'The days to go, counted from your date',
  monogram: 'Your monogram',
  milestones: 'Your love-story milestones, unless you write your own',
};

/**
 * Does this template need a picture to say anything? In the app-store shell
 * (Pro hidden) a media template still shows, but without its media slot
 * (build plan Phase 5, "Store shell").
 */
export function sceneTemplateNeedsMedia(id: SceneTemplateId): boolean {
  const t = SCENE_TEMPLATES[id];
  return t.media > 0 && t.blocks === 0 && t.builtOn === null && t.family !== 'media_text';
}

/**
 * THE CLASSES A TEMPLATE SCENE'S `<section>` CARRIES — its layout, plus the
 * id for the few per-template differences one layout still has (2 flips the
 * picture to the right; 6 is a portrait with a pull quote; 23 is three
 * columns, not two). `the-canvas-fails-visible.test.ts` builds its "emitted"
 * set by rendering all 25, so no rule can style a class nothing emits.
 */
export function sceneTemplateClass(id: SceneTemplateId): string {
  const t = SCENE_TEMPLATES[id];
  return ['hub-tpl', `hub-tpl-${t.layout}`, `hub-tpl-n${id}`, ...(t.clip ? ['hub-tpl-clip'] : [])].join(' ');
}
