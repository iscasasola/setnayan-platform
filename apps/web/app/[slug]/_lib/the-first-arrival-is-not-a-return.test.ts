/**
 * THE FIRST PERSON TO SCAN A PRINTED INVITATION IS NOT A RETURNING VISITOR.
 *
 * The hub card's headline was an unconditional `Hi again, {name}.` — and the
 * first arrival mints the session and lands straight on this page, so it was
 * literally the first sentence a guest ever read. The comment above the card's
 * own mount even called it "for identified RETURNING guests", asserting a gate
 * that did not exist.
 *
 * ── WHY THE SIGNAL IS THE EARLIEST SCAN, AND ONLY THAT ──────────────────────
 * `scan_events` is written by every door that mints a guest session and was read
 * by nothing. The MINIMUM row is the signal because it does not move when the
 * guest re-scans the card in their hand, and because the redeem route has been
 * observed writing TWO rows ~1.3s apart for a single arrival — a count would
 * lie where a minimum does not.
 *
 * ⛔ 2026-09-30 — THE CARD IS GONE (owner: "Hi again · Your invitation
 * summary" duplicated the Digital ticket on Me). With it went the only
 * greeting that could call a first arrival a return, so the render tests
 * below became a guard that NO such greeting is back on the guest page. The
 * signal (the earliest scan) is still computed and still pinned, for the day
 * something reads it again — and it currently has NO reader: see the note on
 * `GuestHubData.firstVisit`.
 *
 * ⛔ The two obvious "improvements" are both the bug wearing a hat:
 * `rsvp_responded_at` is stamped by three HOST dashboard paths with no guest
 * session in sight, and `arrived` is written only by the door crew. Either one
 * demotes a genuine first arrival back to "Hi again".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = join(__dirname, '..', '_components');
const stripSrc = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('🔴 the guest page greets NOBODY as a return — the "Hi again" card is not back', () => {
  // The defect was a greeting that said "Hi again" to someone on their first
  // visit. The card that carried it was removed; a greeting that comes back
  // must come back gated on the first-visit signal, not unconditional.
  const files = readdirSync(COMPONENTS).filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f));
  assert.ok(files.length > 20, 'precondition: read the guest components');
  for (const f of files) {
    const src = stripSrc(readFileSync(join(COMPONENTS, f), 'utf8'));
    if (/Hi again/.test(src)) {
      assert.match(src, /firstVisit/, `${f} says "Hi again" with no first-visit gate — a first arrival is greeted as a return`);
    }
  }
  const card = stripSrc(readFileSync(join(COMPONENTS, 'guest-hub-card.tsx'), 'utf8'));
  assert.doesNotMatch(card, /export function GuestHubCard/, 'the summary card is back');
  const body = stripSrc(readFileSync(join(COMPONENTS, 'site-body.tsx'), 'utf8'));
  assert.doesNotMatch(body, /<GuestHubCard/, 'the summary card is mounted again');
});

test('🔒 no greeting on the guest page says "Welcome" to someone at home', () => {
  // "Welcome" means "checked in at the door" in five other places. The
  // salutation that remains ("Hi, <name>.") must not borrow it.
  const body = stripSrc(readFileSync(join(COMPONENTS, 'site-body.tsx'), 'utf8'));
  const at = body.indexOf('const greetingBlock');
  assert.ok(at > -1, 'the salutation moved — re-point this guard');
  const greeting = body.slice(at, body.indexOf('</section>', at));
  // The "Hi, <name>." salutation left on 2026-09-30 (DECISION_LOG "NO CASUAL
  // GREETINGS", #6171); the sentence that stays is the one this block renders.
  assert.match(greeting, /joining us as/, 'precondition: this is the greeting block');
  assert.doesNotMatch(greeting, /Hi, /, 'a casual greeting is back');
  assert.doesNotMatch(greeting, /welcome/i);
});

// ── The signal ──────────────────────────────────────────────────────────────

const LOADERS = readFileSync(join(__dirname, 'loaders.ts'), 'utf8');
const stripped = LOADERS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the signal is the EARLIEST scan, not a count and not the newest', async () => {
  const block = stripped.slice(stripped.indexOf('guestFirstVisit'), stripped.indexOf('const guestHubData'));
  assert.match(block, /from\('scan_events'\)/, 'the arrival trail is no longer read');
  assert.match(block, /ascending: true/, 'reading the NEWEST scan makes every visit look like the first');
  assert.match(block, /\.limit\(1\)/);
  assert.doesNotMatch(block, /count/i, 'a count lies — the redeem route writes two rows for one arrival');
});

test('⛔ the greeting never leans on a host-written field', async () => {
  const block = stripped.slice(stripped.indexOf('guestFirstVisit'), stripped.indexOf('const guestHubData'));
  for (const trap of ['rsvp_responded_at', 'guestArrived', 'arrived']) {
    assert.ok(
      !block.includes(trap),
      `the first-visit test leans on ${trap}, which the HOST writes — a genuine first arrival would be demoted to "Hi again"`,
    );
  }
});

test('a rejected query does not read as "never been here"', async () => {
  // A lost grant would otherwise greet every returning guest as new.
  const block = stripped.slice(stripped.indexOf('guestFirstVisit'), stripped.indexOf('const guestHubData'));
  assert.match(block, /firstScanErr/, 'the read error is unchecked');
  assert.match(block, /!firstScanErr &&/, 'the error is read but not required to be absent');
});

// ── The WIRE, not just the two ends ─────────────────────────────────────────
//
// 🚨 EVERY TEST ABOVE PASSED WITH THE FIX DISCONNECTED. The card was rendered
// with an explicit prop, and the loader's query block was read as source — but
// nothing asserted that the loader HANDS the answer to the card. Deleting the
// single line `firstVisit: guestFirstVisit,` (occurrence count 1 → 0) left all
// eight tests green while every guest went back to "Hi again".
// Testing the primitive is not testing the caller.

test('🔴 the loader actually passes the answer to the card', () => {
  // Bound to the hub-data object by STRUCTURE, not by a bare substring: a
  // mention anywhere else in this 1400-line file would otherwise satisfy it.
  const at = stripped.indexOf('const guestHubData');
  assert.ok(at > -1, 'the hub data object was renamed — re-point this guard');
  const obj = stripped.slice(at, stripped.indexOf('};', at));
  assert.match(
    obj,
    /firstVisit:\s*guestFirstVisit/,
    'the loader computes the first-visit answer and never hands it over — every guest reads "Hi again" again',
  );
});

test('the data shape still carries it, so the wire has something to land on', () => {
  const card = readFileSync(join(__dirname, '..', '_components', 'guest-hub-card.tsx'), 'utf8');
  assert.match(card, /firstVisit\?:\s*boolean/, 'the prop is gone — the loader is talking to nobody');
});
