/**
 * finalize-is-one-way.test.ts — FINALIZING THE HEADCOUNT IS ONE-WAY (owner
 * 2026-10-07: *"when this is pressed say it cannot be unfinalized"* · *"a
 * confirmation Finalize | Not Now"*; DECISION_LOG, G37).
 *
 *   · the confirm sheet says "cannot be undone", with Finalize · Not now;
 *   · a locked row reads the locked count and has NO button;
 *   · no host Reopen remains — not the action, not the lib writer, not the
 *     roster banner's button.
 *
 * 🛡 Sabotage: a Reopen button back on the locked Setup row → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FINALIZE_IS_ONE_WAY, FINALIZE_SHEET, headcountLockedLine } from '@/lib/headcount-row';
import { stripComments } from '@/lib/strip-comments';
import { renderSetup } from './render-setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the sheet says it cannot be undone, Finalize · Not now', () => {
  assert.equal(FINALIZE_SHEET.title(120), '120 heads — this cannot be undone');
  assert.match(FINALIZE_SHEET.body(120), /Once locked, it stays locked\./);
  assert.equal(FINALIZE_SHEET.confirm, 'Finalize');
  assert.equal(FINALIZE_SHEET.cancel, 'Not now');
  const rows = read('app/dashboard/[eventId]/_components/guest-setup/guest-setup-rows.tsx');
  assert.match(rows, /label=\{pending \? 'Finalizing…' : FINALIZE_SHEET\.confirm\}/);
  assert.match(rows, /label=\{FINALIZE_SHEET\.cancel\}/);
});

test('a locked row reads the locked count and has no button', async () => {
  const html = await renderSetup({ headcount: { show: true, mayFinalize: false, locked: true, heads: 120 } });
  const at = html.indexOf('data-setup-row="headcount"');
  assert.ok(at > 0, 'the locked row is gone');
  const row = html.slice(at, html.indexOf('</section>', at));
  assert.match(row, /Headcount locked/);
  assert.ok(row.includes(headcountLockedLine(120)));
  const buttons = (row.match(/<(button|a)\b/g) ?? []).length;
  console.log(`locked headcount row buttons: ${buttons}`);
  assert.equal(buttons, 0, 'a locked headcount offers a button');
  assert.doesNotMatch(html, /Reopen/i);
});

test('the server refuses an unlock, and no host reopen writer remains', () => {
  const action = read('app/dashboard/[eventId]/guests/finalize-actions.ts');
  assert.match(action, /if \(finalized !== true\) return \{ ok: false, error: FINALIZE_IS_ONE_WAY \}/);
  assert.doesNotMatch(action, /reopen/i);
  assert.equal(FINALIZE_IS_ONE_WAY, 'A locked headcount cannot be undone.');
  assert.doesNotMatch(read('lib/pax.ts'), /export async function reopenGuestList/);
  const banner = read('app/dashboard/[eventId]/guests/_components/finalize-guest-list-control.tsx');
  assert.doesNotMatch(banner, /Reopen/, 'the roster banner offers Reopen again');
  assert.match(banner, /setGuestListFinalized\(eventId, true\)/);
});
