/**
 * papic-board-honesty.test.ts — an unbuilt board is not a full one.
 *
 * 🚨 THE BUG THIS PINS. `ensure_papic_board` is the only writer of
 * `papic_missions.board_slot` — which challenges reach a guest, and in what
 * order. The pabati retirement (20271159146115) re-created it with one argument
 * and wrote `REVOKE ALL ... FROM PUBLIC, anon, authenticated` with **no matching
 * GRANT**, so from 2026-08-23 the couple's own screen was refused on every
 * render. Nothing threw (Supabase resolves with `{ error }`), nothing logged,
 * and CI stayed green because the db tests call the function as SUPERUSER in the
 * PGlite replay, where a missing grant cannot be felt.
 *
 * The half a person feels: with every slot NULL, the screen read the board as
 * FULL and told a couple whose challenges reached NOBODY that these were
 * "waiting for a free spot — hide one above to make room". It asked them to
 * delete their own work on the strength of a measurement that had failed.
 *
 * 🔑 FOUR LAYERS, BECAUSE THREE OF THEM PASSED THROUGHOUT THE BUG:
 *   1. the rule itself (pure, exhaustive — it had nowhere to live before);
 *   2. the WIRING — that the screen passes the REAL reading, not a literal. A
 *      guard that hand-feeds the argument under test cannot see the wiring
 *      break, and this whole defect WAS a wiring break;
 *   3. the wrapper actually reads `error`; and
 *   4. the grant ledger, folded across every migration in order, so the NEXT
 *      unpaired revoke fails here instead of in production.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  boardIsTrustworthy,
  boardOccupancyClaim,
  type BoardReading,
} from '@/lib/papic-missions';
import { ensurePapicBoard } from '@/lib/papic-games';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MANAGER = 'app/dashboard/[eventId]/studio/papic/couple-challenges-manager.tsx';

/**
 * ⚠ SQL NEEDS ITS OWN STRIPPER, AND THIS TEST PROVED IT. `stripComments` is the
 * repo's TS/JS one; run over a migration it treats an apostrophe inside a `--`
 * prose block ("gitleaks'", "the function's") as opening a string literal and
 * swallows everything to the next apostrophe — which silently ate the very
 * REVOKE this ledger exists to see. The count floor below is what caught it.
 *
 * Dollar-quoted bodies are preserved whole (their inner `--` lines are part of a
 * string, not comments), single-quoted literals are preserved, and only real
 * `--` / block comments are removed. That last part is not optional either: the
 * migration that FIXES this bug quotes the offending REVOKE in its own prose,
 * and a stripper that missed it would read the fix as the bug.
 */
function stripSqlComments(sql: string): string {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const dollar = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      out += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j++;
          break;
        }
        j++;
      }
      out += sql.slice(i, j);
      i = j;
      continue;
    }
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    out += sql[i];
    i++;
  }
  return out;
}

// ⚠ THE IMPORT ITSELF IS ASSERTED FIRST. Under `tsx --test` an `@/lib/…` import
// has come back with EMPTY named exports in this repo, and a guard whose subject
// is `undefined` runs zero checks and reports a pass. If this line fails, every
// assertion below was meaningless.
test('the module under test actually loaded', () => {
  assert.equal(typeof boardIsTrustworthy, 'function', 'boardIsTrustworthy did not import');
  assert.equal(typeof boardOccupancyClaim, 'function', 'boardOccupancyClaim did not import');
  assert.equal(typeof ensurePapicBoard, 'function', 'ensurePapicBoard did not import');
});

// ---------------------------------------------------------------------------
// 1 · THE RULE
// ---------------------------------------------------------------------------

test('a refused board is never described as an occupancy', () => {
  // The live bug, exactly: the resolver did not answer, so nothing is known.
  const refused: BoardReading = { resolved: false, onBoardCount: 0, waitingCount: 4 };
  assert.equal(boardIsTrustworthy(refused), false);
  assert.equal(boardOccupancyClaim(refused).kind, 'unknown');
});

test('an EMPTY board beside waiting challenges is "unknown", never "full"', () => {
  // The resolver slots the couple lane FIRST, so it cannot answer with an empty
  // board while an active approved couple pick exists. If we see that, the two
  // reads disagree and we do not know which is right — so we say so.
  const contradictory: BoardReading = { resolved: true, onBoardCount: 0, waitingCount: 3 };
  assert.equal(boardIsTrustworthy(contradictory), false);
  assert.equal(boardOccupancyClaim(contradictory).kind, 'unknown');
});

test('a genuinely full board still says so, with its own number', () => {
  const full: BoardReading = { resolved: true, onBoardCount: 10, waitingCount: 2 };
  assert.equal(boardIsTrustworthy(full), true);
  const claim = boardOccupancyClaim(full);
  assert.equal(claim.kind, 'waiting');
  assert.equal(claim.kind === 'waiting' && claim.waiting, 2);
});

test('nothing chosen at all is a readable board, not an error', () => {
  // A brand-new event with no challenges: resolved, empty, nothing waiting.
  // This must NOT degrade to "we could not check" — it is simply empty.
  const fresh: BoardReading = { resolved: true, onBoardCount: 0, waitingCount: 0 };
  assert.equal(boardIsTrustworthy(fresh), true);
  assert.equal(boardOccupancyClaim(fresh).kind, 'hidden_by_you');
});

test("the couple's own hiding is explained without needing a board at all", () => {
  // Off-board because they hid them — true whether or not the resolver ran, so
  // this branch is deliberately NOT gated on a trustworthy reading.
  const hidden: BoardReading = { resolved: false, onBoardCount: 0, waitingCount: 0 };
  assert.equal(boardOccupancyClaim(hidden).kind, 'hidden_by_you');
});

test('only ONE branch may ask for a deletion, and it needs a measured board', () => {
  // The floor that matters: sweep the whole small space and assert that every
  // reading producing `waiting` — the only sentence that says "hide one above to
  // make room" — was measured. A rule that can ask for a deletion off an
  // unmeasured board is the bug returning.
  let waitingSeen = 0;
  for (const resolved of [true, false]) {
    for (let onBoardCount = 0; onBoardCount <= 3; onBoardCount++) {
      for (let waitingCount = 0; waitingCount <= 3; waitingCount++) {
        const r: BoardReading = { resolved, onBoardCount, waitingCount };
        if (boardOccupancyClaim(r).kind === 'waiting') {
          waitingSeen++;
          assert.ok(r.resolved, `asked for a deletion on an unresolved board: ${JSON.stringify(r)}`);
          assert.ok(r.onBoardCount > 0, `asked for a deletion on an EMPTY board: ${JSON.stringify(r)}`);
        }
      }
    }
  }
  // Anti-empty-sweep floor: if the rule ever stops returning `waiting` at all,
  // the loop above passes vacuously and proves nothing.
  assert.ok(waitingSeen >= 9, `the sweep never reached the "waiting" branch (saw ${waitingSeen})`);
});

// ---------------------------------------------------------------------------
// 2 · THE WIRING — what the SCREEN actually passes
// ---------------------------------------------------------------------------

test('the screen passes the REAL reading, not a literal', () => {
  const mgr = read(MANAGER);
  // It must keep the resolver's answer rather than discarding it, as it did.
  assert.match(
    mgr,
    /const board = await ensurePapicBoard\(supabase, eventId\)/,
    'the screen stopped keeping whether the board resolver actually ran',
  );
  // And feed that answer in. `resolved: true` hardcoded would make every
  // assertion in section 1 pass while the screen lied exactly as before.
  assert.match(
    mgr,
    /resolved:\s*board\.resolved/,
    'the screen stopped passing the resolver\'s real answer into the rule',
  );
  assert.match(mgr, /onBoardCount:\s*onBoard\.length/, 'the screen stopped passing the real on-board count');
  assert.match(mgr, /waitingCount:\s*waiting\.length/, 'the screen stopped passing the real waiting count');
});

test('the "make room" sentence is the claim\'s decision, not the JSX\'s', () => {
  const mgr = read(MANAGER);
  assert.match(mgr, /boardOccupancyClaim\(reading\)/, 'the screen stopped asking the shared rule');
  // The instruction to delete may appear ONCE, and only under the `waiting`
  // branch. A second copy is how the two groups quietly drift apart.
  const makeRoom = mgr.match(/hide one above to make room/g) ?? [];
  assert.equal(makeRoom.length, 1, `"hide one above to make room" appears ${makeRoom.length}× — it may appear once, under the waiting branch only`);
  assert.match(
    mgr,
    /notShowingClaim\.kind === 'waiting'[\s\S]{0,400}hide one above to make room/,
    'the deletion instruction escaped the waiting branch',
  );
  // And the honest fallback must exist, or "unknown" renders as nothing.
  assert.match(
    mgr,
    /nothing needs removing/,
    'the "we could not work it out" wording is gone — unknown would render silently',
  );
});

test('the guest route keeps failing soft, and says that is deliberate', () => {
  // A guest at a party keeps whatever board exists. If this ever starts
  // branching on `resolved`, somebody has moved the couple's rule onto a phone.
  const route = read('app/api/papic/guest-missions/route.ts');
  assert.match(route, /await ensurePapicBoard\(admin, session\.event_id\)/, 'the guest route stopped building the board');
  assert.ok(
    !/\.resolved/.test(route),
    'the guest route started branching on resolved — a guest must keep the board they have',
  );
});

// ---------------------------------------------------------------------------
// 3 · THE WRAPPER READS `error`
// ---------------------------------------------------------------------------

test('a refused RPC returns resolved:false — it is not swallowed as an empty board', async () => {
  process.env.NEXT_PUBLIC_PAPIC_GAMES_V1 = 'true';
  // Supabase does not throw. This stub resolves the way a permission failure
  // really does, which is the whole reason the bug was invisible.
  const refusing = {
    rpc: async () => ({
      data: null,
      error: { message: 'permission denied for function ensure_papic_board', code: '42501' },
    }),
  } as never;
  const out = await ensurePapicBoard(refusing, 'evt-1');
  assert.equal(out.resolved, false, 'a refusal must not read as a resolved empty board');
  assert.equal(out.slots, 0);
});

test('a successful RPC reports resolved:true and its slot count', async () => {
  process.env.NEXT_PUBLIC_PAPIC_GAMES_V1 = 'true';
  const ok = { rpc: async () => ({ data: 10, error: null }) } as never;
  const out = await ensurePapicBoard(ok, 'evt-1');
  assert.equal(out.resolved, true);
  assert.equal(out.slots, 10);
});

// ---------------------------------------------------------------------------
// 4 · THE GRANT LEDGER — folded in migration order
// ---------------------------------------------------------------------------

test('the couple may execute the board builder, and anon may never', () => {
  // 🔑 THE POINT: not "does my migration grant it", but "what is the state after
  // EVERY migration has run, in order". The bug was an unpaired REVOKE in a
  // later file silently undoing an earlier GRANT — which a per-file assertion
  // cannot see. Fold the ledger and read the end of it.
  const dir = join(REPO, 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.length > 100, `only ${files.length} migrations found — the scan is pointed at the wrong directory`);

  let authenticated = false;
  let anon = false;
  let statementsSeen = 0;

  for (const f of files) {
    const sql = stripSqlComments(readFileSync(join(dir, f), 'utf8'));
    for (const raw of sql.split(';')) {
      const s = raw.replace(/\s+/g, ' ').trim();
      if (!/ensure_papic_board/i.test(s)) continue;
      if (!/^(GRANT|REVOKE)\b/i.test(s)) continue;
      // Only the CURRENT one-argument signature. The two-argument form was
      // dropped with the pabati SKU; its grants say nothing about today.
      if (/boolean/i.test(s)) continue;
      statementsSeen++;
      const grant = /^GRANT\b/i.test(s);
      if (/\bauthenticated\b/i.test(s)) authenticated = grant;
      if (/\banon\b/i.test(s)) anon = grant;
    }
  }

  // Anti-empty-sweep floor: a regex that matches nothing would leave both flags
  // false and this test would "pass" the anon half for the wrong reason.
  assert.ok(statementsSeen >= 2, `found only ${statementsSeen} grant statements for the one-arg signature — the scan matched nothing`);
  assert.equal(
    authenticated,
    true,
    'the couple cannot execute their own board builder — an unpaired REVOKE is back',
  );
  assert.equal(anon, false, 'anon was granted the board builder — a NULL uid is read as the trusted server');
});
