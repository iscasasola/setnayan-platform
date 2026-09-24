/**
 * search-scope.test.ts — the rule, exercised: the search searches the place
 * you are standing in (owner 2026-09-23).
 *
 * The assertions that matter most here are the NEGATIVE ones. Narrowing is
 * easy to add and hard to notice when it is wrong: a box that quietly points
 * at a place with no index returns nothing and looks broken, and a box that
 * narrows on a URL one level off tells a person their own things are gone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SEARCH_SCOPES,
  itemInScope,
  resolveSearchScope,
  type SearchScopeKey,
} from './search-scope';

test('Discover is the answer for the front door and for anything unrecognised', () => {
  for (const path of ['/', '/explore', '/papic', '/blog/some-guide', '/realstories']) {
    assert.equal(resolveSearchScope(path).key, 'discover', `${path} should be Discover`);
  }
});

test('a missing pathname is Discover, never a crash and never null', () => {
  assert.equal(resolveSearchScope(null).key, 'discover');
  assert.equal(resolveSearchScope(undefined).key, 'discover');
  assert.equal(resolveSearchScope('').key, 'discover');
});

test('🔴 the events board narrows to your events', () => {
  assert.equal(resolveSearchScope('/dashboard').key, 'events');
});

test('🔴 an account spoke under /dashboard does NOT narrow', () => {
  /*
    The whole reason the events row is `exact`. Every account spoke lives under
    /dashboard — profile, notifications, Alaala, people. Left prefix-matching,
    somebody reading their own settings would be told the search is pointed at
    their events, and typing a guide's title there would silently return
    nothing.
  */
  for (const path of [
    '/dashboard/profile',
    '/dashboard/notifications',
    '/dashboard/library',
    '/dashboard/people',
    '/dashboard/create-event',
  ]) {
    assert.equal(resolveSearchScope(path).key, 'discover', `${path} must not narrow to events`);
  }
});

test('🛑 a place with NO index does not narrow — it keeps the wider scope', () => {
  /*
    The rule is agreed for these places and the index is not built. Narrowing
    here would make the box PROMISE a search that returns nothing, which is the
    defect `public-search-nouns.ts` exists to prevent. When an index lands, the
    row is added here AND a source there — this test is the reminder that the
    two go together.
  */
  for (const path of [
    '/dashboard/S89E-ABCDEFGHJK',            // inside one event
    '/dashboard/S89E-ABCDEFGHJK/guests',     // that event's guests
    '/vendor-dashboard',                      // the shop
    '/vendor-dashboard/services',
  ]) {
    assert.equal(
      resolveSearchScope(path).key,
      'discover',
      `${path} narrowed with nothing behind it — add the source before the row`,
    );
  }
});

test('⚠ /admin is deliberately absent — it hands the shell its own searchSlot', () => {
  // AdminSearchBox searches the console's pages, jobs and price rows. A scope
  // row here would be a second, weaker answer to a question that surface
  // already answers well — and `searchSlot` wins anyway, so the row would be
  // dead code that reads like a decision.
  assert.equal(resolveSearchScope('/admin').key, 'discover');
  assert.ok(!('admin' in SEARCH_SCOPES), 'an admin scope appeared — see the note in search-scope.ts');
});

test('every scope announces itself, and the way out terminates', () => {
  for (const [key, scope] of Object.entries(SEARCH_SCOPES)) {
    assert.equal(scope.key, key, `${key} carries the wrong key`);
    assert.match(scope.placeholder, /^Search /, `${key} placeholder must read as a search`);
    assert.ok(scope.shortPlaceholder.length > 0, `${key} has no phone placeholder`);
    assert.ok(
      scope.shortPlaceholder.length <= scope.placeholder.length,
      `${key}'s short placeholder is not shorter`,
    );
  }

  // Walk every chain to the top. A cycle or a dangling key would strand
  // somebody inside a narrowed box with no way back out.
  for (const key of Object.keys(SEARCH_SCOPES) as SearchScopeKey[]) {
    let at: SearchScopeKey | null = key;
    let hops = 0;
    while (at !== null) {
      assert.ok(at in SEARCH_SCOPES, `${key} climbs to an unknown scope ${at}`);
      at = SEARCH_SCOPES[at].widerKey;
      assert.ok(++hops <= 8, `${key} does not reach the widest scope — cycle?`);
    }
  }
  assert.equal(SEARCH_SCOPES.discover.widerKey, null, 'Discover must be the widest');
});

test('🔑 scope decides WHICH ROWS EXIST before any matching runs', () => {
  // Discover contains everything you may reach — that is the rule, not a
  // shortcut for "no filter".
  for (const kind of ['event', 'space', 'action'] as const) {
    assert.ok(itemInScope(kind, 'discover'), `Discover dropped a ${kind}`);
  }
  // Your events board is about events.
  assert.ok(itemInScope('event', 'events'));
  assert.ok(!itemInScope('space', 'events'), 'the events scope admitted a space');
  assert.ok(!itemInScope('action', 'events'), 'the events scope admitted a jump link');
});
