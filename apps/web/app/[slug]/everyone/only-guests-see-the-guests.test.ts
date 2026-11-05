/**
 * THE PLAIN GUEST NAMES ARE READ ONLY FOR SOMEONE THE EVENT RECOGNISES.
 *
 * ⚖ OWNER 2026-09-15, asked who may see the 77 names that hold no entourage
 * role: **guests and hosts only.** The cast is invitation content and is
 * public; a plain guest's name is not. On a PUBLIC event page "everybody" means
 * anyone with the link and the search engines behind them.
 *
 * ── 🔴 WHY THIS FILE EXISTS AT ALL ─────────────────────────────────────────
 * I wrote the page with the gate in place, cited this test BY NAME in its
 * docblock — and had not written it. Then I sabotaged the page by replacing
 * `if (recognised)` with `if (true)`, and the whole suite stayed GREEN. A
 * privacy gate with no test is a promise in a comment, and the comment claiming
 * a test existed made it worse than nothing.
 *
 * ── WHY IT ASSERTS THE SOURCE ──────────────────────────────────────────────
 * The gate is a server component's control flow around a Supabase call. There
 * is no unit-level seam where "did this read happen" is observable without a
 * live database and three identities. The property that matters — *the guest
 * read is inside the recognition branch, and the cast read is not* — is in the
 * source and is checkable in milliseconds on every commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { guestsWhoSaidYes, plainGuestNames, type EntourageGuestRow } from '@/lib/entourage';

/**
 * The page's BODY — imports excluded.
 *
 * 🪤 THE FIRST CUT OF THIS FILE FAILED AGAINST CORRECT CODE because it searched
 * the whole file: `plainGuestNames` appears in the import list at the top, which
 * is of course BEFORE the gate, so "is the call after the gate?" was answered by
 * the import every time. A window that includes the imports cannot see control
 * flow. Slice to the component first.
 */
function pageSource(): string {
  const whole = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/everyone/page.tsx'), 'utf8'),
  );
  const start = whole.indexOf('export default async function');
  assert.ok(start > 0, 'the everyone page has no default export — this guard is pointing at nothing');
  const src = whole.slice(start);
  assert.ok(
    src.includes('plainGuestNames('),
    'the everyone page no longer builds a guest list — this guard is pointing at nothing',
  );
  return src;
}

test('🔒 the guest read is INSIDE the recognition branch', () => {
  const src = pageSource();
  const gate = src.indexOf('if (recognised)');
  assert.ok(gate > 0, 'the `if (recognised)` gate is gone — every passer-by now reads the guest list');
  const call = src.indexOf('plainGuestNames(');
  assert.ok(call > gate, 'the guest list is built before the gate, so the gate cannot prevent the read');
  /* The gate must test the resolved answer, not be short-circuited to a
     constant — `if (true)` is the sabotage that went green before this file
     existed. */
  assert.ok(!/if\s*\(\s*true\s*\)/.test(src), 'a branch was short-circuited to `if (true)`');
});

test('recognition means a guest session for THIS event, or a host — never mere sign-in', () => {
  /* The WHOLE file: `eventRecognisesViewer` is a helper ABOVE the default
     export, so the body slice the control-flow tests use cannot see it. Two
     tests, two windows, each facing what it actually asserts — the first cut of
     this one searched the body and went red against correct code. */
  const src = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/everyone/page.tsx'), 'utf8'),
  );
  assert.ok(src.includes('readGuestSession'), 'no guest session is read, so an invited guest cannot be recognised');
  assert.ok(
    /session\?\.event_id === eventId/.test(src),
    'the guest session is not compared to THIS event — a session for another wedding would pass',
  );
  assert.ok(
    src.includes('isHostMemberType'),
    'host membership is not checked through isHostMemberType — a `guest`-typed member row once waved somebody into a private site because membership was tested for existence and never compared',
  );
});

test('the CAST read is NOT behind the gate — it is invitation content', () => {
  const src = pageSource();
  const gate = src.indexOf('if (recognised)');
  const cast = src.indexOf('buildEntourage(');
  assert.ok(cast > 0 && cast < gate, 'the entourage was moved behind the recognition gate — it is public by ruling');
});

test('the page is noindex — it is a list of real people either way', () => {
  /* Read the WHOLE file here: `metadata` sits above the component, outside the
     body slice every other test uses. */
  const whole = stripComments(
    readFileSync(join(process.cwd(), 'app/[slug]/everyone/page.tsx'), 'utf8'),
  );
  assert.match(whole, /robots:\s*\{\s*index:\s*false/);
});

/*
  ── "ALSO COMING" MEANS THEY SAID YES (a guest's walk 2026-10-11, fault N19) ──
  The list under "Also coming" was every plain guest on the list: people who had
  not replied, people who had declined, and the reader themself before they had
  answered. Only a guest's own yes puts their name under "coming".

  The rule is a pure function and is RUN here; the page is then held to using it,
  inside the recognition branch, on rows that carry each guest's answer.

  SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`):
  `guestsWhoSaidYes` made to return every row → the first test red; the call
  taken off the page → the second red.
*/
test('✅ only a guest who said yes is "also coming" — not replied, maybe and declined are not', () => {
  const rows: Array<EntourageGuestRow & { rsvp_status?: string | null }> = [
    { guest_id: 'g1', first_name: 'Ana', last_name: 'Cruz', role: 'guest', rsvp_status: 'attending' },
    { guest_id: 'g2', first_name: 'Bean', last_name: 'Banlag', role: 'guest', rsvp_status: 'pending' },
    { guest_id: 'g3', first_name: 'Carlo', last_name: 'Diaz', role: 'guest', rsvp_status: 'declined' },
    { guest_id: 'g4', first_name: 'Dina', last_name: 'Esteban', role: 'guest', rsvp_status: 'maybe' },
    { guest_id: 'g5', first_name: 'Eli', last_name: 'Flores', role: 'guest', rsvp_status: null },
    { guest_id: 'g6', first_name: 'Fe', last_name: 'Gomez', role: 'guest' },
    { guest_id: 'g7', first_name: 'Gio', last_name: 'Hizon', role: 'guest', rsvp_status: 'attending' },
  ];
  // Anti-vacuity: without the rule, all seven are named.
  assert.equal(plainGuestNames(rows).length, 7);
  const coming = plainGuestNames(guestsWhoSaidYes(rows));
  assert.equal(coming.length, 2, `"Also coming" names ${coming.length} people: ${coming.join(' · ')}`);
  for (const yes of ['Ana', 'Gio']) assert.ok(coming.some((n) => n.includes(yes)), `${yes} said yes and is not listed`);
  for (const no of ['Bean', 'Carlo', 'Dina', 'Eli', 'Fe']) {
    assert.ok(!coming.some((n) => n.includes(no)), `${no} has not said yes and is listed as coming`);
  }
  assert.deepEqual(guestsWhoSaidYes([]), []);
});

test('✅ the page lists "Also coming" from the guests who said yes — read with their answer, inside the gate', () => {
  const src = pageSource();
  const gate = src.indexOf('if (recognised)');
  const built = src.indexOf('plainGuestNames(');
  assert.ok(gate > 0 && built > gate);
  const read = src.slice(gate, built + 200);
  assert.match(read, /\.select\(`\$\{ENTOURAGE_COLUMNS\}, rsvp_status`\)/, 'the guest read does not ask for each guest’s answer');
  assert.match(read, /plainGuestNames\(\s*guestsWhoSaidYes\(/, 'the names under "Also coming" are not the guests who said yes');
  // One list, one rule: the page builds the names once.
  assert.equal(src.split('plainGuestNames(').length - 1, 1, 'the page builds a second guest list');
});

