/**
 * Work request cards say it plainly (owner approved 2026-11-14: "approved admin request cards").
 *
 * The live fault this guards: Work · All › Profile corrections showed "Change logo_url", two r2:// paths, a select
 * reading `apply`, and a reason select already showing "Too close to another shop's name" on a LOGO request.
 *
 *   1 · no field key and no storage address is ever a card's words (called, not read);
 *   2 · a decline's reasons FIT the field — a logo is never declined with a name reason, and the action agrees;
 *   3 · no decline reason is ever picked for the admin (the sheet starts empty and its button starts off);
 *   4 · every queue that settles in place builds a card, and the drawer draws it;
 *   5 · the corrections row no longer offers a raw select at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  agoWords,
  chatFlagWhat,
  correctionAsk,
  correctionDecline,
  initialsOf,
  looksRaw,
  readableValue,
  reasonOptions,
  tierWords,
} from '@/lib/admin/request-card';
import { LOCKED_IDENTITY_FIELD_KEYS } from '@/lib/vendor-corrections';
import { SUPPLIER_WORK_REASONS, pickedCorrectionReason } from '@/lib/admin/supplier-work';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (s: string) => stripComments(s);

const R2 = 'r2://setnayan-media/vendors/485d28a2-c614-434f-993a-e3ae89b4/logo-1731552081.png';

test('1 · a card never says a field key or a storage address', () => {
  for (const f of [...LOCKED_IDENTITY_FIELD_KEYS, null, 'some_future_field']) {
    const title = `Liwanag Lights & Sound ${correctionAsk(f)}`;
    assert.equal(looksRaw(title), false, `"${title}" reads like a database word`);
    const sheet = correctionDecline(f, 'Liwanag Lights & Sound');
    assert.ok(sheet, 'a correction decline has no sheet');
    assert.equal(looksRaw(sheet!.title), false, `"${sheet!.title}" reads like a database word`);
  }
  assert.equal(correctionAsk('logo_url'), 'wants a new logo');
  assert.equal(readableValue('logo_url', R2), null, 'a logo is shown as a picture, never its address');
  assert.equal(readableValue('hq_address', R2), null, 'an r2:// value is never text, whatever the field');
  assert.equal(readableValue('business_slug', 'liwanag'), 'setnayan.com/liwanag');
  assert.equal(chatFlagWhat(['phone', 'app_name', 'mystery_code']), 'a phone number, a messaging app and a contact detail');
  assert.equal(looksRaw(tierWords('pro', 'monthly')), false);
  assert.equal(looksRaw(tierWords('some_new_tier', null)), false);
  assert.equal(initialsOf('Liwanag Lights & Sound'), 'LS');
  assert.equal(agoWords('2026-11-12T00:00:00Z', Date.parse('2026-11-14T00:00:00Z')), '2 days ago');
  // The guard itself must be able to fire.
  assert.equal(looksRaw('Change logo_url'), true);
  assert.equal(looksRaw(R2), true);
});

test('2 · a decline offers reasons that fit what was asked — and the action refuses any other', () => {
  const logo = reasonOptions(correctionDecline('logo_url', 'X')!.list);
  assert.ok(!logo.includes('Too close to another shop’s name'), 'a logo decline offers a NAME reason again');
  assert.ok(logo.includes('The picture is blurry or too small'));
  for (const f of ['logo_url', 'hq_address', 'location_city', 'contact_phone', 'contact_email', 'business_name', 'services']) {
    const list = reasonOptions(correctionDecline(f, 'X')!.list);
    assert.equal(list[list.length - 1], 'That detail can’t be changed this way — message Setnayan', `${f}'s list lost the shipped line`);
  }
  // The decline action checks the reason against THIS field's list.
  assert.equal(pickedCorrectionReason('Too close to another shop’s name', 'logo_url'), null);
  assert.equal(pickedCorrectionReason('The picture is blurry or too small', 'business_name'), null);
  assert.equal(pickedCorrectionReason('The picture is blurry or too small', 'logo_url'), 'The picture is blurry or too small');
  assert.equal(pickedCorrectionReason('typed by hand'), null);
  const decline = code(read('app/admin/corrections/actions.ts'));
  const body = decline.slice(decline.indexOf('export async function declineCorrectionRequest'));
  assert.match(body, /pickedCorrectionReason\(formData\.get\('reason'\), open\?\.field_key/, 'the decline no longer checks the reason against the field');
  for (const list of Object.values(SUPPLIER_WORK_REASONS)) {
    for (const r of list) assert.equal(looksRaw(r), false, `"${r}" reads like a database word`);
  }
});

test('3 · no reason is picked for the admin', () => {
  const sheet = code(read('app/admin/queues/_components/card-decide.tsx'));
  assert.match(sheet, /useState<string \| null>\(null\)/, 'the picked reason no longer starts empty');
  assert.match(sheet, /setPicked\(null\);\s*setOpenIdx\(i\)/, 'opening the sheet no longer clears an earlier pick');
  assert.match(sheet, /disabled=\{picked === null\}/, 'the sheet can be sent with nothing picked');
  assert.doesNotMatch(sheet, /defaultChecked|<select/, 'a reason can arrive pre-picked');
  const pick = code(read('app/admin/work/_components/form-pick.tsx'));
  assert.match(pick, /useState<string \| null>\(null\)/, 'the dropdown no longer starts empty');
});

test('4 · every queue that settles in place builds a card, and the drawer draws it', () => {
  const peek = code(read('lib/admin/queue-peek.ts'));
  const list = peek.slice(peek.indexOf('const PEEK_QUEUES'), peek.indexOf('] as const;'));
  const queues = [...list.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]!);
  assert.ok(queues.length >= 10, `read only ${queues.length} queues`);
  for (const q of queues) {
    const start = peek.indexOf(`if (key === '${q}')`);
    assert.ok(start > 0, `${q} has no branch`);
    const next = peek.indexOf('    if (key === ', start + 10);
    const branch = peek.slice(start, next === -1 ? peek.indexOf('if (note)', start) : next);
    assert.match(branch, /card(:|\b.*= await correctionCard)/, `${q} builds no request card`);
  }
  const drawer = code(read('app/admin/queues/_components/queue-drawer.tsx'));
  assert.match(drawer, /it\.card \? \([\s\S]*<RequestCardView card=\{it\.card\}/, 'the drawer no longer draws the card');
  const view = code(read('app/admin/queues/_components/request-card-view.tsx'));
  assert.doesNotMatch(view, /replace\(\/_\/g/, 'the card prints a code with its underscores swapped for spaces');
  assert.match(view, /target="_blank"/, 'Open shop no longer opens the public page in a new tab');
  assert.match(view, />\s*Open record/, 'the card lost Open record');
});

test('5 · the corrections row offers no raw select and no Save', () => {
  const peek = code(read('lib/admin/queue-peek.ts'));
  const start = peek.indexOf("if (key === 'corrections')");
  const branch = peek.slice(start, peek.indexOf("if (key === 'subscriptions')"));
  assert.doesNotMatch(branch, /Change \$\{/, 'the title is a field key again');
  assert.doesNotMatch(branch, /\['apply', 'decline'\]/, 'the raw apply/decline select is back');
  assert.doesNotMatch(branch, /submitLabel/, 'the corrections row has a form again');
  // The card's two buttons post the EXISTING action's own decisions.
  const builder = peek.slice(peek.indexOf('async function correctionCard'), peek.indexOf('function paymentCard'));
  assert.match(builder, /title: `\$\{name\} \$\{correctionAsk\(row\.field_key\)\}`/, 'the card title is no longer who-wants-what');
  assert.doesNotMatch(builder, /field_key\}/, 'a field key is printed into the card again');
  assert.match(builder, /post: \{ decision: 'apply' \}/);
  assert.match(builder, /post: \{ decision: 'decline' \}/);
});

test('6 · the payment card holds the walk RW-301 fixes', async () => {
  const { channelWords, personInitials } = await import('@/lib/admin/request-card');
  // (1) an empty method is said as not given — never "Payment".
  assert.equal(channelWords(null), 'Method not given');
  assert.equal(channelWords('  '), 'Method not given');
  assert.equal(channelWords('gcash'), 'GCash');
  assert.equal(channelWords('something_new'), 'Another way');
  // (3) initials the way the person page draws them — an email is not split on its dots.
  assert.equal(personInitials(null, 'testnayan4@example.com'), 'TE');
  assert.equal(personInitials('Ana Dizon', 'ana@example.com'), 'AD');
  const peek = code(read('lib/admin/queue-peek.ts'));
  const card = peek.slice(peek.indexOf('function paymentCard'), peek.indexOf('type VerifyRow'));
  // (2) no picture ⇒ no receipt line.
  assert.match(card, /if \(row\.verdict && row\.hasScreenshot\)/, 'the receipt line shows without a picture again');
  // (4) the order's own record, not the whole desk.
  assert.match(card, /recordHref: ugatRecordHref\(\{ kind: 'order', publicId: row\.orderPublicId/, 'Open record goes to the whole list again');
  // (5) a paid order offers nothing and says so.
  assert.match(card, /act: orderPaid\s*\?\s*undefined/, 'a paid order offers Confirm again');
  assert.match(card, /already paid/);
  // (6) the row's first tap shows it started.
  const feed = code(read('app/admin/queues/_components/queues-triage-feed.tsx'));
  assert.match(feed, /<RowPending \/>/, 'the Work row lost its pending mark');
  assert.match(code(read('app/admin/queues/_components/row-pending.tsx')), /useLinkStatus\(\)/);
});
