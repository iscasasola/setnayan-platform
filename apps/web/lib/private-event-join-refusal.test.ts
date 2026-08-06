/**
 * A wedding the couple has set to PRIVATE cannot be joined by a stranger.
 *
 * 🔴 The hole (confirmed on two live private events, 2026-08-06): `/[slug]`
 * showed a stranger the lock screen, while `/[slug]/invite` — the very same
 * wedding — let them type any name, join the guest list, and receive a guest
 * session that then OPENED the lock screen. The couple could not close it:
 * re-issuing the join QR mints a new token but the door still accepted anyone.
 *
 * Two owner decisions were colliding: "private until we launch" and "anyone can
 * add themselves with just a name". Private wins.
 *
 * Guarded at BOTH layers on purpose — the page AND the server action. A page
 * gate is not an API gate; the action can be invoked directly with a valid
 * join token.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { resolveEffectiveVisibility } from './launch-save-the-date';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('the resolver treats an unlaunched event as private, and a due launch as public', () => {
  assert.equal(resolveEffectiveVisibility({ landing_page_visibility: 'private' }), 'private');
  assert.equal(resolveEffectiveVisibility({}), 'private', 'absent visibility must default private');
  assert.equal(resolveEffectiveVisibility({ landing_page_visibility: null }), 'private');
  assert.equal(resolveEffectiveVisibility({ landing_page_visibility: 'public' }), 'public');
  assert.equal(resolveEffectiveVisibility({ landing_page_visibility: 'unlisted' }), 'unlisted');
  // A scheduled launch that has come due reads public even while the column
  // still says private — which is exactly why both guards call this resolver
  // rather than comparing the column themselves.
  assert.equal(
    resolveEffectiveVisibility({
      landing_page_visibility: 'private',
      scheduled_launch_at: new Date(Date.now() - 60_000).toISOString(),
    }),
    'public',
  );
});

test('the join PAGE refuses a private event, and hides that it exists', () => {
  const src = read('app/[slug]/invite/page.tsx');
  assert.match(src, /resolveEffectiveVisibility\(event\) === 'private'/);
  assert.match(src, /landing_page_visibility/, 'the page must select the visibility fields');
  assert.match(src, /scheduled_launch_at/, 'a due scheduled launch must still count as public');
  // notFound(), not a friendly "this is private" — a stranger must not learn
  // the wedding is real.
  const guard = src.slice(src.indexOf("=== 'private'"));
  assert.match(guard.slice(0, 200), /notFound\(\)/);
});

test('the join ACTION refuses too — both write paths, not just the page', () => {
  const src = read('app/join/[eventId]/actions.ts');
  const guards = src.match(/PRIVATE EVENTS REFUSE SELF-JOIN/g) ?? [];
  assert.equal(guards.length, 2, 'both self-join write paths must be guarded');
  assert.match(src, /resolveEffectiveVisibility\(visRow\) === 'private'/);
  // Fail closed: a missing event row refuses rather than falling through.
  assert.match(src, /!visRow \|\| resolveEffectiveVisibility/);
});

test('both layers use the SAME resolver, so they cannot drift apart', () => {
  for (const f of ['app/[slug]/invite/page.tsx', 'app/join/[eventId]/actions.ts']) {
    assert.match(
      read(f),
      /from '@\/lib\/launch-save-the-date'/,
      `${f} must import the shared resolver, not re-implement the rule`,
    );
  }
});
