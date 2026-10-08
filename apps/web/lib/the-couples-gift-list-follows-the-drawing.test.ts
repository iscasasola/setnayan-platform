/**
 * 🎁 "GIFTS SENT TO YOU" FOLLOWS THE APPROVED DRAWING (owner 2026-10-08: "yes. it
 * will accumulate all the gift and mark them one by one" · "when amount is
 * reached."; design `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 2 "One gift open" ·
 * "Gifts sent to you" + § 6 E-PR5; prototype frames 05 · 07 · 08).
 *
 * The three WRITES — who may correct, move and remove a record, and what the
 * wishes then say — are run for real against the replayed schema in
 * `tests/db/the-couple-marks-gifts-one-by-one.db.test.ts`. This file holds what a
 * database cannot see:
 *
 *   1 · the row under the wish list is a DOOR now, and says what guests say
 *       they sent;
 *   2 · the list: every record newest first, the sentence over it, each row's
 *       line, "no shot" where there is none, the footer, ✓ Done;
 *   3 · a removed record waits under "Removed", says so, and counts nowhere;
 *   4 · one gift open is the drawing: the screenshot, their words, "Amount they
 *       said", "Counts toward", the honest line — 🗑 Remove (two taps) · ✓ Done;
 *   5 · a wish's own gifts are rows that open, kept-first;
 *   6 · every change is DRAWN first, saved through the one door as a HELD save
 *       (no Maker re-read), and put back when the server refuses;
 *   7 · +0 server actions, +0 routes — and the writer never deletes or inserts;
 *   8 · 🔒 the screenshot is signed for a HOST only, for the ONE gift that was
 *       opened, from this event's own private folder — the list read signs
 *       nothing, a row draws no picture, the guest's read never signs anything;
 *   9 · the screens ride the lazy Studio chunk, never the Maker's first load;
 *  10 · ⚡ a press costs one request and renders no page: the door refreshes the
 *       guests' pages AFTER its answer is sent, and the read refreshes nothing.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08, builder EH) — listed in the PR body.
 *
 * Run from apps/web:  npx tsx --test lib/the-couples-gift-list-follows-the-drawing.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { labWishList } from '../app/dev/details-lab/wish-list-fixture';
import { GIFTS_SENT_FOOT, WISH_GIFTS_ONLY_YOU, giftTotals, type StudioWishGift } from './wish-list-studio';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const P = 'app/dashboard/[eventId]/pabuya';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const flat = (rel: string) => read(rel).replace(/\s+/g, ' ');

const LIST = `${L}/studio-wish-list.tsx`;
const GIFTS = `${L}/studio-wish-gifts.tsx`;
const WRITER = `${P}/gift-records.server.ts`;

const EVENT = '00000000-0000-4000-8000-000000000000';

/** What a person reads: tags out, entities back, spaces settled. */
const words = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;|&ldquo;|&rdquo;|“|”/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

function inOrder(src: string, needles: string[], what: string) {
  let at = -1;
  for (const n of needles) {
    const i = src.indexOf(n, at + 1);
    assert.ok(i > at, `${what}: “${n}” is missing or out of order`);
    at = i;
  }
}

function fixture(): { gifts: StudioWishGift[]; wishes: Array<{ id: string; name: string }> } {
  const list = labWishList('five');
  assert.ok(list.read);
  return { gifts: list.gifts, wishes: list.wishes };
}

async function giftsSent(gifts: StudioWishGift[], wishes: Array<{ id: string; name: string }>): Promise<string> {
  const { GiftsSent } = await import(`../${GIFTS.replace(/\.tsx$/, '')}`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const totals = giftTotals(gifts);
  return renderToStaticMarkup(
    React.createElement(GiftsSent, { gifts, wishes, sentPhp: totals.sentPhp, counted: totals.counted, onOpen: () => {}, onDone: () => {} }),
  );
}

test('1 · the row under the wish list is a door, and says what guests say they sent', async () => {
  const { StudioWishList } = await import(`../${LIST.replace(/\.tsx$/, '')}`);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(
    React.createElement(StudioWishList, { eventId: EVENT, methods: [{ is_enabled: true }], list: labWishList('five'), action: async () => ({ ok: true as const }) }),
  );
  const door = /<button[^>]*data-studio-gifts-sent=""[^>]*>(.*?)<\/button>/s.exec(html);
  assert.ok(door, '"Gifts sent to you" is not a button — it opens nothing');
  assert.equal(words(door[1]!), 'Gifts sent to you ₱14,500 said sent · 5 gifts');
  assert.match(door[1]!, /<svg/, 'a door shows its chevron');
  assert.equal(html.match(/data-studio-gifts-sent/g)?.length, 1);

  /* The door is drawn from the RECORDS (so a correction shows on it at once), and with no wish
     at all it is still there when a gift was shown to the couple. */
  const list = flat(LIST);
  assert.match(list, /const totals = giftTotals\(gifts\); const giftsDoor = <GiftsSentDoor summary=\{giftsSentLine\(totals\.sentPhp, totals\.counted\)\} onOpen=\{\(\) => setAllGifts\(true\)\} \/>;/);
  assert.match(list, /\{gifts\.length > 0 \? giftsDoor : null\}/);
  assert.equal([...list.matchAll(/\{giftsDoor\}/g)].length, 1);
});

test('2 · the list: every record newest first, the sentence, each row’s line, the footer, ✓ Done', async () => {
  const { gifts, wishes } = fixture();
  const html = await giftsSent(gifts, wishes);
  const text = words(html);
  assert.match(text, /^Gifts sent to you Done What guests say they sent — ₱14,500 in 5 gifts\. Check your GCash or bank before you count one\./);
  assert.match(html, /<b[^>]*>₱14,500<\/b>/, 'the figure is the heavy part of the sentence');

  const rows = [...html.matchAll(/<li data-gift-row="counted"[^>]*>(.*?)<\/li>/gs)].map((m) => words(m[1]!));
  assert.deepEqual(rows, [
    'screenshot added Tita Nene Air fryer · GCash · Tue 3:12 pm "For your merienda machine! Love you both" ₱2,000 sent',
    'no shot Kuya Jun Air fryer · Bank transfer · Mon 9:40 am "Congrats, mga bata." ₱2,000 sent',
    'screenshot added Ate Grace Luggage set · GCash · Sun 7:05 pm "For the honeymoon!" ₱3,000 sent',
    'screenshot added Ninong Bert Any gift · GCash · Sun 2:30 pm "Congratulations to you both!" ₱5,000 sent',
    'screenshot added Lola Cely Bed linen · GCash · Sat 11:20 am "Sweet dreams, apo." ₱2,500 sent',
  ]);
  /* Each row is a button that opens that gift. A row says a screenshot was added with a mark —
     it draws NO picture, even when the reader already holds an address (the lab's fixture does):
     a list of pictures is a request per row. */
  assert.equal(html.match(/<button type="button" data-gift-open="/g)?.length, 5);
  assert.ok(gifts.filter((g) => g.shotUrl).length >= 4, 'the fixture no longer hands rows an address to be tempted by');
  assert.equal(html.match(/data-wish-gift-shot="yes"[^>]*><svg /g)?.length, 4);
  assert.equal(html.match(/data-wish-gift-shot="none"/g)?.length, 1);
  assert.doesNotMatch(html, /<img /, 'the list of gifts draws a picture per row');
  assert.doesNotMatch(html, /data-gifts-removed-rows/);

  assert.ok(text.endsWith(GIFTS_SENT_FOOT.replace('’', '’')), 'the footer says who alone sees these');
  assert.match(GIFTS_SENT_FOOT, /^Only you see these\. Guests see each wish’s total, never a name, amount or screenshot\.$/);
  assert.match(html, /<button type="button" data-gifts-sent-done=""/);

  /* No gift yet: one plain sentence, no rows — never "₱0 in 0 gifts". */
  const none = words(await giftsSent([], wishes));
  assert.match(none, /No gifts yet\. When a guest shows you what they sent, it lands here\./);
  assert.doesNotMatch(none, /₱0|0 gifts/);
});

test('3 · a removed record waits under "Removed", says so, and counts nowhere', async () => {
  const { gifts, wishes } = fixture();
  const set = gifts.map((g) => (g.giverName === 'Kuya Jun' ? { ...g, removed: true } : g));
  const html = await giftsSent(set, wishes);
  const text = words(html);
  assert.match(text, /What guests say they sent — ₱12,500 in 4 gifts\./, 'a removed gift is still in the sentence');
  assert.equal(html.match(/<li data-gift-row="counted"/g)?.length, 4);
  const removed = [...html.matchAll(/<li data-gift-row="removed"[^>]*>(.*?)<\/li>/gs)].map((m) => words(m[1]!));
  assert.deepEqual(removed, ['no shot Kuya Jun Air fryer · Bank transfer · Mon 9:40 am "Congrats, mga bata." ₱2,000 removed']);
  inOrder(html, ['data-gifts-sent-rows', '>Removed<', 'data-gifts-removed-rows'], 'the removed ones come last');
});

test('4 · one gift open: the screenshot, their words, the amount, "Counts toward", the honest line — Remove in two taps', () => {
  const s = flat(GIFTS);
  const open = s.slice(s.indexOf('export function OpenGift('));
  inOrder(
    open,
    [
      'title={gift.giverName}',
      'data-gift-pill=""',
      'data-gift-open-shot=',
      '{gift.message ?',
      '{GIFT_AMOUNT_LABEL}',
      '{GIFT_AMOUNT_HINT}',
      'data-gift-field="amount"',
      '{GIFT_TOWARD_LABEL}',
      '<PickMenu',
      'dataAttr="data-gift-toward"',
      '{GIFT_SHOT_IS_NOT_MONEY}',
      'data-gift-refused=""',
      'data-wish-sheet-foot="gift"',
      "label={asked ? 'Remove it?' : 'Remove'}",
      'label="Done"',
    ],
    'the open gift',
  );
  /* The picture, or the truth about it — never an empty frame: shown · couldn't be loaded
     (said, with Try again — nothing retries by itself) · loading · none. */
  assert.match(open, /\{shot\.state === 'shown' \? \( <img src=\{shot\.url\}[^>]*loading="lazy"[^>]*onError=\{\(\) => setShot\(\{ state: 'unread' \}\)\}[^>]*\/> \) : shot\.state === 'unread' \? \(/);
  assert.match(open, /<span role="alert"[^>]*> \{GIFT_SHOT_UNREAD\} <\/span> <ActionButton tone="neutral" icon=\{RotateCw\} label="Try again"/);
  assert.match(open, /\{shot\.state === 'loading' \? GIFT_SHOT_LOADING : GIFT_NO_SHOT\}/);
  assert.doesNotMatch(open, /setInterval|setTimeout/, 'the screenshot is retried on a timer');
  /* "Counts toward" is ONE dropdown — the Maker's own — holding every wish, then "Any gift". */
  assert.match(open, /const toward: PickOption\[\] = \[\.\.\.wishes\.map\(\(w\) => \(\{ key: w\.id, label: w\.name \}\)\), \{ key: '', label: GIFT_ANY \}\];/);
  assert.match(open, /<PickMenu label=\{GIFT_TOWARD_LABEL\} value=\{gift\.wishId \?\? ''\} options=\{toward\}/);
  assert.doesNotMatch(s, /<select|<option/, 'a second kind of dropdown');
  /* Kept when the field is left — no Save — and each control is its label's. */
  assert.match(open, /onBlur=\{\(\) => void keep\(\)\}/);
  assert.match(open, /<label className=\{LABEL\} htmlFor=\{`\$\{id\}-amount`\}>/);
  assert.doesNotMatch(open, /label="Save"|>Save</);
  /* Two taps: the first only asks. */
  assert.match(open, /if \(!asked\) \{ setAsked\(true\); return; \} setRefused\(null\); const said = await onRemove\(true\);/);
  /* A removed gift: no fields to mistype into, its line, and Put it back. */
  assert.match(open, /\{gift\.removed \? \( <p data-gift-removed-line=""[^>]*> \{GIFT_REMOVED_LINE\} <\/p> \) : \(/);
  assert.match(open, /label="Put it back"[^/]*onClick=\{async \(\) => \{ setRefused\(null\); const said = await onRemove\(false\);/);
  /* A refusal is said here, in place. */
  assert.match(open, /\{refused \? \( <p role="alert" data-gift-refused=""[^>]*> \{refused\} <\/p> \) : null\}/);
  for (const m of open.matchAll(/const said = await on(Amount|Move|Remove)\([^)]*\); if \(said\) (\{ )?setRefused\(said\)/g)) assert.ok(m);
  assert.equal([...open.matchAll(/const said = await on(Amount|Move|Remove)\(/g)].length, 4, 'amount · move · remove · put back');
});

test('5 · a wish’s own gifts are rows that open — what is typed is kept first', () => {
  const list = flat(LIST);
  assert.match(list, /<GiftRow key=\{g\.id\} gift=\{g\} line=\{giftWhenLine\(g\)\} onOpen=\{\(\) => \{ void keep\(\)\.then\(\(ok\) => \{ if \(ok\) onOpenGift\(g\.id\); \}\); \}\} \/>/);
  assert.match(list, /onOpenGift=\{\(giftId\) => \{ setSheet\(null\); setOpenGift\(\{ id: giftId, backTo: open\.id \}\); \}\}/);
  /* …and closing that gift returns to the wish it was opened from. */
  assert.match(list, /const backTo = openGift\?\.backTo \?\? null; setOpenGift\(null\); if \(backTo\) setSheet\(\{ kind: 'edit', id: backTo \}\);/);
  assert.equal(WISH_GIFTS_ONLY_YOU, 'Only you see these. Tap one to correct or remove it.');
  assert.doesNotMatch(list, /'no shot'/, 'the read-only "shot / no shot" row is gone from the wish’s sheet');
});

test('6 · every change is drawn first, saved through the one door as a held save, and put back when refused', () => {
  const list = flat(LIST);
  const fn = list.slice(list.indexOf('const changeGift = async ('), list.indexOf('const shots = useRef('));
  assert.ok(fn.length > 300, 'changeGift was not found');
  inOrder(
    fn,
    [
      'const had = gifts.find((g) => g.id === id);',
      'const touched = [had.wishId, change.wishId ?? null];',
      'const marks = new Map(wishes.map((w) => [w.id, w.gotBy]));',
      'const next = gifts.map((g) => (g.id === id ? { ...g, ...change } : g));',
      'setGifts(next);',
      'setWishes((cur) => settleDrawn(cur, next, touched));',
      'const res = await makerSave(() => action(form({ gift_record_id: id, ...fields })), requestMakerRefresh, { held: true });',
      'if (res.ok) return null;',
      /* Refused: only THIS record goes back — and not even that when the record itself was kept. */
      'if (!res.kept) setGifts((cur) => cur.map((g) => (g.id === id ? had : g)));',
      'setWishes((cur) => cur.map((w) => (touched.includes(w.id) && marks.has(w.id) ? { ...w, gotBy: marks.get(w.id) ?? null } : w)));',
      'return res.error;',
    ],
    'changeGift',
  );
  assert.doesNotMatch(fn, /setGifts\(was|setWishes\(was/, 'a refusal restores a snapshot of the whole list');
  /* ⚡ Nothing in it asks the Maker to render again — not after a kept change, not after a refusal. */
  assert.doesNotMatch(fn, /requestMakerRefresh\(\)|router\.refresh|location\.reload/, 'a gift change re-renders the Maker');
  /* The three things a couple can do to a record — and nothing else is sent. */
  assert.match(list, /onAmount=\{\(amountPhp\) => changeGift\(giftOpen\.id, \{ amountPhp \}, \{ wish_op: 'gift-amount', amount: String\(amountPhp\) \}\)\}/);
  assert.match(list, /onMove=\{\(wishId\) => changeGift\(giftOpen\.id, \{ wishId \}, \{ wish_op: 'gift-move', wish_item_id: wishId \?\? '' \}\)\}/);
  assert.match(list, /onRemove=\{\(removed\) => changeGift\(giftOpen\.id, \{ removed \}, \{ wish_op: 'gift-remove', removed: removed \? '1' : '0' \}\)\}/);
  /* A wish that is removed frees its gifts on the screen too ("Any gift"), and takes them back if refused. */
  assert.match(list, /setGifts\(\(cur\) => cur\.map\(\(g\) => \(g\.wishId === id \? \{ \.\.\.g, wishId: null \} : g\)\)\);/);
  assert.match(list, /const freed = gifts\.filter\(\(g\) => g\.wishId === id\)\.map\(\(g\) => g\.id\);/);
  assert.match(list, /setGifts\(\(cur\) => cur\.map\(\(g\) => \(freed\.includes\(g\.id\) && g\.wishId === null \? \{ \.\.\.g, wishId: id \} : g\)\)\); setError\(res\.error\);/);
  /* Everything on the screen is drawn from the records. */
  assert.match(list, /const view = wishesWithGifts\(wishes, gifts\); const shown = studioWishesInOrder\(view\);/);
});

test('7 · +0 server actions, +0 routes — and the writer corrects, never deletes or invents', () => {
  for (const f of [WRITER, `${P}/wish-items.server.ts`]) {
    const src = readFileSync(join(WEB, f), 'utf8');
    assert.doesNotMatch(src, /^\s*['"]use server['"]/m, `${f} must not be a server-action file`);
    assert.match(src, /^import 'server-only';/);
  }
  /* The screens import no server action: the write is handed in. */
  for (const f of [GIFTS, `${L}/studio-wish-sheet.tsx`]) assert.doesNotMatch(read(f), /actions'|\.server'/, `${f} imports a server module`);
  /* The one door: a form carrying a gift op goes to the gift writer, after the same sign-in check. */
  const door = flat(`${P}/wish-items.server.ts`);
  inOrder(
    door,
    [
      "const giftOp = giftOpOf(formData.get('wish_op'));",
      'if (!op && !giftOp) return { ok: false, error: NOT_KEPT };',
      "if (!user) return { ok: false, error: 'Please sign in again.' };",
      'if (giftOp) return giftRecordWrite(supabase, eventId, giftOp, formData);',
    ],
    'wishListWrite',
  );
  assert.match(flat(`${P}/actions.ts`), /wishListWrite\(/, 'the E-Gifts action no longer opens the wish list’s door');
  /* No route was added for the couple's gifts or their screenshots. */
  const api = readdirSync(join(WEB, 'app/api'), { recursive: true }) as string[];
  assert.deepEqual(api.filter((p) => /gift|wish/i.test(String(p))), []);

  const w = flat(WRITER);
  assert.match(w, /export const GIFT_WRITE_OPS = \['gift-amount', 'gift-move', 'gift-remove'\] as const;/);
  assert.match(w, /export const GIFT_READ_OP = 'gift-shot';/);
  assert.match(w, /export const GIFT_OPS = \[\.\.\.GIFT_WRITE_OPS, GIFT_READ_OP\] as const;/);
  assert.doesNotMatch(w, /\.delete\(|\.insert\(|\.upsert\(|createAdminClient/, 'the couple’s writer deletes, invents or reaches past RLS');
  /* Remove is a timestamp. */
  assert.match(w, /patch = \{ removed_at: removed === '1' \? new Date\(\)\.toISOString\(\) : null \};/);
  /* 🔒 Every read and every write names the event — a record's wish key alone does not. */
  const calls = w.split(/\.from\('(?:event_gift_records|event_wish_items)'\)/).slice(1).map((c) => c.split(';')[0]!);
  assert.equal(calls.length, 6, `the writer’s six table calls were not all found (${calls.length})`);
  /* ⚡ ONE write per change; the wishes it touched are added up in ONE pass — never a read per wish. */
  assert.equal([...w.matchAll(/\.from\('event_gift_records'\) \.update\(/g)].length, 1, 'a change to a record is one write');
  assert.doesNotMatch(w, /for \(const \w+ of[^)]*\) \{[^}]*await/, 'a request per wish, one after another');
  assert.match(w, /\.eq\('event_id', eventId\)\.in\('wish_item_id', ids\)/);
  for (const c of calls) assert.match(c, /\.eq\('event_id', eventId\)/, `a call forgets the event: ${c.slice(0, 120)}`);
  /* A zero-row write is said, never reported as kept. */
  assert.match(w, /if \(!now\) return \{ ok: false, error: GIFT_GONE \};/);
  /* Got it follows the sum on every wish touched — the one it left and the one it counts toward now. */
  assert.match(w, /left = rec\.wish_item_id;/);
  assert.match(w, /const touched = \[left, now\.wish_item_id\]\.filter\(\(w\): w is string => typeof w === 'string'\);/);
  assert.match(w, /if \(await settleWishesGot\(supabase, eventId, touched\)\) return \{ ok: true \};/);
  /* …and a change that was kept while its mark was not is SAID, and marked as kept. */
  assert.match(w, /return \{ ok: false, error: GIFT_MARK_NOT_SETTLED, kept: true \};/);
  assert.equal(existsSync(join(WEB, P, 'gift-actions.ts')), false);
});

test('8 · 🔒 the screenshot is signed for a host only, for the one gift that was opened', () => {
  const s = flat('lib/wish-list.server.ts');
  const host = s.slice(s.indexOf('export async function readStudioWishList('), s.indexOf('export const GIFT_SHOT_TTL_SECONDS'));
  const one = s.slice(s.indexOf('export async function readGiftShotUrl('), s.indexOf('export function readOpenWishCount('));
  const guest = s.slice(s.indexOf('export async function readGuestWishList('));
  assert.ok(host.length > 200 && one.length > 200 && guest.length > 200);

  /* ⚡ THE LIST READ SIGNS NOTHING — it runs on every render of the Maker, and a signed address
     is new on every render. Two reads, side by side; no screenshot resolver is handed in. */
  assert.doesNotMatch(host, /displayUrlForPrivateStoredAsset|giftShotEventPolicy|presign|shotUrl/, 'the couple’s list read signs a screenshot per record');
  assert.equal([...host.matchAll(/supabase \.from\(/g)].length, 2, 'the list is one read per table');
  assert.match(host, /await Promise\.all\(\[ supabase \.from\('event_wish_items'\)/);
  assert.equal([...host.matchAll(/publicUrlForStoredAsset\(/g)].length, 1, 'only the wish PHOTO is public');
  assert.match(host, /return studioWishListFrom\( wishRes\.data as unknown as WishItemRow\[\], giftRes\.data as unknown as GiftRecordRow\[\], \(ref\) => publicUrlForStoredAsset\(publicBucketServeRef\(ref\)\), \);/);

  /* 🔒 ONE GIFT'S: the host's own client, that record by id AND event, this event's folder, short-lived. */
  inOrder(
    one,
    [
      ".from('event_gift_records')",
      '.select(GIFT_SHOT_FIELDS)',
      ".eq('gift_record_id', giftRecordId)",
      ".eq('event_id', eventId)",
      '.maybeSingle();',
      'if (!row) return { read: false, gone: true };',
      'if (!ref) return { read: true, url: null };',
      'const shotPolicy = giftShotEventPolicy(eventId);',
      'if (!parseClientRef(ref, shotPolicy)) return { read: false, gone: false };',
      'await displayUrlForPrivateStoredAsset(ref, shotPolicy, { ttlSeconds: GIFT_SHOT_TTL_SECONDS });',
    ],
    'readGiftShotUrl',
  );
  assert.equal([...one.matchAll(/\.from\(/g)].length, 1, 'an opened screenshot is one read');
  assert.doesNotMatch(one, /createAdminClient|publicUrlForStoredAsset/, 'a screenshot goes through the service role or the public resolver');
  assert.match(s, /export const GIFT_SHOT_TTL_SECONDS = 600;/);

  /* The guest's read holds no screenshot, and signs nothing. */
  assert.doesNotMatch(guest, /displayUrlForPrivateStoredAsset|giftShotEventPolicy|shotUrl|screenshot_r2_key|GIFT_RECORD_SELECT|GIFT_SHOT_FIELDS/);

  /* The writer hands the read on, and says a refusal as a refusal — never "no screenshot". */
  const w = flat(WRITER);
  assert.match(w, /if \(op === 'gift-shot'\) \{ const shot = await readGiftShotUrl\(supabase, eventId, id\); if \(shot\.read\) return \{ ok: true, shotUrl: shot\.url \}; return \{ ok: false, error: shot\.gone \? GIFT_GONE : GIFT_SHOT_UNREAD \}; \}/);

  /* THE SCREEN: one picture, in the one open gift — asked for when its sheet opens, only if the
     record has one; reused while its address lives; a refusal forgotten so Try again asks again. */
  const ui = flat(GIFTS);
  assert.deepEqual([...ui.matchAll(/<img src=\{([^}]+)\}/g)].map((m) => m[1]), ['shot.url']);
  const row = ui.slice(ui.indexOf('function GiftThumb('), ui.indexOf('export function GiftRow('));
  assert.doesNotMatch(row, /<img|shotUrl/, 'a row of the list draws the screenshot');
  assert.match(ui, /const needsShot = gift\.hasShot && !gift\.shotUrl; useEffect\(\(\) => \{ if \(!needsShot\) return; let open = true; askShot\.current\(\)\.then\(/);
  assert.match(ui, /\}, \[needsShot, shotTry\]\);/);
  const list = flat(LIST);
  const see = list.slice(list.indexOf('const shots = useRef('), list.indexOf('const rows = useRef('));
  inOrder(
    see,
    [
      'const held = shots.current.get(id);',
      'if (held && Date.now() - held.at < SHOT_REUSE_MS) return held.url;',
      "const url = action(form({ wish_op: 'gift-shot', gift_record_id: id })).then((res) => {",
      'if (!res.ok) throw new Error(res.error);',
      'shots.current.set(id, { at: Date.now(), url });',
      'url.catch(() => { if (shots.current.get(id)?.url === url) shots.current.delete(id); });',
    ],
    'seeShot',
  );
  assert.match(list, /const SHOT_REUSE_MS = 8 \* 60 \* 1000;/);
  assert.match(list, /onShot=\{\(\) => seeShot\(giftOpen\.id\)\}/);
  /* It is asked for by an OPEN gift only — never while the list is drawn. */
  assert.equal([...list.matchAll(/seeShot\(/g)].length, 1);
  assert.equal([...list.matchAll(/'gift-shot'/g)].length, 1);
});

test('9 · the gift screens ride the lazy Studio chunk — one importer, never the Maker’s first load', () => {
  const importers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /studio-wish-gifts['"]/.test(readFileSync(full, 'utf8'))) importers.push(full.slice(WEB.length + 1));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  walk(join(WEB, 'components'));
  assert.deepEqual(importers, [LIST], 'the gift screens are imported from somewhere other than the wish list');
  /* …and the wish list itself is still reached only through the lazy tools door. */
  const tools = read(`${L}/studio-tools.tsx`);
  assert.match(tools, /import \{ StudioWishList \} from '\.\/studio-wish-list';/);
});


test('10 · ⚡ a press costs one request and renders no page', () => {
  const door = flat(`${P}/actions.ts`);
  const at = door.indexOf("if (formData.has('wish_op')) {");
  assert.ok(at > 0);
  const branch = door.slice(at, door.indexOf('const methodKind', at));
  /* `revalidatePath` inside an action makes Next render the action's own route into its answer
     (the whole Maker). So the guests' pages are refreshed AFTER the answer is sent — and the one
     READ that rides this door refreshes nothing at all. */
  inOrder(
    branch,
    [
      'const wish = await wishListWrite(eventId, formData);',
      "const changed = wish.ok || ('kept' in wish && wish.kept === true);",
      "if (changed && formData.get('wish_op') !== GIFT_READ_OP) after(() => revalidateSurfaces(eventId));",
      'return wish;',
    ],
    'the wish list’s door',
  );
  assert.doesNotMatch(branch, /await revalidateSurfaces|revalidatePath\(|revalidateTag\(|redirect\(/, 'the door renders the Maker into its own answer');
  assert.match(door, /import \{ after \} from 'next\/server';/);
  /* The writers themselves refresh nothing, and set no cookie of their own. */
  for (const f of [WRITER, `${P}/wish-items.server.ts`]) assert.doesNotMatch(read(f), /revalidatePath|revalidateTag|from 'next\/cache'|cookies\(\)/, `${f} revalidates`);
  /* The screens: no timer, no poll, no refresh of their own. */
  for (const f of [GIFTS, `${L}/studio-wish-sheet.tsx`]) assert.doesNotMatch(read(f), /setInterval|setTimeout|router\.refresh|requestMakerRefresh|useRouter/, `${f} polls or refreshes`);
});

test('11 · "Gifts sent to you" is a screen of its own — the rest of E-Gifts stands down while it is open', () => {
  /* One CSS rule on the E-Gifts wrapper: while a child holds the gifts screen, every OTHER child
     is hidden. No script — and nothing added to the files the Maker loads first. */
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8').replace(/\s+/g, ' ');
  assert.match(
    css,
    /\[data-details-egifts\]:has\(\[data-studio-wish-list='gifts'\]\) > :not\(\[data-studio-wish-list='gifts'\]\):not\(:has\(\[data-studio-wish-list='gifts'\]\)\) \{ display: none; \}/,
  );
  const details = flat(`${L}/maker-details.tsx`);
  assert.match(details, /<div className="flex flex-col gap-3" data-details-egifts="">\s*\{ap\.editors\.gifts\}\s*<StudioTool part="gifts"/, 'the wrapper the rule keys on is gone');
  /* …and the mark it keys on is the one the wish list wears while the gifts screen is open — and only then. */
  const list = flat(LIST);
  assert.match(list, /if \(allGifts\) \{ return \( <section data-studio-wish-list="gifts" className="flex flex-col"> <GiftsSent/);
  assert.equal([...list.matchAll(/data-studio-wish-list="gifts"/g)].length, 1);
  /* ✓ Done brings everything back; nothing was unmounted to hide it. */
  assert.match(list, /onDone=\{\(\) => setAllGifts\(false\)\}/);
});
