/**
 * a-guest-can-ask-us.test.ts — the two controls on a guest's own gallery both
 * do something, and the second one exists at all.
 *
 * ─── WHAT THIS EXISTS TO CATCH ─────────────────────────────────────────────
 * 🔴 "Not me" RENDERED ON EVERY PHOTOGRAPH AND COULD NOT WORK ON ANY OF THEM.
 * `removeMyTag` filtered `source = 'auto_face'`, and production holds 2 photo
 * tags in total, BOTH `manual_pick` — there has never been a single `auto_face`
 * tag, because face matching is off on every event. The button said
 * "Removing…", revalidated the page, and left the tag where it was. No error,
 * nothing logged, the only symptom an absence.
 *
 * ⚖ And a guest with no account had no way to ask us for anything — while the
 * consent box we show them reads *"I can remove my photo anytime in my
 * settings"* and cites RA 10173. They have no settings.
 *
 * Every source assertion runs over `stripComments` output and is anchored to
 * the ACT, never a bare identifier — this feature is named in a dozen comments
 * across the files it touches. Each was mutation-checked with the occurrence
 * count printed before → after:
 *
 *   the auto_face filter put back                1 → 2   RED
 *   askToTakeMyPhotoDown's session gate removed  1 → 0   RED
 *   the guest id read from the form instead      0 → 1   RED
 *   <TakeItDown> unmounted                       1 → 0   RED
 *   the reason changed to 'other'                1 → 0   RED
 *   the admin label removed                      1 → 0   RED
 *   remove_my_likeness dropped from the CHECK    1 → 0   RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
/** This directory is the event page; APP is `app/` for the admin read. */
const SLUG = HERE;
const APP = resolve(HERE, '..');
const MIGRATIONS = resolve(HERE, '..', '..', '..', '..', 'supabase', 'migrations');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const count = (h: string, n: string) => h.split(n).length - 1;

/** Find a migration by content, never by a remembered filename. */
function migrationNaming(marker: string): string {
  const hit = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => join(MIGRATIONS, f))
    .find((f) => readFileSync(f, 'utf8').includes(marker));
  assert.ok(hit, `No migration mentions ${marker}.`);
  return readFileSync(hit as string, 'utf8');
}

const actions = () => read(join(SLUG, 'actions.ts'));
const gallery = () =>
  read(join(SLUG, '_components', 'photos-of-you-gallery.tsx'));

test('"Not me" works on a tag however it got there', () => {
  const src = actions();
  /*
    🪤 SLICED TO THE NEXT EXPORT, NOT TO A CHARACTER COUNT. `stripComments`
    replaces a comment with SPACES so byte offsets survive — and the note
    explaining this very change is ~1,500 of them, so a fixed window ended
    before the code it was meant to read and the guard failed for the wrong
    reason.
  */
  const start = src.indexOf('export async function removeMyTag');
  const after = src.indexOf('export async function', start + 10);
  const fn = src.slice(start, after > start ? after : undefined);
  assert.ok(fn.length > 100, 'removeMyTag must still exist.');
  assert.equal(
    count(fn, "'auto_face'"),
    0,
    'removeMyTag must not filter on the tag SOURCE. It rendered on every ' +
      'photo and only matched face-recognition guesses, of which production ' +
      'has never held one — so the control did nothing, silently, at the ' +
      'moment somebody objects to their own image.',
  );
  assert.match(
    fn,
    /\.eq\('guest_id', session\.guest_id\)/,
    'It must still be scoped to the SESSION’s guest. Widening which tags it ' +
      'can remove must never widen WHOSE.',
  );
});

test('a guest can ask for the photograph itself to come down', () => {
  const src = actions();
  assert.match(
    src,
    /export async function askToTakeMyPhotoDown\(/,
    'A guest with no account had no way to ask us for anything, while the ' +
      'consent box promises them exactly this.',
  );
  const fn = src.slice(src.indexOf('export async function askToTakeMyPhotoDown'));
  assert.match(
    fn,
    /const session = await readGuestSession\(\);/,
    'The session IS the gate — an event page is public, so without it a ' +
      'stranger could file takedowns against a wedding all day.',
  );
  assert.match(
    fn,
    /session\.event_id !== eventId/,
    'A session for one celebration must not act on another.',
  );
  assert.equal(
    count(fn, "formData.get('guest"),
    0,
    'The guest id must never be read from the form. It comes from the cookie ' +
      'or the request does not happen.',
  );
  assert.match(
    fn,
    /reporter_guest_id: session\.guest_id/,
    'It must file under the guest column the reports table already has — the ' +
      'one built for somebody with no account.',
  );
  assert.match(
    fn,
    /reason: 'remove_my_likeness'/,
    'Filed as `other` it arrives indistinguishable from spam, and this is the ' +
      'one report carrying a statutory clock.',
  );
});

test('the tag comes off in the same press, before the request is filed', () => {
  /*
    Whatever we decide about the photograph, somebody objecting to their own
    likeness should stop being FILED under it immediately — that half needs
    nobody's permission and must not wait in a queue.
  */
  const src = actions();
  const fn = src.slice(src.indexOf('export async function askToTakeMyPhotoDown'));
  const untagAt = fn.indexOf("from('photo_tags')");
  const fileAt = fn.indexOf("from('user_reports')");
  assert.ok(untagAt > 0, 'The ask must also drop the guest’s own tag.');
  assert.ok(fileAt > 0, 'The ask must file a report.');
  assert.ok(
    untagAt < fileAt,
    'The tag must come off BEFORE the request is filed — it is the half that ' +
      'is theirs alone and it should not depend on a queue.',
  );
});

test('both controls are actually on the guest’s gallery', () => {
  const src = gallery();
  assert.equal(
    (src.match(/<TakeItDown[\s/>]/g) ?? []).length,
    1,
    'The takedown control must be MOUNTED, not merely defined. A component ' +
      'that is declared and never rendered is this repo’s most-repeated ' +
      'defect shape.',
  );
  assert.match(
    src,
    /action=\{removeMyTag\.bind\(/,
    '"Not me" must still be there — the two answer different questions.',
  );
  assert.match(
    src,
    /askToTakeMyPhotoDown\(\s*eventId/,
    'The control must call the action, not merely import it.',
  );
});

test('the queue has a word for it, and the database will accept that word', () => {
  const sql = migrationNaming('remove_my_likeness');
  assert.match(
    sql,
    /ADD CONSTRAINT user_reports_reason_check CHECK/,
    'The reason must be added to the CHECK. A value the database refuses is ' +
      'refused, not thrown — the row never lands and nobody is told.',
  );
  /*
    🪤 A CHECK IS WIDENED BY DROP + ADD, WHICH RETYPES THE WHOLE LIST. A value
    quietly missing from the retype does not fail: it silently makes every
    existing row of that kind un-writable. All five originals are pinned here,
    read out of production with pg_get_constraintdef rather than remembered.
  */
  for (const original of [
    'nudity_sexual',
    'violence',
    'hate_harassment',
    'spam',
    'not_my_event',
    'other',
  ]) {
    assert.ok(
      sql.includes(`'${original}'`),
      `The retyped CHECK dropped '${original}'. Widening a constraint must ` +
        `never narrow it.`,
    );
  }
  const adminPage = read(
    resolve(APP, 'admin', 'user-reports', 'page.tsx'),
  );
  assert.match(
    adminPage,
    /remove_my_likeness: '[^']+'/,
    'The queue must label it. An unlabelled reason renders the raw code at a ' +
      'person deciding about somebody’s photograph.',
  );
});
