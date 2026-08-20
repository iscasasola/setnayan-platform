/**
 * THE INVITATION CLOSES WHEN THE GUEST LIST IS FINAL (owner 2026-08-20).
 *
 * Two halves, because two different things can break and only one of them is
 * visible in source:
 *
 *   1. RENDERED — `RsvpClosedNote` really emits the sentence, and really emits
 *      the refusal flash it was given. The flash is the load-bearing one: the
 *      `?rsvp=closed` message has always been drawn by `RsvpWidget`, the very
 *      component that is GONE by the time this note is on screen. Drop the
 *      prop and a guest taps Save, the page returns looking identical, and
 *      nothing anywhere says the reply was refused.
 *
 *   2. WIRED — `site-body.tsx` gates every RSVP form on `plan.rsvpAskOpen` and
 *      mounts the note in both arms WITH the flash. A source read is the only
 *      tool for this: the body is a 2000-line async server component that
 *      cannot be rendered in this runner.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — the repo's tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`
 * with no import of their own, and a STATIC import is hoisted above the
 * assignment and throws. Same idiom as byline-renders-as-a-door.test.ts.
 *
 * ⚠ PROOF ABOUT STRUCTURE, NOT A LIVE OBSERVATION. No production event has a
 * finalized guest list that I could read this session (the database was
 * unreachable), so nothing here has been seen on the live site.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

const HONOREE = { ...WORDS, organizer: 'celebrant', theOrganizer: 'the celebrant', TheOrganizer: 'The celebrant', theOrganizerPossessive: 'the celebrant’s', TheOrganizerPossessive: 'The celebrant’s', eventWord: 'birthday', organizerIsHonoree: true };

async function renderNote(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpClosedNote } = await import('../_components/rsvp-closed-note');
  return renderToStaticMarkup(
    React.createElement(RsvpClosedNote, props as never),
  );
}

test('the closed note says replies are closed, and whose list it is', async () => {
  const html = await renderNote({ words: WORDS, replied: false });
  assert.match(html, /Replies are closed/);
  assert.match(html, /The couple’s guest list is final/);
});

test('an event whose word names the HONOURED person does not credit them with the door', async () => {
  // A seven-year-old celebrant did not run the guest list. Same ruling the
  // other admin sentences follow (see _lib/event-words.ts).
  const html = await renderNote({ words: HONOREE, replied: false });
  assert.match(html, /The guest list is final/);
  assert.doesNotMatch(html, /celebrant’s guest list/);
});

test('a guest who never replied is pointed somewhere, not left at a dead end', async () => {
  const html = await renderNote({ words: WORDS, replied: false });
  assert.match(html, /reach out to the couple directly/);
});

test('a guest who already replied is told their answer stands', async () => {
  const html = await renderNote({ words: WORDS, replied: true });
  assert.match(html, /Your answer is in/);
  // …and is NOT told to go chase the couple about plans that have not changed.
  assert.doesNotMatch(html, /reach out to the couple directly/);
});

test('the refusal flash is rendered by the note, as an alert', async () => {
  const html = await renderNote({
    words: WORDS,
    replied: false,
    flash: { tone: 'error', text: 'Replies have closed — not saved.' },
  });
  assert.match(html, /Replies have closed — not saved\./);
  assert.match(html, /role="alert"/);
});

test('no flash renders no alert region', async () => {
  const html = await renderNote({ words: WORDS, replied: false });
  assert.doesNotMatch(html, /role="alert"/);
});

// ---------------------------------------------------------------------------
// The wiring half.
// ---------------------------------------------------------------------------

function body(): string {
  return readFileSync(
    join(__dirname, '..', '_components', 'site-body.tsx'),
    'utf8',
  );
}

function count(hay: string, needle: string): number {
  return hay.split(needle).length - 1;
}

test('every RSVP form in the body sits behind the ask gate', () => {
  const src = body();
  const forms = count(src, '<RsvpWidget');
  const gates = count(src, 'plan.rsvpAskOpen');
  assert.ok(forms > 0, 'the body renders no RSVP form at all — read this file');
  assert.ok(
    gates >= forms,
    `${forms} RSVP form mount(s) but only ${gates} rsvpAskOpen gate(s) — a form escaped the closure`,
  );
});

test('the closed note is mounted in BOTH arms, and always with the flash', () => {
  const src = body();
  const mounts = count(src, '<RsvpClosedNote');
  assert.equal(
    mounts,
    2,
    `expected 2 RsvpClosedNote mounts (replied + never-replied), found ${mounts}`,
  );
  // Every mount carries the flash. A mount without it is a refusal the guest
  // can never see — the exact failure this component's docblock names.
  const withFlash = src
    .split('<RsvpClosedNote')
    .slice(1)
    .filter((tail) => tail.slice(0, 120).includes('flash={rsvpFlash}')).length;
  assert.equal(
    withFlash,
    mounts,
    `${mounts - withFlash} RsvpClosedNote mount(s) drop the flash — the refusal would be invisible`,
  );
});

test('the guest card stops nudging a guest who can no longer reply', () => {
  const src = body();
  assert.match(
    src,
    /<GuestHubCard[^>]*guestListClosed=\{plan\.guestListClosed\}/,
    'GuestHubCard is not told the list closed — it keeps asking for a confirmation the database refuses',
  );
});

test('the RSVP action refuses a late reply itself', () => {
  // The hidden form is not the door. This action runs with the ADMIN client,
  // and `guard_guest_edits_when_locked` exempts service_role — so the database
  // will NOT stop a late write. This check is the enforcement.
  const src = readFileSync(join(__dirname, '..', 'actions.ts'), 'utf8');
  const submit = src.slice(src.indexOf('export async function submitRsvp'));
  const guardAt = submit.indexOf('guestListIsClosed');
  const writeAt = submit.indexOf(".from('guests')");
  assert.ok(guardAt > -1, 'submitRsvp does not check whether the list is closed');
  assert.ok(
    guardAt < writeAt,
    'the closed-list check runs AFTER the write — the late reply is already saved',
  );
  assert.match(submit, /rsvp=closed/, 'the refusal is silent — nothing tells the guest');
});
