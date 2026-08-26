/**
 * EVERY GATE IN `recordSeatCapture` IS ONLY WORTH THE WRITE IT GUARDS.
 *
 * The function refuses a capture eight ways before it writes anything. All
 * eight were advisory until 2026-08-26, because the row went in through the
 * CLAIMER'S OWN SESSION and `authenticated` held INSERT on papic_photos — so
 * the same person could POST straight to PostgREST and skip the lot.
 * Migration 20271169487222 revoked the grant; this asserts the code half, so a
 * later edit cannot quietly put the session client back and reopen it.
 *
 * ⚠ THE FILE IS READ AS SOURCE ON PURPOSE. Running this function needs a live
 * Supabase, a claimed seat and a rate limiter; what is being defended is a
 * one-word choice of client at three call sites, and source is where that
 * choice is visible.
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

test('1 · no papic_photos INSERT runs on the caller session client', () => {
  const src = code();

  // Every `.from('papic_photos')` in this file, with the ~6 lines that follow,
  // so an `.insert(` can be attributed to the client that opened the chain.
  const lines = src.split('\n');
  const offenders: number[] = [];
  let inserts = 0;

  lines.forEach((line, i) => {
    if (!line.includes("from('papic_photos')")) return;
    const window = lines.slice(i, i + 8).join('\n');
    if (!/\.insert\(/.test(window)) return;
    inserts += 1;
    // Walk back to the token that opened the chain.
    const opener = lines
      .slice(Math.max(0, i - 3), i)
      .reverse()
      .find((l) => /\b(writer|supabase|admin)\b/.test(l));
    if (opener && /\bsupabase\b/.test(opener)) offenders.push(i + 1);
  });

  // Anti-vacuity: if the shape of the file changes so no insert is found, this
  // rule silently stops asking anything.
  assert.ok(
    inserts >= 3,
    `found ${inserts} papic_photos inserts in actions.ts — expected at least 3 ` +
      `(plain, poster, PGRST204 retry). The scan lost the call sites, so the ` +
      `rule below is vacuous.`,
  );

  assert.deepEqual(
    offenders,
    [],
    `papic_photos is inserted through the caller's own session at line(s) ` +
      `${offenders.join(', ')}. That role no longer holds INSERT, so this is ` +
      `both a broken camera and — if the grant is ever handed back — every ` +
      `gate in recordSeatCapture becoming optional again.`,
  );
});

test('2 · the writer is the service role, and an unavailable one REFUSES', () => {
  const src = code();

  assert.equal(
    occurrences(src, /\bwriter = createAdminClient\(\)/g),
    1,
    'the capture writer is no longer resolved from createAdminClient()',
  );

  // The reads above this point fail OPEN on purpose — a config error must not
  // stop a wedding being photographed. The WRITE cannot: with the grant gone
  // there is no second path to fall through to.
  const block = src.slice(src.indexOf('writer = createAdminClient()'));
  const refusal = block.slice(0, block.indexOf('insertWithoutPoster'));
  assert.match(
    refusal,
    /return \{ ok: false, error: '[a-z_]+' \}/,
    'an unavailable admin client no longer returns a soft error — a silent ' +
      'fall-through here writes nothing and tells the camera it worked',
  );
});

test('3 · the credit reserve still runs BEFORE the row is written', () => {
  const src = code();
  // ⚠ ANCHORED ON THE QUOTED LITERAL, not the bare name. A first cut matched
  // the substring, so renaming the RPC to `…_splitX` — which is exactly how a
  // reserve gets orphaned — still matched and the rule passed green. Same
  // prefix trap as `f.event_dateX`.
  const reserve = src.indexOf("'papic_reserve_capture_split'");
  const write = src.indexOf("from('papic_photos')\n        .insert(");
  assert.ok(
    reserve > 0,
    'the credit reservation call is gone from recordSeatCapture — captures are ' +
      'free now, and nothing else in this file meters them',
  );
  assert.ok(write > 0, 'the papic_photos insert is gone from recordSeatCapture');
  assert.ok(
    reserve < write,
    'the photo is written before its credits are reserved — a failed reserve ' +
      'then leaves a photo nobody paid for',
  );
});
