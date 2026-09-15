/**
 * A JOB THAT CLAIMED A WINDOW MUST ALSO SAY WHAT IT DID.
 *
 * `public.cron_job_runs` held exactly two columns — `job_key`, `last_run_at` —
 * and `claim_periodic_job()` stamped `last_run_at` at the instant of the CLAIM,
 * BEFORE the job body ran in the app, which then swallowed every failure in a
 * bare catch. **So a retention sweep that threw left a fresh timestamp and did
 * not retry for a full week, and a silently failing deletion job was
 * byte-identical to a working one from every record we keep.** `/privacy`
 * promises deletions with dates on them under RA 10173.
 *
 * These tests run against the REAL migrations replayed into PGlite, so they
 * exercise the actual compare-and-swap and the actual completion write.
 *
 * 🔑 NONE OF THESE PASS VACUOUSLY. Every row is INSERTED by the test through the
 * real RPCs; nothing here reads production and nothing here is satisfied by an
 * empty table. Contrast `a-retention-promise-leaves-no-overdue-row.db.test.ts`,
 * which says loudly in its own words where its green is only "nothing to delete
 * yet".
 *
 * 🛡 MUTATION-CHECKED against the cheap off-switches a future edit would use:
 * a claim that does not clear the previous outcome, `ok` given a DEFAULT TRUE,
 * `finish` dropping its `finished_at IS NULL` predicate, `rows_affected`
 * written as NULL instead of 0.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db.close();
});

type Row = {
  job_key: string;
  last_run_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  ok: boolean | null;
  rows_affected: number | null;
  error: string | null;
};

async function readRow(key: string): Promise<Row | undefined> {
  const r = await db.query<Row>(`SELECT * FROM public.cron_job_runs WHERE job_key = $1`, [key]);
  return r.rows[0];
}

async function claim(key: string, gap = '1 hour'): Promise<boolean> {
  const r = await db.query<{ claim_periodic_job: boolean }>(
    `SELECT public.claim_periodic_job($1, $2::interval)`,
    [key, gap],
  );
  return r.rows[0]!.claim_periodic_job;
}

async function finish(
  key: string,
  ok: boolean,
  rows: number | null = null,
  err: string | null = null,
): Promise<boolean> {
  const r = await db.query<{ finish_periodic_job: boolean }>(
    `SELECT public.finish_periodic_job($1, $2, $3, $4)`,
    [key, ok, rows, err],
  );
  return r.rows[0]!.finish_periodic_job;
}

// ── the table actually grew the columns ─────────────────────────────────────

test('ANCHOR — the replay really built the schema, so nothing below is testing a fiction', () => {
  assert.ok(replay.applied > 700, `only ${replay.applied} of ${replay.total} migrations applied`);
});

test('cron_job_runs carries an outcome, and `ok` has NO default', async () => {
  const r = await db.query<{ column_name: string; column_default: string | null }>(
    `SELECT column_name, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='cron_job_runs'`,
  );
  const byName = new Map(r.rows.map((c) => [c.column_name, c.column_default]));
  for (const col of ['started_at', 'finished_at', 'ok', 'rows_affected', 'error']) {
    assert.ok(byName.has(col), `cron_job_runs.${col} is missing — the ledger records no outcome`);
  }
  assert.equal(
    byName.get('ok'),
    null,
    'cron_job_runs.ok grew a DEFAULT. A default of TRUE makes a run that NEVER FINISHED read as a ' +
      'success — the exact defect this table was changed to remove.',
  );
});

// ── the claim, unchanged ────────────────────────────────────────────────────

test('the claim still picks exactly ONE winner per window', async () => {
  const key = 'test-single-winner';
  assert.equal(await claim(key, '1 hour'), true, 'the first caller must win');
  assert.equal(await claim(key, '1 hour'), false, 'a second caller inside the gap must lose');
  assert.equal(await claim(key, '1 hour'), false);
});

test('a job that FAILED is still allowed to run again — the claim never reads `ok`', async () => {
  /*
    The tempting "only claim if the last run succeeded" would mean a job that
    failed once NEVER RUNS AGAIN, which is strictly worse than the defect being
    fixed. This is the SQL half of that rule; the TypeScript half is asserted in
    lib/jobs-close-what-they-claim.test.ts.
  */
  const key = 'test-failure-does-not-lock-out';
  assert.equal(await claim(key, '1 hour'), true);
  await finish(key, false, null, 'exploded');
  // Age the row past the gap the way real time would.
  await db.query(`UPDATE public.cron_job_runs SET last_run_at = now() - interval '2 hours' WHERE job_key = $1`, [key]);
  assert.equal(
    await claim(key, '1 hour'),
    true,
    'a job whose last run FAILED was refused its next window — it would never run again',
  );
});

test('a run that never CLOSED does not block the next claim either', async () => {
  const key = 'test-unclosed-does-not-lock-out';
  assert.equal(await claim(key), true);
  // deliberately never finished
  await db.query(`UPDATE public.cron_job_runs SET last_run_at = now() - interval '2 hours' WHERE job_key = $1`, [key]);
  assert.equal(
    await claim(key),
    true,
    'a job that died mid-run was locked out forever; a crash must not be a permanent off-switch',
  );
});

// ── the claim OPENS a run ───────────────────────────────────────────────────

test('winning a window opens a run: started_at set, last window’s outcome CLEARED', async () => {
  const key = 'test-claim-opens';
  await claim(key);
  await finish(key, true, 4);
  const done = await readRow(key);
  assert.equal(done!.ok, true);
  assert.equal(done!.rows_affected, 4);

  await db.query(`UPDATE public.cron_job_runs SET last_run_at = now() - interval '2 hours' WHERE job_key = $1`, [key]);
  await claim(key);
  const open = await readRow(key);
  assert.ok(open!.started_at, 'the new run did not record when it started');
  assert.equal(open!.finished_at, null, 'the new run inherited the PREVIOUS run’s finished_at');
  assert.equal(
    open!.ok,
    null,
    'the new run inherited the previous run’s ok=true. Last week’s success would be read as ' +
      'this week’s, which is the original defect wearing a new column.',
  );
  assert.equal(open!.rows_affected, null, 'the new run inherited the previous run’s count');
  assert.equal(open!.error, null);
});

test('a LOSING claim does not disturb the row it lost to', async () => {
  const key = 'test-loser-is-harmless';
  await claim(key);
  await finish(key, true, 9);
  const before = await readRow(key);
  assert.equal(await claim(key), false);
  const after_ = await readRow(key);
  assert.deepEqual(
    [after_!.ok, after_!.rows_affected, after_!.finished_at],
    [before!.ok, before!.rows_affected, before!.finished_at],
    'a caller that LOST the window still rewrote the winner’s outcome',
  );
});

// ── closing, and the states that must stay apart ────────────────────────────

test('THE PROPERTY — an unfinished run is visibly different from a finished one', async () => {
  const openKey = 'test-open-run';
  const closedKey = 'test-closed-run';
  await claim(openKey);
  await claim(closedKey);
  await finish(closedKey, true, 0);

  const open = await readRow(openKey);
  const closed = await readRow(closedKey);

  assert.equal(open!.finished_at, null);
  assert.equal(open!.ok, null);
  assert.ok(closed!.finished_at, 'a closed run recorded no finish time');
  assert.equal(closed!.ok, true);

  assert.notDeepEqual(
    [open!.finished_at === null, open!.ok],
    [closed!.finished_at === null, closed!.ok],
    'a run that never came back and a run that completed are indistinguishable in the ledger — ' +
      'this is the whole defect',
  );
});

test('🔑 A ZERO-ROW RUN IS A COMPLETED RUN, and 0 is stored as 0 — never NULL', async () => {
  /*
    This is the state a healthy retention sweep is in for MONTHS: it ran, it
    checked, nothing had aged into the deadline yet. If 0 were written as NULL
    it would be indistinguishable from "this job reports no count", and if it
    left finished_at unset it would be indistinguishable from a run that died.
  */
  const key = 'test-zero-is-an-answer';
  await claim(key);
  assert.equal(await finish(key, true, 0), true);
  const r = await readRow(key);
  assert.equal(r!.rows_affected, 0, 'a zero-row run stored NULL — "nothing was due" became "we never found out"');
  assert.notEqual(r!.rows_affected, null);
  assert.ok(r!.finished_at, 'a zero-row run left the row open, which reads as a job that died');
  assert.equal(r!.ok, true, 'a run that legitimately deleted nothing was recorded as not-ok');
  assert.equal(r!.error, null);
});

test('a job that reports no count writes NULL — and NULL is not 0', async () => {
  const key = 'test-no-count';
  await claim(key);
  await finish(key, true, null);
  const r = await readRow(key);
  assert.equal(r!.rows_affected, null);
  assert.equal(r!.ok, true);
});

test('a FAILED run records ok=false and the message the old catch threw away', async () => {
  const key = 'test-failure-recorded';
  await claim(key);
  assert.equal(await finish(key, false, null, 'purge_expired_chat: permission denied'), true);
  const r = await readRow(key);
  assert.equal(r!.ok, false);
  assert.match(r!.error ?? '', /permission denied/);
  assert.ok(r!.finished_at, 'a failure must still CLOSE the run — otherwise it reads as a hang');
});

test('a very long error is bounded, not a log sink', async () => {
  const key = 'test-error-bounded';
  await claim(key);
  await finish(key, false, null, 'x'.repeat(9000));
  const r = await readRow(key);
  assert.ok((r!.error ?? '').length <= 2000, `error stored ${r!.error?.length} chars`);
});

// ── closing what is not open ────────────────────────────────────────────────

test('closing a run twice is REFUSED, so a stale finisher cannot rewrite a fresh run', async () => {
  const key = 'test-double-close';
  await claim(key);
  assert.equal(await finish(key, true, 3), true, 'the first close must land');
  assert.equal(
    await finish(key, true, 999),
    false,
    'a second close landed — a straggler from a previous window can overwrite the current run',
  );
  const r = await readRow(key);
  assert.equal(r!.rows_affected, 3, 'the second close rewrote the first run’s count');
});

test('closing a job that never claimed is REFUSED, not silently successful', async () => {
  assert.equal(
    await finish('test-never-claimed-at-all', true, 5),
    false,
    'finish invented a row for a job that never ran',
  );
  assert.equal(await readRow('test-never-claimed-at-all'), undefined);
});

// ── who may call these ──────────────────────────────────────────────────────

test('neither function is reachable by anon or authenticated', async () => {
  for (const fn of ['claim_periodic_job', 'finish_periodic_job']) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ has: boolean }>(
        `SELECT bool_or(has_function_privilege($1, p.oid, 'EXECUTE')) AS has
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname='public' AND p.proname=$2`,
        [role, fn],
      );
      assert.equal(
        r.rows[0]!.has,
        false,
        `${role} can EXECUTE ${fn} — the job ledger is service-role only; a visitor able to ` +
          `claim a window can starve a retention sweep for a week, and one able to finish it can ` +
          `write a false "deleted 0, all good".`,
      );
    }
  }
});

test('both functions are SECURITY DEFINER with a pinned search_path', async () => {
  const r = await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>(
    `SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname IN ('claim_periodic_job','finish_periodic_job')`,
  );
  assert.equal(r.rows.length, 2);
  for (const fn of r.rows) {
    assert.equal(fn.prosecdef, true, `${fn.proname} is not SECURITY DEFINER`);
    assert.ok(
      (fn.proconfig ?? []).some((c) => c.startsWith('search_path=')),
      `${fn.proname} has no pinned search_path`,
    );
  }
});
