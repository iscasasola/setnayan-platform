/**
 * 🗂 THE PICKED CLIENT HAS NINE PAGES — and every door ever written lands on one of them
 * (THE ONE BUILD, 8 Nov 2026 · prototype v113 · B1 step 5 · spec §4).
 *
 *   1. The menu is the owner-approved nine, in order: Details · Chat · Schedule · Quotation · Payment · Forms ·
 *      Files · Hub · Report. Payment and Hub only once the client has booked (v113 `miniKeys`).
 *   2. `pickedPageOf` is total: every legacy `?tab=` resolves (script → Schedule's fold, call → Chat, overview →
 *      Details, activity → Report); unknown → Details; a booked-only page asked of an unbooked client → Details.
 *   3. The switch builds a body for every page from its OWN `_pages/<page>.tsx` file, and builds nothing for a page
 *      the client's menu does not show (null — never an empty page that reads as "nothing here").
 *   4. The client page's flag-ON render IS the picked client: `PickedClientShell` with those bodies and that menu,
 *      and the old tab strip (`RelationshipTabShell`) is gone from it.
 *
 * SABOTAGE (done once, 8 Nov): dropping `bookedOnly: true` from Hub → test 1 RED; mapping `call` to 'details' →
 * test 2 RED; pointing `hub:` at `<ReportPage` in the switch → test 3 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';
import { PICKED_CLIENT_PAGE_IDS, customerCardHref } from '../../../../lib/upcoming-schedule-door';
import {
  PICKED_CLIENT_PAGES,
  pickedMenuFor,
  pickedPageOf,
  visiblePickedPage,
  wantsScriptFold,
} from './_components/picked-client-menu';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('1 · the menu is the approved nine, in order; Payment and Hub only once booked', () => {
  assert.deepEqual(
    PICKED_CLIENT_PAGES.map((p) => p.label),
    ['Details', 'Chat', 'Schedule', 'Quotation', 'Payment', 'Forms', 'Files', 'Hub', 'Report'],
  );
  assert.deepEqual(
    PICKED_CLIENT_PAGES.map((p) => p.id),
    [...PICKED_CLIENT_PAGE_IDS],
    'the menu and the door vocabulary (`customerCardHref`) must be one list',
  );
  assert.deepEqual(
    PICKED_CLIENT_PAGES.filter((p) => p.bookedOnly).map((p) => p.id),
    ['payments', 'hub'],
  );
  assert.deepEqual(
    pickedMenuFor(false).map((p) => p.id),
    ['details', 'chat', 'schedule', 'quote', 'forms', 'files', 'report'],
  );
  assert.equal(pickedMenuFor(true).length, 9);
  assert.equal(customerCardHref('S89E-ABC', 'files'), '/vendor-dashboard/clients/S89E-ABC?tab=files');
});

test('2 · every ?tab= a door has ever written lands on a page', () => {
  for (const id of PICKED_CLIENT_PAGE_IDS) assert.equal(pickedPageOf(id), id);
  assert.equal(pickedPageOf('script'), 'schedule');
  assert.equal(pickedPageOf('call'), 'chat');
  assert.equal(pickedPageOf('overview'), 'details');
  assert.equal(pickedPageOf('activity'), 'report');
  assert.equal(pickedPageOf('quotation'), 'quote');
  assert.equal(pickedPageOf(null), 'details');
  assert.equal(pickedPageOf('nonsense'), 'details');
  // A booked-only page asked of an unbooked client never draws an empty page: Payment → the Quotation (#38, no Payment
  // page before booking — the money is the quote), Hub → Details.
  assert.equal(visiblePickedPage('payments', false), 'quote');
  assert.equal(visiblePickedPage('hub', false), 'details');
  assert.equal(visiblePickedPage('hub', true), 'hub');
  assert.equal(wantsScriptFold('script'), true);
  assert.equal(wantsScriptFold('schedule'), false);
});

test('3 · the switch draws each page from its own file, and nothing for a page the menu hides', () => {
  const sw = read('_pages/switch.tsx');
  const component: Record<string, string> = {
    details: 'DetailsPage',
    chat: 'ChatPage',
    schedule: 'SchedulePage',
    quote: 'QuotationPage',
    payments: 'PaymentPage',
    forms: 'FormsPage',
    files: 'FilesPage',
    hub: 'HubPage',
    report: 'ReportPage',
  };
  const file: Record<string, string> = {
    details: 'details',
    chat: 'chat',
    schedule: 'schedule',
    quote: 'quotation',
    payments: 'payment',
    forms: 'forms',
    files: 'files',
    hub: 'hub',
    report: 'report',
  };
  for (const id of PICKED_CLIENT_PAGE_IDS) {
    const name = component[id];
    assert.ok(name, `no component named for '${id}'`);
    assert.ok(existsSync(join(HERE, '_pages', `${file[id]}.tsx`)), `_pages/${file[id]}.tsx is missing`);
    assert.match(sw, new RegExp(`import \\{ ${name} \\} from '\\./${file[id]}';`), `${name} is not imported from its own file`);
    const entry = sw.slice(sw.indexOf(`    ${id}: only(`), sw.indexOf('\n', sw.indexOf(`    ${id}: only(`) + 1) + 400);
    assert.match(entry, new RegExp(`^    ${id}: only\\(\\s*'${id}',[\\s\\S]*?<${name}\\b`), `the '${id}' body is not ${name}`);
  }
  assert.match(sw, /const shown = new Set\(pickedMenuFor\(ctx\.isBooked\)\.map\(\(e\) => e\.id\)\);/);
  assert.match(sw, /shown\.has\(id\) \? node : null/, 'a hidden page must build nothing');
});

test('4 · the client page (flag ON) draws the picked client, not the old tab strip', () => {
  const page = read('page.tsx');
  assert.equal((page.match(/<RelationshipTabShell\b/g) ?? []).length, 0, 'the old tab strip is back');
  assert.equal((page.match(/<PickedClientShell\b/g) ?? []).length, 1, 'one picked client');
  const shell = page.slice(page.indexOf('<PickedClientShell'));
  assert.match(shell, /menu=\{pickedMenuFor\(isBooked\)/, 'the menu is the client’s own (booked or not)');
  assert.match(shell, /initialPage=\{visiblePickedPage\(rawTab, isBooked\)\}/, 'the URL’s page is painted on the server');
  assert.match(shell, /bodies=\{bodies\}/);
  assert.match(page, /const bodies = pickedPageBodies\(/);
});
