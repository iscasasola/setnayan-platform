/**
 * slug-handout-paths.test.ts — every path that HANDS OUT an address asks all four.
 *
 * Weddings (`events.slug`), shops (`vendor_profiles.business_slug`) and people
 * (`users.slug`) all live at `setnayan.com/{word}`, and a retired word keeps
 * forwarding for 90 days. `findSlugConflict` asks about all four. The paths that
 * hand out words did not.
 *
 * ## What each of these caught, measured on `main`
 *
 * **CREATE asked two of four.** `isSlugTaken` queried `events` and the forwarding
 * ledger only, so `generateUniqueSlug` could auto-mint a new wedding onto a LIVE
 * SHOP'S ADDRESS — and since `app/[slug]/page.tsx` resolves the event first and
 * only then falls through to the vendor renderer, that wedding silently took over
 * the shop's public page, a page that is in our sitemap.
 *
 * **It discarded `error`.** A failed `events` read returned `data: null` and the
 * word read as FREE — the one direction that gives away an address somebody owns.
 *
 * **The shop and person renames asked one.** `parseVendorSlug` and `updateUserSlug`
 * checked shape + reserved + their own table. A shop could take the one word
 * actually forwarding in production, sending every printed invitation carrying it
 * to a stranger's business page.
 *
 * ⚠ These are BEHAVIOURAL where they can be. `isSlugTaken` and `generateUniqueSlug`
 * are exercised against a stub. The two server actions cannot be imported here
 * (`'use server'` + `next/navigation`), so those two assertions are structural —
 * and scoped to the executed body with comments stripped, because this file's own
 * explanation names every table it is looking for.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isSlugTaken, generateUniqueSlug } from './slugs';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

type TableRows = Record<string, { data: unknown; error?: unknown }>;

/** A stub admin client whose per-table answers the test dictates. */
function admin(rows: TableRows) {
  const seen: string[] = [];
  const chain = (table: string) => {
    const res = rows[table] ?? { data: null };
    const self: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'ilike', 'gt', 'limit', 'neq']) self[m] = () => self;
    self.maybeSingle = async () => ({ data: res.data, error: res.error ?? null });
    self.then = undefined;
    return self;
  };
  return {
    from: (table: string) => {
      seen.push(table);
      const res = rows[table] ?? { data: null };
      const c = chain(table) as Record<string, unknown>;
      // `slug_change_log` is read as a list, not maybeSingle.
      c.limit = async () => ({ data: res.data ?? [], error: res.error ?? null });
      return c;
    },
    _seen: seen,
  } as never;
}

const FREE: TableRows = {
  events: { data: null },
  vendor_profiles: { data: null },
  users: { data: null },
  slug_change_log: { data: [] },
};

test('a word a SHOP already holds is not free for a wedding', async () => {
  const taken = await isSlugTaken(
    admin({ ...FREE, vendor_profiles: { data: { vendor_profile_id: 'vp-1' } } }),
    'bloom-studio',
  );
  assert.equal(
    taken,
    true,
    'the create path handed a wedding an address a live shop already serves — ' +
      'and the event resolves FIRST, so the shop loses its own public page',
  );
});

test('a word a PERSON already holds is not free for a wedding', async () => {
  const taken = await isSlugTaken(admin({ ...FREE, users: { data: { user_id: 'u-1' } } }), 'maria');
  assert.equal(taken, true);
});

test('a word still FORWARDING from a rename is not free', async () => {
  const taken = await isSlugTaken(
    admin({ ...FREE, slug_change_log: { data: [{ entity_id: 'evt-old' }] } }),
    'bb-gandang-hari',
  );
  assert.equal(taken, true, 'a printed invitation would land on a stranger');
});

test('A FAILED READ IS NOT PROOF THE WORD IS FREE', async () => {
  // Supabase resolves `{ error }` rather than throwing, so an unchecked failure
  // used to return data:null → "free" → the address was handed out.
  for (const table of ['events', 'vendor_profiles', 'users']) {
    const taken = await isSlugTaken(
      admin({ ...FREE, [table]: { data: null, error: { message: 'boom' } } }),
      'anything',
    );
    assert.equal(taken, true, `a failed ${table} read read as FREE`);
  }
});

test('a genuinely free word is free', async () => {
  assert.equal(await isSlugTaken(admin(FREE), 'juan-and-maria'), false);
});

test('an unreadable namespace does NOT loop 100 times, and still yields an address', async () => {
  // Fail-closed makes every candidate look taken. The old loop ran ~400 queries
  // and then returned an unchecked fallback anyway; a later attempt THREW, which
  // nothing catches — that would have crashed the whole event-creation funnel.
  const client = admin({ ...FREE, events: { data: null, error: { message: 'down' } } });
  const slug = await generateUniqueSlug(client, 'Juan and Maria');
  assert.match(slug, /^[a-z0-9-]{3,32}$/, 'must still be a usable address, not a crash');
  const reads = (client as unknown as { _seen: string[] })._seen.length;
  assert.ok(reads < 20, `bailed after ${reads} reads — it must not grind through 100 candidates`);
});

/** The executed body of a file, comments stripped so prose cannot satisfy a check. */
function code(rel: string): string {
  return readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * A call to `findSlugConflict` WHOSE RESULT IS USED.
 *
 * 🪤 Two mistakes, both made while writing this file:
 *  1. `/findSlugConflict\(/` also matches `DISABLED_findSlugConflict(` — a bare
 *     substring is not a call. Hence the `(?<![\w$])` boundary. I sabotaged the
 *     shop path by renaming the symbol and this test stayed GREEN.
 *  2. A call alone proves nothing — keeping the call and discarding its result is
 *     the sabotage that beat two generations of the run-of-show guard. So the
 *     result must be bound to a name and that name must be branched on.
 */
function callsAndUsesConflictCheck(src: string): boolean {
  const call = /(?<![\w$])findSlugConflict\(/;
  if (!call.test(src)) return false;
  const bound = /const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+(?<![\w$])findSlugConflict\(/.exec(src);
  if (!bound) return false;
  const name = bound[1];
  // The bound name must be tested somewhere after it is assigned.
  const after = src.slice(bound.index + bound[0].length);
  return new RegExp(`\\bif\\s*\\(\\s*!?${name}\\b`).test(after);
}

test('the SHOP rename asks the shared question, and acts on the answer', () => {
  assert.ok(
    callsAndUsesConflictCheck(code('app/vendor-dashboard/actions.ts')),
    'the shop address save checks shape and reserved words only again — a shop ' +
      'can take a wedding\'s address, or one still forwarding. (Or it calls the ' +
      'check and throws the answer away, which is the same thing.)',
  );
});

test('the PERSON rename asks the shared question, and acts on the answer', () => {
  assert.ok(
    callsAndUsesConflictCheck(code('app/dashboard/(account)/profile/actions.ts')),
    'the handle save is back to checking users alone, or ignoring the answer',
  );
});

test('the WEDDING rename proves a row actually changed', () => {
  const src = code('app/dashboard/[eventId]/invitation/actions.ts');
  assert.match(
    src,
    /\.update\(\{\s*slug: requested[\s\S]{0,200}?\.select\(/,
    'the rename update no longer selects back. Under RLS a statement matching ZERO ' +
      'rows returns no error, so the action wrote a 90-day forwarding row for a ' +
      'rename that never happened and reported success.',
  );
});
