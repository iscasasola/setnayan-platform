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

// ── The same disease, a different vocabulary ────────────────────────────────
//
// 🚨 The guard above was written after the payments incident and scoped to
// `payment_status`. The identical mistake was live in `vendor_status` the whole
// time and this file could not see it:
//
//   · script-actions.ts declared BOOKED_STATUSES = ['contracted', 'booked',
//     'confirmed', 'completed']. Three of those four are not enum members, so
//     the emcee's "save this line" errored on EVERY call, for everyone, since
//     it shipped — surfacing as "Could not confirm your booking on this event."
//   · /explore and the couple's suite page both filtered
//     `.neq('status', 'declined')`. No 'declined' either — so the Compare
//     shortcut has never appeared on either surface, and a July fix aimed at
//     that dead end was itself built on the broken predicate.
//
// 🔑 WHY THE PAYMENT GUARD WOULD HAVE MISSED script-actions.ts EVEN IF SCOPED
// HERE: it only matches STRING LITERALS inside the query chain. That call reads
// `.in('status', BOOKED_STATUSES)` — an identifier. So this check reads the
// declared arrays too, not just the call sites.
function declaredVendorStatuses(): string[] {
  const migrations = join(WEB, '../../supabase/migrations');
  for (const f of readdirSync(migrations).sort()) {
    if (!f.endsWith('.sql')) continue;
    const m = readFileSync(join(migrations, f), 'utf8').match(
      /CREATE TYPE public\.vendor_status AS ENUM \(([^)]*)\)/,
    );
    if (m?.[1]) {
      return m[1]
        .split(',')
        .map((s) => s.trim().replace(/^'|'$/g, ''))
        .filter(Boolean);
    }
  }
  return [];
}

function sourceFiles(...roots: string[]): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const n of entries) {
      if (n === 'node_modules' || n === '.next') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) out.push(p);
    }
  };
  for (const r of roots) walk(join(WEB, r));
  return out;
}

test('every vendor status named in a status array is a real enum value', () => {
  const declared = new Set(declaredVendorStatuses());
  assert.ok(
    declared.size > 0,
    'could not find the vendor_status enum — has it been renamed?',
  );

  // ⚠ SCOPED TO ARRAYS THAT ARE ACTUALLY USED AS AN event_vendors STATUS FILTER.
  //
  // A first cut flagged every `*STATUS*` array in any file that merely mentioned
  // event_vendors, and reported 16 violations of which 15 were ORDER, REUSE and
  // PROPOSAL statuses that have nothing to do with this enum — the exact
  // cry-wolf failure the payment guard above already documents, reproduced by me
  // one test lower down the same file. So: find the identifiers each
  // event_vendors chain passes to a status filter, then check only those.
  const bad: string[] = [];
  for (const f of sourceFiles('app', 'lib')) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('event_vendors')) continue;

    // 1. Which identifiers does an event_vendors chain filter `status` on?
    const used = new Set<string>();
    const starts = [...src.matchAll(/\.from\('([a-z_]+)'\)/g)];
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      if (!s || s[1] !== 'event_vendors') continue;
      const from = s.index! + s[0].length;
      const to = starts[i + 1]?.index ?? src.length;
      for (const m of src
        .slice(from, to)
        .matchAll(/\.(?:eq|in|neq)\('status',\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
        if (m[1]) used.add(m[1]);
      }
    }
    if (used.size === 0) continue;

    // 2. Validate only those arrays' members against the real enum.
    for (const m of src.matchAll(
      /(?:export\s+)?const\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*(?:new Set\()?\[([^\]]*)\]/g,
    )) {
      if (!m[1] || !used.has(m[1])) continue;
      for (const v of (m[2] ?? '').matchAll(/'([a-z_]+)'/g)) {
        if (v[1] && !declared.has(v[1])) {
          bad.push(`${f.replace(WEB, '')}: ${m[1]} names '${v[1]}'`);
        }
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `vendor status values that do not exist in the enum [${[...declared].join(', ')}]:\n  ${bad.join('\n  ')}`,
  );
});

test('no event_vendors query filters on a vendor status that does not exist', () => {
  const declared = new Set(declaredVendorStatuses());
  assert.ok(declared.size > 0, 'could not find the vendor_status enum');

  const bad: string[] = [];
  for (const f of sourceFiles('app', 'lib')) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes('event_vendors')) continue;
    // Scoped to the builder chain, exactly like the payment guard above: each
    // chain runs from its own .from(…) to the next one.
    const starts = [...src.matchAll(/\.from\('([a-z_]+)'\)/g)];
    for (let i = 0; i < starts.length; i++) {
      const s = starts[i];
      if (!s || s[1] !== 'event_vendors') continue;
      const from = s.index! + s[0].length;
      const to = starts[i + 1]?.index ?? src.length;
      const chain = src.slice(from, to);
      for (const m of chain.matchAll(
        /\.(?:eq|in|neq)\('status',\s*(\[[^\]]*\]|'[a-z_]+')/g,
      )) {
        for (const v of (m[1] ?? '').matchAll(/'([a-z_]+)'/g)) {
          if (v[1] && !declared.has(v[1])) {
            bad.push(`${f.replace(WEB, '')}: '${v[1]}'`);
          }
        }
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `event_vendors queries naming a non-existent vendor status:\n  ${bad.join('\n  ')}`,
  );
});
