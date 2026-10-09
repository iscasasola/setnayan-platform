/**
 * the-post-event-toolbar-is-the-prototypes.test.ts — A POST EVENT SCENE IN THE TOOLBAR: ITS WORDS IN ROW 1, "SHOWN
 * TO GUESTS" IN ROW 2, ITS PLACE IN ROW 4; STYLE IS ITS LOOK CARDS AND NOTHING ELSE — AND EVERY SAVE POSTS EXACTLY
 * WHAT THE SCENE'S PANEL POSTS.
 *
 * Owner, 2026-10-09 (`TOOLBAR-SPEC-2026-10-09.md` § EDIT: *"Post Event scenes: heading field + 'Shown to guests'
 * switch"*; *"always set this as the last row"*; *"the rule is always start from the top"* — nothing scrolls); the
 * approved prototype (`public/review/studio-head-prototype.html`), walked headless on 2026-10-09: By the numbers ·
 * Wishes · Supplier stories · Watch live each draw Edit as [1] a words box · [2] Shown to guests · [4] Earlier ·
 * Later · Remove, and Style as its three look cards over all four rows.
 *
 * Seen on the Maker lab before this (375 × 812): the scene's own panel (`post-event-scene-panel.tsx`, the desktop's
 * inspector) was drawn whole under Style — 334 px and more of rows in a 210-px room with no scroller, so "Shown to
 * guests", Order and "Its parts" could not be reached — and Edit's first row was empty.
 *
 *   (1) EDIT'S ROWS — RENDERED: one words row in row 1 (the one last tapped on the page, else the Heading), the
 *       switch in row 2, the move row in row 4. A scene with no switch leaves row 2 empty.
 *   (2) WHICH WORDS — the parts the scene's STYLE draws (the panel's "Its parts"), Heading first; each holds what
 *       guests read now, and the line written from the day is never mistaken for the couple's own words.
 *   (3) 🥇 GOLDEN — WHAT IS POSTED IS UNCHANGED: the words and the switch post, byte for byte, the patch the panel's
 *       own controls build (`postEventSetWords` · `postEventShow`), through the one draft door (`intent=save`),
 *       followed by a Maker render — never held. EXECUTED end to end against a fake door.
 *   (4) STYLE IS THE CARDS ALONE on a phone (RENDERED with the toolbar on): the look cards in the toolbar's rows; no
 *       row of the old panel under them; a failed read is still said. The desktop's panel is every row, as before.
 *   (5) A SCENE WITH NO LOOK TO PICK has a grey Style that says so — never four empty rows.
 *   (6) THE ⓘ — the panel's own sentences, word for word, behind the toolbar's one ⓘ.
 *   (7) EVERY SCENE THE STORY CAN DRAW IS A PART (2026-10-10). Ten were not — Front Page · the day's chapters ·
 *       Gallery · Videos · Messages · Where Everyone Sat · Entourage · Thank You · Suppliers We Loved · Powered by
 *       Setnayan: a tap named no part, so Edit was four empty rows. Each is picked by its SHIPPED name and gets the
 *       same Edit (its words where its style draws some · "Shown to guests" where it has a switch · its place) and
 *       Style as its cards. Were you there? is a part of its own, so its one look greys Style on Post Event without
 *       touching The Day's Photos of you. WHAT A COUPLE MAY DO TO EACH IS THE STORY'S OWN RULE, read from the
 *       compiler — nothing is locked or unlocked here (Powered by Setnayan may be hidden and moved, as shipped).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { MAKER_PARTS, MAKER_PARTS_NO_LOOK, makerPartToolWhy, makerPartToolWorks, type MakerPartKey } from './maker-parts';
import { MAKER_PART_GROUPS, makerPartCanvasOn, makerPartLabelOn, makerPartOfCanvas, makerPostEventSceneOf } from './maker-part-groups';
import { compilePostEventScenes, type PostEventSources } from './post-event-scenes';
import { postEventRunKey } from './post-event-draft';
import { resolvePostEventStyle } from './post-event-style-resolve';
import { postEventWordParts } from './post-event-styles';
import { postEventSetWords, postEventShow, type PostEventArrangement } from './post-event-draft';
import { postEventStyleOptions } from './post-event-style-resolve';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const h = React.createElement;
/** A component under test, taken with the props the test hands it (the modules are imported by path, untyped). */
type Any = React.ComponentType<Record<string, unknown>>;
const seen = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const EMPTY: PostEventArrangement = { sections: {}, sectionOrder: null, sceneLooks: {}, customIds: [] };
type Tile = Record<string, unknown>;
const WISHES: Tile = { kind: 'post-event', key: 'p:wishes', anchor: 'p:wishes', scene: 'wishes', label: 'Photo Notes', status: 'auto', hidden: false, drawn: true, position: 3, template: null, source: 'the wishes your guests left', note: null, open: null, pinned: false, switchKey: 'kwento', runKey: 'kwento' };
const COVER: Tile = { ...WISHES, key: 'p:cover', anchor: 'p:cover', scene: 'cover', label: 'Front Page', pinned: true, switchKey: null, runKey: null };
/** The work area's values, as it lends them (`maker-part-ops.ts` `MakerPartRaw`) — only what a scene is read from. */
const raw = (over: { arrangement?: PostEventArrangement; tiles?: Tile[]; styles?: Record<string, string>; door?: unknown } = {}) =>
  ({
    eventId: 'ev-1',
    list: { shown: over.tiles ?? [COVER, WISHES], folded: [] },
    navigator: { postEvent: { arrangement: over.arrangement ?? EMPTY, styles: over.styles ?? { wishes: 'photo-note-card', cover: 'full-bleed' } } },
    elementEditing: { draftAction: over.door ?? (async () => ({ ok: true })) },
  }) as never;

/* ── (1) Edit's rows ──────────────────────────────────────────────────── */

test('(1) Edit on a Post Event scene: ONE words row in row 1, “Shown to guests” in row 2, the move row in row 4', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { StageEdit } = await import(`../${L}/stage-panel/stage-edit`);
  const field = (el: string, text: string) => ({ key: 'p:wishes', el, field: null, label: { label: 'Label', heading: 'Heading', body: 'Words' }[el]!, text, auto: null, long: el === 'body', maxLength: 120, twoPeople: false });
  const fields = [field('heading', 'What you told us'), field('label', 'Wishes'), field('body', 'So many kind words.')];
  const draw = (tapped: string | null, second: React.ReactNode) =>
    renderToStaticMarkup(
      h(StageEdit as Any, { fields, tapped, onType: () => {}, onKeep: async () => ({ ok: true as const }), earlier: () => {}, later: () => {}, remove: () => {}, removeWord: 'Remove', why: { earlier: 'x', later: 'x', remove: 'x' }, onWhy: () => {}, second }),
    );
  const row2 = h('div', { className: 'row-start-2', 'data-stage-edit-row': 'shown' }, 'Shown to guests');
  const html = draw(null, row2);
  const rows = [...html.matchAll(/class="([^"]*)" data-stage-edit-row="([a-z]+)"/g)].map((m) => `${m[2]}@${/row-start-(\d)/.exec(m[1]!)?.[1]}`);
  assert.deepEqual(rows, ['words@1', 'shown@2', 'place@4'], 'a Post Event scene’s Edit is not: its words · Shown to guests · its place');
  /* ONE box — the Heading (the prototype's) — though the scene's style draws three texts: row 2 is the switch's. */
  assert.deepEqual([...html.matchAll(/data-stage-edit-words="([a-z]+)"/g)].map((m) => m[1]), ['heading']);
  assert.match(html, /aria-label="Heading: What you told us\. Tap to change"/);
  /* *"it can both adapt to whichever is edited"*: the text last tapped on the page is the one in the box. */
  assert.deepEqual([...draw('label', row2).matchAll(/data-stage-edit-words="([a-z]+)"/g)].map((m) => m[1]), ['label']);
  assert.deepEqual([...draw('body', row2).matchAll(/data-stage-edit-words="([a-z]+)"/g)].map((m) => m[1]), ['body']);
  /* Any other part keeps up to three rows of words (a scene of their own: Heading and Words). */
  assert.deepEqual([...draw(null, null).matchAll(/data-stage-edit-words="([a-z]+)"/g)].map((m) => m[1]), ['heading', 'label', 'body']);
  /* The move row is Earlier · Later · Remove, as on every part. */
  assert.deepEqual([...html.slice(html.indexOf('data-stage-edit-row="place"')).matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]), ['Earlier', 'Later', 'Remove']);
  const edit = read(`${L}/stage-panel/stage-edit.tsx`);
  assert.match(edit, /const shown = orderPartWords\(fields, tapped\)\.slice\(0, second \? 1 : WORDS_ROW\.length\);/);

  /* THE SWITCH — the app's one switch, its name the same on and off, in row 2. */
  const shownSrc = read(`${L}/stage-panel/post-event-shown.tsx`);
  assert.match(shownSrc, /<div className=\{`\$\{SP_ROWS_ROW\} row-start-2 \$\{SHOWN_FIT\}`\} data-stage-edit-row="shown">/);
  assert.match(shownSrc, /<SwitchRow\s+data="shown"\s+name="Shown to guests"\s+on=\{shown\}/);
  assert.doesNotMatch(shownSrc, /role="switch"|<button|<input|Hidden from guests/, 'the switch is hand-made, or flips its words');
  /* A scene with no switch of its own draws nothing in row 2. */
  assert.match(shownSrc, /if \(!now\?\.switchKey\) return null;/);
  /* Flipped at the tap, saved behind it, put back — and said — when the save does not land. */
  assert.match(shownSrc, /setDrawn\(next\);\s*void keepPostEventShown\(now, canvasKey, next\)\.then\(\(r\) => \{\s*if \(r\.ok\) return;\s*setDrawn\(null\);\s*onRefused\(r\.error\);\s*\}\);/);
  /* The toolbar draws it for a Post Event SCENE only (a part with a `p:` scene on that stage). */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const canvasOfScene = picked && !rsvpOpen && makerPostEventSceneOf\(stageKey, picked\) \? makerPartCanvasOn\(stageKey, picked\) : null;/);
  assert.match(tools, /second=\{canvasOfScene \? <PostEventShown canvasKey=\{canvasOfScene\} stamp=\{maker\?\.renderStamp\} onRefused=\{[^}]*\}\)\)\} \/> : null\} \/>/);
  assert.equal(makerPostEventSceneOf('editorial', 'wishes'), 'wishes');
  assert.equal(makerPostEventSceneOf('editorial', 'names'), null, 'a line of the cover is given a switch');
  assert.equal(makerPostEventSceneOf('rsvp', 'wishes'), null);
});

/* ── (2) which words ──────────────────────────────────────────────────── */

test('(2) the words are the parts the scene’s STYLE draws — the Heading first — each holding what guests read now', async () => {
  const { postEventSceneOf, postEventWordsFields, POST_EVENT_EDIT_ORDER } = await import(`../${L}/stage-panel/post-event-edit`);
  assert.deepEqual([...POST_EVENT_EDIT_ORDER], ['heading', 'label', 'body']);
  /* Photo Notes in its card style draws a label and a heading (the panel's "Its parts": Label · Heading). */
  const now = postEventSceneOf(raw(), 'p:wishes');
  assert.deepEqual(now.parts, ['heading', 'label']);
  assert.equal(now.switchKey, 'kwento');
  assert.equal(now.hidden, false);
  /* A style that draws only its label offers only that; the cover's full-bleed draws all three. */
  assert.deepEqual(postEventSceneOf(raw({ styles: { wishes: 'swipe-story' } }), 'p:wishes').parts, ['label']);
  assert.deepEqual(postEventSceneOf(raw(), 'p:cover').parts, ['heading', 'label', 'body']);
  assert.equal(postEventSceneOf(raw(), 'p:cover').switchKey, null);
  /* No style resolved (a scene with one look of its own): no words to rewrite — and never a guess. */
  assert.deepEqual(postEventSceneOf(raw({ styles: {} }), 'p:wishes').parts, []);
  /* Not a scene the Maker holds; a story that could not be read; a key that is not a scene's. */
  assert.equal(postEventSceneOf(raw(), 'p:nowhere'), null);
  assert.equal(postEventSceneOf({ ...(raw() as object), navigator: { postEvent: 'unreadable' } } as never, 'p:wishes'), null);
  assert.equal(postEventSceneOf(raw(), 'w:schedule'), null);
  assert.equal(postEventSceneOf(null, 'p:wishes'), null);
  /* A scene switched off is still read (its tile stays, with no place on the page) — so it can be switched on again. */
  assert.equal(postEventSceneOf(raw({ tiles: [{ ...WISHES, hidden: true, anchor: null }] }), 'p:wishes').hidden, true);

  /* The fields: the couple's own words where they wrote some — never offered as "the written line"… */
  const own = { ...EMPTY, sceneLooks: { wishes: { words: { heading: 'What you told us' } } } } as PostEventArrangement;
  const fields = postEventWordsFields(postEventSceneOf(raw({ arrangement: own }), 'p:wishes'), null, 'p:wishes');
  assert.deepEqual(
    fields.map((f: { el: string; label: string; text: string; auto: string | null; long: boolean; maxLength: number; key: string; field: null }) => [f.key, f.el, f.field, f.label, f.text, f.auto, f.long, f.maxLength]),
    [
      ['p:wishes', 'heading', null, 'Heading', 'What you told us', null, false, 120],
      ['p:wishes', 'label', null, 'Label', '', '', false, 60],
    ],
  );
  /* …and the body is the long box, held to the story's own limit. */
  const body = postEventWordsFields(postEventSceneOf(raw(), 'p:cover'), null, 'p:cover').find((f: { el: string }) => f.el === 'body');
  assert.deepEqual([body.long, body.maxLength, body.label], [true, 600, 'Words']);
  /* Read by the toolbar's ONE reader of a part's words (`readPartWords`), which hands a `p:` key here. */
  const words = read(`${L}/stage-panel/part-words.ts`);
  assert.match(words, /if \(key\.startsWith\('p:'\)\) return readPostEventWords\(doc, key\);\s*if \(!key\.startsWith\('w:'\)\) return \[\];/);
  /* Off the page, as guests read it (the canvas's own reader). */
  const edit = read(`${L}/stage-panel/post-event-edit.ts`);
  assert.match(edit, /const written = drawnAt \? partWords\(drawnAt\) : '';/);
  assert.match(edit, /const drawn = postEventWordParts\(tile\.scene, style\);/);
});

/* ── (3) golden: what is posted ───────────────────────────────────────── */

test('(3) GOLDEN: the words and the switch post exactly what the scene’s panel posts — the one door, never held', async () => {
  const { postEventSceneOf, postEventWordsWrite, postEventShownWrite, keepPostEventShown, keepPostEventWords } = await import(`../${L}/stage-panel/post-event-edit`);
  const own = { ...EMPTY, sections: { vendors: false }, sceneLooks: { wishes: { style: 'scrapbook-pairs', words: { label: 'Kind words' } } } } as PostEventArrangement;
  const now = postEventSceneOf(raw({ arrangement: own }), 'p:wishes');

  /* THE WORDS — the panel's `PostEventWordsField` `commit`: `{ editorial: postEventSetWords(arrangement, scene, part, value) }`. */
  assert.deepEqual(postEventWordsWrite(now, 'heading', 'What you told us', null), { ok: true, patch: { editorial: postEventSetWords(own, 'wishes', 'heading', 'What you told us') } });
  assert.deepEqual(postEventWordsWrite(now, 'heading', 'What you told us', null).patch, {
    editorial: { sceneLooks: { wishes: { style: 'scrapbook-pairs', words: { label: 'Kind words', heading: 'What you told us' } } } },
  });
  /* '' goes back to the line written from the day (the key is taken away — the default is never frozen in). */
  assert.deepEqual(postEventWordsWrite(now, 'label', '', null).patch, { editorial: { sceneLooks: { wishes: { style: 'scrapbook-pairs' } } } });
  /* Too long: refused in the panel's own words, nothing posted. */
  assert.deepEqual(postEventWordsWrite(now, 'heading', 'x'.repeat(121), null), { ok: false, reason: 'Keep it under 120 characters.' });
  assert.deepEqual(postEventWordsWrite(now, 'label', 'x'.repeat(61), null), { ok: false, reason: 'Keep it under 60 characters.' });
  /* The written line, left as it is, is NOT the couple's own words: nothing is posted. */
  assert.deepEqual(postEventWordsWrite(now, 'heading', '  The wishes your guests left ', 'The wishes your guests left'), { ok: true, patch: null });
  /* …but changed, it is. */
  assert.ok(postEventWordsWrite(now, 'heading', 'Your wishes', 'The wishes your guests left').patch);

  /* THE SWITCH — the panel's own: `{ editorial: postEventShow(arrangement, tile.switchKey, shown) }`. */
  assert.deepEqual(postEventShownWrite(now, false), { editorial: postEventShow(own, 'kwento', false) });
  assert.deepEqual(postEventShownWrite(now, false), { editorial: { sections: { vendors: false, kwento: false } } });
  assert.deepEqual(postEventShownWrite({ arrangement: { ...own, sections: { kwento: false } }, switchKey: 'kwento' }, true), { editorial: { sections: {} } });
  assert.equal(postEventShownWrite({ arrangement: own, switchKey: null }, false), null, 'a scene with no switch posts one');

  /* EXECUTED END TO END against a fake door: ONE post each — `intent=save`, `patch` = that JSON, nothing else. */
  const posted: Array<{ eventId: string; fields: Record<string, string> }> = [];
  const refreshes: string[] = [];
  const door = async (eventId: string, fd: FormData) => {
    posted.push({ eventId, fields: Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])) });
    return { ok: true, intent: 'save' };
  };
  const g = globalThis as unknown as { window?: unknown; document?: unknown };
  const had = { window: g.window, document: g.document };
  const canvas: unknown[] = [];
  g.document = { querySelectorAll: () => [{ contentWindow: { postMessage: (m: unknown) => canvas.push(m) } }] };
  g.window = {
    location: { origin: 'http://lab' },
    dispatchEvent(ev: { type: string; detail?: unknown }) {
      if (typeof ev.detail === 'function') (ev.detail as (r: unknown) => void)(raw({ arrangement: own, door }));
      else refreshes.push(ev.type);
      return true;
    },
  };
  try {
    const live = postEventSceneOf(raw({ arrangement: own, door }), 'p:wishes');
    assert.deepEqual(await keepPostEventShown(live, 'p:wishes', false), { ok: true });
    assert.deepEqual(posted, [{ eventId: 'ev-1', fields: { intent: 'save', patch: JSON.stringify({ editorial: postEventShow(own, 'kwento', false) }) } }]);
    /* Drawn at the tap: a scene switched off leaves the page now (the bridge's own `sceneShow`). */
    assert.deepEqual(canvas, [{ source: 'setnayan-editor', t: 'sceneShow', key: 'p:wishes', shown: false }]);
    /* …and a Maker render follows (the story's next writer builds on what this one saved) — once the burst has
       settled (`MAKER_REFRESH_COALESCE_MS`). */
    await new Promise((r) => setTimeout(r, 600));
    assert.ok(refreshes.includes('setnayan:maker-refresh'), `no Maker render was asked for after the save (${refreshes.join(', ')})`);
    posted.length = 0;
    canvas.length = 0;
    const f = { key: 'p:wishes', el: 'heading', field: null, label: 'Heading', text: 'The wishes your guests left', auto: 'The wishes your guests left', long: false, maxLength: 120, twoPeople: false };
    assert.deepEqual(await keepPostEventWords(f, 'What you told us'), { ok: true });
    assert.deepEqual(posted, [{ eventId: 'ev-1', fields: { intent: 'save', patch: JSON.stringify({ editorial: postEventSetWords(own, 'wishes', 'heading', 'What you told us') }) } }]);
    /* Left as written: nothing is posted at all. */
    posted.length = 0;
    assert.deepEqual(await keepPostEventWords(f, 'The wishes your guests left'), { ok: true });
    assert.deepEqual(posted, []);
    /* Refused: nothing posted, the row is answered, and the page's words are put back. */
    canvas.length = 0;
    assert.deepEqual(await keepPostEventWords(f, 'x'.repeat(121)), { ok: false, error: 'Keep it under 120 characters.' });
    assert.deepEqual(posted, []);
    assert.deepEqual(canvas, [{ source: 'setnayan-editor', t: 'typeText', key: 'p:wishes', el: 'heading', text: 'The wishes your guests left' }]);
    /* A save that does not land is said — and a scene switched off is put back on the page. */
    canvas.length = 0;
    const refusing = postEventSceneOf(raw({ arrangement: own, door: async () => ({ ok: false, intent: 'save', error: 'Not now.' }) }), 'p:wishes');
    assert.deepEqual(await keepPostEventShown(refusing, 'p:wishes', false), { ok: false, error: 'Not now.' });
    assert.deepEqual(canvas.map((m) => (m as { shown: boolean }).shown), [false, true]);
  } finally {
    g.window = had.window;
    g.document = had.document;
  }

  /* READ AS SOURCE: one writer, the one door, a render after it — never `held` (see the file's docblock). */
  const src = read(`${L}/stage-panel/post-event-edit.ts`);
  assert.equal(src.split('door(now.eventId, fd)').length - 1, 1, 'the scene’s Edit has more than one writer');
  assert.match(src, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(patch\)\);\s*const r: HubDraftActionResult = await makerSave\(\(\) => door\(now\.eventId, fd\), requestMakerRefresh\);/);
  assert.doesNotMatch(src, /held: true|\bfetch\(|from '[^']*actions'/, 'a held save, a second writer or a server action of its own');
  /* The toolbar keeps a scene's words through it — and every other part's through the shipped keep. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const res = f\.key\.startsWith\('p:'\)\s*\? await keepPostEventWords\(f, text\)\s*: await keepPartWords\(f, text, \{ eventId: o\.eventId, draftAction: o\.draftAction, heroCanvas: o\.heroCanvas, ownWords: o\.ownWords \}\);/);
  /* The panel's own controls are untouched — the desktop posts what it always did. */
  const panel = read(`${E}/post-event-scene-panel.tsx`);
  assert.match(panel, /onChange=\{\(shown\) => void save\(\{ editorial: postEventShow\(arrangement, tile\.switchKey!, shown\) \}, \{ hidden: !shown \}\)\}/);
  assert.match(panel, /const r = postEventSetWords\(arrangement, scene, part, value\);/);
});

/* ── (4) Style ────────────────────────────────────────────────────────── */

test('(4) Style on a phone is the scene’s look cards in the toolbar’s rows and nothing else; the desktop’s panel is every row', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PostEventScenePanel } = await import(`../${E}/post-event-scene-panel`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  const props = { eventId: 'ev-1', tile: WISHES, arrangement: EMPTY, writtenAt: '2026-12-13T07:04:00Z', dayHappened: true, eventType: 'wedding', sectionCanvases: {}, draftAction: async () => ({ ok: true }), onPart: () => {} };
  const withToolbar = (p: Record<string, unknown> = {}) =>
    renderToStaticMarkup(h((MakerContext as React.Context<unknown>).Provider, { value: { stagesStudio: true } }, h(PostEventScenePanel as Any, { ...props, ...p })));
  const phone = withToolbar();
  /* The cards, laid in the toolbar's rows (`StageStyle` `rows` — no scroll up and down)… */
  assert.match(phone, /^<section class="contents" data-maker-post-event-panel="wishes" data-post-event-toolbar=""><div class="[^"]*overflow-hidden[^"]*" data-stage-style="look" data-stage-style-rows="">/);
  const cards = [...phone.matchAll(/role="radio" aria-checked="(true|false)" data-style-card="([a-z-]+)"/g)].map((m) => `${m[2]}${m[1] === 'true' ? '*' : ''}`);
  assert.equal(cards.length, postEventStyleOptions('wishes', 'wedding').length);
  assert.ok(cards.length >= 3 && cards.filter((c) => c.endsWith('*')).length === 1, `the scene’s looks, one picked (${cards.join(' ')})`);
  /* …and NOTHING of the old panel under them: no "This scene", no "Filled from", no switch, no Order, no "Its parts". */
  assert.doesNotMatch(phone, /data-form-row|role="switch"|post-event-move-|post-event-part-|This scene|Filled from|Its parts/);
  assert.equal(seen(phone).replace(/Drawing…/g, '').replace(/\s+/g, ' ').trim(), postEventStyleOptions('wishes', 'wedding').map((o) => o.name).join(' '), 'something besides the looks’ names is printed under Style');
  /* A read that FAILED is still said, on the panel, in red. */
  assert.match(withToolbar({ arrangement: null }), /<p role="alert" data-post-event-unread="" class="[^"]*text-danger-700">Your story’s scenes could not be read just now — open the Maker again in a moment\.<\/p>/);
  /* THE DESKTOP (no toolbar): every row, as before — the same component, the same saves. */
  const desk = renderToStaticMarkup(h(PostEventScenePanel as Any, props));
  assert.match(desk, /^<section class="flex flex-col px-1" data-maker-post-event-panel="wishes">/);
  for (const row of ['data-form-row="scene"', 'data-form-row="shown"', 'data-form-row="order"', 'data-form-row="parts"']) assert.ok(desk.includes(row), `the desktop’s panel lost ${row}`);
  /* One switch decides, and it is the Maker's own "the new toolbar is on" (a phone, behind the flag). */
  const panel = read(`${E}/post-event-scene-panel.tsx`);
  assert.match(panel, /const toolbar = useMaker\(\)\?\.stagesStudio === true;/);
  assert.match(read(`${L}/maker-shell.tsx`), /const ss = stagesStudio && phone;[\s\S]*?stagesStudio: ss,/);
  /* The picking is the panel's ONE `pickStyle` in both shapes — a pick posts what it always posted. */
  assert.equal(panel.split('onPick={pickStyle}').length - 1, 1);
  assert.equal(panel.split('<SceneStyleRow').length - 1, 1);
});

/* ── (5) a scene with no look ─────────────────────────────────────────── */

test('(5) a scene with no look to pick has a grey Style that says so — exactly the Post Event parts whose scene has no styles', () => {
  const POST_ONLY = (Object.keys(MAKER_PARTS) as MakerPartKey[]).filter((k) => (MAKER_PARTS[k].canvas ?? '').startsWith('p:'));
  assert.ok(POST_ONLY.length >= 12, `anti-vacuity: ${POST_ONLY.length} Post Event parts`);
  const none: MakerPartKey[] = [];
  for (const k of POST_ONLY) {
    const scene = makerPostEventSceneOf('editorial', k)!;
    const looks = postEventStyleOptions(scene, 'wedding').length;
    assert.equal(makerPartToolWorks(k, 'style'), looks >= 2, `${k} (${scene}): ${looks} look(s) — Style is ${makerPartToolWorks(k, 'style') ? 'live over empty rows' : 'grey over real cards'}`);
    if (looks < 2) {
      none.push(k);
      assert.equal(makerPartToolWhy(k, 'style'), 'Style has nothing to change on this part.');
    }
    /* Background and Animate stay as the shipped rule draws them: grey on a Post Event scene. */
    assert.equal(makerPartToolWorks(k, 'bg'), false);
    assert.equal(makerPartToolWorks(k, 'animate'), false);
    assert.equal(makerPartToolWorks(k, 'edit'), true);
  }
  /* (…and Were you there?, a part of its own since 2026-10-10 — (7).) */
  assert.deepEqual(none.sort(), ['beforeafter', 'next', 'song', 'wall', 'you']);
  assert.deepEqual([...MAKER_PARTS_NO_LOOK].sort(), ['beforeafter', 'next', 'song', 'spotlight', 'wall', 'you']);
});

/* ── (6) the ⓘ ────────────────────────────────────────────────────────── */

test('(6) what the scene is sits behind the toolbar’s one ⓘ — the panel’s own sentences, word for word', async () => {
  const { postEventAbout, postEventSceneOf } = await import(`../${L}/stage-panel/post-event-edit`);
  const { POST_EVENT_ABOUT } = await import(`../${E}/post-event-scene-panel`);
  const about = (tile: Tile) => postEventAbout(postEventSceneOf(raw({ tiles: [tile] }), tile.key as string), POST_EVENT_ABOUT);
  assert.equal(about(WISHES), POST_EVENT_ABOUT.written);
  assert.equal(about({ ...WISHES, status: 'waiting' }), POST_EVENT_ABOUT.waiting);
  /* The gallery: its style is one value with the section's, and its switch is shared with the day's chapters. */
  assert.equal(about({ ...WISHES, key: 'p:gallery', anchor: 'p:gallery', scene: 'gallery', switchKey: 'gallery', runKey: 'gallery' }), `${POST_EVENT_ABOUT.written} ${POST_EVENT_ABOUT.sharedStyle} ${POST_EVENT_ABOUT.galleryShare}`);
  assert.equal(postEventAbout(null, POST_EVENT_ABOUT), null);
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /const story = !rsvpOpen && picked && canvasOfScene \? postEventAbout\(postEventSceneNow\(canvasOfScene\), POST_EVENT_ABOUT\) : null;/);
  assert.match(tools, /\?\? story;\s*setStagePanelNow\(\{ picked, quiet, about(?:, line: rsvpLine)? \}\);/);
  /* …AND THE SCENE'S NAME STAYS WHOLE BESIDE IT. With the ⓘ the line has 88 px less room; "You're editing · Post Event ›
     Photo Notes" was 0.16 px too wide for it — under the browser's whole-pixel `scrollWidth`, so the line never stepped
     down and was drawn "PHOTO NOTE…" (measured on the lab, 2026-10-10: words 267.16 px, room 267). The words are
     measured to the fraction, against the room left inside the line's own padding. */
  assert.match(
    tools,
    /const words = el\?\.querySelector<HTMLElement>\('span\[aria-hidden\]'\);\s*if \(!el \|\| !words \|\| lineLevel >= linePieces\.length \|\| el\.scrollWidth > el\.clientWidth \+ 0\.5\) return;\s*const cs = getComputedStyle\(el\);\s*const room = el\.clientWidth - \(Number\.parseFloat\(cs\.paddingLeft\) \|\| 0\) - \(Number\.parseFloat\(cs\.paddingRight\) \|\| 0\);\s*if \(words\.getBoundingClientRect\(\)\.width > room \+ 0\.05\) setLineAt\(\(l\) => \(\{ key: lineKey, level: lineLevel \+ 1, n: l\.n \}\)\);\s*\}, \[lineKey, lineLevel, linePieces\.length, lineAt\.n\]\);/,
    'a line too wide by less than a pixel is cut again',
  );
});

/* ── (7) every scene the story can draw is a part ─────────────────────── */

/** A day that fills every scene the compiler can write (two chapters), so each one's shipped row can be read. */
const FULL_DAY: PostEventSources = {
  cover: 'day',
  milestones: 4,
  metrics: { photos: 486, guests: 32 },
  chapters: [
    { time: '15:00', title: 'The ceremony', leadId: 'c1', isClip: false, media: 42 },
    { time: '18:00', title: 'The reception', leadId: 'c2', isClip: false, media: 61 },
  ],
  galleryPhotos: 486,
  broadcast: true,
  films: 1,
  kwento: 14,
  challengeAnswers: 3,
  guestColumns: 3,
  vendorMedia: 9,
  team: 6,
  seatingTables: 4,
  entourage: 12,
  beforeAfter: true,
  liveWall: { active: true, photos: 20 },
  reviews: 2,
  services: 2,
  vendorsWeLoved: 2,
  specialMessage: true,
  song: 'A song',
  whatsNext: 'A honeymoon',
} as PostEventSources;

/** The ten, as the owner was told them: part key · the story's scene · its shipped name. */
const TEN: ReadonlyArray<readonly [MakerPartKey, string, string]> = [
  ['cover', 'cover', 'Front Page'],
  ['chapters', 'ch-1', 'Schedule'],
  ['pegallery', 'gallery', 'Gallery'],
  ['videos', 'videos', 'Videos'],
  ['letters', 'letters', 'Messages'],
  ['seating', 'seating', 'Where Everyone Sat'],
  ['entourage', 'entourage', 'Entourage'],
  ['couple', 'couple', 'Thank You'],
  ['loved', 'loved', 'Suppliers We Loved'],
  ['powered', 'powered', 'Powered by Setnayan'],
];

test('(7) every scene the story can draw is a part: the ten are picked by their shipped names and get the same Edit and Style', async () => {
  const { postEventSceneOf, postEventWordsFields } = await import(`../${L}/stage-panel/post-event-edit`);
  const rows = compilePostEventScenes(FULL_DAY, '2026-12-13T07:04:00Z').scenes;
  const rowOf = (scene: string) => rows.find((r) => r.key === scene)!;
  assert.ok(rows.length >= 20, `anti-vacuity: the full day compiles ${rows.length} scenes`);

  /* SYSTEMIC: no scene the compiler writes is without a part — the marker a tap on it names resolves to one. (The
     day's chapters share ONE marker, `p:ch-1` — `lib/maker-scene-list.ts` — and so one part.) */
  assert.match(read('lib/maker-scene-list.ts'), /const anchorScene = r\.block === 'chapters' \? 'ch-1' : r\.key;/);
  const named = new Map<string, MakerPartKey>();
  for (const r of rows) {
    const canvas = `p:${r.block === 'chapters' ? 'ch-1' : r.key}`;
    const part = makerPartOfCanvas('editorial', canvas);
    assert.ok(part, `${r.name} (${canvas}) is a scene of the story no part names — a tap on it picks nothing and Edit is empty`);
    named.set(r.key, part);
  }
  console.log(`# post event: ${rows.length} compiled scenes, each named by a part (${new Set(named.values()).size} parts)`);

  for (const [key, scene, name] of TEN) {
    const def = MAKER_PARTS[key];
    /* PICKED BY NAME — its marker, and the story's own word for it (read from the compiler, never retyped). */
    assert.equal(def.canvas, `p:${scene}`);
    assert.equal(makerPartCanvasOn('editorial', key), `p:${scene}`);
    assert.equal(makerPartOfCanvas('editorial', `p:${scene}`), key, `${name}: a tap on it picks another part`);
    assert.equal(makerPostEventSceneOf('editorial', key), scene);
    assert.equal(makerPartLabelOn('editorial', key), name);
    assert.equal(def.label, name);
    /* The story's name for it: the row's own — the chapters' is the name of the block when the day has none yet. */
    if (key === 'chapters') assert.equal(compilePostEventScenes({ ...FULL_DAY, chapters: [] }, '2026-12-13T07:04:00Z').scenes.find((r) => r.key === 'chapters')!.name, name);
    else assert.equal(rowOf(scene).name, name, `${key} does not wear its shipped name`);
    /* THE FOUR TOOLS — Edit live; Style its cards (each of the ten has a registry type with looks); Background and
       Animate as the shipped rule draws a Post Event scene: grey. */
    assert.equal(makerPartToolWorks(key, 'edit'), true);
    assert.equal(makerPartToolWorks(key, 'style'), true);
    assert.ok(postEventStyleOptions(scene, 'wedding').length >= 2, `${name} has no look cards and a live Style`);
    assert.equal(makerPartToolWorks(key, 'bg'), false);
    assert.equal(makerPartToolWorks(key, 'animate'), false);
    /* THE SAME EDIT — read through the one reader, from a tile built on the story's own row. */
    const row = rowOf(scene);
    const tile = { kind: 'post-event', key: `p:${row.key}`, anchor: `p:${scene}`, scene: row.key, label: row.name, status: row.status, hidden: false, drawn: true, position: 1, template: row.template, source: row.source, note: row.note, open: row.open, pinned: row.pin !== null, switchKey: row.switch, runKey: postEventRunKey(row.key) };
    const style = resolvePostEventStyle(row.key, undefined, 'wedding');
    const now = postEventSceneOf(raw({ tiles: [tile], styles: style ? { [row.key]: style } : {} }), `p:${scene}`);
    assert.ok(now, `${name} is not read as a scene`);
    assert.equal(now.switchKey, row.switch);
    assert.equal(now.runKey, postEventRunKey(row.key));
    /* Its words: exactly the parts its style draws (the panel's "Its parts"), the Heading first. */
    const drawn = postEventWordParts(row.key, style);
    assert.deepEqual(now.parts, ['heading', 'label', 'body'].filter((p) => drawn.includes(p as never)));
    assert.equal(postEventWordsFields(now, null, `p:${scene}`).length, drawn.length);
    /* …and ＋ can bring it back after "Shown to guests" is switched off (it is listed with the Post Event scenes). */
    assert.ok(MAKER_PART_GROUPS.find((g) => g.label === 'After the event')!.parts.includes(key), `${name} cannot be brought back with ＋`);
  }

  /* WHAT A COUPLE MAY DO TO EACH IS THE STORY'S OWN RULE — read here, never decided here. */
  const may = (scene: string) => ({ hide: rowOf(scene).switch !== null, move: postEventRunKey(rowOf(scene).key) !== null, pinned: rowOf(scene).pin });
  /* The Front Page opens the story: no switch, no move. Thank You closes it: it may be hidden, never moved. */
  assert.deepEqual(may('cover'), { hide: false, move: false, pinned: 'first' });
  assert.deepEqual(may('couple'), { hide: true, move: false, pinned: 'close' });
  /* POWERED BY SETNAYAN IS AN ORDINARY SCENE as shipped: its own switch (`poweredBy`), its own place in the run, no
     pin — a couple may hide it, move it and reword it. Nothing in the Maker locks it. */
  assert.deepEqual(may('powered'), { hide: true, move: true, pinned: null });
  assert.equal(rowOf('powered').switch, 'poweredBy');
  for (const s of ['ch-1', 'gallery', 'videos', 'letters', 'seating', 'entourage', 'loved']) assert.deepEqual(may(s), { hide: true, move: true, pinned: null }, s);

  /* WERE YOU THERE? — a part of its own: one look, so Style is grey on Post Event… */
  assert.equal(makerPartOfCanvas('editorial', 'p:you'), 'you');
  assert.equal(makerPartLabelOn('editorial', 'you'), 'Were you there?');
  assert.equal(postEventStyleOptions('you', 'wedding').length, 0);
  assert.equal(makerPartToolWorks('you', 'style'), false);
  assert.equal(makerPartToolWhy('you', 'style'), 'Style has nothing to change on this part.');
  assert.deepEqual(may('you'), { hide: false, move: false, pinned: null });
  /* …and THE DAY IS UNCHANGED: Photos of you keeps its three looks, its marker and its word, on every stage. */
  assert.equal(makerPartToolWorks('myphotos', 'style'), true);
  assert.equal(MAKER_PARTS.myphotos.canvas, 'f:photos_of_you');
  assert.equal(makerPartLabelOn('event', 'myphotos'), 'Photos of you');
  assert.equal(makerPostEventSceneOf('editorial', 'myphotos'), null);

  /* THE ENTRIES ARE AS SMALL AS THEY CAN BE (the map rides close to the Maker's first-load ceiling): nine are their
     scene's own key, written once; the two whose key is not their scene's are written out. */
  const map = read('lib/maker-parts.ts');
  assert.match(map, /const PE = \['cover', 'videos', 'letters', 'seating', 'entourage', 'couple', 'loved', 'powered', 'you'\] as const;/);
  assert.match(map, /\.\.\.\(Object\.fromEntries\(PE\.map\(\(s\) => \[s, pe\(s\)\]\)\) as Record<\(typeof PE\)\[number\], MakerPartDef>\),\s*chapters: pe\('ch-1'\),\s*pegallery: pe\('gallery'\),/);
});
