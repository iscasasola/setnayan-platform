/**
 * THE PRIVACY SETTING MUST DESCRIBE THE DOOR, NOT ONLY THE WINDOW.
 *
 * ── 🔴 WHAT THE COPY LEFT OUT ──────────────────────────────────────────────
 * All four options on `/dashboard/<eventId>/website/privacy` described who could
 * **view** the landing page. None of them mentioned who could **join** — and
 * joining is the bigger consequence: it mints a guest session, puts a row on the
 * couple's guest list, and (owner, 2026-09-16) *"they are issued the event hub
 * with the camera."*
 *
 * ⚠ THE GATE ADMITS FAR MORE THAN THE COPY IMPLIED. `app/[slug]/invite/page.tsx`
 * and `selfJoinAction` both refuse on exactly ONE value:
 *
 *     resolveEffectiveVisibility(event) === 'private'
 *
 * So **public, unlisted AND "only guests with a Setnayan account" all leave the
 * join door open.** The third is the surprising one: a couple picks it to
 * restrict access, its blurb said *"Anyone else … sees the locked screen"*, and
 * that was true of the PAGE while the join link kept working.
 *
 * 🔑 THIS IS A COPY TEST BECAUSE THE BEHAVIOUR IS DELIBERATE — owner, 2026-09-16,
 * across three messages that together settle the model:
 *
 *   · *"they are issued the event hub with the camera"*;
 *   · the general QR and a guest's own QR *"both serve the same purpose. They
 *     can register, etc. The Custom QR will be worth for a controlled guest QR"*;
 *   · **"one QR is basically for events with no guest list. custom QR is for
 *     dedicated guests but also has a one QR (for additional guests not
 *     listed)."**
 *
 * 🔑 THE THIRD IS THE ONE THAT SETTLES THE WORDING. The shared link is not a gap
 * left open beside the per-guest codes — **it is the documented path for a guest
 * who is not on the list**, and it is the entire invitation for an event with no
 * list at all. The two coexist by design; they are not competing gates.
 *
 * ⚠ SO THE COPY MUST NOT DESCRIBE IT AS A LEAK. An earlier draft of this file
 * said the per-guest QRs *"don't stop anyone else joining"* — accurate, and it
 * framed a deliberate door as a shortfall, which is how a couple ends up hunting
 * for a setting that was never missing.
 *
 * ⚠ WHICH IS WHY THE COPY MUST NOT READ AS A WARNING. What was wrong was never
 * the behaviour; it was that the couple could not learn it from the screen where
 * they choose, and one option's wording implied the opposite.
 *
 * ⚠ IT IS ALSO A COUPLING TEST. If somebody narrows or widens that gate, the
 * blurbs become wrong in a way nothing else would notice — so the gate's own
 * text is asserted here, beside the copy that describes it.
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

test('🔒 every setting that leaves the join door OPEN says so', () => {
  const src = read(...PRIVACY);
  /* These three are exactly the values `resolveEffectiveVisibility(...) !== 'private'`
     admits. Each must tell the couple that somebody can walk in. */
  for (const value of ['public', 'unlisted', 'invited_accounts']) {
    const blurb = blurbFor(src, value);
    assert.match(blurb, /join/i,
      `"${value}" leaves the join door open, and its description never says so`);
  }
});

test('🔑 the one setting that CLOSES the door says that too', () => {
  const src = read(...PRIVACY);
  const blurb = blurbFor(src, 'private');
  assert.match(blurb, /join/i,
    'Private is the only setting that closes the join link — that is its most useful property');
});

test('⚠ "only guests with an account" admits the page but not the door — and says it', () => {
  /* The trap this test exists for: its blurb promises a locked screen. That is
     true of the PAGE. A couple reading only that sentence would believe the
     event was closed. */
  const src = read(...PRIVACY);
  const blurb = blurbFor(src, 'invited_accounts');
  assert.match(blurb, /locked screen/i, 'the page-level promise should still be made');
  assert.match(blurb, /still works|still join|not the join link/i,
    'it must also say the join link keeps working — otherwise "locked" reads as closed');
  /* ⚖ And it must point at the CONTROL, not merely warn. Owner: the per-guest QR
     is what a couple uses when they want a controlled list. A sentence that
     names a consequence without naming the remedy leaves them stuck. */
  assert.match(blurb, /own QR codes/i,
    'say what to do about it — the per-guest QR is the tool for a controlled list');

  /* ⚠ AND THE REMEDY MUST NOT OVER-PROMISE, which is the same defect facing the
     other way. A per-guest QR is a DIFFERENT control, not a stronger one: it
     carries identity — name, seat, the couple's limits for that guest — and it
     blocks nobody. A couple who read it as a lock would choose it INSTEAD of
     Private and get neither. So the sentence must disclaim the blocking and
     name the one setting that does close the door. */
  /* ⚖ THE SHARED LINK IS NAMED AS A PURPOSE, NOT A SHORTFALL. Owner: the custom
     QR path "also has a one QR (for additional guests not listed)". Wording that
     merely concedes the per-guest codes "don't stop anyone else" describes the
     same mechanism as a hole, and sends a couple looking for a fix that does not
     exist because nothing is broken. */
  assert.match(blurb, /deliberate|isn't on your list|is not on your list/i,
    'the shared link is the path for an unlisted guest — say what it is FOR');
  assert.match(blurb, /Private/i,
    'name the setting that actually closes the shared link, so nothing implies the QRs do');
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
