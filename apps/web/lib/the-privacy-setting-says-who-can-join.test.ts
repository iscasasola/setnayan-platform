/**
 * THE PRIVACY SETTING MUST DESCRIBE THE DOOR, NOT ONLY THE WINDOW.
 *
 * ── 2026-09-29 · THE DOOR CHANGED, AND THIS FILE PINNED THE OLD ONE ──────────
 * This guard was written on 2026-09-16, when a shared link ADMITTED anyone who
 * had it — *"they are issued the event hub with the camera."* It asserted that
 * the copy said so, and the copy did. Then the owner reversed the model
 * (DECISION_LOG 2026-09-26, "NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE COUPLE
 * LINKS OR ACCEPTS THEM"), the join code followed — `joinEventAction` and
 * `selfJoinAction` now end an unkeyed arrival in `createJoinRequest`, a row in
 * Requests, and mint nothing — and the copy kept promising the Event Hub and a
 * camera to anyone with the link. **This file stayed green the whole time,
 * because it was asserting the old promise.** A couple choosing Public or
 * Unlisted was told strangers could walk in; in fact a stranger can only ASK,
 * and only when the couple turned on "Anyone, I approve".
 *
 * 🔑 SO THE COUPLING IS NOW TO THE REQUEST PATH TOO, NOT ONLY TO THE 'private'
 * COMPARISON. Both are asserted below. If either moves, the blurbs are wrong
 * again, and this file is the only thing that would notice.
 *
 * ── THE MODEL THE COPY MUST STATE (verified in code 2026-09-29) ─────────────
 *  · VIEWING the page: public + unlisted admit anyone (`openToStrangers`);
 *    invited_accounts + private admit hosts, key holders, linked guests and
 *    booked suppliers (`closedEventAdmits`).
 *  · GETTING INSIDE (the Event Hub, a camera): only a guest's own key — the
 *    personal link or QR — or a request the couple Keeps or Links.
 *  · ASKING to join: only when `anyoneMayAskToJoin` (the RSVP setting
 *    "Anyone, I approve"), and never on 'private'.
 *
 * ⚠ STILL A COPY TEST WITH COUPLING, NOT A WARNING TEST. The behaviour is the
 * owner's; what was wrong was that the couple could not learn it from the
 * screen where they choose.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8')).replace(/\s+/g, ' ');

const PRIVACY = ['app', 'dashboard', '[eventId]', 'website', 'privacy', 'page.tsx'];

/** The blurb text of one VisibilityCard, by its `value=""`. */
function blurbFor(src: string, value: string): string {
  const at = src.indexOf(`value="${value}"`);
  assert.ok(at > 0, `the privacy page no longer offers a "${value}" option`);
  const from = src.indexOf('blurb=', at);
  assert.ok(from > at, `the "${value}" option has no blurb`);
  /* End at the card's own close, so one card's text can never be read as the
     next card's — the bug that makes a window face the wrong cell. */
  const end = src.indexOf('/>', from);
  assert.ok(end > from, `the "${value}" card is unterminated`);
  return src.slice(from, end);
}

/** Curly quotes in the source are written as “/” escapes — read both. */
const unescape = (s: string) => s.replace(/\\u201c|\\u201d/g, '"').replace(/[“”]/g, '"');

test('🔒 every setting that leaves the join door OPEN says it is a REQUEST', () => {
  const src = read(...PRIVACY);
  /* These three are exactly the values `resolveEffectiveVisibility(...) !== 'private'`
     lets ask. Each must say that asking is possible, where the asker waits, what
     the couple does with them, and which setting opens it. */
  for (const value of ['public', 'unlisted', 'invited_accounts']) {
    const blurb = unescape(blurbFor(src, value));
    assert.match(blurb, /ask to join/i,
      `"${value}" leaves the join door open, and its description never says so`);
    assert.match(blurb, /Requests/,
      `"${value}" must say where an asker waits — Requests`);
    assert.match(blurb, /Keep, Link or Remove/,
      `"${value}" must name the couple's three answers to a request`);
    assert.match(blurb, /"Anyone, I approve"/,
      `"${value}" must name the RSVP setting that opens requests — the door is shut without it`);
  }
});

test('🔴 no setting promises that the link lets people inside', () => {
  /* THE DEFECT THIS REWRITE FIXES. The link shows a public or unlisted PAGE; it
     never hands out the Event Hub or a camera. The property: wherever a blurb
     names the Event Hub or a camera, it also names the key that opens them. */
  const src = read(...PRIVACY);
  for (const value of ['public', 'unlisted', 'invited_accounts', 'private']) {
    const blurb = blurbFor(src, value);
    assert.doesNotMatch(blurb, /walk in|admits anyone|hands them|get a camera|pick up a camera/i,
      `"${value}" still promises that the link lets people in`);
    if (/event hub|camera/i.test(blurb)) {
      assert.match(blurb, /own key/i,
        `"${value}" mentions the Event Hub or a camera without saying it takes a guest's own key`);
    }
  }
});

test('🔑 the one setting that CLOSES the door says that too', () => {
  const src = read(...PRIVACY);
  const blurb = blurbFor(src, 'private');
  assert.match(blurb, /closes your join link/i,
    'Private is the only setting that closes the join link — that is its most useful property');
});

test('⚠ "only guests with an account" locks the page but not the request door — and says it', () => {
  /* The trap: its blurb promises a locked screen. True of the PAGE. A couple
     reading only that would believe nobody could even ask. */
  const src = read(...PRIVACY);
  const blurb = blurbFor(src, 'invited_accounts');
  assert.match(blurb, /locked screen/i, 'the page-level promise should still be made');
  assert.match(blurb, /not the join link/i,
    'it must also say the join link still takes requests — otherwise "locked" reads as closed');
  assert.match(blurb, /own QR codes/i,
    'name the per-guest QR — the tool for a controlled list');
  assert.match(blurb, /Private/,
    'name the setting that actually closes the join link, so nothing implies the QRs do');
});

test("🔑 the Maker's short picker says Private admits your guests too", () => {
  /* "Only you and your hosts" undersold Private: `closedEventAdmits` also lets
     in a key holder and a linked guest. A couple reading the short picker
     would think their own guests were locked out of their event. */
  const panel = read('app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'media-panels.tsx');
  const at = panel.indexOf("['private', 'Private', '");
  assert.ok(at > 0, 'the Maker picker no longer offers Private');
  const hint = panel.slice(at, panel.indexOf(']', at));
  assert.match(hint, /guests/i, 'Private admits your guests — the short picker must say so');

  const gate = read('lib', 'closed-event-admission.ts');
  assert.match(gate, /if \(facts\.holdsGuestPass\) return true;/,
    'a key holder is no longer admitted to a closed event — revisit the Private copy');
  assert.match(gate, /if \(facts\.isSeatHolder\) return true;/,
    'a linked guest is no longer admitted to a closed event — revisit the Private copy');
});

test('🔒 an arrival WITHOUT a key becomes a request — if that changes, this copy is wrong', () => {
  const action = read('app', 'join', '[eventId]', 'actions.ts');
  const requests = (action.match(/await createJoinRequest\(/g) ?? []).length;
  assert.equal(requests, 2,
    'joinEventAction and selfJoinAction should each end an unkeyed arrival in createJoinRequest — revisit the privacy copy');
  assert.match(action, /anyoneMayAskToJoin\(/,
    'the join door no longer checks "Anyone, I approve" — revisit the privacy copy');

  const ask = read('lib', 'rsvp-ask.ts');
  assert.match(ask, /anyone: 'Anyone, I approve'/,
    'the RSVP setting was renamed — the privacy copy quotes its label');
});

test('🔒 the gate still refuses ONLY "private" — if that changes, this copy is wrong', () => {
  /* ⚠ COUPLING. The blurbs above are true because of this one comparison, in two
     places. Widen or narrow it and every sentence written above becomes a lie
     with nothing else to catch it. */
  const invite = read('app', '[slug]', 'invite', 'page.tsx');
  const action = read('app', 'join', '[eventId]', 'actions.ts');

  assert.match(invite, /resolveEffectiveVisibility\(event\) === 'private'/,
    'the invite door no longer refuses exactly "private" — revisit the privacy copy');
  assert.match(action, /resolveEffectiveVisibility\(visRow\) === 'private'/,
    'selfJoinAction no longer refuses exactly "private" — revisit the privacy copy');
});

test('🌐 Public says requests are ON by default — because choosing it turns them on', () => {
  /* Owner 2026-09-29 (DECISION_LOG "DISCOVER BUILD — TWO LAST ANSWERS"):
     switching visibility TO public sets "Anyone, I approve". The Public blurb
     must say so — and say it can be turned off — and that is only true while
     the visibility action still turns it on. Both halves are asserted. */
  const src = read(...PRIVACY);
  const blurb = unescape(blurbFor(src, 'public'));
  assert.match(blurb, /Choosing Public here turns on "Anyone, I approve"/,
    'the Public blurb must say choosing it turns requests on');
  /* ⚖ Owner 2026-09-29 ("no"): a Save-the-Date launch also makes the page
     public and does NOT turn requests on — the blurb must not let a couple who
     launched believe strangers can now ask. */
  assert.match(blurb, /launching a Save-the-Date does not/,
    'the Public blurb must say a Save-the-Date launch leaves requests as they were');
  assert.match(blurb, /turn requests off/i, 'and that the couple can turn them off again');
  for (const value of ['unlisted', 'invited_accounts']) {
    assert.doesNotMatch(unescape(blurbFor(src, value)), /turns on "Anyone, I approve"/,
      `"${value}" does not turn requests on — only Public does`);
  }

  const action = read('app', 'dashboard', '[eventId]', 'website', 'privacy', 'actions.ts');
  assert.match(action, /rsvpAskConfigOnGoingPublic\(/,
    'the visibility action no longer turns requests on for Public — revisit the Public copy');
});
