/**
 * only-accepted-people-are-offered.test.ts — Add a guest › "From your people" offers ACCEPTED connections only, once
 * per person, and never the roster's "Someone" placeholder as a name (walk 13 Nov 2026, F-W3-20 privacy · F-W3-22).
 *
 * SABOTAGE: drop the `state !== 'connected'` skip → RED; drop the `m.known` skip → RED; drop the ROSTER_UNNAMED skip →
 * RED; read pending edges in `confirmedConnectionUserIds` → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(import.meta.dirname, 'people-you-can-invite.ts'), 'utf8'));

test('a pending request is not "your people"', () => {
  assert.match(src, /if \(p\.kind === 'connection' && p\.state !== 'connected'\) continue;/);
});

test('one row per person — a confirmed connection is not listed again under the group', () => {
  assert.match(src, /fetchSamahanSecondDegree\(supabase, admin, userId, confirmed\)/);
  assert.match(src, /if \(m\.known\) continue;/);
  const helper = stripComments(readFileSync(join(import.meta.dirname, 'confirmed-connection-user-ids.ts'), 'utf8'));
  assert.match(helper, /export async function confirmedConnectionUserIds/);
  assert.match(helper, /\.eq\('status', 'confirmed'\)/, 'pending requests must not count as known');
});

test('the roster placeholder is never a guest’s name', () => {
  assert.match(src, /if \(p\.name === ROSTER_UNNAMED\) continue;/);
  assert.match(stripComments(readFileSync(join(import.meta.dirname, 'people-roster.ts'), 'utf8')), /\?\? ROSTER_UNNAMED,/);
});
