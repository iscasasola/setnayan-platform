/**
 * SHADOWED-EXPORT GUARD — proves the detector works, proves the qualifier is
 * what makes it usable, and proves it is not vacuous.
 *
 * THE BUG CLASS THIS ENDS
 * -----------------------
 * A file writes its own copy of a rule that already exists, under the same
 * name, in a module the file already imports from. Two definitions of one rule
 * do not stay equal. On 2026-07-27 the booking receipt's local `keptItems`
 * shadowed `@/lib/vendor-packages`'s `keptItems`; the exported one drops
 * add-ons because there is no purchase path for them, the local one did not,
 * and the receipt told couples they had bought things they were never charged
 * for. Nothing went red: shadowing is legal TypeScript.
 *
 * HOW THIS TEST IS SHAPED (house style: select-column-scan.test.ts)
 * ----------------------------------------------------------------
 *  · The repo-wide RATCHET lives in scripts/lint-dup-rule.ts + the committed
 *    scripts/dup-rule.baseline.txt, not here — the baseline file is the review
 *    surface, and a diff you can read beats a constant you cannot.
 *  · What lives HERE is everything that must hold independent of repo state:
 *    the detector finds the shape (T1–T3), the qualifier is load-bearing and
 *    measurably so (T4), the parsers behave (T5–T8), and the scan is not
 *    silently matching nothing (T9).
 *  · T3 is a POSITIVE CONTROL TAKEN FROM HISTORY: the exact import clause and
 *    the exact local declaration from the file as it stood before commit
 *    39ac3c456. If the guard ever stops flagging that, it has stopped working.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractExportedValueNames,
  extractLocalDeclarations,
  extractValueImports,
  scanShadowedExports,
} from './shadowed-export-scan';
import { stripComments } from './source-text';

/** Minimum files the walk must reach, or the scan is broken and T1 is vacuous. */
const MIN_FILES_SCANNED = 2000;

// ── T1–T3 · the detector ─────────────────────────────────────────────────────

test('T1 · a SIBLING shadow is detected — the file imports the module, not the name', () => {
  const page = `
    import { formatCentavosPhp, VENDOR_PACKAGE_SELECT } from '@/lib/vendor-packages';
    export default function Page() {
      const keptItems = pkg.items.filter((i) => !removedIds.has(i.item_id));
      return keptItems.length;
    }
  `;
  const owner = `
    export const VENDOR_PACKAGE_SELECT = 'package_id';
    export function formatCentavosPhp(n: number) { return n; }
    export function keptItems(p: P, ids: string[]) { return p.items; }
  `;

  const imports = extractValueImports(page);
  const fromOwner = imports.filter((i) => i.spec === '@/lib/vendor-packages');
  assert.equal(fromOwner.length, 1, 'the import must be seen');
  assert.equal(
    fromOwner[0]?.names.has('keptItems'),
    false,
    'the file must NOT import the name it shadows — that is the SIBLING shape',
  );

  const owned = extractExportedValueNames(owner);
  assert.ok(owned.has('keptItems'), 'the owning module must export the name');

  const locals = extractLocalDeclarations(page).filter((d) => d.name === 'keptItems');
  assert.equal(locals.length, 1, 'the local declaration must be seen');
  assert.equal(locals[0]?.form, 'const');
});

test('T2 · an IMPORTED shadow is detected — the name is imported AND re-declared inside', () => {
  const src = `
    import { keptItems } from '@/lib/vendor-packages';
    function render() {
      const keptItems = rows.filter(Boolean); // legal TS, silently wins in here
      return keptItems;
    }
  `;
  const imp = extractValueImports(src).find((i) => i.spec === '@/lib/vendor-packages');
  assert.ok(imp?.names.has('keptItems'), 'the name is imported');
  assert.equal(
    extractLocalDeclarations(src).filter((d) => d.name === 'keptItems').length,
    1,
    'and re-declared in an inner scope — this is the shape the type system permits',
  );
});

test('T3 · positive control from HISTORY — the real receipt page, as it shipped', () => {
  // Verbatim from apps/web/app/dashboard/[eventId]/vendors/packages/[bookingId]/
  // page.tsx at 39ac3c456^ — the commit whose message reads "that local
  // `const keptItems` SHADOWED the exported helper of the same name".
  const historical = `
import Link from 'next/link';
import {
  formatCentavosPhp,
  resolveVendorCategory,
  VENDOR_PACKAGE_SELECT,
  type EventVendorPackageRow,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { VENDOR_CATEGORY_LABEL } from '@/lib/vendors';

export default async function Page() {
  const keptItems = pkg.items.filter((i) => !removedIds.has(i.item_id));
  return keptItems.length;
}
`;
  const imp = extractValueImports(historical).find((i) => i.spec === '@/lib/vendor-packages');
  assert.deepEqual(
    [...(imp?.names ?? [])].sort(),
    ['VENDOR_PACKAGE_SELECT', 'formatCentavosPhp', 'resolveVendorCategory'],
    'type-only specifiers must not count as values in reach',
  );
  assert.equal(imp?.names.has('keptItems'), false);
  assert.equal(
    extractLocalDeclarations(historical).some((d) => d.name === 'keptItems'),
    true,
    'the guard must still see the declaration that caused the bug',
  );
});

// ── T4 · the qualifier earns its keep ────────────────────────────────────────

test('T4 · the qualifier is what makes this shippable — measure it, do not assume it', () => {
  const r = scanShadowedExports();
  assert.ok(
    r.unqualifiedCount > r.qualified.length * 20,
    `Unqualified hits (${r.unqualifiedCount}) should dwarf qualified ones (${r.qualified.length}).\n` +
      'If they ever converge, the "file already imports from the owning module" clause has\n' +
      'stopped filtering anything and this guard is about to start crying wolf.',
  );
  // The concrete case: 45 files declare their own `requireAdmin` and NONE of
  // them imports lib/admin/require-admin.ts. The unqualified rule would flag
  // all 45; the qualified rule flags none, because no author had the real one
  // in reach. That is the trade, stated out loud.
  assert.equal(
    r.qualified.some((h) => h.name === 'requireAdmin'),
    false,
    'a local requireAdmin in a file that never imports the real one is OUT of scope by design',
  );
});

// ── T5–T8 · the parsers, directly ────────────────────────────────────────────

test('T5 · type-only imports and exports are excluded on both sides', () => {
  assert.deepEqual(extractValueImports(`import type { Foo } from './x';`), []);
  const mixed = extractValueImports(`import { a, type B, c as d } from './x';`);
  assert.deepEqual([...(mixed[0]?.names ?? [])].sort(), ['a', 'd']);

  const exported = extractExportedValueNames(`
    export type Row = { a: string };
    export interface Thing { b: number }
    export const REAL = 1;
    export function alsoReal() {}
    export { REAL as ALIASED, type Row as R };
  `);
  assert.deepEqual([...exported].sort(), ['ALIASED', 'REAL', 'alsoReal']);
});

test('T6 · default and namespace imports count as having the module in reach', () => {
  const def = extractValueImports(`import Link from 'next/link';`);
  assert.deepEqual([...(def[0]?.names ?? [])], ['Link']);
  const ns = extractValueImports(`import * as kit from './kit';`);
  assert.deepEqual([...(ns[0]?.names ?? [])], ['kit']);
  const both = extractValueImports(`import React, { useState } from 'react';`);
  assert.deepEqual([...(both[0]?.names ?? [])].sort(), ['React', 'useState']);
});

test('T7 · declarations quoted in comments are NOT declarations', () => {
  const src = `
    // const keptItems = something;
    /** Example: \`const keptItems = …\` — prose, not code. */
    const realOne = 1;
  `;
  const names = extractLocalDeclarations(src).map((d) => d.name);
  assert.deepEqual(names, ['realOne']);
  // …and line numbers must survive the strip, or every report points nowhere.
  assert.equal(stripComments(src).split('\n').length, src.split('\n').length);
  assert.equal(extractLocalDeclarations(src)[0]?.line, 4);
});

test('T8 · declaration forms and near-misses', () => {
  const src = `
    const a = 1;
    let b = 2;
    var c = 3;
    function d() {}
    async function e() {}
    class F {}
    const myconstant = 4;
    obj.const = 5;
  `;
  const found = extractLocalDeclarations(src).map((x) => `${x.form} ${x.name}`);
  assert.deepEqual(found.sort(), [
    'class F',
    'const a',
    'const myconstant',
    'function d',
    'function e',
    'let b',
    'var c',
  ]);
});

// ── T9 · anti-vacuity ────────────────────────────────────────────────────────
//
// The failure mode: the walk silently reaches nothing (a directory moves, a
// regex drifts) and the guard passes forever while guarding zero files. That is
// how this bug class survived in the first place — everything downstream of it
// defaulted to empty.

test('T9 · the scan is not silently empty', () => {
  const r = scanShadowedExports();
  assert.ok(
    r.filesScanned >= MIN_FILES_SCANNED,
    `walked ${r.filesScanned} files, expected >= ${MIN_FILES_SCANNED}. A collapsed count ` +
      'makes every other assertion here vacuous.',
  );
  assert.ok(
    r.unqualifiedCount > 100,
    `only ${r.unqualifiedCount} name collisions found across the whole app — the export ` +
      'index or the declaration scan has broken.',
  );
  for (const hit of r.qualified) {
    assert.match(hit.key, /^[^\t]+\t[^\t]+\t[^\t]+$/, 'a baseline key is exactly file⇥name⇥owner');
    assert.ok(hit.line > 0, 'every hit must point at a line');
    assert.notEqual(hit.file, hit.owner, 'a file cannot shadow its own module');
  }
});
