/**
 * adding-is-a-handshake.test.ts — nothing on the People page can make a
 * connection by itself.
 *
 * Owner, 2026-08-21, after seeing the name search: *"it needs to be a handshake
 * for them to become friends like facebook."*
 *
 * ── WHY A SOURCE-LEVEL TEST, WHEN THE DATABASE ALREADY ENFORCES IT ─────────
 * `person_connections_transition_guard` refuses to let the declarer confirm
 * their own claim, and `person-connections-forgery.db.test.ts` proves it. That
 * is the floor and it holds.
 *
 * This file guards the floor ABOVE it: that no ADD PATH ever writes a row that
 * is already `confirmed`. The trigger only inspects UPDATEs — an INSERT that
 * arrives confirmed was never a transition, so it walks straight past the guard
 * that people assume covers this. There are three add paths today (by email, by
 * pick, and the event-generated proposals) and the next one will be written by
 * somebody who has not read any of this.
 *
 * If a fourth path appears and inserts `'confirmed'`, this file is what says so.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ACTIONS = join(__dirname, '..', 'app', 'dashboard', '(account)', 'people', 'actions.ts');

/** Every `status:` written into a person_connections insert in the People actions. */
function insertedStatuses(src: string): string[] {
  const out: string[] = [];
  // Bound each insert by its call, not by the whole file — a status literal
  // elsewhere in the module (a filter, a comparison) is not a write.
  const parts = src.split(".from('person_connections').insert(");
  for (const part of parts.slice(1)) {
    const body = part.slice(0, part.indexOf('})') + 1);
    const m = body.match(/status:\s*'([a-z_]+)'/);
    if (m) out.push(m[1]!);
  }
  return out;
}

test('the fixture is real — there ARE inserts to inspect', () => {
  // Vacuity: if the parse finds nothing, every assertion below passes for the
  // wrong reason.
  const statuses = insertedStatuses(readFileSync(ACTIONS, 'utf8'));
  assert.ok(statuses.length >= 2, `expected at least two add paths, found ${statuses.length}`);
});

test('🔴 every way of adding somebody starts as PENDING — never confirmed', () => {
  const statuses = insertedStatuses(readFileSync(ACTIONS, 'utf8'));
  for (const s of statuses) {
    assert.equal(
      s,
      'pending',
      `an add path inserts '${s}' — a connection that made itself, with no handshake`,
    );
  }
});

test('🔒 the word "confirmed" is never written by an ADD path', () => {
  // Belt and braces against a shape the parser above would miss — a spread, a
  // variable, a helper. `confirmed` may appear in this file (confirmConnection
  // sets it, and it is read in comparisons); what must never appear is an
  // insert carrying it.
  const src = readFileSync(ACTIONS, 'utf8');
  const inserts = src.split(".from('person_connections').insert(");
  for (const part of inserts.slice(1)) {
    const body = part.slice(0, part.indexOf('})') + 1);
    assert.ok(
      !body.includes('confirmed'),
      'an insert into person_connections mentions confirmed — adding must only ever ASK',
    );
  }
});

test('only the recipient’s action sets confirmed, and it demands a pending row', () => {
  const src = readFileSync(ACTIONS, 'utf8');
  const confirm = src.slice(src.indexOf('export async function confirmConnection'));
  const body = confirm.slice(0, confirm.indexOf('\nexport '));
  // to_person = me: the person the claim is ABOUT is the only one who can answer.
  assert.match(body, /\.eq\('to_person_id', myPerson\)/);
  // …and only while it is still a question.
  assert.match(body, /\.eq\('status', 'pending'\)/);
});
