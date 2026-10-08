/**
 * ⚡ "I SENT IT" COSTS ONE REQUEST AND RENDERS NO PAGE — the guest's list is
 * redrawn from the write's own answer (owner rule 2026-10-08: "the least amount
 * of request for the tasks to be done"; controller-2026-10-08/COMMON.md rules
 * 4 · 11; SPEED-PLAN § 7, the wish list's changes 2 and 4).
 *
 * ── WHAT IT COST BEFORE (read from the code) ───────────────────────────────
 * After the record was kept the sheet called `router.refresh()` — the whole
 * gift page rendered again on the server (the event, the reader, the ways to
 * give, the wishes, every gift's sum) to change one line; and the door
 * revalidated two paths by hand.
 *
 * ── WHAT THIS HOLDS ────────────────────────────────────────────────────────
 *   1 · BEHAVIOUR: the list drawn from the answer (`withOwnGift`) is EXACTLY
 *       the list the next read would hand back (`guestWishListFrom` over the
 *       rows with the new record in them) — the sum, "you sent", a wish that
 *       reached its price, and its place at the end;
 *   2 · the edges: a wish that did not reach stays open and in place; a second
 *       gift adds up; a wish that is not on the list changes nothing; the list
 *       handed in is never mutated;
 *   3 · the sheet renders nothing again — no router, no refresh — and hands the
 *       answer to the list; a gift toward NO wish hands in nothing (it is on no
 *       wish's line);
 *   4 · the door ends with the one revalidation door, once, and revalidates no
 *       path by hand;
 *   5 · the write asks for the wish BESIDE its three checks, never after them.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-08, builder EH):
 *   • `withOwnGift` not adding to the reader's own line                 → 1 red;
 *   • a got wish left in place (not sunk to the end)                    → 1 red;
 *   • `withOwnGift` mutating the list it was handed                     → 2 red;
 *   • `router.refresh()` back in the sheet                              → 3 red;
 *   • the list not handed the answer (`onKept` dropped from WishList)   → 3 red;
 *   • the door revalidating `/${slug}/pabuya` by hand again             → 4 red;
 *   • the wish read moved back after the three checks                   → 5 red.
 *
 * Run from apps/web:  npx tsx --test lib/a-kept-gift-is-drawn-not-refetched.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import type { GiftSumRow } from './wish-list';
import { guestWishListFrom, withOwnGift, type GuestWish, type GuestWishRow } from './wish-list-guest';

const WEB = join(__dirname, '..');
const flat = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8')).replace(/\s+/g, ' ');

const SHEET = 'app/[slug]/pabuya/_components/gift-record-sheet.tsx';
const LIST = 'app/[slug]/pabuya/_components/wish-list.tsx';
const TELL = 'app/[slug]/pabuya/_components/gift-tell.tsx';
const DOOR = 'lib/gift-door.server.ts';
const WRITE = 'lib/gift-record.server.ts';

/* A realistic list: five wishes (one already got, one with no price) and eight gift records. */
const wish = (n: number, name: string, price: number | null, got = false): GuestWishRow => ({
  wish_item_id: `w${n}`,
  public_id: `S89H-000000000${n}`,
  name,
  price_php: price,
  photo_r2_key: null,
  note: null,
  sort_order: n,
  got_at: got ? '2026-10-01T00:00:00Z' : null,
});
const WISHES: GuestWishRow[] = [wish(1, 'Air fryer', 4500), wish(2, 'Rice cooker', 3200), wish(3, 'Honeymoon fund', null), wish(4, 'Luggage set', 8900), wish(5, 'Bed linen', 2500, true)];
const rec = (w: string | null, amount: number, removed = false): GiftSumRow => ({ wish_item_id: w, amount_php: amount, removed_at: removed ? '2026-10-02T00:00:00Z' : null });
const SUMS: GiftSumRow[] = [rec('w1', 2000), rec('w1', 2000), rec('w4', 3000), rec(null, 5000), rec('w5', 2500), rec('w3', 1000), rec('w2', 500, true), rec('w4', 900)];
const MINE: GiftSumRow[] = [rec('w4', 900)];
const noUrl = () => null;

const read = (sums: GiftSumRow[], mine: GiftSumRow[], wishes = WISHES): GuestWish[] => {
  const list = guestWishListFrom(wishes, sums, noUrl, mine);
  assert.ok(list.read);
  return list.wishes;
};
const pub = (n: number) => `S89H-000000000${n}`;

test('1 · the list drawn from the answer IS the list the next read would hand back', () => {
  const before = read(SUMS, MINE);

  /* ₱500 toward the air fryer (₱4,000 of ₱4,500): it reaches — the server marks it got. */
  const drawn = withOwnGift(before, { wishId: pub(1), amountPhp: 500, nowGot: true });
  const reread = read([...SUMS, rec('w1', 500)], [...MINE, rec('w1', 500)], WISHES.map((w) => (w.wish_item_id === 'w1' ? { ...w, got_at: '2026-10-08T00:00:00Z' } : w)));
  assert.deepEqual(drawn, reread, 'what the guest is shown after "I sent it" is not what a reload would show');
  const fryer = drawn.find((w) => w.id === pub(1))!;
  assert.deepEqual([fryer.sentPhp, fryer.minePhp, fryer.got], [4500, 500, true]);
  /* It sank to the end, with the wish that was already got; the open ones kept their order. */
  assert.deepEqual(drawn.map((w) => w.name), ['Rice cooker', 'Honeymoon fund', 'Luggage set', 'Air fryer', 'Bed linen']);

  /* A gift that does NOT reach: the sum and the reader's own line grow; nothing moves. */
  const more = withOwnGift(before, { wishId: pub(4), amountPhp: 1000, nowGot: false });
  assert.deepEqual(more, read([...SUMS, rec('w4', 1000)], [...MINE, rec('w4', 1000)]));
  const luggage = more.find((w) => w.id === pub(4))!;
  assert.deepEqual([luggage.sentPhp, luggage.minePhp, luggage.got], [4900, 1900, false]);
  assert.deepEqual(more.map((w) => w.name), before.map((w) => w.name));

  /* A wish with no price takes any amount and never marks itself. */
  const fund = withOwnGift(before, { wishId: pub(3), amountPhp: 2000, nowGot: false });
  assert.deepEqual(fund, read([...SUMS, rec('w3', 2000)], [...MINE, rec('w3', 2000)]));
});

test('2 · the edges: a second gift adds up; an unknown wish changes nothing; the list handed in is never mutated', () => {
  const before = read(SUMS, MINE);
  const frozen = JSON.stringify(before);
  const once = withOwnGift(before, { wishId: pub(2), amountPhp: 700, nowGot: false });
  const twice = withOwnGift(once, { wishId: pub(2), amountPhp: 300, nowGot: false });
  const cooker = twice.find((w) => w.id === pub(2))!;
  assert.deepEqual([cooker.sentPhp, cooker.minePhp], [1000, 1000], 'the removed ₱500 never counted, and the two gifts add up');
  assert.deepEqual(withOwnGift(before, { wishId: 'S89H-NOTONLIST0', amountPhp: 500, nowGot: true }), before);
  /* An amount that is not one adds nothing (the server would have refused it anyway). */
  for (const not of [0, -500, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(withOwnGift(before, { wishId: pub(2), amountPhp: not, nowGot: false }), before);
  }
  /* A wish the couple already marked stays got whatever the answer says. */
  assert.equal(withOwnGift(before, { wishId: pub(5), amountPhp: 100, nowGot: false }).find((w) => w.id === pub(5))!.got, true);
  assert.equal(JSON.stringify(before), frozen, 'withOwnGift changed the list it was handed');
});

test('3 · the sheet renders nothing again: it hands the answer to the list', () => {
  const sheet = flat(SHEET);
  assert.doesNotMatch(sheet, /useRouter|router\.|next\/navigation|\.refresh\(|location\.reload|revalidate/, 'the record sheet renders the page again after a gift');
  assert.match(sheet, /const answer = res\.data as unknown as Kept; setKept\(answer\); onKept\?\.\(answer\);/);
  assert.match(sheet, /onKept\?: \(kept: GiftKept\) => void;/);
  /* The one request of the press (the screenshot went device → storage before it). */
  assert.equal([...sheet.matchAll(/purpose: 'gift-record'/g)].length, 1);

  const list = flat(LIST);
  assert.match(list, /const \[wishes, setWishes\] = useState<readonly GuestWish\[\]>\(served\); useEffect\(\(\) => \{ setWishes\(served\); \}, \[served\]\);/);
  assert.match(list, /onKept=\{\(kept\) => setWishes\(\(cur\) => withOwnGift\(cur, \{ wishId: recording\.id, amountPhp: kept\.amountPhp, nowGot: kept\.nowGot \}\)\)\}/);
  assert.doesNotMatch(list, /useRouter|router\.|\.refresh\(/);

  /* A gift toward NO wish is on no wish's line: nothing on the page changes, so nothing is handed in. */
  const tell = flat(TELL);
  assert.doesNotMatch(tell, /onKept|useRouter|\.refresh\(/);
});

test('4 · the door ends with the one revalidation door — once — and revalidates no path by hand', () => {
  const door = flat(DOOR);
  assert.doesNotMatch(door, /revalidatePath|revalidateTag|from 'next\/cache'/, 'the gift door revalidates a path by hand');
  assert.match(door, /import \{ revalidateGuestSite \} from '@\/lib\/revalidate-site';/);
  assert.equal([...door.matchAll(/revalidateGuestSite\(/g)].length, 1);
  assert.match(door, /if \(!result\.ok\) return said\(result\.error, 422\); revalidateGuestSite\(result\.slug\);/, 'the pages are refreshed only for a record that was kept');
  /* The write itself revalidates nothing. */
  assert.doesNotMatch(flat(WRITE), /revalidatePath|revalidateTag|from 'next\/cache'|revalidateGuestSite/);
  /* …and the one door is the shared one. */
  assert.match(flat('lib/revalidate-site.ts'), /export function revalidateGuestSite\(slug: string \| null \| undefined\): void \{ if \(!slug\) return; revalidatePath\(`\/\$\{slug\}`\); \}/);
});

test('5 · the write asks for the wish BESIDE its three checks, never after them', () => {
  const w = flat(WRITE);
  const fn = w.slice(w.indexOf('export async function recordGift('));
  const all = /const \[eventRes, guestRes, waysRes, wishRes\] = await Promise\.all\(\[(.*?)\]\);/.exec(fn);
  assert.ok(all, 'the four reads are no longer one Promise.all');
  assert.equal([...all[1]!.matchAll(/admin\.from\('events'\)|admin \.from\('guests'\)|admin\.from\('event_egift_methods'\)|admin\.from\('event_wish_items'\)/g)].length, 4);
  assert.match(all[1]!, /wishNamed \? admin\.from\('event_wish_items'\)\.select\(WISH_ITEM_SELECT\)\.eq\('public_id', wishId\)\.eq\('event_id', eventId\)\.maybeSingle\(\) : Promise\.resolve\(\{ data: null, error: null \}\),/);
  /* A malformed id is never sent; an unknown one is still refused in words. */
  assert.match(fn, /const wishNamed = wishId !== '' && PUBLIC_WISH_ID\.test\(wishId\);/);
  assert.match(fn, /if \(wishId !== ''\) \{ if \(!wishNamed\) return \{ ok: false, error: GIFT_WISH_GONE \};/);
  /* After the four: the insert, the sum, and (only when it reaches) the mark — nothing else reads. */
  const after = fn.slice(fn.indexOf(']);', fn.indexOf('const [eventRes, guestRes, waysRes, wishRes]')));
  assert.deepEqual(
    [...after.matchAll(/admin\s*\.from\('(\w+)'\)\s*\.(select|insert|update)\(/g)].map((m) => `${m[2]} ${m[1]}`),
    ['insert event_gift_records', 'select event_gift_records', 'update event_wish_items'],
  );
});
