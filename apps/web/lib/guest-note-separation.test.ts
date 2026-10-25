/**
 * The couple's private note and the guest's own message are DIFFERENT COLUMNS.
 *
 * 🔴 Until 2026-08-06 they were one — `guests.notes` — with two labels:
 *      couple's screen: "Notes (private)"
 *      guest's screen:  "A note to the couple"
 * Both pre-filled from it, both wrote back to it. So the couple's note about a
 * guest ("seat away from Tita") appeared pre-typed in that guest's own reply
 * box, and submitting the RSVP erased it. Spreadsheet-imported guests saw
 * "Household: <name>" there for the same reason.
 *
 * These are source-level guards on purpose. The defect was never a logic bug —
 * every function did exactly what it said. It was two surfaces pointed at one
 * column, which only a cross-file check can catch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
// ⤷ 2026-09-22: the guest's edit form moved OUT of the route and into the
// shared card both the route and the roster panel render. The route is now a
// loader. Following the symbol, not the filename — a guard left pointing at
// the old path would go green by finding nothing.
import fs from 'node:fs';

const read = (p: string) => fs.readFileSync(p, 'utf8');

test('the guest-facing RSVP form binds to guest_note, never to notes', () => {
  const src = read('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(src, /name="guest_note"/, 'the guest field must be guest_note');
  assert.match(src, /defaultValue=\{guest\.guest_note \?\? ''\}/);
  assert.doesNotMatch(src, /name="notes"/, 'a guest-facing field must never be named notes');
  assert.doesNotMatch(
    src,
    /defaultValue=\{guest\.notes/,
    "the couple's private note must never pre-fill a guest's box",
  );
});

test('the guest RSVP action writes guest_note and never touches notes', () => {
  const src = read('app/[slug]/actions.ts');
  assert.match(src, /formData\.get\('guest_note'\)/);
  assert.match(src, /guest_note: guestNote/);
  assert.doesNotMatch(
    src,
    /formData\.get\('notes'\)/,
    'the guest action must not read a notes field',
  );
  assert.doesNotMatch(
    src,
    /^\s+notes,$/m,
    'the guest action must not write the notes column',
  );
});

test("the couple's private note is not even SELECTED onto the guest surface", () => {
  const src = read('app/[slug]/_lib/loaders.ts');
  const selectLine = src
    .split('\n')
    .find((l) => l.includes('dietary_restrictions') && l.includes('qr_token'));
  assert.ok(selectLine, 'guest select list not found');
  assert.match(selectLine!, /guest_note/, 'the guest surface needs guest_note');
  assert.doesNotMatch(
    selectLine!,
    /(^|,)\s*notes\s*(,|')/,
    "the couple's notes column must not travel to the guest page at all",
  );
});

test('the guest-facing type carries guest_note and not notes', () => {
  const src = read('app/[slug]/_lib/types.ts');
  assert.match(src, /guest_note: string \| null;/);
});

test('the couple still receives BOTH — their own note and the guest\'s message', () => {
  const lib = read('lib/guests.ts');
  assert.match(lib, /,rsvp_status,notes,guest_note,qr_token,/, 'couple select needs both');
  assert.match(lib, /guest_note: string \| null;/);
  const page = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  assert.match(page, /guest\.guest_note/, "the couple must be shown the guest's message");
  assert.match(page, /never sees it/, 'the private note must say plainly that it is private');
});

/**
 * ── AND THE HOST MUST BE ABLE TO SEE IT WITHOUT GUESSING ────────────────────
 *
 * Splitting the columns fixed the ERASURE. It did not make the guest's message
 * READABLE: the only render of it app-wide sat inside a collapsed `<details>`
 * whose auto-open condition tests seven HOST-editable fields and not this one,
 * and whose summary hint advertised "notes" — which a host reads as their own
 * private box, the very field the drawer does hold. So a guest who replied with
 * nothing but a message wrote to somebody who would never be shown it.
 */

test("the guest's message is not hidden inside a collapsed disclosure", () => {
  /* Re-pointed 2026-10-24 (one guest card everywhere): the card's rows are the shared Fold now — no `<details>` is left.
     The property is the same: the row that holds the guest's own message OPENS BY ITSELF whenever there is one, so a
     host never has to guess to expand a row to read it. */
  const page = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  const g = page.indexOf('guest.guest_note?.trim() ? (');
  assert.ok(g > -1, "the guest's message is not rendered at all");
  const fold = page.lastIndexOf('<K.Fold ', g);
  assert.ok(fold > -1, 'the message is not inside a row any more — re-point this guard at whatever replaced it');
  const head = page.slice(fold, page.indexOf('>', fold) + 1);
  assert.match(head, /open=\{Boolean\(guest\.guest_note\?\.trim\(\)\)\}/, "the row holding the guest's message does not open by itself when there is one");
  assert.ok(page.indexOf('</K.Fold>', fold) > g, "the guest's message is not inside the row that opens for it");
});

test('each drawer row names what is actually behind it', () => {
  /*
    ⤷ 2026-09-22: "More details" was ONE drawer with a combined hint
    ("Display name · contact · …"). The card split it into three named rows —
    Name, Email & mobile, Private note — so there is no combined summary left to
    assert. The property did not change and is asserted per row: a host must be
    able to tell what a row holds without opening it, and must never mistake
    their own private box for the guest's message.
  */
  const page = read('app/dashboard/[eventId]/guests/_components/guest-card-body.tsx');
  const summaries = [...page.matchAll(/summary="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(summaries.length >= 3, `the drawer rows are gone — found ${summaries.length}`);

  assert.ok(
    summaries.some((t) => /private note/i.test(t ?? '')),
    "the drawer must say whose note it holds — 'notes' alone reads to a host as the guest's message",
  );
  for (const t of summaries) {
    assert.doesNotMatch(t ?? '', /·\s*tags\s*·/, 'the custom-tags input was retired in 2026-05');
  }
  // And the guest's own message is NOT one of them: it is read-only, and it
  // renders in the open, which the test above this one pins.
  assert.ok(
    !summaries.some((t) => /message from|note from/i.test(t ?? '')),
    "the guest's message must not be filed behind a drawer row",
  );
});
