/**
 * A PUBLISHED 3D PLAN CAN BE TAKEN BACK DOWN — and the couple can see which
 * state they are in.
 *
 * ── THE DEFECT THIS FENCES ──────────────────────────────────────────────────
 * `event_floor_plan.published_at IS NOT NULL` is the ONE condition
 * `public_venue_scene` checks before it serves the room, the tables, the booths
 * and which seats are taken to /[slug]/venue (20270224160000 § v_published — a
 * draft plan gets `{published:false}` and nothing else). `publishSeating`
 * stamped it. Measured on origin/main 2026-09-05: NOTHING in the tree ever
 * cleared it — the only other writers of that table are three geometry upserts
 * that do not carry the column at all. So publishing was a one-way door on the
 * couple's own reception, and the sole escape was flipping the whole
 * celebration to private, which also takes down their landing page.
 *
 * The second half was quieter and is the reason it went unnoticed for so long:
 * `page.tsx` had ALWAYS computed `published: floorPlan.published_at != null`
 * and shipped it to the client on `Lab3DFloor`, and the panel read it NOWHERE.
 * Both ends built, no wire. The couple's two possible states — nobody can see
 * this / anyone with the address can walk it — rendered identically, under one
 * button labelled "Publish" whose confirmation counted print sheets.
 *
 * 🔑 THE DISTINCTION THE FIX TURNS ON, and what this guard exists to keep:
 * taking the plan down clears the PUBLIC GATE ONLY. `event_tables.
 * qr_published_at` records that a table's sign sheet was run off; those signs
 * are already standing at the venue and their tokens are never re-rolled, so
 * un-stamping them would assert something untrue about the print pack in order
 * to undo something it has no bearing on. A guest scanning a printed sign still
 * finds their seat; what stops is the public 3D walk.
 *
 * Pure source reading — no three.js, no React, no DB (the lib/figure-rig.ts
 * discipline), so it runs in the same `tsx --test` sweep as everything else.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const ROOT = join(import.meta.dirname, '..');
const ACTIONS = 'app/dashboard/[eventId]/seating/actions.ts';
const HUD = 'app/dashboard/[eventId]/seating/lab/_components/seating-lab-3d.tsx';
const PAGE = 'app/dashboard/[eventId]/seating/lab/page.tsx';

const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

/** The body of a top-level `export async function <name>(` — from its own
 *  signature to the next line that begins in column zero with `}`. Slicing to
 *  "the next export" would run the window on into the NEXT function's code,
 *  which is how a guard ends up asserting against prose it was never aimed at. */
function functionBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = src.indexOf('\n}\n', start);
  assert.notEqual(end, -1, `${name} must be a closed function`);
  return src.slice(start, end + 3);
}

test('unpublishSeating exists and clears the public gate', () => {
  const body = functionBody(read(ACTIONS), 'unpublishSeating');

  // The write that actually reopens privacy. Anything else — a soft "hidden"
  // column, a status enum — would leave public_venue_scene still serving.
  assert.ok(
    /\.update\(\{\s*published_at:\s*null/.test(body),
    'unpublishSeating must UPDATE event_floor_plan.published_at to null',
  );
  assert.ok(
    body.includes("from('event_floor_plan')"),
    'unpublishSeating must write the table public_venue_scene reads',
  );
  assert.ok(
    body.includes(".eq('event_id', eventId)"),
    'unpublishSeating must scope its write to the one event',
  );
});

test('taking the plan down NEVER un-stamps the printed table signs', () => {
  const body = functionBody(read(ACTIONS), 'unpublishSeating');

  // The signs are physical objects already at the venue. Clearing their stamp
  // would claim the pack was never printed — an untrue statement about a
  // different subsystem, made to undo something it does not gate.
  assert.ok(
    !body.includes('qr_published_at'),
    'unpublishSeating must not touch event_tables.qr_published_at',
  );
  assert.ok(
    !body.includes("from('event_tables')"),
    'unpublishSeating must not write event_tables at all',
  );
});

test('publishSeating still stamps BOTH surfaces — the gate and the print pack', () => {
  // The inverse of the test above: take-down is deliberately narrower than
  // publish, and that asymmetry is only correct while publish is still the wide
  // one. If publish ever stopped stamping the gate, "Take it down" would be
  // offering to close a door nothing opens.
  const body = functionBody(read(ACTIONS), 'publishSeating');
  assert.ok(body.includes('qr_published_at'), 'publishSeating still stamps the sign sheets');
  assert.ok(body.includes('published_at: now'), 'publishSeating still opens the public gate');
});

test('the lab panel READS the published flag it is sent', () => {
  const page = read(PAGE);
  const hud = read(HUD);

  // The server half — it never stopped shipping this.
  assert.ok(
    page.includes('published: floorPlan.published_at != null'),
    'page.tsx must keep deriving `published` from the floor plan row',
  );

  // The wire that was missing. Count, do not first-match: `published` is a
  // common word in this file and an indexOf would happily land on the
  // publishSeating notice string and call the panel wired.
  const passes = hud.match(/published=\{floor\.published\}/g) ?? [];
  assert.equal(passes.length, 1, 'Hud must be handed floor.published exactly once');

  const reads = hud.match(/\bpublished \? /g) ?? [];
  assert.ok(
    reads.length >= 2,
    `the panel must branch on \`published\` (status + control); found ${reads.length}`,
  );
});

test('the panel offers the opposite action, and names both states', () => {
  const hud = read(HUD);

  assert.ok(
    hud.includes('onClick={published ? onUnpublish : onPublish}'),
    'the one button must swap action with the state, not sit beside a second one',
  );
  assert.ok(hud.includes("'Take it down'"), 'the live state must offer a way down');
  assert.ok(hud.includes("'Publish'"), 'the draft state must still offer a way up');

  // The status line. "Live" is the word that tells a couple strangers can walk
  // their reception; without it the dot is decoration.
  assert.ok(
    /Live — guests can walk your reception/.test(hud),
    'the live state must say what live MEANS',
  );
  assert.ok(
    /Draft — only you can see this/.test(hud),
    'the draft state must say who can see it',
  );

  // The promise unpublishSeating actually keeps, told to the person deciding.
  assert.ok(
    /Printed table signs keep working/.test(hud),
    'the take-down copy must say the print pack survives',
  );
});

test('publishing no longer describes itself as only a printing job', () => {
  const hud = read(HUD);
  // The shipped notice read "Published — N table QR sheets ready to print",
  // which is a true sentence about the smaller of the two things that happened.
  const notice = hud.slice(hud.indexOf('const publishPlan'), hud.indexOf('const unpublishPlan'));
  assert.ok(notice.length > 0, 'publishPlan must still precede unpublishPlan');
  assert.ok(
    /guests can walk your reception/.test(notice),
    'the publish confirmation must name the public walk it just opened',
  );
});
