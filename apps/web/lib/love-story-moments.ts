/**
 * apps/web/lib/love-story-moments.ts
 *
 * OUR LOVE STORY — THE MOMENTS, AND HOW EACH ONE BECOMES A SCENE.
 *
 * Owner, 2026-09-25 (DECISION_LOG): *"each love story is a scene"* · *"Max of 5
 * for free. no media files. Place more, add media files, Go Event Hub Pro?"* ·
 * *"love story is part of the inviting stage"*. Build plan
 * `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md` Phase 7; prototype
 * `prototypes/our_love_story_scrapbook_2026-09-25.html`.
 *
 * ── WHERE IT LIVES: `events.love_story.moments[]` — NO NEW TABLE ───────────
 * `events.love_story` already holds the couple's story (`how_we_met`, `spark`,
 * `proposal`, `milestones[]`, `anchors` …). The moments sit BESIDE those keys,
 * so every reader of the old keys keeps working unchanged. A separate
 * `event_story_moments` table would be a second home for one fact (plan § 5
 * risk 4) and is deliberately not built.
 *
 * ── SEEDED, NEVER WRITTEN ON A READ ────────────────────────────────────────
 * A couple who wrote "how we met" at onboarding already HAS a story. Until the
 * first moment is saved, `resolveMoments` derives the moments from those words
 * (`seedMomentsFromLegacy`) with STABLE ids (`seed-met`, `seed-ms-0` …), so the
 * scrapbook and the guest page both show them — and the first write
 * materialises exactly that seed and then applies the edit. Opening a page
 * never writes, and seeding the same blob twice gives the same list.
 *
 * ── FREE = FIVE WORD-ONLY STORIES; MORE AND ANY PHOTO IS EVENT HUB PRO ─────
 * `momentCapRefusal` is THE rule, pure, so the one server action and the test
 * ask the same function. A seed larger than five is never cut: those words
 * were the couple's before the cap existed, and hiding them would be a failure
 * that renders as success. The cap refuses the NEXT one.
 *
 * ── EACH MOMENT IS ONE SCENE ───────────────────────────────────────────────
 * A moment carries the same `canvas` every Event Hub section carries
 * (`HubSectionCanvas`, `lib/hub-canvas.ts`), so the Maker's templates and
 * transitions apply to it unchanged. `loveStoryScenes` is the seam the Phase 5
 * scene renderer takes over: one entry per VISIBLE moment, in story order, with
 * its sanitized canvas and a suggested template number.
 *
 * Pure: no React, no DB. Type-only import from `hub-canvas`'s sanitizer chain.
 */
import { hubMediaRef, sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';

/* ── LIMITS ─────────────────────────────────────────────────────────────── */

/** Free couples: at most this many stories. The sixth needs Event Hub Pro. */
export const FREE_MOMENT_CAP = 5;
/** Hard ceiling for everyone — same bound `milestones[]` has, so one couple
 *  cannot balloon the blob every guest page render parses. */
export const MOMENT_MAX = 100;
/** Photos per moment (Pro). */
export const MOMENT_MEDIA_MAX = 4;
export const MOMENT_LINE_MAX = 600;
export const MOMENT_PLACE_MAX = 80;
export const MOMENT_BY_MAX = 40;

/** The one line a free couple meets at the sixth story or any photo. Owner-worded. */
export const LOVE_STORY_PRO_LINE = 'Add more stories and your photos';
export const LOVE_STORY_PRO_CTA = 'Go Event Hub Pro';

/* ── SHAPE ──────────────────────────────────────────────────────────────── */

/** Only as exact as they remember — "a year on its own is enough". */
export type MomentDate = { y: number; m?: number; d?: number };
export type MomentAnchor = 'met' | 'yes';

export type LoveStoryMoment = {
  id: string;
  /** Absent only on a moment seeded from words that never had a date. */
  date?: MomentDate;
  line: string;
  place?: string;
  /** Public-bucket `r2://` refs (Pro). Nothing is copied — a ref points at the original. */
  media?: string[];
  added_by?: string;
  anchor?: MomentAnchor;
  /** Kept off the Event Hub without being deleted (the Maker's eye). */
  hidden?: boolean;
  /** The same canvas every scene carries. `{}` = the theme's defaults. */
  canvas: HubSectionCanvas;
};

export const LOVE_STORY_CHAPTERS = ['before', 'met', 'falling', 'yes', 'toward'] as const;
export type LoveStoryChapter = (typeof LOVE_STORY_CHAPTERS)[number];

export const LOVE_STORY_CHAPTER_LABEL: Record<LoveStoryChapter, string> = {
  before: 'Before us',
  met: 'How we met',
  falling: 'Falling',
  yes: 'The yes',
  toward: 'Toward the day',
};

/** The gentle prompt an empty chapter shows (prototype copy). Never a required field. */
export const LOVE_STORY_CHAPTER_PROMPT: Record<LoveStoryChapter, string> = {
  before: 'A childhood photo. Your barangay. The dog.',
  met: 'Where you first saw each other — even just the year.',
  falling: 'The trips, the calls, the ordinary days that added up.',
  yes: 'The question, and the answer.',
  toward: 'The fitting. The tasting. The first time you saw the venue.',
};

/* ── READING ────────────────────────────────────────────────────────────── */

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): string =>
  (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '').slice(0, max);

function intIn(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isInteger(n) && n >= lo && n <= hi ? n : undefined;
}

/** A date, or null. Month and day only survive where the parent part does. */
export function readMomentDate(raw: unknown): MomentDate | null {
  if (!isObj(raw)) return null;
  const y = intIn(raw.y, 1900, 2200);
  if (y === undefined) return null;
  const m = intIn(raw.m, 1, 12);
  const d = m === undefined ? undefined : intIn(raw.d, 1, 31);
  return { y, ...(m !== undefined ? { m } : {}), ...(d !== undefined ? { d } : {}) };
}

/** Public-bucket refs only, deduped, capped — the same fence a section background passes. */
export function readMomentMedia(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const v of list) {
    const ref = hubMediaRef(v);
    if (ref && ref.startsWith('r2://') && !out.includes(ref)) out.push(ref);
    if (out.length >= MOMENT_MEDIA_MAX) break;
  }
  return out;
}

/** One stored moment, or null when it carries nothing a guest could read. */
export function readMoment(raw: unknown): LoveStoryMoment | null {
  if (!isObj(raw)) return null;
  const id = text(raw.id, 40);
  const line = text(raw.line, MOMENT_LINE_MAX);
  if (!id || !/^[a-z0-9-]+$/i.test(id)) return null;
  const date = readMomentDate(raw.date);
  const place = text(raw.place, MOMENT_PLACE_MAX);
  const media = readMomentMedia(raw.media);
  if (!line && !place && media.length === 0) return null;
  const addedBy = text(raw.added_by, MOMENT_BY_MAX);
  const anchor = raw.anchor === 'met' || raw.anchor === 'yes' ? raw.anchor : undefined;
  return {
    id,
    ...(date ? { date } : {}),
    line,
    ...(place ? { place } : {}),
    ...(media.length ? { media } : {}),
    ...(addedBy ? { added_by: addedBy } : {}),
    ...(anchor ? { anchor } : {}),
    ...(raw.hidden === true ? { hidden: true } : {}),
    canvas: sanitizeHubCanvas(isObj(raw.canvas) ? raw.canvas : {}),
  };
}

/** Did the couple ever save a moment? (An empty `[]` counts — they deleted them all.) */
export function hasStoredMoments(loveStory: unknown): boolean {
  return isObj(loveStory) && Array.isArray(loveStory.moments);
}

/* ── SEEDING FROM THE WORDS THEY ALREADY WROTE ──────────────────────────── */

function yearOf(v: unknown): MomentDate | undefined {
  const y = intIn(typeof v === 'string' ? v.trim().slice(0, 4) : v, 1900, 2200);
  return y === undefined ? undefined : { y };
}

/**
 * The legacy keys → moments. Stable ids so a later edit/delete of a seeded
 * moment names the same one the scrapbook showed. Idempotent by construction:
 * the same blob always yields the same list.
 *
 *   how_we_met → the "met" anchor (date from `met_year`)
 *   spark      → a Falling moment (no date of its own)
 *   proposal   → the "yes" anchor (date from `proposal_year`, place from `proposal_setting`)
 *   milestones → one moment each (`year`/`month`/`day` + `title` [— `note`])
 */
export function seedMomentsFromLegacy(loveStory: unknown): LoveStoryMoment[] {
  if (!isObj(loveStory)) return [];
  const out: LoveStoryMoment[] = [];
  const met = text(loveStory.how_we_met, MOMENT_LINE_MAX);
  if (met) {
    const date = yearOf(loveStory.met_year);
    out.push({ id: 'seed-met', ...(date ? { date } : {}), line: met, anchor: 'met', canvas: {} });
  }
  const spark = text(loveStory.spark, MOMENT_LINE_MAX);
  if (spark) out.push({ id: 'seed-spark', line: spark, canvas: {} });
  const proposal = text(loveStory.proposal, MOMENT_LINE_MAX);
  if (proposal) {
    const date = yearOf(loveStory.proposal_year);
    const place = text(loveStory.proposal_setting, MOMENT_PLACE_MAX);
    out.push({
      id: 'seed-yes',
      ...(date ? { date } : {}),
      line: proposal,
      ...(place ? { place } : {}),
      anchor: 'yes',
      canvas: {},
    });
  }
  const milestones = Array.isArray(loveStory.milestones) ? loveStory.milestones : [];
  milestones.slice(0, MOMENT_MAX).forEach((raw, i) => {
    if (!isObj(raw)) return;
    const title = text(raw.title ?? raw.label ?? raw.what, MOMENT_LINE_MAX);
    const note = text(raw.note ?? raw.text ?? raw.detail, MOMENT_LINE_MAX);
    const line = [title, note].filter(Boolean).join(' — ').slice(0, MOMENT_LINE_MAX);
    if (!line) return;
    const date = readMomentDate({ y: raw.year, m: raw.month, d: raw.day });
    out.push({ id: `seed-ms-${i}`, ...(date ? { date } : {}), line, canvas: {} });
  });
  return out.slice(0, MOMENT_MAX);
}

/**
 * THE couple's moments: the stored list once they have saved one, else the
 * seed. Every reader — the scrapbook, the action, the guest page — calls this.
 */
export function resolveMoments(loveStory: unknown): LoveStoryMoment[] {
  if (!hasStoredMoments(loveStory)) return seedMomentsFromLegacy(loveStory);
  const list = (loveStory as { moments: unknown[] }).moments;
  const out: LoveStoryMoment[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const m = readMoment(raw);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
    if (out.length >= MOMENT_MAX) break;
  }
  return out;
}

/* ── ORDER AND CHAPTERS ─────────────────────────────────────────────────── */

/** Sort key: a year alone sorts BEFORE a dated moment of the same year. */
function dateKey(d: MomentDate | undefined): number {
  if (!d) return -Infinity;
  return d.y * 10000 + (d.m ?? 0) * 100 + (d.d ?? 0);
}

export function compareMomentDates(a: MomentDate | undefined, b: MomentDate | undefined): number {
  const ka = dateKey(a);
  const kb = dateKey(b);
  return ka === kb ? 0 : ka < kb ? -1 : 1;
}

/**
 * Which chapter a moment self-sorts into. The two anchors ARE their chapters;
 * everything else finds its place from its date against theirs: before the
 * meeting is Before us, after the yes is Toward the day, the rest is Falling.
 */
export function chapterOf(moment: LoveStoryMoment, all: readonly LoveStoryMoment[]): LoveStoryChapter {
  if (moment.anchor === 'met') return 'met';
  if (moment.anchor === 'yes') return 'yes';
  const met = all.find((m) => m.anchor === 'met' && m.date);
  const yes = all.find((m) => m.anchor === 'yes' && m.date);
  if (moment.date && met?.date && compareMomentDates(moment.date, met.date) < 0) return 'before';
  if (moment.date && yes?.date && compareMomentDates(moment.date, yes.date) > 0) return 'toward';
  return 'falling';
}

export type ChapteredMoment = LoveStoryMoment & { chapter: LoveStoryChapter };

/** The story in reading order: chapter, then date, then the order they were added. */
export function sortMoments(moments: readonly LoveStoryMoment[]): ChapteredMoment[] {
  const rank = (c: LoveStoryChapter) => LOVE_STORY_CHAPTERS.indexOf(c);
  return moments
    .map((m, i) => ({ ...m, chapter: chapterOf(m, moments), i }))
    .sort(
      (a, b) =>
        rank(a.chapter) - rank(b.chapter) || compareMomentDates(a.date, b.date) || a.i - b.i,
    )
    .map(({ i: _i, ...m }) => m);
}

export function groupByChapter(
  moments: readonly LoveStoryMoment[],
): { chapter: LoveStoryChapter; moments: ChapteredMoment[] }[] {
  const sorted = sortMoments(moments);
  return LOVE_STORY_CHAPTERS.map((chapter) => ({
    chapter,
    moments: sorted.filter((m) => m.chapter === chapter),
  }));
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** "2021" · "August 2022" · "14 February 2025" — only as exact as stored. */
export function formatMomentDate(d: MomentDate | undefined): string {
  if (!d) return '';
  if (!d.m) return String(d.y);
  const month = MONTHS[d.m - 1] ?? '';
  return d.d ? `${d.d} ${month} ${d.y}` : `${month} ${d.y}`;
}

/* ── THE CAP — THE ONE RULE ─────────────────────────────────────────────── */

export type MomentRefusal = 'more_stories_pro' | 'photos_pro' | 'max';

/**
 * Would this write be refused? Asked by the ONE server action and by the
 * scrapbook (to draw the Pro line instead of a form that would bounce).
 *
 *   · `before` — the moments as they stand; `after` — as they would stand.
 *   · A free couple may not grow past five, and may not add ANY photo ref the
 *     list did not already hold. Removing is never refused.
 *   · Nobody grows past `MOMENT_MAX`.
 */
export function momentCapRefusal(input: {
  before: readonly LoveStoryMoment[];
  after: readonly LoveStoryMoment[];
  ownsPro: boolean;
}): MomentRefusal | null {
  const { before, after, ownsPro } = input;
  if (after.length > MOMENT_MAX && after.length > before.length) return 'max';
  if (ownsPro) return null;
  if (after.length > FREE_MOMENT_CAP && after.length > before.length) return 'more_stories_pro';
  const held = new Set(before.flatMap((m) => m.media ?? []));
  if (after.some((m) => (m.media ?? []).some((ref) => !held.has(ref)))) return 'photos_pro';
  return null;
}

/** May this couple start one more story right now? */
export function mayAddMoment(count: number, ownsPro: boolean): boolean {
  return count < (ownsPro ? MOMENT_MAX : FREE_MOMENT_CAP);
}

/* ── EACH MOMENT AS A SCENE ─────────────────────────────────────────────── */

export type LoveStoryScene = {
  id: string;
  chapter: LoveStoryChapter;
  chapterLabel: string;
  when: string;
  line: string;
  place: string | null;
  media: string[];
  addedBy: string | null;
  canvas: HubSectionCanvas;
  /**
   * The Maker template this moment suggests (plan Phase 7): the meeting a
   * portrait + pull quote (6), the yes a full clip when it has media (14) or
   * words (8), a photo moment a portrait (6), words alone (8). A HINT for the
   * Phase 5 renderer — never stored, so a couple's own choice (in `canvas`)
   * always wins once that renderer reads it.
   */
  template: number;
};

export function suggestedMomentTemplate(m: LoveStoryMoment): number {
  const hasMedia = (m.media ?? []).length > 0;
  if (m.anchor === 'yes') return hasMedia ? 14 : 8;
  if (m.anchor === 'met') return 6;
  return hasMedia ? 6 : 8;
}

/**
 * THE GUEST PLAN: one scene per VISIBLE moment, in story order. Hidden moments
 * are skipped, never rendered empty. This is the list the Event Hub draws —
 * and the seam the Phase 5 scene renderer takes over.
 */
export function loveStoryScenes(loveStory: unknown): LoveStoryScene[] {
  return sortMoments(resolveMoments(loveStory))
    .filter((m) => !m.hidden)
    .map((m) => ({
      id: m.id,
      chapter: m.chapter,
      chapterLabel: LOVE_STORY_CHAPTER_LABEL[m.chapter],
      when: formatMomentDate(m.date),
      line: m.line,
      place: m.place ?? null,
      media: m.media ?? [],
      addedBy: m.added_by ?? null,
      canvas: m.canvas,
      template: suggestedMomentTemplate(m),
    }));
}

/** Every photo ref the guest page must sign for the Love Story — one pass, deduped. */
export function loveStoryMediaRefs(loveStory: unknown): string[] {
  return [...new Set(loveStoryScenes(loveStory).flatMap((s) => s.media))];
}

/* ── WRITING ────────────────────────────────────────────────────────────── */

/** Serialise for `events.love_story.moments` — drops the derived chapter. */
export function storableMoments(moments: readonly LoveStoryMoment[]): LoveStoryMoment[] {
  return moments.slice(0, MOMENT_MAX).map((m) => {
    const clean = readMoment(m);
    return clean ?? m;
  });
}

/** A fresh id — short, url-safe, collision-checked against the list. */
export function newMomentId(existing: readonly LoveStoryMoment[], random: () => number = Math.random): string {
  const taken = new Set(existing.map((m) => m.id));
  for (;;) {
    const id = `m-${Math.floor(random() * 36 ** 8).toString(36).padStart(8, '0')}`;
    if (!taken.has(id)) return id;
  }
}
