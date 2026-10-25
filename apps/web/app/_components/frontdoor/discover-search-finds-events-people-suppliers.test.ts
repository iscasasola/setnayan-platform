/**
 * discover-search-finds-events-people-suppliers.test.ts — WHAT DISCOVER'S SEARCH ANSWERS WITH (owner 2026-10-25).
 *
 * Owner, after searching "cale" on Discover and getting only HELP/GUIDE cards: *"what i want is the discover being
 * their place to see suppliers, people, and their events. From their own, the the people they connected, to the rest
 * of the users of setnayan that made their event public."* — then *"so it is like how youtube searches · find the
 * user, and the videos related to the search"*.
 *
 * Held here:
 *   1 · an event card is found by its title, its address's words and its PUBLIC host name — through the ONE matcher
 *       your own events use (executed);
 *   2 · the world read's pattern can carry no filter syntax (executed);
 *   3 · Discover's results draw EVENTS · PEOPLE · SUPPLIERS, a matching person (else shop) first, and NO stories or
 *       guides — the reading search is not even asked (source, comments stripped);
 *   4 · the front door hands the events read to the results, and a refused events read says so (source).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { matchesCommandQuery } from '@/lib/command-match';
import { discoverCardMatchable, discoverSearchPattern } from '@/lib/discover-events-core';

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const card = (title: string, slug: string, host: string | null) => ({
  title,
  href: `/${slug}`,
  host: host ? { name: host, slug: 'h' } : null,
});
const finds = (c: ReturnType<typeof card>, q: string) => matchesCommandQuery(discoverCardMatchable(c), q);

test('1 · an event is found by its title, its address and its public host — case-insensitive', () => {
  assert.equal(finds(card('Indalecio & Claire', 'cale-ice', null), 'cale'), true, 'the address words');
  assert.equal(finds(card('Indalecio & Claire', 'cale-ice', null), 'CALE ICE'), true, 'the address, as words');
  assert.equal(finds(card('Ana & Paolo', 'ana-paolo', null), 'paolo'), true, 'the title');
  assert.equal(finds(card('Family reunion', 'reunion-2026', 'Ana Santos'), 'santos'), true, 'the public host name');
  assert.equal(finds(card('Family reunion', 'reunion-2026', null), 'santos'), false, 'a host with no public name is never searched');
  assert.equal(finds(card('Ana & Paolo', 'ana-paolo', null), 'xyzzy'), false);
});

test('2 · the world read’s pattern carries no filter syntax', () => {
  assert.equal(discoverSearchPattern('cale ice'), '%cale%ice%');
  assert.equal(discoverSearchPattern("O'Brien"), '%O%Brien%');
  assert.equal(discoverSearchPattern('   '), null);
  assert.equal(discoverSearchPattern('(),"\\*'), null);
  for (const typed of ['a,b', 'x)or(y', 'q"w', 'a\\b', 'star*', 'ñiño & josé']) {
    assert.doesNotMatch(discoverSearchPattern(typed) ?? '', /[,()"\\*]/, typed);
  }
});

test('3 · Discover draws events · people · suppliers — the person (else shop) first — and no stories or guides', () => {
  const src = code('app/_components/frontdoor/front-door-results.tsx');
  const at = src.indexOf('function DiscoverResults(');
  assert.ok(at > 0, 'DiscoverResults is gone — re-anchor');
  const body = src.slice(at);
  // The three kinds, each in the card this page already draws.
  assert.match(body, /<DiscoverEventCard key=\{c\.key\} card=\{c\} \/>/, 'Discover no longer lists events');
  assert.match(body, /ownEvents\.map\(\(i\) => \(\s*<OwnCard/, 'Discover no longer lists your own events');
  assert.match(body, /<ShellPeopleSection people=\{\{ rows: restPeople/, 'Discover no longer lists people');
  assert.match(body, /restShops\.map\(\(s\) => \(\s*<ShopHitCard/, 'Discover no longer lists suppliers');
  // No article kinds at all.
  assert.doesNotMatch(body, /ReadCard|\bhits\b|searchReads|fd-readblurb/, 'Discover lists stories or guides again');
  assert.doesNotMatch(body, /i\.kind === 'space'/, 'Discover lists spaces');
  // In order: the channel, then events, then the rest of the people, then suppliers.
  const order = ['data-discover-channel', 'data-discover-events', 'rows: restPeople', 'data-discover-suppliers'].map((m) => body.indexOf(m));
  assert.ok(order.every((i) => i > 0), `an anchor is gone: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'the order is no longer channel → events → people → suppliers');
  // The reading search is not even asked on Discover.
  assert.match(src, /onDiscover \? Promise\.resolve\([^)]*\) : searchReads\(/, 'Discover asks for stories and guides again');
  assert.match(src, /if \(onDiscover\) \{\s*return \(\s*<DiscoverResults/, 'Discover no longer draws its own results');
});

test('4 · the front door hands the events read in, and a refused read says so', () => {
  const fd = code('app/_components/frontdoor/front-door.tsx');
  assert.match(fd, /searchDiscoverEvents\(searchQuery\)/, 'the front door no longer reads Discover’s events');
  assert.match(fd, /place="discover"[\s\S]*?events=\{discoverEvents\}/, 'the events read never reaches the results');
  const src = code('app/_components/frontdoor/front-door-results.tsx');
  assert.match(src, /events\?\.status === 'unavailable' \? \(\s*<p role="status"[^>]*>\s*\{EVENTS_UNREAD\}/, 'a refused events read is silent');
  assert.match(src, /incomplete\s*\?\s*'couldn’t finish'\s*:\s*'nothing here yet'/, 'a refused read can read as "nothing here"');
  const loader = code('lib/discover-events.ts');
  assert.match(loader, /export async function searchDiscoverEvents\(query: string\): Promise<ShelfState<DiscoverEventCard>>/);
  assert.match(loader, /readEventShelves\(admin, graph, null, manilaTodayISO\(\), \{ query \}\)/, 'the search left the shelves’ own reads and allow-list');
});
