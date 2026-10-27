/**
 * groups-return-to-people.test.ts — 👥 EVERY WAY BACK FROM A GROUP LANDS ON PEOPLE › GROUPS.
 *
 * Owner, 2026-10-28: *"an issue on groups is it makes us go back to groups which was not part of people. it did not
 * return to people"*. The group page's back link and about ten group actions sent people to the old standalone
 * `/dashboard/samahan` index instead of People › Groups (`PEOPLE_GROUPS_HREF`, `lib/people-views.ts`).
 *
 *   1 · no link, redirect or navigation anywhere in the app points at the bare `/dashboard/samahan` (with or without a
 *       query) — a group's OWN page `/dashboard/samahan/<id>` is fine, and so are pathname checks that treat it as
 *       part of People (`under(pathname, '/dashboard/samahan')`);
 *   2 · the old index page forwards to People › Groups and carries the left / archived note;
 *   3 · People says that note.
 *
 * Swept, not listed. 🛡 SABOTAGE (2026-10-28, each red then restored): the group back link set back to
 * "/dashboard/samahan" → 1; the old page's redirect removed → 2; People's note removed → 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { PEOPLE_GROUPS_HREF, resolvePeopleView } from './people-views';

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
