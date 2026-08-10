/**
 * A vendor's name is their account name — one value, two rows, kept identical.
 *
 * Owner-locked 2026-08-10. The backfill is part of the rule, not housekeeping:
 * before it ran, `users.display_name` was NULL for EVERY production account
 * while `vendor_profiles.business_owner_name` held real typed names. A rule that
 * only applies to rows created after it is not in force.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => { replay = await createReplayedDb(); db = replay.db; });
after(async () => { await db.close(); });

let n = 0;
async function person(displayName: string | null, ownerName: string | null) {
  n += 1;
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  // `on_auth_user_created` already creates the public.users row, so this
  // UPDATES rather than inserts. A fixture that inserts it by hand collides
  // with the trigger — and, worse, would be testing a row shape the product
  // never produces.
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, `n${n}@t.invalid`]);
  await db.query(`UPDATE public.users SET display_name = $2 WHERE user_id = $1`, [id, displayName]);
  if (ownerName !== null) {
    await db.query(
      `INSERT INTO public.vendor_profiles (business_name, business_slug, user_id, business_owner_name)
       VALUES ($1,$2,$3,$4)`,
      [`Shop ${n}`, `shopx${n}`, id, ownerName],
    );
  }
  return id;
}
async function nameOf(id: string) {
  const r = await db.query<{ display_name: string | null }>(
    `SELECT display_name FROM public.users WHERE user_id = $1`, [id]);
  return r.rows[0]!.display_name;
}
/** Re-run the shipped backfill against rows created after the replay. */
async function backfill() {
  await db.query(`
    UPDATE public.users u SET display_name = btrim(v.business_owner_name)
      FROM public.vendor_profiles v
     WHERE v.user_id = u.user_id
       AND (u.display_name IS NULL OR btrim(u.display_name) = '')
       AND v.business_owner_name IS NOT NULL AND btrim(v.business_owner_name) <> ''`);
}

test('a vendor with a blank account name inherits the one their shop already knows', async () => {
  const id = await person(null, 'Ice Casasola');
  await backfill();
  assert.equal(await nameOf(id), 'Ice Casasola');
});

test('an account name the person set themselves is never overwritten', async () => {
  // The account is the authority. The shop is only where the value happened to
  // be recorded first.
  const id = await person('Maria Santos', 'M. Santos');
  await backfill();
  assert.equal(await nameOf(id), 'Maria Santos');
});

test('a blank-looking account name counts as blank', async () => {
  const id = await person('   ', 'Ana Reyes');
  await backfill();
  assert.equal(await nameOf(id), 'Ana Reyes');
});

test('it never invents a name', async () => {
  // A shop with no owner name leaves the account blank, which is honest — the
  // vendor is asked for it on My Shop.
  const id = await person(null, '   ');
  await backfill();
  assert.equal((await nameOf(id) ?? '').trim(), '');
});

test('someone with no shop at all is untouched', async () => {
  const id = await person(null, null);
  await backfill();
  assert.equal(await nameOf(id), null);
});

test('the whitespace is trimmed on the way in', async () => {
  const id = await person(null, '  Ice Casasola  ');
  await backfill();
  assert.equal(await nameOf(id), 'Ice Casasola');
});
