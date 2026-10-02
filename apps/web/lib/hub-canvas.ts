/**
 * apps/web/lib/hub-canvas.ts
 *
 * THE EVENT HUB CANVAS CONTRACT — what a couple arranged, as data.
 *
 * Owner, 2026-09-23, choosing between free placement and a bounded one: **"rails
 * on."** So this is NOT a drag engine and stores no pixel offsets. A section's
 * composition is one of four ARRANGEMENTS on a grid that reflows, a photo's crop
 * is a 3x3 FOCAL POINT, and the motion is a PRESET the couple may fine-tune.
 *
 * 🔑 THE REASON IS THE PHONE. Canva composes a fixed rectangle, so "300px from
 * the left" is always true there. Our page is 375px on a phone and 1440px on a
 * laptop; a stored pixel offset is a bug waiting for a guest, and the guest
 * finding out is worse than the couple being slightly constrained.
 *
 * ── WHERE IT LIVES ─────────────────────────────────────────────────────────
 * `invitation_widgets.config_json`, which ALREADY EXISTS and which nothing has
 * ever read as a shape (it is typed `unknown` in `lib/invitation-widgets.ts`).
 * No migration, and therefore no exposure freeze, no Ugat node and no prod
 * ledger to touch — a flag/filter flip beats new schema, and an existing empty
 * column beats both.
 *
 * ── WHY A PURE MODULE ──────────────────────────────────────────────────────
 * Three different surfaces have to agree about one arrangement: the editor that
 * writes it, the guest page that draws it, and the controller's miniature that
 * shows the guest page. If each parsed `config_json` its own way they would
 * drift, and the drift would be invisible until a couple saw their page look
 * wrong. Everything here is pure and none of it does I/O.
 *
 * ⚠ STORED CONFIG IS DATA A HUMAN SAVED MONTHS AGO, NOT A PROMISE ABOUT SHAPE.
 * `sanitizeHubCanvas` drops anything it does not recognise rather than
 * repairing it — the same rule `sanitizeRoleAttire` follows one file over.
 *
 * ⚠ "AUTO" IS AN ABSENCE, NOT A VALUE. Every fine-tune override is optional,
 * and an unset one means "whatever the preset says". Storing the literal string
 * 'auto' would freeze today's preset body into a couple's saved page, so that a
 * later change to what "Calm" means would silently not reach them.
 */

import { siteMediaServeRef } from '@/lib/site-media-ref';
import { hubAutoSpeed, hubTransition, type HubAutoSpeed, type HubTransition } from '@/lib/hub-scenes';
import { SCENE_MAX_SLOTS, sceneTemplateId, type SceneTemplateId } from '@/lib/scene-templates';
import { sanitizeSceneStyleId } from '@/lib/scene-style-id';
import { isPostEventPresetId, type PostEventPresetId } from '@/lib/post-event-preset-ids';
import { CUSTOM_COLUMN_TITLE_MAX } from '@/app/[slug]/_components/editorial/custom-columns';
import { sanitizeHubTint, type HubTint } from '@/lib/adaptive-theme';
import { sanitizeHubElements, type HubElementStyles } from '@/lib/element-style';
import { ombreCss } from '@/lib/ombre';
import { sanitizeDetailsOverrides, type HubDetailsOverrides } from '@/lib/details-bound';
import { sanitizeHeroDesign, type HeroDesignId } from '@/lib/hero-design';
import { isStdLibrarySrc } from '@/lib/std-backgrounds';

/* ── THE FOUR ARRANGEMENTS ─────────────────────────────────────────────────
   From the approved prototypes (`story-canvas-editor-2026-09-23.html`, radio
   group `L`). `full` is the photo behind the words; `left`/`right` put the
   photo on one side and the words on the other; `text` is words only. */
export const HUB_ARRANGEMENTS = ['full', 'left', 'right', 'text'] as const;
export type HubArrangement = (typeof HUB_ARRANGEMENTS)[number];

export const HUB_ARRANGEMENT_LABEL: Record<HubArrangement, string> = {
  full: 'Photo behind the words',
  left: 'Photo on the left',
  right: 'Photo on the right',
  text: 'Words only',
};

/* ── THE FOUR MOTION PRESETS ───────────────────────────────────────────────
   `details-section-editor-2026-09-23.html`, radio group `ps`. Owner, on the
   eight knobs the first draft had: "we still want it to be simple enough that
   they could customize this." Four names, and the knobs underneath default to
   Auto. */
export const HUB_MOTION_PRESETS = ['still', 'calm', 'editorial', 'cinematic'] as const;
export type HubMotionPreset = (typeof HUB_MOTION_PRESETS)[number];

export const HUB_MOTION_PRESET_LABEL: Record<HubMotionPreset, string> = {
  still: 'Still',
  calm: 'Calm',
  editorial: 'Editorial',
  cinematic: 'Cinematic',
};

/* ── THE FINE-TUNE VOCABULARY ──────────────────────────────────────────────
   Every list below is the prototype's, label for label. `out` exists because
   the owner corrected an earlier draft that had ruled it out: a TIMED exit
   fights the reader, but a SCRUBBED one is the handoff to the next section. */
/* ── WHAT AN ARRIVAL OR A DEPARTURE DOES, AND WHICH WAY ────────────────────
   Owner, 2026-09-23: *"so we can make different stories fade in while entering
   from different areas and move and fade out or just move out"*.

   🔴 THE FIRST VOCABULARY COULD NOT SAY THAT. It had `rise` (from below, always
   fading) and `slide` (from the left, always fading) — direction and fade were
   WELDED TOGETHER, so "just move out, no fade" was not expressible at all. Not
   hard to reach: absent from the vocabulary.

   🔑 SO THEY ARE TWO AXES. WHAT it does, and WHICH WAY. Four ways × two
   move-effects gives ten entrances and ten departures out of two small
   controls, and "move without fading" is one of them because it is a value
   rather than a missing keyframe.

   Nothing in production holds either field — the canvas has never merged — so
   this replaces the old list outright rather than carrying it. */
export const HUB_IN = ['none', 'fade', 'move', 'move_fade'] as const;
export const HUB_OUT = ['none', 'fade', 'move', 'move_fade', 'settle'] as const;
export const HUB_DURING = ['still', 'lift'] as const;
/** `time` plays once on arrival; `scrub` follows the scroll and reverses. */
export const HUB_TIMELINE = ['time', 'scrub'] as const;

/**
 * WHERE THE SECTION IS AT THE FAR END OF THE MOVE.
 *
 * One vocabulary for both ends, because it is one fact: an entrance STARTS
 * there and a departure ENDS there. Only the words the couple reads differ,
 * which is why there are two label maps and one list.
 */
export const HUB_DIRECTIONS = ['below', 'above', 'left', 'right'] as const;
export type HubDirection = (typeof HUB_DIRECTIONS)[number];

export type HubIn = (typeof HUB_IN)[number];
export type HubOut = (typeof HUB_OUT)[number];
export type HubDuring = (typeof HUB_DURING)[number];
export type HubTimeline = (typeof HUB_TIMELINE)[number];

export const HUB_IN_LABEL: Record<HubIn, string> = {
  none: 'Already there',
  fade: 'Fade in',
  move: 'Move in',
  move_fade: 'Move in and fade',
};
export const HUB_OUT_LABEL: Record<HubOut, string> = {
  none: 'Stay put',
  fade: 'Fade away',
  move: 'Move away',
  move_fade: 'Move away and fade',
  settle: 'Settle back',
};
export const HUB_IN_DIRECTION_LABEL: Record<HubDirection, string> = {
  below: 'From below',
  above: 'From above',
  left: 'From the left',
  right: 'From the right',
};
export const HUB_OUT_DIRECTION_LABEL: Record<HubDirection, string> = {
  below: 'Downward',
  above: 'Upward',
  left: 'To the left',
  right: 'To the right',
};

/** Does this effect travel? Only then is a direction anything but noise. */
export function hubInMoves(v: HubIn): boolean {
  return v === 'move' || v === 'move_fade';
}
export function hubOutMoves(v: HubOut): boolean {
  return v === 'move' || v === 'move_fade';
}

export const HUB_STAGGER = [0, 0.12, 0.25] as const;
export const HUB_DURATION = [0.6, 1.1, 1.8] as const;

export const HUB_TIMELINE_LABEL: Record<HubTimeline, string> = {
  time: 'Plays once',
  scrub: 'Follows the scroll',
};
export const HUB_DURING_LABEL: Record<HubDuring, string> = {
  still: 'Still',
  lift: 'Slow lift',
};


/* ── HOW THE PARTS OF A SECTION ARRIVE ─────────────────────────────────────
   Owner, 2026-09-23, asked for this directly and it is the point of the
   element scope: a section can arrive as ONE SLAB, or its parts — the small
   label, the heading, the words, the list — can arrive in turn.

   🔑 THE PARTS NEEDED NO MARKING. Measured on the rendered DOM, every widget
   returns a single `<section>` whose DIRECT CHILDREN are exactly its parts
   (the love story has four, a custom section two). So "one after another"
   addresses `.hub-canvas-body > * > *` and not one widget component had to
   change. `every-widget-is-one-section.test.ts` holds that shape: a widget
   that returned two top-level nodes would make this selector address the
   wrong level, silently. */
export const HUB_SEQUENCES = ['together', 'one_after_another'] as const;
export type HubSequence = (typeof HUB_SEQUENCES)[number];

export const HUB_SEQUENCE_LABEL: Record<HubSequence, string> = {
  together: 'All at once',
  one_after_another: 'One part after another',
};

/** How many parts get their own delay before the sequence stops deepening. */
export const HUB_SEQUENCE_DEPTH = 8;

/** 1–9, reading like a phone keypad: 1 top-left, 5 centre, 9 bottom-right. */
export const HUB_FOCAL_POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type HubFocalPoint = (typeof HUB_FOCAL_POINTS)[number];

/** How far into the frame the photo is pushed. 100 = as given. */
export const HUB_ZOOMS = [100, 120, 150] as const;
export type HubZoom = (typeof HUB_ZOOMS)[number];

/**
 * ONE SECTION, AS THE COUPLE LEFT IT.
 *
 * Every field is optional and an absent one means "whatever the preset says" —
 * see the Auto note at the top. `preset` itself defaults to `calm`.
 */
export type HubSectionCanvas = {
  arrangement?: HubArrangement;
  focal?: HubFocalPoint;
  zoom?: HubZoom;
  /**
   * THE SECTION'S BACKGROUND, as a stored asset ref (`r2://bucket/key`) or a
   * legacy absolute URL — the same TEXT shape every other website-media column
   * holds, resolved at render by `displayUrlForStoredAsset`.
   *
   * 🔑 A REF, NEVER AN INDEX INTO A LIST. The couple picks from photos they
   * already have, and that list reorders every time they add or remove one. A
   * stored position would silently move a section's background when the gallery
   * changed, with nothing red anywhere — a carried-but-unread value that reads
   * like a decision. The ref identifies the photo itself.
   *
   * 🔒 AND IT IS HELD TO THE PUBLIC BUCKET on the way in, by the same
   * `siteMediaServeRef` allow-list the database CHECK on website media uses. A
   * `config_json` is couple-writable; a ref naming `setnayan-thread-files` or
   * `setnayan-vendor-verification` must never reach the signer from here.
   */
  media?: string;
  /**
   * WHICH background it is (`HUB_BACKGROUND_KINDS`). Absent means `photo` — see
   * `resolveHubBackground`, which is the one place that rule is written.
   *
   * ⚠ A `snippet` rides the SAME `media` field and the SAME allow-list as a
   * photo. That is deliberate: one field, one fence. Giving video its own
   * ref field would be a second door to check, and the second door is always
   * the one nobody checks.
   */
  kind?: HubBackgroundKind;
  /** The scene's colour — for `color`, `diagonal`, `glow`, and the tint of
   *  `glass` / `frost`. `#rrggbb`. Never a ref — see `hubBackgroundColor`. */
  color?: string;
  /** A glass's own opacity, 20–100 — see `hubGlassOpacity`. */
  opacity?: number;
  /**
   * 🔖 "JUST THIS SCENE" (owner 2026-09-27: *"setting a background for one can
   * be asked if they want to apply it to all or just this"*). Set when the
   * couple answered Just this scene: the scene wears "Own background · ↺ Use
   * the Event Hub's" and an "Every scene" answer elsewhere leaves it alone
   * no longer — see `lib/scene-background-scope.ts`. Kept only beside a
   * background.
   */
  own?: true;
  /**
   * 🖼 FRAMED OR FULL WIDTH (owner 2026-09-27: *"we will set it as a frame or
   * will the whole width. the user can choose"*). Absent = `framed`, the
   * default. Kept only beside a background that paints something — "No
   * background" has no box to shape.
   */
  shape?: HubSceneShape;
  /**
   * 🌄 HOW A PHOTO BACKGROUND MOVES — Still (absent) or Parallax (owner
   * 2026-09-28: *"where is the upload media/: photo parallax effect or snippet
   * that would run like the background?"*). Parallax is the SHIPPED hero
   * parallax (`PahinaCoverParallax` + the `.pahina-js` rule in globals.css),
   * never a second mechanism: the photo layer wears `data-pahina-parallax` and
   * the frame `hub-bg-parallax`. Kept only beside a PHOTO — a snippet already
   * moves, a colour has nothing to drift. Media is Pro, so this is too.
   */
  mediaMotion?: HubMediaMotion;
  /**
   * 🎞 A SNIPPET'S STILL — a frame of the clip grabbed in the browser
   * (`extractPosterFrame`, the Main background's own rule), or the hero photo
   * for the hero clip. While an unscreened clip may not reach a guest
   * (`GUEST_HERO_VIDEO_PLAYBACK`), guests see THIS behind the scene instead of
   * nothing (`sceneGround`). Same `hubMediaRef` fence as `media`; kept only
   * beside a snippet.
   */
  poster?: string;
  preset?: HubMotionPreset;
  /** Fine-tune. Each absent when the couple left it on Auto. */
  in?: HubIn;
  /** Where it comes FROM. Ignored, and not stored, unless `in` travels. */
  inFrom?: HubDirection;
  out?: HubOut;
  /** Where it goes TO. Ignored, and not stored, unless `out` travels. */
  outTo?: HubDirection;
  during?: HubDuring;
  timeline?: HubTimeline;
  stagger?: number;
  duration?: number;
  /** Do the section's parts arrive together, or in turn? */
  sequence?: HubSequence;
  /**
   * Scroll · Scrub · Auto-scroll (owner 2026-09-24) — the transition FROM this
   * scene TO THE NEXT one; the last scene's value is ignored. Absent means
   * Scroll. Contract and renderer: `lib/hub-scenes.ts`.
   */
  transition?: HubTransition;
  /** Only stored beside `transition: 'auto'`; absent means Normal. */
  autoSpeed?: HubAutoSpeed;
  /* ── SCENES (Event Hub Maker Phase 5, owner 2026-09-24) ───────────────────
     Every scene a couple adds starts from one of 25 templates
     (`lib/scene-templates.ts`); these five keys are the whole of what a
     template scene stores beyond the fields above. All optional; an absent
     one means "the template's own shape". */
  /** Which of the 25 templates (1–25). Absent = not a template scene. */
  template?: SceneTemplateId;
  /**
   * 🎨 THE SCENE'S STYLE (owner 2026-09-29, "EVERY SCENE ON EVERY STAGE HAS AT
   * LEAST THREE PREMADE STYLES") — a permanent style id from the ONE registry
   * (`lib/scene-styles.ts`, resolved per stage by `resolveSceneStyle`). FREE:
   * not a look key (`HUB_CANVAS_LOOK_KEYS`). Absent = the stage's default. One
   * row, one value: a scene shown on several stages wears the same pick
   * wherever that style is drawn.
   */
  style?: string;
  /**
   * 🎨 HOW THE DRESS CODE'S "OUR COLOURS" IS DRAWN (owner 2026-09-29, "APPROVED —
   * FIVE PALETTE STYLES, PICKED ON THE TOOLBAR") — one of the five looks in
   * `lib/palette-looks.ts`, beside `style` and stored the same way. FREE: not a
   * look key. Absent = Tags, today's look.
   */
  palette?: string;
  /**
   * 🏛 THE VENUE SCENE'S MAP SWITCH (owner 2026-09-30, "VENUE STYLES APPROVED":
   * *Map: One map for both / No map*). Only `'none'` is stored; absent = one map
   * for both, the default. FREE: not a look key. Read by `venueMapOfRow`.
   */
  venueMap?: 'none';
  /**
   * 🎞 A POST EVENT PRESET SCENE (`lib/post-event-presets.ts`) — which of Post
   * Event's twelve presets seeded this scene of the couple's own. NOT `preset`,
   * which is the scene's motion. Its presence puts the scene on Post Event only
   * (`widgetsGuestsMeet`) and makes showing it Event Hub Pro at Apply (E3).
   */
  postEventPreset?: PostEventPresetId;
  /**
   * What fills the template's slots, by position. A picture slot holds a
   * `media` ref (held to the public bucket by the SAME `hubMediaRef` fence as
   * the background — one fence) and its `kind`; a word block holds `head` and
   * `text`. A slot the couple never filled is `{}` so positions never shift.
   */
  slots?: HubSceneSlot[];
  /**
   * SNAP GRID OFF — each slot's box as fractions of the scene box, so it
   * scales with the screen instead of storing pixels (owner 2026-09-24: "we
   * also create that snap grids (they can turn on or off)"). Absent = the grid
   * (the template's own arrangement), which is the default. All-or-nothing: one
   * bad box drops the lot, because `free[i]` is slot i and dropping one would
   * shift every box after it onto the wrong picture.
   */
  free?: HubFreeBox[];
  /**
   * PER-STAGE ORDER AND VISIBILITY, keyed by the four public stages
   * (`PUBLIC_STAGE_ORDER`). Absent = the row's own `display_order` and `mode`,
   * which is what every stage shows today. Whether the owner wants six scenes
   * PER stage (a new column) is decision D1 and is NOT pre-built here.
   */
  stages?: Partial<Record<HubStage, HubStageSetting>>;
  /**
   * HOW A CLIP IN THIS SCENE PLAYS (owner 2026-09-24: "short clips loop and
   * longer videos tap to play"). Absent = loop, silent, inline. `open` is kept
   * only beside `tap`, the direction rule again.
   */
  video?: HubSceneVideo;
  /**
   * ONE ELEMENT'S OWN LOOK (owner 2026-09-26/27: *"tapping element, changes
   * fonts, color, size, animation"*) — font · colour · size · animation per
   * element, each winning over the theme for that element only, like Keynote.
   * On the hero row: the invitation card's six parts; on any other scene: its
   * label, heading and words. Absent = every element wears the theme. The
   * contract, the selectors and the CSS are `lib/element-style.ts`.
   */
  elements?: HubElementStyles;
  /**
   * 🎴 THE HERO'S DESIGN (owner 2026-09-26: *"designs are the initial design,
   * they can always improve it"*) — which arrangement of the hero's parts the
   * couple picked: The Marquee · The Crest · The Letter. Absent = The Card, the
   * shipped default. Only meaningful on the hero row; `elements` (the couple's
   * per-part edits) is a sibling, so a pick never touches an edit. Contract:
   * `lib/hero-design.ts`.
   */
  design?: HeroDesignId;
  /**
   * 🔗 THIS SCENE'S OWN VERSION OF A DETAILS FACT (owner 2026-09-25: *"they
   * will ask if do you want to update details and apply to all or just here"*).
   * Absent = the scene is BOUND to Details and shows its value; present = the
   * couple chose "Just this scene". Words, never look — not a Pro key. The
   * contract and the one read rule (`sceneBoundText`) are `lib/details-bound.ts`.
   */
  details?: HubDetailsOverrides;
};

/** One slot of a template scene. See `slots` above. */
export type HubSceneSlot = {
  media?: string;
  kind?: 'photo' | 'snippet';
  head?: string;
  text?: string;
};
export type HubFreeBox = { x: number; y: number; w: number; h: number };
export const HUB_STAGES = ['save_the_date', 'rsvp', 'event', 'editorial'] as const;
export type HubStage = (typeof HUB_STAGES)[number];
export type HubStageSetting = { order?: number; mode?: 'auto' | 'shown' | 'hidden' };
export const HUB_VIDEO_PLAYS = ['loop', 'tap'] as const;
export const HUB_VIDEO_OPENS = ['fullscreen', 'inplace'] as const;
export type HubSceneVideo = {
  play: (typeof HUB_VIDEO_PLAYS)[number];
  open?: (typeof HUB_VIDEO_OPENS)[number];
};

/** A word block's heading — the recap's custom-column title limit, one home. */
export const HUB_SLOT_HEAD_MAX = CUSTOM_COLUMN_TITLE_MAX;
/**
 * A word block's text. A block is a short piece (a timeline entry, one answer),
 * not the scene's whole body, which keeps the recap's 4,000. 600 is the
 * scene-editor's own ceiling, sized so six blocks still fit one screen.
 */
export const HUB_SLOT_TEXT_MAX = 600;

/** What the preset means, once nothing is left to interpret. */
export type HubResolvedMotion = {
  sequence: HubSequence;
  in: HubIn;
  inFrom: HubDirection;
  out: HubOut;
  outTo: HubDirection;
  during: HubDuring;
  timeline: HubTimeline;
  stagger: number;
  duration: number;
};

/**
 * THE PRESET BODIES.
 *
 * ⚠ These six numbers and words per row are a DESIGN CALL, not a measurement,
 * and they are the reason "Auto" must stay an absence: change a row here and
 * every couple on Auto moves with it, which is the point. A couple who reached
 * in and chose "Fade" keeps Fade.
 */
export const HUB_PRESET_BODY: Record<HubMotionPreset, HubResolvedMotion> = {
  still:     { sequence: 'together',          in: 'none',      inFrom: 'below', out: 'none',      outTo: 'above', during: 'still', timeline: 'time',  stagger: 0,    duration: 0.6 },
  calm:      { sequence: 'together',          in: 'fade',      inFrom: 'below', out: 'fade',      outTo: 'above', during: 'still', timeline: 'time',  stagger: 0.12, duration: 1.1 },
  editorial: { sequence: 'one_after_another', in: 'move_fade', inFrom: 'below', out: 'move_fade', outTo: 'above', during: 'still', timeline: 'scrub', stagger: 0.12, duration: 1.1 },
  cinematic: { sequence: 'one_after_another', in: 'move_fade', inFrom: 'left',  out: 'settle',    outTo: 'above', during: 'lift',  timeline: 'scrub', stagger: 0.25, duration: 1.8 },
};

export const HUB_DEFAULT_PRESET: HubMotionPreset = 'calm';
export const HUB_DEFAULT_ARRANGEMENT: HubArrangement = 'full';
export const HUB_DEFAULT_FOCAL: HubFocalPoint = 5;
export const HUB_DEFAULT_ZOOM: HubZoom = 100;

const inSet = <T,>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);

/**
 * Read one section's canvas out of whatever `config_json` holds.
 *
 * Drops rather than repairs. A `zoom` of 137 is not rounded to 150 and an `in`
 * of "Rise" is not lower-cased into place: a value this function did not
 * recognise is a value some other version of this product wrote, and guessing
 * what it meant is how two surfaces start drawing different pages.
 */
/**
 * A SECTION BACKGROUND, or null — STRICTER than `siteMediaServeRef` alone.
 *
 * 🪤 `siteMediaServeRef` passes any non-`r2://` string through VERBATIM as a
 * "legacy URL", which is correct for the columns that still hold old absolute
 * URLs and wrong here. Measured: it accepts `"1"`. So a stringified list index
 * — the exact mistake this field exists to avoid — would have been stored as a
 * background and rendered as `background-image: url("1")`, a relative request
 * against the guest's own page.
 *
 * A section background is always chosen from photos the couple already has, so
 * it is only ever an `r2://` ref in the public bucket or, for a legacy row, an
 * absolute `https://` URL. Anything else is not a photo and is dropped.
 */
export function hubMediaRef(value: unknown): string | null {
  /* 🖼 …or one of Setnayan's own ready-made Save the Date scenes, by its exact
     public path (`isStdLibrarySrc`, a closed list — owner 2026-09-29). */
  if (isStdLibrarySrc(value)) return value;
  const ref = siteMediaServeRef(value);
  if (!ref) return null;
  if (ref.startsWith('r2://')) return ref;          // already held to the public bucket
  return /^https:\/\/\S+$/.test(ref) ? ref : null;
}

/* ── WHAT A SECTION'S BACKGROUND IS MADE OF ────────────────────────────────
   Six kinds (owner 2026-09-27, DECISION_LOG "A SCENE'S BACKGROUND EXISTS TO
   SEPARATE IT FROM THE NEXT": *"full background color, opeque glass, frosted
   glass, upload a photo/video link, no background. the purpose of the
   background for a scene, is to create separation"*): a photo the couple
   already has, a short snippet of their own footage, a flat colour, OPAQUE
   GLASS and FROSTED GLASS — both tinted from the SAME colour, so the colour
   holds with or without the effect — and NO BACKGROUND, which means no box at
   all: the scene sits on the page ground ("NO BACKGROUND MEANS NO BOX").

   ⛔ NEVER A FILM. A section background plays behind words a guest is reading.
   A film asks to be watched, which is a different job and already has one —
   the Save-the-Date reveal owns full-screen video. A snippet is a few seconds
   of texture, muted and looping.

   🔑 `photo` IS WHAT AN EXISTING ROW MEANS, and that is a RULE, not a
   fallback. Every `config_json` in production today holds `media` with no
   `kind` beside it, because `kind` did not exist when they were written. Such
   a row is a PHOTO — it could never have been anything else, since `media` has
   only ever accepted a `hubMediaRef`. `resolveHubBackground` states that in one
   place so the next reader never has to wonder whether an absent `kind` means
   "photo" or means "half-written". */
export const HUB_BACKGROUND_KINDS = ['photo', 'snippet', 'color', 'diagonal', 'glow', 'glass', 'frost', 'none'] as const;
export type HubBackgroundKind = (typeof HUB_BACKGROUND_KINDS)[number];

export const HUB_BACKGROUND_KIND_LABEL: Record<HubBackgroundKind, string> = {
  photo: 'A photo',
  snippet: 'A few seconds of video',
  color: 'A flat colour',
  diagonal: 'Diagonal',
  glow: 'Glow',
  glass: 'Opaque glass',
  frost: 'Frosted glass',
  none: 'No background',
};

/**
 * The kinds a colour paints — a flat colour, its two ombrés, and the two
 * glasses it tints.
 *
 * 🌅 DIAGONAL AND GLOW PER SCENE (owner 2026-09-27, "MAKER TOOLBARS (KEYNOTE +
 * PAGES) APPROVED", answer 1: the scene row is *No background · Plain ·
 * Diagonal · Glow · Opaque · Frosted · Upload media*; Dawn is dropped here and
 * stays for the whole Event Hub only). The SAME two ombrés the Main background
 * offers (`lib/ombre.ts` `ombreCss`), derived from the scene's one colour — so
 * one colour holds across Plain, both ombrés and both glasses.
 */
export const HUB_TINTED_KINDS = ['color', 'diagonal', 'glow', 'glass', 'frost'] as const;
/** The two per-scene ombrés — a colour is required, like Plain. */
export const HUB_OMBRE_KINDS = ['diagonal', 'glow'] as const;
export type HubOmbreKind = (typeof HUB_OMBRE_KINDS)[number];

/**
 * 🪟 THE GLASS'S OPACITY (answer 5: *"both"* — Opaque and Frosted, 20–100%).
 * Absent = the pane the glass draws by itself (`lib/scene-legibility.ts`); a
 * stored value is the couple's own, in steps of 5. Kept only beside a glass.
 */
export const HUB_GLASS_OPACITY_MIN = 20;
export const HUB_GLASS_OPACITY_MAX = 100;
export const HUB_GLASS_OPACITY_STEP = 5;
export function hubGlassOpacity(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < HUB_GLASS_OPACITY_MIN || value > HUB_GLASS_OPACITY_MAX) return null;
  return value % HUB_GLASS_OPACITY_STEP === 0 ? value : null;
}
export type HubTintedKind = (typeof HUB_TINTED_KINDS)[number];
/** A glass chosen before any colour: a clear white pane over the page. */
export const HUB_GLASS_DEFAULT_TINT = '#ffffff';

/** FRAMED (an inset panel, rounded) or FULL WIDTH (edge to edge, square). */
export const HUB_SCENE_SHAPES = ['framed', 'full'] as const;
export type HubSceneShape = (typeof HUB_SCENE_SHAPES)[number];
export const HUB_DEFAULT_SCENE_SHAPE: HubSceneShape = 'framed';
export const HUB_SCENE_SHAPE_LABEL: Record<HubSceneShape, string> = { framed: 'Framed', full: 'Full width' };

/** How a photo background moves: Still (the absence) or Parallax. */
export const HUB_MEDIA_MOTIONS = ['still', 'parallax'] as const;
export type HubMediaMotion = Exclude<(typeof HUB_MEDIA_MOTIONS)[number], 'still'>;
export const HUB_MEDIA_MOTION_LABEL: Record<(typeof HUB_MEDIA_MOTIONS)[number], string> = {
  still: 'Still',
  parallax: 'Parallax',
};

/** `#rrggbb`, lowercased. The only shape a colour may take. */
const HUB_COLOR = /^#[0-9a-f]{6}$/;

/**
 * A COLOUR IS NOT A REFERENCE, AND MUST NEVER TAKE THE REF PATH.
 *
 * 🔒 `config_json` is couple-writable. `media` is held to the public bucket by
 * `hubMediaRef` above precisely because of that. A colour that were allowed to
 * travel as a "ref" would be a second doorway into the same field with no
 * allow-list on it — a way to smuggle `r2://setnayan-thread-files/…` past the
 * check by calling it a colour. So the colour has its OWN field and its own
 * shape, and anything that is not six hex digits is dropped.
 */
export function hubBackgroundColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return HUB_COLOR.test(v) ? v : null;
}

export function sanitizeHubCanvas(raw: unknown): HubSectionCanvas {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const canvas = (src.canvas && typeof src.canvas === 'object' && !Array.isArray(src.canvas)
    ? (src.canvas as Record<string, unknown>)
    : src);
  const out: HubSectionCanvas = {};
  if (inSet(HUB_ARRANGEMENTS, canvas.arrangement)) out.arrangement = canvas.arrangement;
  if (inSet(HUB_FOCAL_POINTS, canvas.focal)) out.focal = canvas.focal;
  if (inSet(HUB_ZOOMS, canvas.zoom)) out.zoom = canvas.zoom;
  const media = hubMediaRef(canvas.media);
  if (media) out.media = media;
  /* ⛔ THE KIND IS STORED ONLY WHERE IT MEANS SOMETHING, the same rule
     `inFrom`/`outTo` follow below. A `kind: 'photo'` with no media is not a
     background; a `kind: 'snippet'` whose ref was just dropped by the
     allow-list must not survive as a snippet with nothing to play, because a
     later reader would take the kind as evidence the media was once valid. */
  if (inSet(HUB_BACKGROUND_KINDS, canvas.kind)) {
    const kind = canvas.kind as HubBackgroundKind;
    if (kind === 'color' || kind === 'diagonal' || kind === 'glow') {
      const color = hubBackgroundColor(canvas.color);
      if (color) {
        out.kind = kind;
        out.color = color;
      }
    } else if (kind === 'glass' || kind === 'frost') {
      /* A glass is a choice on its own, so it is kept with or without a colour —
         with none it is a clear pane (`HUB_GLASS_DEFAULT_TINT`). A colour that is
         not six hex digits is dropped, never repaired. */
      out.kind = kind;
      const color = hubBackgroundColor(canvas.color);
      if (color) out.color = color;
      const opacity = hubGlassOpacity(canvas.opacity);
      if (opacity !== null) out.opacity = opacity;
    } else if (kind === 'none') {
      out.kind = 'none';
    } else if (media) {
      out.kind = kind;
    }
  }
  /* 🖼 FULL WIDTH is stored only beside a background that paints a box;
     framed is the default and is the absence of the key. */
  if (canvas.shape === 'full') {
    const painted = resolveHubBackground(out);
    if (painted && painted.kind !== 'none') out.shape = 'full';
  }
  if (canvas.own === true && resolveHubBackground(out)) out.own = true;
  /* 🌄 Parallax only beside a photo; 🎞 a still only beside a snippet — the
     direction rule: a key that could move no pixels is not stored. */
  const ground = resolveHubBackground(out);
  if (canvas.mediaMotion === 'parallax' && ground?.kind === 'photo') out.mediaMotion = 'parallax';
  const poster = hubMediaRef(canvas.poster);
  if (poster && ground?.kind === 'snippet') out.poster = poster;
  if (inSet(HUB_MOTION_PRESETS, canvas.preset)) out.preset = canvas.preset;
  if (inSet(HUB_IN, canvas.in)) out.in = canvas.in;
  if (inSet(HUB_OUT, canvas.out)) out.out = canvas.out;
  /* ⛔ A DIRECTION IS ONLY STORED WHERE IT MEANS SOMETHING. A "from the left"
     kept beside a plain fade is a setting the couple can change with no effect
     on anything — the defect this build exists to remove, in miniature. */
  if (inSet(HUB_DIRECTIONS, canvas.inFrom) && hubInMoves(out.in ?? 'none')) out.inFrom = canvas.inFrom;
  if (inSet(HUB_DIRECTIONS, canvas.outTo) && hubOutMoves(out.out ?? 'none')) out.outTo = canvas.outTo;
  if (inSet(HUB_DURING, canvas.during)) out.during = canvas.during;
  if (inSet(HUB_TIMELINE, canvas.timeline)) out.timeline = canvas.timeline;
  if (inSet(HUB_SEQUENCES, canvas.sequence)) out.sequence = canvas.sequence;
  /* ⛔ Scroll is the default and an absence; a speed means nothing unless the
     section auto-scrolls, so it is dropped anywhere else — the direction rule. */
  const transition = hubTransition(canvas.transition);
  if (transition && transition !== 'scroll') out.transition = transition;
  const autoSpeed = hubAutoSpeed(canvas.autoSpeed);
  if (autoSpeed && autoSpeed !== 'normal' && transition === 'auto') out.autoSpeed = autoSpeed;
  if (inSet(HUB_STAGGER, canvas.stagger)) out.stagger = canvas.stagger as number;
  if (inSet(HUB_DURATION, canvas.duration)) out.duration = canvas.duration as number;
  /* ── SCENES. Same posture: a value this version did not write is dropped. */
  const template = sceneTemplateId(canvas.template);
  if (template) out.template = template;
  const style = sanitizeSceneStyleId(canvas.style);
  if (style) out.style = style;
  const palette = sanitizeSceneStyleId(canvas.palette);
  if (palette) out.palette = palette;
  if (canvas.venueMap === 'none') out.venueMap = 'none';
  if (isPostEventPresetId(canvas.postEventPreset)) out.postEventPreset = canvas.postEventPreset;
  const slots = hubSceneSlots(canvas.slots);
  if (slots) out.slots = slots;
  const free = hubFreeBoxes(canvas.free);
  if (free) out.free = free;
  const stages = hubStageSettings(canvas.stages);
  if (stages) out.stages = stages;
  const video = hubSceneVideo(canvas.video);
  if (video) out.video = video;
  const elements = sanitizeHubElements(canvas.elements);
  if (elements) out.elements = elements;
  /* 🎴 The hero's design — a member of the closed set, off the default. */
  const design = sanitizeHeroDesign(canvas.design);
  if (design) out.design = design;
  const details = sanitizeDetailsOverrides(canvas.details);
  if (details) out.details = details;
  return out;
}

/**
 * The slots, or null. Positions are kept (an unfillable slot becomes `{}`), the
 * list is capped at `SCENE_MAX_SLOTS`, and a list with nothing in any slot is
 * no list at all — `{}` × 6 is not an arrangement anybody made.
 */
export function hubSceneSlots(value: unknown): HubSceneSlot[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > SCENE_MAX_SLOTS) return null;
  const out: HubSceneSlot[] = value.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const s = raw as Record<string, unknown>;
    const slot: HubSceneSlot = {};
    const media = hubMediaRef(s.media);
    if (media) {
      slot.media = media;
      if (s.kind === 'snippet') slot.kind = 'snippet';
    }
    /* ⛔ OVER THE LIMIT IS DROPPED, NOT CUT — the custom-section rule. */
    if (typeof s.head === 'string') {
      const head = s.head.replace(/\r\n?/g, '\n').trim();
      if (head && head.length <= HUB_SLOT_HEAD_MAX) slot.head = head;
    }
    if (typeof s.text === 'string') {
      const text = s.text.replace(/\r\n?/g, '\n').trim();
      if (text && text.length <= HUB_SLOT_TEXT_MAX) slot.text = text;
    }
    return slot;
  });
  return out.some((s) => Object.keys(s).length > 0) ? out : null;
}

/** Free-placement boxes, or null. Each box inside the unit square, non-empty. */
export function hubFreeBoxes(value: unknown): HubFreeBox[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > SCENE_MAX_SLOTS) return null;
  const out: HubFreeBox[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const b = raw as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
    const box = { x: n(b.x), y: n(b.y), w: n(b.w), h: n(b.h) };
    const ok =
      box.x >= 0 && box.y >= 0 && box.w > 0 && box.h > 0 && box.x + box.w <= 1 + 1e-9 && box.y + box.h <= 1 + 1e-9;
    if (!ok) return null;
    // Stored at four decimals: 0.1 % of a 1440px scene is ~1.4px, finer is noise.
    const r = (v: number) => Math.round(v * 10000) / 10000;
    out.push({ x: r(box.x), y: r(box.y), w: r(box.w), h: r(box.h) });
  }
  return out;
}

/** Per-stage order / visibility, or null. Unknown stages and values dropped. */
export function hubStageSettings(value: unknown): Partial<Record<HubStage, HubStageSetting>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const src = value as Record<string, unknown>;
  const out: Partial<Record<HubStage, HubStageSetting>> = {};
  for (const stage of HUB_STAGES) {
    const raw = src[stage];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const setting: HubStageSetting = {};
    if (typeof r.order === 'number' && Number.isInteger(r.order) && r.order >= 0 && r.order <= 999) setting.order = r.order;
    if (r.mode === 'auto' || r.mode === 'shown' || r.mode === 'hidden') setting.mode = r.mode;
    if (Object.keys(setting).length > 0) out[stage] = setting;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** How a scene's clip plays, or null (= the default: loop). */
export function hubSceneVideo(value: unknown): HubSceneVideo | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!inSet(HUB_VIDEO_PLAYS, v.play)) return null;
  // Loop is the default and an absence; only a tap stores anything.
  if (v.play === 'loop') return null;
  return inSet(HUB_VIDEO_OPENS, v.open) && v.open !== 'fullscreen'
    ? { play: 'tap', open: v.open }
    : { play: 'tap' };
}

/**
 * WHAT THIS SECTION'S BACKGROUND ACTUALLY IS — the ONE place that decides.
 *
 * 🔑 AN ABSENT `kind` MEANS PHOTO, AND THAT IS A RULE RATHER THAN A FALLBACK.
 * `kind` is a discriminator added to data that already exists: every
 * `config_json` written before this build holds `media` and nothing beside it.
 * Those rows are photos — they could not be anything else, because `media` has
 * only ever accepted a `hubMediaRef`. Writing that here, once, is the
 * difference between a reader knowing and a reader guessing whether an absent
 * `kind` means "photo" or means "half-written".
 *
 * Returns null when there is no background at all, so a caller cannot
 * accidentally render an empty frame as a black box.
 */
export type HubBackground =
  | { kind: 'photo'; media: string }
  | { kind: 'snippet'; media: string }
  | { kind: HubTintedKind; color: string }
  | { kind: 'none' };

export function resolveHubBackground(canvas: HubSectionCanvas): HubBackground | null {
  if (canvas.kind === 'none') return { kind: 'none' };
  if (canvas.kind === 'color' || canvas.kind === 'diagonal' || canvas.kind === 'glow') {
    return canvas.color ? { kind: canvas.kind, color: canvas.color } : null;
  }
  if (canvas.kind === 'glass' || canvas.kind === 'frost') {
    return { kind: canvas.kind, color: canvas.color ?? HUB_GLASS_DEFAULT_TINT };
  }
  if (!canvas.media) return null;
  return canvas.kind === 'snippet'
    ? { kind: 'snippet', media: canvas.media }
    : { kind: 'photo', media: canvas.media };
}

/** The colour a background paints (flat colour, either ombré or either glass), else null. */
export function hubBackgroundTint(bg: HubBackground | null): string | null {
  return bg && (HUB_TINTED_KINDS as readonly string[]).includes(bg.kind) ? (bg as { color: string }).color : null;
}

/** Photo or snippet — the two kinds that need a signed media URL. */
export function hubBackgroundIsMedia(
  bg: HubBackground | null,
): bg is { kind: 'photo'; media: string } | { kind: 'snippet'; media: string } {
  return Boolean(bg && (bg.kind === 'photo' || bg.kind === 'snippet'));
}

/**
 * 🖼 WHO DRAWS THE SCENE'S BOX — the scene background, or the widget's own card.
 *
 * Owner 2026-09-27: *"if we set no background it will remove the square
 * frame"* — the box IS the scene background, not the widget. So a widget that
 * draws its own card (the Countdown's rounded panel and its tile per number,
 * Photo moments, Tier comparison, Event details) draws it ONLY when the couple
 * has chosen no background at all — the page as it always looked. With "No
 * background" there is no box; with any painted background the frame IS the
 * box, and a second card inside it would be a box in a box.
 *
 * `painted` is the frame's own answer (`sceneGround` in `hub-canvas-frame.tsx`):
 * a colour or glass always paints; a photo or snippet only once its URL
 * resolved.
 */
export function hubBackgroundOwnsBox(canvas: HubSectionCanvas, painted: boolean): boolean {
  const bg = resolveHubBackground(canvas);
  if (!bg) return false;
  if (bg.kind === 'none') return true;
  return hubPhotoPlacement(canvas, painted) === 'behind';
}

/** The preset, with any override the couple reached in and set. */
export function resolveHubMotion(canvas: HubSectionCanvas): HubResolvedMotion {
  const body = HUB_PRESET_BODY[canvas.preset ?? HUB_DEFAULT_PRESET];
  return {
    sequence: canvas.sequence ?? body.sequence,
    in: canvas.in ?? body.in,
    inFrom: canvas.inFrom ?? body.inFrom,
    out: canvas.out ?? body.out,
    outTo: canvas.outTo ?? body.outTo,
    during: canvas.during ?? body.during,
    timeline: canvas.timeline ?? body.timeline,
    stagger: canvas.stagger ?? body.stagger,
    duration: canvas.duration ?? body.duration,
  };
}

/**
 * THE KEYFRAME NAME, composed from the two axes.
 *
 * 🔑 One rule in `globals.css` reads these, so every combination of effect and
 * direction is one selector. The alternative — a rule per pair — is what
 * silently dropped two of Cinematic's three choices when they had the same
 * specificity and the later one won.
 */
export function hubInKeyframe(m: Pick<HubResolvedMotion, 'in' | 'inFrom'>): string {
  if (m.in === 'none') return 'none';
  if (m.in === 'fade') return 'hub-in-fade';
  return `hub-in-${m.in === 'move_fade' ? 'movefade' : 'move'}-${m.inFrom}`;
}

export function hubOutKeyframe(m: Pick<HubResolvedMotion, 'out' | 'outTo'>): string {
  if (m.out === 'none') return 'none';
  if (m.out === 'fade') return 'hub-out-fade';
  if (m.out === 'settle') return 'hub-out-settle';
  return `hub-out-${m.out === 'move_fade' ? 'movefade' : 'move'}-${m.outTo}`;
}

/** `object-position` for a 1–9 focal point. 1 is top-left, 5 centre, 9 bottom-right. */
export function focalToObjectPosition(focal: HubFocalPoint): string {
  const col = (focal - 1) % 3;
  const row = Math.floor((focal - 1) / 3);
  const pct = (n: number) => (n === 0 ? '0%' : n === 1 ? '50%' : '100%');
  return `${pct(col)} ${pct(row)}`;
}

/**
 * WHAT THE GUEST PAGE SETS — inline custom properties, and nothing else.
 *
 * 🔑 The guest page renders this with CSS. No script crosses to the public
 * side: the editor is the only place JavaScript runs (owner-locked with "rails
 * on"), and a scroll-driven section uses `animation-timeline`, which needs
 * none. A guest on a browser without it sees the section at rest, which is the
 * resting state the page already had.
 */
export function hubCanvasVars(
  canvas: HubSectionCanvas,
  /** The resolved, presigned URL for `canvas.media`, when the caller has one.
   *  Passed in rather than fetched here: signing is I/O and this module is
   *  pure, and a page with twelve sections must sign them in ONE parallel pass
   *  rather than twelve sequential round trips (see the note on
   *  `displayUrlForStoredAsset`). */
  mediaUrl?: string | null,
): Record<string, string> {
  const m = resolveHubMotion(canvas);
  return {
    /* 🔑 ONLY A PHOTO BECOMES A CSS BACKGROUND-IMAGE. A snippet is a <video>
       element in the frame — `background-image` cannot play one, and emitting
       the url here would paint the video's poster frame UNDER the real video,
       which reads as a photo that mysteriously starts moving. A colour never
       touches this property at all. */
    ...(mediaUrl && resolveHubBackground(canvas)?.kind === 'photo'
      ? { '--hub-media': `url("${mediaUrl.replace(/"/g, '%22')}")` }
      : {}),
    /* The flat colour, when that is what the couple chose. Its own property so
       no rule can confuse "a colour behind the words" with "a picture". */
    /* …and the tint of either glass — the SAME property, so the colour holds
       with or without the effect. */
    ...(hubBackgroundTint(resolveHubBackground(canvas))
      ? { '--hub-bg-color': hubBackgroundTint(resolveHubBackground(canvas)) as string }
      : {}),
    /* 🌅 Diagonal and Glow — the Main background's two ombrés, from the scene's
       one colour (`ombreCss`: hex digits and keywords only, nothing typed). */
    ...((canvas.kind === 'diagonal' || canvas.kind === 'glow') && canvas.color
      ? { '--hub-bg-image': ombreCss({ shape: canvas.kind, base: canvas.color }) }
      : {}),
    '--hub-focal': focalToObjectPosition(canvas.focal ?? HUB_DEFAULT_FOCAL),
    '--hub-zoom': String((canvas.zoom ?? HUB_DEFAULT_ZOOM) / 100),
    /* The KEYFRAME NAMES, not the choice words. One rule in `globals.css` reads
       these, instead of a rule per in×out pair — sixteen of them, which is how
       the first version silently dropped two of Cinematic's three choices:
       `.hub-tl-scrub.hub-out-shrink` and `.hub-tl-scrub.hub-in-slide` have the
       same specificity, so the later one won and took `animation-name` with it,
       and `.hub-during-lift` (one class) lost to both. A control whose effect
       is decided by source order is not a control. */
    '--hub-in-kf': hubInKeyframe(m),
    '--hub-out-kf': hubOutKeyframe(m),
    '--hub-duration': `${m.duration}s`,
    /* 🔑 `--hub-stagger` IS EMITTED AGAIN, and this time a rule reads it. It was
       withdrawn when the frame held one child and there was nothing to stagger;
       the parts turned out to be the section's own direct children, so the gap
       between them is now a real measurement rather than a stored intention.
       Still absent — not zero — when the parts arrive together, so no rule can
       quietly apply a delay of nothing. */
    ...(m.sequence === 'one_after_another' ? { '--hub-stagger': `${m.stagger}s` } : {}),
    /* Scrubbed motion is driven by the thumb and must stay linear, or it reads
       as lag. A timed arrival gets a real ease — this is the whole difference
       between "smooth" and "mechanical" at the same duration. */
    '--hub-ease': m.timeline === 'scrub' ? 'linear' : 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  };

}

/** A stored arrangement, or null — the closed set of four, nothing else. */
export function hubArrangement(value: unknown): HubArrangement | null {
  return inSet(HUB_ARRANGEMENTS, value) ? value : null;
}

/**
 * WHERE THE PHOTO GOES, given the arrangement and whether a photo RESOLVED.
 *
 *   full  → behind the words (the shipped background, scrim and all)
 *   left / right → beside the words: its own column on a laptop, stacked ABOVE
 *                  the words on a phone (375px has no room for two columns)
 *   text  → nowhere. "Words only" means words only — a photo still chosen for
 *           the section is kept (switching back restores it) but not drawn.
 *
 * 🔑 ONE PHOTO, ONE HOME. The picture beside the words is the same
 * `canvas.media` + `focal` + `zoom` the background already stores, held to the
 * public bucket by `hubMediaRef`. A second "section photo" field would be a
 * second answer to "which photo is this section's", and the two would drift.
 *
 * Pure; the frame and the stylesheet both follow what this returns.
 */
export type HubPhotoPlacement = 'behind' | 'beside' | 'none';
export function hubPhotoPlacement(canvas: HubSectionCanvas, hasMedia: boolean): HubPhotoPlacement {
  const kind = resolveHubBackground(canvas)?.kind;
  /* No background draws nothing — the scene sits on the page ground. */
  if (kind === 'none') return 'none';
  if (!hasMedia) return 'none';
  /* 🔑 A COLOUR IS THE GROUND ITSELF, NOT A PICTURE. There is nothing to move
     into a column beside the words and nothing to hide under "Words only", so
     it is painted behind in every arrangement — hiding it would turn the
     couple's colour into a control that moves no pixels. */
  if (kind && (HUB_TINTED_KINDS as readonly string[]).includes(kind)) return 'behind';
  /* 🔑 A TEMPLATE SCENE PLACES ITS OWN PICTURES. Its photos live in `slots`
     and the template's layout puts them; `media` is then the SCENE
     BACKGROUND only ("Scene background · None — show main", owner 2026-09-24),
     so it goes behind, whatever an old `arrangement` left on the row says. */
  if (canvas.template) return 'behind';
  const arrangement = canvas.arrangement ?? HUB_DEFAULT_ARRANGEMENT;
  if (arrangement === 'text') return 'none';
  /* ⚠ A SNIPPET STAYS BEHIND under left / right. The beside column is a
     still-picture layer painted from `--hub-media`, which a snippet never
     sets, and no beside <video> exists yet — so "beside" would draw an empty
     box where the footage should be. */
  if ((arrangement === 'left' || arrangement === 'right') && kind !== 'snippet') return 'beside';
  return 'behind';
}

/**
 * The class the section's wrapper carries, so CSS can select on the choices
 * that are structural rather than numeric. Deliberately one flat string: a
 * section's arrangement and its motion are the only two things a stylesheet
 * needs to branch on, and every other value arrives as a custom property.
 */
export function hubCanvasClass(canvas: HubSectionCanvas, hasMedia = false): string {
  const m = resolveHubMotion(canvas);
  const placement = hubPhotoPlacement(canvas, hasMedia);
  const bg = resolveHubBackground(canvas);
  return [
    'hub-canvas',
    /* 🔑 ON THE RESOLVED URL, NOT ON THE STORED REF. A ref whose signing failed
       — a deleted object, a refused bucket — must not leave the section styled
       as though it had a picture: that is a dark empty plate where a photo
       should be, which reads as a broken page rather than as no photo. */
    placement === 'behind'
      ? 'hub-has-media'
      : placement === 'beside'
        ? 'hub-photo-beside'
        : 'hub-no-media',
    /* WHICH KIND the ground is, so one rule paints each without reading the
       other's property. Absent for a section with no background at all, so a
       page that never used the canvas renders exactly the markup it did
       before this existed.
       ⛔ AND ABSENT WHEN NOTHING IS DRAWN (placement none): "Words only", or a
       ref that failed to sign. The snippet's scrim is generated content on
       the FRAME itself, so the kind class without its video would lay a
       white wash over the words with nothing behind it. */
    ...(bg && placement !== 'none' ? [`hub-bg-${bg.kind}`] : []),
    /* 🖼 "No background" is a choice too, and says so — no box, no padding. */
    ...(bg?.kind === 'none' ? ['hub-bg-none'] : []),
    /* 🌄 PARALLAX — the photo layer drifts on the SHIPPED hero parallax
       (`PahinaCoverParallax`); only a photo painted behind the words. */
    ...(bg?.kind === 'photo' && placement === 'behind' && canvas.mediaMotion === 'parallax' ? ['hub-bg-parallax'] : []),
    /* 🖼 FRAMED or FULL WIDTH — only on a background that is actually painted
       behind the scene; a photo BESIDE the words is a picture, not a box. */
    ...(bg && bg.kind !== 'none' && placement === 'behind'
      ? [`hub-shape-${canvas.shape ?? HUB_DEFAULT_SCENE_SHAPE}`]
      : []),
    /* A template scene: its body is a size container, so the template can
       choose its desktop or phone arrangement by the width it is actually
       given — the editor's phone preview included. */
    ...(canvas.template ? ['hub-has-tpl'] : []),
    `hub-seq-${m.sequence === 'one_after_another' ? 'parts' : 'whole'}`,
    `hub-arr-${canvas.arrangement ?? HUB_DEFAULT_ARRANGEMENT}`,
    `hub-in-${m.in}`,
    `hub-out-${m.out}`,
    `hub-during-${m.during}`,
    `hub-tl-${m.timeline}`,
  ].join(' ');
}

/**
 * DID THE COUPLE ARRANGE ANYTHING AT ALL?
 *
 * 🔑 This is what keeps the canvas INERT for every event that has never used
 * it. An empty or unreadable `config_json` sanitizes to `{}`, this returns
 * false, and the guest page emits exactly the markup it emitted before the
 * canvas existed — no wrapper, no classes, no custom properties. A defect in
 * the canvas CSS cannot reach a page nobody arranged.
 *
 * ⚠ It asks whether any KEY survived sanitising, not whether the resolved
 * motion differs from the default. Those are different questions: a couple who
 * deliberately chose "Calm" — which is also the default — HAS arranged their
 * page, and taking the wrapper away from them would silently ignore a choice
 * they made on purpose.
 */
export function hasHubCanvas(canvas: HubSectionCanvas): boolean {
  /* ⛔ ELEMENT STYLES ALONE ARE NOT AN ARRANGEMENT. A couple who only changed a
     heading's font did not ask for the section to be framed — and the frame
     brings the default preset's motion with it, so the whole section would
     start fading in because one word changed colour. The elements are drawn by
     their own scoped style (`hubElementSceneCss`), framed or not. */
  /* 🔗 Nor is a scene's own version of a Details fact (`details`) — it is
     words, drawn by the scene itself; framing it would add motion nobody chose. */
  /* 🎨 Nor is a style pick (`style`), a palette look (`palette`) or the venue's
     map switch (`venueMap`) — the scene draws its own style; framing it would
     bring motion the couple never chose. */
  return Object.keys(canvas).some(
    (k) =>
      k !== 'elements' &&
      k !== 'details' &&
      k !== 'style' &&
      k !== 'palette' &&
      k !== 'venueMap' &&
      k !== 'postEventPreset',
  );
}

/**
 * EVERY SECTION BACKGROUND ON ONE PAGE, as refs, deduped.
 *
 * 🔑 The point is the ONE round trip. `SiteBody` calls this once, signs the
 * whole list in a single `Promise.all`, and hands the result down; without it
 * each frame would sign its own and a twelve-section page would make twelve
 * sequential calls to AWS — the failure `displayUrlForStoredAsset`'s docblock
 * names for exactly this shape of surface.
 *
 * Deduped because two sections may honestly share one photo, and signing it
 * twice would cost twice and return two different URLs for one picture.
 */
export function hubCanvasMediaRefs(
  rows: readonly { config_json: unknown }[],
): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    const canvas = sanitizeHubCanvas(row.config_json);
    if (canvas.media) out.add(canvas.media);
    // 🎞 A snippet's still — what a guest sees while its clip may not play.
    if (canvas.poster) out.add(canvas.poster);
    // A template scene's own pictures sign in the same one pass.
    for (const slot of canvas.slots ?? []) if (slot.media) out.add(slot.media);
    // …and a Main background OVERRIDE's photo or still (Maker Phase 10). Its
    // CLIP is not signed here: whether a clip may play is the render's question
    // (`mainGroundClipRefForGuests`), and a URL nobody may play is not minted. The
    // hero it follows by default is signed by `loadMedia`, like every hero.
    const main = hubMainGround(row.config_json);
    if (isHubMainOwn(main)) {
      if (main.kind === 'photo') out.add(main.media);
      if (main.poster) out.add(main.poster);
    }
  }
  return [...out];
}

/**
 * 🎞 THE STILL A GUEST SEES FOR A TEMPLATE SLOT'S CLIP — `stillRef` (the hero
 * photo, the hero clip's documented stand-in) when any scene has a clip in a
 * slot, so it signs in the page's ONE pass; `[]` otherwise (nothing extra to
 * sign). The render decides whether the clip may play (`renderScene`).
 */
export function hubSlotClipStillRefs(
  rows: readonly { config_json: unknown }[],
  stillRef: string | null,
): string[] {
  if (!stillRef) return [];
  const any = rows.some((row) => (sanitizeHubCanvas(row.config_json).slots ?? []).some((s) => s.kind === 'snippet'));
  return any ? [stillRef] : [];
}

/* ══ THE MAIN BACKGROUND — behind every scene ════════════════════════════════
   Event Hub Maker Phase 10 (build plan §3; DECISION_LOG 2026-09-25 "ADAPTIVE
   THEME" and "OWNER ANSWERS — SIX CONTROLLER QUESTIONS" item 6). The
   navigator pins "Main · behind every scene" on top.

   🔑 THE HERO IS THE SOURCE OF TRUTH. Owner, verbatim: *"whatever they make on
   the hero scene will be their cover and the main background."* So by DEFAULT
   the Main background IS the hero (`resolveHero`, `lib/event-hero.ts`) — never
   a second upload the couple has to repeat. What is stored here is only:
     · FOLLOW — `{ follow: 'hero', of, tint }`: the adaptive theme's measured
       frame of the hero photo `of`, and the "Match my photo's colours" toggle.
       It applies only while `of` IS the hero's photo; a new hero is measured
       again before its colours are used, so a stale frame can never tint the
       page for a picture it was not read from.
     · OWN — `{ kind, media, poster?, tint? }`: an explicit, opt-in override —
       "a different clip or photo behind every scene".
   Nothing measured yet, or a hero with no photo (the written card) = the
   theme's own loop, exactly as before this phase.

   🔑 WHERE IT LIVES: `config_json.main` on the event's HERO row. The Main
   background has no row of its own and must not get a migration for one
   (build plan: "Migrations: 0"); the hero row is the one section every event
   has exactly once (`is_always_on`, UNIQUE on event + type), and it is the
   hero this follows. It sits BESIDE `canvas`, never inside it — the hero
   SCENE's own background and the page's Main background are two layers.

   Every ref passes the SAME `hubMediaRef` fence as a section background: one
   field shape, one fence, the public bucket only. */
export const HUB_MAIN_GROUND_KEY = 'main';

/** The default: the Main background follows the hero; this is the tint read off the hero's photo. */
export type HubMainFollow = {
  follow: 'hero';
  /** The hero photo the frame was measured from. The tint applies only while this IS the hero. */
  of: string;
  tint: HubTint;
};

/** An explicit override — the couple's own clip or photo instead of their hero. */
export type HubMainOwn = {
  /** A photo, or a short muted clip (`snippet`) — never a colour; that is `site_bg_color`. */
  kind: 'photo' | 'snippet';
  /** The photo, or the clip. */
  media: string;
  /**
   * The clip's still, grabbed in the browser (`extractPosterFrame`): the
   * moment before it plays, reduced motion, Save-Data, print, and — whenever
   * the clip does not reach a guest (the scene-clip kill switch,
   * `mainGroundClipRefForGuests`) — what guests see.
   */
  poster?: string;
  /** The adaptive theme: "Match my video's colours" and the frame it follows. */
  tint?: HubTint;
  /**
   * 🌄 Still (absent) or Parallax — a PHOTO only, on the shipped hero parallax
   * (`PahinaCoverParallax`, page-scroll mode for this fixed layer). Pro, like
   * the photo it moves.
   */
  motion?: 'parallax';
};

/**
 * 🖼 THE COUPLE CHOSE WHAT IS BEHIND EVERY SCENE, AND IT IS NOT MEDIA (owner
 * 2026-09-29, DECISION_LOG "THE MAIN BACKGROUND OFFERS EVERY CHOICE…",
 * verbatim *"the background animated video cannot be unpicked"*):
 *   · `theme` — the theme's own background (its loop / still), even with a
 *     hero photo up — "Same as my hero" is no longer forced over it;
 *   · `none`  — NO picture and NO loop: just the Background colour.
 * Both are free (taking media down never costs anything).
 */
export type HubMainChoice = { ground: 'theme' | 'none' };

export type HubMainGround = HubMainFollow | HubMainOwn | HubMainChoice;

export function isHubMainFollow(m: HubMainGround | null | undefined): m is HubMainFollow {
  return Boolean(m && 'follow' in m);
}

/** The couple's own clip or photo (not the hero, not a choice). */
export function isHubMainOwn(m: HubMainGround | null | undefined): m is HubMainOwn {
  return Boolean(m && 'media' in m && 'kind' in m);
}

/** "The theme's background" or "None — just the colour". */
export function isHubMainChoice(m: HubMainGround | null | undefined): m is HubMainChoice {
  return Boolean(m && 'ground' in m);
}

/** Anything → a Main background, or null. Drops rather than repairs. */
export function sanitizeHubMainGround(raw: unknown): HubMainGround | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  if (src.follow === 'hero') {
    const of = hubMediaRef(src.of);
    const tint = sanitizeHubTint(src.tint);
    return of && tint ? { follow: 'hero', of, tint } : null;
  }
  if (src.ground === 'theme' || src.ground === 'none') return { ground: src.ground };
  const media = hubMediaRef(src.media);
  if (!media || (src.kind !== 'photo' && src.kind !== 'snippet')) return null;
  const out: HubMainOwn = { kind: src.kind, media };
  const poster = hubMediaRef(src.poster);
  if (poster) out.poster = poster;
  const tint = sanitizeHubTint(src.tint);
  if (tint) out.tint = tint;
  if (src.motion === 'parallax' && out.kind === 'photo') out.motion = 'parallax';
  return out;
}

/** The Main background stored on a row's `config_json` (the hero row's), or null. */
export function hubMainGround(config: unknown): HubMainGround | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  return sanitizeHubMainGround((config as Record<string, unknown>)[HUB_MAIN_GROUND_KEY]);
}

/**
 * Does the couple want NOTHING behind their scenes — no theme loop, no picture,
 * just the Background colour? (`{ ground: 'none' }`.)
 */
export function mainGroundIsNone(main: HubMainGround | null | undefined): boolean {
  return isHubMainChoice(main) && main.ground === 'none';
}

/** What the page draws behind every scene — refs only; the caller signs them. */
export type ResolvedMainGround = {
  /** 'hero' = it is the couple's hero (the default); 'own' = their explicit override. */
  source: 'hero' | 'own';
  /** The photo, or the clip's still. */
  stillRef: string | null;
  /** The clip for the COUPLE's own editors and preview. */
  clipRef: string | null;
  /** The same clip for a GUEST — null when the guest gate (`guestClipGate`) holds it back. */
  guestClipRef: string | null;
  tint: HubTint | null;
  /** 🌄 Parallax on the couple's own photo. */
  parallax?: boolean;
};

/**
 * THE ONE ANSWER to "what is behind every scene?". An override wins; otherwise
 * the hero — its photo, and its clip where one may play — but only once the
 * hero's frame has been MEASURED (`follow.of` is this very photo): words are
 * never laid over pixels nobody read. `null` = the theme's own loop.
 *
 * `hero` is `resolveHero(event)`'s answer and `guestClipGate` is
 * `mainGroundClipRefForGuests` (the scene-clip switch, `lib/guest-hero-video.ts`)
 * — both passed in, so this file keeps no second opinion about what the hero is
 * or which clips a guest may see.
 *
 * 🔑 ONE GATE FOR BOTH SOURCES. The hero's clip, when the Main background
 * follows the hero, goes through the SAME `guestClipGate` as an own clip — not
 * through `hero.guestVideoRef`, which answers a different question (may the
 * MASTHEAD play it?). Two gates for one ground is how the host saw the clip move
 * while every guest saw a still (audit 2026-10-02, Batch F1 item 4).
 */
export function resolveMainGround(
  main: HubMainGround | null,
  hero: { photoRef: string | null; videoRef: string | null },
  guestClipGate: (ref: string) => string | null,
): ResolvedMainGround | null {
  /* 🖼 The theme's own background, or none at all — no picture of the couple's. */
  if (isHubMainChoice(main)) return null;
  if (isHubMainOwn(main)) {
    return {
      source: 'own',
      stillRef: main.kind === 'photo' ? main.media : (main.poster ?? null),
      clipRef: main.kind === 'snippet' ? main.media : null,
      guestClipRef: main.kind === 'snippet' ? guestClipGate(main.media) : null,
      tint: main.tint ?? null,
      ...(main.motion === 'parallax' ? { parallax: true } : {}),
    };
  }
  if (!hero.photoRef || !main || main.of !== hero.photoRef) return null;
  return {
    source: 'hero',
    stillRef: hero.photoRef,
    clipRef: hero.videoRef,
    guestClipRef: hero.videoRef ? guestClipGate(hero.videoRef) : null,
    tint: main.tint,
  };
}
