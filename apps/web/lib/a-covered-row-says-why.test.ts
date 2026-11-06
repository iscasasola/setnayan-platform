/**
 * A COVERED ROW SAYS WHY — a supplier drawn under a category through their
 * "Also covers" always carries the category they were booked under.
 *
 * Owner 2026-10-21, on Seda Vertis North shown as a bare 🔒 name under Cake,
 * Catering and Bridal Car (it looked like a bug): *"Put '· with Reception' on
 * the covered rows"*. The data already knew (`ShortlistVendor.includedWith`,
 * the home row's label); no surface said it.
 *
 * Executed, not grepped, over EVERY row the Suppliers page can draw on a
 * wedding: a booked reception venue covers that row (`coverKeyForTile`), the
 * page's own builder places the copy, and then
 *   1. the Find row's collapsed line (`lockedNamesOf`, the one the row renders)
 *      names the copy "<supplier> · with <their row>", and the home row's own
 *      line stays the bare name;
 *   2. the Build line built from the same folders (`buildLinesOf`, fed the way
 *      the page feeds it) names it the same, and the "This build" card row too;
 *   3. a row's own booking is listed before a covered one, so "· with …" sits
 *      right after the supplier it belongs to.
 * Then the three drawing sites are held to the one door: the Find row derives
 * its names through `lockedNamesOf`, the Build line prints `shownName`, the
 * page hands `includedWith` to `buildLinesOf` — and no file but
 * `lib/covered-row-name.ts` spells " · with ${…}".
 *
 * SABOTAGE (2026-10-21, each seen red, then restored green — PR body): make
 * `coveredRowName` return the bare name · drop `includedWith` from the page's
 * `buildLinesOf` input · print `line.booked.name` in the Build line · put the
 * Find row back on `.map((v) => v.name)`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { buildShortlistFolders, coverKeyForTile } from '@/lib/shortlist-taxonomy';
import { WEDDING_TILES_BY_PARENT, WEDDING_TILE_LABEL } from '@/lib/taxonomy';
import { buildLinesOf, buildViewOf } from '@/lib/suppliers-build';
import { teamMoney } from '@/lib/your-team';
import { coveredRowName, lockedNamesOf } from '@/lib/covered-row-name';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const ALL_TILES = Object.values(WEDDING_TILES_BY_PARENT).flat() as string[];
const VENUE = 'Seda Vertis North';

const venueCovering = (covers: string[]) => ({
  vendor_id: 'v-seda',
  vendor_name: VENUE,
  category: 'venue',
  status: 'contracted',
  total_cost_php: 1_056_000,
  covers_plan_groups: covers,
});
const cakeShop = {
  vendor_id: 'v-asukal',
  vendor_name: 'Asukal Cakes',
  category: 'cake_maker',
  status: 'contracted',
  total_cost_php: 40_000,
};

const foldersFor = (rows: object[]) =>
  buildShortlistFolders({ vendorRows: rows as never, eventType: 'wedding', faithSet: new Set(), eventId: 'e' });

test('the walk is not vacuous', () => {
  assert.ok(ALL_TILES.length >= 60, `only ${ALL_TILES.length} rows`);
  const folders = foldersFor([venueCovering(['cake', 'catering'])]);
  const copies = folders.flatMap((f) => f.tiles.flatMap((t) => t.vendors.filter((v) => v.includedWith != null)));
  assert.ok(copies.length >= 2, 'the venue was not drawn again under Cake and Catering');
});

test('the formatter: "<supplier> · with <their row>", the bare name otherwise', () => {
  assert.equal(coveredRowName(VENUE, 'Reception'), 'Seda Vertis North · with Reception');
  assert.equal(coveredRowName(VENUE, null), VENUE);
  assert.equal(coveredRowName(VENUE, undefined), VENUE);
  assert.equal(coveredRowName(VENUE, '  '), VENUE);
});

test('1 · every covered Find row names the row the supplier was booked under', () => {
  let covered = 0;
  for (const tile of ALL_TILES) {
    const folders = foldersFor([venueCovering([coverKeyForTile(tile)])]);
    for (const t of folders.flatMap((f) => f.tiles)) {
      const seda = t.vendors.find((v) => v.vendorId === 'v-seda');
      if (!seda) continue;
      const names = lockedNamesOf(t.vendors);
      if (seda.includedWith == null) {
        assert.deepEqual(names, [VENUE], `${t.tile}: the venue's own row must stay the bare name`);
        continue;
      }
      covered += 1;
      assert.ok(seda.includedWith.trim().length > 0, `${t.tile}: a copy with no source row`);
      assert.deepEqual(
        names,
        [`${VENUE} · with ${seda.includedWith}`],
        `${t.tile}: a covered row drew "${names.join(' · ')}" — it must say which row booked them`,
      );
    }
  }
  assert.ok(covered >= 50, `only ${covered} covered rows were walked`);
});

test("2 · the Build line and the build's card name a covered supplier the same way", () => {
  const folders = foldersFor([venueCovering(['cake', 'catering'])]);
  const tiles = folders.flatMap((f) => f.tiles).filter((t) => t.vendors.length > 0);
  const lines = buildLinesOf({
    // Fed exactly as `vendors/page.tsx` feeds it.
    tiles: tiles.map((t) => ({
      tile: t.tile,
      label: t.label,
      vendors: t.vendors.map((v) => ({
        vendorId: v.vendorId,
        name: v.name,
        status: v.status,
        planGroupId: v.planGroupId,
        lockState: v.lockRequestState,
        includedWith: v.includedWith,
      })),
    })),
    priceOf: (id) => (id === 'v-seda' ? 1_056_000 : null),
    inBuild: new Set(),
    blocked: new Map(),
  });
  const coveredLines = lines.filter((l) => l.booked?.includedWith);
  assert.ok(coveredLines.length >= 2, 'no covered Build line to check');
  for (const l of lines) {
    if (!l.booked) continue;
    const from = tiles.find((t) => t.tile === l.tile)!.vendors.find((v) => v.vendorId === l.booked!.vendorId)!.includedWith;
    assert.equal(l.booked.shownName, coveredRowName(VENUE, from), `${l.tile}: the Build line's name`);
  }
  const view = buildViewOf({
    lines,
    money: teamMoney({ lockedCentavos: 105_600_000, lockedUnpricedCount: 0, candidateCostsPhp: [], budgetPhp: null }),
    dateFit: null,
    dateLabel: null,
    saved: [],
    buildsMeasured: true,
    freeByBuildId: {},
  });
  const rows = view.cards[0]!.rows;
  for (const l of coveredLines) {
    const row = rows.find((r) => r.label === l.label);
    assert.equal(row?.supplier, `Seda · with ${l.booked!.includedWith}`, `${l.label}: the build card's row`);
  }
});

test("3 · a row's own booking is listed before a covered one", () => {
  const folders = foldersFor([venueCovering(['cake']), cakeShop]);
  const cake = folders.flatMap((f) => f.tiles).find((t) => t.tile === 'cake')!;
  assert.deepEqual(lockedNamesOf(cake.vendors), ['Asukal Cakes', `${VENUE} · with ${WEDDING_TILE_LABEL.reception}`]);
});

/* ── The drawing sites go through the one door ───────────────────────────── */

const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the Find row derives its names through lockedNamesOf', () => {
  const src = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.match(src, /const lockedNames = lockedNamesOf\(t\.vendors\);/);
  assert.doesNotMatch(src, /status === 'locked'\)\.map\(\(v\) => v\.name\)/, 'a locked-name list built by hand');
});

test('the Build line prints shownName, and the page hands includedWith to buildLinesOf', () => {
  const body = read('app/dashboard/[eventId]/vendors/_components/build-body.tsx');
  assert.match(body, /\{line\.booked\.shownName\}/);
  assert.doesNotMatch(body, /line\.(booked|pick)\.name\b/, 'a Build line prints the bare name');
  const page = read('app/dashboard/[eventId]/vendors/page.tsx');
  const call = page.slice(page.indexOf('return buildLinesOf({'));
  assert.ok(call.length > 0, 'buildLinesOf is not called on the page any more — re-aim this guard');
  assert.match(call.slice(0, 1500), /includedWith: v\.includedWith/, 'the page drops includedWith on the way to the Build');
});

test('no file but lib/covered-row-name.ts spells " · with ${…}"', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        if (/ · with \$\{/.test(stripComments(readFileSync(p, 'utf8')))) offenders.push(relative(WEB, p));
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(offenders, ['lib/covered-row-name.ts']);
});
