/**
 * vendor-event-creation.test.ts — ONE ACCOUNT IS BOTH (owner, 2026-10-22).
 *
 * ─── THE RULING ────────────────────────────────────────────────────────────
 * Owner, verbatim: *"Why does the user cannot make events anymore. In shop they
 * do not create events, but them as a user, they can create their events"* —
 * then *"Yes to all"* to Supplier 1 · Option B of
 * `prototypes/journey_fixes_2026-10-22.html` (DECISION_LOG 2026-10-22).
 *
 * ⛔ THIS FILE PINNED THE OPPOSITE ON PURPOSE UNTIL TODAY. It held the
 * 2026-08-15 ruling (*"they cannot make from their vendor account"*): every
 * creation door asked `shopAccountMayNotCreateEvents`, and a shop account was
 * told to "sign up with a personal account using a different email". That
 * ruling is SUPERSEDED, and the assertions below were turned around citing the
 * new one — not loosened to go green.
 *
 * What is held now, each as a property rather than a phrasing:
 *   1 · the couple tree never bounces a shop account away (kept from before);
 *   2 · EVERY server path that inserts an `events` row asks the one gate —
 *       found by scanning for the insert, so a new door cannot pass by being
 *       absent from a hand-kept roster (the old roster missed the wedding
 *       wizard for two months);
 *   3 · the gate, CALLED, lets a shop owner, a team member and a customer
 *       create — and reads nothing to decide it;
 *   4 · the "different email" refusal and its error code are gone everywhere;
 *   5 · the role summary gives every account its own events;
 *   6 · the SHOP side never offers "create event" (the other half of the
 *       ruling: *"In shop they do not create events"*).
 *
 * SABOTAGE (each seen red before this shipped — PR body has the runs): the old
 * vendor check restored in the gate → 3 · the gate call removed from the
 * wedding wizard → 2 · the refusal copy re-added → 4 ·
 * `hasCustomerAccess: profile?.account_type !== 'vendor'` → 5 · a "New event"
 * link to /dashboard/create-event on supplier Today → 6.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { accountMayNotCreateEvents } from '@/lib/vendor-event-creation';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const APP = join(WEB, 'app');

const GATE = 'accountMayNotCreateEvents';

const code = (p: string) => stripComments(readFileSync(p, 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * The exported function that contains source offset `at`: from its
 * `export async function` to the next top-level `export` (or the file's end).
 * Coarser than a brace match on purpose — return types like
 * `Promise<{ ok: true } | …>` carry braces that a brace walk mistakes for the body.
 */
function enclosingExportedFn(src: string, at: number): { name: string; body: string } | null {
  const re = /^export async function (\w+)\s*\(/gm;
  let best: RegExpExecArray | null = null;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index < at) best = m;
    else break;
  }
  if (!best) return null;
  const next = src.slice(best.index + best[0].length).search(/^export /m);
  const end = next < 0 ? src.length : best.index + best[0].length + next;
  return { name: best[1]!, body: src.slice(best.index, end) };
}

const APP_FILES = walk(APP);
const EVENTS_INSERT = /\.from\(\s*['"`]events['"`]\s*\)\s*\.insert\(/g;

test('the anchor: the gate, the couple layout and the shop tree exist', () => {
  for (const p of [
    join(HERE, 'vendor-event-creation.ts'),
    join(HERE, 'roles.ts'),
    join(APP, 'dashboard', 'layout.tsx'),
    join(APP, 'vendor-dashboard', 'page.tsx'),
  ]) {
    assert.ok(existsSync(p) && readFileSync(p, 'utf8').length > 200, `${p} is missing or a stub`);
  }
});

/* ─── 1 · THE PERSONAL SIDE IS NEVER TAKEN AWAY ─────────────────────────── */

test('1 · a shop account is never bounced off the couple tree', () => {
  assert.doesNotMatch(
    code(join(APP, 'dashboard', 'layout.tsx')),
    /redirect\(\s*['"`]\/vendor-dashboard/,
    'The couple tree redirects a shop account to the shop console again. Owner 2026-10-22: one ' +
      'account is both — their own events are theirs.',
  );
});

/* ─── 2 · EVERY DOOR ASKS THE ONE GATE ──────────────────────────────────── */

test('2 · every server path that inserts an events row asks the one gate first', () => {
  const doors: string[] = [];
  const offenders: string[] = [];
  for (const file of APP_FILES) {
    const src = code(file);
    for (const m of src.matchAll(EVENTS_INSERT)) {
      const fn = enclosingExportedFn(src, m.index ?? 0);
      const where = `${relative(WEB, file)}${fn ? ` › ${fn.name}` : ''}`;
      doors.push(where);
      const callAt = fn ? fn.body.search(new RegExp(`await ${GATE}\\(`)) : -1;
      const insertAt = fn ? fn.body.search(/\.from\(\s*['"`]events['"`]\s*\)\s*\.insert\(/) : -1;
      if (callAt < 0 || callAt > insertAt) offenders.push(where);
    }
  }
  // Anti-vacuity: the six doors known today (create-event ×2, the three
  // wizards, the story's "Start it now"). A scan that finds none proves nothing.
  assert.ok(doors.length >= 6, `the insert scan found only ${doors.length} door(s): ${doors.join(', ')}`);
  assert.deepEqual(
    offenders,
    [],
    `These doors insert an event without asking ${GATE}() first: ${offenders.join(', ')}. ` +
      'The rule about who may create an event lives in ONE function; a door that skips it is ' +
      'where the next rule silently fails to hold.',
  );
});

/* ─── 3 · THE GATE, CALLED, REFUSES NO ONE ─────────────────────────────── */

test('3 · a shop owner, a team member and a customer may all create their own events', async () => {
  // A client that records every use — the gate must decide WITHOUT a lookup, and
  // must not refuse a shop account whatever the label says.
  const touched: string[] = [];
  const client = new Proxy(
    {},
    {
      get(_t, prop) {
        touched.push(String(prop));
        return () => {
          throw new Error(`the gate read the database (${String(prop)})`);
        };
      },
    },
  ) as Parameters<typeof accountMayNotCreateEvents>[0];
  for (const who of ['shop-owner', 'team-member', 'customer']) {
    assert.equal(
      await accountMayNotCreateEvents(client, who),
      false,
      `${who} is refused — owner 2026-10-22: "them as a user, they can create their events".`,
    );
  }
  assert.deepEqual(touched, [], 'the gate asked the database a question whose answer changes nothing');
});

/* ─── 4 · THE DEAD END IS GONE ──────────────────────────────────────────── */

test('4 · nothing tells a shop account to sign up again with a different email', () => {
  const hits: string[] = [];
  for (const file of [...APP_FILES, ...walk(HERE)]) {
    // Code only: the gate's own docblock quotes the retired sentence to say why it went.
    const src = code(file);
    if (/personal account using a different email|SHOP_ACCOUNT_CANNOT_CREATE/.test(src)) {
      hits.push(relative(WEB, file));
    }
    if (/['"`]shop_account['"`]/.test(src)) hits.push(`${relative(WEB, file)} (error code)`);
  }
  assert.deepEqual(hits, [], `The superseded refusal is back: ${hits.join(', ')}`);
  assert.ok(!existsSync(join(HERE, 'vendor-event-creation-copy.ts')), 'the refusal sentence module is back');
});

/* ─── 5 · THE ROLE SUMMARY AGREES ───────────────────────────────────────── */

test('5 · the role summary gives every account its own events — the label takes nothing away', () => {
  const roles = code(join(HERE, 'roles.ts'));
  const line = /hasCustomerAccess:\s*([^,\n]+),/.exec(roles)?.[1]?.trim();
  assert.ok(line, 'anti-vacuity: the summary no longer sets hasCustomerAccess');
  assert.equal(
    line,
    'true',
    `hasCustomerAccess is derived again (${line}). Owner 2026-10-22: one account is both.`,
  );
});

/* ─── 6 · THE SHOP SIDE NEVER OFFERS "CREATE EVENT" ─────────────────────── */

test('6 · no supplier page links into a create-event door', () => {
  const shop = walk(join(APP, 'vendor-dashboard'));
  assert.ok(shop.length > 50, `anti-vacuity: only ${shop.length} files under vendor-dashboard`);
  const DOOR = /['"`]\/(?:dashboard\/create-event|onboarding(?:\/[\w-]+)?)(?:[?#'"`])/;
  const hits = shop.filter((f) => DOOR.test(code(f))).map((f) => relative(WEB, f));
  assert.deepEqual(
    hits,
    [],
    `A supplier page offers "create event": ${hits.join(', ')}. Owner 2026-10-22: "In shop they ` +
      'do not create events" — their own events start from the Events tab, never from the shop.',
  );
});
