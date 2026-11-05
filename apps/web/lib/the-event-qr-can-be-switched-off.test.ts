/**
 * 🔳 THE EVENT QR CAN BE SWITCHED OFF (owner 2026-10-07, "THE MISSING FIELDS ARE
 * APPROVED"; Info › Your Event Hub › QR).
 *
 * Holds: `qr_shown` is a drafted yes/no (never Pro) where never-set and Yes are
 * the same event; off leaves the event QR off the prints and the guest page's
 * keepsake; the Studio switch drafts it and defaults ON.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HUB_DRAFT_ANSWER_COLUMNS, eventColumnChange, eventItemIsPro, sanitizeHubDraftEventValue } from './hub-draft';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('a drafted yes or no; never-set and Yes are one event; never Pro', () => {
  assert.ok((HUB_DRAFT_ANSWER_COLUMNS as readonly string[]).includes('qr_shown'));
  assert.equal(sanitizeHubDraftEventValue('qr_shown', false), false);
  assert.equal(sanitizeHubDraftEventValue('qr_shown', 'no'), undefined);
  assert.equal(eventColumnChange('qr_shown', null, true), 'none', 'switching on what is already on is no change');
  assert.notEqual(eventColumnChange('qr_shown', null, false), 'none');
  assert.equal(eventItemIsPro('qr_shown', false, 'change'), false);
});

test('off leaves the event QR off the prints and the guest keepsake', () => {
  const set = read('lib/print-set.server.ts');
  assert.match(set, /if \(opts\.withEventQr !== false && event\.qr_shown !== false && event\.slug\) \{/);
  assert.match(set, /role_names, qr_shown, papic_on/, 'the print event read does not select qr_shown');
  const keepsake = read('app/[slug]/print/page.tsx');
  assert.match(keepsake, /if \(\(event as \{ qr_shown\?: boolean \| null \}\)\.qr_shown !== false\) \{/);
  assert.match(keepsake, /style_preferences, qr_shown`/);
});

test('the Studio switch drafts it, on by default', () => {
  const tools = read('app/dashboard/[eventId]/launch/_components/studio-tools.tsx');
  /* Drafted — ONE held write of the column (`studioDraftKeep`, the Info rows' one way to keep an answer). */
  assert.match(tools, /studioDraftKeep\(eventId, 'events:qr_shown', \{ qr_shown: next \}\)/);
  const details = read('app/dashboard/[eventId]/launch/_components/maker-details.tsx');
  /* Drawn in Info's fold "More for guests" (`StudioHubSettings`), on unless it was switched off. */
  assert.match(details, /qrShown=\{st\.qrShown !== false\}/);
  assert.match(tools, /<StudioQrShown eventId=\{eventId\} shown=\{qrShown\}>/);
});
