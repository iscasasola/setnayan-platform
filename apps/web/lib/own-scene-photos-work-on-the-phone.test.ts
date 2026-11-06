/**
 * apps/web/lib/own-scene-photos-work-on-the-phone.test.ts
 *
 * 🖼 A SCENE OF THEIR OWN'S PICTURES WORK ON THE PHONE (owner 2026-10-18, on a "Your own section" made from template 20,
 * Photo strip: *"is this the one where you add scenes? we already have the templates, just make them work"*). #6616
 * made its Heading and Words editable in Edit; its pictures could be put in only on a desktop. Held here, for EVERY
 * template that has picture slots (15 of the 25 — read off `SCENE_TEMPLATES`, never a list kept here):
 *
 *   P1  the Maker's canvas draws every slot the template has, in the template's own section, each marked with its index
 *       (`data-scene-slot`) — an empty one as the template's box with "＋ Photo" / "＋ Clip", a filled one as the
 *       picture a guest sees; a GUEST gets no box and no mark (only the pictures that resolved — unchanged);
 *   P2  an EMPTY scene of their own's placeholder shows those slot boxes (the template's places) — and none for a
 *       template with no pictures;
 *   P3  a pick is the desktop's slot rule on the Maker's copy: a photo in, a clip in (as a clip), taken off; the same
 *       picture again sends nothing; the template and every other slot are kept;
 *   P4  a tap on a slot opens it: the bridge names the slot, the toolbar opens Edit with that slot's sheet, Edit's row 3
 *       is the Photos row; the sheet is the app's own uploader into the event's scene folder;
 *   P5  ✓ Apply keeps a slot picture uploaded into THIS event's scene folder (it was held as "not your photo"), and
 *       the couple's uploads list offers it again after the refresh;
 *   P6  the write is the one draft door, whole canvas, with its base, redrawn in place (never a Maker render).
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { SCENE_TEMPLATES, SCENE_TEMPLATE_IDS } from './scene-templates';
import { sceneUploadRefs } from './scene-media-choices';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup;
let renderScene: typeof import('../app/[slug]/_components/scene-template').renderScene;
let empty: typeof import('../app/[slug]/_components/maker-empty-scene');
let photos: typeof import('./scene-slot-pick');
before(async () => {
  ({ renderToStaticMarkup } = await import('react-dom/server'));
  ({ renderScene } = await import('../app/[slug]/_components/scene-template'));
  empty = await import('../app/[slug]/_components/maker-empty-scene');
  photos = await import('./scene-slot-pick');
});

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const WITH_PICTURES = SCENE_TEMPLATE_IDS.filter((id) => SCENE_TEMPLATES[id].media > 0);
const NO_PICTURES = SCENE_TEMPLATE_IDS.filter((id) => SCENE_TEMPLATES[id].media === 0);
const EV = 'e-1';
const UP = `r2://${PUBLIC_R2_BUCKET}/events/${EV}/scene-background/one.jpg`;
const URLS = { [UP]: 'https://media.example/one.jpg' };
const draw = (template: number, slots: unknown[] = [], makerSlots?: boolean) =>
  renderToStaticMarkup(
    renderScene({ canvas: { template, slots } as never, words: { title: 'Our places', body: '' }, mediaUrls: URLS, makerSlots, sceneClipsOpen: true }) ?? React.createElement('i'),
  );
const marks = (html: string) => [...html.matchAll(/data-scene-slot="(\d)"/g)].map((m) => Number(m[1]));

test('the scan sees the templates: 15 take pictures (two of them clips), 10 do not', () => {
  assert.equal(WITH_PICTURES.length, 15, `templates with pictures: ${WITH_PICTURES.join(',')}`);
  assert.deepEqual(WITH_PICTURES.filter((id) => SCENE_TEMPLATES[id].clip), [5, 14]);
  assert.equal(NO_PICTURES.length, 10);
});

test('P1 — the Maker draws every slot of every picture template, in place and marked; a guest gets no box and no mark', () => {
  for (const id of WITH_PICTURES) {
    const t = SCENE_TEMPLATES[id];
    const all = Array.from({ length: t.media }, (_, i) => i);
    // Empty: one box per slot, each marked and empty, with its "＋".
    const bare = draw(id, [], true);
    assert.deepEqual(marks(bare), all, `template ${id}: the Maker does not draw every slot`);
    assert.equal((bare.match(/data-scene-slot-empty=""/g) ?? []).length, t.media, `template ${id}: an empty slot is not drawn as empty`);
    assert.match(bare, new RegExp(`＋ ${t.clip ? 'Clip' : 'Photo'}`), `template ${id}: the empty box says nothing`);
    assert.match(bare, new RegExp(`data-scene-template="${id}"`), `template ${id}: not the template's own section`);
    // The first slot filled: its picture, still marked, not empty — the rest still boxes.
    const one = draw(id, [{ media: UP }], true);
    assert.deepEqual(marks(one), all, `template ${id}: a filled slot lost its mark`);
    assert.match(one, /<figure class="hub-tpl-m" data-scene-slot="0"><img[^>]*src="https:\/\/media\.example\/one\.jpg"/, `template ${id}: the picture is not in slot 1`);
    assert.equal((one.match(/data-scene-slot-empty=""/g) ?? []).length, t.media - 1, `template ${id}: the filled slot is drawn as empty`);
    // A guest: the picture, no box, no mark — exactly as before.
    const guest = draw(id, [{ media: UP }]);
    assert.deepEqual(marks(guest), [], `template ${id}: a guest's page carries the Maker's slot marks`);
    assert.doesNotMatch(guest, /＋|data-scene-slot-empty/, `template ${id}: a guest sees an empty box`);
    assert.equal((guest.match(/<figure/g) ?? []).length, 1, `template ${id}: a guest sees more than the one picture`);
  }
});

test('P2 — an empty scene of their own shows its template’s slot boxes; a template with no pictures shows none', () => {
  for (const id of WITH_PICTURES) {
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, empty.makerOwnSlots('custom_1', { canvas: { template: id } })));
    assert.equal(marks(html).length, SCENE_TEMPLATES[id].media, `template ${id}: the placeholder does not show its slots`);
    const placeholder = renderToStaticMarkup(
      React.createElement(empty.MakerEmptyScene, { type: 'custom_1', ownSlots: empty.makerOwnSlots('custom_1', { canvas: { template: id } }) }),
    );
    assert.match(placeholder, /data-maker-own-slots=""/, `template ${id}: the placeholder does not carry the slots`);
    assert.match(placeholder, /data-scene-slot="0"/);
  }
  for (const id of NO_PICTURES) {
    const slots = empty.makerOwnSlots('custom_1', { canvas: { template: id } });
    assert.equal(renderToStaticMarkup(React.createElement(React.Fragment, null, slots)).includes('data-scene-slot'), false, `template ${id}: a slot box on a template with no pictures`);
  }
  assert.equal(empty.makerOwnSlots('special_message', { canvas: { template: 20 } }), null, 'a fixed scene got own-scene slots');
});

test('P3 — a pick is the desktop’s slot rule on the Maker’s copy, and the same picture again sends nothing', () => {
  for (const id of WITH_PICTURES) {
    const t = SCENE_TEMPLATES[id];
    const last = t.media - 1;
    const before = { template: id, preset: 'calm', slots: [{ media: 'r2://setnayan-media/events/e-1/x/keep.jpg' }] } as never;
    const put = photos.slotCanvasNext(before, last, { media: UP });
    assert.ok(put, `template ${id}: a photo into slot ${last + 1} changed nothing`);
    assert.equal(put.template, id, 'the template was lost');
    assert.equal(put.slots?.[last]?.media, UP, `template ${id}: the photo is not in its slot`);
    if (last > 0) assert.equal(put.slots?.[0]?.media, 'r2://setnayan-media/events/e-1/x/keep.jpg', 'another slot was lost');
    assert.equal(photos.slotCanvasNext(put, last, { media: UP }), null, 'the same picture again is a write');
    const clip = photos.slotCanvasNext(before, 0, { media: UP, kind: 'snippet' });
    assert.equal(clip?.slots?.[0]?.kind, 'snippet', 'a clip was not put in as a clip');
    const off = photos.slotCanvasNext(put, last, { media: '' });
    assert.equal(off?.slots?.[last]?.media, undefined, `template ${id}: Take it off left the picture`);
  }
  // The names are the desktop panel's words.
  assert.equal(photos.slotName(20, 1), 'Photo 2');
  assert.equal(photos.slotName(13, 0), 'Photo');
  assert.equal(photos.slotName(14, 0), 'Clip');
  assert.equal(photos.slotTakesClips(20), false, 'a group of photos offered clips');
  assert.equal(photos.slotTakesClips(1), true);
});

test('P4 — a tap on a slot opens it: the bridge names it, the toolbar opens Edit with its sheet, row 3 is Photos', () => {
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /closest\?\.\('\[data-scene-slot\]'\)\?\.getAttribute\('data-scene-slot'\)/, 'the bridge does not name the tapped slot');
  assert.match(bridge, /t: 'edit', key, el: part\.getAttribute\('data-el'\), \.\.\.empty, \.\.\.moment, \.\.\.slot \}/);
  assert.match(bridge, /t: 'edit', key, \.\.\.empty, \.\.\.moment, \.\.\.slot \}/);
  const tools = read('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /setSlotAsk\(\(was\) => \(\{ type: ownType, slot: Number\(slot\), n: \(was\?\.n \?\? 0\) \+ 1 \}\)\);\s*setToolRef\.current\('edit'\);\s*askTool\('edit', k\);/, 'a slot tap does not open Edit with its sheet');
  assert.match(tools, /last=\{ownPhotoRow\}/, 'Edit does not carry the Photos row');
  assert.match(tools, /<ScenePhotoRow ask=\{askPartOps\} type=\{ownPhotoType\}[^>]*open=\{slotAsk\?\.type === ownPhotoType \? slotAsk : null\}/);
  const edit = read('app/dashboard/[eventId]/launch/_components/stage-panel/stage-edit.tsx');
  assert.match(edit, /slice\(0, second \? 1 : last \? WORDS_ROW\.length - 1 : WORDS_ROW\.length\)/, 'the words do not leave row 3 to the Photos');
  const row = read('app/dashboard/[eventId]/launch/_components/stage-panel/scene-photos.tsx');
  assert.match(row, /row-start-3/, 'the Photos row is not row 3');
  assert.match(row, /<FileUpload[\s\S]{0,80}pathPrefix=\{sceneBackgroundPathPrefix\(eventId\)\}[\s\S]{0,120}compressImage/, 'the sheet is not the app’s uploader into the scene folder');
  assert.match(row, /<MakerSheet label=\{name\}/, 'the sheet is not the Maker’s one sheet');
  assert.match(row, /label="Take it off"/);
  assert.match(read('app/dashboard/[eventId]/launch/_components/details-lazy.tsx'), /export const ScenePhotoRow = dynamic\(\(\) => import\(\s*'\.\/stage-panel\/scene-photos'\)/, 'the Photos row rides the Maker’s first load');
});

test('P5 — Apply keeps a slot picture uploaded into this event’s scene folder; the uploads list offers it again', () => {
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /const slotIsOwn = \(ref: string\) => ownRefs\.has\(ref\) \|\| ref\.startsWith\(ownScenePrefix\);/, 'a slot is held to the gallery alone again');
  assert.match(apply, /slotRefs\.some\(\(r\) => !slotIsOwn\(r\)\)/);
  assert.doesNotMatch(apply, /slotRefs\.some\(\(r\) => !ownRefs\.has\(r\)\)/);
  const listed = sceneUploadRefs(EV, [{ canvas: { template: 20, slots: [{}, { media: UP }] } }, { canvas: { template: 20, slots: [{ media: 'r2://setnayan-media/events/other/scene-background/x.jpg' }] } }]);
  assert.deepEqual(listed.map((u) => u.ref), [UP], 'a slot upload is not offered again (or another event’s is)');
});

test('P6 — the write: the one draft door, the whole canvas with its base, held and redrawn in place', () => {
  const row = read('app/dashboard/[eventId]/launch/_components/stage-panel/scene-photos.tsx');
  assert.match(row, /makerRedrawSave\(\s*\(\) =>\s*makerLatestWrite\(canvasWriteKey\(type\)/, 'not the held, redrawn save');
  assert.match(row, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ widgets: \{ \[type\]: \{ canvas: next \} \} \}\)\);\s*sendCanvasBase\(fd, type, srv, next\);/, 'not the whole canvas with its base');
  assert.match(row, /forgetCanvasSent\(type\);/, 'a refused send is not forgotten');
  assert.doesNotMatch(row, /router\.refresh|makerSave\(/, 'a slot pick re-renders the whole Maker');
});
