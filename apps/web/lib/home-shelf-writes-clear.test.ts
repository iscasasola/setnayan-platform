/**
 * home-shelf-writes-clear.test.ts — EVERY WRITE THAT CHANGES A REMEMBERED READ
 * IS EITHER CLEARED OR COUNTED.
 *
 * The home page remembers six public reads for 60 s (`lib/home-public-reads-core.ts`).
 * `HOME_SHELF_DEPENDS` (`lib/home-shelf-tags.ts`) names, per table, the columns
 * those reads select or filter on, in two classes:
 *
 *   clears — the write takes something DOWN from the public page or moves where
 *            a card points (an UPDATE of such a column, or a DELETE). The file
 *            that makes it must call `clearHomeShelf` with that table's subject,
 *            so the next view is right. An INSERT is never one: a new row can
 *            only make something appear.
 *   waits  — the write changes how a card LOOKS. It is not cleared; the page
 *            shows the old look for at most the hard age (300 s).
 *
 * THE PROPERTY, enumerated by the TABLE a write touches — never by a phrasing:
 * this walks every `.from('<table>').update|insert|upsert|delete(` in app/ and
 * lib/, reads the columns the write names, and holds each site to one of:
 *
 *   • a `clears` write   → its file calls `clearHomeShelf('<subject>')` at least
 *                           once per such write, OR it is in CLEARS_EXEMPT below
 *                           with the reason it cannot change what is listed;
 *   • a `waits` write, or one whose columns cannot be read from the source (a
 *     variable or a spread) → counted, per file, in
 *     `lib/home-shelf-writes.baseline.txt`. A new one changes a count and fails
 *     here, so "this write may be seen late" is a decision somebody made.
 *
 * ⚠ WHAT THIS CANNOT SEE — and the hard age is the bound for all of it: a write
 * made inside a database function or trigger (an RPC, `followers_count`), a
 * write through a client held in a variable named something other than a
 * `.from('<table>')` chain, and anything written outside app/ and lib/.
 *
 * Regenerate the baseline (never hand-merge it):
 *   UPDATE_HOME_SHELF_BASELINE=1 ../../node_modules/.bin/tsx --test lib/home-shelf-writes-clear.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from './strip-comments';
import { HOME_SHELF_DEPENDS } from './home-shelf-tags';

const WEB = join(__dirname, '..');
const BASELINE = join(__dirname, 'home-shelf-writes.baseline.txt');

/**
 * A `clears` write that cannot change what the public page lists. One line per
 * file and table, with the reason. The COUNT is exact, so a second such write
 * in the same file is looked at again.
 */
const CLEARS_EXEMPT: Record<string, { count: number; why: string }> = {
  'vendor_profiles app/admin/vendors/actions.ts': {
    count: 2,
    why: 'both delete a STAGED profile (no owner yet, never published) while rolling back an invite — it was never on the shelf',
  },
  'vendor_profiles app/api/admin/demo/cleanup/route.ts': { count: 1, why: 'demo rows — the shelf gate is is_demo = false' },
  'vendor_profiles app/api/admin/demo/cleanup-batch/route.ts': { count: 1, why: 'demo rows — the shelf gate is is_demo = false' },
  'vendor_profiles app/api/admin/demo/regenerate/route.ts': { count: 1, why: 'demo rows — the shelf gate is is_demo = false' },
  'vendor_profiles app/api/admin/demo/seed/route.ts': { count: 1, why: 'demo rows — the shelf gate is is_demo = false' },
  'events app/dashboard/(account)/create-event/actions.ts': {
    count: 2,
    why: 'both delete an event this same action created a moment earlier, to roll back — it was never public',
  },
  'events app/dashboard/[eventId]/story/whats-next-actions.ts': {
    count: 1,
    why: 'deletes the event this same action just created, to roll back — it was never public',
  },
  'events app/onboarding/simple/actions.ts': {
    count: 1,
    why: 'deletes the event this same action just created, to roll back — it was never public',
  },
  'events lib/launch-save-the-date.ts': {
    count: 1,
    why: 'makes an event PUBLIC (it appears, nothing comes down), and runs inside the guest page render, where Next refuses a clear — it lists within the hard age',
  },
};

type Site = { table: string; file: string; op: string; kind: 'clears' | 'waits' | 'unreadable' };

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$|\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

/** The text of the call's first argument, from just after its `(`. */
function argumentAt(src: string, start: number): string {
  let depth = 1;
  let i = start;
  for (; i < src.length && depth > 0; i += 1) {
    const c = src[i];
    if (c === '(' || c === '{' || c === '[') depth += 1;
    else if (c === ')' || c === '}' || c === ']') depth -= 1;
  }
  return src.slice(start, i - 1).trim();
}

/** The top-level keys of an object literal; `null` when it is not one, `spread: true` when it has a spread. */
function literalKeys(arg: string): { keys: string[]; spread: boolean } | null {
  if (!arg.startsWith('{') || !arg.endsWith('}')) return null;
  const parts: string[] = [];
  let depth = 0;
  let part = '';
  for (const c of arg.slice(1, -1)) {
    if (c === '{' || c === '(' || c === '[') depth += 1;
    if (c === '}' || c === ')' || c === ']') depth -= 1;
    if (c === ',' && depth === 0) {
      parts.push(part);
      part = '';
    } else part += c;
  }
  parts.push(part);
  const keys: string[] = [];
  let spread = false;
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    if (p.startsWith('...') || p.startsWith('[')) {
      spread = true;
      continue;
    }
    const m = /^['"]?([A-Za-z_][\w]*)['"]?/.exec(p);
    if (m) keys.push(m[1] as string);
    else spread = true;
  }
  return { keys, spread };
}

export function writeSites(files: Array<{ file: string; src: string }>): Site[] {
  const out: Site[] = [];
  for (const [table, rule] of Object.entries(HOME_SHELF_DEPENDS)) {
    const re = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)\\s*\\.(update|insert|upsert|delete)\\(`, 'g');
    for (const { file, src } of files) {
      for (const m of src.matchAll(re)) {
        const op = m[1] as string;
        if (op === 'delete') {
          // Removing a row takes it down — unless the table only ever changes a LOOK.
          out.push({ table, file, op, kind: rule.clears.length > 0 ? 'clears' : 'waits' });
          continue;
        }
        const lit = literalKeys(argumentAt(src, (m.index as number) + m[0].length));
        const keys = lit?.keys ?? [];
        const named = (cols: readonly string[]) => keys.some((k) => cols.includes(k));
        // An INSERT makes a new row: it can make something APPEAR, it cannot take
        // anything down. So it waits (it lists within the hard age), never clears.
        if (op !== 'insert' && named(rule.clears)) out.push({ table, file, op, kind: 'clears' });
        else if (!lit || lit.spread) out.push({ table, file, op, kind: 'unreadable' });
        else if (named(rule.waits) || named(rule.clears)) out.push({ table, file, op, kind: 'waits' });
      }
    }
  }
  return out;
}

const FILES = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))].map((p) => ({
  file: relative(WEB, p),
  src: stripComments(readFileSync(p, 'utf8')),
}));
const SITES = writeSites(FILES);
const SRC = new Map(FILES.map((f) => [f.file, f.src]));

function tally(kinds: Site['kind'][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of SITES) {
    if (!kinds.includes(s.kind)) continue;
    const key = `${s.kind}\t${s.table}\t${s.file}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

test('the scan is real — it finds the writes it was written for', () => {
  assert.ok(FILES.length > 500, `expected the app+lib sources, found ${FILES.length}`);
  assert.ok(SITES.length > 60, `only ${SITES.length} write sites found across ${Object.keys(HOME_SHELF_DEPENDS).length} tables — the scan went blind`);
  for (const table of Object.keys(HOME_SHELF_DEPENDS)) {
    if (HOME_SHELF_DEPENDS[table]?.clears.length === 0) continue;
    assert.ok(SITES.some((s) => s.table === table && s.kind === 'clears'), `no take-down write found for ${table}`);
  }
  // The scanner reads columns, not words: the same file holds a clears write and others.
  const privacy = SITES.filter((s) => s.file === 'app/dashboard/[eventId]/website/privacy/actions.ts');
  assert.ok(privacy.some((s) => s.kind === 'clears' && s.table === 'events'), 'the visibility write is no longer seen');
});

test('the scanner classifies a write by the columns it names', () => {
  const classify = (code: string) => writeSites([{ file: 'x.ts', src: code }]).map((s) => `${s.table}:${s.kind}`);
  assert.deepEqual(classify(`await a.from('events').update({ landing_page_visibility: 'private' }).eq('event_id', id);`), ['events:clears']);
  assert.deepEqual(classify(`await a.from('events').update({ display_name: n, updated_at: t }).eq('event_id', id);`), ['events:waits']);
  assert.deepEqual(classify(`await a.from('events').update({ guest_count_locked_at: null }).eq('event_id', id);`), []);
  assert.deepEqual(classify(`await a.from('events').update(patch).eq('event_id', id);`), ['events:unreadable']);
  assert.deepEqual(classify(`await a.from('events').update({ ...rest, final_pax: 1 }).eq('event_id', id);`), ['events:unreadable']);
  assert.deepEqual(classify(`await a.from('events').update({ ...rest, archived: true }).eq('event_id', id);`), ['events:clears']);
  assert.deepEqual(classify(`await a.from('events').delete().eq('event_id', id);`), ['events:clears']);
  assert.deepEqual(classify(`await a.from('users').update({ public_profile_enabled: false }).eq('user_id', id);`), ['users:clears']);
  assert.deepEqual(classify(`await a.from('vendor_profiles').update({ public_visibility: 'hidden' });`), ['vendor_profiles:clears']);
  assert.deepEqual(classify(`await a.from('creator_chapters').update({ showcase_featured_at: null });`), ['creator_chapters:clears']);
  assert.deepEqual(classify(`await a.from('orders').update({ status: 'paid' });`), []);
  // An insert can only make something appear; a widget row only ever changes a look.
  assert.deepEqual(classify(`await a.from('events').insert({ slug, landing_page_visibility: 'public' });`), ['events:waits']);
  assert.deepEqual(classify(`await a.from('invitation_widgets').delete().eq('widget_id', id);`), ['invitation_widgets:waits']);
});

test('every write that takes something down from the home page clears what the page remembers', () => {
  const perFile = new Map<string, number>();
  for (const s of SITES) {
    if (s.kind !== 'clears') continue;
    const key = `${s.table} ${s.file}`;
    perFile.set(key, (perFile.get(key) ?? 0) + 1);
  }
  const problems: string[] = [];
  for (const [key, count] of perFile) {
    const [table, ...rest] = key.split(' ');
    const file = rest.join(' ');
    const subject = HOME_SHELF_DEPENDS[table as string]?.subject as string;
    const exempt = CLEARS_EXEMPT[key];
    if (exempt) {
      if (exempt.count !== count) {
        problems.push(`COUNT  ${file} makes ${count} take-down write(s) to ${table}; CLEARS_EXEMPT excuses ${exempt.count}. Look at the new one.`);
      }
      continue;
    }
    const src = SRC.get(file) ?? '';
    const clears = (src.match(new RegExp(`clearHomeShelf\\([^)]*'${subject}'`, 'g')) ?? []).length;
    if (clears < count) {
      problems.push(
        `UNCLEARED  ${file} makes ${count} write(s) to ${table} that take something down from the home page ` +
          `(a delete, or one of: ${HOME_SHELF_DEPENDS[table as string]?.clears.join(', ')}) and calls ` +
          `clearHomeShelf('${subject}') ${clears} time(s). Call it after the write ` +
          `(lib/home-shelf-clear.ts), or — if the row can never have been listed — add a reasoned line to CLEARS_EXEMPT.`,
      );
    }
  }
  for (const key of Object.keys(CLEARS_EXEMPT)) {
    if (!perFile.has(key)) problems.push(`STALE  CLEARS_EXEMPT lists "${key}" but no such write exists any more — remove the line.`);
  }
  assert.deepEqual(problems, [], `\n${problems.join('\n')}\n`);
});

test('every write that changes how a remembered card looks is counted', () => {
  const actual = tally(['waits', 'unreadable']);
  const lines = [...actual].map(([key, n]) => `${key}\t${n}`).sort();
  const header = [
    '# home-shelf-writes.baseline.txt — GENERATED. Regenerate, never hand-merge:',
    '#   UPDATE_HOME_SHELF_BASELINE=1 ../../node_modules/.bin/tsx --test lib/home-shelf-writes-clear.test.ts',
    '#',
    '# Each line is a file that writes a column the home page remembers WITHOUT clearing it',
    '# (lib/home-shelf-tags.ts HOME_SHELF_DEPENDS): kind, table, file, number of such writes.',
    '#   waits       the write names a column that changes how a card LOOKS (a name, a date, a cover).',
    '#   unreadable  the write\'s columns are a variable or a spread, so this scan cannot tell.',
    '# Either way the home page may show the old value for at most the hard age (300 s).',
    '# A write that takes something DOWN (visibility, archive, delete, a profile going private)',
    '# is never listed here — it must call clearHomeShelf, and the test fails if it does not.',
  ];
  if (process.env.UPDATE_HOME_SHELF_BASELINE === '1') {
    writeFileSync(BASELINE, `${[...header, ...lines].join('\n')}\n`);
  }
  const billed = readFileSync(BASELINE, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'));
  assert.ok(billed.length > 20, `the baseline holds ${billed.length} lines — it was emptied`);
  const added = lines.filter((l) => !billed.includes(l));
  const gone = billed.filter((l) => !lines.includes(l));
  assert.deepEqual(
    { added, gone },
    { added: [], gone: [] },
    'the writes that change a remembered card without clearing it have changed. If the new write takes ' +
      'something DOWN from the home page it must call clearHomeShelf instead. If it only changes a look, ' +
      'regenerate the baseline (the command is in its header) and say so in the PR: that write may now be ' +
      'seen up to 300 s late on the home page.',
  );
});
