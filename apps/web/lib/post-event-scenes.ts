/**
 * apps/web/lib/post-event-scenes.ts
 *
 * POST EVENT AS SCENES — the story the Event Hub Maker writes on its own, the
 * morning after (Event Hub Maker Phase 8, `EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`;
 * drawn in `prototypes/post_event_auto_story_2026-09-25.html`).
 *
 * Owner 2026-09-24: *"okay convert it to scenes."* Every part of the story after
 * the day is ONE scene with a template, a source that filled it, and a status:
 *
 *   · auto     — filled from what happened. Nothing was typed.
 *   · skipped  — its source has nothing in it. 🔒 NEVER AN EMPTY SCENE: a scene
 *                whose source is empty is shown AS SKIPPED, with the reason, and
 *                guests never meet it (the "renders like emptiness" disease —
 *                a blank box that looks exactly like a broken one).
 *   · optional — absent until the couple chooses it (What comes next).
 *
 * ── ONE SOURCE OF TRUTH FOR SHOWN / HIDDEN AND ORDER ─────────────────────────
 * 🔑 THE SCENES DO NOT STORE THEIR OWN EYE OR THEIR OWN POSITION. The story has
 * carried both for months — `draft_json.sections` (which blocks show) and
 * `draft_json.sectionOrder` (the run's order), read by the guest page through
 * `resolveSectionOrder`. A second `mode` / `order` stored on each scene would be
 * a second, competing source for the same two facts (CLAUDE.md rule 0 · 8), and
 * the Story Maker's desk and the Maker would disagree the first time either was
 * used. So `draftToScenes` READS those keys; the stored `draft_json.scenes` holds
 * only what is new — which template, what filled it, whether it was skipped, and
 * when it was written (`scenesGeneratedAt`).
 *
 * ── THE ORDER IS THE PAGE'S ORDER ────────────────────────────────────────────
 * The navigator lists the scenes in the order the canvas draws them (owner
 * 2026-09-25: *"why does the slides not follow the sequence alotted"*): the
 * cover and the day's own facts first, the couple's run in their saved order
 * (`resolveSectionOrder`), then the pinned close — their words, their song, and
 * What comes next after it.
 *
 * ── THE OPEN-UP FAMILY ───────────────────────────────────────────────────────
 * Four scenes preview in the flow and open full screen on tap: the gallery, the
 * film (a livestream, if they had one, is "Watch the Film"), "Were you there?"
 * and the wishes. The layer uses a URL hash so Back closes it (`openUpHash`).
 * The gallery's tabs follow the reader (owner 2026-09-25): a guest sees what is
 * tagged to them and everyone's (Yours / Everyone's), a stranger sees what is
 * shared in public, the couple sees everything.
 *
 * Pure. No I/O, no `server-only` — the unit suite and client components load it.
 */

import { resolveSectionOrder, type EditorialOrderKey } from '@/app/[slug]/_components/editorial/editorial-order';
import type { SceneTemplateId } from '@/lib/scene-templates';
import type { StoryViewer } from '@/lib/who-can-see-your-story';

/* ── the open-up family ─────────────────────────────────────────────────── */

export const OPEN_UP_KINDS = ['gallery', 'film', 'you', 'wishes'] as const;
export type OpenUpKind = (typeof OPEN_UP_KINDS)[number];

/** The URL hash a layer lives at — so the phone's Back closes it. */
export function openUpHash(kind: OpenUpKind): `#open-${OpenUpKind}` {
  return `#open-${kind}`;
}

/** The layer a hash opens, or null. Anything unrecognised opens nothing. */
export function openUpFromHash(hash: string | null | undefined): OpenUpKind | null {
  if (typeof hash !== 'string') return null;
  const m = /^#?open-([a-z]+)$/.exec(hash.trim());
  const kind = m?.[1];
  return kind && (OPEN_UP_KINDS as readonly string[]).includes(kind) ? (kind as OpenUpKind) : null;
}

/* ── who is reading ─────────────────────────────────────────────────────── */

export type PostEventReader = 'couple' | 'guest' | 'stranger';

/**
 * The reader, from the viewer the page ALREADY resolved (`StoryViewer`: the
 * host, somebody who belongs to the celebration, or a stranger). Never
 * re-derived here — a second opinion could disagree with the lock screen.
 */
export function postEventReader(viewer: StoryViewer): PostEventReader {
  if (viewer.isHost) return 'couple';
  return viewer.belongsToEvent ? 'guest' : 'stranger';
}

export type GalleryTabKey = 'everything' | 'yours' | 'everyone' | 'shared';
export type GalleryTab = { key: GalleryTabKey; label: string };

/**
 * THE GALLERY'S TABS FOLLOW THE READER (owner 2026-09-25): "all that is tagged
 * to me" or "all that is shared in public". The couple sees everything.
 */
export function galleryTabsFor(reader: PostEventReader): GalleryTab[] {
  if (reader === 'couple') return [{ key: 'everything', label: 'Everything' }];
  if (reader === 'guest') {
    return [
      { key: 'yours', label: 'Yours' },
      { key: 'everyone', label: 'Everyone’s' },
    ];
  }
  return [{ key: 'shared', label: 'Shared with everyone' }];
}

/* ── the scenes ─────────────────────────────────────────────────────────── */

export type PostEventSceneStatus = 'auto' | 'skipped' | 'optional';

/**
 * Which shipped `draft_json.sections` switch a scene answers to, when it has
 * one. Scenes without one (the cover, the chapters' own curation, Before the
 * day, Were you there?, the song, What comes next) are not hidden from here.
 */
export type PostEventSectionSwitch =
  | 'byTheNumbers'
  | 'gallery'
  | 'kwento'
  | 'challengeAnswers'
  | 'guestColumns'
  | 'fromVendors'
  | 'liveWall'
  | 'watchFilm'
  | 'reviews'
  | 'poweredBy'
  | 'vendorsWeLoved'
  | 'fromTheCouple';

export type PostEventScene = {
  /** Stable within an event: `cover`, `before`, `ch-3`, `gallery`, … */
  key: string;
  /** What the navigator prints. */
  name: string;
  /** One of the 25 (`lib/scene-templates.ts`); null = a shipped part of its own (Were you there?). */
  template: SceneTemplateId | null;
  /** What filled it, in words, with the count when there is one. */
  source: string;
  status: PostEventSceneStatus;
  /** Why it is skipped / optional — said, never implied by an empty tile. */
  note: string | null;
  count: number | null;
  /** An open-up scene: a preview in the flow, a tap opens it full screen. */
  open: OpenUpKind | null;
  /** A pinned position: the cover leads, the close is fixed. */
  pin: 'first' | 'close' | 'last' | 'after' | null;
  /** The reorderable block of the page that draws it, when it has one. */
  block: EditorialOrderKey | null;
  /** The `sections` switch that hides it, when it has one. */
  switch: PostEventSectionSwitch | null;
  /** A chapter's lead capture — the key `chapterOverrides` targets. */
  leadId?: string | null;
};

/** What the compiler reads. Every field is a fact the story's loader already has. */
export type PostEventSources = {
  /** Where the cover's picture comes from (`resolveHero` when nothing was chosen). */
  cover: 'chosen' | 'hero' | 'day' | 'card';
  milestones: number;
  metrics: { photos: number | null; guests: number };
  chapters: ReadonlyArray<{ time: string | null; title: string | null; leadId: string | null; isClip: boolean; media: number }>;
  galleryPhotos: number;
  /** A Live Studio broadcast replay (the livestream, if they had one). */
  broadcast: boolean;
  films: number;
  kwento: number;
  challengeAnswers: number;
  guestColumns: number;
  vendorMedia: number;
  liveWall: { active: boolean; photos: number };
  reviews: number;
  services: number;
  vendorsWeLoved: number;
  specialMessage: boolean;
  song: string | null;
  whatsNext: string | null;
};

export const POST_EVENT_SCENES_VERSION = 1;

export type CompiledPostEvent = {
  version: typeof POST_EVENT_SCENES_VERSION;
  generatedAt: string;
  scenes: PostEventScene[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-PH')} ${n === 1 ? one : many}`;

type Def = Omit<PostEventScene, 'status' | 'note' | 'count' | 'source'> & {
  fill: (s: PostEventSources) => { count: number | null; source: string } | { skip: string };
};

/** The fixed scenes, in the prototype's numbering (chapters are built apart). */
const FIXED: Record<string, Def> = {
  cover: {
    key: 'cover', name: 'Cover', template: 4, open: null, pin: 'first', block: null, switch: null,
    fill: (s) => ({
      count: null,
      source:
        s.cover === 'chosen' ? 'The cover you chose'
          : s.cover === 'hero' ? 'Your hero'
            : s.cover === 'day' ? 'A photo from the day'
              : 'Your names, written',
    }),
  },
  before: {
    key: 'before', name: 'Before the day', template: 24, open: null, pin: null, block: null, switch: null,
    fill: (s) => (s.milestones > 0 ? { count: s.milestones, source: `Our Love Story · ${plural(s.milestones, 'moment')}` } : { skip: 'No Love Story moments yet' }),
  },
  numbers: {
    key: 'numbers', name: 'By the Numbers', template: 12, open: null, pin: null, block: null, switch: 'byTheNumbers',
    fill: (s) =>
      (s.metrics.photos ?? 0) > 0 || s.metrics.guests > 0
        ? { count: s.metrics.photos ?? s.metrics.guests, source: (s.metrics.photos ?? 0) > 0 ? `${plural(s.metrics.photos ?? 0, 'capture')} · ${plural(s.metrics.guests, 'guest')}` : plural(s.metrics.guests, 'guest') }
        : { skip: 'No guests or captures to count' },
  },
  gallery: {
    key: 'gallery', name: 'From the Day · Gallery', template: 21, open: 'gallery', pin: null, block: 'gallery', switch: 'gallery',
    fill: (s) => (s.galleryPhotos > 0 ? { count: s.galleryPhotos, source: `The gallery · ${plural(s.galleryPhotos, 'photo')}` } : { skip: 'No photos from the day yet' }),
  },
  film: {
    key: 'film', name: 'Watch the Film', template: 14, open: 'film', pin: null, block: 'watchFilm', switch: 'watchFilm',
    fill: (s) =>
      s.broadcast || s.films > 0
        ? { count: (s.broadcast ? 1 : 0) + s.films, source: [s.broadcast ? 'Live Studio replay' : null, s.films > 0 ? plural(s.films, 'film') : null].filter(Boolean).join(' · ') }
        : { skip: 'No livestream or film' },
  },
  you: {
    key: 'you', name: 'Were you there?', template: null, open: 'you', pin: null, block: null, switch: null,
    fill: (s) => ((s.metrics.photos ?? 0) > 0 ? { count: null, source: 'Each guest’s own Papic link · no name field' } : { skip: 'No Papic captures on this event' }),
  },
  wishes: {
    key: 'wishes', name: 'What They Whispered', template: 23, open: 'wishes', pin: null, block: 'kwento', switch: 'kwento',
    fill: (s) => (s.kwento > 0 ? { count: s.kwento, source: `Guest wishes · ${plural(s.kwento, 'wish', 'wishes')}` } : { skip: 'No approved wishes yet' }),
  },
  asked: {
    key: 'asked', name: 'What We Asked', template: 25, open: null, pin: null, block: 'challengeAnswers', switch: 'challengeAnswers',
    fill: (s) => (s.challengeAnswers > 0 ? { count: s.challengeAnswers, source: `Challenge answers · ${s.challengeAnswers}` } : { skip: 'No shared challenge answers' }),
  },
  letters: {
    key: 'letters', name: 'Letters to the Editor', template: 22, open: null, pin: null, block: 'guestColumns', switch: 'guestColumns',
    fill: (s) => (s.guestColumns > 0 ? { count: s.guestColumns, source: `Guest columns · ${s.guestColumns}` } : { skip: 'No approved guest columns' }),
  },
  vendors: {
    key: 'vendors', name: 'From Your Vendors', template: 20, open: null, pin: null, block: 'fromVendors', switch: 'fromVendors',
    fill: (s) => (s.vendorMedia > 0 ? { count: s.vendorMedia, source: `Supplier photos · ${s.vendorMedia}` } : { skip: 'No photos from your suppliers yet' }),
  },
  wall: {
    key: 'wall', name: 'Live Photo Wall', template: 19, open: null, pin: null, block: 'liveWall', switch: 'liveWall',
    fill: (s) =>
      !s.liveWall.active ? { skip: 'No Live Photo Wall on this event' }
        : s.liveWall.photos > 0 ? { count: s.liveWall.photos, source: `Live Photo Wall · ${plural(s.liveWall.photos, 'photo')}` }
          : { skip: 'Nothing on the Live Photo Wall' },
  },
  said: {
    key: 'said', name: 'What They Said', template: 23, open: null, pin: null, block: 'reviews', switch: 'reviews',
    fill: (s) => (s.reviews > 0 ? { count: s.reviews, source: `Reviews · ${s.reviews}` } : { skip: 'No reviews yet' }),
  },
  powered: {
    key: 'powered', name: 'Powered by Setnayan', template: 8, open: null, pin: null, block: 'poweredBy', switch: 'poweredBy',
    fill: (s) => (s.services > 0 ? { count: s.services, source: `Your orders · ${plural(s.services, 'service')}` } : { skip: 'No Setnayan services on this event' }),
  },
  loved: {
    key: 'loved', name: 'Vendors We Loved', template: 17, open: null, pin: null, block: 'vendorsWeLoved', switch: 'vendorsWeLoved',
    fill: (s) => (s.vendorsWeLoved > 0 ? { count: s.vendorsWeLoved, source: `Your recommendations · ${s.vendorsWeLoved}` } : { skip: 'No suppliers recommended yet' }),
  },
  couple: {
    key: 'couple', name: 'From the couple', template: 11, open: null, pin: 'close', block: null, switch: 'fromTheCouple',
    fill: (s) => (s.specialMessage ? { count: null, source: 'Your closing words' } : { skip: 'Write your closing words and the story ends on them' }),
  },
  song: {
    key: 'song', name: 'Their Song', template: 8, open: null, pin: 'last', block: null, switch: null,
    fill: (s) => (s.song ? { count: null, source: `“${s.song}”` } : { skip: 'No song for the day' }),
  },
};

/** The reorderable block → the scene that lives in it. `chapters` expands into one scene per chapter. */
const SCENE_FOR_BLOCK: Record<Exclude<EditorialOrderKey, 'chapters'>, keyof typeof FIXED> = {
  kwento: 'wishes',
  challengeAnswers: 'asked',
  guestColumns: 'letters',
  gallery: 'gallery',
  fromVendors: 'vendors',
  liveWall: 'wall',
  watchFilm: 'film',
  reviews: 'said',
  poweredBy: 'powered',
  vendorsWeLoved: 'loved',
};

/**
 * The scene a reorderable block of the page draws — the key the Maker's canvas
 * marker carries (`p:<scene>`). The chapters block is the first chapter's.
 */
export function postEventSceneKeyForBlock(block: EditorialOrderKey): string | null {
  if (block === 'chapters') return 'ch-1';
  return SCENE_FOR_BLOCK[block] ?? null;
}

function build(def: Def, s: PostEventSources): PostEventScene {
  const { fill, ...rest } = def;
  const r = fill(s);
  if ('skip' in r) return { ...rest, status: 'skipped', note: r.skip, count: null, source: '—' };
  return { ...rest, status: 'auto', note: null, count: r.count, source: r.source };
}

/**
 * The chapters of the day — one scene each, in the order they happened. A clip
 * leads with 5 · Clip with a caption; photos alternate 1 · Photo left and
 * 2 · Photo right, the prototype's rhythm. None → ONE skipped row, never ten
 * empty ones.
 */
function chapterScenes(s: PostEventSources): PostEventScene[] {
  if (s.chapters.length === 0) {
    return [{
      key: 'chapters', name: 'As the Day Unfolded', template: 1, source: '—', status: 'skipped',
      note: 'No captures from the day yet', count: null, open: null, pin: null, block: 'chapters', switch: 'gallery',
    }];
  }
  let photoTurn = 0;
  return s.chapters.slice(0, 10).map((c, i) => {
    const template: SceneTemplateId = c.isClip ? 5 : photoTurn++ % 2 === 0 ? 1 : 2;
    const name = [c.time, c.title].filter(Boolean).join(' · ') || `Chapter ${i + 1}`;
    return {
      key: `ch-${i + 1}`,
      name,
      template,
      source: c.isClip ? 'A Papic clip' : `Papic · ${plural(c.media, 'photo')}`,
      status: 'auto',
      note: null,
      count: c.media,
      open: null,
      pin: null,
      block: 'chapters',
      switch: 'gallery',
      leadId: c.leadId,
    } satisfies PostEventScene;
  });
}

/**
 * THE COMPILER. Every scene the prototype names, filled from its source or
 * marked skipped. The order returned is the prototype's; `postEventSceneList`
 * puts them in the PAGE's order.
 */
export function compilePostEventScenes(s: PostEventSources, generatedAt: string): CompiledPostEvent {
  const scenes: PostEventScene[] = [
    build(FIXED.cover!, s),
    build(FIXED.before!, s),
    build(FIXED.numbers!, s),
    ...chapterScenes(s),
    build(FIXED.gallery!, s),
    build(FIXED.film!, s),
    build(FIXED.you!, s),
    build(FIXED.wishes!, s),
    build(FIXED.asked!, s),
    build(FIXED.letters!, s),
    build(FIXED.vendors!, s),
    build(FIXED.wall!, s),
    build(FIXED.said!, s),
    build(FIXED.powered!, s),
    build(FIXED.loved!, s),
    build(FIXED.couple!, s),
    build(FIXED.song!, s),
    s.whatsNext
      ? { key: 'next', name: 'What comes next', template: 10, source: s.whatsNext, status: 'auto', note: null, count: null, open: null, pin: 'after', block: null, switch: null }
      : { key: 'next', name: 'What comes next', template: 10, source: '—', status: 'optional', note: 'Absent until you choose what comes next', count: null, open: null, pin: 'after', block: null, switch: null },
  ];
  return { version: POST_EVENT_SCENES_VERSION, generatedAt, scenes };
}

/* ── the stored record, and the lazy compile ────────────────────────────── */

const STATUSES: ReadonlySet<string> = new Set(['auto', 'skipped', 'optional']);

/** `draft_json.scenes` → the stored scenes, or null when there are none / it is malformed. */
export function readStoredScenes(draftJson: unknown): CompiledPostEvent | null {
  if (!draftJson || typeof draftJson !== 'object' || Array.isArray(draftJson)) return null;
  const d = draftJson as Record<string, unknown>;
  const raw = d.scenes;
  const at = typeof d.scenesGeneratedAt === 'string' && Number.isFinite(Date.parse(d.scenesGeneratedAt)) ? d.scenesGeneratedAt : null;
  if (!Array.isArray(raw) || !at) return null;
  const scenes: PostEventScene[] = [];
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.key !== 'string' || typeof o.name !== 'string' || typeof o.status !== 'string' || !STATUSES.has(o.status)) continue;
    const tpl = typeof o.template === 'number' && o.template >= 1 && o.template <= 25 ? (o.template as SceneTemplateId) : null;
    const open = typeof o.open === 'string' && (OPEN_UP_KINDS as readonly string[]).includes(o.open) ? (o.open as OpenUpKind) : null;
    scenes.push({
      key: o.key.slice(0, 40),
      name: o.name.slice(0, 120),
      template: tpl,
      source: typeof o.source === 'string' ? o.source.slice(0, 160) : '—',
      status: o.status as PostEventSceneStatus,
      note: typeof o.note === 'string' ? o.note.slice(0, 160) : null,
      count: typeof o.count === 'number' && Number.isFinite(o.count) ? o.count : null,
      open,
      pin: o.pin === 'first' || o.pin === 'close' || o.pin === 'last' || o.pin === 'after' ? o.pin : null,
      block: typeof o.block === 'string' ? (o.block as EditorialOrderKey) : null,
      switch: typeof o.switch === 'string' ? (o.switch as PostEventSectionSwitch) : null,
      ...(typeof o.leadId === 'string' ? { leadId: o.leadId } : {}),
    });
  }
  return scenes.length ? { version: POST_EVENT_SCENES_VERSION, generatedAt: at, scenes } : null;
}

/**
 * SHOULD THIS OPEN COMPILE? The repo has no scheduler, by design — so the story
 * is written lazily, on the couple's first open of Post Event after the day,
 * and again only when a scene that was skipped now has something in it (a
 * review arrives, a film is linked). Nothing else rewrites the record, so
 * `generatedAt` means "when we last wrote it", not "when you last looked".
 */
export function postEventNeedsCompile(input: {
  eventEnded: boolean;
  isCouple: boolean;
  stored: CompiledPostEvent | null;
  fresh: CompiledPostEvent;
}): boolean {
  if (!input.eventEnded || !input.isCouple) return false;
  if (!input.stored) return true;
  const was = new Map(input.stored.scenes.map((sc) => [sc.key, sc.status] as const));
  const now = new Map(input.fresh.scenes.map((sc) => [sc.key, sc.status] as const));
  for (const [key, status] of now) {
    const before = was.get(key);
    if (before === undefined) return true; // a new scene (a chapter appeared)
    if (before !== 'auto' && status === 'auto') return true; // a skipped source gained content
  }
  return false;
}

/**
 * The draft with the compiled scenes written in — the ONLY keys it touches are
 * `scenes` and `scenesGeneratedAt`. 🔒 The couple's words, switches, order and
 * chapter curation are carried across untouched (the golden test holds it).
 */
export function withCompiledScenes(
  draftJson: Record<string, unknown>,
  compiled: CompiledPostEvent,
): Record<string, unknown> {
  return {
    ...draftJson,
    scenes: compiled.scenes.map(({ key, name, template, source, status, note, count, open, pin, block, switch: sw, leadId }) => ({
      key, name, template, source, status, note, count, open, pin, block, switch: sw,
      ...(leadId ? { leadId } : {}),
    })),
    scenesGeneratedAt: compiled.generatedAt,
  };
}

/* ── the conversion: the draft the story already had → scene rows ───────── */

export type SceneRow = { key: string; hidden: boolean };

/**
 * THE CONVERSION (plan Phase 8 · the 13 editorials). The shipped draft carried
 * which blocks show (`sections`) and in what order (`sectionOrder`), plus the
 * chapters' own curation (`chapterOverrides`, applied by the loader). This maps
 * them onto scene rows — in the page's order, each with its eye — WITHOUT
 * writing them anywhere: they stay the one source (see the file note).
 *
 * `chapterKeys` are the chapter scenes the compiler produced (`ch-1`…), which
 * take the `chapters` block's place. Pure and total: a malformed draft reads as
 * "everything on, default order", exactly like the guest page reads it.
 */
export function draftToScenes(draftJson: unknown, chapterKeys: readonly string[] = ['chapters']): SceneRow[] {
  const d = draftJson && typeof draftJson === 'object' && !Array.isArray(draftJson) ? (draftJson as Record<string, unknown>) : {};
  const rawSections = d.sections && typeof d.sections === 'object' && !Array.isArray(d.sections) ? (d.sections as Record<string, unknown>) : {};
  const off = (k: PostEventSectionSwitch | null) => (k ? rawSections[k] === false : false);
  const savedOrder = Array.isArray(d.sectionOrder) ? (d.sectionOrder as unknown[]).filter((x): x is string => typeof x === 'string') : null;

  const rows: SceneRow[] = [
    { key: 'cover', hidden: false },
    { key: 'before', hidden: false },
    { key: 'you', hidden: false },
    { key: 'numbers', hidden: off('byTheNumbers') },
  ];
  for (const block of resolveSectionOrder(savedOrder)) {
    if (block === 'chapters') {
      for (const k of chapterKeys) rows.push({ key: k, hidden: off('gallery') });
      continue;
    }
    const sceneKey = SCENE_FOR_BLOCK[block as Exclude<EditorialOrderKey, 'chapters'>];
    if (!sceneKey) continue; // a couple's own column — not a scene of the auto story
    rows.push({ key: sceneKey, hidden: off(FIXED[sceneKey]!.switch) });
  }
  rows.push({ key: 'couple', hidden: off('fromTheCouple') });
  rows.push({ key: 'song', hidden: false });
  rows.push({ key: 'next', hidden: false });
  return rows;
}

export type PostEventListRow = PostEventScene & { hidden: boolean; position: number | null };

/**
 * WHAT THE MAKER'S NAVIGATOR LISTS FOR POST EVENT: every compiled scene, in the
 * page's order, with the draft's eye. Skipped and optional scenes are listed
 * (said as such) but carry no number — guests never meet them.
 */
export function postEventSceneList(compiled: CompiledPostEvent, draftJson: unknown): PostEventListRow[] {
  const byKey = new Map(compiled.scenes.map((sc) => [sc.key, sc] as const));
  const chapterKeys = compiled.scenes.filter((sc) => sc.block === 'chapters').map((sc) => sc.key);
  const out: PostEventListRow[] = [];
  let n = 0;
  for (const row of draftToScenes(draftJson, chapterKeys)) {
    const sc = byKey.get(row.key);
    if (!sc) continue;
    const drawn = sc.status === 'auto' && !row.hidden;
    out.push({ ...sc, hidden: row.hidden, position: drawn ? n++ : null });
  }
  return out;
}

/* ── the words on the cover — read exactly as the guest page reads them ──── */

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * The cover's headline and lead AS THE PAGE READS THEM (`editorial/data.ts`:
 * `headline`, and `lead_paragraphs` ▸ `leadParagraphs` ▸ `article` ▸ `lead` ▸
 * `body`). The golden test compares this before and after the conversion.
 */
export function postEventCoverWords(draftJson: unknown): { headline: string | null; lead: string[] | null } {
  const d = draftJson && typeof draftJson === 'object' && !Array.isArray(draftJson) ? (draftJson as Record<string, unknown>) : {};
  const candidate = d.lead_paragraphs ?? d.leadParagraphs ?? d.article;
  let lead: string[] | null = null;
  if (Array.isArray(candidate)) {
    const out = candidate.map(str).filter((p): p is string => !!p);
    lead = out.length ? out : null;
  } else {
    const single = str(candidate) ?? str(d.lead) ?? str(d.body);
    lead = single ? single.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : null;
  }
  return { headline: str(d.headline), lead };
}
