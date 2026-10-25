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
 *         · all-in-one downloads — superseded by § 5 the same day (the line is now "One download of the whole designed
 *           set", held to `isAllInOnePrint` both ways in 4c).
 *   3 · NO LINE NAMES SOMETHING FREE: while `EDITORIAL_PRO` is in `FREE_FOR_ALL_SKUS` no line says "editorial" —
 *       and if it ever stops being free, this fails the other way and asks for the line back.
 *
 *   5 · FREE IS READY, PRO IS PERSONAL (owner 2026-10-22, verbatim: *"the goal of the free is to keep everything minimum ready
 *       but no personalization."* · *"they pay to customize it."* · *"my issue is the data storage if i keep accepting free photos
 *       which uses more data."* — DECISION_LOG "FREE IS READY, PRO IS PERSONAL — ALL TICKETS AND THE QR SHEET ARE FREE"). Four lines
 *       were reworded and ONE gate moved: every guest's ticket in one file (`passes`) and the Guest QR sheet (`qr-codes`) are FREE.
 *         · the list matches the gates BOTH WAYS: "One download of the whole designed set" is exactly the set `isAllInOnePrint`
 *           refuses (the whole set, Everything, the place-card pack) — a gated file the line does not cover fails, and so does a
 *           free one it does; the two free files are refused in NO mode;
 *         · a free event's prints are PLAIN WHITE (`printLookForEvent` hands it `plainPrintLook()` and never reads the Hub), so a
 *           free all-tickets file is ready, not personal — and "Prints in your Event Hub look" names the one thing Pro adds;
 *         · "Photos in your Love Story, and more than 5 moments" — its number IS `FREE_MOMENT_CAP` (computed), the 6th story is
 *           refused to a free couple, the 5th is not, a photo on the first is;
 *         · route level (`all-in-one-prints-are-pro.test.ts`): a free event's every-guest passes and QR sheet are served, and
 *           Everything is still refused.
 *         · 5d · THE DIGITAL TICKET ZIP IS FREE too (owner "yes", later on 2026-10-22, DECISION_LOG "THE DIGITAL TICKET ZIP IS
 *           FREE" — every guest's ticket picture, for sending by phone; it is how couples hand out tickets). No Pro line names a
 *           ticket or a zip, and the zip route is CALLED for a free event (`all-in-one-prints-are-pro.test.ts` § 1d): no Pro
 *           question, then the one kit whose look is § 5b's door — plain white free, the Hub look on Pro.
 *
 * ⛔ NO PRICE. The list never carries one; the figure is `platform_retail_catalog_v2`'s, read at render.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): `ART_KIT_IS_PRO` flipped to false · `FREE_MOMENT_CAP` 5 → 6 ·
 * "Editorial editing" put back on the list · a drawn line dropped. Section 4 (#the-pro-list-says-the-real-gate):
 * Pro's cap set equal to Free's · the upload line hand-typed "500 MB" with the cap moved to 400 · the photo refusal
 * made to fire only past `FREE_MOMENT_CAP` · `seating-pack` dropped from `isAllInOnePrint` · `menu` added to it.
 * Section 5 (2026-10-22, free is ready): `passes` made Pro again · the QR sheet made Pro again · Everything made free · the
 * place-card pack made free · a free event's print reading the Hub look · the Love Story line hand-typed "5" with the cap at 6 ·
 * the old all-in-one downloads line put back — each RED (see PR #6767).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DESIGNED_SET_ITEM, LOVE_STORY_ITEM, PRINT_LOOK_ITEM, PRO_THEMES_ITEM, UPLOAD_SPACE_ITEM, WEBSITE_PRO_ITEMS } from '@/lib/website-pro-items';
import { ART_KIT_IS_PRO } from '@/lib/art-kit-pro';
import { FREE_MOMENT_CAP, momentCapRefusal, readMoment, type LoveStoryMoment } from '@/lib/love-story-moments';
import { coupleMediaCapBytes, formatMakerMediaMB } from '@/lib/maker-media-limits';
import { PRINT_PIECES, isAllInOnePrint, type PrintMode } from '@/lib/print-pieces';
import { PLAIN_PRINT_COLOURS, plainPrintLook, printLookForEvent, printLooksFor } from '@/lib/print-hub-look';
import { formatCount } from '@/lib/format-number';
import { HUB_ELEMENT_PRO_FIELDS } from '@/lib/hub-look-pro';
import { INVITE_THEME_IDS, PRO_THEMES } from '@/lib/invite-themes';
import { FREE_FOR_ALL_SKUS } from '@/lib/entitlements';
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';

const items = WEBSITE_PRO_ITEMS as readonly string[];

/** The prototype's "Proposed" list, line for line (07-host5-pro-list.png). */
const DRAWN = [
  'Cinematic Reveal',
  'Save-the-Date video',
  'Photos you add',
  'Background music',
  'Photo and video backgrounds',
  PRO_THEMES_ITEM,
  'Animated logo',
  'Your logo on every QR code',
  'Style and animation for every part',
  'Decorations',
  // Computed (owner 2026-10-22: "read the numbers… don't type them") — today "…more than 5 moments" and "…500 MB per event".
  LOVE_STORY_ITEM,
  UPLOAD_SPACE_ITEM,
  'Prints in your Event Hub look',
  'One download of the whole designed set',
];

/**
 * "The whole designed set" — the designed bundle in one file (owner 2026-10-22: the whole set, Everything, the place-card pack).
 * The gate must refuse EXACTLY these; every other print, in every mode, downloads free.
 */
const DESIGNED_SET = ['everything', 'seating-pack', 'set'];
/** The two all-guests files a free event needs to run its day (owner 2026-10-22) — free in every mode. */
const FREE_ALL_GUESTS = ['passes', 'qr-codes'];
/** Every print the gate can be asked about: each piece, plus the two combined files the route serves. */
const EVERY_PRINT = [...Object.keys(PRINT_PIECES), 'set', 'everything'];
const MODES: PrintMode[] = ['screen', 'sample', 'print'];

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
  [LOVE_STORY_ITEM]: () =>
    (momentCapRefusal({ before: [moment('a')], after: [moment('a', [PHOTO])], ownsPro: false }) === 'photos_pro' &&
      momentCapRefusal({ before: [moment('a')], after: [moment('a', [PHOTO])], ownsPro: true }) === null) ||
    'a free couple may add a photo to a story (momentCapRefusal) — the line sells a free thing',
  [UPLOAD_SPACE_ITEM]: () =>
    coupleMediaCapBytes(true) > coupleMediaCapBytes(false) ||
    `Pro's upload allowance (${formatMakerMediaMB(coupleMediaCapBytes(true))}) is not more than Free's — "More upload space" is false`,
  // Sync half of the print-look gate (the door itself is async — § 5b): a free event's look is plain white, never its theme.
  [PRINT_LOOK_ITEM]: () =>
    INVITE_THEME_IDS.every((t) => printLooksFor(t, null).free.paper === PLAIN_PRINT_COLOURS.canvas) ||
    'a free event no longer prints plain white (printLooksFor) — "Prints in your Event Hub look" sells a free thing',
  [DESIGNED_SET_ITEM]: () =>
    (isAllInOnePrint('set', 'print') && isAllInOnePrint('everything', 'print') && isAllInOnePrint('seating-pack', 'print')) ||
    'the whole designed set in one file is no longer Pro (isAllInOnePrint) — the line sells a free thing',
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

test('4b · the Love Story line — a photo on ANY story is Pro, not only on a later one', () => {
  assert.ok(items.includes(LOVE_STORY_ITEM));
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

test('4c · "One download of the whole designed set" is EXACTLY what the gate refuses — both ways', () => {
  assert.ok(items.includes(DESIGNED_SET_ITEM));
  const gated = EVERY_PRINT.filter((p) => MODES.some((m) => isAllInOnePrint(p, m))).sort();
  assert.ok(gated.length >= 1, 'the gate refused nothing — the probe is blind');
  for (const p of gated) assert.ok(DESIGNED_SET.includes(p), `isAllInOnePrint refuses "${p}", which is not the designed set — the Pro list does not cover it`);
  for (const p of DESIGNED_SET) assert.ok(isAllInOnePrint(p, 'print'), `"${p}" is part of "the whole designed set", but it downloads free — the line oversells`);
  // The set's watermarked sample sheet stays free (it is a sample, not the file).
  assert.equal(isAllInOnePrint('set', 'sample'), false, 'the whole set’s sample sheet asks for Pro');
  // One at a time stays free (owner 2026-10-16): the single pass and each piece's own file.
  assert.equal(isAllInOnePrint('pass', 'print'), false, 'one guest’s pass is no longer free');
  assert.ok(!items.some((i) => /\bguest passes\b|\bQR sheet\b|every guest.s ticket/i.test(i)), 'a line still sells every guest’s ticket or the QR sheet, which are free');
});

test('5a · every guest’s ticket in one file and the Guest QR sheet are FREE — refused in no mode (owner 2026-10-22)', () => {
  for (const p of FREE_ALL_GUESTS) {
    assert.ok(EVERY_PRINT.includes(p), `"${p}" is not a print the gate knows — the probe is blind`);
    for (const m of MODES) assert.equal(isAllInOnePrint(p, m), false, `"${p}" (${m}) is Event Hub Pro again — a free event cannot run its day`);
  }
  // …while Everything — which holds every guest's pass too — stays Pro.
  assert.equal(isAllInOnePrint('everything', 'print'), true, 'Everything downloads free');
});

test('5b · a free event’s prints are PLAIN WHITE and never read the Hub; the Hub look is what Pro adds', async () => {
  for (const theme of INVITE_THEME_IDS) {
    const looks = printLooksFor(theme, null);
    let read = 0;
    const free = await printLookForEvent(looks, false, async () => {
      read += 1;
      return null;
    });
    assert.equal(read, 0, `${theme}: a free event’s print read the Hub look`);
    assert.equal(free.look, looks.free, `${theme}: a free event does not print the free look`);
    assert.equal(free.wearsHub, false);
    assert.equal(free.picture, null, `${theme}: a free print carries a picture`);
    assert.deepEqual(free.look, plainPrintLook(), `${theme}: a free event’s print is not plain white`);
    assert.equal(free.look.paper, PLAIN_PRINT_COLOURS.canvas);
    const pro = await printLookForEvent(looks, true, async () => {
      read += 1;
      return null;
    });
    assert.equal(read, 1, `${theme}: a Pro event’s print does not ask for the Hub look`);
    assert.equal(pro.look, looks.pro, `${theme}: a Pro event prints the free look`);
  }
});

test('5d · the digital ticket zip is FREE — no Pro line names a ticket or a zip (owner 2026-10-22, "yes")', () => {
  /* Handing out tickets is readiness, not personalization: the list of what Pro buys may not name it. The designed set is the
     only download Pro sells (4c), and its words name no ticket. The route's own freedom is CALLED in all-in-one § 1d. */
  for (const i of items) assert.doesNotMatch(i, /\btickets?\b|\bzip\b|\.zip|\bPNGs?\b/i, `the Pro list sells the ticket zip, which is free: "${i}"`);
});

test('5c · the Love Story line’s number is FREE_MOMENT_CAP — the 6th story is Pro, the 5th is not', () => {
  assert.equal(LOVE_STORY_ITEM, `Photos in your Love Story, and more than ${formatCount(FREE_MOMENT_CAP)} moments`);
  const n = (k: number) => Array.from({ length: k }, (_, i) => moment(`m${i}`));
  assert.equal(momentCapRefusal({ before: n(FREE_MOMENT_CAP - 1), after: n(FREE_MOMENT_CAP), ownsPro: false }), null, `a free couple is refused story ${FREE_MOMENT_CAP}`);
  assert.equal(momentCapRefusal({ before: n(FREE_MOMENT_CAP), after: n(FREE_MOMENT_CAP + 1), ownsPro: false }), 'more_stories_pro', `a free couple may add story ${FREE_MOMENT_CAP + 1} — "more than ${FREE_MOMENT_CAP} moments" sells a free thing`);
  assert.equal(momentCapRefusal({ before: n(FREE_MOMENT_CAP), after: n(FREE_MOMENT_CAP + 1), ownsPro: true }), null, 'Pro is refused a story');
});
