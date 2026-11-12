/**
 * 🔗 A LEGACY `#<page>` LINK OPENS ITS PAGE, NOT CHAT (live bug, 12 Nov 2026).
 *
 * Notifications written before the picked shell routed by `?tab=` still carry `…/vendors/<id>/workspace#payments`. The
 * server never sees a hash, so the shell opened on the menu's first page (Chat) — a payment notice landed on the
 * conversation. The ONE picked shell now reads the hash after mount when `?tab=` is absent, through the side's own
 * alias table, and rewrites the URL to `?tab=`.
 *
 *   1. `#payments` (no `?tab=`) → Payment, flagged `fromHash` (the URL is normalised); legacy names map (`#quotation`).
 *   2. `?tab=` wins over a hash; a hash that is a real anchor (`#promote-coordinator`) is not a page.
 *   3. The shell reads `window.location.hash` through `pickedPageFromUrl` and rewrites to `?tab=`; the host's picked
 *      supplier hands it `pickedSupplierPageOf`.
 *   4. No shipped emitter writes a `workspace#<page>` link any more.
 *
 * SABOTAGE (done once, 12 Nov): the hash branch in `pickedPageFromUrl` returning null → 1 RED; the `if (tab)` branch
 * removed so the hash wins → 2 RED; `pageOf={pickedSupplierPageOf}` dropped → 3 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { pickedPageFromUrl } from './picked-url-page';
import {
  pickedSupplierMenuFor,
  pickedSupplierPageOf,
  visiblePickedSupplierPage,
} from '@/app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-menu';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const MENU = pickedSupplierMenuFor({ quote: true, chat: true });
const IDS = MENU.map((m) => m.id);

test('1 · a `#payments` link with no `?tab=` lands on Payment, not Chat', () => {
  // The server's first paint — no hash visible — is Chat; the mount read must move it.
  assert.equal(visiblePickedSupplierPage(null, MENU), 'chat');
  assert.deepEqual(pickedPageFromUrl('', '#payments', IDS, pickedSupplierPageOf), { page: 'payments', fromHash: true });
  for (const [hash, page] of [
    ['#quotation', 'quote'],
    ['#quote', 'quote'],
    ['#payment', 'payments'],
    ['#forms', 'forms'],
    ['#schedule', 'schedule'],
    ['#files', 'files'],
    ['#documents', 'files'],
    ['#details', 'details'],
    ['#chat', 'chat'],
    ['#Payments', 'payments'],
  ] as const) {
    assert.deepEqual(pickedPageFromUrl('', hash, IDS, pickedSupplierPageOf), { page, fromHash: true }, hash);
  }
});

test('2 · `?tab=` wins; an anchor that names no page is left alone', () => {
  assert.deepEqual(pickedPageFromUrl('?tab=chat', '#payments', IDS, pickedSupplierPageOf), { page: 'chat', fromHash: false });
  assert.deepEqual(pickedPageFromUrl('?tab=payments', '#deposit', IDS, pickedSupplierPageOf), { page: 'payments', fromHash: false });
  assert.equal(pickedPageFromUrl('', '#promote-coordinator', IDS, pickedSupplierPageOf), null);
  assert.equal(pickedPageFromUrl('', '', IDS, pickedSupplierPageOf), null);
  // A page this menu does not offer (no Quotation for a supplier the host added) is not opened from a hash either.
  const noQuote = pickedSupplierMenuFor({ quote: false, chat: true }).map((m) => m.id);
  assert.equal(pickedPageFromUrl('', '#quote', noQuote, pickedSupplierPageOf), null);
  // Without a side's alias table, only the page ids themselves are read.
  assert.deepEqual(pickedPageFromUrl('', '#files', IDS), { page: 'files', fromHash: true });
  assert.equal(pickedPageFromUrl('', '#quotation', IDS), null);
});

test('3 · the ONE shell reads the hash and rewrites to ?tab=; the host side hands it its alias table', () => {
  const shell = read('_components/picked/picked-shell.tsx');
  assert.match(shell, /pickedPageFromUrl<P>\(window\.location\.search,\s*window\.location\.hash,/);
  assert.match(shell, /if \(found\.fromHash\)[\s\S]{0,200}searchParams\.set\('tab', found\.page\)[\s\S]{0,120}replaceState/);
  const supplier = read('dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx');
  assert.match(supplier, /pageOf=\{pickedSupplierPageOf\}/);
});

test('4 · no shipped emitter writes a `workspace#<page>` link', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.') || name === 'dev') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        if (/\/workspace#[a-z]/.test(stripComments(readFileSync(p, 'utf8')))) offenders.push(p);
      }
    }
  };
  walk(APP);
  walk(join(APP, '..', 'lib'));
  assert.deepEqual(offenders, []);
});
