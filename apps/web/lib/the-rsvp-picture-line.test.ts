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
import { RSVP_ADDED_PICTURE_MAX, RSVP_PICTURE_HEIGHT, readRsvpLook, rsvpAddedName, rsvpLookCss, rsvpLookWith, rsvpPictureRef, rsvpPictureRefs, rsvpScreenLayout } from './rsvp-look';
import { stripComments } from './strip-comments';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/* The pages' JSX is compiled for a global React under this runner (the house's way — `the-note-after-a-reply-is-todays-page.test.ts`). */
(globalThis as unknown as { React: unknown }).React = React;
import { rsvpLayoutEdit } from './rsvp-layout-edit';
import { rsvpPictureRefsIn } from './rsvp-picture-ref';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
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

test('4 · the Look: Wide is nothing stored (112 px, the picture’s own), Tall is one key and one fixed rule (176 px)', () => {
  assert.deepEqual(RSVP_PICTURE_HEIGHT, { wide: 112, tall: 176 });
  const base = { look: { added: { rsvp: [{ id: '1', k: 'p', p: REF }] } } };
  const tall = rsvpLookWith(base, 'a:1', { l: 'tall' });
  assert.deepEqual((tall as { lines: unknown }).lines, { 'a:1': { l: 'tall' } });
  assert.equal(rsvpLookCss(readRsvpLook({ look: tall }), ['rsvp'], []), '[data-rsvp-line="a:1"][data-rsvp-line]{height:176px;}');
  /* Back to Wide: the key goes, and so does the rule. */
  const wide = rsvpLookWith({ look: tall }, 'a:1', { l: null });
  assert.equal((wide as { lines?: unknown }).lines, undefined);
  assert.equal(rsvpLookCss(readRsvpLook({ look: wide }), ['rsvp'], []), '');
  /* A Build in rides with it, as on any line. */
  const moving = rsvpLookWith({ look: tall }, 'a:1', { i: { fade: true } });
  assert.match(rsvpLookCss(readRsvpLook({ look: moving }), ['rsvp'], []), /^\[data-rsvp-line="a:1"\]\[data-rsvp-line\]\{height:176px;--rl-o:/);
  /* The panel: Style on a picture is Look ▾ (Wide · Tall) — the RSVP rows' own dropdown — and nothing else. */
  const LOOK = src(`${L}/rsvp-line-look.tsx`);
  assert.match(LOOK, /<Dd\s+stacked\s+small="Look"\s+label="Look"\s+data="rsvp-picture-look"\s+value=\{value\}\s+options=\{RSVP_PICTURE_LOOKS\.map\(\(key\) => \(\{ key, label: RSVP_PICTURE_LOOK_NAME\[key\] \}\)\)\}\s+onPick=\{\(key\) => onPick\(\{ l: key === 'tall' \? 'tall' : null \}\)\}/);
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(PANEL, /<RsvpPictureLookRows line=\{pictureLine\} now=\{readRsvpLook\(local\)\.lines\?\.\[pictureLine\] \?\? \{\}\} onPick=\{\(patch\) => void save\(\{ look: rsvpLookWith\(latest\.current, pictureLine, patch\) \}, '“Look”'\)\} \/>/);
  /* The branch is taken for a picture the couple added — asked of the stored list, not of the page. */
  assert.match(PANEL, /const stylePicture = picked\.tool === 'style' && listPart && picked\.line && rsvpAddedIsPicture\(rsvpPlaceOf\(local, listPart, picked\.line\)\?\.added\);\s*if \(stylePicture && lookLine && lookLine\.startsWith\('a:'\)\) \{/);
  /* …asked BEFORE a text line's Font · Colour · Size, so a picture never gets those. */
  assert.ok(PANEL.indexOf('<RsvpPictureLookRows') < PANEL.indexOf('<RsvpLineLookRows'), 'a picture would be given a text line’s Style');
});

/* ── 5 · the drawing ───────────────────────────────────────────────────────── */

async function draw(items: unknown, opts: { canvas?: boolean; pictures?: Record<string, string> } = {}): Promise<string> {
  const { RsvpLines } = await import('../app/[slug]/_components/rsvp-lines');
  return renderToStaticMarkup(React.createElement(RsvpLines as never, { items, own: { question: React.createElement('p', { 'data-rsvp-line': 'question' }, 'Q') }, ...opts } as never));
}

test('5 · a guest sees the picture, decorative — and NOTHING for a file that is gone; the sample shows its name', async () => {
  const URL_ = 'https://signed.example/garden.jpg?sig=1';
  const look = readRsvpLook({ look: { added: { rsvp: [{ id: '1', k: 'p', p: REF }] }, order: { rsvp: ['eyebrow', 'question', 'a:1', 'yes', 'no'] } } });
  const items = rsvpScreenLayout(look, 'rsvp')!.filter((i) => 'line' in i && (i.line === 'question' || i.line === 'a:1'));
  /* A guest, the file signed: the picture, alt="" (decorative), the prototype's 112 px, nothing of the Maker's. */
  const guest = await draw(items, { pictures: { [REF]: URL_ } });
  assert.equal(guest, '<p data-rsvp-line="question">Q</p><img data-rsvp-line="a:1" src="https://signed.example/garden.jpg?sig=1" alt="" loading="lazy" decoding="async" class="my-2.5 block h-[112px] w-full rounded-[14px] object-cover"/>');
  /* A guest, the file gone (the page was handed no URL for it): nothing at all — no box, no broken image. */
  assert.equal(await draw(items), '<p data-rsvp-line="question">Q</p>');
  /* …and a group whose only line is a gone picture is not drawn either. */
  const grouped = readRsvpLook({ look: { added: { rsvp: [{ id: '1', k: 'p', p: REF }] }, groups: { rsvp: [{ id: 'g1', of: ['a:1'] }] } } });
  const groupItems = rsvpScreenLayout(grouped, 'rsvp')!.filter((i) => !('line' in i));
  assert.equal(groupItems.length, 1);
  assert.equal(await draw(groupItems), '');
  /* The Maker's sample: the picture, named for the canvas — or, with no file to draw, its name in a quiet box. */
  assert.match(await draw(items, { canvas: true, pictures: { [REF]: URL_ } }), /<img data-rsvp-line="a:1" data-rsvp-added="p" data-rsvp-picture="r2:\/\/setnayan-media\/events\/[^"]+-garden\.jpg" src=/);
  assert.match(await draw(items, { canvas: true }), /<p data-rsvp-line="a:1" data-rsvp-added="p" data-rsvp-empty="" data-rsvp-picture="[^"]+" class="[^"]*bg-ink\/\[0\.06\][^"]*">Picture<\/p>/);
});

test('6 · the pages sign the files once, a gone file is left out, and every place a guest replies is handed them', () => {
  const SIGN = src('lib/rsvp-pictures.server.ts');
  assert.match(SIGN, /^import 'server-only';/m);
  assert.match(SIGN, /if \(refs\.length === 0 \|\| !isR2Configured\(\)\) return \{\};/, 'a config with no picture would cost a request');
  assert.match(SIGN, /const head = await r2HeadOutcome\(\{ bucket: R2_BUCKETS\.media, key: ref\.slice\(PUBLIC_PREFIX\.length\) \}\);\s*if \(head\.kind === 'absent'\) return;\s*const url = await displayUrlForStoredAsset\(ref\);\s*if \(url\) urls\[ref\] = url;/);
  /* Read by the one strict reader — only refs into an event's own scene-background folder are ever signed. */
  assert.match(SIGN, /const refs = rsvpPictureRefs\(config\);/);
  assert.deepEqual(rsvpPictureRefsIn({ look: { added: { rsvp: [{ id: '1', k: 'p', p: REF }, { id: '2', k: 'm', p: REF.replace('garden', 'x') }] } } }), [REF]);
  assert.deepEqual(rsvpPictureRefs({ look: { added: { rsvp: [{ id: '1', k: 'p', p: REF }], nonote: [{ id: '2', k: 'p', p: REF }, { id: '3', k: 'p', p: 'https://x/y.jpg' }] } } }), [REF]);
  /* 🔒 Apply holds a picture that is not an upload into THIS event's own folder (a draft is a public POST). */
  const APPLY = src('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(APPLY, /if \(item\.kind === 'event' && item\.column === 'rsvp_ask_config' && rsvpPictureRefsIn\(item\.value\)\.some\(\(r\) => !r\.startsWith\(ownScenePrefix\)\)\) \{\s*if \(!item\.freePart\) held\.push\(\{ item, reason: 'not_your_photo' \}\);\s*continue;/);
  assert.match(APPLY, /const ownScenePrefix = `r2:\/\/\$\{PUBLIC_R2_BUCKET\}\/events\/\$\{eventId\}\/\$\{SCENE_BACKGROUND_FOLDER\}\/`;/);
  for (const [page, call] of [
    ['app/[slug]/invite/reply/page.tsx', /lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), 'rsvp'\)\}\s*pictures=\{rsvpPictures\}/],
    ['app/[slug]/invite/enter/page.tsx', /lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), reply === 'no' \? 'nonote' : 'yesnote'\)\}\s*pictures=\{rsvpPictures\}/],
    ['app/[slug]/_components/site-body.tsx', /lines=\{rsvpScreenLayout\(readRsvpLook\(event\.rsvp_ask_config\), 'rsvp'\)\}\s*pictures=\{rsvpPictures\}/],
  ] as const) {
    const PAGE = src(page);
    assert.match(PAGE, /const rsvpPictures = await signRsvpPictures\(event\.rsvp_ask_config\);/, `${page} does not sign its pictures`);
    assert.match(PAGE, call, `${page} does not hand its pictures to the lines`);
  }
  /* The widget and the note pass them on to the one drawer. */
  assert.match(src('app/[slug]/_components/rsvp-widget.tsx'), /canvas=\{previewEveryQuestion\}\s*pictures=\{pictures\}/);
  assert.equal((src('app/[slug]/_components/rsvp-note-lines.tsx').match(/pictures=\{pictures\}/g) ?? []).length, 2);
});

test('7 · the Maker’s canvas draws a picture the moment it is added — from its local address, or the page’s own', () => {
  const ARRANGE = src(`${L}/rsvp-canvas-arrange.ts`);
  assert.match(ARRANGE, /if \(line\.added\.k === 'p'\) return pictureNode\(line\.line, line\.added\.p\);/);
  assert.match(ARRANGE, /const local = rsvpPictureUrl\(ref\);\s*const same = was && was\.getAttribute\('data-rsvp-picture'\) === ref && \(was\.tagName === 'IMG' \|\| !local\);/);
  assert.match(ARRANGE, /img\.alt = '';/);
  /* A picture the couple took off goes from the canvas like any added line (not only a `<p>`). */
  assert.match(ARRANGE, /box\.querySelectorAll<HTMLElement>\('\[data-rsvp-added\]'\)\.forEach\(\(p\) => \{\s*if \(!kept\.has\(p\)\) p\.remove\(\);/);
  assert.match(src(`${L}/rsvp-list-stage.tsx`), /box\.querySelectorAll\('\[data-rsvp-added\]'\)\.length >= RSVP_ADDED_MAX/);
});

/* ── 8 · the chooser ───────────────────────────────────────────────────────── */

test('8 · ＋ › Picture: the shipped scene upload FIRST, then ONE add that carries the file; Edit › Replace is one edit', () => {
  const LIST = src(`${L}/rsvp-line-list.tsx`);
  /* (a) the shipped scene upload: the app's uploader, the media bucket, this event's scene-background folder, compressed. */
  assert.match(LIST, /<FileUpload\s+bucket="media"\s+pathPrefix=\{sceneBackgroundPathPrefix\(eventId\)\}\s+multiple=\{false\}\s+maxSizeMB=\{100\}\s+acceptedTypes=\{PICTURE_UPLOAD_TYPES\}\s+compressImage/);
  assert.match(LIST, /const PICTURE_UPLOAD_TYPES = \['image\/jpeg', 'image\/jpg', 'image\/png', 'image\/webp'\];/);
  /* It saves nothing itself: the landed ref is handed on, and the file the couple picked is shown at once. */
  assert.match(LIST, /if \(local\.current\) keepRsvpPictureUrl\(ref, local\.current\);\s*onPicture\(ref\);/);
  assert.doesNotMatch(LIST.slice(LIST.indexOf('export function RsvpPictureSheet'), LIST.indexOf('export function RsvpPictureEditRows')), /askRsvpListEdit|hubDraftAction|makerSave/);
  /* ＋ › Picture opens the chooser instead of adding; the chooser's ref makes the ONE add. */
  const STAGE = src(`${L}/rsvp-list-stage.tsx`);
  assert.match(STAGE, /if \(kind === 'p'\) return setPicturing\(adding\);\s*askRsvpListEdit\(\{ do: 'add', part: listPart, kind, anchor: line, where: adding \}\);/);
  assert.match(STAGE, /onPicture=\{\(ref\) => \{\s*setPicturing\(null\);\s*askRsvpListEdit\(\{ do: 'add', part: listPart, kind: 'p', anchor: line, where: picturing, p: ref \}\);/);
  /* Edit on a picture: Replace — one `picture` edit — and the same last row; no words box (decorative). */
  const PANEL = src(`${L}/maker-rsvp-ask.tsx`);
  assert.match(PANEL, /if \(picked\.tool === 'edit' && listPart && picked\.line && addedLine && rsvpAddedIsPicture\(addedLine\)\) \{[\s\S]{0,300}<RsvpPictureEditRows key=\{line\} eventId=\{eventId\} onReplace=\{\(ref\) => askRsvpListEdit\(\{ do: 'picture', part: listPart, line, p: ref \}\)\} \/>[\s\S]{0,200}\{placeRow\}/);
  assert.match(PANEL, /if \(picked\.tool === 'edit' && listPart && picked\.line && addedLine && !rsvpAddedIsPicture\(addedLine\)\) \{/);
  /* (b) FREE: nothing about a picture is gated — no Pro mark, no Pro check, in the chooser or the edit. */
  assert.doesNotMatch(LIST, /PaidMark|makerPro|ownsPro/);
});
