/**
 * the-pro-list-names-only-real-gates.test.ts — THE PRO LIST SAYS EVERYTHING PRO COVERS, AND NOTHING IT DOES NOT.
 *
 * Owner 2026-10-22, "Yes to all" (`Setnayan/prototypes/journey_fixes_2026-10-22.html` § Host 5, DECISION_LOG
 * "THE PRO LIST NAMES EVERY GATE"). The list a couple reads (`WEBSITE_PRO_ITEMS`) named nine things, while Pro also
 * gated six more elsewhere in the code — a host met each of them first at the Apply sheet. They joined the list in
 * the prototype's words, and the free "Editorial editing" left it. No gate moved.
 *
 * WHAT THIS HOLDS (each a property of the CODE, not of the words):
 *   1 · THE LIST IS THE DRAWN LIST, in the drawn order (the theme count is the registry's, never typed).
 *   2 · EVERY ADDED LINE NAMES A GATE THAT IS ON — read from the gate itself (`ART_KIT_IS_PRO`, `FREE_MOMENT_CAP`,
 *       `MAKER_EVENT_MEDIA_BYTES_CAP`, `isProPrint`, `isAllInOnePrint`, `HUB_ELEMENT_PRO_FIELDS`). Turn a gate off
 *       and this fails, telling you to take its line off the list (or to put the gate back) — never both silently.
 *       The numbers in two lines ("6th", "10 MB") are held to the constants they come from.
 *   4 · THE THREE LINES REWORDED LATER ON 2026-10-22 SAY THE GATE AS IT IS (owner, "Yes to all" — DECISION_LOG "THE PRO
 *       LIST SAYS THE REAL GATE"). Each is checked against the gate's BEHAVIOUR, not its name:
 *         · upload space — the line's figure is `coupleMediaCapBytes(true)` written the meter's way, and Pro's
 *           allowance is larger than Free's (else "more" is false). The line is computed, so a moved cap moves it;
 *           a hand-typed figure that drifts fails here;
 *         · Love Story photos — a free couple adding ONE photo to the FIRST story is refused ('photos_pro'), with no
 *           story-count in play; Pro is not. (The old line said only the 6th story's photos were Pro);
 *         · all-in-one downloads — the parts the line names are EXACTLY the pieces `isAllInOnePrint` refuses, read
 *           by asking the gate about every print piece. A new all-in-one file the line does not name fails; a named
 *           part the gate lets through for free fails. "Everything" is the union of the named parts, so it is not
 *           named on its own — but it must stay gated.
 *   3 · NO LINE NAMES SOMETHING FREE: while `EDITORIAL_PRO` is in `FREE_FOR_ALL_SKUS` no line says "editorial" —
 *       and if it ever stops being free, this fails the other way and asks for the line back.
 *
 * ⛔ NO PRICE. The list never carries one; the figure is `platform_retail_catalog_v2`'s, read at render.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): `ART_KIT_IS_PRO` flipped to false · `FREE_MOMENT_CAP` 5 → 6 ·
 * "Editorial editing" put back on the list · a drawn line dropped. Section 4 (#the-pro-list-says-the-real-gate):
 * Pro's cap set equal to Free's · the upload line hand-typed "500 MB" with the cap moved to 400 · the photo refusal
 * made to fire only past `FREE_MOMENT_CAP` · `seating-pack` dropped from `isAllInOnePrint` · `menu` added to it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRO_THEMES_ITEM, UPLOAD_SPACE_ITEM, WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';
import { ART_KIT_IS_PRO } from '@/lib/art-kit-pro';
import { FREE_MOMENT_CAP, momentCapRefusal, readMoment, type LoveStoryMoment } from '@/lib/love-story-moments';
import { coupleMediaCapBytes, formatMakerMediaMB } from '@/lib/maker-media-limits';
import { CLASSIC_PRINT_THEME, PRINT_PIECES, isAllInOnePrint, isProPrint } from '@/lib/print-pieces';
import { HUB_ELEMENT_PRO_FIELDS } from '@/lib/hub-look-pro';
import { PRO_THEMES, FREE_THEMES } from '@/lib/invite-themes';
import { FREE_FOR_ALL_SKUS } from '@/lib/entitlements';
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';

const items = WEBSITE_PRO_ITEMS as readonly string[];

/** The prototype's "Proposed" list, line for line (07-host5-pro-list.png). */
const DRAWN = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photo gallery',
  'Background music',
  'Photo and video backgrounds',
  PRO_THEMES_ITEM,
  'Animated logo',
  'Your logo on every QR code',
  'Style and animation for every part',
  'Decorations',
  'Photos in your Love Story',
  UPLOAD_SPACE_ITEM,
  'Print files in Pro themes',
  'All-in-one downloads — whole set, guest passes, QR sheet, place cards',
];

/** The all-in-one download line, and the part of it that names each piece the gate refuses. */
const DOWNLOADS_LINE = 'All-in-one downloads — whole set, guest passes, QR sheet, place cards';
const DOWNLOAD_PART: Record<string, string> = {
  set: 'whole set',
  passes: 'guest passes',
  'qr-codes': 'QR sheet',
  'seating-pack': 'place cards',
};
/** Every print the gate can be asked about: each piece, plus the two combined files the route serves. */
const EVERY_PRINT = [...Object.keys(PRINT_PIECES), 'set', 'everything'];
/** The all-in-one files that are the union of named parts — gated, but not named on their own. */
const UNION_OF_PARTS = new Set(['everything']);

/** A story as the one reader builds it (so it carries every required field); its photos are asserted to survive the read. */
const moment = (id: string, media?: string[]): LoveStoryMoment => {
  const m = readMoment({ id, line: `story ${id}`, ...(media ? { media } : {}) });
  assert.ok(m, `readMoment refused the probe story "${id}"`);
  assert.deepEqual(m.media ?? [], media ?? [], 'readMoment dropped the probe photo — the photo probe is blind');
  return m;
};
/** A photo a couple uploaded, as the story stores it (the one public bucket). */
const PHOTO = `r2://${PUBLIC_R2_BUCKET}/events/e1/love-story/photo.jpg`;


/** Each added line → is the gate it names ON, read from the gate. */
const GATES: Record<string, () => true | string> = {
  'Style and animation for every part': () =>
    (HUB_ELEMENT_PRO_FIELDS as readonly string[]).includes('motion') ||
    'HUB_ELEMENT_PRO_FIELDS no longer holds a part’s animation (motion) — the line sells a free thing',
  Decorations: () => ART_KIT_IS_PRO === true || 'ART_KIT_IS_PRO is off — decorations are free, take the line off',
  'Photos in your Love Story': () =>
    (momentCapRefusal({ before: [moment('a')], after: [moment('a', [PHOTO])], ownsPro: false }) === 'photos_pro' &&
      momentCapRefusal({ before: [moment('a')], after: [moment('a', [PHOTO])], ownsPro: true }) === null) ||
    'a free couple may add a photo to a story (momentCapRefusal) — the line sells a free thing',
  [UPLOAD_SPACE_ITEM]: () =>
    coupleMediaCapBytes(true) > coupleMediaCapBytes(false) ||
    `Pro's upload allowance (${formatMakerMediaMB(coupleMediaCapBytes(true))}) is not more than Free's — "More upload space" is false`,
  'Print files in Pro themes': () =>
    (PRO_THEMES.length > 0 && PRO_THEMES.every((t) => isProPrint(t.id)) && !isProPrint(CLASSIC_PRINT_THEME) && FREE_THEMES.every((t) => !isProPrint(t.id))) ||
    'isProPrint no longer splits Pro themes from free ones — the line misdescribes the print gate',
  [DOWNLOADS_LINE]: () =>
    (isAllInOnePrint('passes', 'print') && !isAllInOnePrint('pass', 'print')) ||
    'every guest’s pass in one file is no longer Pro (isAllInOnePrint) — the line misdescribes the gate',
};

test('1 · the Pro list is the drawn list, in the drawn order', () => {
  assert.ok(PRO_THEMES.length > 0, 'no Pro theme is shipped — the themes line would sell nothing');
  assert.deepEqual([...items], DRAWN, 'WEBSITE_PRO_ITEMS is not the list the owner approved on 2026-10-22');
});

test('2 · every line added on 2026-10-22 names a gate that is on', () => {
  const added = Object.keys(GATES);
  assert.equal(added.length, 6, 'the six gates — the table scanned short');
  for (const line of added) {
    assert.ok(items.includes(line), `"${line}" is gated in the code but missing from the list a couple reads`);
    const on = GATES[line]!();
    assert.equal(on, true, `"${line}": ${on}`);
  }
});

test('3 · no line names something every couple already has', () => {
  assert.ok(FREE_FOR_ALL_SKUS.size > 0, 'FREE_FOR_ALL_SKUS read empty — the check is blind');
  const editorialFree = FREE_FOR_ALL_SKUS.has('EDITORIAL_PRO');
  const named = items.some((i) => /editorial/i.test(i));
  if (editorialFree) {
    assert.equal(named, false, 'the Pro list names editorial editing, which FREE_FOR_ALL_SKUS gives every couple');
  } else {
    assert.equal(named, true, 'EDITORIAL_PRO is no longer free — Event Hub Pro covers it again, put its line back');
  }
  assert.ok(!items.some((i) => /colou?r/i.test(i)), 'the Pro list sells a colour, which is free');
  assert.ok(!items.some((i) => /₱|\bPHP\b/.test(i)), 'a price was written into the list — it is the catalogue’s');
});

test('4a · the upload line names Pro’s per-event allowance, read from the one cap function', () => {
  const pro = coupleMediaCapBytes(true);
  const free = coupleMediaCapBytes(false);
  assert.ok(pro > free, `Pro's allowance (${pro} B) is not more than Free's (${free} B) — "More upload space" is false`);
  assert.equal(
    UPLOAD_SPACE_ITEM,
    `More upload space — ${formatMakerMediaMB(pro)} per event`,
    'the upload line does not carry the allowance coupleMediaCapBytes(true) enforces',
  );
  // The figure in the sentence, read back as bytes, is the cap (within the meter's rounding).
  const said = /— ([\d.,]+) MB per event$/.exec(UPLOAD_SPACE_ITEM);
  assert.ok(said, `the upload line has no "<n> MB per event": ${UPLOAD_SPACE_ITEM}`);
  const saidBytes = Number(said![1]!.replace(/,/g, '')) * 1024 * 1024;
  assert.ok(Math.abs(saidBytes - pro) <= 0.5 * 1024 * 1024, `the line says ${said![1]} MB; Pro's allowance is ${pro} B`);
  assert.ok(!/\bover\b|per file|each file/i.test(UPLOAD_SPACE_ITEM), 'the gate is a per-event total, not a per-file size');
});

test('4b · "Photos in your Love Story" — a photo on ANY story is Pro, not only on a later one', () => {
  assert.ok(items.includes('Photos in your Love Story'));
  assert.ok(FREE_MOMENT_CAP > 1, 'the probe needs a story count well under the cap');
  // One story, one new photo — no story-count in play. A free couple is refused; Pro is not.
  const before = [moment('a')];
  const after = [moment('a', [PHOTO])];
  assert.equal(momentCapRefusal({ before, after, ownsPro: false }), 'photos_pro', 'a free couple may add a photo to their first story');
  assert.equal(momentCapRefusal({ before, after, ownsPro: true }), null, 'Pro is refused a photo');
  // And a free couple's words-only first story is NOT refused — the line is about photos, not stories.
  assert.equal(momentCapRefusal({ before: [], after: [moment('a')], ownsPro: false }), null, 'a free couple is refused a words-only story');
  assert.ok(!items.some((i) => /\b6th\b|\bsixth\b/i.test(i)), 'a line still says the photo gate starts at the 6th story');
});

test('4c · the all-in-one line names exactly the downloads the gate refuses', () => {
  assert.ok(items.includes(DOWNLOADS_LINE));
  const gated = EVERY_PRINT.filter((p) => isAllInOnePrint(p, 'print'));
  assert.ok(gated.length >= 4, `the gate refused only ${gated.length} prints — the probe is blind`);
  for (const p of gated) {
    if (UNION_OF_PARTS.has(p)) continue;
    assert.ok(DOWNLOAD_PART[p], `isAllInOnePrint refuses "${p}", and the Pro list does not name it`);
  }
  for (const u of UNION_OF_PARTS) assert.ok(isAllInOnePrint(u, 'print'), `"${u}" (all of the parts in one) is free — the gate moved`);
  for (const [p, part] of Object.entries(DOWNLOAD_PART)) {
    assert.ok(isAllInOnePrint(p, 'print'), `the Pro list names "${part}", but "${p}" downloads free — take it off the line`);
    assert.ok(DOWNLOADS_LINE.includes(part), `"${part}" is not in the line`);
  }
  // One at a time stays free (owner 2026-10-16): the single pass and each piece's own file.
  assert.equal(isAllInOnePrint('pass', 'print'), false, 'one guest’s pass is no longer free — the line undersells');
});
