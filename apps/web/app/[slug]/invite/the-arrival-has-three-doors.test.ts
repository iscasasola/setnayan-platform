/**
 * the-arrival-has-three-doors.test.ts — the invite link is an arrival, not a form.
 *
 * Owner, 2026-09-10: the invite link "finds/adds them on the list · adds their
 * information · then offers to sign up to link this event to their personal
 * account · and jump to the event hub after" — and then, the same day, "we do
 * not need 3": the email on the Reply door IS the account. So three doors:
 * Name · Reply · Enter (lib/invite-arrival.ts), and then the Event Hub.
 *
 * What each test below defends is a CLAIM a guest would feel if it broke, not a
 * shape of the source. Where the claim can be exercised as a function it is;
 * where it is a property of a server action it is read from the action's own
 * body, with comments stripped by the repo's one stripper.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  arrivalSteps,
  inviteEnterPath,
  inviteReplyPath,
  isInviteReturn,
  INVITE_RETURN,
} from '@/lib/invite-arrival';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

/** One exported function's body, so an unrelated redirect elsewhere cannot satisfy a test. */
function fn(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} is gone or renamed — update this test.`);
  const next = src.indexOf('\nexport ', start + 10);
  return src.slice(start, next === -1 ? undefined : next);
}

// ── 1 · the rail says where the guest is ───────────────────────────────────

test('the rail is Name · Reply · Enter on every door, with exactly one current', () => {
  for (const door of ['name', 'reply', 'enter'] as const) {
    const steps = arrivalSteps(door);
    assert.deepEqual(
      steps.map((s) => s.label),
      ['Name', 'Reply', 'Enter'],
      'a bead was added, dropped or renamed — beads are decisions, and a branch is a state of a bead, not a new one',
    );
    assert.equal(steps.filter((s) => s.current).length, 1, `${door}: exactly one bead is current`);
    const at = steps.findIndex((s) => s.current);
    steps.forEach((s, i) => {
      assert.equal(Boolean(s.done), i < at, `${door}: bead ${s.label} done-ness is wrong`);
    });
  }
  assert.equal(arrivalSteps('reply').findIndex((s) => s.current), 1);
});

// ── 2 · no form can steer a redirect ───────────────────────────────────────

test('only the exact keyword opts into the arrival — never a path, never a near-miss', () => {
  assert.equal(isInviteReturn(INVITE_RETURN), true);
  for (const junk of ['/evil.example', '//evil.example', 'Invite', ' invite', 'invite/', '', null, undefined, 1]) {
    assert.equal(isInviteReturn(junk), false, `${String(junk)} must not count as the keyword`);
  }
  assert.equal(inviteReplyPath('cale-ice'), '/cale-ice/invite/reply');
  assert.equal(inviteEnterPath('cale-ice'), '/cale-ice/invite/enter');
});

test('submitRsvp reads return_to only to ask "is it the keyword?", and addresses only the database slug', () => {
  const body = fn(read('[slug]/actions.ts'), 'submitRsvp');
  const reads = body.match(/formData\.get\('return_to'\)/g) ?? [];
  assert.equal(reads.length, 1, 'return_to is read more than once — one of them may be flowing into a redirect');
  assert.match(body, /isInviteReturn\(formData\.get\('return_to'\)\)/, 'return_to reaches something other than the keyword test');
  assert.match(body, /inviteEnterPath\(ev\.slug\)/, 'the Enter door is not addressed from the slug the database returned');
  assert.match(body, /inviteReplyPath\(evFail\.slug\)/, 'a failed save does not send the guest back to the Reply door');
});

test('the connect route compares `then` to the keyword and nothing else', () => {
  const src = read('join/[eventId]/connect/route.ts');
  assert.match(src, /searchParams\.get\('then'\) === CONNECT_THEN_REPLY/, 'then is no longer compared to the keyword');
  assert.doesNotMatch(src, /dest\s*=\s*[^;]*searchParams/, 'a destination is being built from the query string');
});

// ── 3 · the Name door asks one question ────────────────────────────────────

test('door 01 posts a name and nothing else — no role, no email', () => {
  const flow = read('join/[eventId]/_components/join-flow.tsx');
  assert.doesNotMatch(flow, /name="role"/, 'the role picker is back on the Name door (owner-locked 2026-06-25: role is the host’s)');
  assert.doesNotMatch(flow, /name="email"/, 'the Name door asks for an email again — the email lives on Reply, where it is the login');
  assert.match(flow, /name="name"/, 'the Name door has lost its one field');
});

test('no join action reads a role from the form, so a cached page cannot self-assign one', () => {
  const actions = read('join/[eventId]/actions.ts');
  assert.doesNotMatch(actions, /formData\.get\('role'\)/, 'a join action is reading `role` from the form again');
  assert.match(fn(actions, 'selfJoinAction'), /const role: GuestRole = 'guest';/);
  assert.match(fn(actions, 'joinEventAction'), /const role: GuestRole = 'guest';/);
});

// ── 4 · the doors lead on, in order ────────────────────────────────────────

test('an accountless guest who joins walks on to Reply, never straight onto the site', () => {
  const self = fn(read('join/[eventId]/actions.ts'), 'selfJoinAction');
  assert.doesNotMatch(
    self,
    /redirect\(`\/\$\{slug\}`\)/,
    'selfJoinAction sends a guest to the site before they have replied — the arrival ends before the part it exists for',
  );
  assert.match(self, /redirect\(inviteReplyPath\(slug\)\)/);
});

test('the Reply door saves through the arrival, and its card is the Event Hub’s own card', () => {
  const reply = read('[slug]/invite/reply/page.tsx');
  assert.match(reply, /<RsvpWidget[\s\S]*doorAction=\{submitInviteReply\.bind\(/, 'the Reply door no longer saves through the arrival');
  const wrap = fn(read('[slug]/invite/actions.ts'), 'submitInviteReply');
  assert.match(wrap, /formData\.set\('return_to', INVITE_RETURN\)/, 'the reply would land on the site instead of the Enter door');
  assert.match(wrap, /return submitRsvp\(eventId, guestId, formData\)/, 'the door writes the reply some other way than the site’s card does');
});

test('Enter hands the guest into the Event Hub — the couple’s site', () => {
  const enter = read('[slug]/invite/enter/page.tsx');
  assert.match(enter, /href=\{`\/\$\{home\}`\}/, 'the Enter door no longer opens the Event Hub');
});
