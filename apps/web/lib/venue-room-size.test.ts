/**
 * venue-room-size.test.ts — the venue's size may SUGGEST, never overwrite.
 *
 * A couple picks their room from six generic presets — Intimate 14×10 ·
 * Standard 20×30 · Grand · Garden · Estate · Field, defaulting to Standard —
 * for a venue they have already booked. Every table, every aisle and the whole
 * 3D walk their guests explore is built on that guess.
 *
 * 🔑 THE RULE THIS FILE EXISTS FOR: the couple's own number always wins. A
 * vendor editing their profile months later must never reshape a plan that is
 * already being worked on. "Already set" includes a room sized once and
 * furnished ever since — which is why the check is on the couple's dimensions,
 * not on whether they have "recently" touched anything.
 *
 * ⚠ And the reason this shipped WITH its reader: a column plus a vendor form
 * and no couple-side read is a setting with a writer and nobody listening — the
 * exact mirror of the four gates-with-no-handle found on 2026-08-05. Both
 * halves or neither.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldSuggestVenueSize } from './venue-room-size';

test('a couple who has not sized their room gets the suggestion', () => {
  assert.equal(shouldSuggestVenueSize(null, null), true);
  assert.equal(shouldSuggestVenueSize(undefined, undefined), true);
});

test('a couple who HAS sized their room is left alone', () => {
  assert.equal(
    shouldSuggestVenueSize(18, 24),
    false,
    'Their number wins. A venue editing its profile must not reshape a plan ' +
      'that already has tables in it.',
  );
});

test('a half-set room still counts as theirs', () => {
  // Either side present means they have been in here. Treating a half-set room
  // as "unset" would let a suggestion overwrite the side they DID set.
  assert.equal(shouldSuggestVenueSize(18, null), false);
  assert.equal(shouldSuggestVenueSize(null, 24), false);
});

test('a zero or negative stored value is not a room', () => {
  // Nothing should write these, but a 0 reaching here must not be read as "the
  // couple chose zero" and block the suggestion forever.
  assert.equal(shouldSuggestVenueSize(0, 0), true);
  assert.equal(shouldSuggestVenueSize(-5, -5), true);
});

test('the venue category matches the one the rest of the app already uses', async () => {
  // Two readers, one word. `lib/std-venues.ts` calls the reception category
  // 'venue'; if these ever diverge the lookup silently matches nothing and the
  // feature just quietly stops suggesting — no error, no clue.
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'venue-room-size.ts'), 'utf8');
  const std = readFileSync(join(here, 'std-venues.ts'), 'utf8');

  const mine = /const VENUE_CATEGORY = '([a-z_]+)'/.exec(src)?.[1];
  const theirs = /const RECEPTION_CATEGORY = '([a-z_]+)'/.exec(std)?.[1];
  assert.ok(mine, 'the venue category constant is gone');
  assert.equal(
    mine,
    theirs,
    `The reception category diverged: this file says '${mine}', std-venues says ` +
      `'${theirs}'. The lookup would match nothing and fail silently.`,
  );
});

test('an enquiry is not a booking', async () => {
  // Sizing a plan from a venue the couple never books is worse than not sizing
  // it — they would furnish a room they end up not having.
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'venue-room-size.ts'), 'utf8');
  // 🔴 THIS ONCE ASSERTED AGAINST THREE INVENTED VALUES. The module used to
  // declare its own `['booked','confirmed','completed']` — NONE of which exist
  // in the `vendor_status` enum (`considering · shortlisted · contracted ·
  // deposit_paid · delivered · complete`), so the query matched NOTHING, EVER,
  // and this test happily confirmed that none of them were 'shortlisted'.
  // A test can only be as real as the values it checks.
  assert.match(
    src,
    /import \{ BOOKED_VENDOR_STATUSES \} from '\.\/vendors'/,
    'The module declares its own status list again. Reuse the shared one — it ' +
      'is `satisfies ReadonlyArray<VendorStatus>`, so a phantom value breaks ' +
      'the build instead of silently emptying the query.',
  );
  assert.match(src, /\.in\('status', BOOKED_VENDOR_STATUSES/, 'the query stopped using it');

  const vendors = readFileSync(join(here, 'vendors.ts'), 'utf8');
  const real = /BOOKED_VENDOR_STATUSES = \[([^\]]+)\]/.exec(vendors)?.[1] ?? '';
  for (const loose of ['considering', 'shortlisted']) {
    assert.ok(
      !real.includes(`'${loose}'`),
      `'${loose}' counts as booked — a couple would have their room sized by a ` +
        `venue they have not committed to.`,
    );
  }
  assert.ok(real.includes('contracted'), 'nothing counts as booked at all');
});

test('the read fails toward silence, and says why that is safe here', async () => {
  // Everywhere else on this codebase, collapsing "failed" and "absent" has been
  // a defect. Here it is correct — the only consequence is no suggestion, and
  // the couple picks a preset exactly as they do today. The file must SAY so,
  // because the next reader will otherwise "fix" it into a throw that stops a
  // seating plan from opening.
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'venue-room-size.ts'), 'utf8');
  assert.match(
    src,
    /A seating plan must never fail to open because a suggestion could not be/,
    'The reasoning for the catch was removed. Without it this reads as the ' +
      'silent-absence bug rather than the one place it is the right answer.',
  );
});

// ── THE HALF I ACTUALLY SHIPPED BROKEN ──────────────────────────────────────
//
// 🔴 The first version of this feature shipped the columns, the vendor's form
// and THIS MODULE — and nothing called it. A venue could type its room size and
// nothing anywhere would change: a reader with no caller, which is the same
// defect as a column with no writer, wearing the other shoe. The PR body
// claimed "ships all three halves together, on purpose". It did not.
//
// It was caught by the owner asking "all complete?" and by grepping for the
// caller rather than trusting the claim. These assertions exist so the answer
// is checkable instead of remembered.

test('the reader is actually wired into the seating page', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const page = readFileSync(
    join(here, '..', 'app', 'dashboard', '[eventId]', 'seating', 'page.tsx'),
    'utf8',
  );
  assert.match(
    page,
    /fetchBookedVenueRoomSize\(supabase, eventId\)/,
    'Nothing fetches the venue size. The vendor fills in their room and the ' +
      'couple never sees it — a reader with no caller.',
  );
  assert.match(
    page,
    /shouldSuggestVenueSize\(/,
    'The page fetches the size but never asks whether it may be used, so it ' +
      'would either always or never apply.',
  );
  assert.match(
    page,
    /suggestedRoomSize=\{/,
    'The page resolves the suggestion and does not pass it to the editor.',
  );
});

test('the editor seeds from it, and the couple can still override', async () => {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const editor = readFileSync(
    join(here, '..', 'app', 'dashboard', '[eventId]', 'seating', '_components', 'seating-editor.tsx'),
    'utf8',
  );
  assert.match(
    editor,
    /width: floorPlan\.venue_width_m \?\? suggestedRoomSize\?\.widthM \?\? 20/,
    'The precedence broke. The couple\'s own number must come FIRST, the ' +
      'venue\'s second, and the historical 20×30 last.',
  );
  assert.match(
    editor,
    /Sized from/,
    'The couple is not told where the number came from. A room that silently ' +
      'resizes itself is alarming.',
  );
  // The note must stop claiming the venue's authorship once they change it.
  assert.match(
    editor,
    /venue\.width === suggestedRoomSize\.widthM/,
    'The provenance note is shown unconditionally, so it keeps crediting the ' +
      'venue for a size the couple has since changed.',
  );
});

test('the vendor has a FORM, not just an action that would accept one', async () => {
  // 🔴 THE SECOND HALF I SHIPPED BROKEN. The action allowlisted `venue_size` and
  // validated four numbers — and no screen posted any of them, so a venue still
  // could not state its room. An action with no form is the same defect as a
  // reader with no caller and a column with no writer: three shapes, one bug,
  // all three shipped in this one feature before it was done.
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const row = readFileSync(
    join(here, '..', 'app', 'vendor-dashboard', 'shop', '_components', 'editable-row.tsx'),
    'utf8',
  );

  // Every name the action reads must be posted by a real input.
  for (const field of ['venue_width_m', 'venue_length_m', 'capacity_min', 'capacity_max']) {
    assert.ok(
      new RegExp(`name="${field}"`).test(row),
      `No input posts '${field}', so the action can never receive it and the ` +
        `vendor cannot state it.`,
    );
  }

  // And the page must feed the saved values back in, or the form is write-only
  // and a vendor loses their answer every time they reopen it.
  const page = readFileSync(
    join(here, '..', 'app', 'vendor-dashboard', 'shop', 'page.tsx'),
    'utf8',
  );
  assert.match(
    page,
    /venue_width_m: profile\.venue_width_m != null \? String\(profile\.venue_width_m\) : ''/,
    'The saved room size is not fed back to the form.',
  );

  // The row must only be offered to venues — an irrelevant row on every shop is
  // how a checklist gets ignored.
  const profileLib = readFileSync(join(here, 'vendor-profile.ts'), 'utf8');
  assert.match(
    profileLib,
    /\(profile\?\.services \?\? \[\]\)\.includes\('venue'\)/,
    'The room-size row is offered to every vendor, including florists.',
  );
  // …and the columns must be SELECTED, or every value reads back as undefined.
  assert.ok(
    profileLib.includes('venue_width_m,venue_length_m,capacity_min,capacity_max'),
    'The profile select does not fetch the columns, so the form always renders ' +
      'blank and the checklist never shows the row as done.',
  );
});
