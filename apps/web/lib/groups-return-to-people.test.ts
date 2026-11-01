/**
 * groups-return-to-people.test.ts — 👥 ‹ FROM A GROUP RETURNS IN PLACE; WITH NOTHING BEHIND IT, PEOPLE › GROUPS.
 *
 * Owner, 2026-10-28: *"an issue on groups is it makes us go back to groups which was not part of people. it did not
 * return to people"*. The group page's back link and about ten group actions sent people to the old standalone
 * `/dashboard/samahan` index instead of People › Groups (`PEOPLE_GROUPS_HREF`, `lib/people-views.ts`).
 *
 * RE-AIMED 2026-10-29 — owner, live in the iPhone app: *"back from a group. it returns but not from the previous screen
 * where we were on people and scrolled down to groups. it returned to people with just the groups."* People › Groups
 * was right as the HOME and wrong as the ‹: a person who scrolled the People list down to Groups and opened one was
 * thrown onto the Groups-only view at the top. So the ‹ is now the chat's ‹ (`ReturnInPlace`, chat/chat-back.tsx):
 * came from a list in this document → the browser's back, the same screen and scroll; a deep link, a push
 * notification, a fresh open → the link, People › Groups. Leaving a group is an action, not a back, and still lands
 * on People › Groups with its note.
 *
 *   1 · no link, redirect or navigation anywhere in the app points at the bare `/dashboard/samahan` (with or without a
 *       query) — a group's OWN page `/dashboard/samahan/<id>` is fine, and so are pathname checks that treat it as
 *       part of People (`under(pathname, '/dashboard/samahan')`);
 *   2 · the old index page forwards to People › Groups and carries the left / archived note;
 *   3 · People says that note;
 *   4 · the group page draws EVERY ‹ through `GroupBack`, which is wrapped in `ReturnInPlace`, and its fallback home is
 *       the map's (`lib/page-home.ts`) — People › Groups; Leave still redirects there with `&left=1`;
 *   5 · the lists a group is opened from (People — every view — and Notifications) mount `ChatOriginMark`;
 *   6 · `cameFromAList` — goes back only when a list was shown IN THIS DOCUMENT and this is not the landing page.
 *
 * Swept, not listed. 🛡 SABOTAGE (2026-10-28, each red then restored): the group back link set back to
 * "/dashboard/samahan" → 1; the old page's redirect removed → 2; People's note removed → 3.
 * 🛡 SABOTAGE (2026-10-29, red then restored): `GroupBack`'s `<ReturnInPlace>` removed (the plain People › Groups link
 * the owner hit) → 4; `ChatOriginMark` dropped from People → 5; the document check dropped from `cameFromAList` → 6.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { PEOPLE_GROUPS_HREF, resolvePeopleView } from './people-views';
import { pageBackLink } from './page-home';
import { cameFromAList } from '../app/_components/chat/chat-back';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function sources(): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || name === '.next') continue;
        walk(full);
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        out.push({ rel: relative(WEB, full), src: stripComments(readFileSync(full, 'utf8')) });
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  return out;
}

/** A place that SENDS someone to an address: a link, a redirect, a router push/replace, or an `href:` field. */
const SENDS_TO_OLD_INDEX =
  /(?:href=\{?|href:\s*|redirect\(|\.push\(|\.replace\(|permanentRedirect\()\s*[`'"]\/dashboard\/samahan(?:\?[^`'"]*)?[`'"]/;

test('1 · nothing in the app sends anyone to the old /dashboard/samahan index', () => {
  const offenders = sources()
    .filter(({ src }) => SENDS_TO_OLD_INDEX.test(src))
    .map(({ rel }) => rel);
  assert.deepEqual(offenders, [], `send People › Groups (PEOPLE_GROUPS_HREF) instead:\n${offenders.join('\n')}`);
  // The scanner can see: the pattern catches the exact shape the bug had.
  assert.ok(SENDS_TO_OLD_INDEX.test('<Link href="/dashboard/samahan" className={BACK}>'));
  assert.ok(SENDS_TO_OLD_INDEX.test("redirect('/dashboard/samahan?left=1')"));
  assert.ok(!SENDS_TO_OLD_INDEX.test("redirect(`/dashboard/samahan/${communityId}`)"), 'a group page itself must stay allowed');
  assert.ok(!SENDS_TO_OLD_INDEX.test("under(pathname, '/dashboard/samahan')"), 'a pathname check must stay allowed');
});

test('2 · the old index forwards to People › Groups, with the note', () => {
  const page = read('app/dashboard/(account)/samahan/page.tsx');
  const fwd = /redirect\(`([^`$]+)\$\{note\}`\)/.exec(page);
  assert.ok(fwd, 'the old Groups index no longer forwards to People');
  assert.equal(fwd[1], PEOPLE_GROUPS_HREF, 'the old Groups index forwards somewhere other than People › Groups');
  assert.match(page, /sp\.left === '1' \? '&left=1'/);
  assert.equal(PEOPLE_GROUPS_HREF, '/dashboard/people?view=samahan');
  // The address really opens Groups whenever Groups is a view the person has.
  const view = new URL(PEOPLE_GROUPS_HREF, 'https://x').searchParams.get('view');
  assert.equal(resolvePeopleView(view, { showConnections: true, showDependents: true }), 'samahan');
});

test('3 · People says "You left the group." when it arrives with the note', () => {
  const people = read('app/dashboard/(account)/people/page.tsx');
  assert.match(people, /sp\.left === '1' \|\| sp\.archived === '1'[\s\S]{0,200}data-group-notice=""/, 'People drops the left/archived note');
  assert.match(people, /You left the group\./);
});

const GROUP_PAGE = 'app/dashboard/(account)/samahan/[communityId]/page.tsx';
const GROUP_BACK = 'app/dashboard/(account)/samahan/[communityId]/_components/group-back.tsx';

test('4 · every ‹ on the group page returns in place, and falls back to the map\'s home', () => {
  const page = read(GROUP_PAGE);
  // Both ‹s — the group's own and a one-tap view's — are GroupBack; none is drawn by hand beside it.
  assert.equal((page.match(/<GroupBack\b/g) ?? []).length, 2, 'the group page draws a ‹ that is not GroupBack');
  assert.doesNotMatch(page, /<ArrowLeft\b/, 'a hand-drawn ‹ on the group page skips ReturnInPlace');
  // GroupBack IS the return-in-place: its link sits inside ReturnInPlace.
  const back = read(GROUP_BACK);
  assert.match(back, /<ReturnInPlace>\s*<Link\b[\s\S]*?<\/Link>\s*<\/ReturnInPlace>/, 'GroupBack lost ReturnInPlace — ‹ jumps to People › Groups again');
  // With nothing behind it, the group's ‹ is the map's home — People › Groups.
  assert.match(page, /pageBackLink\('\/dashboard\/samahan\/\[communityId\]'\)/);
  assert.equal(pageBackLink('/dashboard/samahan/[communityId]')?.href, PEOPLE_GROUPS_HREF);
  // Leave is an action, not a back: it still lands on People › Groups with its note.
  assert.match(read('app/dashboard/(account)/samahan/actions.ts'), /redirect\(`\$\{PEOPLE_GROUPS_HREF\}&left=1`\)/);
});

test('5 · the lists a group opens from mark this tab, so ‹ can come back to them', () => {
  for (const rel of ['app/dashboard/(account)/people/page.tsx', 'app/dashboard/(account)/notifications/page.tsx']) {
    const src = read(rel);
    assert.match(src, /<ChatOriginMark \/>/, `${rel} no longer marks the tab — ‹ from a group opened there jumps away`);
  }
  // People's mark is on the page for every view (the full list AND People › Groups), not inside one view's branch.
  const people = read('app/dashboard/(account)/people/page.tsx');
  const at = people.indexOf('<ChatOriginMark />');
  assert.ok(at > -1 && at < people.indexOf("view === 'samahan' && groupRows"), 'the mark moved inside one view');
});

test('6 · ‹ is the browser\'s back only after a list in THIS document, and never on the landing page', () => {
  const mark = (doc: string) => JSON.stringify({ at: '/dashboard/people', doc });
  const g = '/dashboard/samahan/abc';
  assert.equal(cameFromAList(mark('1'), g, '1', '/dashboard', 4), true, 'People → group, same document: back in place');
  assert.equal(cameFromAList(null, g, '1', '/dashboard', 4), false, 'no list seen: the link');
  assert.equal(cameFromAList(mark('1'), g, '2', g, 4), false, 'a push notification / deep link reloads: the link');
  assert.equal(cameFromAList(mark('1'), g, '2', '/dashboard', 4), false, 'a list from an earlier document does not count');
  assert.equal(cameFromAList(mark('1'), g, '1', g, 4), false, 'the landing page has nothing of ours behind it');
  assert.equal(cameFromAList(mark('1'), g, '1', '/dashboard', 1), false, 'a fresh tab has no back');
  assert.equal(cameFromAList('/dashboard/people', g, '1', '/dashboard', 4), false, 'an old bare-path mark is not trusted');
});
