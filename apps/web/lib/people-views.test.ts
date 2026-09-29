/**
 * people-views.test.ts — the People page's views, the picker's rows and the
 * request's words (owner 2026-09-28, the People redesign).
 *
 * Executed, not read: `lib/people-views.ts` is the one resolver the page, the
 * rail and the picker all share, and `connectionRequestSentence` is the one
 * sentence the People row and the bell's title both say.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  availablePeopleViews,
  defaultPeopleView,
  peopleViewHref,
  peopleViewOptions,
  resolvePeopleView,
} from './people-views';
import { connectionRequestSentence } from './people-add';

const ON = { showConnections: true, showDependents: true };

test('the six views, in the picker’s order, when everything is on', () => {
  assert.deepEqual(availablePeopleViews(ON), [
    'requests',
    'connected',
    'following',
    'followers',
    'alaga',
    'samahan',
  ]);
  assert.equal(defaultPeopleView(ON), 'connected');
});

test('a view this account cannot open, or an unknown one, lands on the default — never a blank', () => {
  assert.equal(resolvePeopleView('alaga', { showConnections: true, showDependents: false }), 'connected');
  assert.equal(resolvePeopleView('nonsense', ON), 'connected');
  assert.equal(resolvePeopleView(undefined, ON), 'connected');
  assert.equal(resolvePeopleView(' FOLLOWERS ', ON), 'followers', 'case and spaces do not matter');
  // Connections off: Requests and Connected are gone, the default moves on.
  const off = { showConnections: false, showDependents: true };
  assert.equal(resolvePeopleView('requests', off), 'following');
  assert.ok(!availablePeopleViews(off).includes('connected'));
});

test('the default view IS the bare page — the bell’s /dashboard/people and the People row are one address', () => {
  assert.equal(peopleViewHref('connected', ON), '/dashboard/people');
  assert.equal(peopleViewHref('samahan', ON), '/dashboard/people?view=samahan');
  assert.equal(peopleViewHref('requests', ON), '/dashboard/people?view=requests');
});

test('🔴 Requests is listed FIRST with a dot while anybody waits — and not at all when nobody does', () => {
  const waiting = peopleViewOptions(ON, { requests: 2, connected: 6 });
  assert.equal(waiting[0]!.key, 'requests');
  assert.equal(waiting[0]!.label, 'Requests 2');
  assert.equal(waiting[0]!.dot, true);
  assert.equal(waiting[0]!.dotNote, 'waiting on you');

  const none = peopleViewOptions(ON, { requests: 0, connected: 6 });
  assert.ok(!none.some((o) => o.key === 'requests'), 'an empty Requests row is noise');
  // …unless it is the open view: the picker never shows a blank button.
  assert.ok(peopleViewOptions(ON, { requests: 0 }, 'requests').some((o) => o.key === 'requests'));
});

test('🔴 a count that could not be read is left OFF the label, never printed as 0 — and never hides a request', () => {
  const opts = peopleViewOptions(ON, { requests: null, following: null, followers: 1234 });
  assert.ok(opts.some((o) => o.key === 'requests'), 'a refused read hid the Requests row');
  assert.equal(opts.find((o) => o.key === 'following')!.label, 'Following');
  assert.equal(opts.find((o) => o.key === 'followers')!.label, 'Followers 1,234', 'counts carry commas');
});

test('the request, in the owner’s words — from an event, and without one', () => {
  assert.equal(
    connectionRequestSentence('Marites Reyes', { name: 'Cale & Ice', type: 'wedding' }),
    'Marites Reyes is trying to add you from your Cale & Ice wedding event.',
  );
  assert.equal(
    connectionRequestSentence('Tito Ben', { name: 'Bea', type: 'eighteenth_birthday' }),
    'Tito Ben is trying to add you from your Bea eighteenth birthday event.',
    'a stored snake_case kind reads as words',
  );
  assert.equal(connectionRequestSentence('Dennis Ramos', null), 'Dennis Ramos is trying to add you.');
  assert.equal(
    connectionRequestSentence('Dennis Ramos', { name: '  ', type: 'wedding' }),
    'Dennis Ramos is trying to add you.',
    'an event with no name is not named',
  );
  assert.equal(connectionRequestSentence('  ', null), 'Someone is trying to add you.');
});
