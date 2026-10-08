/**
 * studio-love-story-wears-the-timeline-row.test.ts — STUDIO › LOVE STORY IS WHEN · NAME · PICTURE.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 13): *"can also be love story form"* · *"add optional for the day it can be month and year only or month year
 * and day or year only"* · *"up to 3 media files."*
 *
 *   (1) THE ROW — when pill · the chapter's name · ONE picture square (with a count) · ⋯, on the app's ONE
 *       `TimelineRow` and ONE ticker; the when reads only as exact as it is; the list is in the order guests get.
 *   (2) A WHEN IS SAVED AS EXACTLY THE PARTS IT HAS — RUN through the moment door itself (`applyMomentIntent`): a
 *       month is never saved with a day, a year never with a month; every other field the chapter holds survives.
 *   (3) ONE SAVE PER PICK — rolling draws; the ONE moment form goes when the ticker closes, and only if it changed.
 *   (4) PHOTOS — three are offered (a chapter that holds four keeps four); photos only, nothing promises video; the
 *       shared `FileUpload` draws the slots with its own real progress; removing one is applied at the tap, a NEW
 *       one goes to the server into the DRAFT; a free couple meets the one Pro line.
 *   (5) ⋯ KEEPS EVERYTHING THE OPEN CARD HELD — the words (never emptied), More… (the shipped sheet), Move up /
 *       Move down (ONE `intent=order`), Remove.
 *   (6) ADD A CHAPTER — named in the row, then its words; unnamed is dropped; with no words it is NOT saved and
 *       says so; with both it is ONE `add` form.
 *   (7) A moment kept off the Event Hub says so on its row; this page writes exactly the accent classes listed.
 *   (8) THE WORD — an entry is a MOMENT; "chapter" is kept for the story's six sections, and never said of an entry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { applyMomentIntent, momentNeedsServer } from './love-story-moment-intent';
import { sortMoments, type LoveStoryMoment } from './love-story-moments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const STORY = 'app/dashboard/[eventId]/website/our-story/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const src = () => read(`${STORY}/moment-order-cards.tsx`);
const A = 'r2://setnayan-media/events/e1/love/a.jpg';
const B = 'r2://setnayan-media/events/e1/love/b.jpg';

const held: LoveStoryMoment = {
  id: 'm1',
  date: { y: 2021, m: 2, d: 14 },
  title: 'Our first trip',
  line: 'Baguio, on a bus that left at four in the morning.',
  place: 'Baguio',
  media: [A, B],
  added_by: 'Maria',
  anchor: 'together',
  hidden: true,
  order: 1,
  canvas: {},
};
const story: LoveStoryMoment[] = [
  { id: 'u', date: { y: 2019 }, title: 'One umbrella', line: 'A rainy Tuesday in Katipunan.', order: 0, media: [A, B], canvas: {} },
  { id: 't', date: { y: 2021, m: 2, d: 14 }, title: 'Our first trip', line: 'Baguio.', order: 1, canvas: {} },
  { id: 's', date: { y: 2022, m: 6 }, title: 'Siargao', line: 'He asked.', order: 2, hidden: true, canvas: {} },
];

async function paint(moments: LoveStoryMoment[], over: Record<string, unknown> = {}): Promise<string> {
  const { MomentOrderCards } = await import(`../${STORY}/moment-order-cards`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const action = async () => {};
  return renderToStaticMarkup(
    React.createElement(MomentOrderCards, {
      action,
      moments: sortMoments(moments),
      mediaUrls: { [A]: '/a.webp', [B]: '/b.webp' },
      sheet: { action, moments, partners: ['Maria', 'Jose'], ownsPro: true, storeShell: false, proHref: '/p', proPrice: null, eventId: 'ev-1', mediaUrls: {} },
      add: { can: true },
      ...over,
    }),
  );
}
const rowsOf = (html: string) => html.split(/(?=<li[^>]*data-moment-card=")/).slice(1).map((r) => r.slice(0, r.indexOf('</li>')));

test('(1) the row is when · name · ONE picture square · ⋯ — the when only as exact as it is, in the order guests get', async () => {
  const html = await paint(story);
  const rows = rowsOf(html);
  assert.deepEqual(rows.map((r) => /data-moment-card="([^"]+)"/.exec(r)![1]), ['u', 't', 's']);
  const u = rows[0]!;
  assert.match(u, /^<li[^>]*data-timeline-row="moment"/, 'a chapter is not the app’s Timeline row');
  const order = [/data-ticker-pill="when"/, /data-timeline-name=""/, /data-ticker-pill="photos"/, /data-studio-story-more="u"/].map((re) => u.search(re));
  assert.ok(order.every((n) => n > -1), `a part of the row is missing: ${order}`);
  assert.deepEqual([...order].sort((x, y) => x - y), order, 'the row is not when · name · picture · ⋯');
  // ONE square, however many photos — the count says how many.
  assert.equal((u.match(/data-ticker-pill="photos"/g) ?? []).length, 1);
  assert.match(u, /<button[^>]*aria-label="2 of 3 photos\. Tap to change"[^>]*data-ticker-pill="photos"[^>]*><img[^>]*src="\/a\.webp"[^>]*\/><span[^>]*data-moment-photo-count=""[^>]*>2</);
  assert.match(rows[1]!, /<button[^>]*aria-label="Add photos, up to 3"[^>]*data-ticker-pill="photos"/);
  assert.doesNotMatch(rows[1]!, /data-moment-photo-count/);
  // The when: a year · a month and year · a full date — never more exact than it is.
  assert.match(u, /data-ticker-pill="when"[^>]*>2019</);
  assert.match(rows[1]!, /data-ticker-pill="when"[^>]*>Feb 14, 2021</);
  assert.match(rows[2]!, /<button[^>]*aria-label="When: June 2022"[^>]*data-ticker-pill="when"[^>]*>Jun 2022</);
  assert.doesNotMatch(rows[2]!, /Jun 1, 2022|June 1/);
  // A chapter seeded from words that never had a date says "When" — no year is made up for it.
  const undated = rowsOf(await paint([{ id: 'x', line: 'We just knew.', canvas: {} }]))[0]!;
  assert.match(undated, /<button[^>]*aria-label="Set when this was"[^>]*data-ticker-pill="when"[^>]*>When</);
  assert.match(undated, /data-timeline-name=""[^>]*><span[^>]*>Name this moment</);
  // The order guests get: the couple's own order where they made one — not re-sorted over it here.
  const dragged = rowsOf(await paint([{ ...story[0]!, order: 1 }, { ...story[1]!, order: 0 }]));
  assert.deepEqual(dragged.map((r) => /data-moment-card="([^"]+)"/.exec(r)![1]), ['t', 'u']);
  const s = src();
  assert.doesNotMatch(s, /type=["'](?:time|date|month|datetime-local)["']|inputMode="numeric"/, 'the page has a date box of its own');
  assert.doesNotMatch(s, /snap-y|scroll-snap|overflow-y-scroll/, 'the page rolls a column of its own');
  assert.match(s, /const pickSheet = useContext\(PickSheetContext\);/);
  assert.match(read(`${STORY}/love-story-book.tsx`), /moments=\{sortMoments\(p\.moments\)\}/, 'the list is not in the order guests get');
});

test('(2) a when is saved as EXACTLY the parts it has — a month never with a day, a year never with a month — and nothing else is lost', async () => {
  const { momentEditForm } = await import(`../${STORY}/moment-order-cards`);
  const other: LoveStoryMoment = { id: 'm0', date: { y: 2019 }, line: 'One umbrella.', order: 0, canvas: {} };
  const save = (date: { y: number; m?: number; d?: number }) => {
    const r = applyMomentIntent([other, held], 'edit', momentEditForm(held, { date }));
    assert.ok(r.ok, 'the edit was refused');
    return r.ok ? r.after.find((m) => m.id === 'm1')! : held;
  };
  // Full date → Month: the day is GONE from what is stored (not 1, not the old 14).
  assert.deepEqual(save({ y: 2021, m: 6 }).date, { y: 2021, m: 6 });
  assert.deepEqual(momentEditForm(held, { date: { y: 2021, m: 6 } }).get('date_d'), null);
  // → Year: the month is gone too.
  assert.deepEqual(save({ y: 2020 }).date, { y: 2020 });
  assert.deepEqual([momentEditForm(held, { date: { y: 2020 } }).get('date_m'), momentEditForm(held, { date: { y: 2020 } }).get('date_d')], [null, null]);
  // → Full date again.
  assert.deepEqual(save({ y: 2020, m: 12, d: 31 }).date, { y: 2020, m: 12, d: 31 });
  // Every other field the chapter holds survives a rolled when — its name, words, place, photos, anchor, order…
  assert.deepEqual(save({ y: 2020 }), { ...held, date: { y: 2020 } });
  // …and a renamed chapter keeps its when exactly as exact as it was.
  const named = applyMomentIntent([other, { ...held, date: { y: 2021, m: 2 } }], 'edit', momentEditForm({ ...held, date: { y: 2021, m: 2 } }, { title: 'Baguio' }));
  assert.ok(named.ok && named.after[1]!.title === 'Baguio');
  assert.deepEqual(named.ok ? named.after[1]!.date : null, { y: 2021, m: 2 });
});

test('(3) one save per pick: rolling only draws; the ONE moment form goes when the ticker closes, and only if the when changed', () => {
  const s = src();
  assert.match(s, /onChange=\{\(when\) => setRolled\(\{ when, kept: false \}\)\}/, 'a roll does more than draw');
  assert.match(s, /data="when"[\s\S]{0,500}?onClosed=\{writeRolled\}/, 'the when is not written when its ticker closes');
  assert.match(s, /const r = rolled;\s*setRolled\(null\);\s*if \(!r \|\| \(sameWhen\(r\.when, m\.date\) && !\(r\.kept && !m\.date\)\)\) return;\s*void send\(momentEditForm\(m, \{ date: r\.when \}\)\);/);
  // Every write on this page is the moment action — nothing refreshes the route.
  assert.doesNotMatch(s, /router\.refresh|useRouter|requestMakerRefresh|'use server'|from '\.\.\/actions'/);
  assert.match(s, /return Promise\.resolve\(action\(fd\)\)\.catch\(/);
  // A refusal is SAID on the row; a server action's redirect is let through, never swallowed as a failure.
  assert.match(s, /if \(isRedirect\(e\)\) throw e;\s*setProblem\(whyNot\(e\)\);/);
  assert.match(s, /problem=\{problem\}/);
});

test('(4) photos: three offered (four kept), photos only, the shared FileUpload, removing is local and a new one goes to the server’s DRAFT', async () => {
  const { MOMENT_PHOTOS_OFFERED, MomentPhotos, momentPhotoSlots, momentEditForm } = await import(`../${STORY}/moment-order-cards`);
  const { MOMENT_MEDIA_MAX } = await import('./love-story-moments');
  assert.equal(MOMENT_PHOTOS_OFFERED, 3);
  assert.deepEqual([0, 1, 3].map(momentPhotoSlots), [3, 3, 3]);
  // A chapter that already holds four keeps all four — and the offer never passes what storage holds.
  assert.equal(momentPhotoSlots(4), 4);
  assert.ok(momentPhotoSlots(MOMENT_MEDIA_MAX) <= MOMENT_MEDIA_MAX, 'the slots outrun storage — that would need a migration');
  // Removing a photo is applied at the tap (no server); a NEW photo must go to the server, which screens it.
  assert.equal(momentNeedsServer([held], momentEditForm(held, { media: [A] })), false);
  assert.equal(momentNeedsServer([held], momentEditForm(held, { media: [] })), false);
  assert.equal(momentNeedsServer([held], momentEditForm(held, { media: [A, B, 'r2://setnayan-media/events/e1/love/c.jpg'] })), true);
  const less = applyMomentIntent([held], 'edit', momentEditForm(held, { media: [B] }));
  assert.deepEqual(less.ok ? less.after[0] : null, { ...held, media: [B] }, 'removing a photo changed something else');
  const s = src();
  // …and that server form is a DRAFT write that comes back to this page (never a live write by accident).
  assert.match(s, /const fd = momentEditForm\(m, \{ media: refs \}\);\s*fd\.set\(HUB_DRAFT_FIELD, '1'\);\s*if \(maker\) fd\.set\('return_to', `\/dashboard\/\$\{maker\.eventId\}\/launch\?tool=love-story`\);/);
  // ONE save for the whole visit to the slots — when they CLOSE — and none when nothing changed.
  assert.match(s, /const refs = picked\.current;\s*picked\.current = null;\s*if \(!refs \|\| sameList\(refs, media\)\) return;/, 'opening the slots writes');
  assert.match(s, /data="photos"[\s\S]{0,1200}?onClosed=\{savePhotos\}/, 'the photos are not kept when the slots close');
  assert.match(s, /onChange=\{\(refs\) => \(picked\.current = refs\)\}/, 'each finished upload is its own save');
  assert.equal((s.match(/momentEditForm\(m, \{ media: /g) ?? []).length, 1);
  // The slots ARE the shared upload — device → storage, its own measured progress; nothing hand-made here.
  assert.match(s, /<FileUpload\s+bucket="media"[\s\S]{0,400}?maxFiles=\{momentPhotoSlots\(media\.length\)\}[\s\S]{0,300}?variant="gallery"/);
  assert.doesNotMatch(s, /XMLHttpRequest|fetch\(|presign|conic-gradient|setInterval/, 'the page uploads or fakes progress itself');
  // PHOTOS ONLY: nothing on this page accepts, names or promises a video.
  assert.match(s, /acceptedTypes=\{\['image\/jpeg', 'image\/jpg', 'image\/png', 'image\/webp'\]\}/);
  assert.doesNotMatch(s, /video/i, 'the page promises video');
  // Painted: the sheet's one line; a couple without Pro meets the one Pro line and no upload.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const sheet = { action: async () => {}, moments: [held], partners: [], ownsPro: false, storeShell: false, proHref: '/pro', proPrice: null, eventId: 'ev-1', mediaUrls: {} };
  const free = renderToStaticMarkup(React.createElement(MomentPhotos, { m: held, sheet, mediaUrls: {}, onChange: () => {}, onDone: () => {} }));
  assert.match(free, />Up to 3 photos\. The first one shows first on your page\.</);
  assert.match(free, /data-love-story-pro-line="web"/);
  assert.doesNotMatch(free, /type="file"/);
  assert.match(free, /data-moment-photos-done=""[^>]*>Done</);
  const pro = renderToStaticMarkup(React.createElement(MomentPhotos, { m: held, sheet: { ...sheet, ownsPro: true }, mediaUrls: {}, onChange: () => {}, onDone: () => {} }));
  assert.match(pro, /type="file"/, 'a Pro couple has no upload in the slots');
  assert.doesNotMatch(pro, /data-love-story-pro-line/);
  // Said, never silent: changed slots are "not kept yet" until Done; the save itself says its words on the row —
  // never a percentage of its own.
  assert.match(s, /data-moment-photos-not-kept=""[^>]*>\s*Not kept yet — press Done\./);
  assert.match(s, /note=\{keeping \? 'Keeping your photos…' : /);
});

test('(5) ⋯ keeps everything the open card held: the words (never emptied), More…, Move up / Move down, Remove', async () => {
  const { movedOrder } = await import(`../${STORY}/moment-order-cards`);
  // One place up or down — every id, first to last; the ends do not move.
  assert.deepEqual(movedOrder(['a', 'b', 'c'], 'b', -1), ['b', 'a', 'c']);
  assert.deepEqual(movedOrder(['a', 'b', 'c'], 'b', 1), ['a', 'c', 'b']);
  assert.equal(movedOrder(['a', 'b', 'c'], 'a', -1), null);
  assert.equal(movedOrder(['a', 'b', 'c'], 'c', 1), null);
  assert.equal(movedOrder(['a', 'b', 'c'], 'zz', 1), null);
  // …and that list, through the moment door, IS the couple's own order.
  const moved = applyMomentIntent(story, 'order', (() => {
    const fd = new FormData();
    fd.set('order', movedOrder(['u', 't', 's'], 's', -1)!.join(','));
    return fd;
  })());
  assert.deepEqual(moved.ok ? sortMoments(moved.after).map((m) => m.id) : null, ['u', 's', 't']);
  const s = src();
  const editor = /<div data-studio-story-editor=\{m\.id\}[\s\S]*?\n          <\/div>\n        \) : null/.exec(s)?.[0] ?? '';
  assert.ok(editor, 'the ⋯ panel is gone');
  assert.match(s, /below=\{\s*open && !editing \? \(/);
  assert.match(s, /data-studio-story-more=\{m\.id\}\s*aria-expanded=\{open\}[\s\S]{0,200}?onClick=\{onOpen\}/);
  // The words — saved on leaving the box, and never emptied (a chapter needs a line).
  assert.match(editor, /<textarea[\s\S]{0,200}?aria-label="The words"[\s\S]{0,300}?onBlur=\{\(e\) => saveLine\(e\.target\.value\)\}/);
  assert.match(s, /if \(!text\) return setLine\(m\.line\);\s*if \(text !== m\.line\) void send\(momentEditForm\(m, \{ line: text \}\)\);/);
  // More… is the SHIPPED sheet for this moment (Where · Added by · This one is… · Keep off the Event Hub).
  assert.match(editor, /<MomentSheetStudio \{\.\.\.sheet\} moment=\{m\} trigger="More…"/);
  // Move up / Move down — each ONE intent=order; Remove — the moment door's delete.
  assert.match(editor, /data-studio-story-up=\{m\.id\} disabled=\{place <= 0\} onClick=\{\(\) => move\(-1\)\}/);
  assert.match(editor, /data-studio-story-down=\{m\.id\} disabled=\{place < 0 \|\| place >= ids\.length - 1\} onClick=\{\(\) => move\(1\)\}/);
  assert.match(editor, /fd\.set\('intent', 'delete'\);\s*fd\.set\('id', m\.id\);\s*void send\(fd\);/);
  // One ⋯ open at a time, one name open at a time — the page's state, not each row's.
  assert.match(s, /open=\{open === m\.id\}\s*onOpen=\{\(\) => setOpen\(\(cur\) => \(cur === m\.id \? null : m\.id\)\)\}/);
  assert.match(s, /editing=\{editing === m\.id\}/);
});

test('(6) Add a moment: named in the row, then its words — unnamed is dropped, wordless is NOT saved and says so, both = ONE add', async () => {
  const { momentAddForm } = await import(`../${STORY}/moment-order-cards`);
  // The one form, through the moment door: a new chapter exactly as exact as its when.
  const r = applyMomentIntent(story, 'add', momentAddForm({ when: { y: 2026, m: 10 }, title: 'The fitting', line: 'Her mother cried first.' }), () => 0.5);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.after.length, story.length + 1);
    assert.deepEqual({ date: r.touched!.date, title: r.touched!.title, line: r.touched!.line }, { date: { y: 2026, m: 10 }, title: 'The fitting', line: 'Her mother cried first.' });
  }
  // The door itself refuses a chapter with no words — so this page never sends one…
  const wordless = applyMomentIntent(story, 'add', momentAddForm({ when: { y: 2026, m: 10 }, title: 'The fitting', line: '' }), () => 0.5);
  assert.equal(wordless.ok, false);
  const s = src();
  assert.match(s, /const line = value\.trim\(\);\s*if \(!fresh \|\| !fresh\.title \|\| !line\) return;/, 'a chapter without words is sent');
  assert.equal((s.match(/momentAddForm\(/g) ?? []).length, 2, 'the add form is sent from more than one place');
  // …and it SAYS it is not saved (never a row that looks kept).
  assert.match(s, /data-studio-story-not-saved=""[^>]*>\s*Not saved yet — a moment needs a line or two\./);
  // Left unnamed — tapped out empty, or ✕ — the new row is dropped; nothing was ever sent.
  assert.match(s, /if \(!text && !fresh\.title\) return dropFresh\(\);/);
  assert.match(s, /onLeave=\{\(\) => \(fresh\.title \? setEditing\(null\) : dropFresh\(\)\)\}/);
  // It starts at THIS month and year (a when the couple sees and can roll), its name open.
  assert.match(s, /setFresh\(\{ when: \{ y: now\.getFullYear\(\), m: now\.getMonth\(\) \+ 1 \}, title: '' \}\);[\s\S]{0,200}?setEditing\(NEW_ROW\);/);
  // A refused add stays on screen and says why; a kept one leaves the local row.
  assert.match(s, /\.then\(\s*\(\) => setFresh\(null\),\s*\(e: unknown\) => setFreshProblem\(whyNot\(e\)\),\s*\)/);
  // Painted: the main button, and the free-stories line in its place once the cap is met.
  const html = await paint(story);
  assert.match(html, /<button[^>]*data-studio-add-moment=""[^>]*class="[^"]*\bbg-sn-accent text-sn-on-accent\b[^"]*"[^>]*>[\s\S]*?Add a moment</);
  const capped = await paint(story, { add: { can: false, line: 'Five of five free stories told' } });
  assert.doesNotMatch(capped, /data-studio-add-moment/);
  assert.match(capped, /data-love-story-cap="reached"[^>]*>Five of five free stories told</);
});

test('(7) a chapter kept off the Event Hub says so on its row; the page writes exactly the accent classes listed', async () => {
  const rows = rowsOf(await paint(story));
  assert.match(rows[2]!, /data-timeline-note=""[^>]*>Off the Event Hub — guests do not see this moment\.</);
  assert.doesNotMatch(rows[0]!, /data-timeline-note/);
  // THE ACCENT IS THE ONE TOKEN: the empty picture square's mark and ⋯ (never `mulberry`). Fills are `PILL_ON_CLASS`.
  assert.deepEqual([...src().matchAll(/[\w:!-]*(?:mulberry|sn-accent|sn-on-accent)[\w/-]*/g)].map((m) => m[0]), ['text-sn-accent', 'text-sn-accent']);
  assert.doesNotMatch(src(), /#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|ring|border)-(?:terracotta|gild|gold)\b/, 'a colour is written by hand');
  assert.match(rows[0]!, /data-studio-story-more="u"[^>]*class="[^"]*\btext-sn-accent\b/);
});

test('(8) the word: an entry is a MOMENT — "chapter" is said only of the story’s six sections', async () => {
  const html = await paint(story);
  const seen = html.replace(/<[^>]+>/g, ' ');
  const said = [...html.matchAll(/(?:aria-label|placeholder|title)="([^"]*)"/g)].map((m) => m[1]).join(' | ');
  // On a story with moments nothing a person reads or hears says "chapter".
  assert.doesNotMatch(seen, /chapter/i, 'a moment is called a chapter on the page');
  assert.doesNotMatch(said, /chapter/i, 'a moment is called a chapter to a screen reader');
  assert.match(seen, /3 moments/);
  assert.match(html, /aria-label="Your moments, in order"/);
  assert.match(html, /aria-label="More for One umbrella — its words, where, order, remove"/);
  // An empty story: the only "chapters" are the three real section names over the sample rows.
  const { LOVE_STORY_CHAPTER_LABEL } = await import('./love-story-moments');
  const empty = (await paint([])).replace(/<[^>]+>/g, ' ');
  assert.match(empty, /No moments yet\./);
  assert.doesNotMatch(empty, /chapter/i);
  for (const key of ['met', 'together', 'yes'] as const) assert.ok(empty.includes(LOVE_STORY_CHAPTER_LABEL[key]), `the sample lost the chapter “${LOVE_STORY_CHAPTER_LABEL[key]}”`);
  // In the source every string a person meets says "moment" (comments and the six sections' own names aside).
  const strings = [...src().matchAll(/(?:placeholder|nameLabel|aria-label|ariaLabel|title|label)=(?:"([^"]*)"|\{`([^`]*)`\})|'([^'\n]{12,})'|>\s*([A-Z][^<>{}\n]{10,})\s*</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
  assert.ok(strings.length > 12, `anti-vacuity: only ${strings.length} strings were read`);
  for (const text of strings) assert.doesNotMatch(text, /\bchapters?\b/i, `“${text}” calls a moment a chapter`);
});
