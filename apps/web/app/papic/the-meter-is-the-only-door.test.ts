/**
 * EVERY GATE IN `recordSeatCapture` IS ONLY WORTH THE WRITE IT GUARDS.
 *
 * The function refuses a capture nine ways before it writes anything. All of
 * them were advisory until 2026-08-26, because the row went in through the
 * CLAIMER'S OWN SESSION and `authenticated` held INSERT on papic_photos — so
 * the same person could POST straight to PostgREST and skip the lot.
 * Migration 20271169487222 revoked the grant; this asserts the code half, so a
 * later edit cannot quietly put the session client back and reopen it.
 *
 * 🔑 AND THE WRITE IS NO LONGER AN INSERT. 20271170528490 moved the
 * authorization, the credit spend and the row into ONE SECURITY DEFINER
 * function, `papic_record_seat_capture`, so a process death between the spend
 * and the row can no longer leave a couple charged for a photograph that does
 * not exist. Rules 1 and 3 changed shape with it, and the reason is written into
 * each: what they defend is the same property in a new arrangement.
 *
 * ⚠ THE FILE IS READ AS SOURCE ON PURPOSE. Running this function needs a live
 * Supabase, a claimed seat and a rate limiter; what is being defended is a
 * one-word choice of client at the call site, and source is where that choice is
 * visible. The DATABASE half — that the function is atomic, service-role only
 * and cannot be reached by a browser — is asserted against a real Postgres in
 * `tests/db/seat-capture-is-atomic.db.test.ts`. Neither file is sufficient
 * alone.
 *
 * 🪤 COMMENTS ARE STRIPPED BEFORE MATCHING. This file's own subject is written
 * about at length in the docblocks above those call sites — the phrase
 * "through the CLAIMER'S OWN SESSION" appears there describing what was
 * FIXED — so a raw-source match reports the defect it just closed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dirname, 'actions.ts');

/** Source with block and line comments removed. */
function code(): string {
  return readFileSync(SRC, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function occurrences(haystack: string, needle: RegExp): number {
  return haystack.match(needle)?.length ?? 0;
}

test('1 · nothing in this file inserts into papic_photos at all any more', () => {
  const src = code();

  /*
    🔑 THIS RULE INVERTED, AND THE INVERSION IS THE POINT.

    It used to say "every papic_photos insert chain must be opened by `writer`",
    because the fix of the day was choosing the service-role client over the
    caller's session. The write is now inside a SECURITY DEFINER function, so the
    correct number of inserts in this file is ZERO — and an insert reappearing
    here is precisely how the atomicity would be undone: somebody adds a "quick
    fallback" insert beside the RPC, and the spend and the row are two steps
    again, silently, with every test still green.

    ⚠ AND IT IS NOT SPELLING-SENSITIVE. It does not ask which local opened the
    chain (`const rowWriter = supabase` walked past the previous version's
    one-name check). Any `.from('papic_photos')` followed by an `.insert(`,
    whatever opened it, fails.
  */
  const lines = src.split('\n');
  const offenders: number[] = [];
  lines.forEach((line, i) => {
    if (!line.includes("from('papic_photos')")) return;
    if (!/\.insert\(/.test(lines.slice(i, i + 8).join('\n'))) return;
    offenders.push(i + 1);
  });

  assert.deepEqual(
    offenders,
    [],
    `a papic_photos INSERT reappeared at line(s) ${offenders.join(', ')}. The ` +
      `row is written inside papic_record_seat_capture, in the same transaction ` +
      `as the credit spend. An insert here is a second writer that spends and ` +
      `writes as two steps again — the exact debt 20271170528490 paid off.`,
  );
});

test('2 · the record call is made with the service role, and an unavailable one REFUSES', () => {
  const src = code();

  assert.equal(
    occurrences(src, /\bwriter = createAdminClient\(\)/g),
    1,
    'the capture writer is no longer resolved from createAdminClient()',
  );

  // ⚠ AND THAT `writer` IS WHAT MAKES THE CALL — asserted by rule 3, which
  // requires the RPC chain to be opened by that exact name. On its own this rule
  // only proves the admin client is CREATED: it would stay green with `writer`
  // as dead code. The two rules are load-bearing together.

  // The reads above this point fail OPEN on purpose — a config error must not
  // stop a wedding being photographed. The WRITE cannot: with the grant gone
  // there is no second path to fall through to.
  const block = src.slice(src.indexOf('writer = createAdminClient()'));
  const refusal = block.slice(0, block.indexOf('papic_record_seat_capture'));
  assert.match(
    refusal,
    /return \{ ok: false, error: '[a-z_]+' \}/,
    'an unavailable admin client no longer returns a soft error — a silent ' +
      'fall-through here writes nothing and tells the camera it worked',
  );
});

test('3 · the spend and the row go through ONE call, on the admin client', () => {
  const src = code();

  // ⚠ ANCHORED ON THE QUOTED LITERAL, not the bare name. A first cut of the old
  // rule matched the substring, so renaming the RPC to `…_splitX` — which is
  // exactly how a reserve gets orphaned — still matched and it passed green.
  // Same prefix trap as `f.event_dateX`.
  assert.equal(
    occurrences(src, /writer\.rpc\(\s*'papic_record_seat_capture'/g),
    1,
    'the atomic record call is gone from recordSeatCapture, or is no longer ' +
      'made on the service-role client. The function is service-role only: ' +
      "calling it from the caller's session cannot work, and granting EXECUTE " +
      'to a browser role would let a claimer skip the burst limiter, the clip ' +
      'cap, the capture window, the payment gate and the put-away gate.',
  );

  /*
    🚨 AND THE OLD TWO-STEP MUST NOT COME BACK BESIDE IT.

    `papic_reserve_capture_split` is still a real function and still correct — it
    is called by the record function, inside the transaction. What must never
    happen again is this FILE calling it, because a reserve here and a write
    there is the gap that leaked credits on a process death. The seat path has
    no unwind any more precisely because there is no gap for one to cover.
  */
  assert.equal(
    occurrences(src, /'papic_reserve_capture_split'/g),
    0,
    'recordSeatCapture reserves credits on its own again. That reserve and the ' +
      'row would then be two steps, and a death between them charges a couple ' +
      'for a photograph that does not exist.',
  );
  assert.equal(
    occurrences(src, /releaseCaptureCredits\(/g),
    0,
    'the seat path released capture credits again. With the spend and the row ' +
      'in one transaction there is nothing to hand back: this would refund a ' +
      'spend that either committed with its row or never happened.',
  );
});

test('4 · the caller identity is passed to the function, never left to it', () => {
  const src = code();

  /*
    🪤 `current_user` INSIDE A `SECURITY DEFINER` FUNCTION IS ITS OWNER, and
    `auth.uid()` is empty when the service role calls it. So neither can answer
    "who is shooting" — the id has to be resolved out here, under the caller's
    own session, and handed in. This is how `papic_record_guest_capture` has
    always received `p_guest_id`.

    The failure this catches is dropping the argument: the function would then
    compare the seat's claimer to NULL and refuse EVERY capture, which reads as
    a broken camera rather than as a missing parameter.
  */
  const call =
    /writer\.rpc\(\s*'papic_record_seat_capture',[\s\S]{0,1600}?\n {4}\);/.exec(src)?.[0] ?? '';
  assert.ok(call, 'the record call could not be located — the rules below are vacuous');
  assert.match(
    call,
    /p_claimer_user_id:\s*user\.id/,
    "the record call no longer passes the signed-in caller's id. The function " +
      'cannot derive it (current_user is its OWNER; there is no JWT under the ' +
      'service role), so it would compare the claimer to NULL and refuse ' +
      'every capture.',
  );
  assert.match(
    call,
    /p_cost:\s*meterCost/,
    'the record call no longer passes the metered cost — a missing cost is 0, ' +
      'and 0 means "do not meter", so every capture would be free',
  );
});

test('5 · the manual-uploads switch is read HERE, not only on the screen', () => {
  const src = code();

  /*
    🚨 HIDING A CONTROL IS NOT CLOSING A DOOR. The switch shipped governing the
    studio PAGE, which hides the file picker. A server action is a public
    endpoint; a hidden button is one fetch away from not being hidden. The live
    photo wall mirrored to every guest's phone for a whole celebration while the
    only "off" the product offered closed the venue screens.

    ⚠ AND IT MUST SIT ABOVE THE SPEND. A refused upload that has already booked
    a credit charges somebody for a photograph we then decline to keep.
  */
  const gate = src.indexOf('papicManualUploadsClosed(');
  const record = src.indexOf("'papic_record_seat_capture'");
  assert.ok(
    gate > 0,
    'recordSeatCapture no longer reads events.papic_uploads_open. The screen ' +
      'hiding the picker is not a gate — it only stops the one person who set it.',
  );
  assert.ok(record > 0, 'the record call is gone — rule 3 has more to say');
  assert.ok(
    gate < record,
    'the uploads switch is checked AFTER the capture is recorded — by then the ' +
      'credit is spent and the photograph is in the gallery',
  );
});
