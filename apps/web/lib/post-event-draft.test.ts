/**
 * post-event-draft.test.ts — POST EVENT'S SCENES GO THROUGH THE DRAFT, AND APPLY
 * PUBLISHES THEM (owner 2026-09-25 "POST EVENT IS MANY SMALL SCENES", 2026-09-29
 * "EVERY STYLE OF EVERY SCENE SHIPS").
 *
 * Every Maker edit is a drafted copy of the story's OWN keys — `sections`,
 * `sectionOrder` and each scene's look (`sceneLooks`) — never a second order or
 * a second switch map (brief §5 test 7), and Apply writes them into the story's
 * row. Show / hide, order, a style and the words are free; a part's own font or
 * animation is Pro — held at Apply while everything free beside it goes live.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  POST_EVENT_SECTION_KEYS,
  applyPostEventItems,
  classifyPostEventDraft,
  overlayPostEventDraftJson,
  postEventArrangementOf,
  postEventMove,
  postEventRunKey,
  postEventSetElements,
  postEventSetStyle,
  postEventSetWords,
  postEventShow,
  readSceneLooks,
  sanitizePostEventDraft,
  sceneLooksFreePart,
  withPostEventDraft,
  type PostEventArrangement,
  type PostEventDraft,
} from './post-event-draft';
import {
  emptyHubDraft,
  hubDraftWriteTables,
  hubResetPatch,
  HUB_RESET_SCOPES,
  mergeHubDraft,
  planHubDraftApply,
  sanitizeHubDraft,
  summarizeHubDraft,
  undoHubDraft,
  classifyHubDraft,
  type HubLiveState,
} from './hub-draft';
import { stripComments } from './strip-comments';
import { hubDraftProEffects } from './hub-pro-effects';
import { sanitizeCustomColumns } from './story-pro-extras';

const LIVE_STORY = {
  headline: 'Rafael & Isabel, Married at Last',
  lead_paragraphs: ['First.', 'Second.'],
  chapterOverrides: [{ leadId: 'a', title: 'The vows' }],
  scenes: [{ key: 'cover' }],
  scenesGeneratedAt: '2026-12-13T06:02:00.000Z',
  sections: { kwento: false },
  customColumns: [{ id: 'dogs1', title: 'The Dog', body: 'He wore a bow tie.' }],
};

const arr = (d: unknown = LIVE_STORY): PostEventArrangement => postEventArrangementOf(d);
const live = (story: unknown = LIVE_STORY): HubLiveState => ({ events: {}, widgets: [], editorial: story });
const patchOf = (r: PostEventDraft | { refused: string } | null): PostEventDraft => {
  assert.ok(r && !('refused' in r), `expected a patch, got ${JSON.stringify(r)}`);
  return r as PostEventDraft;
};

test('the switch list is the story’s own — EDITORIAL_SECTION_KEYS, key for key', () => {
  // `editorial/data.ts` is server-only, so it is READ, not imported.
  const src = stripComments(readFileSync(join(__dirname, '../app/[slug]/_components/editorial/data.ts'), 'utf8'));
  const block = /export const EDITORIAL_SECTION_KEYS[^=]*=\s*\[([\s\S]*?)\];/.exec(src)?.[1];
  assert.ok(block, 'EDITORIAL_SECTION_KEYS not found in editorial/data.ts');
  const keys = [...block.matchAll(/'(\w+)'/g)].map((m) => m[1]!);
  assert.ok(keys.length >= 13, `read ${keys.length} keys`);
  assert.deepEqual([...POST_EVENT_SECTION_KEYS].sort(), keys.sort());
});

test('the live arrangement is read through the page’s own rules', () => {
  const a = arr();
  assert.deepEqual(a.sections, { kwento: false });
  assert.equal(a.sectionOrder, null, 'no stored order = the default');
  assert.deepEqual(a.customIds, ['dogs1'], 'the workroom’s own columns take part in the order, read only');
  assert.deepEqual(a.sceneLooks, {});
  assert.deepEqual(arr('nope'), { sections: {}, sectionOrder: null, sceneLooks: {}, customIds: [] });
});

test('sanitize: a draft save is a public POST — junk never reaches the draft', () => {
  const d = sanitizePostEventDraft({
    sections: { kwento: false, gallery: true, nope: false, watchFilm: 'false' },
    sectionOrder: ['gallery', 'fromTheCouple', 'song', 'custom:dogs1', 'custom:a:b', 'custom:', 'gallery', 7],
    sceneLooks: {
      numbers: { style: 'receipt', words: { label: '  The day  ', heading: '', evil: 'x' }, elements: { heading: { color: '#112233' }, names: { color: '#000000' } } },
      cover: { style: 'Not An Id', words: { heading: 'x'.repeat(500) } },
      nope: { style: 'receipt' },
      chapters: { style: 'timeline' },
    },
    customColumns: [{ id: 'pe0001', title: 'x', body: 'y' }],
    evil: 1,
  })!;
  assert.deepEqual(d.sections, { kwento: false }, 'only an explicit false on a known switch');
  assert.deepEqual(d.sectionOrder, ['gallery', 'custom:dogs1'], 'no locked-close key, no forged namespace, no dupes');
  assert.deepEqual(d.sceneLooks, {
    numbers: { style: 'receipt', words: { label: 'The day' }, elements: { heading: { color: '#112233' } } },
  }, 'a bad id, an over-long line, a hero-only part, an unknown scene and a homed style are all dropped');
  /* 💎 The workroom's own columns ARE drafted now — a couple without Pro tries
     them there and Apply asks (`lib/story-pro-extras.ts`) — but only through the
     render path's own reader, never as sent. */
  assert.deepEqual(d.customColumns, sanitizeCustomColumns([{ id: 'pe0001', title: 'x', body: 'y' }]));
  assert.deepEqual(
    sanitizePostEventDraft({ customColumns: [{ id: 'A B<', title: '', body: '' }], reviews: [{ quote: '' }] }),
    { customColumns: [], reviews: [] },
    'a column the page would drop and a wish with no words never reach the draft',
  );
  assert.equal(sanitizePostEventDraft({ evil: 1 }), undefined);
  assert.equal(sanitizePostEventDraft('x'), undefined);
});

test('7 · ONE SOURCE OF TRUTH — the order lives in sectionOrder only; a look never carries an order or an eye', () => {
  // Every edit the Maker makes, and the keys each one writes.
  const a = arr();
  const edits: PostEventDraft[] = [
    postEventShow(a, 'gallery', false),
    postEventMove(a, 'ch-2', 1)!,
    patchOf(postEventSetStyle(a, 'numbers', 'receipt', 'big-numbers')),
    patchOf(postEventSetWords(a, 'couple', 'body', 'Salamat.')),
    patchOf(postEventSetElements(a, 'cover', { heading: { color: '#123456' } })),
  ];
  const allowed = new Set(['sections', 'sectionOrder', 'sceneLooks']);
  for (const e of edits) for (const k of Object.keys(e)) assert.ok(allowed.has(k), `an edit wrote a fourth key: ${k}`);
  assert.equal(edits.filter((e) => 'sectionOrder' in e).length, 1, 'only a MOVE writes an order');
  // A look is style · words · elements — nothing that orders or hides.
  const looks = readSceneLooks({ numbers: { style: 'receipt', order: 3, hidden: true, position: 1, mode: 'hidden' } });
  assert.deepEqual(looks, { numbers: { style: 'receipt' } });
  // And Apply writes exactly those keys, nothing else in the row changes.
  const out = applyPostEventItems(LIVE_STORY, classifyPostEventDraft(Object.assign({}, ...edits), LIVE_STORY));
  const changed = Object.keys(out).filter((k) => JSON.stringify(out[k]) !== JSON.stringify((LIVE_STORY as Record<string, unknown>)[k]));
  assert.deepEqual(changed.sort(), ['sceneLooks', 'sectionOrder', 'sections']);
  for (const k of ['headline', 'lead_paragraphs', 'chapterOverrides', 'scenes', 'scenesGeneratedAt', 'customColumns']) {
    assert.deepEqual(out[k], (LIVE_STORY as Record<string, unknown>)[k], `${k} must be untouched`);
  }
});

test('show / hide writes the story’s own switch map', () => {
  assert.deepEqual(postEventShow(arr(), 'kwento', true), { sections: {} });
  assert.deepEqual(postEventShow(arr(), 'gallery', false), { sections: { kwento: false, gallery: false } });
});

test('order: one place at a time, in the run; fixed scenes do not move; chapters move together', () => {
  const a = arr();
  for (const fixed of ['cover', 'numbers', 'you', 'couple', 'song']) assert.equal(postEventRunKey(fixed), null, fixed);
  assert.equal(postEventRunKey('ch-3'), 'chapters');
  assert.equal(postEventRunKey('wishes'), 'kwento');
  assert.equal(postEventMove(a, 'cover', 1), null);
  assert.equal(postEventMove(a, 'ch-1', -1), null, 'the first of the run cannot go earlier');
  const later = postEventMove(a, 'ch-2', 1)!;
  // The chapters' neighbour in the default run is the gallery (owner 2026-10-05:
  // gallery and film come up right after the chapters).
  assert.deepEqual(later.sectionOrder!.slice(0, 2), ['gallery', 'chapters']);
  // Moving back to the default stores nothing — the workroom's own rule (a
  // story with a column of their own is never "default": its place is kept).
  const plain = arr({ sections: {} });
  const there = postEventMove(plain, 'ch-2', 1)!;
  const back = postEventMove(withPostEventDraft(plain, there), 'gallery', 1)!;
  assert.equal(back.sectionOrder, null);
  // The workroom's own column keeps its place in the run through a move.
  const withCol = arr({ ...LIVE_STORY, sectionOrder: ['custom:dogs1', 'chapters'] });
  const moved = postEventMove(withCol, 'gallery', -1)!;
  assert.equal(moved.sectionOrder![0], 'custom:dogs1');
});

test('a style pick is FREE, the default stores nothing, and Schedule · Gallery keep ONE home', () => {
  const a = arr();
  const pick = patchOf(postEventSetStyle(a, 'numbers', 'receipt', 'big-numbers'));
  assert.deepEqual(pick.sceneLooks, { numbers: { style: 'receipt' } });
  const back = patchOf(postEventSetStyle(withPostEventDraft(a, pick), 'numbers', 'big-numbers', 'big-numbers'));
  assert.deepEqual(back.sceneLooks, {}, 'the default is an absence');
  assert.equal(postEventSetStyle(a, 'ch-2', 'timeline', 'one-per-screen'), null, 'Schedule’s style lives on its section');
  assert.equal(postEventSetStyle(a, 'gallery', 'mosaic', 'grid'), null, 'Gallery’s style lives on its section');
  const items = classifyPostEventDraft(pick, LIVE_STORY);
  assert.deepEqual(items.map((i) => [i.field, i.pro]), [['sceneLooks', false]]);
});

test('words: a part’s own line, or back to the words written from the day', () => {
  const a = arr();
  const w = patchOf(postEventSetWords(a, 'cover', 'heading', '  Isa & Raf  '));
  assert.deepEqual(w.sceneLooks, { cover: { words: { heading: 'Isa & Raf' } } });
  const cleared = patchOf(postEventSetWords(withPostEventDraft(a, w), 'cover', 'heading', ''));
  assert.deepEqual(cleared.sceneLooks, {});
  assert.deepEqual(postEventSetWords(a, 'cover', 'label', 'x'.repeat(61)), { refused: 'too_long' });
  // The chapters share ONE look.
  const ch = patchOf(postEventSetWords(a, 'ch-4', 'label', 'The day'));
  assert.deepEqual(Object.keys(ch.sceneLooks!), ['chapters']);
});

test('a part’s own font is FREE at Apply — it goes live with its colour, the style and the words', () => {
  const a = arr();
  const drafted = patchOf(
    postEventSetElements(
      withPostEventDraft(a, patchOf(postEventSetStyle(a, 'numbers', 'receipt', 'big-numbers'))),
      'numbers',
      { heading: { font: 'playfair' as never, color: '#123456' } },
    ),
  );
  assert.equal(drafted.sceneLooks!.numbers!.elements?.heading?.font, 'playfair', 'a real Event Hub font is kept');
  const draft = mergeHubDraft(emptyHubDraft(), { editorial: drafted });
  /* 🔤 2026-10-06 (owner, "EVENT DETAILS IS REBUILT": *"font on a single part is
     FREE"*): the part's font goes live with its colour and style — nothing held. */
  const free = planHubDraftApply(draft, live(), false);
  assert.equal(free.refused.length, 0, 'a part’s font was held as Pro');
  assert.deepEqual(hubDraftWriteTables(free.apply), ['event_editorial']);
  const liveLooks = arr().sceneLooks;
  const fp = sceneLooksFreePart(liveLooks, drafted.sceneLooks!);
  assert.equal(fp.numbers?.elements?.heading?.font, 'playfair', 'the free part dropped the (free) font');
  assert.equal(fp.numbers?.elements?.heading?.color, '#123456');
  assert.deepEqual(hubDraftProEffects(draft, live(), false), [], 'the Apply sheet asks for a free font');
});

test('show / hide and order are FREE at Apply — a free couple’s apply', () => {
  const a = arr();
  const draft = mergeHubDraft(emptyHubDraft(), { editorial: { ...postEventShow(a, 'gallery', false), ...postEventMove(a, 'ch-2', 1)! } });
  const plan = planHubDraftApply(draft, live(), false);
  assert.equal(plan.refused.length, 0);
  assert.deepEqual(plan.apply.map((i) => (i.kind === 'editorial' ? i.item.field : i.kind)), ['sections', 'sectionOrder']);
});

test('a key equal to live is not an item; the host overlay changes only the drafted keys', () => {
  assert.deepEqual(classifyPostEventDraft({ sections: { kwento: false } }, LIVE_STORY), []);
  const over = overlayPostEventDraftJson(LIVE_STORY, { sceneLooks: { cover: { style: 'card' } } });
  assert.deepEqual(over.sceneLooks, { cover: { style: 'card' } });
  assert.equal(over.headline, LIVE_STORY.headline);
  assert.equal(overlayPostEventDraftJson(LIVE_STORY, { sceneLooks: {} }).sceneLooks, undefined);
});

test('the draft keeps Post Event across save, undo and a reload; Reset never touches the story', () => {
  const a = arr();
  const d1 = mergeHubDraft(emptyHubDraft(), { editorial: postEventShow(a, 'gallery', false) });
  const d2 = mergeHubDraft(d1, { editorial: patchOf(postEventSetStyle(a, 'cover', 'card', 'full-bleed')) });
  assert.deepEqual(Object.keys(d2.editorial!).sort(), ['sceneLooks', 'sections'], 'each key merges, none forgets the other');
  assert.deepEqual(sanitizeHubDraft(JSON.parse(JSON.stringify(d2))).editorial, d2.editorial);
  assert.deepEqual(undoHubDraft(d2).editorial, d1.editorial);
  for (const scope of HUB_RESET_SCOPES) {
    const { items } = classifyHubDraft(mergeHubDraft(emptyHubDraft(), hubResetPatch(scope)), live());
    assert.ok(!hubDraftWriteTables(items).includes('event_editorial'), `reset ${scope} would touch the story`);
  }
});
