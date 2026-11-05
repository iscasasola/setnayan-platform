/**
 * A LOST ANSWER NEVER ERASES A SHOT.
 *
 * Re-review of #6849, 2026-10-24:
 *
 *   MAJOR 3 — the database can commit a capture row while its reply is lost on
 *   the way back. The route then saw "an error", deleted "this attempt's" final
 *   copy — the very copy the committed row names — and the phone's retry heard
 *   `duplicate ok` and let go of its own bytes. The shot was gone everywhere.
 *   Two rules now hold it:
 *     (a) an UNCLEAR failure (an error with no answer) discards nothing; only a
 *         DEFINITE refusal (the function answered no, the policy refused, a
 *         compare-and-set lost, the unique key said "already") does;
 *     (b) every delete of a final copy goes through deleteFinalIfUnreferenced,
 *         which keeps any key a capture row names, and fails closed.
 *
 *   MAJOR 5 — the REPLAYED record answer (after a lost first answer) said only
 *   "does the event keep full-res?", so a phone could forget a raw clip whose web
 *   copy was never verified. Both answers now ask the same question.
 *
 *   MINOR — "Release to Drive" recognises a thumbnail by its key's own name, so a
 *   failed thumb_r2_key patch cannot send a 320 px file as the shot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { recordedClipNeedsRaw } from '@/lib/papic-upload/mp4';
import { pointsAtAPreview } from '@/lib/papic-upload/tiers';

const WEB = process.cwd().endsWith('/apps/web') ? process.cwd() : join(process.cwd(), 'apps', 'web');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const GUEST = 'app/api/papic/guest-capture/route.ts';
const VENDOR = 'app/api/vendor/papic-capture/route.ts';
const INTENTS = 'lib/papic-upload-intents.server.ts';

/** The condition of the nearest `if (…)` that opens the block a call sits in. */
function guardOf(src: string, at: number): string {
  let depth = 0;
  for (let i = at; i >= 0; i--) {
    const ch = src[i];
    if (ch === '}') depth += 1;
    else if (ch === '{') {
      if (depth === 0) {
        const head = src.slice(Math.max(0, i - 240), i);
        const m = /if \(([^\n]*)\)\s*$/.exec(head);
        return m ? m[1]!.trim() : head.trim().split('\n').pop()!.trim();
      }
      depth -= 1;
    }
  }
  return '';
}

function discardGuards(rel: string): string[] {
  const src = read(rel);
  const out: string[] = [];
  const re = /await discardPromoted\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(guardOf(src, m.index));
  return out;
}

test('MAJOR 3 (a): copies are discarded only on a DEFINITE refusal — never on an unclear failure', () => {
  const DEFINITE = new Set([
    // guest record — the function ANSWERED
    "recordStatus === 'camera_points_exhausted'",
    "result.status !== 'ok'",
    'recordDuplicate',
    // supplier record
    "insErr?.code === '23505'",
    'rls',
    // attach — the compare-and-set wrote nothing, with no error
    '!updated || updated.length === 0',
  ]);
  for (const rel of [GUEST, VENDOR]) {
    const guards = discardGuards(rel);
    assert.ok(guards.length >= 3, `${rel}: the discard calls moved — re-point this guard`);
    for (const g of guards) {
      assert.ok(DEFINITE.has(g), `${rel}: discardPromoted under "${g}" — not a definite refusal`);
    }
  }
});

test('MAJOR 3 (a): the unclear branches — an RPC error, an insert error, an attach update error — discard nothing', () => {
  const g = read(GUEST);
  const rpcErr = g.slice(g.indexOf('if (error) {', g.indexOf("rpc('papic_record_guest_capture_and_spend'")));
  assert.doesNotMatch(rpcErr.slice(0, rpcErr.indexOf('return json(')), /discardPromoted/);
  for (const src of [g, read(VENDOR)]) {
    const upd = src.slice(src.indexOf('if (updErr) {'));
    assert.doesNotMatch(upd.slice(0, upd.indexOf('return json(')), /discardPromoted/, 'an attach update error discarded copies');
  }
  const v = read(VENDOR);
  const ins = v.slice(v.indexOf('if (insErr || !inserted) {'));
  const body = ins.slice(0, ins.indexOf('return json('));
  assert.match(body, /if \(rls\) \{\s*await discardPromoted\(/, 'only the policy refusal discards');
  assert.equal((body.match(/discardPromoted\(/g) ?? []).length, 1);
});

test('MAJOR 3 (b): a final copy is deleted ONLY through the reference check, which fails closed', () => {
  const src = read(INTENTS);
  // Every cleanupDelete in the module: the staging delete (staging keys only) and the reference-checked final delete.
  const owners: string[] = [];
  const re = /cleanupDelete\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const fn = src.lastIndexOf('export async function ', m.index);
    owners.push(/export async function (\w+)/.exec(src.slice(fn))![1]!);
  }
  assert.deepEqual([...new Set(owners)].sort(), ['deleteFinalIfUnreferenced', 'deleteStagingObject']);
  const del = src.slice(src.indexOf('export async function deleteFinalIfUnreferenced('));
  const check = del.indexOf("if (await refIsReferenced(admin, intent.lane, ref)) return 'kept';");
  assert.ok(check > -1, 'the reference check is gone');
  assert.ok(check < del.indexOf('cleanupDelete('), 'the reference check must come before the delete');
  const ref = src.slice(src.indexOf('export async function refIsReferenced('), src.indexOf('export async function deleteFinalIfUnreferenced('));
  assert.match(ref, /if \(error\) \{[\s\S]*?return true;/, 'a failed reference read must keep the object');
  for (const col of ['r2_object_key', 'display_r2_key', 'thumb_r2_key', 'tile_r2_key', 'poster_r2_key', 'clip_web_r2_key']) {
    assert.match(src, new RegExp(`'${col}'`), `${col} is not in the reference check`);
  }
  // discard, a prior attempt and the sweep all use it; nothing else deletes a final.
  const discard = src.slice(src.indexOf('export async function discardPromoted('));
  assert.match(discard.slice(0, 500), /await deleteFinalIfUnreferenced\(admin, i, ref\)/);
  const promote = src.slice(src.indexOf('export async function promoteTier('), src.indexOf('export function newAttemptTag('));
  assert.match(promote, /await deleteFinalIfUnreferenced\(admin, loaded\.intent, prior\)/, 'a prior unclear attempt is retired only if unreferenced');
  assert.ok(promote.indexOf('deleteFinalIfUnreferenced') < promote.indexOf(".update({ final_ref: finalRef })"), 'retire the prior BEFORE overwriting its memory');
  const sweep = read('lib/papic-upload-sweep.ts');
  assert.doesNotMatch(sweep, /\bcleanupDelete\(/, 'the sweep must delete finals only through deleteFinalIfUnreferenced');
  assert.match(sweep, /deleteFinalIfUnreferenced\(admin, r, ref\)/);
});

test('MAJOR 5: a recorded clip needs its raw until the row names a VERIFIED web copy', async () => {
  const web = 'r2://setnayan-media/papic/guest/g/cap-1-clip_web-a0123abcd.mp4';
  const raw = 'r2://setnayan-media/papic/guest/g/cap-1-clip_raw-a0123abcd.mp4';
  const probes: string[] = [];
  const probe = (ms: number | null) => async (ref: string) => (probes.push(ref), ms);
  assert.equal(await recordedClipNeedsRaw({ media_type: 'clip', r2_object_key: web }, probe(null)), true, 'unreadable web copy');
  assert.equal(await recordedClipNeedsRaw({ media_type: 'clip', r2_object_key: web }, probe(100)), true, 'too short to be the clip');
  assert.equal(await recordedClipNeedsRaw({ media_type: 'clip', r2_object_key: web }, probe(8000)), false, 'verified');
  probes.length = 0;
  assert.equal(await recordedClipNeedsRaw({ media_type: 'clip', r2_object_key: raw }, probe(null)), false, 'the row already holds the raw');
  assert.equal(await recordedClipNeedsRaw({ media_type: 'photo', r2_object_key: web }, probe(null)), false);
  assert.deepEqual(probes, [], 'no probe when the answer is already known');
});

test('MAJOR 5: the replayed record answer asks the SAME question as the first one', () => {
  const g = read(GUEST);
  const dup = g.slice(g.indexOf('if (prior?.capture_id) {'), g.indexOf('const isClip = mediaType ==='));
  assert.match(dup, /wantFull: \(await eventKeepsFullRes\(admin, session\.event_id\)\) \|\| \(await rowNeedsRaw\(prior\)\)/);
  assert.match(g, /const wantFull = \(await eventKeepsFullRes\(admin, session\.event_id\)\) \|\| !webVerified;/);
  const helper = g.slice(g.indexOf('async function rowNeedsRaw('), g.indexOf('async function handleRecord('));
  assert.match(helper, /recordedClipNeedsRaw\(prior,/);
});

test('MINOR: "Release to Drive" knows a thumbnail by its own name — even when thumb_r2_key was never written', () => {
  const thumb = 'r2://setnayan-media/papic/guest/g/cap-1-thumb-a0123abcd.webp';
  const tile = 'r2://setnayan-media/papic/guest/g/cap-1-tile.webp';
  const display = 'r2://setnayan-media/papic/guest/g/cap-1-display-a0123abcd.webp';
  assert.equal(pointsAtAPreview(thumb, [null]), true, 'patch failed: still recognised');
  assert.equal(pointsAtAPreview(tile, [null, null]), true);
  assert.equal(pointsAtAPreview(display, [thumb]), false);
  assert.equal(pointsAtAPreview('r2://setnayan-media/papic/seat/x.jpg', ['r2://setnayan-media/papic/seat/x.jpg']), true, 'equal to its own preview column');
  assert.equal(pointsAtAPreview(null, []), true, 'no key is not a deliverable');
});
