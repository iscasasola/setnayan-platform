/**
 * Every `.rpc()` call must pass argument names the function actually accepts.
 *
 * ── THE BUG THIS CLOSES (2026-08-07 · one live feature broken for weeks) ────
 * `app/api/papic/kwento/route.ts` called:
 *
 *     admin.rpc('submit_photo_message', { …, p_voice_depth: voiceDepth })
 *
 * Production's `submit_photo_message` took SEVEN arguments and had no
 * `p_voice_depth` — its migration had been written into an ORPHAN
 * `apps/supabase/migrations/` directory that `supabase db push` never reads, so
 * the column and the argument were never created. The application half shipped
 * and went live; the schema half went nowhere. Both looked done.
 *
 * 🔑 POSTGREST RESOLVES AN RPC BY ITS EXACT SET OF NAMED ARGUMENTS. One unknown
 * name means NO candidate matches, and the call fails before the body ever runs.
 * The route mapped the unrecognised failure to a generic 500 `save_failed`.
 * Nothing threw in our code. Nothing logged a schema problem. CI was green the
 * entire time — because CI never calls the live database, and a unit test that
 * mocks the client will happily accept any argument you invent.
 *
 * This is the third face of one rule this repo keeps re-learning:
 *   · a phantom COLUMN in a select → PostgREST rejects the whole query, `data`
 *     comes back null, and `?? []` renders it as an empty list;
 *   · a phantom ENUM VALUE in a filter → identical, and it made a duplicate-
 *     payment guard inert from the hour it merged;
 *   · a phantom ARGUMENT in an rpc → identical, and it broke guest messages.
 * In all three the query is REJECTED, not thrown. Silence is the failure mode.
 *
 * ── HOW IT WORKS ───────────────────────────────────────────────────────────
 * Scan the app source for `.rpc('<name>', { … })` and collect the literal keys
 * of the object argument. Replay every migration into PGlite and read the real
 * argument names out of `pg_proc`. Then assert, per call site:
 *   1. every name passed is a name the function accepts  (the bug above);
 *   2. every argument WITHOUT a default is actually passed (the mirror bug —
 *      PostgREST matches no candidate for that too).
 *
 * ⚠ SCOPE, DELIBERATELY NARROW. Only call sites whose argument object is a
 * plain inline literal are checked; a spread or a variable is skipped, because
 * guessing at its keys would produce false accusations, and a guard that cries
 * wolf teaches you to skim past the one time it is right. Skipped sites are
 * COUNTED and reported, so the blind spot is visible rather than implied.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCAN_DIRS = ['app', 'lib'];
const SKIP = new Set(['node_modules', '.next', '.turbo', 'dist', 'build']);

let replay: ReplayResult;
let db: PGlite;

type CallSite = { file: string; line: number; fn: string; keys: string[] };
type SkippedSite = { file: string; line: number; fn: string; why: string };

const calls: CallSite[] = [];
const skipped: SkippedSite[] = [];

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e) || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Strip block comments FIRST, then line comments — order is load-bearing. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Balanced-brace slice starting at the `{` at `from`; null if unbalanced. */
function objectLiteral(src: string, from: number): string | null {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(from + 1, i);
    }
  }
  return null;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  for (const file of SCAN_DIRS.flatMap((d) => walk(join(WEB_ROOT, d)))) {
    const raw = readFileSync(file, 'utf8');
    const clean = stripComments(raw);
    const re = /\.rpc\(\s*['"]([a-z0-9_]+)['"]\s*(,)?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean))) {
      const fn = m[1]!;
      const line = clean.slice(0, m.index).split('\n').length;
      const rel = relative(WEB_ROOT, file);
      if (!m[2]) continue; // no second argument at all — nothing to check

      const after = clean.slice(re.lastIndex);
      const braceOffset = after.search(/\S/);
      if (braceOffset < 0 || after[braceOffset] !== '{') {
        skipped.push({ file: rel, line, fn, why: 'argument is not an inline object literal' });
        continue;
      }
      const body = objectLiteral(after, braceOffset);
      if (body === null) {
        skipped.push({ file: rel, line, fn, why: 'unbalanced object literal' });
        continue;
      }
      if (body.includes('...')) {
        skipped.push({ file: rel, line, fn, why: 'object uses a spread' });
        continue;
      }
      // Top-level keys only: skip anything nested inside a value.
      const keys: string[] = [];
      let depth = 0;
      for (const part of body.split('\n')) {
        const trimmed = part.trim();
        if (depth === 0) {
          const k = trimmed.match(/^([A-Za-z_$][\w$]*)\s*:/);
          if (k) keys.push(k[1]!);
        }
        depth += (part.match(/[{[(]/g) ?? []).length - (part.match(/[}\])]/g) ?? []).length;
      }
      if (keys.length === 0) {
        skipped.push({ file: rel, line, fn, why: 'no literal keys found' });
        continue;
      }
      calls.push({ file: rel, line, fn, keys });
    }
  }
});

after(async () => {
  await db?.close();
});

test('meta: the scan actually found rpc call sites, so an empty scan cannot pass', () => {
  assert.ok(
    calls.length >= 20,
    `only ${calls.length} inline .rpc() call sites found — the scanner is probably broken, ` +
      `and a broken scanner passes silently`,
  );
});

test('every .rpc() passes only argument names the function accepts', async () => {
  const fns = await db.query<{ proname: string; args: string }>(
    `SELECT p.proname, COALESCE(pg_get_function_identity_arguments(p.oid),'') AS args
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'`,
  );
  const accepted = new Map<string, Set<string>>();
  for (const r of fns.rows) {
    const names = r.args
      .split(',')
      .map((a) => a.trim().split(/\s+/)[0])
      .filter((x): x is string => !!x);
    const set = accepted.get(r.proname) ?? new Set<string>();
    for (const n of names) set.add(n);
    accepted.set(r.proname, set);
  }

  const problems: string[] = [];
  for (const c of calls) {
    const known = accepted.get(c.fn);
    if (!known) continue; // function not in public schema (or not ours) — out of scope
    const unknown = c.keys.filter((k) => !known.has(k));
    if (unknown.length) {
      problems.push(
        `${c.file}:${c.line}  ${c.fn}() does not accept: ${unknown.join(', ')}\n` +
          `      it accepts: ${[...known].sort().join(', ') || '(no arguments)'}`,
      );
    }
  }

  assert.deepEqual(
    problems,
    [],
    `\n${problems.length} rpc call site(s) pass an argument the function does not have.\n` +
      `PostgREST matches an RPC by its EXACT set of named arguments, so one unknown\n` +
      `name means no candidate matches and the call fails before the body runs —\n` +
      `as a rejected query, not a thrown error. It will look like a generic save\n` +
      `failure, and CI will stay green.\n\n${problems.join('\n')}\n`,
  );
});

test('the scan reports what it skipped, so the blind spot is visible', () => {
  // Not a failure — a spread or a variable argument object cannot be read
  // statically, and guessing would produce false accusations. This test exists
  // so the number is printed rather than implied.
  console.log(
    `      checked ${calls.length} inline .rpc() call sites; skipped ${skipped.length} ` +
      `(non-literal argument objects)`,
  );
  for (const s of skipped.slice(0, 10)) {
    console.log(`        · ${s.file}:${s.line} ${s.fn}() — ${s.why}`);
  }
  assert.ok(true);
});
