/**
 * 🔒 SPEED PASS 2026-11-18 — the reads that stopped waiting in single file stay started together.
 *
 * Each page below had reads that needed nothing from the reads above them yet could not START until those had
 * finished. They now start early through `startAhead` (lib/start-ahead.ts) and are awaited on the line that always
 * awaited them — so a refused read still throws, or is still said, exactly where it was. This guard fails if one of
 * them is moved back into the queue (awaited at its call again) or is asked twice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROOT = join(__dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(ROOT, p), 'utf8'));
const count = (src: string, needle: string) => src.split(needle).length - 1;

/** [file, the started-ahead promise's name, the call it starts, the line that awaits it] */
const CASES: Array<[string, string, string, string]> = [
  ['app/dashboard/[eventId]/schedule/page.tsx', 'profileRead', 'resolveProfile(', 'const profile = await profileRead;'],
  ['app/dashboard/[eventId]/schedule/page.tsx', 'rosEnabledRead', "isDataPrivacyControlActive('coordinator_run_of_show')", 'const rosEnabled = await rosEnabledRead;'],
  ['app/dashboard/[eventId]/schedule/page.tsx', 'prepEnabledRead', 'isCoordinatorPrepReleaseEnabled(', 'const prepEnabled = await prepEnabledRead;'],
  ['app/dashboard/[eventId]/schedule/page.tsx', 'advRolesRead', ".from('event_members')", 'const [advMemberRes, advDelegateRes] = await advRolesRead;'],
  ['app/dashboard/[eventId]/schedule/page.tsx', 'announceRead', 'resolveBroadcastAuthority(', 'const [authority, announceEnabled] = await announceRead;'],
  ['app/dashboard/[eventId]/schedule/page.tsx', 'hostLookupRead', 'findBookedHost(', 'const lookup = await hostLookupRead;'],
  ['app/dashboard/[eventId]/schedule/page.tsx', 'apptRead', ".from('event_appointments')", 'await apptRead;'],
  ['app/vendor-dashboard/customers/page.tsx', 'teamReads', 'fetchVendorTeam(supabase, vendorProfileId).catch(() => null)', 'const [teamRead, assignmentsRead, servicesRead] = await teamReads;'],
  ['app/vendor-dashboard/customers/page.tsx', 'rosterBookingsRead', 'readAllPages(', 'const evRead = await rosterBookingsRead;'],
  ['app/vendor-dashboard/customers/page.tsx', 'monthPartRead', 'startAhead(customersMonth(', 'const monthPart = await monthPartRead;'],
  ['app/_components/frontdoor/front-door.tsx', 'shelvesRead', 'loadDiscoverServiceCards(', '= await shelvesRead;'],
  ['app/_components/frontdoor/front-door.tsx', 'landingRead', 'getCreatableEventTypes(', 'const landingReads = landing ? await landingRead : null;'],
  // (No `app/[slug]/hub/page.tsx` rows: one bar per stage, 20 Nov 2026 — /hub draws nothing, it redirects to the event
  //  page's tab (`dayHubLanding`) after one event read, so it has no reads to start together.)
];

for (const [file, name, call, awaitLine] of CASES) {
  test(`${file} · ${name} starts ahead and is awaited where it always was`, () => {
    const src = read(file);
    const start = src.indexOf(`const ${name} =`);
    assert.ok(start >= 0, `${name} is no longer started ahead`);
    const startsAt = src.indexOf('startAhead(', start);
    assert.ok(startsAt > start && startsAt < start + 200, `${name} is not passed through startAhead (a rejection would be unhandled)`);
    const callAt = src.indexOf(call, start);
    const awaitAt = src.indexOf(awaitLine);
    assert.ok(callAt > start, `${name} no longer starts ${call}`);
    assert.ok(awaitAt > callAt, `${name} is not awaited after it starts (${awaitLine})`);
    assert.equal(count(src, call), 1, `${call} is asked twice in ${file} — starting ahead must not add a read`);
  });
}

test('the front door hangs its second round off the account read alone', () => {
  const src = read('app/_components/frontdoor/front-door.tsx');
  assert.match(src, /const accountRead = startAhead\(resolveRailAccount\(\)\);/);
  assert.match(src, /accountRead\.then\(\(acct\) =>\s*!acct\.signedIn && !searchQuery && !supplierView && signedOutRedirect\(/, 'the landing reads start for a visitor who is about to be redirected');
});
