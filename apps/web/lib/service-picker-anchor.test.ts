/**
 * service-picker-anchor.test.ts — "Create service card" has to LAND somewhere.
 *
 * 🔴 THE BUG. A supplier with no cards yet — including SetnaProd, the owner's
 * own live shop — pressed "+ Create service card" and nothing happened. The
 * page opened, nothing scrolled, nothing opened, no error.
 *
 * 🔑 WHY THE EXISTING GUARD DID NOT CATCH IT, WHICH IS THE POINT OF THIS FILE.
 * `create-follows-the-surface.test.ts` asserted the href, and then asserted that
 * an element with that id EXISTED. Both were true the whole time:
 *
 *   · the href pointed at `/vendor-dashboard/services`, retired since
 *     2026-07-02, whose `redirect()` rebuilds the URL from QUERY PARAMS — so the
 *     `#fragment` was dropped in transit and never reached the target at all;
 *   · the anchor lived in the Service cards TAB, and a vendor with zero cards
 *     lands on Coverage. Panels stay mounted but `hidden`, and no browser
 *     scrolls to an anchor inside a hidden panel;
 *   · and the anchor is a `<details>` that was only `open` for a category
 *     request, so even the right tab showed a shut drawer.
 *
 * **EXISTING IS NOT THE SAME AS REACHABLE.** Three conditions have to hold at
 * once, and a guard that checks one of them passes while the button is dead.
 * Each is asserted separately below, so a regression names which link broke.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  SERVICE_PICKER_ANCHOR_ID,
  SERVICE_PICKER_HREF,
  SERVICE_PICKER_PARAM,
  SERVICE_MAKER_HREF,
  servicePickerRequested,
} from '@/lib/service-picker-anchor';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MANAGER = 'app/vendor-dashboard/services/_components/services-manager.tsx';

// ⚠ Asserted first: under `tsx --test` an `@/lib/…` import has come back with
// EMPTY named exports in this repo, and a guard whose subject is `undefined`
// runs zero checks and reports a pass.
test('the module under test actually loaded', () => {
  assert.equal(typeof servicePickerRequested, 'function', 'servicePickerRequested did not import');
  assert.equal(typeof SERVICE_PICKER_ANCHOR_ID, 'string');
  assert.ok(SERVICE_PICKER_ANCHOR_ID.length > 0, 'the anchor id is empty');
  assert.equal(typeof SERVICE_MAKER_HREF, 'string');
});

// ---------------------------------------------------------------------------
// 1 · THE HREF SURVIVES THE TRIP
// ---------------------------------------------------------------------------

test('the href carries a query param, because a fragment does not reach the server', () => {
  // The server picks the tab and opens the drawer, so the intent must arrive as
  // something the server can read. This is the half that was missing entirely.
  assert.ok(
    SERVICE_PICKER_HREF.includes(`${SERVICE_PICKER_PARAM}=1`),
    'the picker href lost its query param — the server cannot see a #fragment',
  );
  assert.ok(
    SERVICE_PICKER_HREF.endsWith(`#${SERVICE_PICKER_ANCHOR_ID}`),
    'the picker href lost its anchor — it would open the page without scrolling',
  );
  // ⛔ The in-page hash link is RETIRED — every "create a card" control opens the
  // maker now, so the constant had zero callers and a link nobody writes is a
  // door nobody opens. The drawer keeps its anchor id; only the link is gone.
  assert.ok(
    !/export const SERVICE_PICKER_HASH/.test(
      readFileSync(join(WEB, 'lib/service-picker-anchor.ts'), 'utf8'),
    ),
    'the retired in-page picker link came back — point it at the maker instead',
  );
});

test('the href does NOT go through the retired address that eats the fragment', () => {
  // `/vendor-dashboard/services` redirects to My Shop and rebuilds the URL from
  // query params only. Anything sent through it arrives without its anchor.
  assert.ok(
    !SERVICE_PICKER_HREF.startsWith('/vendor-dashboard/services'),
    'the picker href went back through the retired stub, which drops the fragment',
  );
  assert.ok(
    SERVICE_PICKER_HREF.startsWith('/vendor-dashboard/shop'),
    'the picker href stopped pointing at My Shop, where the editor actually lives',
  );
});

test('only an explicit yes opens the drawer', () => {
  assert.equal(servicePickerRequested('1'), true);
  assert.equal(servicePickerRequested('true'), true);
  // Anything else must be silent — an unrecognised value must not open a drawer
  // nobody asked for, and must not throw either.
  for (const nope of ['0', 'false', '', 'yes', undefined, null, 2, {}]) {
    assert.equal(servicePickerRequested(nope), false, `${String(nope)} opened the picker`);
  }
});

// ---------------------------------------------------------------------------
// 2 · THE TARGET IS ACTUALLY REACHABLE
// ---------------------------------------------------------------------------

test('the request lands on the Service cards tab, not Coverage', () => {
  const mgr = read(MANAGER);
  assert.match(
    mgr,
    /const pickerRequested = servicePickerRequested\(search\.newcard\)/,
    'the manager stopped reading the picker request',
  );
  // 🔑 THE DEFECT IN ONE LINE. The tab rule sent an established shop to Service
  // cards via `services.length > 0`, so it was right for everybody EXCEPT the
  // vendor with no cards — who is exactly who the Create button is for.
  assert.match(
    mgr,
    /pickerRequested \|\|[\s\S]{0,120}\?\s*1/,
    'a picker request no longer selects the Service cards tab',
  );
});

test('the drawer is open on arrival — the right tab in front of a shut drawer is the same dead end', () => {
  const mgr = read(MANAGER);
  assert.match(
    mgr,
    /open=\{addCategory !== null \|\| pickerRequested\}/,
    'the picker <details> stopped opening for a picker request',
  );
});

test('the anchor id is stamped from the shared constant, never hand-typed', () => {
  const mgr = read(MANAGER);
  assert.match(mgr, /id=\{SERVICE_PICKER_ANCHOR_ID\}/, 'the anchor id was hand-typed again');
  // The two-hand-typed-things failure this whole module exists to prevent: a
  // href written in one file and an id typed in another drift apart silently.
  assert.ok(
    !/["']add-service-picker["']/.test(mgr),
    'a raw "add-service-picker" string is back in the manager — use the constant',
  );
});

// ---------------------------------------------------------------------------
// 3 · EVERY "MAKE ME A CARD" LINK OPENS THE MAKER
// ---------------------------------------------------------------------------
//
// ⚖ THE DESTINATION CHANGED 2026-08-28 AND THE POINT OF THESE CHECKS DID NOT.
// Owner: *"i just bounces to a page for a link to service card. we want it to
// directly go to a page to create a service card."* The links used to open My
// Shop's drawer — reachable, but a page ABOUT making a card. They open the
// maker now. Both hrefs still live in one module so no caller hand-types either.

test('every Create-a-service link in the product opens the maker', () => {
  // ⚖ ENUMERATED BY GREPPING THE TARGET, NOT FROM A REMEMBERED LIST OF CALLERS.
  // The original report named ONE button. Four links aim a supplier at making a
  // card, and the second is worse than the reported one: the shop's own
  // first-run checklist step "Put up your first service" renders ONLY while the
  // supplier has zero cards.
  const sites = [
    'app/vendor-dashboard/layout.tsx',
    'lib/vendor-first-steps.ts',
    'app/vendor-dashboard/repertoire/page.tsx',
    'app/vendor-dashboard/earnings/surface.tsx',
  ];
  // 🪤 THE FIRST CUT OF THIS ASSERTION WAS DECORATION, AND ONLY A MEASURED
  // MUTATION FOUND IT. It matched the constant anywhere in the file, so
  // reverting one href to a hand-typed string left the IMPORT standing and the
  // guard stayed GREEN — a file-level match cannot say whether the constant is
  // USED. And the negative half assumed JSX (`href=`) while
  // `vendor-first-steps.ts` is a plain object literal (`href:`).
  const usesConstant = /href[:=]\s*\{?\s*SERVICE_MAKER_HREF\s*\}?/;
  const usesRetired = /href[:=]\s*\{?\s*["'`]\/vendor-dashboard\/services/;
  for (const s of sites) {
    const src = read(s);
    assert.match(
      src,
      usesConstant,
      `${s} stopped USING the shared maker href — an import alone is not a link`,
    );
    assert.ok(
      !usesRetired.test(src),
      `${s} points a supplier at the retired services address again`,
    );
  }
});

test('the maker href is a route that exists and draws the card', () => {
  // EXISTING IS NOT THE SAME AS REACHABLE, one level up: a create button that
  // opens a 404 is the same dead end as one that scrolls nowhere.
  assert.equal(SERVICE_MAKER_HREF, '/vendor-dashboard/services/new');
  const page = read('app/vendor-dashboard/services/new/page.tsx');
  assert.ok(page.length > 500, 'the maker route read back empty — this check is pointed at nothing');
  assert.match(page, /<CanvasMaker/, 'the maker route stopped rendering the maker');
});

test('the picker constants survive, because the canvas-off fallback needs them', () => {
  // The 6-step wizard takes its category from the ROUTE, so with the canvas
  // maker switched off `/services/new` hands the vendor back to My Shop's
  // drawer. Deleting these as "dead" would strand that path silently.
  const page = read('app/vendor-dashboard/services/new/page.tsx');
  assert.match(page, /redirect\(SERVICE_PICKER_HREF\)/, 'the canvas-off fallback stopped using the picker');
  assert.match(page, /canvasMakerEnabled\(\)/, 'the maker route stopped checking the flag');
});

test('no new hand-typed picker link creeps back in anywhere', () => {
  // A ceiling, not a list: the next link written by hand fails here rather than
  // in front of a supplier. Scans the vendor tree + the libs that feed it.
  const suspects = [
    'app/vendor-dashboard/layout.tsx',
    'app/vendor-dashboard/repertoire/page.tsx',
    'app/vendor-dashboard/earnings/surface.tsx',
    'lib/vendor-first-steps.ts',
    MANAGER,
  ];
  let scanned = 0;
  for (const s of suspects) {
    const src = read(s);
    scanned++;
    assert.ok(
      !/["'][^"']*\/vendor-dashboard\/services#add-service-picker[^"']*["']/.test(src),
      `${s} hand-typed the old picker deep link`,
    );
  }
  // Anti-empty-sweep floor: if `read` ever starts returning '' the loop above
  // passes vacuously and proves nothing.
  assert.equal(scanned, suspects.length, 'the sweep did not read every file');
  assert.ok(read(MANAGER).length > 1000, 'the manager read back empty — the scan is pointed at nothing');
});

// ---------------------------------------------------------------------------
// ONE DOOR — INCLUDING THE ONES INSIDE MY SHOP (owner 2026-08-28)
// ---------------------------------------------------------------------------
//
// *"also make sure this is connected to the top nav create a card and the link
// from the shop"*. The top bar opened the maker while My Shop's own **Add a
// service** — same words, same intent — still jumped to a drawer of 34 category
// pills. A supplier pressing the same words in two places got two products.

test('My Shop’s own "Add a service" controls open the maker', () => {
  const mgr = read(MANAGER);
  // ⚖ COUNTED, NOT MATCHED ONCE: there are two CREATE links — the section
  // header and the empty state — and the empty state is the one a first-time
  // shop actually presses. A single match would pass with the other still
  // pointing at a wall.
  //
  // A third, added 2026-08-28 (S3), is NOT a create door — a supplier who
  // follows the plan-locked-kind link to "tell us what you do" gets an
  // explicit "Back to your card" link back to the SAME maker, to resume the
  // card they were building. Same href, different intent; if this count ever
  // grows past 3 without a name for the new one, that is the regression this
  // guard exists to catch.
  const toMaker = [...mgr.matchAll(/href=\{SERVICE_MAKER_HREF\}/g)].length;
  assert.equal(toMaker, 3, `expected the two create links plus the S3 return link, found ${toMaker}`);
  assert.ok(
    !/href=\{SERVICE_PICKER_HASH\}/.test(mgr),
    'a shop create link went back to the in-page drawer',
  );
});

test('the drawer survives as the coverage door and the canvas-off fallback', () => {
  // ⛔ What was retired is the LINK, not the target. Deleting the drawer would
  // take "add coverage" with it, and would strand `/services/new` when the
  // canvas maker is switched off — the 6-step wizard cannot ask for a kind.
  const mgr = read(MANAGER);
  assert.match(mgr, /id=\{SERVICE_PICKER_ANCHOR_ID\}/, 'the drawer lost its anchor');
  assert.match(mgr, /Add a service or coverage/, 'the coverage door is gone');
  const page = read('app/vendor-dashboard/services/new/page.tsx');
  assert.match(page, /redirect\(SERVICE_PICKER_HREF\)/, 'the canvas-off fallback lost its target');
});
