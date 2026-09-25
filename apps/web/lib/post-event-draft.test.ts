/**
 * post-event-draft.test.ts — POST EVENT'S SCENES GO THROUGH THE DRAFT, AND
 * APPLY PUBLISHES THEM (owner 2026-09-25, "POST EVENT IS MANY SMALL SCENES").
 *
 * The couple adds, removes, reorders and hides Post Event scenes in the Maker.
 * Every edit is a drafted copy of the story's OWN keys (`sections`,
 * `sectionOrder`, `customColumns`) — never a second order or a second switch
 * map — and Apply writes them into the story's row. Both answers of the one
 * Pro gate are built: a free couple's new scene is held, an owning couple's
 * is applied.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POST_EVENT_SECTION_KEYS,
  applyPostEventItems,
  classifyPostEventDraft,
  newPostEventSceneId,
  overlayPostEventDraftJson,
  postEventAdd,
  postEventArrangementOf,
  postEventEdit,
  postEventMove,
  postEventRemove,
  postEventRun,
  postEventRunKey,
  postEventShow,
  sanitizePostEventDraft,
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
  type HubLiveState,
} from './hub-draft';
import { EDITORIAL_ORDERABLE_KEYS } from '@/app/[slug]/_components/editorial/editorial-order';
import { POST_EVENT_PRESETS } from './post-event-presets';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

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
const isPatch = (r: PostEventDraft | { refused: string }): r is PostEventDraft => !('refused' in r);

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
  assert.deepEqual(a.customColumns.map((c) => c.id), ['dogs1']);
  // A malformed story reads as the default arrangement, never a throw.
  assert.deepEqual(arr('nope'), { sections: {}, sectionOrder: null, customColumns: [] });
});

test('sanitize: a draft save is a public POST — junk never reaches the draft', () => {
  const d = sanitizePostEventDraft({
    sections: { kwento: false, gallery: true, nope: false, watchFilm: 'false' },
    sectionOrder: ['gallery', 'fromTheCouple', 'song', 'custom:dogs1', 'custom:a:b', 'custom:', 'gallery', 7],
    customColumns: [{ id: 'BAD!', title: 'x', body: 'y' }, { id: 'pe0001', title: 'Salamat', body: 'Thank you', preset: 'thank_you' }],
    evil: 1,
  })!;
  assert.deepEqual(d.sections, { kwento: false }, 'only an explicit false on a known switch');
  assert.deepEqual(d.sectionOrder, ['gallery', 'custom:dogs1'], 'no locked-close key, no forged namespace, no dupes');
  assert.deepEqual(d.customColumns, [{ id: 'pe0001', title: 'Salamat', body: 'Thank you', preset: 'thank_you' }]);
  assert.equal(sanitizePostEventDraft({ evil: 1 }), undefined);
  assert.equal(sanitizePostEventDraft('x'), undefined);
  // An unknown preset is dropped, never guessed — the column stays plain words.
  const plain = sanitizePostEventDraft({ customColumns: [{ id: 'pe0002', title: 'T', body: 'B', preset: 'confetti' }] })!;
  assert.deepEqual(plain.customColumns, [{ id: 'pe0002', title: 'T', body: 'B' }]);
});

test('show / hide writes the story’s own switch map', () => {
  assert.deepEqual(postEventShow(arr(), 'kwento', true), { sections: {} });
  assert.deepEqual(postEventShow(arr(), 'gallery', false), { sections: { kwento: false, gallery: false } });
});

test('order: one place at a time, in the run; fixed scenes do not move; chapters move together', () => {
  const a = arr();
  assert.equal(postEventRunKey('cover'), null);
  assert.equal(postEventRunKey('numbers'), null);
  assert.equal(postEventRunKey('you'), null);
  assert.equal(postEventRunKey('couple'), null);
  assert.equal(postEventRunKey('ch-3'), 'chapters');
  assert.equal(postEventRunKey('wishes'), 'kwento');
  assert.equal(postEventRunKey('custom:dogs1'), 'custom:dogs1');
  assert.equal(postEventMove(a, 'cover', 1), null);
  assert.equal(postEventMove(a, 'ch-1', -1), null, 'the first of the run cannot go earlier');
  const later = postEventMove(a, 'ch-2', 1)!;
  assert.deepEqual(later.sectionOrder!.slice(0, 2), ['kwento', 'chapters']);
  // Moving back to the default stores nothing — the workroom's own rule.
  const back = postEventMove(withPostEventDraft(a, later), 'wishes', 1)!;
  const run = postEventRun(withPostEventDraft(a, back));
  assert.deepEqual(run.slice(0, EDITORIAL_ORDERABLE_KEYS.length), [...EDITORIAL_ORDERABLE_KEYS]);
});

test('add a Post Event preset: their own column, at the end of the run; six is the shape', () => {
  const a = arr();
  const r = postEventAdd(a, 'gallery_grid', 'pe00000001');
  assert.ok(isPatch(r));
  const col = r.customColumns!.find((c) => c.id === 'pe00000001')!;
  assert.equal(col.preset, 'gallery_grid');
  assert.ok(col.title && col.body, 'it starts with words, never an empty scene');
  assert.equal(r.sectionOrder, undefined, 'no stored order: the run appends it by itself');
  const run = postEventRun(withPostEventDraft(a, r));
  assert.equal(run[run.length - 1], 'custom:pe00000001');
  // With a stored order, it is appended to it.
  const ordered = withPostEventDraft(a, postEventMove(a, 'ch-1', 1)!);
  const r2 = postEventAdd(ordered, 'letter', 'pe00000002');
  assert.ok(isPatch(r2));
  assert.equal(r2.sectionOrder![r2.sectionOrder!.length - 1], 'custom:pe00000002');
  // Full at six.
  let full = a;
  for (let i = 0; i < 5; i += 1) full = withPostEventDraft(full, postEventAdd(full, 'letter', `pefull${i}0`) as PostEventDraft);
  assert.equal(full.customColumns.length, 6);
  assert.deepEqual(postEventAdd(full, 'quote', 'pefull99'), { refused: 'full' });
  assert.deepEqual(postEventAdd(a, 'confetti' as never, 'pe00000003'), { refused: 'unknown_preset' });
  assert.match(newPostEventSceneId(), /^[a-z0-9]{12}$/);
});

test('edit and remove their own scene; the words are never left empty', () => {
  const a = arr();
  const e = postEventEdit(a, 'dogs1', '  The Dog, again ', 'Still the bow tie.');
  assert.ok(isPatch(e));
  assert.deepEqual(e.customColumns![0], { id: 'dogs1', title: 'The Dog, again', body: 'Still the bow tie.' });
  assert.deepEqual(postEventEdit(a, 'dogs1', ' ', 'x'), { refused: 'empty_title' });
  assert.deepEqual(postEventEdit(a, 'dogs1', 'x', '  '), { refused: 'empty_body' });
  assert.deepEqual(postEventEdit(a, 'nope1', 'x', 'y'), { refused: 'missing' });
  const withOrder = withPostEventDraft(a, { sectionOrder: ['custom:dogs1', 'chapters'] });
  const rm = postEventRemove(withOrder, 'dogs1');
  assert.deepEqual(rm.customColumns, []);
  assert.deepEqual(rm.sectionOrder, ['chapters']);
});

test('every preset starts with words the story’s own reader accepts', () => {
  for (const p of POST_EVENT_PRESETS) {
    const r = postEventAdd(arr({}), p.id, `pe${p.id.replace(/_/g, '').slice(0, 10)}`);
    assert.ok(isPatch(r), `${p.id} was refused`);
    assert.equal(r.customColumns!.length, 1, `${p.id}: its words must pass readCustomColumns`);
  }
});

test('the overlay touches the three story keys only — the host’s canvas sees the draft, words untouched', () => {
  const draft: PostEventDraft = { sections: {}, sectionOrder: ['gallery'], customColumns: [] };
  const out = overlayPostEventDraftJson(LIVE_STORY, draft);
  assert.equal(out.headline, LIVE_STORY.headline);
  assert.deepEqual(out.chapterOverrides, LIVE_STORY.chapterOverrides);
  assert.deepEqual(out.scenes, LIVE_STORY.scenes);
  assert.equal((out.sections as Record<string, boolean>).kwento, true, 'drafted shown');
  assert.deepEqual(out.sectionOrder, ['gallery']);
  assert.equal('customColumns' in out, false, 'an emptied list is no key');
  assert.deepEqual(overlayPostEventDraftJson(LIVE_STORY, null), { ...LIVE_STORY });
});

/* ── Apply ─────────────────────────────────────────────────────────────── */

const NEW_SCENE = { id: 'pe00000009', title: 'Salamat', body: 'Thank you.', preset: 'thank_you' as const };

test('classify: show/hide, order and their words are free; a NEW scene of their own is Pro', () => {
  const draft: PostEventDraft = {
    sections: {},
    sectionOrder: ['gallery', 'chapters'],
    customColumns: [{ id: 'dogs1', title: 'The Dog', body: 'New words.' }, NEW_SCENE],
  };
  const items = classifyPostEventDraft(draft, LIVE_STORY);
  assert.deepEqual(items.map((i) => [i.field, i.pro]), [
    ['sections', false],
    ['sectionOrder', false],
    ['customColumns', false],
    ['newScene', true],
  ]);
  // A drafted key equal to live is not an item.
  assert.deepEqual(classifyPostEventDraft({ sections: { kwento: false }, customColumns: LIVE_STORY.customColumns }, LIVE_STORY), []);
});

test('apply writes the three keys and nothing else — the golden story keeps every other key', () => {
  const draft: PostEventDraft = { sections: { gallery: false }, sectionOrder: ['gallery'], customColumns: [NEW_SCENE] };
  const out = applyPostEventItems(LIVE_STORY, classifyPostEventDraft(draft, LIVE_STORY));
  const touched = Object.keys({ ...LIVE_STORY, ...out })
    .filter((k) => JSON.stringify((out as Record<string, unknown>)[k]) !== JSON.stringify((LIVE_STORY as Record<string, unknown>)[k]))
    .sort();
  assert.deepEqual(touched, ['customColumns', 'sectionOrder', 'sections']);
  assert.equal((out.sections as Record<string, boolean>).gallery, false);
  assert.equal(Object.keys(out.sections as object).length, POST_EVENT_SECTION_KEYS.length, 'the full map saveEditorial stores');
  // The drafted list removed the live column and added one: exactly that lands.
  assert.deepEqual((out.customColumns as Array<{ id: string }>).map((c) => c.id), ['pe00000009']);
});

const hubLive = (story: unknown): HubLiveState => ({ events: {}, widgets: [], editorial: story });

test('THE GATE, BOTH WAYS: a free couple’s new scene is held (the rest applies); an owning couple’s lands', () => {
  const draft = mergeHubDraft(emptyHubDraft(), {
    editorial: { sectionOrder: ['gallery'], customColumns: [...LIVE_STORY.customColumns, NEW_SCENE] },
  });
  const free = planHubDraftApply(draft, hubLive(LIVE_STORY), false);
  assert.deepEqual(free.apply.map((i) => (i.kind === 'editorial' ? i.item.field : i.kind)), ['sectionOrder']);
  assert.deepEqual(free.refused.map((i) => (i.kind === 'editorial' ? i.item.field : i.kind)), ['newScene']);
  assert.deepEqual(free.remaining.editorial?.customColumns?.map((c) => c.id), ['dogs1', 'pe00000009'], 'the tried scene stays in the draft');
  const owning = planHubDraftApply(draft, hubLive(LIVE_STORY), true);
  assert.equal(owning.refused.length, 0);
  assert.deepEqual(hubDraftWriteTables(owning.apply), ['event_editorial']);
  // The bar counts them, and the Pro one.
  const s = summarizeHubDraft(draft, hubLive(LIVE_STORY), false);
  assert.equal(s.changeCount, 2);
  assert.equal(s.proCount, 1);
});

test('the Event Hub draft carries the story keys — merged whole, undone, sanitised', () => {
  const one = mergeHubDraft(emptyHubDraft(), { editorial: { sections: { gallery: false } } });
  const two = mergeHubDraft(one, { editorial: { sectionOrder: ['gallery'] } });
  assert.deepEqual(two.editorial, { sections: { gallery: false }, sectionOrder: ['gallery'] });
  assert.deepEqual(undoHubDraft(two).editorial, { sections: { gallery: false } });
  const round = sanitizeHubDraft(JSON.parse(JSON.stringify(two)));
  assert.deepEqual(round.editorial, two.editorial);
  // A draft with no Post Event edits has no `editorial` key at all.
  assert.equal('editorial' in sanitizeHubDraft({ events: {}, widgets: {} }), false);
});

test('Reset never touches the Post Event story — no stage’s reset names a story key', () => {
  for (const scope of HUB_RESET_SCOPES) {
    const patch = hubResetPatch(scope);
    assert.equal('editorial' in patch, false, `reset ${scope} must not draft the story`);
  }
});
