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
    email: null,
    mobile: null,
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
  // Bound by STRUCTURE, not by characters: this pinned the argument list on ONE
  // line, so adding a field reformatted the call and the guard failed for a
  // reason that had nothing to do with what it protects.
  const at = src.indexOf('guestDetailsChanged(before');
  assert.ok(at > -1, 'the comparison is no longer fed the "before" snapshot');
  const call = src.slice(at, src.indexOf('}', src.indexOf('{', at)));
  for (const field of ['meal', 'dietary', 'guestNote', 'email', 'mobile', 'displayName']) {
    assert.ok(call.includes(field), `${field} is written but never compared — the host is not told it moved`);
  }
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

// 🪤 THE SLICE BOUNDS BELOW OMIT THE COLON ON PURPOSE — DO NOT "TIDY" IT BACK.
// `lint-email-links.mjs` scans lib/ and app/ for the notification field name
// immediately followed by a quote, and resolves whatever comes next as a route.
// Writing that needle out in full is exactly that shape, so the guard read these
// two assertions as two shipped email links to a page that does not exist and
// failed CI. Dropping the colon leaves the slice at the same character position
// with no false positive. (Third time this session a COMMENT satisfied a pattern
// match — this one included, on its first draft.)
test('🔒 the dietary value is named, never quoted into an inbox', () => {
  // Compliance records dietary notes as data that may reveal health or
  // religious belief. The deep link keeps the words inside the app.
  const src = read('actions.ts');
  const emit = src.slice(src.indexOf('const parts: string[]'), src.indexOf('relatedUrl'));
  assert.match(emit, /Their dietary notes changed\./);
  assert.doesNotMatch(emit, /\$\{dietary\}/, 'the allergy text is being pasted into a notification body');
});

test('the couple is not told the same thing twice', () => {
  const src = read('actions.ts');
  const loop = src.slice(src.indexOf("member_type', 'couple')"), src.indexOf('relatedUrl'));
  assert.match(loop, /seen\.has/, 'two membership rows for one person would notify them twice');
});

test("⚠ a REMOVED note is not announced as a note", () => {
  // The dietary branch had always answered set-or-cleared. The note branch did
  // not: deleting a note told the couple "They left you a note", and the page
  // they opened was empty. A trip made for nothing, and the second time it
  // teaches them to ignore the notification.
  const src = read('actions.ts');
  const at = src.indexOf("changed.includes('note')");
  assert.ok(at > -1, 'the note branch is gone');
  const branch = src.slice(at, at + 220);
  assert.match(branch, /guestNote \?/, 'the note branch does not ask whether there IS a note');
  assert.match(branch, /removed their note/, 'there is no sentence for a note that was deleted');
});

test('⚠ every reported change produces a sentence — no heading with nothing under it', () => {
  // `changed` can only hold meal / dietary / note. If any branch is conditional
  // on the VALUE rather than on membership, a guest clearing that field sends the
  // couple a notification whose whole content is "Ana updated their details" —
  // a change they can only discover by opening the app and hunting for it.
  const src = read('actions.ts');
  const at = src.indexOf('const parts: string[]');
  assert.ok(at > -1, 'the notification body block moved');
  const block = src.slice(at, src.indexOf('coupleMembers', at));
  for (const field of ['meal', 'dietary', 'note']) {
    const i = block.indexOf(`changed.includes('${field}')`);
    assert.ok(i > -1, `${field} no longer produces a sentence at all`);
    const cond = block.slice(i, i + 60);
    assert.doesNotMatch(
      cond,
      /&&/,
      `the ${field} sentence is gated on its VALUE, so clearing ${field} sends a heading with an empty body`,
    );
  }
  // Vacuity: the slice must really contain the block, not an empty string.
  assert.ok(block.length > 200, 'the parts block slice came back empty — this guard proves nothing');
});

// ── THE GUEST FILLS THEIR OWN DETAILS ───────────────────────────────────────
//
// Owner, 2026-08-21, pointing at the host's guest page: "these are all the
// information we want to fill up." That page carries Email, Mobile and Display
// name — and NOTHING anywhere in the product let a guest supply any of them, so
// a host without a number had to leave the app and go and ask.

test('🔴 the reply card asks for the three details only the guest knows', () => {
  const w = read('_components/rsvp-widget.tsx');
  for (const id of ['contact_email', 'contact_mobile', 'contact_display_name']) {
    assert.match(w, new RegExp(`id="${id}"`), `${id} is gone — the host has to go and ask again`);
  }
});

test('🔒 the field names cannot collide with the sign-in box on the same page', () => {
  // That box posts `email` to claimAccountAction, a completely different action
  // that emails a sign-in link. Two fields named `email` on one page is how a
  // contact detail ends up in the wrong action's FormData.
  const w = read('_components/rsvp-widget.tsx');
  assert.doesNotMatch(w, /id="email"/, 'the contact email is named `email` again');
  assert.doesNotMatch(w, /name="email"/, 'the contact email is named `email` again');
});

test('🔒 the guest still cannot rename WHO THEY ARE', () => {
  // The link that reaches this card is printed on a poster. A stranger who can
  // rename a seat-holder is the exact harm seedBindAllowed was hardened against
  // on 2026-08-01. What to CALL you is a label; who you ARE is not.
  const w = read('_components/rsvp-widget.tsx');
  assert.doesNotMatch(w, /id="first_name"/);
  assert.doesNotMatch(w, /id="last_name"/);
  const src = read('actions.ts');
  const at = src.indexOf('.update({');
  const payload = src.slice(at, src.indexOf('.eq(', at));
  assert.doesNotMatch(payload, /first_name/, 'the guest can now rewrite their own legal name');
  assert.doesNotMatch(payload, /last_name/, 'the guest can now rewrite their own legal name');
});

test('⚠ the contact details are NOT frozen when the guest list closes', () => {
  // Only the ANSWER freezes (owner 2026-08-20). A phone number corrected the
  // week of the event is worth more then than at any other time.
  const src = read('actions.ts');
  const at = src.indexOf('.update({');
  const payload = src.slice(at, src.indexOf('.eq(', at));
  const locked = payload.slice(payload.indexOf('replyLocked'), payload.indexOf('}),'));
  for (const col of ['email:', 'mobile:', 'display_name:']) {
    assert.ok(payload.includes(col), `${col} is not written at all`);
    assert.ok(!locked.includes(col), `${col} is inside the frozen branch — a locked list would refuse it`);
  }
});

test('🔴 the guest-side restamp was fixed too, not just the host one', () => {
  // Every field on this card is defaultValue=, so a guest correcting a phone
  // number reposts the answer they already gave. That used to restamp it as a
  // fresh reply — the guest-side twin of the host bug fixed the same day.
  const src = read('actions.ts');
  const at = src.indexOf('rsvp_responded_at:');
  assert.ok(at > -1, 'the stamp is gone');
  const expr = src.slice(at, src.indexOf('}),', at));
  assert.match(expr, /before\?\.rsvp_status === status/, 'an unchanged answer is restamped as a fresh reply');
  assert.match(expr, /before\?\.rsvp_responded_at/, 'an unchanged answer does not keep its own date');
  // …and the value it leans on must actually be selected.
  assert.match(
    src,
    /\.select\('rsvp_status, rsvp_responded_at,/,
    'the prior date is not read — the expression above reads undefined',
  );
});

test('every reported change produces a sentence, and no branch is neutered', () => {
  // 🪤 THE FIRST DRAFT OF THIS GUARD WAS DECORATION. It asserted the string
  // `changed.includes('mobile')` was PRESENT — so rewriting the branch as
  // `if (false && changed.includes('mobile'))` left it GREEN while the couple
  // was never told a number had moved. A guard can match a string and not the act.
  const src = read('actions.ts');
  const at = src.indexOf('const parts: string[]');
  assert.ok(at > -1, 'the notification body block moved');
  const block = src.slice(at, src.indexOf('coupleMembers', at));
  assert.ok(block.length > 400, 'the parts slice came back short — this guard proves nothing');
  for (const field of ['meal', 'dietary', 'note', 'email', 'mobile', 'name']) {
    const i = block.indexOf(`changed.includes('${field}')`);
    assert.ok(i > -1, `${field} moves and the couple is told nothing`);
    // Read the WHOLE condition, from `if (` to `)`, and require it to be the
    // membership test alone — no `&&` on a value, no `false`, no negation.
    const openIf = block.lastIndexOf('if (', i);
    const cond = block.slice(openIf + 4, block.indexOf(')', i) + 1);
    assert.equal(
      cond.trim(),
      `changed.includes('${field}')`,
      `the ${field} sentence is gated on something beyond membership — clearing ${field} sends a heading with an empty body`,
    );
  }
});

test('🔒 a phone number and an email are NAMED, never quoted into an inbox', () => {
  // The same line already drawn on dietary notes: contact data stays in the app.
  const src = read('actions.ts');
  const at = src.indexOf('const parts: string[]');
  const block = src.slice(at, src.indexOf('coupleMembers', at));
  assert.doesNotMatch(block, /\$\{contactEmail\}/, 'an email address is being pasted into a notification');
  assert.doesNotMatch(block, /\$\{contactMobile\}/, 'a phone number is being pasted into a notification');
});

test("🔴 the guest's own row carries the details the card prefills from", () => {
  // 🪤 Deleting `email, mobile` from the guest select left every guard green.
  // The card would then fall back to the ACCOUNT profile — and a cookie-only
  // guest has no account, so their stored number renders as an empty box. They
  // press Save and it is written away. A prefill that silently reads blank does
  // not show a blank; it DELETES.
  const loaders = read('_lib/loaders.ts');
  const at = loaders.indexOf('plus_one_name_confirmed_at');
  assert.ok(at > -1, 'the guest select moved — re-point this guard');
  const select = loaders
    .slice(loaders.lastIndexOf("'", at), loaders.indexOf("',", at) + 1)
    .replaceAll("'", '');
  // Vacuity: the slice must be the real select list, not an empty match.
  assert.ok(select.split(',').length > 10, 'the select slice came back short — this guard proves nothing');
  for (const col of ['email', 'mobile', 'display_name']) {
    assert.ok(
      select.split(',').map((c) => c.trim()).includes(col),
      `${col} is not read for the guest — the box renders empty and Save erases what was there`,
    );
  }
  // …and the couple's private column still must not travel here.
  assert.ok(!select.split(',').map((c) => c.trim()).includes('notes'), "the couple's private note reached the guest page");
});

// ── "ALL THEY NEED IS TO ACCEPT" ────────────────────────────────────────────
//
// Owner, 2026-08-21: "if they have an account, and all details are filled, all
// they need is to accept the invitation and they can already see the event hub."

test('the contact boxes fold away only when BOTH ways of reaching them are known', () => {
  const w = read('_components/rsvp-widget.tsx');
  const at = w.indexOf('const detailsAlreadyKnown');
  assert.ok(at > -1, 'the fold condition is gone');
  const cond = w.slice(at, w.indexOf(';', at));
  assert.match(cond, /knownEmail !== ''/, 'an email is no longer required to fold');
  assert.match(cond, /knownMobile !== ''/, 'a number is no longer required to fold');
  assert.match(cond, /&&/, 'either one alone now folds the boxes — the host still has to chase the other');
  // Meal and dietary must NOT gate it: "no preference" and "no allergies" are
  // real answers, and requiring them shows five boxes forever for nothing.
  assert.doesNotMatch(cond, /meal|dietary/i, 'a guest with no allergies is asked forever');
});

test('⚠ the folded summary NAMES what is behind it', () => {
  // This is #4683 in a new position: the guest's own message sat inside a
  // drawer whose label advertised something else, and the host never saw it.
  const w = read('_components/rsvp-widget.tsx');
  const at = w.indexOf('const knownSummary');
  assert.ok(at > -1, 'the summary is gone — the drawer now hides unnamed values');
  const sum = w.slice(at, w.indexOf(';', w.indexOf('.join(', at)));
  for (const part of ['knownEmail', 'knownMobile']) {
    assert.ok(sum.includes(part), `${part} is folded away and not named on the summary line`);
  }
  assert.match(w, /\{knownSummary\}/, 'the summary is computed and never rendered');
});

test('🔴 both arms render the SAME fields, so folding never drops a value', () => {
  // <details> HIDES, it does not disable — the inputs still post either way.
  // Declaring the boxes once is what stops the two arms drifting apart.
  const w = read('_components/rsvp-widget.tsx');
  assert.equal(
    (w.match(/id="contact_email"/g) ?? []).length,
    1,
    'the contact boxes are declared twice — the two arms can now drift apart',
  );
  assert.equal((w.match(/\{contactFields\}/g) ?? []).length, 2, 'one of the two arms stopped rendering the fields');
});

test('replying lands the guest on the event hub, not on a dead end', () => {
  const src = read('actions.ts');
  assert.match(src, /redirect\(ev\?\.slug \? `\/\$\{ev\.slug\}\?rsvp=\$\{outcome\}`/, 'the guest no longer lands on the event');
});
