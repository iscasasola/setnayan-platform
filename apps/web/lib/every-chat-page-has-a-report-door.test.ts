/**
 * 🚩 EVERY CHAT PAGE HAS A REPORT DOOR (ship-controller ruling 20 Nov 2026, on the #8047 review: "A chat page must never
 * be left with no in-chat Report").
 *
 * Part B made the (+) hold only things you send; Part G (#8048) moved Report a problem into the head's ⋯ on both sides.
 * This guard followed it there (its own instruction: "When G lands … change THIS test to point at the ⋯ — never delete
 * it"). Held here:
 *   1 · neither side's (+) carries Report a problem any more, in any state (it would be a second door);
 *   2 · the ⋯ of every chat page carries it, last: the supplier's one-chat client page (`picked-client-more.ts`), the
 *       host's picked-supplier page (`HOST_MORE`), and both standalone thread pages' ⋯ links (the supplier's only where
 *       the client page opens, as G drew it);
 *   3 · each Report door goes somewhere — a Report page, never a dead row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hostPlusRows, supplierPlusRows } from './chat-plus';
import { stripComments } from './strip-comments';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

test('1 · no (+) carries Report a problem, on either side, in any state', () => {
  const every = [
    ...hostPlusRows({ canLogPayment: true }),
    ...hostPlusRows({ canLogPayment: false, booked: true }),
    ...hostPlusRows({ canLogPayment: true, pollOpen: true }),
    ...supplierPlusRows({ paid: false }),
    ...supplierPlusRows({ paid: true, booked: true }),
    ...supplierPlusRows({ paid: false, hasQuote: false }),
  ];
  assert.ok(!every.some((r) => r.key === 'report' || /report/i.test(r.label)), 'Report a problem came back into the (+) — it lives under ⋯');
});

test('2 · the ⋯ of every chat page carries Report a problem', () => {
  const more = read('app/vendor-dashboard/clients/[eventId]/_components/picked-client-more.ts');
  assert.match(more, /rows\.push\(\{ id: 'report', label: 'Report a problem'[^}]*page: 'report' \}\)/, 'the supplier’s client-page ⋯ lost Report');
  const host = read('app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx');
  assert.match(host, /const HOST_MORE[^=]*= \[\{ id: 'report', label: 'Report a problem'[^\]]*page: 'report' \}\]/, 'the host’s ⋯ lost Report');
  assert.match(host, /more=\{HOST_MORE\}/, 'the host’s page no longer draws its ⋯');
  const hostThread = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');
  assert.match(hostThread, /\{ href: `\$\{workspaceHref\}\?tab=report`, label: 'Report a problem', icon: 'problem' \}/, 'the host’s thread page lost its ⋯ Report');
  const supplierThread = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(
    supplierThread,
    /clientAdmits \? \[\{ href: `\/vendor-dashboard\/clients\/\$\{thread\.event_id\}\?tab=report`, label: 'Report a problem'/,
    'the supplier’s thread page lost its ⋯ Report',
  );
});

test('3 · each Report door opens a Report page', () => {
  for (const [file, page] of [
    ['app/vendor-dashboard/clients/[eventId]/_components/picked-client-more.ts', /page: 'report'/],
    ['app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx', /page: 'report'/],
  ] as const) {
    assert.match(read(file), page, `${file}: Report goes nowhere`);
  }
});
