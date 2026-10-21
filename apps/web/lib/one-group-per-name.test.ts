/**
 * one-group-per-name.test.ts — 👥 NO PATH CAN WRITE A GROUP THAT TWINS ONE IN THE SAME LIST.
 *
 * Owner 2026-10-21, on the Guests quick-add bar's Group list (Bob · Bob · Loo · Loo · Mama · Mama · Relatives ·
 * Relatives): *"why do i see dupes on group names"*. Measured on the event (controller, read-only): each pair was two
 * `guest_groups` rows of one name on sides that share a list — a both-sides group with guests beside an empty
 * groom's-side one. The unique key `(event_id, lower(label), team_side)` allows that; the 2026-10-20 name rule
 * (`groupNameClash`) ran only in the Group dropdown's own create, while the capture bar's `#Group`, the Quick add sheet,
 * claims, the Groups sidebar form and the map inserted without it.
 *
 * ── What is proven ────────────────────────────────────────────────────────────────────────────────────────────────
 *   1 · THE ONE WRITER (source, comments stripped, every .ts/.tsx under app/ lib/ components/): every chain on
 *       `.from('guest_groups')` that inserts or upserts lives in `lib/guest-group-made-once.ts`, and there is exactly
 *       one there. Every chain that UPDATES a group's label or side sits in a function that runs `groupNameClash`
 *       before it.
 *   2 · THE RULE, EXECUTED (`makeGuestGroupOnce` over a stand-in client, on the event's measured groups): for every
 *       existing name × typed spelling × side, a name already in that side's list writes NOTHING and hands back that
 *       group (`created: false`) — the same side's first, then both sides'; a free name (the other side's namesake
 *       included) writes exactly one row, on that side. A refused read writes nothing and says so. A racing 23505 is
 *       answered with the existing row.
 *   3 · EVERY SERVER PATH THAT MAKES A GROUP CALLS IT: `quickCreateGroup` (capture bar · Quick add sheet · claims),
 *       the Group dropdown's in-place create, the sidebar's `createGuestGroup`, the map's `mapAddGroup`.
 *
 * ── Caveats ───────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · § 1 reads chains: a client stored in a variable and written later (`const t = supabase.from(…); t.insert(…)`)
 *     would pass. No such shape exists today; the scan prints what it covered.
 *   · No database runs here: that RLS lets the write through is the shipped actions' own tests' claim.
 *   · Existing twins in production are left as they are — this decides only what is written next.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { makeGuestGroupOnce } from '@/lib/guest-group-made-once';
import { groupNameKey, sidesShareAList } from '@/lib/group-name-clash';
import type { GuestGroupTeamSide } from '@/lib/guests';
import type { SupabaseClient } from '@supabase/supabase-js';

const WEB = process.cwd();
const HELPER = 'lib/guest-group-made-once.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Each chain on guest_groups: from `.from('guest_groups')` to the end of its statement (or the next `.from(`). */
function chains(src: string): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  const re = /\.from\(\s*['"`]guest_groups['"`]\s*\)/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const rest = src.slice(m.index + m[0].length);
    const stops = [rest.indexOf(';'), rest.indexOf('.from(')].filter((i) => i > -1);
    out.push({ at: m.index, text: rest.slice(0, stops.length ? Math.min(...stops) : undefined) });
  }
  return out;
}

test('1 · the one writer: only makeGuestGroupOnce inserts a group; every label/side update runs the name rule first', () => {
  const files = ['app', 'lib', 'components'].flatMap((d) => {
    try {
      return walk(join(WEB, d));
    } catch {
      return [];
    }
  });
  assert.ok(files.length > 500, `anti-vacuity: only ${files.length} source files scanned`);
  let read = 0;
  const writers: string[] = [];
  const updates: string[] = [];
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    if (!raw.includes('guest_groups')) continue;
    const src = stripComments(raw);
    const rel = relative(WEB, f);
    for (const c of chains(src)) {
      read++;
      if (/\.(insert|upsert)\(/.test(c.text)) writers.push(rel);
      if (/\.update\(\s*\{[^}]*\b(label|team_side)\b/.test(c.text)) {
        // The enclosing function: from the last `function ` before the chain.
        const fnStart = Math.max(src.lastIndexOf('function ', c.at), src.lastIndexOf('=> {', c.at));
        const body = src.slice(fnStart, c.at);
        if (!/groupNameClash\(/.test(body)) updates.push(rel);
      }
    }
  }
  assert.ok(read >= 15, `anti-vacuity: only ${read} guest_groups chains read`);
  assert.deepEqual(writers, [HELPER], `a group is inserted outside ${HELPER}: ${writers.join(', ')}`);
  assert.deepEqual(updates, [], `a group's name or side is changed without the name rule: ${updates.join(', ')}`);
});

/* The event's groups as measured 2026-10-21 (names + sides), plus a lone both-sides group. */
type Row = { group_id: string; label: string; team_side: GuestGroupTeamSide };
const MEASURED: Row[] = [
  { group_id: 'barkada', label: 'Barkada', team_side: 'both' },
  { group_id: 'bob-both', label: 'Bob', team_side: 'both' },
  { group_id: 'bob-groom', label: 'Bob', team_side: 'groom' },
  { group_id: 'childhood', label: 'Childhood', team_side: 'groom' },
  { group_id: 'college', label: 'College', team_side: 'groom' },
  { group_id: 'family-b', label: 'Family', team_side: 'bride' },
  { group_id: 'family-g', label: 'Family', team_side: 'groom' },
  { group_id: 'mama-both', label: 'Mama', team_side: 'both' },
  { group_id: 'mama-groom', label: 'Mama', team_side: 'groom' },
  { group_id: 'relatives-both', label: 'Relatives', team_side: 'both' },
  { group_id: 'relatives-b', label: 'Relatives', team_side: 'bride' },
  { group_id: 'relatives-g', label: 'Relatives', team_side: 'groom' },
];

/** A stand-in client: `select` answers the rows (or refuses), `insert` records the row (or answers a 23505). */
function stand(rows: Row[], opts: { refuseRead?: boolean; race?: Row } = {}) {
  const inserted: Record<string, unknown>[] = [];
  let reads = 0;
  const client = {
    from(table: string) {
      assert.equal(table, 'guest_groups');
      return {
        select() {
          return {
            eq: async () => {
              reads++;
              if (opts.refuseRead) return { data: null, error: { code: '42501', message: 'permission denied' } };
              return { data: opts.race && reads > 1 ? [...rows, opts.race] : rows, error: null };
            },
          };
        },
        insert(row: Record<string, unknown>) {
          return {
            select: async () => {
              if (opts.race) return { data: null, error: { code: '23505', message: 'duplicate key' } };
              inserted.push(row);
              return { data: [{ group_id: 'new', label: row.label }], error: null };
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

test('2 · the rule, executed: a name already in the side’s list is that group; a free name is made once, on its side', async () => {
  const sides: GuestGroupTeamSide[] = ['bride', 'groom', 'both'];
  const names = [...new Set(MEASURED.map((g) => g.label)), 'Loo', 'Ninongs'];
  let reused = 0;
  let made = 0;
  for (const name of names) {
    for (const typed of [name, ` ${name.toUpperCase()}. `, name.toLowerCase()]) {
      for (const side of sides) {
        const { client, inserted } = stand(MEASURED);
        const res = await makeGuestGroupOnce(client, 'e1', typed, side);
        assert.ok(res.ok, `${typed} on ${side}: refused`);
        const twins = MEASURED.filter((g) => groupNameKey(g.label) === groupNameKey(name) && sidesShareAList(g.team_side, side));
        if (twins.length > 0) {
          const want = twins.find((g) => g.team_side === side) ?? twins.find((g) => g.team_side === 'both') ?? twins[0]!;
          assert.equal(inserted.length, 0, `“${typed}” on ${side} wrote a twin of ${want.group_id}`);
          assert.equal(res.created, false);
          assert.equal(res.group.group_id, want.group_id, `“${typed}” on ${side} reused the wrong group`);
          reused++;
        } else {
          assert.equal(inserted.length, 1, `“${typed}” on ${side} was not made`);
          assert.deepEqual(inserted[0], { event_id: 'e1', label: typed, team_side: side });
          assert.equal(res.created, true);
          made++;
        }
      }
    }
  }
  assert.ok(reused > 40 && made > 5, `anti-vacuity: ${reused} reused, ${made} made`);
  // The owner's pairs, by name: a groom's-side "Mama" is the both-sides Mama; a both-sides "Bob" is the both-sides Bob.
  for (const [typed, side, want] of [['Mama', 'groom', 'mama-groom'], ['Bob', 'both', 'bob-both'], ['Loo', 'groom', null], ['College', 'bride', null], ['college', 'both', 'college']] as const) {
    const { client, inserted } = stand(MEASURED);
    const res = await makeGuestGroupOnce(client, 'e1', typed, side);
    assert.ok(res.ok);
    if (want) assert.equal(res.group.group_id, want, `${typed} on ${side}`);
    else assert.equal(inserted.length, 1, `${typed} on ${side} should be made (free in that list)`);
  }
  // A side outside the three is both sides', as every caller has always meant.
  const odd = stand([{ group_id: 'x', label: 'Bob', team_side: 'groom' }]);
  const r = await makeGuestGroupOnce(odd.client, 'e1', 'Bob', 'anything');
  assert.ok(r.ok && !r.created && r.group.group_id === 'x', 'an unknown side wrote a both-sides twin of a groom’s group');
});

test('2b · a refused read writes nothing; a racing insert of the same key reuses the row', async () => {
  const refused = stand(MEASURED, { refuseRead: true });
  const res = await makeGuestGroupOnce(refused.client, 'e1', 'Ninongs', 'bride');
  assert.equal(res.ok, false, 'a refused read was taken as “no twin”');
  assert.equal(refused.inserted.length, 0);
  const race = stand([], { race: { group_id: 'raced', label: 'Ninongs', team_side: 'bride' } });
  const r = await makeGuestGroupOnce(race.client, 'e1', 'Ninongs', 'bride');
  assert.ok(r.ok && r.created === false && r.group.group_id === 'raced', 'a racing 23505 was not answered with the existing row');
});

test('3 · every server path that makes a group goes through makeGuestGroupOnce', () => {
  const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));
  const fnBody = (src: string, fn: string) => {
    const at = src.search(new RegExp(`async function ${fn}\\(`));
    assert.ok(at > -1, `${fn} is gone`);
    const next = src.slice(at + 1).search(/\n(export )?async function /);
    return src.slice(at, next === -1 ? undefined : at + 1 + next);
  };
  const guests = ['app', 'dashboard', '[eventId]', 'guests'];
  const paths: [string, string][] = [
    ['quick-add-actions.ts', 'quickCreateGroup'],
    ['group-edit-actions.ts', 'createGuestGroupInPlace'],
    ['groups-actions.ts', 'createGuestGroup'],
    ['map-actions.ts', 'mapAddGroup'],
  ];
  for (const [file, fn] of paths) {
    assert.match(fnBody(read(...guests, file), fn), /makeGuestGroupOnce\(supabase, eventId, label, /, `${file} › ${fn} makes a group without the one-name rule`);
  }
  // A reuse is never reported as a fresh group (the capture bar's on-failed-add cleanup deletes only created ones).
  assert.match(fnBody(read(...guests, 'quick-add-actions.ts'), 'quickCreateGroup'), /created: made\.created/, 'quickCreateGroup reports a reuse as created');
});
