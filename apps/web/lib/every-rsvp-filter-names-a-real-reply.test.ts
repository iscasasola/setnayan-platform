/**
 * every-rsvp-filter-names-a-real-reply.test.ts — final check, area 3, batch 1: what each fix claims.
 *
 * B-01's own guard (every rsvp_status filter names a real reply) is main's
 * `lib/a-guest-read-filters-on-a-real-rsvp-value.test.ts`; this file holds the rest of the batch.
 *
 * 🔒 Source assertions on the comment-stripped files; each fails when its fix is reverted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = 'app/dashboard/[eventId]';
const read = (rel: string) => stripComments(readFileSync(join(WEB, D, rel), 'utf8'));

test('B-01 · Story Assignments lists attending guests through the one headcount reader, and says when it could not read', () => {
  const src = read('alaala/assignments/page.tsx');
  assert.match(src, /\.eq\('rsvp_status', 'attending'\)/);
  assert.match(src, /\.is\('deleted_at', null\)/);
  assert.match(src, /\.filter\(countsTowardEvent\)/);
  assert.match(src, /readFailed \?/);
  assert.match(src, /Couldn't read your story assignments/);
});

test('M-05 · a refused Remove sets removeError and shows it', () => {
  const src = read('alaala/assignments/_components/assignment-controls.tsx');
  assert.match(src, /if \(!result\.ok\) setRemoveError\(/);
  assert.match(src, /\} catch \{\s*setRemoveError\(/);
  assert.match(src, /\{removeError \? \(\s*<p role="alert"/);
});

test('P-05 · a refused recap publish / make-private comes back with its failure line', () => {
  const actions = read('studio/papic/recap/actions.ts');
  assert.match(actions, /if \(publishError\) redirect\(recapFailedHref\(eventId, 'publish'\)\);/);
  assert.match(actions, /if \(unpublishError\) redirect\(recapFailedHref\(eventId, 'private'\)\);/);
  const page = read('studio/papic/recap/page.tsx');
  assert.match(page, /recapFlag === 'publish-failed'/);
  assert.match(page, /recapFlag === 'private-failed'/);
  const toggle = read('studio/papic/recap/_components/recap-social-feature-toggle.tsx');
  assert.match(toggle, /if \(!res\.ok\) \{\s*setAllowed\(!next\);[^}]*setFailed\(true\);/);
});

test('P-03 · Disconnect never lands on "Drive disconnected" after a refused write', () => {
  const src = read('studio/photo-delivery/actions.ts');
  assert.match(src, /if \(grantError\) redirect\(`[^`]*\?disconnect_error=1`\);/);
  assert.match(src, /if \(eventError\) redirect\(`[^`]*\?disconnect_error=1`\);/);
  assert.match(read('studio/photo-delivery/page.tsx'), /disconnect_error/);
});

test('L-06 · the Flash to Memory lane switch says when a save failed', () => {
  const src = read('live/_components/flash-auto-wall-toggle.tsx');
  assert.match(src, /if \(!res\.ok\) setFailed\(true\);/);
  assert.match(src, /\{failed \? \(\s*<span role="alert"/);
});

test('N-02 · "Showing now" reads plain words, never the internal mode name', () => {
  const src = read('live/_components/mode-control.tsx');
  assert.match(src, /const SHOWING_NOW: Record<WallMode, string> = \{/);
  assert.match(src, /\{SHOWING_NOW\[resolved\]\}/);
});

test('N-11 · recap counts: the label follows the count, and an unknown count draws "—"', () => {
  const src = read('studio/papic/recap/page.tsx');
  assert.match(src, /\{n === null \? '—' : formatCount\(n\)\}/);
  assert.match(src, /\{n === 1 \? one : many\}/);
  assert.match(src, /<Stat n=\{summary\.privatePhotos\} one="photo" many="photos" \/>/);
});

test('I-05 · Regenerate QR says it made a new code, or that it could not', () => {
  const src = read('event-qr/page.tsx');
  assert.match(src, /redirect\(`[^`]*\/event-qr\?qr=\$\{result\.ok \? 'new' : 'failed'\}`\)/);
  assert.match(src, /qrFlag === 'new'/);
  assert.match(src, /qrFlag === 'failed'/);
});

test('I-04 · Save monogram counts the row it wrote and never echoes database text', () => {
  const src = read('invitation/actions.ts');
  assert.match(src, /if \(error \|\| !savedRows \|\| savedRows\.length === 0\) \{\s*redirect\(`[^`]*mono_error=not_saved`\);/);
  assert.match(read('invitation/mono-error-copy.ts'), /not_saved: "Couldn't save your logo\. Nothing changed — try again\.",/);
});
