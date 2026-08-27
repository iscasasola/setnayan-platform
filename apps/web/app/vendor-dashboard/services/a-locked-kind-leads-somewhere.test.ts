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
  const pillFn = src.slice(src.indexOf('function KindPill'), src.indexOf('function CardRegion'));
  assert.ok(!/href=/.test(pillFn), 'the pill itself started carrying a link');
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
    /export const PROPOSE_CATEGORY_HREF =\s*\n\s*`\/vendor-dashboard\/services\?\$\{PROPOSE_CATEGORY_PARAM\}=1#\$\{PROPOSE_CATEGORY_ANCHOR_ID\}` as const;/,
    'the href stopped being built from the same id and param it must match',
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
  // One link for the whole greyed set — not one per pill.
  const linkCount = (src.match(/href=\{PROPOSE_CATEGORY_HREF\}/g) ?? []).length;
  assert.equal(linkCount, 1, `PROPOSE_CATEGORY_HREF is linked ${linkCount} times, expected exactly 1`);
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
  assert.match(
    manager,
    /const defaultTab = search\.requested \|\| wantsCategoryForm/,
    'arriving from a locked kind stopped landing on the Tools tab',
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
  const manager = read(MANAGER);
  assert.match(
    manager,
    /<input type="hidden" name="from_locked_kind" value=\{wantsCategoryForm \? '1' : ''\} \/>/,
    'the form stopped carrying the intent through the redirect',
  );
  const actions = read(ACTIONS);
  assert.match(
    actions,
    /const fromLockedKind = formData\.get\('from_locked_kind'\) === '1' \? '&wantCategory=1' : '';/,
    'proposeCategory stopped reading the carried intent',
  );
  // All three exits of proposeCategory must carry it, or a validation error
  // or an insert failure silently drops the way back.
  const fn = actions.slice(
    actions.indexOf('export async function proposeCategory'),
    actions.indexOf('export async function updateVendorService'),
  );
  const redirects = fn.match(/redirect\(\s*`[^`]*`/g) ?? [];
  assert.equal(redirects.length, 3, `proposeCategory has ${redirects.length} redirects, expected 3`);
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
  assert.match(maker, /You left a card here/, 'the offer-it-back prompt the return path relies on is gone');
});
