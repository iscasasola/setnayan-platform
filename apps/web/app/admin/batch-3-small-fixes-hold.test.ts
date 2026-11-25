/**
 * Final check 25 Nov, area 8, batch 3: small lane A fixes, each held at its source (comment-stripped).
 *   A-23 · payout times print in Manila time, not the server's UTC.
 *   A-19 · "Set aside" with no reason says what to do (it used to do nothing, silently).
 *   B-16 · a kind with nothing on sale is not 'Nothing matches "".'
 *   I-10 · the sample switch's Default row says what the server default is, not "off" as fact.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const admin = dirname(fileURLToPath(import.meta.url));
const code = (p: string) => stripComments(readFileSync(resolve(admin, p), 'utf8'));

test('A-23 · payout timestamps carry the Manila time zone', () => {
  const src = code('payouts/page.tsx');
  const fn = src.slice(src.indexOf('function formatTimestamp('));
  assert.match(fn.slice(0, 400), /timeZone: 'Asia\/Manila'/);
});

test('A-19 · "Set aside" refuses an empty reason with a sentence, before it writes', () => {
  const src = code('payments/actions.ts');
  const at = src.indexOf("intent === 'received-leave'");
  const block = src.slice(at, at + 600);
  const guard = block.indexOf("redirect(deskUrl(q, 'Pick why to set it aside.', true))");
  const write = block.indexOf('await leaveReceived(formData)');
  assert.ok(guard > 0 && write > guard, 'the refusal must come before the write');
});

test('B-16 · an empty kind is not a failed search', () => {
  const src = code('pricing/_components/catalog-editor.tsx');
  const empty = src.indexOf('Nothing of this kind is on sale.');
  const search = src.indexOf('Nothing matches "${q}".');
  assert.ok(empty > 0 && search > empty, 'the empty-kind line must be checked before the search line');
  assert.match(src, /filtered\.length === 0 && !q\.trim\(\) \? \(\s*<EmptyState title="Nothing of this kind is on sale\."/);
});

test('I-10 · the Default row reads the server default', () => {
  const sw = code('settings/_components/sample-event-switch.tsx');
  assert.doesNotMatch(sw, /'Default — off'/);
  assert.match(sw, /it says \$\{envDefaultOn \? 'on' : 'off'\}/);
  assert.match(code('switches/page.tsx'), /envDefaultOn=\{envFlagEnabled\(process\.env\.SAMPLE_EVENT_ENABLED\)\}/);
});
