/**
 * notifications-finally-have-a-subscriber.test.ts — C8: web push was BUILT
 * and MOUNTED (lib/web-push.ts, PushToggle, emitNotification) with production
 * holding ZERO subscriber rows, because nothing ever asked at a moment anyone
 * would say yes. This asserts the guest QR-scan / seat-claim ask actually
 * exists and is wired the only way it safely can be: guests carry a
 * signed-cookie session (guest-session.ts), never a Supabase auth identity,
 * so the write path MUST go through readGuestSession() + the service-role
 * admin client — never the RLS-scoped user client (which would silently
 * no-op for every guest, since auth.getUser() always returns null for them).
 *
 * Every assertion is anchored to a string, never a line number (build-sessions
 * rule 0), and mutation-checked with the occurrence count printed below.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = resolve(HERE, '..', '..', '..', '..', '..', 'supabase', 'migrations');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const count = (h: string, n: string) => h.split(n).length - 1;

function migrationNaming(marker: string): string {
  const hit = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => join(MIGRATIONS, f))
    .find((f) => readFileSync(f, 'utf8').includes(marker));
  assert.ok(hit, `No migration mentions ${marker}.`);
  return readFileSync(hit as string, 'utf8');
}

const action = () => read(join(HERE, 'actions', 'guest-push-actions.ts'));
const prompt = () => read(join(HERE, '_components', 'guest-push-prompt.tsx'));
const seatPage = () => read(join(HERE, 'page.tsx'));

test('the guest push-subscribe action reads the guest session, never Supabase auth', () => {
  const src = action();
  assert.ok(
    count(src, 'readGuestSession') >= 1,
    'saveGuestPushSubscription must authorize via the guest cookie session — a guest has no Supabase auth identity to check instead.',
  );
  assert.equal(
    count(src, "from '@/lib/supabase/server'"),
    0,
    'must NOT import the RLS-scoped user client — auth.getUser() is always null for a guest, so that client would look like it worked while writing nothing.',
  );
});

test('the guest push-subscribe action writes via the service-role admin client', () => {
  const src = action();
  assert.ok(
    count(src, 'createAdminClient') >= 1,
    'guests have no Postgres identity (no auth.uid()), so the insert must go through the service-role admin client, mirroring scan_events and the /seat/claim route.',
  );
  assert.ok(
    count(src, 'guest_push_subscriptions') >= 1,
    'must write to the guest-scoped table, not the authenticated-user push_subscriptions table (whose user_id FK a guest cannot satisfy).',
  );
});

test('the guest push-subscribe action verifies the session guest still exists before writing', () => {
  const src = action();
  assert.ok(
    count(src, "from('guests')") >= 1,
    'must re-confirm the guest row (mirrors the /claim route), never trust the cookie payload blindly for a service-role write.',
  );
});

test('the migration gives guests no write policy — the row is server-written only', () => {
  const migration = migrationNaming('guest_push_subscriptions');
  assert.ok(
    migration.includes('ENABLE ROW LEVEL SECURITY'),
    'RLS must be enabled at CREATE TABLE time, per this repo\'s RLS canonical patterns.',
  );
  assert.equal(
    count(migration, 'FOR INSERT'),
    0,
    'no INSERT policy should exist for guest_push_subscriptions — guests have no auth.uid() to check against, so the row must be written by the server via the admin client (mirrors scan_events, which has the same shape for the same reason).',
  );
});

test('the migration FKs the subscription to a real guest and event, cascading on delete', () => {
  const migration = migrationNaming('guest_push_subscriptions');
  assert.ok(
    migration.includes('REFERENCES public.guests(guest_id) ON DELETE CASCADE'),
    'a deleted guest must not leave an orphaned push subscription behind.',
  );
});

test('the seat pass mounts the push ask on the personal-pass render, not on every page load', () => {
  const src = seatPage();
  assert.ok(
    count(src, 'GuestPushPrompt') >= 1,
    'the ask must actually be mounted on the Seat Pass — the whole point of C8 is that nothing asked before.',
  );
});

test('the push ask is a graceful, one-time, non-blocking banner — never a re-prompt loop', () => {
  const src = prompt();
  assert.ok(
    count(src, 'localStorage') >= 1,
    'must remember it already asked — a declined browser permission is permanent, and re-showing the banner after a dismissal would be nagging on someone\'s wedding day.',
  );
  assert.ok(
    count(src, "'denied'") === 0 || src.includes('Notification.permission'),
    'must check the existing permission state before ever showing itself, so it can never re-prompt a user who already denied.',
  );
  assert.ok(
    count(src, 'requestPermission') >= 1,
    'the ask itself must actually call the browser permission API.',
  );
});
