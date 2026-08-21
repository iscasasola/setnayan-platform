/**
 * ONLY THE ANSWER FREEZES (owner 2026-08-20).
 *
 * Owner: *"the goal of the invitation link is to update the guests info and
 * see who will go and not go"* — and *"they can preview the event hub"*. Three
 * jobs. Finalizing the guest list settles ONE of them. The reply card must
 * keep doing the other two.
 *
 * 🔑 THE FIRST BUILD OF THIS FEATURE HID THE WHOLE CARD, and that was wrong in
 * the most expensive direction: the card is not a headcount. It carries the
 * answer · the selfie that makes their photos findable · their meal · their
 * dietary notes · a note to the host. The list finalizes about TWO WEEKS
 * before the day — precisely when "nut allergy" and "vegetarian" matter most.
 * The database had drawn the line correctly all along (its post-lock guard
 * blocks only count-affecting writes and lets meal / photo / seating through);
 * the screen had not.
 *
 * So every assertion below is about the line being in the RIGHT place: the
 * answer frozen, everything else still reachable and still saved.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`
 * with no import of their own, and a STATIC import is hoisted above the
 * assignment and throws.
 *
 * ⚠ PROOF ABOUT STRUCTURE, NOT A LIVE OBSERVATION. No production event has a
 * finalized guest list with guests on a public page, so none of this has been
 * seen on the live site.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

/**
 * 🪤 `server-only` IS NOT AN INSTALLED PACKAGE — Next's bundler provides it, and
 * at runtime it is a no-op marker whose entire job is to THROW if it is ever
 * pulled into a client bundle. The reply card imports its server action, which
 * imports the fault log, which imports the marker, so this runner cannot even
 * load the component without a stub. Stubbing it changes no behaviour under
 * test; the real boundary is enforced by `lint-server-only-boundary.mjs`, which
 * runs in CI and is not weakened here.
 */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
};

function guest(over: Record<string, unknown> = {}) {
  return {
    guest_id: 'g-1',
    first_name: 'Ana',
    last_name: 'Cruz',
    display_name: 'Ana Cruz',
    rsvp_status: 'attending',
    meal_preference: 'chicken',
    dietary_restrictions: 'nut allergy',
    guest_note: null,
    qr_token: 't',
    photo_source: null,
    photo_url: null,
    ...over,
  };
}

async function render(replyLocked: boolean, over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpWidget } = await import('../_components/rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(RsvpWidget as never, {
      words: WORDS,
      guest: guest(over),
      eventId: 'e-1',
      eventPublicId: 'S89E-XXXX',
      faceMode: 'mode_b',
      replyLocked,
    } as never),
  );
}

// ---- The answer freezes ----------------------------------------------------

test('an open list renders the three choices', async () => {
  const html = await render(false);
  assert.match(html, /name="rsvp_status"/);
  assert.match(html, /Joyfully accepts/);
});

test('a final list renders NO answer control at all', async () => {
  // Not disabled — ABSENT. A disabled input still posts nothing but invites the
  // tap; more importantly an absent one cannot be re-enabled from the console.
  const html = await render(true);
  assert.doesNotMatch(html, /<input[^>]*name="rsvp_status"/);
  assert.doesNotMatch(html, /Joyfully accepts/);
  // Not even as dead CSS: the reveal rule's selector was the last text in the
  // markup naming the control, which reads to any scan like a live one.
  assert.doesNotMatch(html, /rsvp_status/);
});

test('a final list still tells them what they said, and why it is stuck', async () => {
  assert.match(await render(true), /You said you are coming\./);
  assert.match(
    await render(true, { rsvp_status: 'declined' }),
    /You said you cannot make it\./,
  );
  assert.match(
    await render(true, { rsvp_status: 'pending' }),
    /No reply was received from you\./,
  );
  assert.match(await render(true), /guest list is final/);
});

// ---- Everything else stays open — THE POINT OF THIS FILE -------------------

test('a final list keeps the meal, the allergy box and the note editable', async () => {
  const html = await render(true);
  for (const field of ['meal_preference', 'dietary_restrictions', 'guest_note']) {
    assert.match(
      html,
      new RegExp(`(name|id)="${field}"`),
      `${field} is gone once the list is final — the caterer's last fortnight is exactly when it is needed`,
    );
  }
  // Their existing values are still there to edit, not blanked.
  assert.match(html, /nut allergy/);
});

test('a coming guest keeps the selfie step when the list is final', async () => {
  // 🪤 The selfie is revealed by `:has(rsvp_status=attending:checked)`. With no
  // radio rendered that selector can NEVER match, so the step would silently
  // vanish for exactly the guests who are coming.
  const open = await render(false);
  const locked = await render(true);
  const marker = /selfie|Selfie/;
  assert.match(open, marker);
  assert.match(locked, marker, 'the selfie step vanished once the answer locked');
});

test('a guest who is NOT coming gets no selfie step', async () => {
  const html = await render(true, { rsvp_status: 'declined' });
  assert.doesNotMatch(html, /selfie_ref/);
});

test('the button stops claiming to save an RSVP it cannot change', async () => {
  assert.match(await render(false), /Save RSVP/);
  assert.match(await render(true), /Save details/);
  assert.doesNotMatch(await render(true), /Save RSVP/);
});

// ---- The wiring ------------------------------------------------------------

function read(...parts: string[]): string {
  return readFileSync(join(__dirname, '..', ...parts), 'utf8');
}
function count(hay: string, needle: string): number {
  return hay.split(needle).length - 1;
}

test('every reply card in the body is told whether the answer is frozen', () => {
  const src = read('_components', 'site-body.tsx');
  const forms = count(src, '<RsvpWidget');
  const told = count(src, 'replyLocked={plan.guestListClosed}');
  assert.ok(forms > 0, 'the body renders no reply card at all — read this file');
  assert.equal(
    told,
    forms,
    `${forms - told} reply card(s) never learn the list is final — they would take an answer the count has already frozen`,
  );
});

test('the body no longer hides the card — that was the defect', () => {
  const src = read('_components', 'site-body.tsx');
  assert.doesNotMatch(
    src,
    /RsvpClosedNote|rsvpAskOpen/,
    'the card is being hidden again; hiding it takes the meal and allergy box with it',
  );

  // 🔑 THE ABOVE IS NOT ENOUGH, and the mutation run proved it: wrapping a
  // mount in ANY condition re-creates the original defect while leaving both
  // banned identifiers absent and the mount count unchanged. The realistic
  // regression is a future session re-reading the owner's first sentence
  // ("only show while the guest list is not yet finalized") and gating the
  // card on it again.
  //
  // So each mount's GOVERNING syntax is pinned. Only two predecessors are
  // legal: the disclosure drawer, and the else-arm of the answered/unanswered
  // fork. Anything else — a `&&`, a ternary, an early return — fails here.
  //
  // ⚠ THIS IS DELIBERATELY BRITTLE. A genuine restructure of the RSVP section
  // fails this test, and that is the point: it is the moment a person should
  // confirm the card still renders for a finalized list. Update the pins, do
  // not delete the check.
  const LEGAL_PREDECESSORS = ['<div className="mt-4">', ') : ('];
  // ⚠ EVERY part here governs a mount. `split` yields N+1 parts for N mounts;
  // dropping the LAST one (the text after the final mount) leaves exactly the
  // N predecessors — part 0 governs mount 1. An earlier cut of this loop
  // skipped part 0 as "the preamble", which left the drawer mount UNCHECKED,
  // and a sabotage wrapping it in a condition passed. Measured, not reasoned.
  const mounts = src.split('<RsvpWidget').slice(0, -1);
  assert.ok(mounts.length > 1, 'expected at least one reply-card mount');
  for (const [i, before] of mounts.entries()) {
    const tail = before
      .replace(/\/\*[\s\S]*?\*\//g, '') // strip block comments
      .replace(/\s+/g, ' ')
      .trimEnd();
    assert.ok(
      LEGAL_PREDECESSORS.some((p) => tail.endsWith(p)),
      `reply card #${i + 1} is governed by "${tail.slice(-80)}" — a condition around this mount hides the guest's meal, allergy box and selfie along with the answer`,
    );
  }
});

test('the action drops the ANSWER and saves the rest', () => {
  const src = read('actions.ts');
  const submit = src.slice(src.indexOf('export async function submitRsvp'));
  const callAt = submit.indexOf('guestListIsClosed(');
  assert.ok(callAt > -1, 'submitRsvp never asks whether the list is final');

  const update = submit.slice(submit.indexOf('.update({', callAt));
  const body = update.slice(0, update.indexOf('.eq('));

  // The answer is conditional on the lock…
  assert.match(
    body,
    /replyLocked[\s\S]*rsvp_status/,
    'rsvp_status is written unconditionally — a closed list would still move the count',
  );
  // …and the details are NOT.
  for (const field of ['meal_preference', 'dietary_restrictions', 'guest_note']) {
    const line = body.split('\n').find((l) => l.includes(`${field}:`));
    assert.ok(line, `${field} is no longer written at all`);
    assert.doesNotMatch(
      line!,
      /replyLocked|\?/,
      `${field} is gated on the lock — a final list would stop saving it`,
    );
  }
});

test('the action tells a guest which half of their save landed', () => {
  const src = read('actions.ts');
  const submit = src.slice(src.indexOf('export async function submitRsvp'));
  assert.match(submit, /rsvp=\$\{outcome\}/, 'the outcome is not carried back to the page');
  assert.match(submit, /'refused'/);
  assert.match(submit, /'details'/);

  // And the page has somewhere for each to be shown. A refusal with no
  // renderer is indistinguishable from a save that worked.
  const page = read('page.tsx');
  for (const outcome of ['details', 'refused']) {
    assert.match(
      page,
      new RegExp(`search\\.rsvp === '${outcome}'`),
      `nothing renders the "${outcome}" outcome — the guest is never told`,
    );
  }
});

test('a stale tab reposting the SAME answer is not called a refusal', () => {
  // Otherwise an ordinary details save from a tab opened before the deadline
  // alarms the guest with "your reply was not changed" when nothing changed.
  const src = read('actions.ts');
  const submit = src.slice(src.indexOf('export async function submitRsvp'));
  const block = submit.slice(submit.indexOf('answerRefused'));
  assert.match(
    block.slice(0, 900),
    /rsvp_status !== status|status !== [\w.!]*rsvp_status/,
    'answerRefused does not compare against the STORED answer',
  );
});

// ── THE HOST IS TOLD WHAT MOVED (2026-08-21) ────────────────────────────────

/** Strip comments before matching source. A note that NAMES the pattern it
 *  forbids satisfies a raw search — that has produced both false passes and,
 *  in this very file's history, a false FAILURE. */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('🔴 the notification no longer keys on the ANSWER', () => {
  // It fired only on `attending` / `declined`. After the list is final the
  // answer control is not rendered, so `status` arrives EMPTY — an allergy
  // typed twelve days out reached nobody. Every `maybe` was silent too.
  // ⚠ Do NOT locate the gate with `lastIndexOf('if (')` before the emit — the
  // body between them is full of `if (changed.includes(...))` and the dedupe
  // check, so that finds the nearest one, not the gate. Assert on the shapes.
  const src = stripComments(read('actions.ts'));
  assert.doesNotMatch(
    src,
    /if \(status === 'attending' \|\| status === 'declined'\)/,
    'the notify gate keys on the answer again — the post-lock allergy is silent',
  );
  assert.match(
    src,
    /if \(answerChanged \|\| changed\.length > 0\) \{/,
    'the change-driven gate is gone',
  );
});

test('a refused answer is never reported as a reply that moved', () => {
  const src = read('actions.ts');
  assert.match(
    src,
    /const answerChanged = !replyLocked && before\?\.rsvp_status !== status;/,
    'answerChanged lost its !replyLocked guard — a stale tab would be reported as a reply',
  );
});

test('the notification is driven by a comparison, not by the write', () => {
  const src = read('actions.ts');
  assert.match(src, /guestDetailsChanged\(before, \{ meal, dietary, guestNote \}\)/);
  // The "before" read must be a SELECT. A .update( here retargets the guard
  // above onto the wrong statement.
  const beforeBlock = src.slice(src.indexOf('const { data: before }'), src.indexOf('let answerRefused'));
  assert.match(beforeBlock, /\.select\(/);
  assert.doesNotMatch(beforeBlock, /\.update\(/);
});

test("an UNDECIDED guest is never reported to the couple as a NO", () => {
  const src = read('actions.ts');
  assert.match(src, /: 'undecided';/, "'maybe' reaches the notification now and must not be labelled 'not attending'");
});

test('🔒 the dietary value is named, never quoted into an inbox', () => {
  // Compliance records dietary notes as data that may reveal health or
  // religious belief. The deep link keeps the words inside the app.
  const src = read('actions.ts');
  const emit = src.slice(src.indexOf('const parts: string[]'), src.indexOf('relatedUrl:'));
  assert.match(emit, /Their dietary notes changed\./);
  assert.doesNotMatch(emit, /\$\{dietary\}/, 'the allergy text is being pasted into a notification body');
});

test('the couple is not told the same thing twice', () => {
  const src = read('actions.ts');
  const loop = src.slice(src.indexOf("member_type', 'couple')"), src.indexOf('relatedUrl:'));
  assert.match(loop, /seen\.has/, 'two membership rows for one person would notify them twice');
});
