/**
 * silent-absence.test.ts — a read that FAILED must never be rendered as a thing
 * that ISN'T THERE.
 *
 * This is the same disease `door-truth.test.ts` guards one layer up, found
 * again deeper in the same file. `const { data } = await …` throws the error
 * away, and supabase-js returns `data: null` (or `[]`) on failure — the exact
 * value that means "nothing here". Every caller downstream then renders
 * absence, confidently, with nothing on screen suggesting anything went wrong.
 *
 * THE THREE PLACES IT MATTERED, and why each got the answer it did:
 *
 * 1. `loadWidgets` — THROW. `widgetShouldRender(null)` is false, so a missing
 *    row does not hide one section: with no rows at all, the hero, the
 *    greeting, the guest's own QR card and the RSVP gate ALL go false together
 *    and the invitation renders nearly blank. And that state is unreachable any
 *    other way — every event in production has exactly 16 widget rows, seeded
 *    at creation — so an empty list can only mean the read failed. A guest
 *    seeing it concludes the couple never filled their invitation in.
 *
 * 2. The face-enrolment probe — FAIL TOWARD SILENCE. A discarded error made a
 *    failed read look like "never enrolled", so the page asked a guest who had
 *    already given their face scan to give it again. Of the two ways to be
 *    wrong about biometric consent, re-asking is worse: it is a fresh
 *    collection prompt aimed at someone who already decided.
 *
 * 3. The 3D venue page — notFound(). `public_venue_scene` returns
 *    `{"published": false}` with NO error when no event matches the slug, so a
 *    mistyped address was told a specific couple had not posted their seating
 *    plan — for a couple who does not exist.
 *
 * 🔑 THE ANSWER IS NOT ALWAYS "THROW". It depends on what the false value
 * causes. Two reads in this same file deliberately keep their soft failure and
 * are asserted below so a later sweep does not "fix" them into page-breaking
 * throws.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// `new URL(...).pathname` percent-encodes the brackets in `[slug]`.
const HERE = dirname(fileURLToPath(import.meta.url));
const LOADERS = readFileSync(join(HERE, 'loaders.ts'), 'utf8');
const VENUE = readFileSync(join(HERE, '..', 'venue', 'page.tsx'), 'utf8');

function loaderSource(name: string): string {
  const start = LOADERS.indexOf(`export const ${name} = cache(`);
  assert.notEqual(start, -1, `${name} is gone or renamed — update this test.`);
  const next = LOADERS.indexOf('\nexport const ', start + 10);
  return LOADERS.slice(start, next === -1 ? undefined : next);
}

test('loadWidgets refuses to render a failed read as an empty invitation', () => {
  const src = loaderSource('loadWidgets');
  assert.match(
    src,
    /const \{ data: widgetsRaw, error \} = await/,
    'The error is discarded again — and an empty widget list is not a thinner ' +
      'page, it is a blank one.',
  );
  const handled = src.indexOf('if (error)');
  const usesData = src.indexOf('widgetsRaw ?? []');
  assert.ok(handled !== -1 && handled < usesData, 'The error must be handled BEFORE the empty-array fallback.');
  assert.match(src, /throw new Error/, 'It must throw — app/[slug]/error.tsx is what the guest should get.');
});

test('the face-enrolment prompt fails toward silence, never toward asking again', () => {
  const src = loaderSource('loadGuestContext');
  assert.match(
    src,
    /const \{ data: liveEnrollment, error: enrollError \} = await/,
    'The enrolment probe discards its error again.',
  );
  assert.match(
    src,
    /needsFaceEnroll = enrollError \? false : !liveEnrollment/,
    'A failed read must NOT produce a prompt. Re-asking for a face scan someone ' +
      'already gave is a fresh biometric collection aimed at a person who has ' +
      'already decided — worse than missing the prompt on one render.',
  );
});

test('the 3D venue page checks the event exists before blaming its couple', () => {
  assert.match(
    VENUE,
    /if \(!paletteRow\.data\) notFound\(\)/,
    'Without this, a mistyped address is told a specific couple has not posted ' +
      'their seating plan — for a couple who does not exist. The RPC answers ' +
      '{"published": false} with no error for an unknown slug, so the plate ' +
      'cannot tell the two apart on its own.',
  );
  assert.match(
    VENUE,
    /if \(paletteRow\.error\) \{[\s\S]*?throw new Error/,
    'A failed read is not a missing event — the same rule as the rest of the site.',
  );
  // Three causes used to share one plate; the two survivors must stay separate,
  // because one says "come back later" and the other says "try again now".
  assert.ok(
    VENUE.indexOf('if (error || !scene) {') !== -1 && VENUE.indexOf('if (!scene.published) {') !== -1,
    'The broken-read and not-yet-published states have been merged back into ' +
      'one message. They ask different things of the reader.',
  );
  assert.ok(
    !VENUE.includes('The couple&rsquo;s') && !VENUE.includes('Back to the wedding'),
    'The copy hardcodes "the couple" / "the wedding" again — this route also ' +
      'serves birthdays, debuts and christenings.',
  );
});

// ── the deliberate soft failures, pinned so a sweep does not "fix" them ──────

test('the seat lookup keeps its graceful degrade', () => {
  const src = loaderSource('loadGuestContext');
  assert.match(
    src,
    /\/\/ Graceful degrade — seating tables may not exist yet on all installs\./,
    'The seat probe is wrapped in a try/catch on purpose: "Not yet assigned" is ' +
      'a NORMAL state on most events (the chart is made late) and the fallback ' +
      'is neutral, not an accusation. Throwing here would break the whole ' +
      'invitation for a state that is usually simply true.',
  );
});

test('the vendor doorway keeps its soft failure', () => {
  const src = loaderSource('loadVendorBooking');
  assert.match(
    src,
    /return null;/,
    'The vendor doorway is an EXTRA affordance on a page whose main audience is ' +
      'guests. A failed read hides a doorway from one supplier; a throw would ' +
      'blank the invitation for every guest at the wedding because a vendor ' +
      'table hiccuped. Wrong, but the cheaper wrong — left deliberately.',
  );
});

// ── every guest sub-route must find the event the same way ──────────────────

test('no guest sub-route matches the slug more strictly than the invitation itself', () => {
  // `loadEventShell` uses `.ilike`, so `/Cale-Ice` opens. Two sub-routes used
  // `.eq`, so the SAME capital letter that worked on the invitation made
  // `/Cale-Ice/invite` say "invalid link" and `/Cale-Ice/venue` a dead end.
  //
  // `invite` is where the menu's "Join" tab sends a visitor with no invitation
  // — the one door offered to a relative who wants to add themselves. A
  // forwarded link with a capital in it closed that door and told them the link
  // was bad.
  const routes = readdirSync(join(HERE, '..'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => join(HERE, '..', d.name, 'page.tsx'))
    .filter((f) => existsSync(f));

  const strict: string[] = [];
  for (const file of routes) {
    const src = readFileSync(file, 'utf8');
    if (/\.eq\('slug',/.test(src)) strict.push(file.split('/').slice(-2).join('/'));
  }
  assert.deepEqual(
    strict,
    [],
    `These guest routes match the slug case-SENSITIVELY while the invitation ` +
      `itself does not, so the same link works on one and fails on the other: ` +
      `${strict.join(', ')}. Use .ilike.`,
  );
});
