/**
 * an-included-line-has-no-price.test.ts — 🔒 no card render and no maker shows a peso tied to an INCLUDED line.
 *
 * OWNER 11 Nov 2026, verbatim: "The inclusions should not have a price i think because if it had a price, then it
 * should be a service card. And this should be a bundle instead?" · "Yes. Let the other cards adjust as well." ·
 * "They only get price for the service?" (yes). Before this, the Card Maker asked a "Worth ₱5,000" per included line
 * and every card summed them into "· ₱15,000 free" after the Includes list.
 *
 * What is held, on the REAL code:
 *   1. The Card Maker's "What's included" editor (both shapes) draws words only — no Worth row, no `inclusion_worth`
 *      field, no ₱.
 *   2. The shared card snapshot (list rows, Discover/bench cards, chat cards, the maker's live preview) ignores a
 *      posted `inclusion_worth` — the Includes line carries no ₱ and no "free" sum.
 *   3. The legacy JSONB parse and the 3D booth card keep the label only.
 *   4. SOURCE: no render/maker module mentions the worth in code (comments stripped by THE one stripper,
 *      lib/strip-comments.ts), and across app/ + lib/ the stored `worth_php` column is read by exactly two modules —
 *      the save (which carries a stored value forward unseen: hide, don't delete) and the admin plausibility scanner.
 *
 * Not held here, deliberately: Extras (priced add-ons) stay priced; gifts keep "worth ₱X" (they come from Extras); and
 * the Bundle Maker's own "Extra inclusions" lines (`vendor_package_items.replacement_value_centavos`) feed bundle and
 * quote money math, which this change does not touch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { readSnapshot, snapshotFromService } from './service-card-snapshot';
import { parsePackageInclusions } from './vendor-services';
import { InclusionsEditor } from '../app/vendor-dashboard/services/_components/service-list-editors';
import { BoothCardContent } from '../app/_components/plan3d/kit/booth-card-content';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = path.resolve(__dirname, '..');
const read = (rel: string) => readFileSync(path.join(WEB, rel), 'utf8');

test('the Card Maker’s included lines are words only — both shapes of the editor', () => {
  // A legacy draft that still carries a worth (an old saved state) must not resurface it.
  const initial = [{ label: 'Same-day edit', worth: '5000' }, { label: 'Drone' }] as unknown as { label: string }[];
  for (const bare of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(InclusionsEditor, { bare, initial }));
    const where = bare ? 'the maker’s rows' : 'the older fold';
    assert.match(html, /Same-day edit/, `${where}: the line itself is gone`);
    assert.doesNotMatch(html, /inclusion_worth/, `${where}: a worth field posts again`);
    assert.doesNotMatch(html, /inclusion-worth/, `${where}: a worth row is drawn again`);
    assert.doesNotMatch(html, />\s*Worth\s*</, `${where}: a "Worth" label is back`);
    assert.doesNotMatch(html, /₱/, `${where}: a peso is drawn beside an included line`);
  }
});

test('a card’s Includes line has no ₱ and no "free" sum, even when an old tab posts a worth', () => {
  const fd = new FormData();
  fd.append('title', 'Full-day coverage');
  fd.append('category', 'photo_video');
  fd.append('pricing_basis', 'fixed');
  fd.append('starting_price_php', '85000');
  const posted: [string, string][] = [['2 shooters', '5000'], ['Online album', '10000']];
  for (const [label, worth] of posted) {
    fd.append('inclusion_label', label);
    fd.append('inclusion_worth', worth);
  }
  const snap = readSnapshot(fd);
  assert.equal(snap.includesLine, 'Includes: 2 shooters · Online album');
  assert.equal(snap.priceText, 'from ₱85,000', 'the service keeps its ONE price');

  const stored = snapshotFromService(
    { title: 'Full-day coverage', category: 'photo_video', pricing_basis: 'fixed', starting_price_php: 85000 },
    { inclusions: [{ label: '2 shooters', worth_php: 5000 }, { label: 'Online album' }] as { label: string }[] },
  );
  assert.equal(stored.includesLine, 'Includes: 2 shooters · Online album');
  assert.doesNotMatch(JSON.stringify(stored.includesLine), /₱|free/);
});

test('the legacy JSONB parse and the 3D booth card keep the label only', () => {
  assert.deepEqual(parsePackageInclusions([{ label: 'Photo album', worth_php: 2500 }]), [{ label: 'Photo album' }]);
  const html = renderToStaticMarkup(
    React.createElement(BoothCardContent, {
      kind: 'inclusions',
      items: [{ label: 'Photo album', worthPhp: 2500 }] as unknown as { label: string }[],
    }),
  );
  assert.match(html, /Photo album/);
  assert.doesNotMatch(html, /₱|free/, 'the booth card draws a worth chip again');
});

/** Card renders and makers: none may name the worth in code. */
const RENDERS_AND_MAKERS = [
  'app/vendor-dashboard/services/_components/service-list-editors.tsx',
  'app/vendor-dashboard/services/_components/canvas-maker.tsx',
  'app/vendor-dashboard/shop/page.tsx',
  'app/vendor-dashboard/shop/_components/shop-bundle-card.tsx',
  'app/v/[slug]/_components/services-gallery.tsx',
  'app/_components/plan3d/kit/booth-card-content.tsx',
  'app/open-shop/claim-actions.ts',
  'lib/service-card-view-model.ts',
  'lib/service-card-snapshot.ts',
  'lib/bench-service-card.ts',
  'lib/vendor-service-public.ts',
  'lib/vendor-services.ts',
  'lib/vendor-service-drafts.ts',
  'lib/service-card-maker.server.ts',
  'lib/bundle-sums.ts',
  'lib/bundle-cards.server.ts',
  'lib/couple-card-to-canvas.ts',
  'lib/seating-3d.ts',
  'lib/vendor-autoreply/adapter.ts',
  'lib/vendor-autoreply/types.ts',
];

test('no card render or maker names an inclusion’s worth in code', () => {
  const offenders: string[] = [];
  for (const rel of RENDERS_AND_MAKERS) {
    const code = stripComments(read(rel));
    const hits = code.match(/worth_php|worthPhp|inclusion_worth/g) ?? [];
    if (hits.length > 0) offenders.push(`${rel} (${hits.length}× ${[...new Set(hits)].join(', ')})`);
  }
  console.log(`[included-line-has-no-price] scanned ${RENDERS_AND_MAKERS.length} render/maker files, ${offenders.length} offenders`);
  assert.deepEqual(offenders, [], `an included line carries a peso again:\n  ${offenders.join('\n  ')}`);
});

/** The only modules allowed to touch the hidden column (module header, point 4). */
const MAY_READ_STORED_WORTH = new Set([
  'app/vendor-dashboard/services/actions.ts', // carries a stored worth forward on re-save — never shown
  'lib/plausibility-scanner.ts', // admin integrity check, never a card
]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('across app/ and lib/, only the save and the admin scanner touch an inclusion’s stored worth', () => {
  const files = [...sourceFiles(path.join(WEB, 'app')), ...sourceFiles(path.join(WEB, 'lib'))];
  const readers: string[] = [];
  for (const full of files) {
    const src = readFileSync(full, 'utf8');
    if (!/worth_php|inclusion_worth/.test(src)) continue; // cheap pre-filter; the real check is on stripped code
    const rel = path.relative(WEB, full).split(path.sep).join('/');
    const code = stripComments(src);
    // `inclusion_worth` is the maker's old field name: nothing may post or read it any more.
    if (/inclusion_worth/.test(code)) readers.push(`${rel} (inclusion_worth)`);
    // `worth_php` on the inclusions table: a select or an insert that names it.
    if (/vendor_service_inclusions/.test(code) && /worth_php/.test(code) && !MAY_READ_STORED_WORTH.has(rel)) {
      readers.push(`${rel} (worth_php)`);
    }
  }
  console.log(`[included-line-has-no-price] scanned ${files.length} files, ${readers.length} unexpected readers`);
  assert.ok(files.length > 500, `the tree walk found only ${files.length} files — the scan is not looking`);
  assert.deepEqual(readers, [], `the hidden worth is read where a render could reach it:\n  ${readers.join('\n  ')}`);
});
