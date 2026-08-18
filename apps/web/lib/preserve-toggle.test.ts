/**
 * preserve-toggle.test.ts — the control that keeps one original at full size.
 *
 * 🔒 OWNER-LOCKED 2026-08-10: *"they can pick which one to preserve"* · *"if
 * nothing is picked, pick all."*
 *
 * These are structural assertions over the executed body of
 * `setCapturePreserved`, because a `'use server'` action importing
 * `next/navigation` cannot be imported into a unit test. Each one is scoped to
 * the function body with comments stripped — the docblock above the action names
 * every table and hazard it is checked for, and a whole-file grep would pass on
 * that prose alone. That mistake was made twice in this repo already.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const SRC = readFileSync(
  join(WEB, 'app/dashboard/[eventId]/studio/papic/actions.ts'),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

/** Just the body of `setCapturePreserved`, so a neighbour cannot satisfy a check. */
function body(): string {
  const start = SRC.indexOf('export async function setCapturePreserved');
  assert.notEqual(start, -1, 'setCapturePreserved is gone');
  const after = SRC.slice(start + 1);
  const next = after.indexOf('\nexport async function ');
  return next === -1 ? after : after.slice(0, next);
}

const FN = body();

test('it is couple-only — the same gate every other Papic action uses', () => {
  assert.match(
    FN,
    /getCoupleEventId\(/,
    'the preserve toggle stopped checking that the caller owns this wedding. A ' +
      'server action is a public HTTP endpoint; anyone signed in could release ' +
      "another couple's originals.",
  );
});

test('EVERY read and write is scoped to the event, not just the row id', () => {
  // Authorising one thing and acting on another is what left the run-of-show
  // gate open: the check ran on a caller-supplied id while the database resolved
  // a different one. Here the event id must appear on both statements.
  const eqEvent = FN.match(/\.eq\(\s*'event_id'\s*,\s*eventId\s*\)/g) ?? [];
  assert.ok(
    eqEvent.length >= 2,
    `only ${eqEvent.length} statement(s) scope to the event. A tampered capture ` +
      `id from another wedding must match ZERO rows, not write there.`,
  );
});

test('it routes to the table the capture actually lives in', () => {
  assert.match(FN, /source === 'seat' \? 'papic_photos' : 'papic_guest_captures'/);
  assert.match(FN, /source === 'seat' \? 'photo_id' : 'capture_id'/);
});

test('AN ALREADY-COMPRESSED ORIGINAL IS REFUSED, NOT SILENTLY MARKED', () => {
  // Re-including a capture whose original is gone cannot restore the resolution.
  // Accepting the tap and changing nothing is worse than saying no.
  assert.match(
    FN,
    /full_res_dropped_at[\s\S]{0,120}?already_compressed/,
    'the toggle no longer refuses a capture whose original has already been ' +
      'replaced, so a couple would tap "keep" and be told nothing — while the ' +
      'resolution stays gone forever',
  );
});

test('a failed read fails loudly — Supabase resolves {error}, it never throws', () => {
  assert.match(
    FN,
    /readErr[\s\S]{0,80}?preserve_error=unreadable/,
    'the read error is discarded again, so an unreadable row reads as "no such ' +
      'capture" and the tap silently does nothing',
  );
});

test('the intent is read explicitly, not inferred from an absent checkbox', () => {
  // An unticked checkbox posts NOTHING, so `formData.has('preserve')` cannot
  // tell "the couple unticked it" from "this form never asked" — which is how a
  // toggle inverts itself on a screen that renders it conditionally.
  assert.match(FN, /formData\.get\('preserve'\)[\s\S]{0,40}?===\s*'yes'/);
  assert.ok(
    !/formData\.has\(\s*'preserve'\s*\)/.test(FN),
    'reading the checkbox with .has() cannot distinguish unticked from never-rendered',
  );
});

test('every outcome comes back with something the screen can show', () => {
  for (const status of [
    'preserve_error=invalid',
    'preserve_error=not_found',
    'preserve_error=already_compressed',
    'preserve_set=',
  ]) {
    assert.ok(
      FN.includes(status),
      `"${status}" is gone. A refusal with nowhere to be seen is indistinguishable ` +
        `from one that succeeded — the loader finishes and the couple believes it worked.`,
    );
  }
});

test('the word "delete" never appears in this action', () => {
  // Declining preservation replaces an ORIGINAL with its compressed copy. The
  // photo is never deleted. The owner corrected that vocabulary twice, and the
  // wrong word here would eventually reach a screen.
  assert.ok(
    !/\bdelete\b/i.test(FN),
    'the preserve toggle mentions deleting. It compresses — the photo stays, ' +
      'kept for life for everyone, paid or not.',
  );
});
