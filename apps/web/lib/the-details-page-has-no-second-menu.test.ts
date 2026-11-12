/**
 * 🧹 THE SUPPLIER'S DETAILS PAGE HAS NO SECOND MENU (owner, live, 12 Nov 2026).
 *
 * The picked client's Details page still drew a row of shortcut pills — Chat · Quote (filled) · Files · Details
 * (`aria-current`) — inside the returning-client card. A leftover from before the picked-client menu (Chat · Details ·
 * Quotation · Payment · Forms · Schedule · Files · Hub · Report), which opens every one of those pages already; its
 * "Quote" even went to the chat's `#build-quote` instead of the Quotation page. Removed; the returning-client marker
 * stays, and draws nothing at all for a first-time client (no empty card).
 *
 * SABOTAGE (done once, 12 Nov): a `<Link href={`/vendor-dashboard/clients/${eventId}?tab=files`}>` put back inside
 * `ReturningMarker` → RED; `if (!returningFlag) return null;` removed → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/clients/[eventId]/page.tsx'), 'utf8'));

function bodyOf(src: string, fn: string): string {
  const at = src.indexOf(`function ${fn}(`);
  assert.ok(at >= 0, `${fn} is gone — the returning-client marker must still be drawn`);
  const next = src.indexOf('\nfunction ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}

test('the returning-client marker carries no shortcut links — the picked menu is the one menu', () => {
  assert.equal(PAGE.includes('ReturningMarkerAndActions'), false, 'the old marker-plus-pills component is back');
  const marker = bodyOf(PAGE, 'ReturningMarker');
  assert.equal(/<Link\b/.test(marker), false, 'a shortcut link is back inside the returning-client card');
  assert.equal(/aria-current=/.test(marker), false, 'a "you are here" pill is back inside the returning-client card');
  assert.match(marker, /if \(!returningFlag\) return null;/, 'a first-time client would get an empty card');
  assert.match(PAGE, /<ReturningMarker returningFlag=\{returningFlag\} \/>/);
});
