/**
 * comp-reach-is-rendered.test.ts
 *
 * 🚨 WHAT WENT WRONG. `comp_grants.event_id` shipped on 2026-09-05 (migration
 * 20271205612762) so an admin could gift one service to ONE event instead of to
 * an account forever. Both entitlement functions honour it. **No per-user screen
 * ever showed it.** A comp scoped to a single wedding and a comp covering every
 * event that account will ever host rendered the same three lines, in the same
 * order, on `/admin/accounts?tab=users` and on `/admin/users/<id>`:
 *
 *     Every Setnayan service
 *     External promo · ₱4,999 retail value
 *     Issued 2026-09-05 · no expiry
 *
 * Nothing on the card said "the wedding only". Only `/admin/gifts` — the page
 * built the same day — had an "Applies to" column, and it resolved the event
 * name through its own private query, so the three surfaces could not even
 * disagree out loud.
 *
 * 🔑 SCOPE IS NOT REACH, AND A HALF-TRUTH RENDERS AS A WHOLE ONE. "Every
 * Setnayan service" is *correct* about the scoped grant — every service, on
 * that one event. The sentence is true and the reader is still wrong, which is
 * why no test caught it and no error was ever logged. The missing half was
 * never an error state; it was an omission, and an omission looks exactly like
 * a grant that genuinely has no limit.
 *
 * 🔑 THE MONEY DIRECTION. The omission always errs toward MORE given away than
 * was authorised: an admin auditing "what have we comped" reads a ₱4,999
 * one-off as an open tab, or — worse — re-issues an account-wide grant because
 * the scoped one "already looks account-wide anyway".
 *
 * WHAT HOLDS IT NOW. One resolver, `describeReach`, renders on all three
 * surfaces, and every reach shape gets a DISTINCT sentence — including the
 * event-since-deleted case, which must never fall back to the account-wide
 * wording (that would report a privilege the customer does not have).
 *
 * The second test is the fence that matters: any file that prints
 * `describeScope` must print `describeReach` at least as many times. A fourth
 * surface that renders coverage without reach fails here, which is the only
 * way this defect can come back — it came back once already, by being built
 * correctly on one page and forgotten on two.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeReach } from './comp-grants';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const base = {
  event_id: null as string | null,
  user_id: null as string | null,
  event_name: null as string | null,
  scoped_event_id_snapshot: null as string | null,
};

test('every reach shape gets its own sentence — none can be mistaken for another', () => {
  const shapes = {
    named: describeReach({
      ...base,
      user_id: 'u1',
      event_id: 'e1',
      event_name: "Maria & Jun's Wedding",
    }),
    unnamed: describeReach({ ...base, user_id: 'u1', event_id: 'e1' }),
    deleted: describeReach({ ...base, user_id: 'u1', scoped_event_id_snapshot: 'e1' }),
    accountWide: describeReach({ ...base, user_id: 'u1' }),
    vendor: describeReach({ ...base }),
  };

  // The defect, stated as an assertion: a scoped grant must not read like an
  // account-wide one. Every pair distinct, not merely "the scoped one is set".
  const seen = new Set(Object.values(shapes));
  assert.equal(
    seen.size,
    Object.keys(shapes).length,
    `two reach shapes share wording: ${JSON.stringify(shapes)}`,
  );

  assert.match(shapes.named, /Maria & Jun's Wedding/);
  assert.match(shapes.named, /only/);
  assert.match(shapes.unnamed, /One event only/);
  assert.match(shapes.accountWide, /Every event/);

  // A deleted event nulls `event_id` (migration 20271208142357 sets it NULL and
  // stamps revoked_at). Falling through to the account-wide branch there would
  // silently PROMOTE the grant in the reader's mind.
  assert.match(shapes.deleted, /One event only/);
  assert.doesNotMatch(shapes.deleted, /Every event/);

  // Never a blank: an empty reach line is what made the two indistinguishable.
  for (const [name, sentence] of Object.entries(shapes)) {
    assert.ok(sentence.trim().length > 0, `${name} rendered an empty reach`);
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !full.endsWith('.test.ts') && !full.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

test('no surface prints a grant’s coverage without its reach', () => {
  const files = walk(join(WEB, 'app')).filter((f) => !f.includes('/api/'));
  const offenders: string[] = [];
  let checked = 0;

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    const scope = (src.match(/describeScope/g) ?? []).length;
    if (scope === 0) continue;
    checked += 1;
    const reach = (src.match(/describeReach/g) ?? []).length;
    if (reach < scope) {
      offenders.push(`${relative(WEB, file)} — describeScope ×${scope}, describeReach ×${reach}`);
    }
  }

  // Anchor the count, so deleting or renaming every call site cannot pass this
  // test by leaving it with nothing to check (the failure mode a bare
  // "offenders is empty" assertion has).
  assert.ok(
    checked >= 3,
    `expected at least the 3 known comp-grant surfaces to render describeScope, found ${checked}`,
  );
  assert.deepEqual(offenders, [], `these render coverage without reach:\n${offenders.join('\n')}`);
});
