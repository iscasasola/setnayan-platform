/**
 * add-to-event-is-the-only-difference.test.ts — the service page must be the
 * same page signed out and signed in, apart from one button.
 *
 * Owner ruling, 2026-08-21: *"when you are not inside an event. it is only the
 * same as the signed out version"* and *"the only difference is add to an event
 * button."*
 *
 * 🔑 THE EASY MISTAKE IS AN ADDITION. Somebody later wants a "your events"
 * strip, a signed-in price note, a second CTA — each defensible alone, and each
 * one breaks the ruling. So this asserts the SHAPE of the swap rather than
 * trusting a comment: the doorway kit may branch on `studioKey` in exactly one
 * place, and that branch must render the ordinary primary link on the other
 * side.
 *
 * ⚠ SOURCE-LEVEL, and it says so. It proves the kit has one auth-shaped branch
 * in the CTA row; it cannot prove what a browser paints. The prototype and the
 * live page are where the look is judged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, '_doorway.tsx');
const CTA = join(HERE, 'add-to-event-cta.tsx');
const SHELL = join(HERE, '..', '..', '(shell)');

const kit = readFileSync(KIT, 'utf8');
const cta = readFileSync(CTA, 'utf8');
/** comments quote the very strings under test — strip them or the guard reads
 *  its own prose as evidence */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('the kit branches on studioKey exactly once, and only around the primary CTA', () => {
  const src = strip(kit);
  const branches = src.match(/\{studioKey \?/g) ?? [];
  assert.equal(
    branches.length,
    1,
    'the signed-in difference must be ONE swap. A second branch means the page ' +
      'has started to diverge beyond the single button the owner ruled on.',
  );
  assert.ok(
    /\{studioKey \?[\s\S]{0,400}<AddToEventCta[\s\S]{0,400}:[\s\S]{0,400}<Link href=\{primary\.href\}/.test(src),
    'the branch must render <AddToEventCta> on one side and the ordinary primary ' +
      '<Link> on the other, so a signed-out page is unchanged.',
  );
});

test('signed out renders the page’s own primary link, not a substitute', () => {
  const src = strip(cta);
  assert.ok(
    /if \(!state\.signedIn\)[\s\S]{0,240}<Link href=\{primary\.href\}[\s\S]{0,120}\{primary\.label\}/.test(src),
    'a stranger — and anyone whose events could not be read — must get the ' +
      'page’s own call to action, with its own href and its own label.',
  );
});

/**
 * 🔴 THE REGRESSION THIS EXISTS FOR. The first cut SWAPPED the primary CTA, and
 * "Start planning · free" is the CREATE button on all seven pages — so a
 * signed-in person could no longer start a celebration from the page at all.
 * Owner, within the hour: *"i lost the create button on my page."*
 *
 * "The only difference is add to an event button" means the page GAINS one. It
 * never means it trades one away.
 */
test('signed IN keeps the create button — the picker is added, never swapped in', () => {
  const src = strip(cta);
  // the signed-in return must contain BOTH the picker and the create link
  const signedInReturn = src.slice(src.indexOf('return (', src.indexOf('if (!state.signedIn)') + 40));
  assert.ok(
    /<AddToEvent\b/.test(signedInReturn),
    'the signed-in branch must render the picker',
  );
  assert.ok(
    /<Link href=\{primary\.href\}[\s\S]{0,160}\{primary\.label\}/.test(signedInReturn),
    'the signed-in branch must ALSO still render the page’s own create link. ' +
      'Removing it takes "start a celebration" away from exactly the people who ' +
      'are signed in — the owner lost that button once already.',
  );
});

test('the create row reuses the signed-out destination, inventing no second route', () => {
  const src = strip(cta);
  assert.ok(
    /createHref=\{primary\.href\}/.test(src),
    '"Start a new celebration" must go where "start planning" already goes. Two ' +
      'routes into creating a celebration from one page will drift apart.',
  );
});

test('every doorway that sells an addable service passes its key', () => {
  /*
    ⚠ `papic` LEFT THIS LIST ON 2026-08-29, AND IT IS A REAL REMOVAL — recorded
    here rather than quietly dropped, because it narrows an owner ruling.

    The 2026-08-21 ruling was *"the only difference is add to an event button."*
    On 2026-08-29 the owner ruled the Papic page has NO buttons at all
    ("we do not want the buttons on this page"), so there is no primary CTA left
    for `studioKey` to swap. A key on a page with no button governs nothing, and
    a control that governs nothing must not render — this repo's own rule.

    WHAT IT COSTS, stated plainly: a signed-in couple loses the *Add to an
    event* shortcut FROM THIS PAGE. It is a shortcut, not the capability —
    Papic is in the add-ons catalog and is added from the Studio inside the
    celebration itself. If the owner wants that one button back, it is the only
    button this page would carry, and that is his call, not a tidy-up.

    Every OTHER doorway still carries its key, which is what the assertion below
    is really protecting: this is one named exception, not a weakened rule.
  */
  /*
    ⚠ `pa3d` LEFT THIS LIST ON 2026-09-02 — the SECOND real removal, recorded
    here for the same reason the first was, because it narrows an owner ruling.

    Owner: *"i don't think we need this"*, of the closing CTA block. That was
    the page's only button, so — exactly as with Papic on 2026-08-29 — there is
    no primary CTA left for `studioKey` to swap, and a control that governs
    nothing must not render.

    WHAT IT COSTS, stated plainly: a signed-in couple loses the *Add to an
    event* shortcut FROM THIS PAGE. It is a shortcut, not the capability — 3D
    Plan is reached from the Studio inside the celebration itself. If the owner
    wants that one button back, it is the only button this page would carry.

    The two pages that left are the two that hand the product over on the page
    (`<PapicScan/>`, `<Pa3dRoom/>`); every page that can only DESCRIBE its
    product still carries its key, which is what the assertion below protects.
  */
  const expected = [
    'panood', 'pawebsite', 'palogo', 'setnayan-ai', 'patiktok',
    // The song — public page added 2026-08-21 so it could join the Studio rail.
    'pakanta',
    /*
      The mood board — public page added 2026-09-03 so it could join the Studio
      rail (owner: *"i do not see it"*).

      🔑 IT CARRIES A KEY EVEN THOUGH IT IS FREE, and the reason is in
      `add-to-event-data.ts`'s own docblock: *"NOTHING IS WRITTEN … the button
      is navigation."* The picker resolves `addOnHref`, so for a signed-in
      couple it is the shortest route from this page to their own board. Without
      the key the page's only button is "Start planning · free", which points a
      person who ALREADY has a wedding at the onboarding flow — the exact
      dead-end the 2026-08-21 ruling existed to remove.
    */
    'mood-board',
    /*
      The three free planning tools — public pages added 2026-09-05 so they
      could join the Studio rail (owner: *"Also add the other services.
      Marketplace to search for vendors with compare, Guestlist, Seatplan"*).
      Same reasoning as the Mood Board: each carries a key so a signed-in
      couple's button on the page is a door to THEIR tool, not the onboarding
      dead-end. The guest list and the marketplace resolve through
      `StudioApp.eventHref` (no catalogue add-on to go through); the seat plan
      keeps `seating`.
    */
    'marketplace',
    'guest-list',
    'seat-plan',
  ].sort();
  const found: string[] = [];
  for (const dir of readdirSync(SHELL, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    let page: string;
    try {
      page = readFileSync(join(SHELL, dir.name, 'page.tsx'), 'utf8');
    } catch {
      continue;
    }
    const m = page.match(/studioKey="([^"]+)"/);
    if (m?.[1]) found.push(m[1]);
  }
  assert.deepEqual(
    found.sort(),
    expected,
    'A service page without a key silently keeps the signed-out button for ' +
      'everybody — which looks fine and quietly withholds the feature.',
  );
});

test('the client half never imports the server-only decision module’s dependencies', () => {
  const client = readFileSync(join(HERE, 'add-to-event.tsx'), 'utf8');
  assert.ok(client.startsWith("'use client'"), 'the dialog is a client component');
  // A type-only import is erased at build time and is fine; a VALUE import of
  // the data module would drag the Supabase server client into the browser.
  assert.ok(
    /import type \{[^}]*AddToEventOption[^}]*\} from '\.\/add-to-event-data'/.test(client),
    'the option type must be imported as a TYPE from the server module',
  );
  assert.ok(
    !/^import \{[^}]*\} from '\.\/add-to-event-data'/m.test(client),
    'no value import from the server-only data module',
  );
});
