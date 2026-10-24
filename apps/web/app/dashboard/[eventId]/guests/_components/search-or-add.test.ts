/**
 * search-or-add.test.ts — SEARCH OR ADD on Guests (owner 2026-10-24, verbatim: *"it is search or add for both guests
 * and suppliers"*). Measured on the RENDER (the real `GuestsScreen`, `render-guests-screen.ts`), not the source:
 *
 *   1. a search with hits keeps the hits in place AND ends with "Add “…” as a guest" — one, the last add on the page;
 *   2. a search with no hit says "Nobody matches “…”. Add them below." and its one add reads the same words;
 *   3. nothing the search draws leaves the page — no link to `/explore`, `/v/` or `/dashboard/search`;
 *   4. the phone's last copy (read-only) offers no add, as before.
 *
 * The Suppliers half is `vendors/search-or-add.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestRow as baseRow, renderGuestsScreen } from './render-guests-screen';
import type { GuestRow } from '@/lib/guests';
import { searchAddLabel, SEARCH_ADD_LABEL_MAX } from '@/components/search-add-row';

const guestRow = (over: Partial<GuestRow> = {}): GuestRow => baseRow({ custom_tags: [], ...over });

const LEAVES = /href="(\/explore|\/v\/|\/dashboard\/search)/;
const count = (html: string, s: string) => html.split(s).length - 1;

test('a search with hits shows them in place and ends with the one Add row', async () => {
  const html = await renderGuestsScreen({
    guests: [guestRow({ first_name: 'Maria', last_name: 'Santos' }), guestRow({ first_name: 'Ben', last_name: 'Cruz' })],
    initialQuery: 'Maria',
  });
  assert.ok(html.includes('Santos'), 'the hit is drawn in place');
  assert.equal(count(html, 'data-search-add=""'), 1, 'exactly one Add row while searching');
  assert.ok(html.includes('aria-label="Add “Maria” as a guest"'), 'the row names what it adds');
  assert.ok(!html.includes('data-no-match'), 'a search with hits has no empty block');
  // Last: no guest row comes after the Add row.
  assert.ok(html.lastIndexOf('data-search-add') > html.lastIndexOf('Santos'), 'the Add row is after the hits');
  assert.doesNotMatch(html, LEAVES);
});

test('a search with no hit points at the Add, in the same words', async () => {
  const html = await renderGuestsScreen({ guests: [guestRow({ first_name: 'Ben', last_name: 'Cruz' })], initialQuery: 'Zzyzx' });
  assert.ok(html.includes('data-no-match'), 'the empty block is drawn');
  assert.ok(html.includes('Nobody matches “Zzyzx”. Add them below.'), 'the empty line points at the Add');
  assert.equal(count(html, 'aria-label="Add “Zzyzx” as a guest"'), 1, 'one add, the same words as the row');
  assert.equal(count(html, 'data-search-add=""'), 0, 'no second add beside the empty block');
  assert.doesNotMatch(html, LEAVES);
});

test('the read-only copy offers no add', async () => {
  const html = await renderGuestsScreen({
    guests: [guestRow({ first_name: 'Maria', last_name: 'Santos' })],
    initialQuery: 'Maria',
    copy: { freshness: 'failed', savedAt: Date.now() },
  });
  assert.equal(count(html, 'data-search-add=""'), 0);
});

test('the Add label fits a phone — a long name is clipped inside its quotes, the "as …" end stays', () => {
  assert.equal(searchAddLabel('Maria', 'a guest'), 'Add “Maria” as a guest');
  const long = searchAddLabel('Seda Vertis North Grand Ballroom and Gardens', 'your own supplier');
  assert.ok(long.length <= SEARCH_ADD_LABEL_MAX, long);
  assert.match(long, /…” as your own supplier$/);
});
