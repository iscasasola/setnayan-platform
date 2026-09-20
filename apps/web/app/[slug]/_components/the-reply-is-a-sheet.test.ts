/**
 * THE REPLY IS A SHEET, AND THE INVITATION IS STILL BEHIND IT.
 *
 * Arrival design slice 4 (owner-approved canvas board "2 · RSVP sheet",
 * 2026-09-20). Four claims, and every one of them is a way this could have
 * shipped looking finished and doing nothing:
 *
 *   1. ONE MECHANISM. The sheet posts what the section posted, because it is
 *      the same `<RsvpWidget>` in a different place. The sheet declares no
 *      field and no action of its own.
 *   2. A HALF-TYPED NOTE SURVIVES A CLOSE. The form is rendered in BOTH states;
 *      closing hides it, never unmounts it.
 *   3. BOTH DOORS LAND IN THE SAME PLACE — the hub card's chip and the arrival
 *      action's RSVP label.
 *   4. A GUEST WHO ALREADY ANSWERED OPENS THE SAME SHEET SHOWING THEIR ANSWER,
 *      not a blank form.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement` with
 * no import of their own, and a STATIC import is hoisted above the assignment
 * and throws. Same trap, same fix as `only-the-answer-freezes.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RSVP_SHEET_ANCHORS,
  hashOpensSheet,
  sheetOpensOnLoad,
  rsvpSheetTrigger,
  rsvpSheetHeading,
} from './rsvp-sheet-state';
import { SITE_MENU_ANCHORS } from '../_lib/site-menu';

(globalThis as unknown as { React: unknown }).React = React;

/**
 * 🪤 `server-only` IS NOT AN INSTALLED PACKAGE — Next's bundler provides it and
 * at runtime it is a marker whose whole job is to throw inside a client bundle.
 * The reply card imports its server action, which imports the fault log, which
 * imports the marker, so this runner cannot load the component without a stub.
 * The real boundary is enforced by `lint-server-only-boundary.mjs` in CI and is
 * not weakened here.
 */
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = __dirname;
const readHere = (name: string) => readFileSync(join(HERE, name), 'utf8');

/**
 * 🪤 STRIP COMMENTS BEFORE SCANNING SOURCE. Three of the four structural guards
 * below failed on their FIRST run against their own docblocks: this file's
 * prose quotes `<RsvpSheet>` and `position: fixed` while explaining why they
 * must be where they are, and a raw search cannot tell an explanation from the
 * thing it explains. It is at least the third time in this repo that a COMMENT
 * satisfied a pattern match — twice as a false pass, here as a false failure.
 */
const stripComments = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

const SHEET_SRC = readHere('rsvp-sheet.tsx');
const SHEET_CODE = stripComments(SHEET_SRC);
const BODY_SRC = readHere('site-body.tsx');
const BODY_CODE = stripComments(BODY_SRC);

// ── 3. BOTH DOORS ───────────────────────────────────────────────────────────

test('the hub card’s chip opens the sheet', () => {
  assert.equal(hashOpensSheet('#your-details'), true);
});

test('the arrival action’s RSVP href opens the SAME sheet', () => {
  // `resolveArrivalAction` sends 'ask' / 'going' / 'declined' to
  // `/${slug}#${SITE_MENU_ANCHORS.me}`. Read from the anchor map, never
  // retyped, so a rename cannot leave this passing while the link goes dead.
  assert.equal(hashOpensSheet(`#${SITE_MENU_ANCHORS.me}`), true);
  assert.equal(hashOpensSheet(`/some-wedding#${SITE_MENU_ANCHORS.me}`), true);
});

test('🛑 the sheet does NOT mint a second #site-me element', () => {
  // It listens to the fragment; the id itself belongs to `guest-hub-bar.tsx`
  // (the guest's personal QR section). Emitting a second one sends the Me tab to
  // whichever element comes first — the failure `bottom-edge.test.ts` was
  // written for, and the one this file's first draft shipped into.
  assert.ok(!/id=\{meAnchor\}|id="site-me"/.test(SHEET_CODE), 'the sheet emits a #site-me element');
});

test('…and they are the SAME sheet, not two', () => {
  // The requirement is "both must land in the same place". One anchor list,
  // one panel: there is nowhere for a second destination to hide.
  assert.equal(RSVP_SHEET_ANCHORS.length, 2);
  assert.equal(new Set(RSVP_SHEET_ANCHORS).size, 2);
  assert.equal((SHEET_CODE.match(/role="dialog"/g) ?? []).length, 1, 'a second panel exists');
});

test('an unrelated fragment does NOT open it', () => {
  for (const hash of ['', '#', '#site-gallery', '#your-details-map', 'yourdetails', null, undefined]) {
    assert.equal(hashOpensSheet(hash), false, `"${String(hash)}" opened the reply sheet`);
  }
});

// ── THE OUTCOME OF A SAVE CANNOT BE SWALLOWED ───────────────────────────────

test('🔴 a refused save reopens the sheet, where the sentence explaining it lives', () => {
  // `submitRsvp` redirects to `?rsvp=refused` when a guest posts a changed
  // answer into a finalized list. That flash renders at the TOP OF THE FORM —
  // so with the form behind a closed sheet and nothing reopening it, the guest
  // lands on a page that says nothing and walks away believing their reply
  // moved. This is the failure-that-looks-like-success class, exactly.
  assert.equal(sheetOpensOnLoad({ tone: 'error', text: 'not changed' }), true);
});

test('a save that landed does NOT reopen the sheet over the keepsake', () => {
  assert.equal(sheetOpensOnLoad({ tone: 'ok', text: 'Your reply is in — thank you.' }), false);
  assert.equal(sheetOpensOnLoad(null), false);
});

test('…and the "ok" outcome is rendered in the page’s own flow instead', () => {
  // Otherwise the branch above is not a design decision, it is a dropped
  // message: nothing anywhere would tell the guest the save worked.
  assert.ok(
    /\{rsvpFlash \? \([\s\S]{0,700}\{rsvpFlash\.text\}/.test(BODY_CODE),
    'no flash is rendered beside the trigger — an ok outcome reaches no pixel',
  );
});

// ── THE CONTROL THAT OPENS IT ───────────────────────────────────────────────

test('the control names the DETAILS, not only the reply (#4683)', () => {
  assert.equal(
    rsvpSheetTrigger({ status: 'attending', guestListClosed: false }).label,
    'Need to change your reply or your details?',
  );
  assert.equal(
    rsvpSheetTrigger({ status: 'declined', guestListClosed: false }).label,
    'Need to change your reply or your details?',
  );
});

test('a finalized list still invites them in — the allergy box is still open', () => {
  // Only the ANSWER freezes (owner 2026-08-20), and the list finalizes about
  // two weeks out, which is exactly when "nut allergy" matters most. A control
  // that says "replies are closed" and nothing else takes the caterer's last
  // fortnight away.
  for (const status of ['pending', 'attending', 'declined', 'maybe'] as const) {
    assert.equal(
      rsvpSheetTrigger({ status, guestListClosed: true }).label,
      'Need to update your details?',
    );
  }
});

test('a guest who has not answered is asked', () => {
  assert.equal(
    rsvpSheetTrigger({ status: 'pending', guestListClosed: false }).label,
    'Reply to the invitation',
  );
  assert.equal(
    rsvpSheetTrigger({ status: 'maybe', guestListClosed: false }).label,
    'Reply to the invitation',
  );
});

test('a wake never asks anybody whether they will "be with us"', () => {
  assert.equal(rsvpSheetHeading({ status: 'pending', guestListClosed: false, solemn: false }), 'Will you be with us?');
  assert.equal(
    rsvpSheetHeading({ status: 'pending', guestListClosed: false, solemn: true }),
    'Will you be able to come?',
  );
  // And an answered guest is never asked the question again, in either register.
  for (const solemn of [true, false]) {
    assert.equal(rsvpSheetHeading({ status: 'attending', guestListClosed: false, solemn }), 'Change your reply');
    assert.equal(rsvpSheetHeading({ status: 'declined', guestListClosed: false, solemn }), 'Change your reply');
    assert.equal(rsvpSheetHeading({ status: 'attending', guestListClosed: true, solemn }), 'Your details');
  }
});

// ── 1 + 2 + 4: THE RENDER ───────────────────────────────────────────────────

const WORDS = {
  organizer: 'couple',
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
  TheOrganizerPossessive: 'The couple’s',
  eventWord: 'wedding',
  organizerIsHonoree: false,
  solemn: false,
};

function guest(over: Record<string, unknown> = {}) {
  return {
    guest_id: 'g-1',
    first_name: 'Ana',
    last_name: 'Cruz',
    display_name: 'Ana Cruz',
    rsvp_status: 'pending',
    meal_preference: 'chicken',
    dietary_restrictions: 'nut allergy',
    guest_note: 'See you there — half typed',
    email: null,
    mobile: null,
    qr_token: 't',
    photo_source: null,
    photo_url: null,
    ...over,
  };
}

/**
 * The sheet as the page mounts it: the real panel wrapping the real reply card.
 *
 * ⚠ SERVER RENDER ⇒ THE CLOSED STATE. `useState(false)` and no effects, which
 * is precisely the state under test: everything asserted below is what a
 * DISMISSED sheet still holds.
 */
async function renderClosed(over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RsvpSheet } = await import('./rsvp-sheet');
  const { RsvpWidget } = await import('./rsvp-widget');
  return renderToStaticMarkup(
    React.createElement(
      RsvpSheet as never,
      {
        heading: 'Will you be with us?',
        privacyLine: 'Only the couple sees your reply.',
        flash: null,
      } as never,
      React.createElement(RsvpWidget as never, {
        words: WORDS,
        guest: guest(over),
        eventId: 'e-1',
        eventPublicId: 'S89E-XXXX',
        faceMode: 'mode_b',
        replyLocked: false,
      } as never),
    ),
  );
}

test('🔑 A HALF-TYPED NOTE SURVIVES A CLOSE — the form is rendered while closed', async () => {
  // THE SABOTAGE THIS CATCHES: `{open ? children : null}` in rsvp-sheet.tsx, or
  // mounting the panel only when open — the shape most sheet components take,
  // and the shape that throws away every uncontrolled input's value. The one a
  // guest most resents retyping is the note to the couple.
  const html = await renderClosed();
  assert.match(html, /data-open="0"/, 'the panel did not render in its closed state');
  assert.match(html, /name="guest_note"/, 'the form is unmounted when the sheet is closed');
  assert.match(html, /See you there — half typed/, 'the note’s existing text was dropped');
  assert.match(html, /name="meal_preference"/);
  assert.match(html, /name="dietary_restrictions"/);
});

test('🔑 A GUEST WHO ALREADY ANSWERED OPENS THE SAME SHEET SHOWING THEIR ANSWER', async () => {
  const html = await renderClosed({ rsvp_status: 'attending' });
  // Not a blank form: their own answer is the checked one — and, just as much,
  // the other two are NOT. ⚠ Order-independent on purpose: React emits
  // `checked=""` BEFORE `value="attending"`, so a regex written in the order a
  // person would write the JSX matches nothing and fails for the wrong reason.
  const radios = html.match(/<input[^>]*name="rsvp_status"[^>]*>/g) ?? [];
  assert.equal(radios.length, 3, 'the three answer controls are not all rendered');
  for (const radio of radios) {
    const isTheirs = radio.includes('value="attending"');
    assert.equal(
      radio.includes('checked'),
      isTheirs,
      isTheirs
        ? 'the guest’s own answer is not pre-selected — they are being asked again from scratch'
        : `an answer they did not give is pre-selected: ${radio}`,
    );
  }
  // …and it is the SAME sheet, not a read-only twin: they can still change it,
  // and the whole rest of the card — meal, allergy note, the note to the host —
  // is there to change too.
  assert.match(html, /name="meal_preference"/);
  assert.match(html, /name="guest_note"/);
  assert.ok(!/Replies are closed/.test(html), 'an open list is showing the frozen-answer arm');
});

test('🔑 ONE MECHANISM — the sheet posts nothing of its own', async () => {
  // The sheet must never grow a second form. Two places declaring
  // `meal_preference` is how one of them silently stops saving an allergy.
  assert.ok(!/<form/.test(SHEET_CODE), 'the sheet declares a form of its own');
  assert.ok(!/submitRsvp|action=\{/.test(SHEET_CODE), 'the sheet binds an action of its own');
  const html = await renderClosed();
  assert.equal((html.match(/<form/g) ?? []).length, 1, 'more than one form is inside the sheet');
});

test('the sheet says whose eyes the reply reaches', async () => {
  const html = await renderClosed();
  assert.match(html, /Only the couple sees your reply\./);
});

// ── WHERE IT MOUNTS, AND WHAT IT MUST NOT BECOME ────────────────────────────

test('🪤 the sheet is a SIBLING of the chapters article, never a child', () => {
  // MEASURED, 2026-09-20, one 812px viewport, the same panel twice: a sibling
  // of the article lands at bottom = 812, flush; the same panel INSIDE it lands
  // at bottom = 853 — 41px below the fold, which is where its Save button is.
  // The §6 reveal puts a `transform` on every direct child of
  // `[data-pahina-chapters]`, and a transform (identity included) is the
  // containing block for a `position: fixed` descendant. The same rule's
  // `opacity: 0` half would make an unrevealed sheet invisible outright.
  // Neither failure throws, so nothing would have reported it.
  const mount = BODY_CODE.indexOf('<RsvpSheet');
  const lastClose = BODY_CODE.lastIndexOf('</article>');
  assert.ok(mount > -1, 'the sheet is not mounted at all');
  assert.ok(mount > lastClose, 'the sheet moved back inside <article data-pahina-chapters>');
});

test('⛔ NOT A SECOND FIXED BOTTOM BAR — nothing is positioned while closed', () => {
  // `GuestHubBar` was retired for covering the site menu whole (a
  // `fixed bottom-0 z-40` over a `z-30` menu). A sheet that is fixed only while
  // a guest is looking at it is a different thing — but only while that stays
  // true. EVERY rule that positions anything must be gated on `data-open="1"`.
  const rules = SHEET_CODE.split('}').filter((r) => /position:\s*fixed/.test(r));
  assert.ok(rules.length >= 2, 'the sheet CSS no longer positions anything — re-point this guard');
  for (const rule of rules) {
    const selector = rule.slice(0, rule.indexOf('{'));
    assert.match(
      selector,
      /\[data-open="1"\]/,
      `a rule fixes an element regardless of the sheet being open: ${selector.trim()}`,
    );
  }
  assert.ok(
    SHEET_CODE.includes('.sn-sheet-js .sn-rsvp-sheet{display:none}'),
    'a closed sheet is no longer hidden',
  );
});

test('🔑 focus is managed by the SHARED hook, not hand-rolled here', () => {
  // RULE 0, and this one shipped before its own guard caught it. The first
  // build did its own body-scroll lock, its own Escape listener and its own
  // `.focus()` — the half of modal behaviour that is visible — while never
  // trapping Tab and never handing focus back. A sheet claiming
  // `aria-modal="true"` and doing that is a keyboard dead end: Tab walks
  // straight out into the invitation behind the scrim.
  //
  // `lib/modal-a11y-adoption.test.ts` names any such file repo-wide. This pins
  // the other direction: that THIS sheet did not satisfy it by quietly dropping
  // `aria-modal` and keeping the hand-rolled half.
  assert.match(SHEET_CODE, /useModalA11y\(\{[\s\S]{0,120}containerRef/, 'the shared hook is gone');
  assert.match(SHEET_CODE, /aria-modal=/, 'the sheet stopped announcing itself as a dialog');
  for (const [pattern, what] of [
    [/body\.style\.overflow/, 'a hand-rolled body-scroll lock'],
    [/key === 'Escape'/, 'a hand-rolled Escape listener'],
  ] as const) {
    assert.ok(!pattern.test(SHEET_CODE), `${what} is back alongside the hook — one of the two will win, silently`);
  }
});

test('with the bundle dead the reply card is still a reachable section', () => {
  // The flow ⇄ sheet switch hangs off `.sn-sheet-js`, added to <html> by an
  // inline script. With JS off the class never lands, the panel keeps its
  // default flow rendering, and `#your-details` scrolls to a real form —
  // instead of to something `display:none` that cannot be answered at all.
  assert.match(SHEET_CODE, /classList\.add\('sn-sheet-js'\)/);
  assert.ok(
    !/^\s*\.sn-rsvp-sheet\{display:none\}/m.test(SHEET_CODE),
    'the panel is hidden unconditionally — a guest without JavaScript cannot RSVP',
  );
  // The trigger is a plain fragment link for the same reason: with no JS it
  // scrolls, with JS it is the signal the sheet listens for.
  assert.ok(BODY_CODE.includes('href="#your-details"'), 'the trigger is no longer a fragment link');
});
