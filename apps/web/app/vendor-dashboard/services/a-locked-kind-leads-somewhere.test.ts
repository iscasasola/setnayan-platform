/**
 * a-locked-kind-leads-somewhere.test.ts — S3: the greyed pill used to explain
 * and stop. It should lead somewhere.
 *
 * 🔴 THE COMPLAINT. `lib/vendor-category-parents.ts` already greys a kind of
 * service the shop's plan cannot hold, with one reason sentence for the whole
 * greyed set. The sentence explained and stopped — there was nowhere for a
 * supplier to actually go. Asked where it should lead (the pricing page, or
 * the "tell us what you do" intake) the owner picked the intake — the same
 * `proposeCategory` form already shipped on My Shop's Tools tab.
 *
 * ⚖ WHAT IS PINNED HERE, AND WHY EACH ONE IS SEPARATE:
 *   1. the pill stays disabled — the link is NOT the pill, so it must not
 *      start submitting on click;
 *   2. the destination exists — one shared href, not a hand-typed string that
 *      can drift from the id it is supposed to scroll to;
 *   3. the return path exists — a supplier who followed the link can get back
 *      to the card they were building, and the maker's own draft-keep is what
 *      "comes back" actually means, not a second copy of that mechanism.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const MANAGER = 'app/vendor-dashboard/services/_components/services-manager.tsx';
const ACTIONS = 'app/vendor-dashboard/services/actions.ts';
const ANCHOR = 'lib/service-picker-anchor.ts';
const REQUEST_PAGE = 'app/vendor-dashboard/services/requests/new/page.tsx';
const REQUEST_FORM = 'app/vendor-dashboard/services/requests/_components/name-fields.tsx';

test('the files under test actually read back', () => {
  assert.ok(read(MAKER).length > 5000, 'the maker read back empty');
  assert.ok(read(MANAGER).length > 5000, 'the manager read back empty');
  assert.ok(read(ACTIONS).length > 5000, 'the actions file read back empty');
  assert.ok(read(ANCHOR).length > 500, 'the anchor lib read back empty');
});

// ---------------------------------------------------------------------------
// 1 · THE PILL IS STILL DISABLED — the link lives beside it, not on it
// ---------------------------------------------------------------------------

test('a locked pill is still a disabled button, not a link', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /disabled=\{locked\}/,
    'a locked kind became pressable — it would be refused after the whole card was written',
  );
  // The pill's own JSX must not carry an href — the link is the reason
  // sentence beside it, never the pill itself.
  // (The simpler maker draws kinds as ROWS — `KindRow`, 2026-10-14 — the rule is the same.)
  const rowFn = src.slice(src.indexOf('function KindRow'), src.indexOf('function ChipGroup'));
  assert.ok(rowFn.length > 200, 'KindRow could not be read');
  assert.ok(!/href=/.test(rowFn), 'the kind row itself started carrying a link');
});

// ---------------------------------------------------------------------------
// 2 · THE DESTINATION EXISTS — one shared href, imported, not hand-typed
// ---------------------------------------------------------------------------

test('the anchor lib declares one id, one param and one href for the intake', () => {
  const src = read(ANCHOR);
  assert.match(src, /export const PROPOSE_CATEGORY_ANCHOR_ID = 'propose-category';/, 'the anchor id is gone');
  assert.match(src, /export const PROPOSE_CATEGORY_PARAM = 'wantCategory';/, 'the intent param is gone');
  assert.match(
    src,
    // 2026-11-13: the door opens the category browse page (owner rulings, service requests), still
    // carrying the same intent param so that page can offer "Back to your card".
    /export const PROPOSE_CATEGORY_HREF =\s*\n\s*`\/vendor-dashboard\/services\/requests\/new\?\$\{PROPOSE_CATEGORY_PARAM\}=1` as const;/,
    'the href stopped being built from the same param it must match',
  );
  assert.match(src, /export function proposeCategoryRequested/, 'the reader for the intent param is gone');
});

test('the reason sentence links to the shared href, imported not hand-typed', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /import \{ PROPOSE_CATEGORY_HREF \} from '@\/lib\/service-picker-anchor';/,
    'the maker stopped importing the shared destination',
  );
  assert.match(
    src,
    /\{lockedWhy \? \([\s\S]{0,400}<Link\s+href=\{PROPOSE_CATEGORY_HREF\}/,
    'the one reason sentence stopped leading anywhere',
  );
  // One link for the whole greyed set — not one per row — plus the kind sheet's own "Ask us" row (the 2026-10-14
  // prototype: "Something else · … · Ask us — Tell us what you do in your own words").
  const linkCount = (src.match(/href=\{PROPOSE_CATEGORY_HREF\}/g) ?? []).length;
  assert.equal(linkCount, 2, `PROPOSE_CATEGORY_HREF is linked ${linkCount} times, expected 2 (Ask us + the reason sentence)`);
  assert.match(src, /href=\{PROPOSE_CATEGORY_HREF\}[\s\S]{0,400}Ask us/, 'the kind sheet lost its Ask us row');
});

test('the intake tab opens on arrival, and scrolls to itself', () => {
  const manager = read(MANAGER);
  assert.match(
    manager,
    /PROPOSE_CATEGORY_ANCHOR_ID,\s*\n\s*proposeCategoryRequested,/,
    'the manager stopped importing the shared id and reader',
  );
  assert.match(
    manager,
    /const wantsCategoryForm = proposeCategoryRequested\(search\.wantCategory\);/,
    'the manager stopped reading the intent param',
  );
  // 🔁 2026-11-09 (Build 3 Lane E item 7): the Tools tab is gone — the block now DRAWS when it was asked for.
  // 🔁 2026-11-13: …or when the shop has requests to show (the "Your requests" row lives in it).
  assert.match(
    manager,
    /const showProposeForm = search\.requested \|\| wantsCategoryForm;/,
    'arriving from a locked kind stopped drawing the block',
  );
  assert.match(
    manager,
    /\{showProposeForm \|\| myRequests\.length > 0 \|\| !requestsMeasured \? \(/,
    'the Requests block stopped drawing for an intent, for a shop with requests, or for a refused read',
  );
  assert.match(
    manager,
    /id=\{PROPOSE_CATEGORY_ANCHOR_ID\}/,
    'the propose-a-category section lost the id the href scrolls to',
  );
});

// ---------------------------------------------------------------------------
// 3 · THE RETURN PATH EXISTS — comes back to the card being made
// ---------------------------------------------------------------------------

test('arriving from a locked kind offers an explicit way back to the card', () => {
  const manager = read(MANAGER);
  assert.match(
    manager,
    /wantsCategoryForm \? \([\s\S]{0,400}<Link\s+href=\{SERVICE_MAKER_HREF\}/,
    'the explicit "back to your card" link is gone',
  );
});

test('the return survives the submit — the intent is carried through the redirect', () => {
  // 2026-11-13: the form moved to the category-browse page; the Services block's door carries the
  // intent there, and the page posts it on.
  const manager = read(MANAGER);
  assert.match(
    manager,
    /href=\{wantsCategoryForm \? `\$\{SERVICE_REQUEST_NEW_HREF\}\?wantCategory=1` : SERVICE_REQUEST_NEW_HREF\}/,
    'the Services door stopped carrying the intent to the request page',
  );
  const page = read(REQUEST_PAGE);
  assert.match(page, /<RequestNameForm[\s\S]{0,120}fromMaker=\{fromMaker\}/, 'the page stopped handing the intent to its form');
  assert.match(
    read(REQUEST_FORM),
    /<input type="hidden" name="from_locked_kind" value=\{fromMaker \? '1' : ''\} \/>/,
    'the request form stopped carrying the intent through the redirect',
  );
  assert.match(page, /const fromMaker = proposeCategoryRequested\(sp\.wantCategory\);/, 'the page stopped reading the intent');
  assert.match(page, /fromMaker \? \([\s\S]{0,300}<Link href=\{SERVICE_MAKER_HREF\}/, 'the page lost its "Back to your card"');
  const actions = read(ACTIONS);
  assert.match(
    actions,
    /const fromLockedKind = formData\.get\('from_locked_kind'\) === '1' \? '&wantCategory=1' : '';/,
    'proposeCategory stopped reading the carried intent',
  );
  // EVERY exit of proposeCategory must carry it, or a validation error, a twin, an insert failure or
  // the AI's "you already have this" silently drops the way back.
  const fn = actions.slice(
    actions.indexOf('export async function proposeCategory'),
    actions.indexOf('export async function updateVendorService'),
  );
  const redirects = fn.match(/redirect\(\s*`[^`]*`/g) ?? [];
  assert.ok(redirects.length >= 3, `proposeCategory has ${redirects.length} redirects — the scan is blind`);
  for (const r of redirects) {
    assert.match(r, /\$\{fromLockedKind\}/, `a proposeCategory redirect dropped the carried intent: ${r}`);
  }
});

test('the way back does not depend on a new mechanism — the maker already offers a kept draft', () => {
  // This is the thing that makes "comes back" true rather than aspirational:
  // the maker autosaves to the vendor's own browser 800ms after every edit and
  // offers it back on the next visit to a blank maker. A second, competing
  // return mechanism here would be the exact kind of thing this repo keeps
  // paying for — see lib/canvas-draft-keep.ts.
  const maker = read(MAKER);
  assert.match(maker, /window\.localStorage\.setItem\(keepKey/, 'the draft keep the return path relies on is gone');
  assert.match(maker, /Picked up where you left off\?/, 'the offer-it-back prompt the return path relies on is gone');
});
