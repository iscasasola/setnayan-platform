import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MONEY_STATUSES } from './payment-reference-match';

/**
 * Guards that cannot fire, and refusals nobody sees.
 *
 * 🚨 THREE OF THESE SHIPPED IN ONE DAY, all mine, all green in CI:
 *
 *   1. The duplicate-reference check queried `status IN ('matched','paid')`.
 *      There is no 'paid' — the enum is pending / matched / rejected. Postgres
 *      rejected the whole query, `data` came back null, the loop saw zero
 *      priors, and the guard concluded "no duplicates" on every payment from
 *      the hour it merged. Seven tests passed: they read source and exercised
 *      the pure comparison, and neither runs the query.
 *   2. `unreadable` was set only inside a `catch`. Supabase does not throw — it
 *      answers politely with `{ error }` — so a failed read still rendered
 *      "Nothing waiting here" with a green tick.
 *   3. Every refusal wrote `settle=` and `why=` into the URL and nothing read
 *      them, so a refused approval looked exactly like a successful one.
 *
 * 🔑 ONE DISEASE: A MECHANISM BUILT AND NEVER PROVEN REACHABLE. The unit tests
 * asked "is the logic right?" and never "can this code run at all?"
 */

const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('every payment status used in a query is a real enum value', () => {
  // 🚨 THE EXACT BUG. A Supabase call naming something the schema does not have
  // returns an ERROR, not a crash — I had internalised that for COLUMN names
  // and missed it for ENUM VALUES, which fail identically and silently.
  const migrations = join(WEB, '../../supabase/migrations');
  let declared: string[] = [];
  for (const f of readdirSync(migrations)) {
    if (!f.endsWith('.sql')) continue;
    const m = readFileSync(join(migrations, f), 'utf8').match(
      /CREATE TYPE public\.payment_status AS ENUM \(([^)]*)\)/,
    );
    if (m?.[1]) {
      declared = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
      break;
    }
  }
  assert.ok(declared.length > 0, 'could not find the payment_status enum — has it been renamed?');

  for (const s of MONEY_STATUSES) {
    assert.ok(
      declared.includes(s),
      `MONEY_STATUSES names "${s}" but payment_status is only [${declared.join(', ')}]. ` +
        'Postgres rejects the whole query, the read returns null, and the duplicate ' +
        'check silently finds nothing on every payment.',
    );
  }
});

test('the duplicate lookup refuses when it cannot read, instead of passing', () => {
  // 🔑 A MONEY GUARD THAT CANNOT READ MUST NOT PASS. Swallowing the error is
  // precisely what made bug #1 invisible: "found nothing" and "could not look"
  // produced identical, reassuring behaviour.
  const src = read('app/admin/payments/actions.ts');
  const block = src.match(/const \{ data: others, error: othersErr \}[\s\S]{0,900}/);
  assert.ok(block, 'the duplicate lookup no longer reads its error');
  assert.match(
    block[0],
    /if \(othersErr\)[\s\S]{0,200}blocking: true/,
    'a failed duplicate lookup must block, not fall through to "clear"',
  );
});

test('a failed peek read can actually set unreadable', () => {
  // Supabase resolves with { error }; it does not throw. A try/catch alone
  // leaves the flag unreachable and the reassuring empty state wins.
  const src = read('lib/admin/queue-peek.ts');
  const reads = src.match(/const \{ data, count, error \} = await q/g) ?? [];
  const bails = src.match(/if \(error\) return \{ items: \[\], total: 0, unreadable: true \}/g) ?? [];
  assert.ok(reads.length > 0, 'no peek reads destructure error — the flag is unreachable again');
  assert.equal(
    bails.length,
    reads.length,
    `${reads.length} peek reads but only ${bails.length} check their error — ` +
      'the ones that do not will report a failed read as an empty queue',
  );
});

test('every settle outcome the actions write has somewhere to be shown', () => {
  // 🚨 A GUARD THAT REFUSES IN SILENCE IS INDISTINGUISHABLE FROM ONE THAT
  // PASSED — and worse here, because the row disappears either way.
  const actions = read('app/admin/work/actions.ts');
  const feed = read('app/admin/queues/_components/queues-triage-feed.tsx');
  const page = read('app/admin/work/page.tsx');

  assert.match(page, /sp\?\.settle/, 'the work page must read the settle outcome from the URL');
  assert.match(page, /settle=\{settle\}/, 'the work page must pass it to the feed');

  const written = new Set(
    [...actions.matchAll(/settle=([a-z]+)/g)].map((m) => m[1]).filter(Boolean) as string[],
  );
  assert.ok(written.size > 0, 'no settle outcomes found — did the query param get renamed?');

  const unshown = [...written].filter((w) => !feed.includes(`  ${w}: {`));
  assert.deepEqual(
    unshown,
    [],
    `these outcomes are written but never displayed: ${unshown.join(', ')}. ` +
      'The admin sees a page that redraws identically to success while the work is undone.',
  );
});

test('a shortfall and a duplicate are not announced the same way', () => {
  // One means "wait for the rest of the money"; the other means "someone may
  // be claiming a transfer twice". Collapsing them throws away the only part
  // the admin can act on.
  const feed = read('app/admin/queues/_components/queues-triage-feed.tsx');
  const shortfall = feed.match(/shortfall: \{[^}]*headline: '([^']+)'/)?.[1];
  const duplicate = feed.match(/duplicate: \{[^}]*headline: '([^']+)'/)?.[1];
  assert.ok(shortfall && duplicate, 'both outcomes must carry their own wording');
  assert.notEqual(shortfall, duplicate, 'the two refusals must not read identically');
});

test('no other admin query filters on a payment status that does not exist', () => {
  // The same mistake, anywhere else in the admin surface.
  //
  // ⚠ SCOPED TO THE QUERY CHAIN, NOT THE FILE. A first cut matched any
  // `.eq('status', …)` in a file that merely also touched payments, and
  // reported ten ORDER statuses (draft, submitted, fulfilled…) as violations.
  // A guard that cries wolf is worse than no guard — it teaches you to skim
  // past the one time it is right.
  const declared = new Set(['pending', 'matched', 'rejected']);
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === '.next') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) files.push(p);
    }
  };
  walk(join(WEB, 'app/admin'));
  walk(join(WEB, 'lib/admin'));

  const bad: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // Each builder chain runs from its own .from(…) to the next one.
    const starts = [...src.matchAll(/\.from\('([a-z_]+)'\)/g)];
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      if (!s || s[1] !== 'payments') continue;
      const from = s.index! + s[0].length;
      const to = starts[i + 1]?.index ?? src.length;
      const chain = src.slice(from, to);
      for (const m of chain.matchAll(/\.(?:eq|in|neq)\('status',\s*(\[[^\]]*\]|'[a-z_]+')/g)) {
        for (const v of (m[1] ?? '').matchAll(/'([a-z_]+)'/g)) {
          if (v[1] && !declared.has(v[1])) bad.push(`${f.replace(WEB, '')}: '${v[1]}'`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], `payment status values that do not exist: ${bad.join(' · ')}`);
});
