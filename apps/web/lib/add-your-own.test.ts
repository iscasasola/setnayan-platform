/**
 * "Add your own supplier" — the couple's side, as the owner approved it on
 * 2026-10-10 (approval 10; `prototypes/suppliers_add_your_own_2026-10-10.html`).
 *
 * Two halves: the WORDS and RULES (executed), and the SHAPE of the walk (read
 * from source, because no unit test mounts a sheet). The shape guards hold the
 * rulings that are easiest to undo by accident: no price step, no "already
 * booked?" step, nothing about fees on a couple's screen, one dropdown, and
 * the shipped actions rather than new ones.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  ADD_OWN_STEPS,
  OWN_RECORD_PILL,
  addOwnContactError,
  addOwnDoneLine,
  addOwnNobodyLine,
  addOwnRecordNote,
  addOwnStepLine,
  claimLinkWords,
} from './add-your-own';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

const WALK = 'app/dashboard/[eventId]/_components/add-your-own-walk.tsx';
const PANEL = 'app/dashboard/[eventId]/_components/supplier-connect-panel.tsx';
const MODAL = 'app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx';
const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
const THUMB = 'app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx';
const ACTIONS = 'app/dashboard/[eventId]/vendors/actions.ts';

// ── the words and the rules ────────────────────────────────────────────────

test('the walk is four steps, in the order drawn — and price is not one of them', () => {
  assert.deepEqual([...ADD_OWN_STEPS], ['Name', 'What they do', 'Contact', 'Their link']);
  assert.equal(addOwnStepLine(1), 'Step 1 of 4 · Name');
  assert.equal(addOwnStepLine(4), 'Step 4 of 4 · Their link');
  for (const step of ADD_OWN_STEPS) {
    assert.doesNotMatch(step, /price|book|pay/i, `"${step}" — price and "already booked?" are out of the first walk`);
  }
});

test('step 3 takes who they talk to OR their mobile — one is enough', () => {
  assert.equal(addOwnContactError('', ''), 'Add who you talk to, or their mobile.');
  assert.equal(addOwnContactError('   ', ' '), 'Add who you talk to, or their mobile.');
  assert.equal(addOwnContactError('Maria Santos', ''), null);
  assert.equal(addOwnContactError('', '+63 917 555 0100'), null);
});

test('what the couple typed is their record, not a booking — said in the same words everywhere', () => {
  assert.equal(OWN_RECORD_PILL, 'Your record, not a booking');
  assert.equal(addOwnRecordNote('Tita Baby’s Catering').strong, 'your record, not a booking');
  assert.equal(addOwnDoneLine('Tita Baby’s Catering'), 'You added Tita Baby’s Catering — your record, not a booking');
  assert.equal(
    addOwnNobodyLine(' Tita Baby’s Catering ', 'Catering'),
    'Nobody called “Tita Baby’s Catering” in Catering yet — add them as your own.',
  );
});

test('the claim link says the supplier fills in THEIR OWN card and price', () => {
  const w = claimLinkWords('Tita Baby’s Catering');
  assert.equal(w.heading, 'Their claim link');
  assert.match(w.how, /^Show Tita Baby’s Catering this or send the link\./);
  assert.match(w.how, /fill in their own card and price/);
  assert.equal(w.fileBase, 'tita-baby-s-catering-setnayan-link');
  assert.equal(claimLinkWords('').fileBase, 'supplier-setnayan-link');
});

// ── the shape of the walk ──────────────────────────────────────────────────

test('the walk composes what ships — search, the shipped ask, the one save, the claim link', () => {
  const src = code(WALK);
  for (const shipped of [
    'searchMarketplaceVendorsByName(',
    'attachMarketplaceVendorToCategory(',
    'contactShortlistVendor(',
    'addManualSupplier(',
    '<SupplierConnectPanel',
    '<PickMenu',
    '<Sheet',
  ]) {
    assert.ok(src.includes(shipped), `the walk no longer uses the shipped ${shipped}`);
  }
  // "Yes — Inquire" asks the REAL shop: attach first, then the ask — never a hand-made twin.
  const inquire = src.slice(src.indexOf('function inquire('), src.indexOf('function add('));
  assert.ok(inquire.length > 0, 're-point: the walk lost its inquire()');
  assert.ok(
    inquire.indexOf('attachMarketplaceVendorToCategory(') < inquire.indexOf('contactShortlistVendor('),
    'Yes — Inquire must put the shop under the category before it asks',
  );
  assert.ok(!inquire.includes('addManualSupplier('), 'Yes — Inquire made a hand-typed twin of a shop that exists');
  // ONE write per press (2026-10-12): the link rides the same Add call, made by the shipped writer inside it.
  assert.ok(src.includes("fd.set('with_link', '1')"), 'the walk no longer asks for their link in the Add press');
  const actions = code(ACTIONS);
  const add = actions.slice(actions.indexOf('export async function addManualSupplier('));
  assert.ok(add.slice(0, add.indexOf('\n}\n')).includes('createManualVendorInvite('), 'the Add no longer makes the link with the shipped writer');
});

test('the walk draws the prototype’s buttons, and "What they do" is ONE dropdown', () => {
  const src = code(WALK);
  for (const word of ['"Yes — Inquire"', '"Not them?"', '"Next"', '"Back"', '"Done"']) {
    assert.ok(src.includes(`label=${word}`), `the button ${word} is gone or reworded`);
  }
  assert.match(src, /label=\{pending \? 'Adding…' : 'Add'\}/);
  assert.equal(src.split('<PickMenu').length - 1, 1, 'the category question must be exactly one dropdown');
  assert.doesNotMatch(src, /role="radiogroup"|role="tablist"/, 'a set of choices is a dropdown, never a pill row');
});

test('no price, no "already booked?", and nothing about fees or credit on the couple’s walk', () => {
  const src = code(WALK);
  assert.doesNotMatch(src, /total_cost_php|PesoInput|PaymentPlanRows/, 'a price field crept into the first walk');
  assert.doesNotMatch(src, /already booked/i, '"already booked?" is out of the first walk (owner 2026-10-10)');
  // The owner has not ruled whether couples are told about the fee; until then
  // the couple's screen says nothing about it. (Comments are stripped above.)
  assert.doesNotMatch(src, /booking fee|\bfee\b|attribut|sourced|\bcredit/i, 'fee or credit words reached a couple’s screen');
  assert.doesNotMatch(src, /booking-fee/, 'the walk must not import fee code — rule B is a later step');
});

test('the walk saves with ONE contact; the eight-field sheet still asks for both', () => {
  assert.ok(code(WALK).includes("fd.set('contact_either', '1')"));
  const actions = code(ACTIONS);
  const fn = actions.slice(actions.indexOf('async function createManualVendor('));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert.match(body, /formData\.get\('contact_either'\) === '1'/);
  assert.match(body, /addOwnContactError\(/, 'the save must re-ask the rule the sheet shows');
  assert.match(body, /readStringField\(formData, 'contact_person', 128\)/, 'without the opt-in both contacts stay required');
  assert.ok(!code(MODAL).includes('contact_either'), 'the eight-field sheet must not opt out of its own required fields');
});

test('the first add opens the walk in the one-screen shape; editing stays the one form', () => {
  const bench = code(BENCH);
  assert.match(bench, /\{manual && replan \? \(\s*<AddYourOwnWalk/, 'the bench no longer opens the walk for a first add');
  assert.match(bench, /\) : manual \? \(\s*<NewManualVendorModal/, 'the pre-replan bench lost the shipped sheet');
  assert.match(bench, /edit=\{details\}/, 'the card’s record no longer opens the form in edit mode');
  // The record carries the pill and their claim link.
  const modal = code(MODAL);
  assert.ok(modal.includes('{OWN_RECORD_PILL}'));
  assert.match(modal, /<RecordLinkBlock eventId=\{eventId\} vendorId=\{edit\.vendorId\}/);
  assert.match(modal, /readSupplierInvite\(eventId, vendorId\)/, 'opening the record must READ the link, never make one');
});

test('a name typed in the thumb row rides into the walk', () => {
  const thumb = code(THUMB);
  assert.match(thumb, /onAdd: \(typed: string\) => void/);
  assert.match(thumb, /label=\{text\.trim\(\) \? 'Add' : 'Add your own'\}/);
  assert.match(code(BENCH), /function addYourOwn\(typed = ''\)/);
});

test('their link: the prototype’s words, Download and Copy link — and no NFC strip', () => {
  const panel = code(PANEL);
  assert.ok(panel.includes('claimLinkWords(vendorName)'));
  assert.ok(panel.includes("'Download'") && panel.includes("'Copy link'"));
  assert.ok(!panel.includes('<QrActions') && !panel.includes('NfcWriteButton'), 'no "Write to NFC" on this page');
  assert.ok(!/carries over|Nothing is\s+re-entered/.test(panel), 'the retired promise that the price carries over is back');
});

test('the couple’s row says the record is theirs and where the link stands', () => {
  const bench = code(BENCH);
  assert.ok(bench.includes("ownRecordLine(v.status === 'locked')"));
  assert.match(bench, /inviteStatuses === null \? \(\s*<span className="sc-link" data-invite-status="unread">/);
  assert.ok(bench.includes('{INVITE_STATUS_UNREAD_LINE}'), 'a failed link read must be said, not drawn as no link');
  const page = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /startRead\(readInviteStatusByVendorId\(supabase,/, 'the link read must start with the page’s other reads');
  assert.ok(page.includes('inviteStatusByVendorId={inviteStatusByVendorId}'));
});
