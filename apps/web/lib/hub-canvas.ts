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
export const HUB_IN = ['rise', 'fade', 'slide', 'none'] as const;
export const HUB_OUT = ['none', 'fade', 'lift', 'shrink'] as const;
export const HUB_DURING = ['still', 'lift'] as const;
/** `time` plays once on arrival; `scrub` follows the scroll and reverses. */
export const HUB_TIMELINE = ['time', 'scrub'] as const;
export const HUB_STAGGER = [0, 0.12, 0.25] as const;
export const HUB_DURATION = [0.6, 1.1, 1.8] as const;

export type HubIn = (typeof HUB_IN)[number];
export type HubOut = (typeof HUB_OUT)[number];
export type HubDuring = (typeof HUB_DURING)[number];
export type HubTimeline = (typeof HUB_TIMELINE)[number];

export const HUB_IN_LABEL: Record<HubIn, string> = {
  rise: 'Rise',
  fade: 'Fade',
  slide: 'Slide',
  none: 'None',
};
export const HUB_OUT_LABEL: Record<HubOut, string> = {
  none: 'Stay put',
  fade: 'Fade away',
  lift: 'Lift away',
  shrink: 'Settle back',
};
export const HUB_DURING_LABEL: Record<HubDuring, string> = {
  still: 'Still',
  lift: 'Slow lift',
};
export const HUB_TIMELINE_LABEL: Record<HubTimeline, string> = {
  time: 'Plays once',
  scrub: 'Follows the scroll',
};

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
  preset?: HubMotionPreset;
  /** Fine-tune. Each absent when the couple left it on Auto. */
  in?: HubIn;
  out?: HubOut;
  during?: HubDuring;
  timeline?: HubTimeline;
  stagger?: number;
  duration?: number;
};

/** What the preset means, once nothing is left to interpret. */
export type HubResolvedMotion = {
  in: HubIn;
  out: HubOut;
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
  still: { in: 'none', out: 'none', during: 'still', timeline: 'time', stagger: 0, duration: 0.6 },
  calm: { in: 'fade', out: 'fade', during: 'still', timeline: 'time', stagger: 0.12, duration: 1.1 },
  editorial: { in: 'rise', out: 'lift', during: 'still', timeline: 'scrub', stagger: 0.12, duration: 1.1 },
  cinematic: { in: 'slide', out: 'shrink', during: 'lift', timeline: 'scrub', stagger: 0.25, duration: 1.8 },
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
  if (inSet(HUB_MOTION_PRESETS, canvas.preset)) out.preset = canvas.preset;
  if (inSet(HUB_IN, canvas.in)) out.in = canvas.in;
  if (inSet(HUB_OUT, canvas.out)) out.out = canvas.out;
  if (inSet(HUB_DURING, canvas.during)) out.during = canvas.during;
  if (inSet(HUB_TIMELINE, canvas.timeline)) out.timeline = canvas.timeline;
  if (inSet(HUB_STAGGER, canvas.stagger)) out.stagger = canvas.stagger as number;
  if (inSet(HUB_DURATION, canvas.duration)) out.duration = canvas.duration as number;
  return out;
}

/** The preset, with any override the couple reached in and set. */
export function resolveHubMotion(canvas: HubSectionCanvas): HubResolvedMotion {
  const body = HUB_PRESET_BODY[canvas.preset ?? HUB_DEFAULT_PRESET];
  return {
    in: canvas.in ?? body.in,
    out: canvas.out ?? body.out,
    during: canvas.during ?? body.during,
    timeline: canvas.timeline ?? body.timeline,
    stagger: canvas.stagger ?? body.stagger,
    duration: canvas.duration ?? body.duration,
  };
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
export function hubCanvasVars(canvas: HubSectionCanvas): Record<string, string> {
  const m = resolveHubMotion(canvas);
  return {
    '--hub-focal': focalToObjectPosition(canvas.focal ?? HUB_DEFAULT_FOCAL),
    '--hub-zoom': String((canvas.zoom ?? HUB_DEFAULT_ZOOM) / 100),
    '--hub-in': m.in,
    '--hub-out': m.out,
    '--hub-during': m.during,
    '--hub-timeline': m.timeline,
    '--hub-stagger': `${m.stagger}s`,
    '--hub-duration': `${m.duration}s`,
  };
}

/**
 * The class the section's wrapper carries, so CSS can select on the choices
 * that are structural rather than numeric. Deliberately one flat string: a
 * section's arrangement and its motion are the only two things a stylesheet
 * needs to branch on, and every other value arrives as a custom property.
 */
export function hubCanvasClass(canvas: HubSectionCanvas): string {
  const m = resolveHubMotion(canvas);
  return [
    'hub-canvas',
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
  return Object.keys(canvas).length > 0;
}
