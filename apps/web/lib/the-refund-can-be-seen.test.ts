/**
 * GUARD — a refund that fails must not do it silently.
 *
 * 🚨 THE DEFECT. Both Papic capture paths reserved credits, and when the row
 * then failed to land they released them like this:
 *
 *     .then(() => undefined, () => undefined)
 *
 * 🔑 SUPABASE DOES NOT THROW — IT RESOLVES WITH `{ error }`. So the second
 * handler almost never ran and the FIRST discarded a real failure. A revoked
 * grant, a replaced function signature or a lock wait left the credits spent,
 * the photo absent, and **nothing anywhere knowing**. Somebody is charged for a
 * photo they do not have, in silence.
 *
 * ⚠ BEST-EFFORT IS STILL RIGHT — SILENT WAS THE BUG. A failed release must
 * never break a camera mid-wedding, so the helper still never throws. What
 * changed is that it reports.
 *
 * 🪤 AND THE UNWIND WAS COVERED BY NOTHING BEFORE THIS. Deleting the release
 * call left the whole suite green — which is how a money path stayed
 * unobservable long enough for it to be worth a guard of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const HELPER = readFileSync(join(WEB, 'lib/papic-release-capture.ts'), 'utf8');

/** Every file that releases capture credits, DERIVED — never a hand-typed list. */
const CALLERS = [
  'app/papic/actions.ts',
  'app/api/papic/guest-capture/route.ts',
].map((rel) => ({ rel, src: readFileSync(join(WEB, rel), 'utf8') }));

test('the helper exists and cannot throw — a failed refund must not kill the camera', () => {
  assert.ok(/export async function releaseCaptureCredits/.test(HELPER), 'the helper is gone');
  assert.ok(/try \{/.test(HELPER) && /\} catch \(e\) \{/.test(HELPER), 'the helper lost its catch — a release failure would now take the shutter down with it');
});

test('🚨 the helper CHECKS the resolved error — a catch alone cannot see it', () => {
  assert.ok(
    /const \{ error \} = await admin\.rpc\('papic_release_capture_split'/.test(HELPER),
    'the helper stopped destructuring { error }. Supabase resolves rather than throwing, so without this the failure is invisible again.',
  );
  assert.ok(
    /if \(error\) \{[\s\S]{0,400}?logQueryError/.test(HELPER),
    'a resolved error no longer reaches logQueryError — this is the exact silence the helper exists to end',
  );
});

test('🚨 the failure is logged at the severity of its CONSEQUENCE', () => {
  // graceful_degrade reads as "we coped". Somebody was charged for a photo that
  // does not exist; we did not cope.
  assert.ok(
    /'will_throw'/.test(HELPER),
    "the release failure was downgraded to graceful_degrade — it reads as 'we coped', and a person has been charged for a photo that does not exist",
  );
});

test('🚨 no capture path releases credits silently any more', () => {
  for (const { rel, src } of CALLERS) {
    assert.ok(
      /releaseCaptureCredits\(/.test(src),
      `${rel} no longer calls the shared release — it has its own, and the reason this file exists is that hand-rolled ones swallowed their errors`,
    );
    // The literal shape of the old bug, in the region around any direct RPC call.
    const silent = /papic_release_capture_split[\s\S]{0,400}?=>\s*undefined/.exec(src);
    assert.equal(
      silent,
      null,
      `${rel} discards the release result again — that is the original defect, verbatim`,
    );
  }
});

test('the reserve figures are passed back, never re-derived', () => {
  for (const { rel, src } of CALLERS) {
    const call = /releaseCaptureCredits\([\s\S]{0,400}?\}\)/.exec(src)?.[0] ?? '';
    assert.ok(
      /dedicatedSpent/.test(call) && /poolSpent/.test(call),
      `${rel} no longer passes both halves back. The balance has already moved, and a second read cannot tell "spent its last credit" from "never had any".`,
    );
  }
});
