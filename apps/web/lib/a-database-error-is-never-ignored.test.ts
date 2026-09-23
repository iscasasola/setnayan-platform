import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { scanSource, scanSourceDetailed, type UnreadErrorFinding } from './supabase-unread-error-scan';

/**
 * LAU-31 · a Supabase call whose `error` nobody reads fails in silence.
 *
 * 🚨 LAU-30, the case that made this: `profile/concierge/actions.ts` wrapped
 * `await admin.from('concierge_abuse_flags').insert(…)` in a try/catch and
 * logged "abuse-flag insert failed" from the catch. Supabase RESOLVES with
 * `{ error }`; it does not throw. So the catch was dead code — a refused insert
 * left no flag, no log line, and a user who should have been under review
 * wasn't — and the try/catch made it look handled to every reviewer.
 *
 * TWO HALVES, deliberately:
 *   1. The DECISION is exercised over fixtures — each shape it must catch and
 *      each it must leave alone — so the rule is RUN, not grepped for.
 *   2. The SWEEP runs it over every non-test source file in app/, lib/,
 *      components/ and middleware.ts, against `supabase-unread-error.baseline.txt`.
 *      The baseline holds what was already there on day one, so this is green
 *      on arrival and red on any NEW unread error.
 *
 * The baseline is keyed `file · kind · table.op` with a COUNT — never a line
 * number, which rots on the first edit above it (CLAUDE.md rule 7). A second
 * unread write to the same table in the same file raises the count and fails.
 *
 * When this fails on your change, the fix is almost always to read the error:
 *   const { error } = await sb.from('t').insert(row);
 *   if (error) { …surface it, or at least log it… }
 * For a best-effort write whose failure truly changes nothing, write the reason
 * where the next reader will see it, on the line above:
 *   // supabase-error-ignored: <why a failure here is harmless>
 * Adding a NEW line to the baseline is the wrong answer — it is the list of
 * debt we inherited, not a place to put more.
 */

const kinds = (src: string) => scanSource(src).map((f) => f.kind);

// ─── 1 · THE DECISION ─────────────────────────────────────────────────────────

test('LAU-30 exactly: a try/catch around an insert whose result is thrown away', () => {
  // Verbatim shape of concierge/actions.ts before the fix.
  const src = `
    async function f(admin, userId, abuse) {
      if (abuse) {
        try {
          await admin.from('concierge_abuse_flags').insert({
            flagged_user_id: userId,
            matched_user_ids: abuse.matchedUserIds,
          });
        } catch (e) {
          console.error('[concierge] abuse-flag insert failed:', e);
        }
      }
    }`;
  assert.deepEqual(scanSource(src).map((f) => [f.kind, f.target]), [
    ['discarded-in-try', 'from:concierge_abuse_flags.insert'],
  ]);
});

test('each shape that never reads the error is caught', () => {
  assert.deepEqual(kinds(`async function f(sb){ await sb.from('t').update({a:1}).eq('id', 1); }`), ['discarded']);
  assert.deepEqual(kinds(`async function f(sb){ void (await sb.from('t').delete().eq('id', 1)); }`), ['discarded']);
  assert.deepEqual(kinds(`async function f(sb){ await sb.rpc('touch_row', { id: 1 }); }`), ['discarded']);
  // A builder is a lazy thenable — without await it never even sends.
  assert.deepEqual(kinds(`function f(sb){ sb.from('t').insert({a:1}); }`), ['never-awaited']);
  // The write's result is kept, but only `data`.
  assert.deepEqual(
    kinds(`async function f(sb){ const { data } = await sb.from('t').update({a:1}).select('id'); return data; }`),
    ['write-error-dropped'],
  );
  assert.deepEqual(
    kinds(`async function f(sb){ const res = await sb.from('t').upsert({a:1}).select(); return res.data; }`),
    ['write-error-dropped'],
  );
  // Destructured, renamed, then never looked at.
  assert.deepEqual(
    kinds(`async function f(sb){ const { data, error: readErr } = await sb.from('t').select('a'); return data; }`),
    ['error-unused'],
  );
  // Discarded through a cast/paren wrapper.
  assert.deepEqual(kinds(`async function f(sb){ (await (sb.from('t').insert({a:1}) as any)); }`), ['discarded']);
});

test('each shape that does read the error — or hands it on — is left alone', () => {
  const clean = [
    `async function f(sb){ const { error } = await sb.from('t').insert({a:1}); if (error) throw error; }`,
    `async function f(sb){ const { error: e } = await sb.from('t').insert({a:1}); return e?.message; }`,
    `async function f(sb){ const res = await sb.from('t').insert({a:1}); if (res.error) return; }`,
    `async function f(sb){ const res = await sb.from('t').insert({a:1}); return res; }`,
    `async function f(sb){ return await sb.from('t').insert({a:1}); }`,
    `function f(sb){ return sb.from('t').insert({a:1}); }`,
    `async function f(sb){ const [a] = await Promise.all([sb.from('t').insert({a:1})]); return a; }`,
    `async function f(sb){ await sb.from('t').insert({a:1}).throwOnError(); }`,
    `function f(sb){ sb.from('t').insert({a:1}).then(({ error }) => console.error(error)); }`,
    `async function f(sb){ const { ...all } = await sb.from('t').insert({a:1}); return all; }`,
    // A READ that keeps only data is out of scope (see the scanner's docblock).
    `async function f(sb){ const { data } = await sb.from('t').select('a'); return data; }`,
    // Not Supabase at all.
    `function f(x){ Array.from(x); Buffer.from('abc'); }`,
    `async function f(sb){ await sb.storage.from('bucket').remove(['a']); }`,
    // The escape hatch, with a real reason.
    `async function f(sb){
       // supabase-error-ignored: a view counter — a lost increment changes nothing a person sees
       await sb.rpc('bump_views', { id: 1 });
     }`,
  ];
  for (const src of clean) assert.deepEqual(kinds(src), [], src);
});

test('a re-assignment whose error is read after the enclosing if is not flagged', () => {
  // Found in the first sweep: the retry assigns into an outer `let`, and the
  // error is read AFTER the if-block — a block-scoped search called it unused.
  const src = `
    async function f(sb) {
      let { data, error } = await sb.rpc('rec', { a: 1, b: 2 });
      if (error) {
        ({ data, error } = await sb.rpc('rec', { a: 1 }));
      }
      if (error) throw error;
      return data;
    }`;
  assert.deepEqual(kinds(src), []);
});

test('the escape hatch needs a reason, and only covers the line below it', () => {
  // A bare marker is a silencer, not an explanation.
  assert.deepEqual(
    kinds(`async function f(sb){
      // supabase-error-ignored: ok
      await sb.from('t').insert({a:1});
    }`),
    ['discarded'],
  );
  // A marker two statements up does not reach this one.
  assert.deepEqual(
    kinds(`async function f(sb){
      // supabase-error-ignored: a best-effort audit breadcrumb, harmless to lose
      await sb.from('audit').insert({a:1});
      await sb.from('orders').update({paid:true}).eq('id', 1);
    }`),
    ['discarded'],
  );
});

// ─── 2 · THE SWEEP ────────────────────────────────────────────────────────────

const WEB = process.cwd();
const BASELINE = join(WEB, 'lib/supabase-unread-error.baseline.txt');
const ROOTS = ['app', 'lib', 'components'];
const EXTRA = ['middleware.ts'];

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
}

const keyOf = (file: string, f: UnreadErrorFinding) => `${file}\t${f.kind}\t${f.target}`;

function sweep() {
  const files: string[] = [];
  for (const r of ROOTS) walk(join(WEB, r), files);
  for (const e of EXTRA) if (existsSync(join(WEB, e))) files.push(join(WEB, e));
  let calls = 0;
  const counts = new Map<string, number>();
  const where = new Map<string, string[]>();
  for (const abs of files) {
    const file = relative(WEB, abs);
    const r = scanSourceDetailed(readFileSync(abs, 'utf8'), file);
    calls += r.calls;
    for (const f of r.findings) {
      const k = keyOf(file, f);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      where.set(k, [...(where.get(k) ?? []), `${file}:${f.line}`]);
    }
  }
  return { files: files.length, calls, counts, where };
}

function readBaseline(): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of readFileSync(BASELINE, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.split('\t');
    assert.equal(parts.length, 4, `malformed baseline line: ${JSON.stringify(line)}`);
    m.set(parts.slice(0, 3).join('\t'), Number(parts[3]));
  }
  return m;
}

test('no NEW Supabase call leaves its error unread', () => {
  const { files, calls, counts, where } = sweep();

  // 🪤 Floors, so a walk that found nothing — wrong cwd, renamed folder, a
  // parser that stopped recognising calls — cannot read as "no findings".
  // Measured 2026-09-18: 3,849 files · 5,939 recognised calls · 550 unread.
  console.log(`# swept ${files} files · ${calls} Supabase calls · ${[...counts.values()].reduce((a, b) => a + b, 0)} unread errors`);
  assert.ok(files > 3000, `only ${files} files swept — is the test running from apps/web?`);
  assert.ok(calls > 4500, `only ${calls} Supabase calls recognised — the scanner has stopped seeing them`);

  if (process.env.UPDATE_UNREAD_ERROR_BASELINE === '1') {
    const header = [
      '# LAU-31 · Supabase calls whose `error` is never read — inherited on 2026-09-18.',
      '# Read by lib/a-database-error-is-never-ignored.test.ts. file<TAB>kind<TAB>target<TAB>count.',
      '# This is DEBT, not permission: fix an entry and lower its count; never add one.',
    ];
    const body = [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k}\t${n}`);
    writeFileSync(BASELINE, [...header, ...body, ''].join('\n'));
    return;
  }

  const base = readBaseline();
  const grown: string[] = [];
  for (const [k, n] of counts) {
    const allowed = base.get(k) ?? 0;
    if (n > allowed) {
      const [, kind, target] = k.split('\t');
      grown.push(`  ${kind} ${target} — ${n} now, ${allowed} inherited\n      at ${where.get(k)!.join(', ')}`);
    }
  }
  assert.deepEqual(
    grown,
    [],
    `\nA Supabase call's \`error\` is never read. Supabase RESOLVES with { error }; it does not throw —\n` +
      `so this failure is silent, and a try/catch around it is dead code (that is LAU-30).\n\n` +
      grown.join('\n') +
      `\n\nRead the error (\`const { error } = await …; if (error) …\`). If a failure there is genuinely\n` +
      `harmless, say why on the line above: // supabase-error-ignored: <reason>\n`,
  );

  // Fixed entries are reported, not failed: a ratchet that turns main red
  // because a peer PR FIXED something punishes the fix. Lower the count here
  // when you pay one down, or regenerate with UPDATE_UNREAD_ERROR_BASELINE=1.
  //
  // ── BUT THE SLACK IS BOUNDED (added 2026-09-22, W1 / LAU-30) ──────────────
  // 🔑 A STALE BASELINE ENTRY IS NOT NEUTRAL — IT IS PERMISSION. The baseline
  // is a ceiling per `file · kind · target`. When the real count drops to 0 and
  // the entry stays at 1, that file may acquire a genuinely unread error later
  // and this guard stays GREEN, because the count never exceeds the stale
  // ceiling. Reporting-only meant nobody ever lowered one.
  //
  // Measured: 8 entries (11 units) had silently gone stale in the 4 days since
  // this baseline was inherited on 2026-09-18 — including 4 paid down by the
  // very PR that fixed them (#5872) without lowering them here.
  //
  // So: still never fail on a SINGLE fix — that would punish the fix, which the
  // paragraph above is right about — but fail once the drift is large enough
  // that the debt list has stopped describing the tree. Regenerating is one
  // command and the message says it.
  const paid = [...base].filter(([k, n]) => (counts.get(k) ?? 0) < n).map(([k]) => k.replace(/\t/g, ' '));
  const PAID_DOWN_CEILING = 12;
  console.log(
    `# unread-error baseline: ${base.size} entries, ${paid.length} paid down ` +
      `(ceiling ${PAID_DOWN_CEILING})`,
  );
  if (paid.length) console.log(`#   ${paid.join('\n#   ')}`);
  assert.ok(
    paid.length <= PAID_DOWN_CEILING,
    `${paid.length} baseline entries are stale — the list has stopped describing the tree.\n` +
      `A stale entry is PERMISSION: that file can acquire a real unread error and stay green.\n` +
      `Fix: pnpm --filter @setnayan/web exec env UPDATE_UNREAD_ERROR_BASELINE=1 node --test --import tsx lib/a-database-error-is-never-ignored.test.ts\n` +
      `Stale:\n  ` + paid.join('\n  '),
  );
});
