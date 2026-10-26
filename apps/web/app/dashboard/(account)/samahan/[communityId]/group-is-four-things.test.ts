/**
 * group-is-four-things.test.ts — the group page draws EXACTLY the owner's four parts, in the prototype's order.
 *
 * Owner, 2026-10-26, verbatim: "Groups: We can bring in people in the group and they share the same group where
 * there is a place for chat, events and stories. that's it". prototypes/group_samahan_2026-10-25 (corpus 0e658e05)
 * draws them as one page: the members row (with "Bring people in") → Events → Stories → Chat. The tab bar it
 * replaced (overview · usapan · members · events) put the three things he named three taps apart.
 *
 * What is held, with comments stripped first so a note naming a part cannot satisfy it:
 *   1. `GroupHome` stamps `data-group-part` exactly four times, in the order members · events · stories · chat —
 *      a fifth part (a "proposed addition") or a reorder goes red;
 *   2. the members part carries the "Bring people in" door, and Stories is the shipped strip;
 *   3. the page has no tab bar any more, renders `GroupHome` for the group page, and every old `?tab=` address
 *      still resolves to a view — they are written by redirects, the Usapan notice and the create-event back link,
 *      so dropping one would land a real person on the wrong screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = stripComments(readFileSync(join(HERE, '_components', 'group-home.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

/** The body of `GroupHome` only — from its declaration to the next top-level function. */
function groupHomeBody(): string {
  const start = HOME.indexOf('export function GroupHome(');
  assert.ok(start >= 0, 'GroupHome is gone — the guard cannot watch a function it cannot find');
  const next = HOME.indexOf('\nfunction ', start + 10);
  const nextExport = HOME.indexOf('\nexport function ', start + 10);
  const ends = [next, nextExport].filter((i) => i > 0);
  return HOME.slice(start, ends.length ? Math.min(...ends) : undefined);
}

test('the group page draws exactly four parts: members · events · stories · chat', () => {
  const body = groupHomeBody();
  const parts = [...body.matchAll(/data-group-part="([a-z]+)"/g)].map((m) => m[1]);
  console.log(`# group parts, in order: ${parts.join(' · ')}`);
  assert.deepEqual(parts, ['members', 'events', 'stories', 'chat']);
});

test('members carries "Bring people in"; stories is the shipped strip; chat opens Usapan', () => {
  const body = groupHomeBody();
  const slice = (part: string) => {
    const at = body.indexOf(`data-group-part="${part}"`);
    const after = body.indexOf('data-group-part="', at + 10);
    return body.slice(at, after === -1 ? undefined : after);
  };
  assert.match(slice('members'), /Bring people in/, 'the members part lost its door to bring people in');
  assert.match(slice('members'), /\?tab=members#bring-in/, '"Bring people in" no longer lands on the invite link');
  assert.match(slice('stories'), /<SamahanStories\b/, 'Stories is no longer the shipped strip');
  assert.match(slice('chat'), /\?tab=usapan/, 'the chat row no longer opens Usapan');
  assert.match(slice('events'), /<GroupEventRow\b/, 'Events no longer draws the shared row');
});

test('no tab bar, GroupHome for the group page, every old ?tab= address still resolves', () => {
  assert.ok(!PAGE.includes('aria-label="Group sections"'), 'the tab bar came back');
  assert.ok(!/TABS\.map\(/.test(PAGE), 'the tab bar came back');
  assert.match(PAGE, /<GroupHome\b/, 'the page no longer draws the group page');
  const views = PAGE.match(/const VIEWS = \[([^\]]*)\] as const/);
  assert.ok(views, 'the one-tap views list is gone');
  for (const tab of ['usapan', 'members', 'events']) {
    assert.ok(views![1]!.includes(`'${tab}'`), `?tab=${tab} no longer resolves — old links and redirects land wrong`);
  }
});
