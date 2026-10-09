/**
 * studio-egifts-posts-the-same.test.ts — STUDIO › E-GIFTS SENDS WHAT IT ALWAYS SENT (2026-10-09; the E-Gifts page moved onto the Form row
 * and Switch templates).
 *
 * The page is LIVE for its ways to give and its registry link (`event_egift_methods`, `events.gift_registry_url`: payment details guests
 * see at once) and DRAFTED for "Accept gifts?" and the thank-you words. A control that is redrawn but posts a different field — or none —
 * renders exactly like success. So `studio-egifts-posts-the-same.golden.json` holds the FormData the page built BEFORE any control moved
 * (recorded from the real page in Chromium; see its `_about`), and this test RUNS the builders the page now posts through
 * (`lib/studio-egifts-saves.ts`, `lib/event-answers.ts`) on the same inputs and compares — field names and values, exactly.
 *
 * It also holds that the page POSTS through those builders and through the shipped actions, with the draft flag where the words wait for
 * ✓ Apply (the component cannot be driven without a DOM in this runner — the browser run is what drove it; this holds the wiring).
 *
 * SABOTAGE (each seen RED, then restored): a builder drops `qr_r2_key` · `is_enabled` inverted · the registry field renamed · the label of an
 * existing way replaced by the kind's default · a new way created from an empty number · the page posts a hand-built payload instead of the
 * builder · the thank-you words lose their draft flag · "Accept gifts?" stops writing `gifts_on`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { egiftEnabledFields, egiftMethodFields, egiftMethodNeedsSaving, registryFields } from './studio-egifts-saves';
import { answerValueOf } from './event-answers';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const golden = JSON.parse(readFileSync(join(__dirname, 'studio-egifts-posts-the-same.golden.json'), 'utf8')) as Record<string, { calls: Array<{ action: string; args: unknown[]; fields?: Record<string, string> }> }>;

/** The page's FormData for a write: the event first, then the builder's fields. */
const posted = (fields: Record<string, string>) => ({ event_id: 'E1', ...fields });
const the = (name: string, i = 0) => {
  const c = golden[name]?.calls[i];
  assert.ok(c, `the golden has no call ${i} for ${name}`);
  return c;
};

/** The fixtures the golden was recorded with. */
const GCASH = { egift_method_id: 'g1', label: 'GCash', note: 'a note', qr_r2_key: null as string | null, handle: '0917 555 0101', account_name: 'Maria Santos' };

test('1 · switching a way on or off sends the same two fields', () => {
  assert.equal(the('s1_off').action, 'setEgiftMethodEnabled');
  assert.deepEqual(posted(egiftEnabledFields('g1', false)), the('s1_off').fields);
  assert.deepEqual(posted(egiftEnabledFields('g1', true)), the('s1_on').fields);
  assert.deepEqual(golden.s2_on?.calls, [], 'a way with no account yet sends nothing when switched on');
});

test('2 · a new way is created from its number: the kind’s own label, no id, nothing carried over', () => {
  assert.equal(the('s2_handle').action, 'saveEgiftMethod');
  assert.deepEqual(posted(egiftMethodFields({ stored: null, kind: 'maya', accountName: '', handle: '0917 111 2222' })), the('s2_handle').fields);
  assert.equal(egiftMethodNeedsSaving({ stored: null, accountName: '', handle: '' }), false, 'a way is never created from an empty number');
  assert.equal(egiftMethodNeedsSaving({ stored: null, accountName: 'Ana', handle: '   ' }), false);
  assert.equal(egiftMethodNeedsSaving({ stored: null, accountName: '', handle: '0917 111 2222' }), true);
});

test('3 · changing the number or the name on the account carries the way’s id, label, note and stored QR', () => {
  assert.deepEqual(posted(egiftMethodFields({ stored: GCASH, kind: 'gcash', accountName: 'Maria Santos', handle: '0918 000 0000' })), the('s3_handle').fields);
  assert.deepEqual(posted(egiftMethodFields({ stored: GCASH, kind: 'gcash', accountName: 'Maria S. Santos', handle: '0918 000 0000' })), the('s3_account').fields);
  /* The recorded way's label happens to equal its kind's default — a way the couple RENAMED keeps its own name. */
  assert.equal(egiftMethodFields({ stored: { ...GCASH, label: 'Our GCash' }, kind: 'gcash', accountName: 'a', handle: 'b' }).label, 'Our GCash');
  assert.equal(egiftMethodFields({ stored: { ...GCASH, note: null }, kind: 'gcash', accountName: 'a', handle: 'b' }).note, '');
  assert.deepEqual(golden.s3_unchanged?.calls, [], 'leaving a box unchanged sends nothing');
  assert.equal(egiftMethodNeedsSaving({ stored: GCASH, accountName: 'Maria Santos', handle: '0917 555 0101' }), false);
  assert.equal(egiftMethodNeedsSaving({ stored: GCASH, accountName: 'Maria Santos', handle: ' 0917 555 0101 ' }), false, 'what is stored is compared trimmed');
  assert.equal(egiftMethodNeedsSaving({ stored: GCASH, accountName: 'Maria Santos', handle: '' }), true, 'emptying a number IS sent (the writer refuses it in words)');
  assert.deepEqual(posted(egiftMethodFields({ stored: GCASH, kind: 'gcash', accountName: 'Maria Santos', handle: '' })), the('s6_handle_fail').fields);
});

test('4 · the QR is set and removed through the same write, with the typed number and name beside it', () => {
  assert.deepEqual(posted(egiftMethodFields({ stored: GCASH, kind: 'gcash', accountName: 'Maria Santos', handle: '0917 555 0101', qrRef: 'r2://thread-files/pabuya-qr/E1/qr.png' })), the('s4_qr').fields);
  assert.deepEqual(posted(egiftMethodFields({ stored: GCASH, kind: 'gcash', accountName: 'Maria Santos', handle: '0917 555 0101', qrRef: '' })), the('s4_qr_remove').fields);
  /* No QR named = the stored one stays (a number changed with a QR already on the way). */
  assert.equal(egiftMethodFields({ stored: { ...GCASH, qr_r2_key: 'r2://x' }, kind: 'gcash', accountName: 'a', handle: 'b' }).qr_r2_key, 'r2://x');
});

test('5 · the registry link is one field, the link or nothing', () => {
  assert.equal(the('s5_valid').action, 'savePabuyaMessage');
  assert.deepEqual(posted(registryFields('https://shop.example.ph/my-list')), the('s5_valid').fields);
  assert.deepEqual(posted(registryFields(null)), the('s5_clear').fields);
  assert.deepEqual(golden.s5_invalid?.calls, [], 'a link that is not one is said, never sent');
});

test('6 · the thank-you words go into the DRAFT (the draft flag), as typed words and as a starting point', () => {
  assert.equal(the('t1_typed').action, 'savePabuyaMessage');
  assert.deepEqual(the('t1_typed').fields, { event_id: 'E1', pabuya_message: 'Thank you, all of you!', draft: '1' });
  assert.equal(the('t3_start_from').fields?.draft, '1');
  assert.deepEqual(golden.t7_unchanged?.calls, [], 'words left unchanged send nothing');
  /* The component builds exactly this FormData. */
  const src = read('app/dashboard/[eventId]/pabuya/_components/pabuya-message-editor.tsx');
  const studio = src.slice(src.indexOf('function StudioThanks('), src.indexOf('function ShippedEditor('));
  assert.match(studio, /fd\.set\('event_id', eventId\);\s*fd\.set\('pabuya_message', words\);[\s\S]{0,120}fd\.set\(HUB_DRAFT_FIELD, '1'\);\s*return savePabuyaMessage\(fd\);/);
  assert.equal(/\nconst HUB_DRAFT_FIELD = '([^']+)';/.exec(src)?.[1], 'draft', 'the draft flag the golden recorded');
  /* A burst of typing was ONE write before; it is one write now (never more). */
  assert.equal(golden.t2_slow?.calls.length, 1);
});

test('7 · "Accept gifts?" writes gifts_on into the draft: the same patch for Yes and No, whichever control picks it', () => {
  const c = the('a1_off');
  assert.equal(c.action, 'hubDraftAction');
  assert.deepEqual(c.args, ['E1']);
  assert.deepEqual(c.fields, { intent: 'save', patch: JSON.stringify({ events: { gifts_on: answerValueOf('gifts_on', 'no') } }) });
  assert.equal(answerValueOf('gifts_on', 'yes'), true);
  const picker = read('app/dashboard/[eventId]/launch/_components/details-answers.tsx');
  assert.match(picker, /fd\.set\('patch', JSON\.stringify\(\{ events: \{ \[column\]: value \} \}\)\);/, 'the answer no longer writes its column');
  assert.match(picker, /onChange=\{\(on\) => pick\(on \? 'yes' : 'no'\)\}/, 'the switch does not make the same pick the dropdown made');
});

test('8 · the page posts through those builders, and through the shipped actions only', () => {
  const tools = read('app/dashboard/[eventId]/launch/_components/studio-tools.tsx');
  const gifts = tools.slice(tools.indexOf('export function StudioEgifts('), tools.indexOf('export type StudioHubFacts'));
  assert.ok(gifts.length > 3000, 'StudioEgifts moved — re-read this guard');
  assert.match(gifts, /setEgiftMethodEnabled\(fd\(egiftEnabledFields\(before\.id!, on\)\)\)/);
  assert.equal((gifts.match(/saveEgiftMethod\(fd\(egiftMethodFields\(/g) ?? []).length, 2, 'a number/name keep and a QR each build their fields with the builder');
  assert.match(gifts, /savePabuyaMessage\(fd\(registryFields\(next\)\)\)/);
  assert.doesNotMatch(gifts, /f\.set\('(?:handle|account_name|qr_r2_key|is_enabled|gift_registry_url)'|fd\(\{\s*(?:egift_method_id|method_kind|gift_registry_url|is_enabled)/, 'a payload is hand-built beside the builder');
  assert.doesNotMatch(gifts, /hubDraftAction|saveHubDraft/, 'a live E-Gifts write moved into the draft');
});
