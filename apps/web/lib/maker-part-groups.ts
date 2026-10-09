/**
 * lib/maker-part-groups.ts — ＋ THE PARTS A PAGE CAN TAKE, GROUPED THE WAY
 * GUESTS MEET THEM; ↕ WHERE A DRAGGED PART LANDS; 🗑 WHAT TAKING ONE OFF DOES.
 * The new Maker's Stages side, behind `makerStagesStudioEnabled`.
 *
 * Owner, 2026-10-06, verbatim: *"yes"* (to: add the undrawn Post Event scenes as
 * ＋ parts) · *"they can also drag up and down and reposition elements"*. Plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 3; the approved
 * prototype's `PART_GROUPS`, `partsHTML`, `addPart`, `askRemove`
 * (`maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`); DECISION_LOG
 * 2026-10-06 "POST EVENT: EVERY SHIPPED AUTO SCENE CAN BE ADDED"; 2026-10-05
 * "EVERY GUEST PAGE'S DEFAULT SECTION ORDER" (a default only — a couple's saved
 * `stage_order` keeps theirs).
 *
 * ── NOTHING NEW IS STORED ───────────────────────────────────────────────────
 * Adding a part is the shipped "bring it back" (the navigator's eye on a scene
 * the couple hid, `MakerFolded.hiddenByCouple`; a Post Event scene's own switch,
 * `postEventShow`). Moving one is the shipped stage order — ONE draft save of the
 * whole stage (`lib/maker-reorder.ts` `stageOrderPatch`, the patch the sections
 * panel's move writes in draft mode), or Post Event's run (`postEventMove`).
 * Removing one is the eye again; deleting a scene of their own is the shipped
 * "Remove for good" (`sections-panel.tsx`). No column, no new save.
 *
 * ── THE NINE POST EVENT SCENES ──────────────────────────────────────────────
 * "After the event" lists them by their SHIPPED names (`lib/post-event-scenes.ts`
 * `POST_EVENT_SCENE_NAMES`) — The Road to the Day · Watch Live · Papic Challenge ·
 * Supplier Stories · Live Photo Wall · What They Said · Before & After · Song ·
 * What comes next. **Were you there?** (scene `you`) is a part of its own (`you`)
 * since 2026-10-10 — it was The Day's "Photos of you" wearing another name on Post
 * Event, so the two could not differ (Were you there? has ONE look; Photos of you
 * has three). Held by `maker-part-groups.test.ts`.
 *
 * Pure. No I/O, no React.
 */
import { CUSTOM_SECTION_TYPES } from './custom-sections';
import { formatCount } from './format-number';
import { MAKER_PARTS, makerPartsOnPage, type MakerPartKey, type MakerStageKey } from './maker-parts';
import { swapsForDrop } from './maker-scene-list';
import { POST_EVENT_SCENE_NAMES } from './post-event-scene-names';
import { postEventMove, type PostEventArrangement, type PostEventDraft } from './post-event-draft';

/* ── the groups (prototype `PART_GROUPS`) ─────────────────────────────────── */

export type MakerPartGroup = { label: string; parts: readonly MakerPartKey[] };

/**
 * Every standard part, grouped the way guests meet them. The prototype's
 * "After the event" also named `film` and `suppliers` — the SAME shipped scenes
 * as Watch Live (`p:film`) and Supplier Stories (`p:vendors`), so each is listed
 * once, by its shipped name.
 */
export const MAKER_PART_GROUPS: readonly MakerPartGroup[] = [
  { label: 'Words', parts: ['ename', 'names', 'opening', 'greeting', 'message', 'bring'] },
  { label: 'When & where', parts: ['date', 'place', 'countdown', 'schedule', 'venue'] },
  { label: 'Your story', parts: ['story', 'march', 'dress'] },
  { label: 'For each guest', parts: ['myrole', 'mywear', 'myarrive', 'myguests'] },
  { label: 'Replies', parts: ['rsvpcard', 'rsvp', 'yesnote', 'nonote', 'pass', 'seats'] },
  { label: 'Notes & news', parts: ['reminders', 'announce'] },
  { label: 'Gifts & photos', parts: ['gifts', 'camera', 'gallery', 'myphotos'] },
  {
    label: 'After the event',
    /* …and, after the owner's nine, the rest of Post Event's own scenes (2026-10-10: a tap on one named no part — an
       empty Edit). Listed here so ＋ can bring one back after "Shown to guests" is switched off; a stage that does not
       draw them is never offered them (`makerPartOffers` `pathOf`). Each by its shipped name (`MAKER_PARTS`). */
    parts: [
      ...['numbers', 'wishes', 'road', 'watchlive', 'challenge', 'supstories', 'wall', 'said', 'beforeafter', 'song', 'next'] as const,
      ...['cover', 'chapters', 'pegallery', 'videos', 'you', 'letters', 'seating', 'entourage', 'couple', 'loved', 'powered'] as const,
    ],
  },
  { label: 'Brand', parts: ['logo', 'reveal'] },
];

/** The group "After the event" — the nine shipped Post Event scenes, by key. */
export const MAKER_POST_EVENT_ADDED: Readonly<Partial<Record<MakerPartKey, string>>> = {
  road: 'before',
  watchlive: 'film',
  challenge: 'asked',
  supstories: 'vendors',
  wall: 'wall',
  said: 'said',
  beforeafter: 'beforeAfter',
  song: 'song',
  next: 'next',
};

/** The shipped Post Event scene a part is on that stage — null when it is not one. */
export function makerPostEventSceneOf(stage: MakerStageKey, key: MakerPartKey): string | null {
  if (stage !== 'editorial') return null;
  const own = MAKER_POST_EVENT_ADDED[key];
  if (own) return own;
  const c = MAKER_PARTS[key].canvas;
  return c && c.startsWith('p:') ? c.slice(2) : null;
}

/** Where the part is drawn ON THIS STAGE (its canvas key) — Post Event names its scenes `p:<scene>`. */
export function makerPartCanvasOn(stage: MakerStageKey, key: MakerPartKey): string | null {
  const pe = makerPostEventSceneOf(stage, key);
  return pe ? `p:${pe}` : MAKER_PARTS[key].canvas;
}

/** The part's word ON THIS STAGE — a Post Event scene's is its shipped name. */
export function makerPartLabelOn(stage: MakerStageKey, key: MakerPartKey): string {
  const pe = makerPostEventSceneOf(stage, key);
  return (pe && POST_EVENT_SCENE_NAMES[pe]) || MAKER_PARTS[key].label;
}

/** The part a canvas key is ON THIS STAGE (the first that names it) — a tap on a part the page's default list does not name. */
export function makerPartOfCanvas(stage: MakerStageKey, canvas: string): MakerPartKey | null {
  for (const k of Object.keys(MAKER_PARTS) as MakerPartKey[]) {
    if (makerPartCanvasOn(stage, k) === canvas && !MAKER_PARTS[k].el) return k;
  }
  return null;
}

/* ── what ＋ offers ───────────────────────────────────────────────────────── */

/**
 * How a part not on the page can be put there:
 *   add      — the shipped door brings it (a hidden scene's eye, a Post Event switch)
 *   waiting  — it is a scene of this stage, but it shows by itself once it has
 *              something in it (a Post Event scene with no switch, or nothing in
 *              it yet) — listed, with its shipped note behind ⓘ, never a ＋ that
 *              would do nothing
 *   null     — this stage cannot draw it: not offered
 */
export type MakerPartAddPath = { kind: 'add' } | { kind: 'waiting'; note: string } | null;

export type MakerPartOffer = { key: MakerPartKey; label: string; path: Exclude<MakerPartAddPath, null> };

/**
 * ＋ THE SHEET'S LIST: the parts NOT already on this page (`present` = the
 * canvas keys the page drew), grouped, each with how it is added. Empty groups
 * are left out. A part is listed once, in its first group.
 */
export function makerPartOffers(input: {
  stage: MakerStageKey;
  present: ReadonlySet<string>;
  pathOf: (key: MakerPartKey, canvas: string) => MakerPartAddPath;
}): Array<{ label: string; parts: MakerPartOffer[] }> {
  const seen = new Set<MakerPartKey>();
  const out: Array<{ label: string; parts: MakerPartOffer[] }> = [];
  for (const g of MAKER_PART_GROUPS) {
    const parts: MakerPartOffer[] = [];
    for (const key of g.parts) {
      if (seen.has(key)) continue;
      const canvas = makerPartCanvasOn(input.stage, key);
      if (!canvas || input.present.has(canvas)) continue;
      const path = input.pathOf(key, canvas);
      if (!path) continue;
      seen.add(key);
      parts.push({ key, label: makerPartLabelOn(input.stage, key), path });
    }
    if (parts.length) out.push({ label: g.label, parts });
  }
  return out;
}

/* ── a scene of their own: six, shared across every stage ─────────────────── */

/** The shipped six (`lib/custom-sections.ts` — `MAX_OWN_SCENES`, `scene-thumb.tsx`). */
export const MAKER_OWN_SCENES_MAX = CUSTOM_SECTION_TYPES.length;

/** How many more a couple may add — never below none. */
export function makerOwnScenesLeft(used: number): number {
  return Math.max(0, MAKER_OWN_SCENES_MAX - Math.max(0, Math.floor(used)));
}

/** "n of 6 left" — the line under "A scene of your own ◆". */
export function makerOwnScenesLine(used: number): string {
  return `${formatCount(makerOwnScenesLeft(used))} of ${formatCount(MAKER_OWN_SCENES_MAX)} left`;
}

/* ── the strip: a part added to a page is that page's ────────────────────── */

/**
 * The parts a tap can reach on this page: the page's own (in the approved
 * order, where drawn) plus any part the page draws that its default list does
 * not name — one the couple ADDED. An added part belongs to the page of the
 * part drawn just before it (`drawn` = the canvas keys in page order), or the
 * part just after it when it leads.
 */
export function makerPartsWithAdded(input: {
  stage: MakerStageKey;
  page: string | null;
  pages: readonly string[];
  drawn: readonly string[];
  /** 🧭 The page each drawn key sits on, as a tabbed canvas FILED it (`filedOnCanvas`, `lib/maker-stage-filing.ts`) —
   *  the canvas is the truth for a part no page's list names. Absent / a key it lacks: the neighbour rule below. */
  filed?: Readonly<Record<string, string>>;
}): MakerPartKey[] {
  const { stage, page, pages, drawn, filed } = input;
  if (!page) return [];
  const present = new Set(drawn);
  const own = makerPartsOnPage(stage, page).filter((k) => {
    const c = makerPartCanvasOn(stage, k);
    return c !== null && present.has(c);
  });
  /* Which page claims each drawn canvas key, by the default lists. */
  const pageOfKey = new Map<string, string>();
  for (const p of pages) {
    for (const k of makerPartsOnPage(stage, p)) {
      const c = makerPartCanvasOn(stage, k);
      if (c && !pageOfKey.has(c)) pageOfKey.set(c, p);
    }
  }
  const added: MakerPartKey[] = [];
  drawn.forEach((c, i) => {
    if (pageOfKey.has(c)) return;
    const part = (Object.keys(MAKER_PARTS) as MakerPartKey[]).find((k) => makerPartCanvasOn(stage, k) === c);
    if (!part || own.includes(part) || added.includes(part)) return;
    const before = drawn.slice(0, i).reverse().find((x) => pageOfKey.has(x));
    const after = drawn.slice(i + 1).find((x) => pageOfKey.has(x));
    const home = filed?.[c] ?? pageOfKey.get((before ?? after)!) ?? null;
    if (home === page) added.push(part);
  });
  /* Each added part sits where it is drawn: after the page's part drawn before it. */
  const out = [...own];
  for (const a of added) {
    const at = drawn.indexOf(makerPartCanvasOn(stage, a)!);
    const prev = out.findIndex((k) => drawn.indexOf(makerPartCanvasOn(stage, k) ?? '') > at);
    if (prev < 0) out.push(a);
    else out.splice(prev, 0, a);
  }
  return out;
}

/* ── ↕ a drag: ONE order write ────────────────────────────────────────────── */

/**
 * A scene dropped above / below another shown scene → the signed number of
 * places it moves in the stage's FULL order (`swapsForDrop`, the navigator's
 * own drop rule). `shown` = the stage's shown scene ids in page order;
 * `afterLastShown` = the full-order row that follows the last shown one.
 */
export function makerDropDelta(input: {
  fullOrder: readonly string[];
  shown: readonly string[];
  afterLastShown: string | null;
  id: string;
  target: string;
  where: 'above' | 'below';
}): number {
  const { fullOrder, shown, afterLastShown, id, target, where } = input;
  if (id === target) return 0;
  if (where === 'above') return swapsForDrop(fullOrder, id, target);
  const rest = shown.filter((x) => x !== id);
  const next = rest[rest.indexOf(target) + 1] ?? null;
  return swapsForDrop(fullOrder, id, next ?? (afterLastShown === id ? null : afterLastShown));
}

/**
 * 🎞 A Post Event scene moved by `steps` places in the story's run — the
 * shipped single-step move (`postEventMove`) composed, saved as ONE draft of
 * the run. Null when it cannot move (its place is fixed, or it is at an end).
 */
export function makerPostEventMoveDraft(arr: PostEventArrangement, sceneKey: string, steps: number): PostEventDraft | null {
  if (!Number.isInteger(steps) || steps === 0) return null;
  let cur = arr;
  let last: PostEventDraft | null = null;
  const dir: -1 | 1 = steps < 0 ? -1 : 1;
  for (let i = 0; i < Math.abs(steps); i++) {
    const d = postEventMove(cur, sceneKey, dir);
    if (!d) break;
    last = d;
    cur = { ...cur, sectionOrder: d.sectionOrder ?? null };
  }
  return last;
}

/* ── 🗑 what taking a part off says ─────────────────────────────────────────── */

/**
 * The one confirm (the prototype's `askRemove`): a scene of their own is
 * DELETED (its words go with it — the shipped Remove for good); any other part
 * is REMOVED from this page and its words stay in Studio (the eye; ＋ brings it
 * back).
 */
export function makerRemoveWords(label: string, own: boolean): { title: string; body: string; yes: string } {
  return own
    ? { title: 'Delete this scene?', body: `${label} and its words are deleted for good when you Apply.`, yes: 'Delete' }
    : { title: 'Remove from this page?', body: `${label} leaves this page. Its words stay in Studio, and ＋ brings it back.`, yes: 'Remove' };
}
