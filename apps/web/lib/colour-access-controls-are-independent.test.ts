/**
 * colour-access-controls-are-independent.test.ts — THREE CONTROLS, AND NONE OF
 * THEM DOES ANOTHER'S JOB.
 *
 * The owner's ruling, verbatim in the brief: *"Three separate controls, none
 * affecting the others: the toggle, the notification, the reject."*
 *
 * 🔴 WHY IT NEEDS A TEST AT ALL, GIVEN THE db SUITE ALREADY PROVES THE
 * BEHAVIOUR. Because both wrong versions WORK. A reject that also revoked
 * would look, from every screen, like a couple deciding they had had enough of
 * a supplier — they would simply lose the florist over one bouquet colour and
 * never know why. A revoke that also cleared history would look like a tidy
 * switch — and the couple would lose the record of six colours somebody
 * changed on their board. Neither throws. Neither renders differently.
 *
 * So this reads the FUNCTION BODIES out of the migration and asserts the
 * coupling is not merely absent today but unwritable: `reject_colour_change`
 * contains no statement naming a grant table, and neither grant function
 * contains one naming the change log. The behavioural half lives in
 * `tests/db/colour-access-is-a-door-not-a-window.db.test.ts`; this half is what
 * catches the edit before it is ever run.
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST. This repo has shipped five separate guards
 * that matched their own explanatory prose — and the migration's own docblock
 * names both tables in the same sentence, on purpose, which is exactly the text
 * a naive scanner would flag.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = join(
  HERE,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20271204966904_colour_access_grants.sql',
);
const SQL = readFileSync(MIGRATION, 'utf8');

const GRANT_TABLES = ['event_colour_grants', 'event_colour_grants_coordinator'];
const LOG_TABLE = 'event_colour_changes';

/**
 * The `AS $$ … $$;` body of one CREATE FUNCTION, with `--` comments removed.
 *
 * Anchored on the CREATE line rather than on the function name alone: the name
 * also appears in COMMENT ON, in REVOKE/GRANT, and in the header prose, and a
 * window that started at the first mention would slice the docblock.
 */
function bodyOf(fnName: string): string {
  const at = SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${fnName}(`);
  assert.ok(at >= 0, `${fnName} not found — did it move or get renamed?`);
  const open = SQL.indexOf('AS $$', at);
  const close = SQL.indexOf('$$;', open);
  assert.ok(open > at && close > open, `${fnName} has no $$ body`);
  const body = SQL.slice(open, close).replace(/--[^\n]*/g, '');
  // 🔑 THE FLOOR. An empty or truncated slice makes every "does not mention"
  // assertion below pass, and a guard that cannot go red is not a guard.
  assert.ok(body.length > 300, `${fnName} body parse floor: ${body.length} chars`);
  assert.ok(body.includes('BEGIN'), `${fnName} body does not look like plpgsql`);
  return body;
}

test('REJECT cannot revoke — its body names no grant table', () => {
  const body = bodyOf('reject_colour_change');
  for (const t of GRANT_TABLES) {
    assert.ok(
      !body.includes(t),
      `reject_colour_change now touches ${t}. Rejecting one colour must never cost somebody ` +
        'their standing access — the couple has a separate switch for that, and coupling the ' +
        'two means every correction reads as a dismissal.',
    );
  }
  // Vacuity: the slice really is the reject function.
  assert.ok(body.includes(LOG_TABLE), 'the sliced body is not reject_colour_change');
  assert.ok(body.includes('reverted_at'), 'the sliced body does not perform the revert');
});

test('REVOKE cannot erase — neither grant function names the change log', () => {
  for (const fn of ['set_vendor_colour_access', 'set_coordinator_colour_access']) {
    const body = bodyOf(fn);
    assert.ok(
      !body.includes(LOG_TABLE),
      `${fn} now touches ${LOG_TABLE}. Turning access off must leave every past change on ` +
        'record — a couple who can no longer see what happened cannot undo it either.',
    );
    // Vacuity: the slice really is a grant function.
    assert.ok(
      GRANT_TABLES.some((t) => body.includes(t)),
      `the sliced body is not ${fn}`,
    );
  }
});

test('REVOCATION IS A FLIP, NOT A DELETE — no grant function deletes a row', () => {
  // A deleted grant row takes `granted_at` with it, so "since when could this
  // shop do this" becomes unanswerable — and the change log's rows would point
  // at a permission with no record of ever having existed.
  for (const fn of ['set_vendor_colour_access', 'set_coordinator_colour_access']) {
    const body = bodyOf(fn);
    assert.ok(!/DELETE\s+FROM/i.test(body), `${fn} deletes a grant row instead of flipping it`);
    assert.ok(/is_active\s*=\s*FALSE/i.test(body), `${fn} has no revoke path at all`);
    assert.ok(/revoked_at\s*=\s*NOW\(\)/i.test(body), `${fn} revokes without dating it`);
  }
});

test('REJECT DOES NOT DELETE THE HISTORY IT UNDOES', () => {
  const body = bodyOf('reject_colour_change');
  assert.ok(
    !/DELETE\s+FROM/i.test(body),
    'reject_colour_change deletes the row it reverts — "did I already deal with this one?" ' +
      'is the only question somebody re-reading the log has, and a deleted row answers it wrong',
  );
});

test('THE APPLY DOOR CHECKS A GRANT — and the check is not a comment', () => {
  const body = bodyOf('apply_colour_change');
  // Both halves of "who is asking": the booking and the person.
  assert.ok(body.includes('event_colour_grants'), 'apply_colour_change reads no vendor grant');
  assert.ok(
    body.includes('event_colour_grants_coordinator'),
    'apply_colour_change reads no coordinator grant',
  );
  assert.ok(/is_active/.test(body), 'apply_colour_change ignores the couple’s switch');
  assert.ok(
    body.includes('colour_domain_covers'),
    'apply_colour_change does not check the target is inside the granted domain',
  );
  assert.ok(
    /RAISE EXCEPTION 'no_colour_grant'/.test(body),
    'apply_colour_change has no refusal path — a missing grant would fall through',
  );
});

test('THE APPLY DOOR READS THE ROW BACK — the freeze must not render as success', () => {
  const body = bodyOf('apply_colour_change');
  // 🔴 MB12's events_hold_part_finalization_freeze reverts an agreed part's
  // colour inside the same statement, and the UPDATE still reports success. A
  // logged-but-never-applied change gives the couple an undo for nothing and
  // tells the supplier their work saved.
  const afterUpdate = body.slice(body.indexOf('UPDATE public.events'));
  assert.ok(
    /SELECT[\s\S]*FROM public\.events/.test(afterUpdate),
    'apply_colour_change does not re-read events after writing — the freeze would pass silently',
  );
  assert.ok(afterUpdate.includes("'frozen'"), 'there is no frozen answer to return');
  // The log INSERT must come AFTER the read-back, or the check protects nothing.
  assert.ok(
    body.indexOf('INSERT INTO public.event_colour_changes') >
      body.indexOf('UPDATE public.events'),
    'the change is logged before the write is verified',
  );
});

test('EVERY MB16 FUNCTION IS SECURITY DEFINER WITH A PINNED search_path', () => {
  // A SECURITY DEFINER function without `SET search_path` is resolvable against
  // a caller-controlled schema. All six are the sanctioned door into a table
  // `authenticated` cannot write, so all six need both.
  for (const fn of [
    'colour_access_caller_is_couple',
    'set_vendor_colour_access',
    'set_coordinator_colour_access',
    'apply_colour_change',
    'reject_colour_change',
  ]) {
    const at = SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    const head = SQL.slice(at, SQL.indexOf('AS $$', at));
    assert.ok(head.includes('SECURITY DEFINER'), `${fn} is not SECURITY DEFINER`);
    assert.ok(head.includes('SET search_path = public'), `${fn} has no pinned search_path`);
  }
});

test('ANON HOLDS EXECUTE ON NOTHING MB16 ADDED', () => {
  for (const fn of [
    'colour_domains_for_category',
    'colour_domain_covers',
    'colour_access_caller_is_couple',
    'set_vendor_colour_access',
    'set_coordinator_colour_access',
    'apply_colour_change',
    'reject_colour_change',
  ]) {
    assert.ok(
      new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}\\([^)]*\\) FROM anon;`).test(SQL),
      `${fn} keeps Supabase's default grant, so it sits on the publishable-key surface`,
    );
  }
});

test('THE THREE TABLES GRANT authenticated NO WRITE', () => {
  for (const t of [...GRANT_TABLES, LOG_TABLE]) {
    assert.ok(
      new RegExp(`REVOKE ALL ON TABLE public\\.${t}\\s+FROM anon;`).test(SQL),
      `${t} is still reachable by anon`,
    );
    assert.ok(
      new RegExp(`REVOKE INSERT, UPDATE, DELETE ON TABLE public\\.${t}\\s+FROM authenticated;`).test(
        SQL,
      ),
      `${t} lets authenticated write — a grant nobody gave becomes representable`,
    );
  }
});
