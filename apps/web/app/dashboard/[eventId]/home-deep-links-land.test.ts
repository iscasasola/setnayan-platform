/**
 * home-deep-links-land.test.ts — THE FOUR "NEEDS A PARAM" FACES LAND ON THEIR EXACT ITEM (owner-approved 2026-10-24,
 * `home_control_center_2026-10-24_fable.html`, "A face opens the EXACT item": *"it opens the exact payment and not just
 * the budget page"*). One test per address, each asserted at BOTH ends — what Home links, and what the page does with it:
 *
 *   1 · Guests · "4 can't come"   → `/guests?q=declined`        — the Guests search reads "declined" as the reply filter.
 *   2 · Suppliers · "1 quote"      → `/vendors/<id>/workspace?tab=quote` — that supplier's workspace, on its Quote tab.
 *   3 · Checklist · a task         → `/checklist#task-<id>`      — the task's row wears that id (`checklistTaskAnchor`).
 *   4 · Budget · a payment · Pay   → `/vendors?part=budget&pay=<line_item_id>` — the Pay sheet of that payment's supplier
 *                                   opens on arrival (`payTargetVendor`, the page's own ledger).
 *
 * SABOTAGE (seen red): the row's id spelled `item-` (3 red) · `payTargetVendor` matching the vendor id instead of the
 * line (4 red) · the vendors page dropping `pay` on the way to the Budget part (4 red) · the quote face back on the bench (2 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl } from '@/lib/home-control-fixture';
import { rosterSearchMatches, type RosterFacts } from '@/lib/guest-roster-view';
import type { GuestRow } from '@/lib/guests';
import { checklistTaskAnchor } from '@/lib/checklist-anchor';
import { payTargetVendor } from '@/lib/budget-page-view';
import { homeControlTiles, homeNowAction, homeToday, homeWaiting } from './_components/home-control-faces';
import { drawHome, loadHome } from './home-render.harness';
import { visiblePickedSupplierPage, pickedSupplierMenuFor } from './vendors/[vendorId]/workspace/_components/picked-supplier-menu';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));
const face = (key: string, id: string) => homeControlTiles(fixtureControl('e1')).tiles.find((t) => t.key === key)?.faces.find((f) => f.id === id);

test('1 · "can’t come" opens the Guests list filtered to the guests who declined', () => {
  assert.equal(face('guests', 'guests-declined')?.href, '/dashboard/e1/guests?q=declined');
  // The Guests page seeds its search from ?q= …
  assert.match(src('guests/page.tsx'), /initialQuery=\{[^}]*search\.q/, 'the Guests page no longer seeds its search from ?q=');
  // …and the search reads "declined" as the reply, exactly the rows the count counts.
  const facts = { roleNames: null, hasSides: false, groupsOf: () => [], tableOf: () => null } as unknown as RosterFacts;
  const g = (rsvp_status: string) => ({ guest_id: rsvp_status, first_name: 'Ana', last_name: 'Cruz', role: 'guest', rsvp_status, entry_source: 'host', passed_away: false }) as unknown as GuestRow;
  assert.equal(rosterSearchMatches('declined', g('declined'), facts), true);
  assert.equal(rosterSearchMatches('declined', g('attending'), facts), false);
  assert.equal(rosterSearchMatches('declined', g('pending'), facts), false);
});

test('2 · "1 quote to decide" opens that supplier’s quote', () => {
  const decide = face('sup', 'sup-decide');
  assert.equal(decide?.href, '/dashboard/e1/vendors/v-lumiere/workspace?tab=quote');
  assert.equal(decide?.action?.href, decide?.href, 'Decide the quote opens somewhere else');
  // The workspace lands on the tab its ?tab= names, and Quote is one of its tabs.
  const ws = src('vendors/[vendorId]/workspace/page.tsx');
  assert.match(ws, /const rawLanding = typeof search\.tab === 'string' \? search\.tab : undefined;/);
  // Build 3 (Lane A): the workspace is the picked shell now — the address's tab is mapped onto its page list, and
  // `?tab=quote` lands on Quotation.
  assert.match(ws, /initialPage=\{visiblePickedSupplierPage\(rawLanding, pickedMenu\)\}/, 'the workspace no longer opens on the tab its address names');
  assert.match(src('vendors/[vendorId]/workspace/_components/picked-supplier-menu.ts'), /PICKED_SUPPLIER_PAGE_IDS = \[[^\]]*'quote'/, 'Quote is no longer one of the picked pages');
  assert.match(ws, /quote: hasQuotesToShow \? \(\s*<div data-picked-supplier-page="quote">/, 'the workspace lost its Quote tab');
  // …and a ?tab= landing is not bounced anywhere else: `quote` opens Quotation whenever there is a quote to show.
  assert.equal(visiblePickedSupplierPage('quote', pickedSupplierMenuFor({ quote: true, chat: true })), 'quote');
});

test('3 · a To do task opens itself in Planning Stage’s To do filter', () => {
  // Owner 2026-11-01, "Checklist merges into Planning Stage": the Checklist page forwards there; the rows keep their address.
  const first = fixtureControl('e1').checklist;
  assert.ok(first && first !== 'unread');
  const todo = '/dashboard/e1/schedule?view=preparation&filter=todo';
  // 🎴 The To do is ONE list under the event card now (Home redraw 2026-11-02): each row opens its own task.
  const list = drawHome();
  const at = list.indexOf('data-home-todo=""');
  assert.ok(at > -1, 'Home draws no To do list');
  const rows = list.slice(at, list.indexOf('data-home-todo-line', at));
  for (const t of first.next.slice(0, 3)) {
    assert.ok(rows.includes(`href="${todo.replace(/&/g, '&amp;')}#${checklistTaskAnchor(t.id)}"`), `the To do row "${t.title}" does not open itself`);
  }
  assert.equal(checklistTaskAnchor('abc'), 'task-abc');
  // The row wears the very same id, so the browser lands on it (the filter shows it; nothing folds a task away).
  const view = src('schedule/_components/preparation-agenda.tsx');
  assert.match(view, /id=\{rowId \? checklistTaskAnchor\(rowId\) : undefined\}/, 'the Planning Stage row does not wear its address');
  assert.match(view, /scroll-mt-24/, 'a landed task hides under the top bar');
  // The md+ card's task lines open their tasks too.
  const html = drawHome();
  assert.ok(html.includes(`href="${todo.replace(/&/g, '&amp;')}#task-t1"`), 'the To do card’s first task does not open itself');
});

test('4 · a payment’s Pay opens that payment’s sheet', () => {
  // 🎴 The late payment is Now's (Home redraw 2026-11-02): Now's Pay opens THAT payment, and Budget's next face its own.
  const c = fixtureControl('e1');
  const now = homeNowAction(homeToday(c.next, c.guests, homeWaiting(c)), c);
  assert.equal(now?.verb, 'Pay');
  assert.equal(now?.href, '/dashboard/e1/budget?pay=li-1');
  const late = face('budget', 'pay-li-2');
  assert.equal(late?.href, '/dashboard/e1/budget?pay=li-2');
  assert.equal(late?.action?.href, late?.href);
  // The page's own ledger decides whose sheet: the line's supplier — only an owed supplier line of this event, listed here.
  const lines = [
    { source: 'vendor_line_item', sourceRef: 'li-1', vendorId: 'v1', stillOwedPhp: 8000 },
    { source: 'vendor_line_item', sourceRef: 'li-9', vendorId: 'v2', stillOwedPhp: 0 },
    { source: 'setnayan_order', sourceRef: 'o-1', vendorId: null, stillOwedPhp: 500 },
  ];
  const listed = [{ vendorId: 'v1' }, { vendorId: 'v2' }];
  assert.equal(payTargetVendor(lines, 'li-1', listed), 'v1');
  assert.equal(payTargetVendor(lines, 'li-9', listed), null, 'a settled line opened a Pay sheet');
  assert.equal(payTargetVendor(lines, 'o-1', listed), null, 'an order opened a supplier’s Pay sheet');
  assert.equal(payTargetVendor(lines, 'v1', listed), null, 'a vendor id passed as a line opened a sheet');
  assert.equal(payTargetVendor(lines, 'li-1', [{ vendorId: 'v2' }]), null, 'a supplier not listed here opened a sheet');
  assert.equal(payTargetVendor(lines, null, listed), null);
  // The address reaches the sheet: the Budget page reads `pay`, resolves it, the screen opens it. An OLD Suppliers address
  // (`?part=budget&pay=`) forwards with its `pay` intact.
  assert.match(src('vendors/page.tsx'), /redirect\(budgetPageHref\(eventId, \{ pay: sp\.pay \}\)\)/, 'the old Suppliers address drops ?pay= on the way to the Budget page');
  assert.match(src('budget/page.tsx'), /initialPayVendorId=\{payTargetVendor\(moneyRead\?\.lines \?\? \[\], \(await searchParams\)\?\.pay, list\.suppliers\)\}/);
  const screen = src('budget/_components/budget-screen.tsx');
  assert.match(screen, /useState<BudgetSheetState>\(initialPayVendorId \? \{ kind: 'pay', vendorId: initialPayVendorId \} : null\)/, 'the Pay sheet does not open on arrival');
  assert.match(screen, /useState\(Boolean\(initialPayVendorId\)\)/, 'the sheet’s code is not loaded for an arrival that opens it');
});
