/**
 * 🗂 THE PICKED CLIENT HAS SEVEN TABS — and every door ever written lands on one of them (file name kept from the nine-page
 * build of 8 Nov; the ruling it now holds is the owner's 18 Nov 2026 "THE CLIENT PAGE GOES TO SEVEN TABS — BOTH SIDES").
 *
 *   1. The menu is Chat · Details · Book & Budget · Schedule · Files · Hub · Report, in that order. Hub only once the
 *      client has booked; the page opens on Chat. Payment and Forms are no longer tabs: their door ids stay valid.
 *   2. `pickedPageOf` is total: `payments` → Book & Budget at `#payments`, `forms` → Details at `#forms`, every older
 *      legacy `?tab=` (script, call, overview, activity) as before; unknown → Chat; Hub before booking → Chat.
 *   3. The switch draws every body from its OWN `_pages/<page>.tsx` file: Book & Budget holds the Payment body
 *      (booked) and the Quotation body; Details holds the Forms body; nothing is built for a tab the menu hides.
 *   4. The client page's flag-ON render IS the picked client: `PickedClientShell` with those bodies and that menu.
 *
 * SABOTAGE (18 Nov): putting `{ id: 'payments' … }` back in the menu → test 1 RED; mapping `forms` to 'forms' in the
 * aliases → test 2 RED; dropping `<FormsPage` from the details body → test 3 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../../../../lib/strip-comments';
import { PICKED_CLIENT_PAGE_IDS, customerCardHref } from '../../../../lib/upcoming-schedule-door';
import {
  DEFAULT_PICKED_PAGE,
  FOLDED_PAGE_ANCHORS,
  PICKED_CLIENT_PAGES,
  pickedAnchorOf,
  pickedMenuFor,
  pickedPageNamed,
  pickedPageOf,
  visiblePickedPage,
  wantsScriptFold,
} from './_components/picked-client-menu';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('1 · the menu is the seven tabs, in order (18 Nov); Hub only once booked', () => {
  assert.deepEqual(PICKED_CLIENT_PAGES.map((p) => p.label), ['Chat', 'Details', 'Book & Budget', 'Schedule', 'Files', 'Hub', 'Report']);
  assert.equal(DEFAULT_PICKED_PAGE, 'chat', 'the picked client opens on Chat (owner 11 Nov)');
  assert.equal(PICKED_CLIENT_PAGES[0]!.id, DEFAULT_PICKED_PAGE, 'the default page is the first tab');
  assert.deepEqual(
    PICKED_CLIENT_PAGES.map((p) => p.id),
    PICKED_CLIENT_PAGE_IDS.filter((id) => !FOLDED_PAGE_ANCHORS[id]),
    'the menu is the door vocabulary less the two folded ids',
  );
  assert.deepEqual(Object.keys(FOLDED_PAGE_ANCHORS).sort(), ['forms', 'payments']);
  assert.deepEqual(PICKED_CLIENT_PAGES.filter((p) => p.bookedOnly).map((p) => p.id), ['hub']);
  assert.deepEqual(pickedMenuFor(false).map((p) => p.id), ['chat', 'details', 'quote', 'schedule', 'files', 'report']);
  assert.equal(pickedMenuFor(true).length, 7);
  assert.equal(customerCardHref('S89E-ABC', 'files'), '/vendor-dashboard/clients/S89E-ABC?tab=files');
});

test('2 · every ?tab= a door has ever written lands on a page — and a folded one on its part', () => {
  for (const p of PICKED_CLIENT_PAGES) assert.equal(pickedPageOf(p.id), p.id);
  assert.equal(pickedPageOf('payments'), 'quote');
  assert.equal(pickedAnchorOf('payments'), 'payments');
  assert.equal(pickedPageOf('payment'), 'quote');
  assert.equal(pickedPageOf('forms'), 'details');
  assert.equal(pickedAnchorOf('forms'), 'forms');
  assert.equal(pickedPageOf('script'), 'schedule');
  assert.equal(pickedPageOf('call'), 'chat');
  assert.equal(pickedPageOf('overview'), 'details');
  assert.equal(pickedPageOf('activity'), 'report');
  assert.equal(pickedPageOf('quotation'), 'quote');
  assert.equal(pickedPageOf(null), 'chat');
  assert.equal(pickedPageOf('nonsense'), 'chat');
  assert.equal(pickedPageOf('constructor'), 'chat', 'an inherited key is not an alias');
  assert.equal(pickedPageNamed('nonsense'), null, 'the shell reads an unknown hash as an anchor, not a page');
  assert.equal(pickedPageNamed('payments'), 'quote');
  assert.equal(visiblePickedPage('payments', false), 'quote');
  assert.equal(visiblePickedPage('forms', false), 'details');
  assert.equal(visiblePickedPage('hub', false), 'chat');
  assert.equal(visiblePickedPage('hub', true), 'hub');
  assert.equal(wantsScriptFold('script'), true);
  assert.equal(wantsScriptFold('schedule'), false);
});

test('3 · the switch draws each body from its own file — Book & Budget holds Payment + Quotation, Details holds Forms', () => {
  const sw = read('_pages/switch.tsx');
  const file: Record<string, string> = {
    DetailsPage: 'details',
    ChatPage: 'chat',
    SchedulePage: 'schedule',
    QuotationPage: 'quotation',
    PaymentPage: 'payment',
    FormsPage: 'forms',
    FilesPage: 'files',
    HubPage: 'hub',
    ReportPage: 'report',
  };
  for (const [name, f] of Object.entries(file)) {
    assert.ok(existsSync(join(HERE, '_pages', `${f}.tsx`)), `_pages/${f}.tsx is missing`);
    assert.match(sw, new RegExp(`import \\{ ${name} \\} from '\\./${f}';`), `${name} is not imported from its own file`);
  }
  const body = (id: string) => {
    const at = sw.indexOf(`    ${id}: only(`);
    assert.ok(at >= 0, `no '${id}' body`);
    const next = sw.slice(at + 10).search(/\n    [a-z]+: /);
    return sw.slice(at, next < 0 ? undefined : at + 10 + next);
  };
  assert.match(body('details'), /<DetailsPage\b[\s\S]*id="forms"[\s\S]*<FormsPage\b[\s\S]*id="decisions"/, 'Details: their info, then Forms, then Decisions');
  assert.match(body('quote'), /ctx\.isBooked \?[\s\S]*id="payments"[\s\S]*<PaymentPage\b[\s\S]*id="quote"[\s\S]*\{quotation\}/, 'Book & Budget: payments, then the quote');
  assert.match(sw, /const quotation = <QuotationPage\b/);
  for (const [id, name] of [['chat', 'ChatPage'], ['schedule', 'SchedulePage'], ['hub', 'HubPage'], ['report', 'ReportPage']] as const) {
    assert.match(body(id), new RegExp(`<${name}\\b`), `the '${id}' body is not ${name}`);
  }
  assert.match(sw, /payments: null,/);
  assert.match(sw, /forms: null,/);
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
