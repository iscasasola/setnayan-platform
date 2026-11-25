/**
 * schedule-profile-groups-reads-hold-final-check.test.ts — final check, area 2, fix batch 5 (25 Nov 2026).
 *
 * Ten findings, most of them one rule (CLAUDE.md §5 rule 4): a refused read is said, never drawn as "none",
 * "nothing waiting", "not found", a blank form that Save would write over, or an invitation to rotate a link that still
 * works. Behaviour for the lib readers against a stubbed client; comment-stripped source for each page's wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const src = (rel: string): string => stripComments(readFileSync(join(web, rel), 'utf8'));

test('A2-C14: group readers say "refused" (null / measured:false), never "none" (lib/communities.ts is server-only)', () => {
  const lib = src('lib/communities.ts');
  assert.match(lib, /export async function readCommunityEvents\([\s\S]*?Promise<CommunityEventRow\[\] \| null>/);
  assert.match(lib, /export async function readCommunityRoster\([\s\S]*?Promise<CommunityRosterEntry\[\] \| null>/);
  assert.match(lib, /return \{ measured: false \};/);
  assert.match(lib, /return \(await readCommunityEvents\(supabase, communityId\)\) \?\? \[\];/, 'the old name keeps its shape');
});

test('A2-C14: the group page says when its roster, events or invite link could not be read', () => {
  const s = src('app/dashboard/(account)/samahan/[communityId]/page.tsx');
  assert.match(s, /rosterUnread=\{rosterRead === null\}/);
  assert.match(s, /tokenUnread=\{!tokenRead\.measured\}/);
  assert.match(s, /eventsUnread=\{eventsRead === null\}/);
  assert.ok(s.indexOf(') : tokenUnread ? (') < s.indexOf('No active link'), 'never "rotate" over a refused token read');
  assert.ok(s.indexOf('{eventsUnread ? (') < s.indexOf('Walang event pa.'));
});

test('A2-I1: the Schedule requests sheet says when the requests could not be read', () => {
  assert.match(src('app/dashboard/[eventId]/schedule/page.tsx'), /requestsUnread=\{Boolean\(suggestionsRes\.error\)\}/);
  const sheet = src('app/dashboard/[eventId]/schedule/_components/day-sheets.tsx');
  assert.ok(sheet.indexOf('{unread ? (') < sheet.indexOf('Nothing waiting.'), 'the refusal is decided first');
  const rail = src('app/dashboard/[eventId]/schedule/_components/day-rail.tsx');
  assert.equal(rail.split('unread={requestsUnread}').length - 1, 2, 'both sheet mounts carry it');
});

test('A2-I3: paperwork deadlines and meetings that could not be read are said, not dropped', () => {
  const lib = src('lib/preparation.ts');
  assert.match(lib, /if \(paperwork === null\) missing\.push\('paperwork'\)/);
  assert.match(lib, /if \(appointments === null\) missing\.push\('meeting'\)/);
  assert.match(src('app/dashboard/[eventId]/schedule/_components/preparation-agenda.tsx'), /\.\.\.\(agenda\.missing \?\? \[\]\)/);
});

test('A2-B2: Home’s Shop part says it could not read, never "you have none", when the shops read failed', () => {
  assert.match(src('lib/unihome.server.ts'), /if \(!switcher \|\| switcher\.shopsMeasured === false\) return \{ kind: 'unread' \}/);
  assert.match(src('app/_components/account-switcher/get-switcher-data.ts'), /shopsMeasured: false,/);
  const home = src('app/dashboard/(launcher)/_components/unihome.tsx');
  assert.ok(home.indexOf("shop.kind === 'unread'") < home.indexOf("shop.kind === 'none'"));
});

test('A2-C12: a loved one’s refused read is not a 404', () => {
  const s = src('app/dashboard/(account)/people/[dependentId]/page.tsx');
  const refused = s.indexOf('if (depError) {');
  assert.ok(refused >= 0 && s.indexOf('<ReadRefusedNotice', refused) > refused);
  assert.ok(s.indexOf('<ReadRefusedNotice', refused) < s.indexOf('if (!depRow) notFound()'));
});

test('A2-C7 / A2-C8: profile never offers blank forms over a refusal, and speaks plain words', () => {
  const s = src('app/dashboard/(account)/profile/page.tsx');
  const refused = s.indexOf("'ProfilePage (users)'");
  assert.ok(s.indexOf('<ReadRefusedNotice what="your profile"', refused) > refused, 'stops at the refusal');
  assert.match(s, /\{pendingDeletionErr \? \(/);
  assert.doesNotMatch(s, /§ 10a|§ 10b/);
  assert.match(s, /ACCOUNT_TYPE_WORDS\[profile\?\.account_type \?\? ''\]/);
});

test('A2-A10: a refused invitation read is "try again", not "not found"', () => {
  const s = src('app/host/accept/[token]/page.tsx');
  assert.match(s, /const \{ data: inviteRaw, error: inviteError \}/);
  assert.ok(s.indexOf('if (inviteError) {') < s.indexOf('notFound()'));
});

test('A2-A7: the "You" card is not drawn from a refused profile read', () => {
  const s = src('app/signup/you/page.tsx');
  const refused = s.indexOf('if (profileError) {');
  assert.ok(refused >= 0 && refused < s.indexOf('const me = (profile ?? {})'));
});

test('A2-H11: a couple’s field address opens Event settings on that row', () => {
  const s = src('app/dashboard/[eventId]/details/field/[row]/page.tsx');
  assert.match(s, /redirect\(eventSettingsHref\(eventId, settingsRow\)\)/);
  assert.match(s, /area: 'event'/);
  assert.match(s, /date: 'date'/);
});
