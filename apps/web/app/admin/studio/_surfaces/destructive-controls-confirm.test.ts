/**
 * destructive-controls-confirm.test.ts — an irreversible admin control must say
 * what it is about to do, and name the thing, not its id.
 *
 * 🚨 FOUND BY THE OWNER LOOKING AT THE SCREEN, 2026-08-18, minutes after the
 * same catalogue was found to have silently lost 93 songs. Both controls on it
 * shipped with NO confirmation:
 *
 *   · a bare bin icon on every row of a 391-row list — one tap, gone, on a phone
 *   · Merge took TWO HAND-TYPED NUMBERS, deleted one song and re-pointed every
 *     couple's pick to the other, with nothing on screen naming which songs
 *     those numbers were
 *
 * 🔑 A DESTRUCTIVE CONTROL DRIVEN BY AN ID MUST SHOW THE THING, NOT THE ID. A
 * number cannot be sanity-checked by the person typing it; a title can. Typing
 * 688 where you meant 686 destroys the wrong song and silently rewrites what
 * couples chose, with no undo.
 *
 * ⚠ SCOPE, STATED. This reads SOURCE, so it proves the confirmation is wired,
 * not that a browser shows it. That is the honest ceiling of a static check and
 * is why the assertions below are anchored to the ACT (a confirm gating the
 * submit) rather than to the presence of a word.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTROLS = join(HERE, 'songs-danger-controls.tsx');
const SURFACE = join(HERE, 'songs-surface.tsx');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('the anchor: both files exist and are not stubs', () => {
  for (const p of [CONTROLS, SURFACE]) {
    assert.ok(
      existsSync(p) && readFileSync(p, 'utf8').length > 400,
      `${p} is missing or a stub — every assertion below would pass vacuously`,
    );
  }
});

test('deleting a song is gated by a confirmation that names the song', () => {
  const src = read(CONTROLS);
  const fn = /export function DeleteSongButton\([\s\S]*?\n}/.exec(src);
  assert.ok(fn, 'DeleteSongButton should exist');
  const body = fn[0];

  assert.match(body, /window\.confirm\(/, 'delete must ask before it destroys');
  // The confirmation must carry the SONG, not just a warning sentence — an id
  // the operator cannot check is the whole defect.
  assert.match(
    body,
    /describe\(song\)|\$\{song\.title\}/,
    'the confirmation must name the song being deleted, not just warn in general',
  );
  // …and refusing must actually stop the submit.
  assert.match(
    body,
    /if \(!ok\) e\.preventDefault\(\)/,
    'pressing Cancel must stop the form — a confirm whose answer is ignored is decoration',
  );
});

test('merging two songs is gated by a confirmation that names BOTH', () => {
  const src = read(CONTROLS);
  const fn = /export function MergeSongsFields\([\s\S]*?\n}\n/.exec(src);
  assert.ok(fn, 'MergeSongsFields should exist');
  const body = fn[0];

  assert.match(body, /window\.confirm\(/, 'merge must ask before it destroys');
  assert.match(
    body,
    /describe\(dup!?\)[\s\S]{0,400}?describe\(canon!?\)/,
    'the confirmation must name BOTH songs — the deleted one and the kept one. ' +
      'Two typed numbers cannot be checked by the person typing them.',
  );
  assert.match(
    body,
    /if \(!ok\) e\.preventDefault\(\)/,
    'pressing Cancel must stop the merge',
  );
  // An id that is not on screen is exactly where a typo hides.
  assert.match(
    body,
    /not in the\s*\n?\s*`? ?\+?\s*`?list on screen|not in the list on screen/,
    'an id the page cannot resolve must be called out, not merged silently',
  );
});

test('the surface renders the confirming controls, not a bare submit', () => {
  const src = read(SURFACE);
  assert.match(src, /<DeleteSongButton\b/, 'the row must use the confirming delete');
  assert.match(src, /<MergeSongsFields\b/, 'the merge form must use the confirming fields');
  // The regression is a bare button coming back — that is what shipped.
  assert.doesNotMatch(
    src,
    /aria-label=\{`Delete \$\{s\.title\}`\}/,
    'a bare unconfirmed delete button is back on the row',
  );
});

test('the merge form posts exactly the field names the action reads', () => {
  /*
    🪤 I BROKE THIS WHILE ADDING THE CONFIRMATION AND CAUGHT IT BY READING THE
    ACTION. Extracting the fields into a client component, I renamed
    `canonical_id` to `canon_id`. The server action still read `canonical_id`,
    so `parseId` would have returned null on every submit and merge would have
    answered "Enter two different valid song IDs." forever — a control that
    looks present, refuses every time, and blames the operator's typing.

    🔑 A FORM AND ITS ACTION AGREE BY CONVENTION, AND A CONVENTION IS NOT A
    CONTROL. Nothing type-checks the string on one side against the string on
    the other. Same family as the phantom column and the phantom RPC argument:
    the name is wrong, nothing throws, and the only symptom is that it never
    works.
  */
  const controls = read(CONTROLS);
  const actions = stripComments(
    readFileSync(join(HERE, '..', '..', 'songs', 'actions.ts'), 'utf8'),
  );

  const posted = [...controls.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]!);
  assert.ok(posted.length >= 2, 'the merge form should still post two fields');

  const readByAction = [...actions.matchAll(/formData\.get\('([a-z_]+)'\)/g)].map((m) => m[1]!);
  assert.ok(readByAction.length >= 2, 'the actions should still read form fields');

  for (const field of posted) {
    assert.ok(
      readByAction.includes(field),
      `the merge form posts "${field}" and no action reads it — the action will ` +
        `see undefined and refuse every submit while blaming the operator`,
    );
  }
});

/* ─── THE CURATE SWITCH ─────────────────────────────────────────────────────
   The song catalogue fills up from the BANDS; the seeded songs are a common
   starter set Setnayan curates. Until 2026-08-18 the screen printed "curated"
   as a read-only LABEL — you could delete a song and merge two, but you could
   not say "this belongs in the common list". When 93 songs fell out of it,
   nobody had a button to put one back.
──────────────────────────────────────────────────────────────────────────────*/

test('the curate switch writes through the client that can actually change it', () => {
  /*
    🚨 THE TRAP, AND IT WOULD HAVE BEEN BUILT TODAY BY THE PERSON FIXING THESE.
    The other two actions in that file use `createAdminClient()` to bypass RLS,
    so copying them is the obvious move. It would ship a control that SILENTLY
    DOES NOTHING: `songs_nonadmin_guard` pins `is_curated_pick` to its OLD value
    unless `public.is_admin()` is true, and `is_admin()` reads `auth.uid()`,
    which is NULL under service role. The UPDATE reports success, changes
    nothing, and the label does not move.

    🔑 A GATE WITH NO HANDLE — the shape this whole day has been about.

    Verified against production, not inferred: `songs_admin_update` admits
    `authenticated` where `is_admin()`, and both columns are UPDATE-granted to
    that role, so the same session satisfies the policy AND the trigger.
  */
  const src = stripComments(
    readFileSync(join(HERE, '..', '..', '..', 'admin', 'songs', 'actions.ts'), 'utf8'),
  );
  const fn = /export async function setSongCuratedAction\([\s\S]*?\n}/.exec(src);
  assert.ok(fn, 'setSongCuratedAction should exist');
  const body = fn[0];

  assert.match(
    body,
    /await createClient\(\)/,
    'the curate write must use the request-scoped client — the trigger only lets ' +
      'a real signed-in admin through',
  );
  assert.doesNotMatch(
    body,
    /createAdminClient\(\)/,
    'the curate write must NOT use the service-role client: the trigger pins the ' +
      'column to its old value there, so the control would report success and do nothing',
  );
  // Supabase resolves rather than throwing, so a filtered-out write is silent.
  assert.match(
    body,
    /data\.length === 0/,
    'a zero-row update must be reported — otherwise a refusal looks like a save',
  );
});

test('every row offers the switch, and the screen says what the states mean', () => {
  const src = read(SURFACE);
  /*
    🪤 ANCHORED TO THE RENDERED FORM, NOT THE SYMBOL. The first cut asserted
    `/setSongCuratedAction/` over the file — which the IMPORT LINE satisfies. The
    mutation that deletes the whole <form> from the row therefore left this
    GREEN, because the import stayed. A guard that matches a string rather than
    the act it names is decoration; measured, not guessed.
  */
  assert.match(
    src,
    /<form action=\{setSongCuratedAction\}/,
    'the row must RENDER the curate switch — importing the action is not offering it',
  );
  assert.match(
    src,
    /In the list|Add to list/,
    'the switch must be pressable text, not the read-only label it replaced',
  );
  assert.match(
    src,
    /most popular|starter repertoire/,
    'the screen must say what being in the common list actually does, since the ' +
      'catalogue fills up from the bands and the difference is not guessable',
  );
});
