/**
 * the-walk-w1b.test.ts — the W1 walk's booking round (13 Nov 2026): what each fix holds.
 *
 * SABOTAGE: drop the /vendor-dashboard/portfolio redirect → RED; start the "Also mark delivered" box ticked again
 * (`useState(canAdvanceToDelivered)`) → RED; offer it before the day (drop `dayHasPassed`) → RED; put the handover back
 * under Payment → RED; write a picked tab with `window.history.state` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('F-W1-64 · /vendor-dashboard/portfolio goes to the Portfolio', () => {
  assert.match(code('next.config.ts'), /\{ source: '\/vendor-dashboard\/portfolio', destination: '\/vendor-dashboard\/collections', permanent: false \}/);
});

test('F-W1-72 · "Also mark this supplier delivered" starts unticked and waits for the day', () => {
  const inbox = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/handover-inbox.tsx');
  assert.match(inbox, /const \[advance, setAdvance\] = useState\(false\);/);
  const page = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.match(page, /const dayHasPassed = deliverEventDate !== null && deliverEventDate\.slice\(0, 10\) < manilaToday\(\);/);
  assert.match(page, /const canAdvanceToDelivered = dayHasPassed && /);
});

test('F-W1-70 · a contracted booking is booked on the couple’s row, pool hold or not', () => {
  const src = code('lib/conversation-list.ts');
  const fn = src.slice(src.indexOf('async function readCoupleStageFacts'), src.indexOf('export const SUPPLIER_NAME_UNREADABLE'));
  assert.match(fn, /r\.status === 'contracted' \|\| r\.status === 'deposit_paid'\)\) \{\s*facts\.booked\.add\(r\.marketplace_vendor_id\);/);
});

test('F-W1-71 · the handover sits in Files, once, and its notice opens Files', () => {
  const page = code('app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx');
  assert.equal(page.split('<HandoverInbox').length - 1, 1, 'the handover is drawn once');
  const files = page.slice(page.indexOf('files: ('), page.indexOf('inspiration: inspirationSection'));
  assert.match(files, /<HandoverInbox/, 'the handover is on the Files page');
  const status = page.slice(page.indexOf('const statusSection = ('), page.indexOf('const documentsSection = ('));
  assert.doesNotMatch(status, /<HandoverInbox/, 'the handover is no longer under Payment');
  const send = code('app/vendor-dashboard/clients/[eventId]/actions.ts');
  assert.match(send, /title: `\$\{vendorName\} delivered your handover`,[\s\S]{0,200}relatedUrl: `\/dashboard\/\$\{eventId\}\/vendors\/\$\{eventVendorId\}\/workspace\?tab=files`/);
  assert.match(code('app/dashboard/[eventId]/_components/event-dashboard.tsx'), /\/vendors\/\$\{latestHandover\.event_vendor_id\}\/workspace\?tab=files`/);
});

test('F-W1-67/73 · a tab switch on the picked screen is written so the router keeps it', () => {
  const shell = code('app/_components/picked/picked-shell.tsx');
  const writes = [...shell.matchAll(/window\.history\.replaceState\(([^,]+),/g)].map((m) => m[1]!.trim());
  assert.ok(writes.length >= 2, `the picked shell writes its page into the address (${writes.length} writes)`);
  for (const w of writes) assert.equal(w, 'null', 'a write with window.history.state is ignored by Next’s router, which then writes the old ?tab= back');
});
