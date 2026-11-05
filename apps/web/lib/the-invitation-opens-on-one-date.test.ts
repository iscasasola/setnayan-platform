/**
 * 📬 THE INVITATION OPENS ON ONE DATE — the film and the switch read the same one (owner 2026-10-14,
 * DECISION_LOG 📬 "RSVP GETS ITS OWN OPEN AND CLOSE", item 6).
 *
 * Measured before: the Save the Date film told guests "the invitation goes live on <the couple's
 * `std_invitation_launch_date`, else 3 months out>", and the page switched to the Invitation at 90
 * days of 24 hours on the server's clock, never reading the couple's date. Two dates for one event.
 *
 *   1 · the switch honours the couple's own date, on the venue's calendar, both ways;
 *   2 · with no date of their own it is 90 days out, by venue day — and the film says that same day;
 *   3 · EVERY call of `getLifecyclePhase` outside a test hands over the launch date (the whole tree is
 *       walked, so a new caller cannot forget it). A caller that only asks "is it editorial?" may pass
 *       `null` — the launch date cannot move that answer — and must say so by comparing to 'editorial'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLifecyclePhase } from './invitation-widgets';
import { invitationOpensOn, venueDayOf } from './invitation-opens-on';
import { defaultInvitationLaunchIso } from './save-the-date-content';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MNL = 'Asia/Manila';
const at = (iso: string) => Date.parse(iso);

test('1 · the couple’s own date opens the Invitation, on the venue’s calendar', () => {
  const day = '2027-06-12';
  // The couple chose 1 February — far earlier than 90 days out.
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-01-31T23:59:00+08:00'), '2027-02-01'), 'save_the_date', 'one minute before, still the Save the Date');
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-02-01T00:00:00+08:00'), '2027-02-01'), 'rsvp', 'Manila midnight — the Invitation');
  // 16:00 UTC on 31 Jan IS 00:00 on 1 Feb in Manila: the venue's clock, not the server's.
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-01-31T16:00:00Z'), '2027-02-01'), 'rsvp');
  // …and later than 90 days: the page waits for the couple's date.
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-04-01T12:00:00+08:00'), '2027-05-20'), 'save_the_date');
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-05-20T00:00:00+08:00'), '2027-05-20'), 'rsvp');
});

test('2 · no date of their own: 90 days out, by venue day — and the film names that same day', () => {
  const day = '2027-06-12';
  const opens = invitationOpensOn(day, null);
  assert.equal(opens, '2027-03-14');
  assert.equal(defaultInvitationLaunchIso(day), opens, 'the film’s automatic date is the switch’s date');
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-03-13T23:59:00+08:00'), null), 'save_the_date');
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-03-14T00:00:00+08:00'), null), 'rsvp');
  // The couple's date wins for the film too (the caller's `??`), and the switch reads it.
  assert.equal(invitationOpensOn(day, '2027-02-01'), '2027-02-01');
  assert.equal(venueDayOf(MNL, at('2027-01-31T16:00:00Z')), '2027-02-01');
  // The near-event and after-the-day answers do not move with the launch date.
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-06-10T12:00:00+08:00'), '2027-06-30'), 'rsvp', 'the run-up is the Invitation');
  assert.equal(getLifecyclePhase(day, MNL, null, at('2027-07-20T12:00:00+08:00'), '2027-02-01'), 'editorial');
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** The argument list of the call that opens at `open` (the index of its `(`), split at top-level commas. */
function argsAt(body: string, open: number): { args: string[]; end: number } {
  let depth = 0;
  let start = open + 1;
  const args: string[] = [];
  for (let i = open; i < body.length; i++) {
    const c = body[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) {
        const last = body.slice(start, i).trim();
        if (last) args.push(last);
        return { args, end: i + 1 };
      }
    } else if (c === ',' && depth === 1) {
      args.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  throw new Error('unbalanced call');
}

test('3 · every getLifecyclePhase call outside a test hands over the launch date', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  let calls = 0;
  const missing: string[] = [];
  for (const f of files) {
    const body = stripComments(readFileSync(f, 'utf8'));
    let from = 0;
    for (;;) {
      const i = body.indexOf('getLifecyclePhase(', from);
      if (i < 0) break;
      from = i + 1;
      // The definition itself.
      if (body.slice(Math.max(0, i - 16), i).includes('function ')) continue;
      calls++;
      const { args, end } = argsAt(body, i + 'getLifecyclePhase'.length);
      const where = `${relative(WEB, f)}: getLifecyclePhase(${args.join(', ').slice(0, 80)}…)`;
      const fifth = args[4] ?? '';
      if (/std_invitation_launch_date|invitationLaunchDate/.test(fifth)) continue;
      // Only an "is it editorial?" question may pass null — the launch date cannot move that answer.
      if (fifth === 'null' && /^\s*===\s*'editorial'/.test(body.slice(end, end + 40))) continue;
      missing.push(where);
    }
  }
  assert.ok(calls >= 10, `found only ${calls} calls — the walk is broken, not the tree clean`);
  assert.deepEqual(missing, [], 'these phase calls do not read the ONE date the Invitation opens');
});
