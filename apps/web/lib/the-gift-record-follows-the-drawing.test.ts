/**
 * 🎁 "I SENT IT" FOLLOWS THE APPROVED DRAWING, AND ITS DOOR ASKS WHO IS THERE
 * (owner 2026-10-08: "when people send gcash, they also give screenshot of
 * their payment and the vallue and their message for the couple. this will be
 * the way to measure."; design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "I sent
 * it → Show Maria & Jose" + § 6 E-PR4; prototype frames 18 · 19 · 20).
 *
 * The WRITE's own fence — who may and may not create a record — is run for real
 * against the replayed schema in `tests/db/a-gift-record-is-a-guests-own.db.test.ts`.
 * This file holds everything around it that a database cannot see:
 *
 *   1 · the sheet is the drawing: screenshot first, then the amount (prefilled
 *       with what is left), a word, From — and ✕ Not now · ➤ Send;
 *   2 · From is the invitation's own name; only a nameless invitation types one;
 *   3 · 🔴 every refusal is SAID IN PLACE — an unrecognised reader gets no form;
 *   4 · the thank-you says what the server kept, and the list re-reads;
 *   5 · 🔒 the picture goes to the guest's own PRIVATE folder — minted by the
 *       server from the session, never a public address;
 *   6 · 🔒 the door: page switch → who is reading (the RSVP's own read) → the
 *       limiter → only then the write; a refusal carries words and a status;
 *   7 · it costs NO new route and NO server action — both requests ride the guest
 *       upload route, which hands them over before it does anything else;
 *   8 · the sheet is fetched on the press, not with the gift page;
 *   9 · the page names its reader with the RSVP's own identity read, and the
 *       reader's own gifts are read by THEIR guest id only;
 *  10 · "Sent a gift? Show Maria & Jose" — a gift toward no wish, same sheet.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • the unrecognised reader shown the form                           → 3 red;
 *   • a caught failure that sets no refusal                            → 3 red;
 *   • the screenshot folder taken from the request body                → 5 red;
 *   • the screenshot minted into the public media bucket               → 5 red;
 *   • the record limiter dropped                                       → 6 red;
 *   • the session read dropped from the door                           → 6 red;
 *   • the selfie session read ahead of the gift hand-over              → 7 red;
 *   • the sheet imported statically by the wish list                   → 8 red;
 *   • the reader's own gifts read with no guest id                     → 9 red.
 *
 * Run from apps/web:  npx tsx --test lib/the-gift-record-follows-the-drawing.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { bucketForPrefix } from './bucket-routing';
import { giftShotScope } from './cleanup-delete-scope';
import { giftShotEventPolicy, giftShotPolicy, parseClientRef } from './r2-client-ref';
import { GIFT_NOT_RECOGNISED } from './gift-record';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const flat = (rel: string) => read(rel).replace(/\s+/g, ' ');

const SHEET = 'app/[slug]/pabuya/_components/gift-record-sheet.tsx';
const LIST = 'app/[slug]/pabuya/_components/wish-list.tsx';
const TELL = 'app/[slug]/pabuya/_components/gift-tell.tsx';
const PAGE = 'app/[slug]/pabuya/page.tsx';
const DOOR = 'lib/gift-door.server.ts';
const WRITER = 'lib/gift-record.server.ts';
const ROUTE = 'app/api/guest-selfie/route.ts';

/** Position of each needle, in order — every one must exist and come after the one before. */
function inOrder(src: string, needles: string[], what: string) {
  let at = -1;
  for (const n of needles) {
    const i = src.indexOf(n, at + 1);
    assert.ok(i > at, `${what}: “${n}” is missing or out of order`);
    at = i;
  }
}

test('1 · the sheet is the drawing: screenshot, amount, a word, From — ✕ Not now · ➤ Send', () => {
  const s = flat(SHEET);
  // The form is the LAST of the three states; read it alone.
  const form = s.slice(s.indexOf(') : ( <> <h2 id="gift-record-title"'));
  assert.ok(form.length > 500, 'the form branch was not found');
  inOrder(
    form,
    [
      '{giftSheetTitle(hostName)}',
      '{giftSheetLead(hostName)}',
      '{GIFT_SHOT_LABEL}',
      'data-gift-shot-input=""',
      '<span className={LABEL}>Amount</span>',
      'data-gift-amount=""',
      'A word for {hostName}',
      'data-gift-message=""',
      'data-gift-from=',
      'data-gift-refused=""',
      'data-gift-not-now=""',
      'Not now',
      'data-gift-send=""',
      'giftSendLabel(hostName)',
    ],
    'the form',
  );
  // The screenshot is asked for first and never demanded: nothing refuses a record for want of one.
  assert.match(form, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(s, /if \(!shot\)/, 'a record must not be refused because there is no screenshot');
  // The amount opens on what is left to reach the wish's price — and stays empty for a wish with none.
  assert.match(s, /const left = wish \? leftToReach\(wish\.pricePhp, wish\.sentPhp\) : null; const \[amount, setAmount\] = useState\(left && left > 0 \? String\(left\) : ''\);/);
  // The word is optional and held to the column.
  assert.match(form, /maxLength=\{GIFT_MESSAGE_MAX\}/);
});

test('2 · From is the invitation’s own name — only a nameless invitation types one', () => {
  const s = flat(SHEET);
  assert.match(
    s,
    /\{ownName !== '' \? \( <div data-gift-from="invitation"[^>]*> <span className=\{LABEL\}>From<\/span> <b[^>]*>\{ownName\}<\/b> <span[^>]*>\{GIFT_FROM_INVITATION\}<\/span> <\/div> \) : \( <label data-gift-from="typed"/,
  );
  // With a name on the invitation there is NO field to type another into.
  const invited = s.slice(s.indexOf('data-gift-from="invitation"'), s.indexOf('data-gift-from="typed"'));
  assert.doesNotMatch(invited, /<input/);
  assert.match(s, /data-gift-name="" value=\{name\}.{0,80}?maxLength=\{GIFT_GIVER_NAME_MAX\}/);
});

test('3 · 🔴 every refusal is said in place — and a reader the event does not know gets no form', () => {
  const s = flat(SHEET);
  const start = s.indexOf(') : !recognised ? (');
  const end = s.indexOf(') : ( <> <h2 id="gift-record-title"');
  assert.ok(start > 0 && end > start, 'the three states (thanks · not recognised · form) are no longer in that order');
  const stranger = s.slice(start, end);
  assert.match(stranger, /data-gift-not-recognised=""/);
  assert.match(stranger, /<p role="status"[^>]*> \{GIFT_NOT_RECOGNISED\} <\/p>/);
  for (const part of ['data-gift-send', 'data-gift-amount', 'data-gift-shot', '<input', '<textarea']) {
    assert.ok(!stranger.includes(part), `an unrecognised reader is shown ${part}`);
  }
  // The sentence tells them how to BE recognised — it does not just say no.
  assert.match(GIFT_NOT_RECOGNISED, /invitation link/);
  assert.match(GIFT_NOT_RECOGNISED, /QR/);

  // A refusal is drawn where the guest is looking, as an alert.
  assert.match(s, /\{refused \? \( <p role="alert" data-gift-refused=""[^>]*> \{refused\} <\/p> \) : null\}/);
  // Every way the two requests can fail ends in words: each `catch` and each not-ok branch sets one.
  const catches = [...s.matchAll(/catch \{ ([^}]*) \}/g)].map((m) => m[1]!);
  assert.equal(catches.length, 2, 'the sheet’s two requests each have one catch');
  for (const c of catches) assert.match(c, /^setRefused\(GIFT_[A-Z_]+\);$/, `a caught failure says nothing: ${c}`);
  assert.match(s, /if \(!presign\.ok \|\| typeof uploadUrl !== 'string' \|\| typeof ref !== 'string'\) \{ setRefused\(typeof presign\.data\?\.error === 'string' \? presign\.data\.error : GIFT_SHOT_REFUSED\); return; \}/);
  assert.match(s, /if \(!put\.ok\) \{ setRefused\(GIFT_SHOT_REFUSED\); return; \}/);
  assert.match(s, /if \(!res\.ok \|\| !res\.data \|\| typeof res\.data\.amountPhp !== 'number'\) \{ setRefused\(typeof res\.data\?\.error === 'string' \? res\.data\.error : GIFT_NOT_KEPT\); return; \}/);
  // Nothing is told to a console or a browser dialog instead.
  assert.doesNotMatch(s, /\balert\(|console\./);
});

test('4 · the thank-you says what the SERVER kept, and the list behind it re-reads', () => {
  const s = flat(SHEET);
  assert.match(s, /\{giftThanksTitle\(kept\.giverName\)\}/);
  assert.match(s, /\{giftThanksLine\(\{ hostName, \.\.\.kept \}\)\}/);
  // `kept` is the server's answer — never what the form happened to hold.
  assert.match(s, /setKept\(res\.data as unknown as Kept\); router\.refresh\(\);/);
  assert.equal([...s.matchAll(/setKept\(/g)].length, 1);
  assert.match(s, /data-gift-back="" onClick=\{onClose\}/);
});

test('5 · 🔒 the picture goes to the guest’s own PRIVATE folder, minted by the server', () => {
  const sheet = flat(SHEET);
  // The browser asks for an address and PUTs to it; all it keeps is the ref.
  assert.match(sheet, /post\(\{ purpose: 'gift-shot', contentType: picked\.type, sizeBytes: picked\.size \}\)/);
  assert.match(sheet, /fetch\(uploadUrl, \{ method: 'PUT'/);
  assert.match(sheet, /shotRef: shot\?\.ref \?\? ''/);
  // The only picture the sheet ever draws is this browser's own memory of the file.
  assert.match(sheet, /preview: URL\.createObjectURL\(picked\)/);
  assert.equal([...sheet.matchAll(/<img /g)].length, 1);
  assert.match(sheet, /<img src=\{shot\.preview\}/);

  const door = flat(DOOR);
  // Bucket and folder come from the SESSION, never from the request body.
  assert.match(door, /const bucket = R2_BUCKETS\.threadFiles; const key = `gift-shots\/\$\{session\.event_id\}\/\$\{session\.guest_id\}\/\$\{randomUUID\(\)\}\.\$\{ext\}`;/);
  assert.doesNotMatch(door, /body\.(key|bucket|pathPrefix|guestId|guest_id)/);
  assert.doesNotMatch(door, /R2_BUCKETS\.media|publicUrl|publicBucket/i);
  // Picture types only, and the upload route's own size.
  assert.match(door, /const SHOT_MIME = new Set\(\['image\/jpeg', 'image\/png', 'image\/webp'\]\);/);
  assert.match(door, /const MAX_SHOT_MB = 8; const MAX_SHOT_BYTES = MAX_SHOT_MB \* 1024 \* 1024;/);
  assert.match(door, /if \(sizeBytes > MAX_SHOT_BYTES\) return said\(/);

  // The policies the record write and every later read/delete hold it to — run, not read.
  const E = '11111111-1111-4111-8111-111111111111';
  const G = '22222222-2222-4222-8222-222222222222';
  const OTHER = '33333333-3333-4333-8333-333333333333';
  assert.deepEqual(giftShotPolicy(E, G), { bucket: 'setnayan-thread-files', prefixes: [`gift-shots/${E}/${G}/`] });
  assert.deepEqual(giftShotEventPolicy(E), { bucket: 'setnayan-thread-files', prefixes: [`gift-shots/${E}/`] });
  const own = `r2://setnayan-thread-files/gift-shots/${E}/${G}/a.jpg`;
  assert.ok(parseClientRef(own, giftShotPolicy(E, G)));
  for (const not of [
    `r2://setnayan-thread-files/gift-shots/${E}/${OTHER}/a.jpg`, // another guest's
    `r2://setnayan-thread-files/gift-shots/${OTHER}/${G}/a.jpg`, // another event's
    `r2://setnayan-media/gift-shots/${E}/${G}/a.jpg`, // the public bucket
    `r2://setnayan-thread-files/chat/${E}/a.jpg`, // somebody's chat file
    `https://example.com/gift-shots/${E}/${G}/a.jpg`,
  ]) {
    assert.equal(parseClientRef(not, giftShotPolicy(E, G)), null, `${not} was taken for this guest’s own screenshot`);
  }
  // The prefix alone routes to the private bucket.
  assert.equal(bucketForPrefix(`gift-shots/${E}/${G}/`), 'threadFiles');
  // What may delete it: the event's sweep (the whole event folder) and one guest's erasure (theirs alone).
  assert.match(giftShotScope(E).label, new RegExp(`^event_gift_records:${E}$`));
  assert.match(giftShotScope(E, G).label, new RegExp(`^event_gift_records:${E}:${G}$`));
});

test('6 · 🔒 the door: page switch → who is reading → the limiter → only then the write', () => {
  const door = flat(DOOR);
  inOrder(
    door,
    [
      'if (!isPabuyaPublicRouteEnabled()) return said(GIFT_NOT_ACCEPTING, 404);',
      'if (!UUID.test(eventId)) return said(GIFT_NOT_KEPT, 400);',
      'const session = await readGuestSessionForEvent(eventId);',
      'if (!session) return said(GIFT_NOT_RECOGNISED, 401);',
      "const burst = await enforceRateLimit('gift_shot', session.guest_id, SHOT_LIMIT); if (!burst.ok) return said(GIFT_TOO_FAST, 429);",
      'await presignUploadUrl({ bucket, key, contentType, sizeBytes })',
      "const burst = await enforceRateLimit('gift_record', session.guest_id, RECORD_LIMIT); if (!burst.ok) return said(GIFT_TOO_FAST, 429);",
      'result = await recordGift(createAdminClient(), session, eventId, {',
      'if (!result.ok) return said(result.error, 422);',
    ],
    'the door',
  );
  // One session read, one write call, one service-role client — nothing reaches the table around them.
  assert.equal([...door.matchAll(/readGuestSessionForEvent\(/g)].length, 1);
  assert.equal([...door.matchAll(/recordGift\(/g)].length, 1);
  assert.equal([...door.matchAll(/createAdminClient\(\)/g)].length, 1);
  assert.doesNotMatch(door, /\.from\(/, 'the door itself reads and writes no table — the writer does, behind its checks');
  // Every refusal leaves as words.
  assert.match(door, /const said = \(error: string, status: number\) => NextResponse\.json\(\{ error \}, \{ status \}\);/);
  // The limits are a person's, not a script's.
  assert.match(door, /const RECORD_LIMIT = \{ limit: 10, windowSecs: 600 \};/);
  assert.match(door, /const SHOT_LIMIT = \{ limit: 20, windowSecs: 600 \};/);

  // The writer is handed the session and re-reads the guest itself.
  const writer = flat(WRITER);
  inOrder(
    writer,
    [
      'if (!session || session.event_id !== eventId || !session.guest_id) return { ok: false, error: GIFT_NOT_RECOGNISED };',
      ".eq('guest_id', session.guest_id) .eq('event_id', eventId)",
      'if (!guest || guest.deleted_at != null) return { ok: false, error: GIFT_NOT_RECOGNISED };',
      'if (!giftsAreOn(event.gifts_on) || ways.length === 0) return { ok: false, error: GIFT_NOT_ACCEPTING };',
      'if (!parseClientRef(shotRaw, giftShotPolicy(eventId, session.guest_id))) return { ok: false, error: GIFT_SHOT_REFUSED };',
      ".eq('public_id', wishId).eq('event_id', eventId)",
      ".from('event_gift_records') .insert({",
    ],
    'the writer',
  );
  assert.equal([...writer.matchAll(/\.insert\(/g)].length, 1);
});

test('7 · it costs no new route and no server action — both requests ride the guest upload route', () => {
  const route = flat(ROUTE);
  // The hand-over is the FIRST thing the route does with a body — before the selfie's own session read.
  inOrder(
    route,
    [
      'export async function POST(request: NextRequest)',
      'parsed = await request.json();',
      'const gift = giftPurposeOf(parsed); if (gift) return giftDoor(gift, parsed as Record<string, unknown>);',
      'const session = await readGuestSession();',
    ],
    'the route',
  );
  // A body with no purpose is the selfie, exactly as before.
  const door = flat(DOOR);
  assert.match(door, /return p === 'gift-shot' \|\| p === 'gift-record' \? p : null;/);
  // The route still exports ONE handler, and its folder holds one file.
  assert.deepEqual([...route.matchAll(/export (?:async )?function (\w+)/g)].map((m) => m[1]), ['POST']);
  assert.deepEqual(readdirSync(join(WEB, 'app/api/guest-selfie')), ['route.ts']);
  // No gift route was added anywhere under app/api, and neither server file is an action file.
  const apiDirs = readdirSync(join(WEB, 'app/api'), { recursive: true }) as string[];
  assert.deepEqual(apiDirs.filter((p) => /gift|wish/i.test(String(p))), []);
  for (const f of [DOOR, WRITER]) {
    const src = readFileSync(join(WEB, f), 'utf8');
    assert.doesNotMatch(src, /^\s*['"]use server['"]/m, `${f} must not be a server-action file`);
    assert.match(src, /^import 'server-only';/, `${f} must be server-only`);
  }
  assert.equal(existsSync(join(WEB, 'app/[slug]/pabuya/actions.ts')), false, 'the gift page grew an action file');
  // The sheet knows one address.
  const sheet = flat(SHEET);
  assert.deepEqual([...sheet.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]!.trim()), ["'/api/guest-selfie'", 'uploadUrl']);
  assert.match(sheet, /body: JSON\.stringify\(\{ eventId, \.\.\.body \}\)/);
});

test('8 · the sheet (and its upload) is fetched on the press, not with the gift page', () => {
  for (const f of [LIST, TELL]) {
    const src = flat(f);
    assert.match(
      src,
      /const GiftRecordSheet = dynamic\(\(\) => import\('\.\/gift-record-sheet'\), \{ ssr: false, loading: \(\) => null \}\);/,
      `${f} must load the record sheet lazily`,
    );
    assert.doesNotMatch(src, /import (?!type\b)[^;]*from '\.\/gift-record-sheet'/, `${f} imports the sheet statically`);
  }
  // It is mounted only once something is pressed.
  assert.match(flat(LIST), /\{record && recording \? \( <GiftRecordSheet/);
  assert.match(flat(TELL), /\{open \? \( <GiftRecordSheet/);
  // The server page never imports it at all.
  assert.doesNotMatch(flat(PAGE), /gift-record-sheet/);
});

test('9 · the page names its reader with the RSVP’s own identity read — and reads only THEIR gifts', () => {
  const page = flat(PAGE);
  assert.match(page, /const guestSession = await readGuestSessionForEvent\(event\.event_id\);/);
  // A removed guest is no longer a guest: not recognised, no name.
  assert.match(page, /const reader = readerRow && readerRow\.deleted_at == null \? readerRow : null;/);
  assert.match(page, /recognised: reader != null,/);
  assert.match(page, /giverName: reader \? guestDisplayName\(/);
  assert.match(page, /readGuestWishList\(admin, event\.event_id, reader\?\.guest_id \?\? null\)/);
  assert.match(page, /record=\{giftReader\}/);

  // The reader's own gifts are asked for by THEIR guest id, at THIS event — or not asked for at all.
  const read = flat('lib/wish-list.server.ts');
  const fn = read.slice(read.indexOf('export async function readGuestWishList('));
  assert.match(fn, /readerGuestId: string \| null = null/);
  assert.match(fn, /readerGuestId \? [^:]*\.from\('event_gift_records'\)\s*\.select\(GIFT_SUM_FIELDS\)\s*\.eq\('event_id', eventId\)\s*\.eq\('giver_guest_id', readerGuestId\)/);
  // …and still only the sum's three columns: no name, no words, no screenshot reaches the guest's page.
  assert.doesNotMatch(fn.slice(0, fn.indexOf('\nexport ', 10) > 0 ? fn.indexOf('\nexport ', 10) : fn.length), /GIFT_RECORD_SELECT|giver_name|screenshot_r2_key|message/);
});

test('10 · "Sent a gift? Show Maria & Jose" — a gift toward no wish opens the same sheet', () => {
  const tell = flat(TELL);
  assert.match(tell, /<button type="button" data-gift-tell="" onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(tell, /\{giftTellLabel\(hostName\)\}/);
  assert.match(tell, /\{GIFT_TELL_LINE\}/);
  assert.match(tell, /<GiftRecordSheet eventId=\{record\.eventId\} hostName=\{hostName\} wish=\{null\} giverName=\{record\.giverName\} recognised=\{record\.recognised\}/);
  // It sits under the ways to give, on the gift page.
  const page = flat(PAGE);
  inOrder(page, ['<PabuyaCardList', '<GiftTell hostName={hostName} record={giftReader} />'], 'the page');
  // "I sent it" on a wish hands the sheet THAT wish.
  const list = flat(LIST);
  assert.match(list, /data-wish-i-sent-it=""/);
  assert.match(list, /wish=\{\{ id: recording\.id, name: recording\.name, pricePhp: recording\.pricePhp, sentPhp: recording\.sentPhp \}\}/);
});
