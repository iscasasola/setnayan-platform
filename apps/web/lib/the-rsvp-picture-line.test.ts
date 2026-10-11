/**
 * 🖼 THE RSVP PICTURE LINE — ＋ "Heading · Message · Picture" (owner's ruling 2026-10-09,
 * `Maker_RSVP_Per_Element_Add_Drag_Group_LOCKED_2026-10-09.md` § 3; prototype
 * `prototypes/maker_rsvp_add_drag_group_2026-10-09.html`), its four open points decided 2026-10-12 (DECISION_LOG):
 * (a) the shipped scene upload — the file is in the event's `scene-background` folder and counts in its 100 MB;
 * (b) FREE; (c) decorative, `alt=""`, no words; (d) a file that is gone draws nothing.
 *
 * This file holds the READER and the EDITS (the stored shape). The look, the drawing and the chooser have their own
 * sections below as they land.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RSVP_ADDED_PICTURE_MAX, readRsvpLook, rsvpAddedName, rsvpPictureRef, rsvpScreenLayout } from './rsvp-look';
import { rsvpLayoutEdit } from './rsvp-layout-edit';

const WEB = join(__dirname, '..');
const EVENT = '0b7c2c5e-1f0a-4e6b-9d55-6f1d2a3b4c5d';
const REF = `r2://setnayan-media/events/${EVENT}/scene-background/1c9a7f4e-2b3d-4e5f-8a9b-0c1d2e3f4a5b-garden.jpg`;

test('1 · the reader keeps a picture only with its file — a ref into an event’s own scene-background folder', () => {
  assert.equal(rsvpPictureRef(REF), REF);
  for (const bad of [
    undefined,
    '',
    'https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/events/x/scene-background/a.jpg',
    `r2://setnayan-thread-files/events/${EVENT}/scene-background/a.jpg`,
    `r2://setnayan-media/events/${EVENT}/our-photos/a.jpg`,
    `r2://setnayan-media/events/${EVENT}/scene-background/../payment-proof/a.jpg`,
    `r2://setnayan-media/events/${EVENT}/scene-background/a b.jpg`,
    `r2://setnayan-media/events/${EVENT}/scene-background/"]{}*{.jpg`,
    `r2://setnayan-media/events/not-a-uuid/scene-background/a.jpg`,
    `r2://setnayan-media/events/${EVENT}/scene-background/${'x'.repeat(RSVP_ADDED_PICTURE_MAX)}`,
    42,
  ]) {
    assert.equal(rsvpPictureRef(bad), null, `kept as a picture: ${String(bad).slice(0, 80)}`);
  }
  const look = readRsvpLook({
    look: {
      added: { rsvp: [{ id: 'p1', k: 'p', p: REF, t: 'words a picture never has' }, { id: 'p2', k: 'p' }, { id: 'p3', k: 'p', p: 'https://evil.example/x.jpg' }] },
      lines: { 'a:p1': { l: 'tall', c: '#aa0011', f: 'cinzel', s: 120, i: { fade: true } }, 'a:p2': { l: 'tall' } },
    },
  });
  /* Kept: its id, its kind, its file — no words. Not kept: a picture with no file, or a file that is not one. */
  assert.deepEqual(look.added, { rsvp: [{ id: 'p1', k: 'p', p: REF }] });
  /* Its look: Tall and a Build in — a picture has no colour, font or size. A look for a line not kept is not read. */
  assert.deepEqual(look.lines, { 'a:p1': { l: 'tall', i: { fade: true } } });
  /* `l` is the picture's alone: on a text line it is not read. */
  assert.deepEqual(readRsvpLook({ look: { added: { rsvp: [{ id: 'm1', k: 'm', t: 'x' }] }, lines: { 'a:m1': { l: 'tall', s: 120 } } } }).lines, { 'a:m1': { s: 120 } });
  /* …and it takes its place in the screen's list like any added line. */
  const items = rsvpScreenLayout(look, 'rsvp');
  assert.deepEqual(items?.map((i) => ('line' in i ? i.line : null)), ['eyebrow', 'question', 'yes', 'no', 'a:p1']);
});

test('2 · the cap holds the longest ref the shipped upload can mint', () => {
  /* `r2://setnayan-media/events/<uuid>/scene-background/` + `<uuid>-` + the upload route's longest file name. */
  const route = readFileSync(join(WEB, 'app/api/upload/route.ts'), 'utf8');
  const nameMax = Number(/const MAX_FILENAME_LEN = (\d+);/.exec(route)?.[1]);
  assert.ok(nameMax > 0, 'the upload route’s file-name cap was not found');
  assert.match(route, /const objectKey = `\$\{pathPrefix\}\/\$\{randomUUID\(\)\}-\$\{filename\}`;/);
  const longest = `r2://setnayan-media/events/${EVENT}/scene-background/${'1c9a7f4e-2b3d-4e5f-8a9b-0c1d2e3f4a5b'}-${'n'.repeat(nameMax)}`;
  assert.ok(longest.length <= RSVP_ADDED_PICTURE_MAX, `a ref of ${longest.length} characters would be dropped (cap ${RSVP_ADDED_PICTURE_MAX})`);
  assert.equal(rsvpPictureRef(longest), longest);
});

test('3 · the edits: a picture is added WITH its file (one edit), replaced as one edit, never given words', () => {
  const empty = rsvpLayoutEdit({}, { do: 'add', part: 'rsvp', kind: 'p', anchor: 'question', where: 'below' });
  assert.deepEqual(empty, { ok: false, why: 'no-picture' }, 'a picture line was stored without a picture');
  assert.deepEqual(rsvpLayoutEdit({}, { do: 'add', part: 'rsvp', kind: 'p', anchor: 'question', where: 'below', p: 'https://x/y.jpg' }), { ok: false, why: 'no-picture' });
  const added = rsvpLayoutEdit({}, { do: 'add', part: 'rsvp', kind: 'p', anchor: 'question', where: 'below', p: REF });
  assert.ok(added.ok);
  assert.deepEqual(added.look, { added: { rsvp: [{ id: '1', k: 'p', p: REF }] }, order: { rsvp: ['eyebrow', 'question', 'a:1', 'yes', 'no'] } });
  assert.equal(added.pick, rsvpAddedName('1'));
  const config = { look: added.look };
  const OTHER = REF.replace('garden', 'lanterns');
  const replaced = rsvpLayoutEdit(config, { do: 'picture', part: 'rsvp', line: 'a:1', p: OTHER });
  assert.ok(replaced.ok);
  assert.deepEqual((replaced.look as { added: unknown }).added, { rsvp: [{ id: '1', k: 'p', p: OTHER }] });
  assert.deepEqual(rsvpLayoutEdit(config, { do: 'picture', part: 'rsvp', line: 'a:1', p: 'nope' }), { ok: false, why: 'no-picture' });
  assert.deepEqual(rsvpLayoutEdit(config, { do: 'words', part: 'rsvp', line: 'a:1', text: 'a caption' }), { ok: false, why: 'not-there' });
  /* A text line is not a picture: Replace refuses it. */
  const text = rsvpLayoutEdit({}, { do: 'add', part: 'rsvp', kind: 'm', anchor: 'question', where: 'below' });
  assert.ok(text.ok);
  assert.deepEqual(rsvpLayoutEdit({ look: text.look }, { do: 'picture', part: 'rsvp', line: 'a:1', p: REF }), { ok: false, why: 'not-there' });
  /* …and it is taken off like any line the couple added. */
  const gone = rsvpLayoutEdit(config, { do: 'remove', part: 'rsvp', line: 'a:1' });
  assert.ok(gone.ok);
  assert.equal(gone.look, undefined);
});
