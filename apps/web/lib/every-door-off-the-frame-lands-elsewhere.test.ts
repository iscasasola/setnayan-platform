/**
 * EVERY DOOR OFF THE ONE CHAT BOX LANDS SOMEWHERE ELSE.
 *
 * ── WHAT THIS EXISTS TO CATCH (AREA-CHAT, 2026-09-19) ────────────────────────
 * #5614 made a bare landing on the supplier's client page and on the couple's
 * workspace a CHAT landing: both redirect to the thread page. That is the
 * design — and it turns any link FROM the thread page back to those pages,
 * without a `?tab=`, into a loop that reloads the conversation. Walked as the
 * real person on origin/main + #5614, three doors looped:
 *
 *   · the customer rail's "Full customer profile" button (bare client route);
 *   · the accepted quote card's "🔒 Ask <shop> to lock" (bare workspace route —
 *     and the workspace holds no Lock control at all; see lib/lock-door.ts);
 *   · the sent-quote page's "Go ask <shop> to lock" (the same bare route).
 *
 * A fourth was a flash, not a loop: both shells passed `initialTabId="chat"`,
 * which names a LINK tab and can never be active, so `?tab=details` painted
 * Quote on the server and switched after hydration.
 *
 * Every assertion is a COUNT read from source with comments stripped, and the
 * floors face the sabotage actually possible: drop the `?tab=`, point a lock
 * link back at the workspace, hard-code the initial tab again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

const RAIL = 'app/vendor-dashboard/messages/[threadId]/_components/chat-info-rail.tsx';
const COUPLE_THREAD = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const PROPOSAL = 'app/proposals/[publicId]/page.tsx';
const CLIENT_PAGE = 'app/vendor-dashboard/clients/[eventId]/page.tsx';
const WORKSPACE = 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx';

const rail = read(RAIL);
const coupleThread = read(COUPLE_THREAD);
const proposal = read(PROPOSAL);
const client = read(CLIENT_PAGE);
const workspace = read(WORKSPACE);

test('the scan reads every file (an empty read is a green lie)', () => {
  for (const [rel, src] of [
    [RAIL, rail],
    [COUPLE_THREAD, coupleThread],
    [PROPOSAL, proposal],
    [CLIENT_PAGE, client],
    [WORKSPACE, workspace],
  ] as const) {
    assert.ok(src.length > 800, `${rel} read as ${src.length} chars`);
  }
});

test('1 · the rail’s "Full customer profile" names a section, never the bare client route', () => {
  assert.equal(count(rail, /clients\/\$\{eventId\}\?tab=details/g), 1, 'the profile button lost its ?tab=details');
  assert.equal(count(rail, /clients\/\$\{eventId\}`/g), 0, 'a bare client link on the rail redirects straight back to the thread');
  // The redirect it would loop into is still there — the guard is only
  // meaningful while the client page treats a bare landing as a chat landing.
  assert.equal(count(client, /rawTab === 'chat'/g), 1);
});

test('2 · the couple’s "ask them to lock" goes through the one lock-door rule, never the workspace', () => {
  assert.equal(count(coupleThread, /quoteLockHref = coupleLockDoorHref\(/g), 1, 'the thread page derives the lock door itself');
  assert.equal(count(coupleThread, /quoteLockHref = `[^`]*workspace`/g), 0, 'the lock link points at the workspace again — it holds no Lock');
  assert.equal(count(coupleThread, /lockHref=\{quoteLockHref\}/g), 1, 'the quote card is not handed the lock door');
  // The pick row is read with its category, or the door cannot pick a tile.
  assert.equal(count(coupleThread, /\.select\('vendor_id, category'\)/g), 1);
});

test('3 · the couple’s ⋮ still reaches the workspace, and every one of those doors carries a ?tab=', () => {
  const uses = count(coupleThread, /\$\{workspaceHref\}/g);
  const withTab = count(coupleThread, /\$\{workspaceHref\}\?tab=/g);
  assert.ok(uses >= 5, `expected the five ⋮ sections, found ${uses} uses of workspaceHref`);
  assert.equal(uses, withTab, 'a workspace door without ?tab= redirects back to this frame');
  assert.equal(count(coupleThread, /workspaceHref = `\/dashboard\/\$\{eventId\}\/vendors\/\$\{pick\.vendor_id\}\/workspace`/g), 1);
});

test('4 · the sent-quote page’s next step goes through the same rule', () => {
  assert.equal(count(proposal, /lockDoorHref = coupleLockDoorHref\(/g), 1, 'the proposals page derives the lock door itself');
  assert.equal(count(proposal, /lockDoorHref = `[^`]*workspace`/g), 0, 'the lock link points at the workspace again');
  assert.equal(count(proposal, /href=\{lockDoorHref\}/g), 1, 'the next-step button is not handed the lock door');
  assert.equal(count(proposal, /\.select\('vendor_id, category'\)/g), 1);
});

test('5 · both shells paint the tab the URL names, on the server', () => {
  assert.equal(count(client, /initialTabId=\{rawTab\}/g), 1, 'the client page hard-codes its initial tab');
  assert.equal(count(workspace, /initialTabId=\{rawLanding\}/g), 1, 'the workspace hard-codes its initial tab');
  for (const [rel, src] of [[CLIENT_PAGE, client], [WORKSPACE, workspace]] as const) {
    assert.equal(count(src, /initialTabId="chat"/g), 0, `${rel} names the link tab as its initial tab — that is never selectable`);
  }
  // `rawLanding` must be in scope for the shell, i.e. hoisted out of the
  // redirect's block — the redirect itself is unchanged.
  assert.ok(
    workspace.indexOf("const rawLanding = typeof search.tab === 'string'") < workspace.indexOf('if (relationshipShellEnabled && chatThread)'),
    'rawLanding is declared inside the redirect block and out of the shell’s scope',
  );
});
