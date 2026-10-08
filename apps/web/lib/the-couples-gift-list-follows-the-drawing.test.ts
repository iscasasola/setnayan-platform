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
 *   6 · every change is DRAWN first, saved through the one door, and put back
 *       (and the truth re-read) when the server refuses;
 *   7 · +0 server actions, +0 routes — and the writer never deletes or inserts;
 *   8 · 🔒 the screenshot is signed for a HOST's read only, from this event's
 *       own private folder — the guest's read never signs anything;
 *   9 · the screens ride the lazy Studio chunk, never the Maker's first load.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08):
 *   • the door drawn as the old count-only row                         → 1 red;
 *   • a removed record counted in the sentence                         → 3 red;
 *   • Remove on the first tap                                          → 4 red;
 *   • the save sent before anything is drawn                           → 6 red;
 *   • a refusal that does not put the record back                      → 6 red;
 *   • the writer deleting the row on Remove                            → 7 red;
 *   • a write that forgets the event                                   → 7 red;
 *   • the screenshot signed without the event's folder check           → 8 red;
 *   • the guest's read signing a screenshot                            → 8 red.
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
    'Tita Nene Air fryer · GCash · Tue 3:12 pm "For your merienda machine! Love you both" ₱2,000 sent',
    'no shot Kuya Jun Air fryer · Bank transfer · Mon 9:40 am "Congrats, mga bata." ₱2,000 sent',
    'Ate Grace Luggage set · GCash · Sun 7:05 pm "For the honeymoon!" ₱3,000 sent',
    'Ninong Bert Any gift · GCash · Sun 2:30 pm "Congratulations to you both!" ₱5,000 sent',
    'Lola Cely Bed linen · GCash · Sat 11:20 am "Sweet dreams, apo." ₱2,500 sent',
  ]);
  /* Each row is a button that opens that gift; a screenshot is drawn as the picture itself. */
  assert.equal(html.match(/<button type="button" data-gift-open="/g)?.length, 5);
  assert.equal(html.match(/data-wish-gift-shot="yes"[^>]*><img /g)?.length, 4);
  assert.equal(html.match(/data-wish-gift-shot="none"/g)?.length, 1);
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
      'data-gift-field="toward"',
      '<option value="">{GIFT_ANY}</option>',
      '{GIFT_SHOT_IS_NOT_MONEY}',
      'data-gift-refused=""',
      'data-wish-sheet-foot="gift"',
      "label={asked ? 'Remove it?' : 'Remove'}",
      'label="Done"',
    ],
    'the open gift',
  );
  /* The picture, or the truth about it — never an empty frame. */
  assert.match(open, /\{gift\.shotUrl \? \( <img src=\{gift\.shotUrl\}[^>]*\/> \) : \( <span[^>]*>\{gift\.hasShot \? GIFT_SHOT_UNREAD : GIFT_NO_SHOT\}<\/span> \)\}/);
  /* Kept when the field is left — no Save — and each control is its label's. */
  assert.match(open, /onBlur=\{\(\) => void keep\(\)\}/);
  assert.match(open, /<label className=\{LABEL\} htmlFor=\{`\$\{id\}-amount`\}>/);
  assert.match(open, /<label className=\{LABEL\} htmlFor=\{`\$\{id\}-toward`\}>/);
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

test('6 · every change is drawn first, saved through the one door, and put back when refused', () => {
  const list = flat(LIST);
  const fn = list.slice(list.indexOf('const changeGift = async ('), list.indexOf('const view = wishesWithGifts(wishes, gifts);'));
  assert.ok(fn.length > 300, 'changeGift was not found');
  inOrder(
    fn,
    [
      'const wasGifts = gifts; const wasWishes = wishes;',
      'const next = gifts.map((g) => (g.id === id ? { ...g, ...change } : g));',
      'setGifts(next);',
      'setWishes((cur) => settleDrawn(cur, next, [had.wishId, change.wishId ?? null]));',
      'const res = await makerSave(() => action(form({ gift_record_id: id, ...fields })), requestMakerRefresh);',
      'if (res.ok) return null;',
      'setGifts(wasGifts); setWishes(wasWishes);',
      'requestMakerRefresh();',
      'return res.error;',
    ],
    'changeGift',
  );
  /* The three things a couple can do to a record — and nothing else is sent. */
  assert.match(list, /onAmount=\{\(amountPhp\) => changeGift\(giftOpen\.id, \{ amountPhp \}, \{ wish_op: 'gift-amount', amount: String\(amountPhp\) \}\)\}/);
  assert.match(list, /onMove=\{\(wishId\) => changeGift\(giftOpen\.id, \{ wishId \}, \{ wish_op: 'gift-move', wish_item_id: wishId \?\? '' \}\)\}/);
  assert.match(list, /onRemove=\{\(removed\) => changeGift\(giftOpen\.id, \{ removed \}, \{ wish_op: 'gift-remove', removed: removed \? '1' : '0' \}\)\}/);
  /* A wish that is removed frees its gifts on the screen too ("Any gift"), and takes them back if refused. */
  assert.match(list, /setGifts\(\(cur\) => cur\.map\(\(g\) => \(g\.wishId === id \? \{ \.\.\.g, wishId: null \} : g\)\)\);/);
  assert.match(list, /setWishes\(was\); setGifts\(wasGifts\); setError\(res\.error\);/);
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
  assert.match(w, /export const GIFT_OPS = \['gift-amount', 'gift-move', 'gift-remove'\] as const;/);
  assert.doesNotMatch(w, /\.delete\(|\.insert\(|\.upsert\(|createAdminClient/, 'the couple’s writer deletes, invents or reaches past RLS');
  /* Remove is a timestamp. */
  assert.match(w, /patch = \{ removed_at: removed === '1' \? new Date\(\)\.toISOString\(\) : null \};/);
  /* 🔒 Every read and every write names the event — a record's wish key alone does not. */
  const calls = w.split(/\.from\('(?:event_gift_records|event_wish_items)'\)/).slice(1).map((c) => c.split(';')[0]!);
  assert.equal(calls.length, 6, `the writer’s six table calls were not all found (${calls.length})`);
  for (const c of calls) assert.match(c, /\.eq\('event_id', eventId\)/, `a call forgets the event: ${c.slice(0, 120)}`);
  /* A zero-row write is said, never reported as kept. */
  assert.match(w, /if \(!kept \|\| kept\.length === 0\) return \{ ok: false, error: GIFT_GONE \};/);
  /* Got it follows the sum on every wish touched — the one it left and the one it joined. */
  assert.match(w, /touched\.push\(to\);/);
  assert.match(w, /for \(const wishId of new Set\(touched\.filter\(\(w\): w is string => typeof w === 'string'\)\)\) \{ if \(!\(await settleWishGot\(supabase, eventId, wishId\)\)\) settled = false; \}/);
  assert.match(w, /return settled \? \{ ok: true \} : \{ ok: false, error: GIFT_MARK_NOT_SETTLED \};/);
  assert.equal(existsSync(join(WEB, P, 'gift-actions.ts')), false);
});

test('8 · 🔒 the screenshot is signed for a host’s read only, from this event’s own private folder', () => {
  const s = flat('lib/wish-list.server.ts');
  const host = s.slice(s.indexOf('export async function readStudioWishList('), s.indexOf('export async function readGuestWishList('));
  const guest = s.slice(s.indexOf('export async function readGuestWishList('));
  inOrder(
    host,
    [
      'const shotPolicy = giftShotEventPolicy(eventId);',
      'if (!parseClientRef(ref, shotPolicy)) return;',
      'shotUrls.set(ref, await displayUrlForPrivateStoredAsset(ref, shotPolicy));',
    ],
    'the host read',
  );
  /* A screenshot never goes through the PUBLIC resolver. */
  assert.equal([...host.matchAll(/publicUrlForStoredAsset\(/g)].length, 1, 'only the wish PHOTO is public');
  assert.match(host, /\(ref\) => \(ref \? \(shotUrls\.get\(ref\) \?\? null\) : null\),/);
  /* The guest's read holds no screenshot, and signs nothing. */
  assert.doesNotMatch(guest, /displayUrlForPrivateStoredAsset|giftShotEventPolicy|shotUrls|screenshot_r2_key|GIFT_RECORD_SELECT/);
  /* The only picture address the couple's screens draw is the one the read handed them. */
  const ui = flat(GIFTS);
  assert.deepEqual([...ui.matchAll(/<img src=\{([^}]+)\}/g)].map((m) => m[1]), ['gift.shotUrl', 'gift.shotUrl']);
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
