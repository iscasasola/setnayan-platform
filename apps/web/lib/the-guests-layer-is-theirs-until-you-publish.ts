/**
 * THE GUESTS' LAYER IS THEIRS UNTIL YOU PUBLISH.
 *
 * `who-can-see-your-story.ts` answers one question — may this viewer read this
 * story? — and `event_editorial.status` is ONE audience for the whole thing.
 * That was enough while the page was all-or-nothing: before publish a stranger
 * got the graceful fallback and there was nothing to leak.
 *
 * The story by the minute breaks that assumption on purpose. The page now grows
 * IN PUBLIC while the day happens — the invitation, the save-the-date, the room,
 * the live broadcast — and only the guests' half stays back. One column cannot
 * express "this part is public now and that part is not", so the layers get
 * their own gate here.
 *
 *   the host's own  →  as it happens        (the event's own privacy lock governs it)
 *   the guests'     →  the `event` audience until `published`
 *   the edition     →  once, on publish     (`status`, unchanged)
 *
 * 🔴 HIDING THE ENTRIES IS THE WRONG FIX, AND IT IS THE ONE EVERYONE REACHES FOR.
 * The design review found the photos correctly withheld and every SHAPE of them
 * still public to a pre-publish stranger: the index, the dial's bar HEIGHTS, the
 * minute sheet, the cover's counts, the Relive player and the closing words. A
 * count is not a summary of the guests' layer — it IS the guests' layer, stated
 * in one number. So this module withholds the counts and the heights too, and
 * `redactStoryLayers` returns a payload with the fields GONE rather than a flag
 * a component is trusted to read.
 *
 * 🔑 IT CAN ONLY EVER SHOW LESS — the same construction `consent-veto.ts` uses.
 * Every function here either passes a value through or replaces it with an empty
 * one. There is no branch that adds anything, so a bug in this file cannot open
 * a story that the shipped gate had closed.
 *
 * Pure + total — no network, no `server-only`, no React. It is imported by the
 * render path and by its own guard, which is why the payload test can assert the
 * real thing rather than a class name in a stylesheet.
 */

import {
  STRANGER,
  storyAudienceAdmits,
  type StoryAudience,
  type StoryViewer,
} from './who-can-see-your-story';

/** The three layers of one URL (`01_The_Story.md` §2, owner lock 1). */
export const STORY_LAYERS = ['host', 'guest', 'edition'] as const;
export type StoryLayer = (typeof STORY_LAYERS)[number];

/**
 * OWNER GATE Q1 — are aggregate counts and bar heights public before publish?
 *
 * ✅ **RULED 2026-09-09 — NO. DO NOT RE-ASK IT.** Owner, shown all five gates
 * with what each costs: *"follow your recommendations"*. A stranger before
 * publish sees flat baseline ticks and no counts, because "492 captures · 26
 * phones" describes the guests' day to somebody who was not asked.
 *
 * ⚠ THIS DOCBLOCK SAID "NOT ANSWERED" UNTIL 2026-09-09 (S9). The VALUE below
 * was right the whole time — it was built to the documented default — but the
 * sentence above it was stale, and a stale "unanswered" on an owner gate is
 * how a settled question gets asked a second time. The house rule is: never
 * ask the owner a question the corpus answers.
 *
 * 🔑 FLIPPING IT IS THIS ONE LINE. Set it to `false` and counts and bar heights
 * become part of the host's layer — public as the day happens — while the
 * captures themselves stay behind the guest gate. Nothing else needs editing,
 * which is the whole reason the answer lives in a named constant instead of
 * being spelt out at four call sites.
 */
export const COUNTS_ARE_THE_GUESTS_LAYER = true;

/**
 * The guests' layer, expressed in the vocabulary the shipped gate already reads.
 *
 * ⚠ IT IS A DERIVATION, NOT A COLUMN. `03_Data_Requirements.md` §2.5 calls for
 * "a per-layer flag", and a stored flag is what a reader of that line reaches
 * for. But nobody has asked for a story where the guests' layer opens EARLIER or
 * LATER than this rule — the mapping is total, so a column would only add a
 * second opinion that could disagree with `status` and a migration that has to
 * be backfilled for the seven rows in production. The house rule is the one in
 * RULE 0: a flag/filter flip beats new schema.
 */
export function guestLayerAudience(status: StoryAudience): StoryAudience {
  return status === 'published' ? 'published' : 'event';
}

/**
 * May this viewer read this layer?
 *
 * `host` is deliberately open here. The host's own layer is public as it happens
 * — that is the point of the by-the-minute page — and what keeps a stranger off
 * a private celebration is the event's OWN lock (`closedEventAdmits`), resolved
 * two hundred lines before any of this runs. Answering "no" here as well would
 * be this file holding a second opinion about a question it is not asked, which
 * is exactly the failure `storyAudienceAdmits` was written to end.
 */
export function storyLayerAdmits(
  layer: StoryLayer,
  status: StoryAudience,
  viewer: StoryViewer = STRANGER,
): boolean {
  if (layer === 'host') return true;
  if (layer === 'guest') return storyAudienceAdmits(guestLayerAudience(status), viewer);
  return storyAudienceAdmits(status, viewer);
}

/** Shorthand for the one that does the work. Reads better at a call site. */
export function guestLayerAdmits(
  status: StoryAudience,
  viewer: StoryViewer = STRANGER,
): boolean {
  return storyLayerAdmits('guest', status, viewer);
}

/**
 * A count this viewer may not have, rendered as an absence rather than a zero.
 *
 * ⚠ NEVER `0`. A withheld count and a real count of nothing are different
 * sentences — "no photos yet" is a claim about the day, and it is a false one
 * while 172 captures sit behind the gate. `null` is the payload's existing
 * convention for "omit this stat" (`ImpactMetrics.photos`), so a component that
 * already knows how to omit needs no new branch. The prototype draws it as an
 * em dash.
 */
export function countForLayer(
  n: number | null | undefined,
  admitted: boolean,
): number | null {
  if (!admitted) return null;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** One five-minute bucket of the dial, as the aggregate read returns it. */
export type CaptureBin = {
  /** Bucket start, epoch ms. */
  at: number;
  /** How many captures landed in it. */
  captures: number;
};

/**
 * A bucket as the dial is allowed to DRAW it.
 *
 * `height` is `null` for "a baseline tick" — no height at all, not a height of
 * zero, so nothing downstream can scale it back up.
 */
export type DrawnBin = {
  at: number;
  height: number | null;
  captures: number | null;
  future: boolean;
};

/**
 * The only way to turn capture counts into bar heights.
 *
 * Two independent reasons a bar has no height, and they are not the same reason:
 *
 *   1. **It has not happened yet.** A bin after `now` is a baseline tick for
 *      EVERYONE, the host included. A bar's height is data about a minute, and
 *      that minute has not occurred — drawing a height there is not a privacy
 *      failure, it is a lie. This is why the check is not folded into the
 *      audience one.
 *   2. **It is not this viewer's to see.** Before publish the heights are the
 *      guests' layer (Q1 above), so a stranger gets the baseline across the
 *      whole dial.
 *
 * `captures` rides the same answer as the height: shipping the number beside a
 * flattened bar would hand back precisely what flattening it withheld.
 */
export function drawnBins(
  bins: readonly CaptureBin[],
  opts: { now: number; status: StoryAudience; viewer?: StoryViewer },
): DrawnBin[] {
  const heightsAdmitted = COUNTS_ARE_THE_GUESTS_LAYER
    ? guestLayerAdmits(opts.status, opts.viewer)
    : true;
  return bins.map((b) => {
    const future = b.at > opts.now;
    const drawable = heightsAdmitted && !future;
    return {
      at: b.at,
      height: drawable ? b.captures : null,
      captures: drawable ? b.captures : null,
      future,
    };
  });
}

/**
 * One table's share of a minute's photographs — the lens's heat (`08` step 2.3).
 *
 * Structural, like `CaptureBin` above and for the same reason: `lib/story-room`
 * owns the shape, this module owns who may have it, and neither imports the
 * other's opinion about the question it does not answer.
 */
export type TableCaptureCount = { tableId: string; captures: number };

/**
 * The heat a reader may actually have.
 *
 * 🔑 A COUNT OF PHOTOGRAPHS PER TABLE IS THE GUESTS' LAYER, EXACTLY AS A BAR
 * HEIGHT IS. It is the same fact the dial draws, asked per seat instead of per
 * minute — so it rides the same ruling (Q1, 2026-09-09: no counts to a stranger
 * before publish) through the same constant. Gating the dial and forgetting the
 * floor plan would have published the day's shape on the surface where it is
 * easiest to read.
 *
 * ⚠ IT RETURNS AN EMPTY LIST, NOT A LIST OF ZEROES. A plan of tables all
 * measured at zero is a claim — "nobody shot anything here" — and it is a false
 * one. Nothing is a withholding; zero is a measurement.
 */
export function drawnHeat(
  heat: readonly TableCaptureCount[],
  opts: { status: StoryAudience; viewer?: StoryViewer },
): TableCaptureCount[] {
  const admitted = COUNTS_ARE_THE_GUESTS_LAYER ? guestLayerAdmits(opts.status, opts.viewer) : true;
  return admitted ? heat.map((h) => ({ ...h })) : [];
}

/**
 * The guest-made fields of the story payload, and the edition's close.
 *
 * Structural rather than an import of `EditorialData`, because that type lives
 * in a module that pulls `server-only` — the guard has to be able to run this on
 * a fixture. `redactStoryLayers` is generic over it, so the real payload passes
 * through with its own type intact and a field added to `EditorialData` later
 * cannot silently fall outside the redaction: it either belongs to a layer and
 * is named here, or it is the host's own.
 */
export type LayeredStoryPayload = {
  audience?: StoryAudience;
  /** Said — Kwento, the guests' photo messages. */
  kwentoQuotes: unknown[];
  /** Asked — Papic Challenge answers. */
  challengeAnswers: unknown[];
  /** Letters — guest columns. Optional in the shipped payload. */
  guestColumns?: unknown[];
  /** The captures index, and the photo essay drawn from the same pool. */
  galleryPhotos: unknown[];
  essayPhotos: unknown[];
  /** The minute sheet's source — chapters built from the Papic timeline. */
  dayChapters: unknown[];
  /** The photo wall. */
  photoWallPhotos: unknown[];
  photoWallActive: boolean;
  /** The cover's four facts. */
  metrics: {
    photos: number | null;
    clips: number | null;
    chapters: number | null;
    [k: string]: unknown;
  };
  /** The locked close — the host's last word, then their song. */
  specialMessage: string | null;
  song: { url: string | null; label: string | null };
};

/**
 * Take the layers this viewer may not read OUT of the payload.
 *
 * 🔴 THIS IS THE MECHANISM. Every guest-made unit also carries
 * `data-layer="guest"` in the markup, and that attribute is a MARKER — it exists
 * so a reviewer can see the layer in the DOM and so the prototype could
 * demonstrate it with a stylesheet. It is not a gate. `display:none` on a node
 * whose contents were serialised into the page is the same photograph, one View
 * Source away.
 *
 * ⚠ THE GALLERY IS TAKEN WHOLE, AND IT IS SLIGHTLY MORE THAN THE GUESTS' HALF.
 * `galleryPhotos` and `essayPhotos` are a UNION of the couple's own uploads and
 * the day's Papic captures, already resolved to display URLs — by the time they
 * reach here the two provenances are indistinguishable. Removing both is the
 * monotone direction (a pre-publish stranger loses a few of the host's own
 * photos, which is what "not published yet" means anyway); keeping both would
 * publish the guests'. Carrying provenance through the loader so the halves can
 * be separated belongs with the captures index that will need it.
 */
export function redactStoryLayers<T extends LayeredStoryPayload>(
  data: T,
  viewer?: StoryViewer,
): T;
export function redactStoryLayers<T extends LayeredStoryPayload>(
  data: T | null,
  viewer?: StoryViewer,
): T | null;
export function redactStoryLayers<T extends LayeredStoryPayload>(
  data: T | null,
  viewer: StoryViewer = STRANGER,
): T | null {
  // The loader's own contract is `EditorialData | null`, so taking the null
  // spares every call site an `if` whose else-branch is the one that leaks.
  if (!data) return null;
  // A payload with no audience is a curated SAMPLE — it carries no real event
  // and exists to be read. `storyAudienceOf` would fail it closed to 'draft'
  // and blank the showcase, so the shipped gate skips it and so does this one.
  if (!data.audience) return data;

  const guest = storyLayerAdmits('guest', data.audience, viewer);
  const edition = storyLayerAdmits('edition', data.audience, viewer);
  if (guest && edition) return data;

  // Built as a PATCH of the structural type rather than by mutating a copy of
  // `T`: TypeScript cannot prove `[]` is assignable to `T['galleryPhotos']` for
  // an arbitrary `T`, and the honest way past that is one narrow cast on a spread
  // whose every value is an empty of the declared type — not a cast per field.
  const patch: Partial<LayeredStoryPayload> = {};

  if (!guest) {
    patch.kwentoQuotes = [];
    patch.challengeAnswers = [];
    if (data.guestColumns) patch.guestColumns = [];
    patch.galleryPhotos = [];
    patch.essayPhotos = [];
    patch.dayChapters = [];
    patch.photoWallPhotos = [];
    patch.photoWallActive = false;

    if (COUNTS_ARE_THE_GUESTS_LAYER) {
      // The cover's unit of measure. `films` and `days told` are the host's own
      // and stay — a stranger already knows the day was broadcast and how long
      // it ran. What goes is what the guests made.
      patch.metrics = { ...data.metrics, photos: null, clips: null, chapters: null };
    }
  }

  if (!edition) {
    // The locked close. It is the host's OWN words, which is why it reads as
    // host-layer and why the first pass left it public — but it is the last page
    // of the edition, and the edition is the thing publish releases.
    patch.specialMessage = null;
    patch.song = { url: null, label: null };
  }

  return { ...data, ...patch } as T;
}
