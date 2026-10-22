/**
 * GUARD — THE FIRST RUN SAYS SETNAYAN, AND EACH STEP HANDS ON TO THE NEXT (owner 2026-10-21: "make sure there is
 * Setnayan" · "make it follow our design template and rules. make each step simple and easy to understand as
 * well"; prototype `first_run_you_and_next_steps_2026-10-21.html`; controller decisions, owner may veto).
 *
 * The properties held here (each sabotaged RED, then restored — see the PR body):
 *   1. EVERY FIRST-RUN SCREEN CARRIES THE SHIPPED WORDMARK: sign-up, the You card, "What do you need?" (the
 *      generic wizard and the Get-together form), and the open-shop wizard (one line above its four segments, so
 *      on every step) draw `FirstRunBrand` — which is the shipped `Wordmark`, never a redraw. The event-type picker
 *      draws NONE: it sits under the account bar, whose top bar already shows the mark + "Setnayan" at every
 *      width (2026-10-21) — one wordmark per screen, never two.
 *   2. A BRAND-NEW COUPLE'S DONE LANDS ON THE PICKER: `youCardOnward` swaps the default board for the event-type
 *      picker only when the account holds no event; an unknown count keeps the board; a real destination is never
 *      replaced. The page passes the swapped address to the card — so Done AND Later (which goes where Done goes).
 *      The picker draws no "Back to events" for an account with nothing behind it.
 *   3. THE WELCOME SHOWS ONCE: the host spotlight's welcome step is walked on the first run only — a replay
 *      ("Show me around") skips it — and it is not counted in "Step N of M".
 *   4. THE SUPPLIER SEES THE SHORT ROAD: under a setup Next card, "Then" lists the next two steps of the shipped
 *      rail in its own order, then the approval.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './strip-comments';
import { FIRST_EVENT_PATH, youCardOnward } from './signup-landing';
import { SIGNED_IN_LANDING } from './sign-in-landing';
import { TOURS } from './tours';
import { spotlightSteps } from './spotlight-steps';
import { buildFirstStepsRail, firstStepsThen } from './vendor-first-steps';

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('1 · every first-run screen draws the shipped wordmark', () => {
  const brand = read('app/_components/first-run-brand.tsx');
  assert.match(brand, /import \{ Wordmark \} from '\.\/brand-marks';/, 'FirstRunBrand is not the shipped Wordmark');
  assert.match(brand, /<Wordmark size=\{size\}/);
  for (const f of [
    'app/signup/page.tsx',
    'app/signup/you/_components/you-card.tsx',
    'app/onboarding/[type]/_components/generic-onboarding.tsx',
    'app/onboarding/simple/page.tsx',
    'app/open-shop/_components/open-shop-wizard.tsx',
  ]) {
    assert.match(read(f), /<FirstRunBrand\b/, `${f} has no SETNAYAN brand line`);
  }
  // The open-shop line is above the segments — outside every step's panel, so all four carry it.
  const wiz = read('app/open-shop/_components/open-shop-wizard.tsx');
  assert.ok(wiz.indexOf('<FirstRunBrand') > 0 && wiz.indexOf('<FirstRunBrand') < wiz.indexOf('role="progressbar"'), 'the brand line is inside one step');
  // The onboarding header no longer hand-draws a copy of the mark.
  assert.doesNotMatch(read('app/onboarding/[type]/_components/generic-onboarding.tsx'), /fill="#cb9e4b"/, 'a hand-drawn mark is back');
  // The sign-up and You cards put it ABOVE the eyebrow.
  for (const f of ['app/signup/page.tsx', 'app/signup/you/_components/you-card.tsx']) {
    const s = read(f);
    assert.ok(s.indexOf('<FirstRunBrand') < s.indexOf('className="hr-ov-eyebrow"'), `${f}: the brand line is not above the eyebrow`);
  }
});

test('2 · a brand-new couple’s Done goes to the picker — and only then', () => {
  assert.equal(youCardOnward(SIGNED_IN_LANDING, false), FIRST_EVENT_PATH);
  assert.equal(youCardOnward(SIGNED_IN_LANDING, true), SIGNED_IN_LANDING, 'an account with an event keeps its board');
  assert.equal(youCardOnward(SIGNED_IN_LANDING, null), SIGNED_IN_LANDING, 'an unread count must never read as "no events"');
  assert.equal(youCardOnward('/e/abc/connect', false), '/e/abc/connect', 'a real destination is replaced');
  assert.equal(FIRST_EVENT_PATH, '/dashboard/create-event');

  const page = read('app/signup/you/page.tsx');
  assert.match(page, /\.from\('event_members'\)\s*\.select\('event_id', \{ count: 'exact', head: true \}\)\s*\.eq\('user_id', user\.id\)/);
  assert.match(page, /const onward = youCardOnward\(next, eventsError \? null : \(eventCount \?\? 0\) > 0\);/);
  assert.match(page, /<YouCard\b[^>]*\bnext=\{onward\}/, 'the card is not handed the onward address (Done and Later)');
  const card = read('app/signup/you/_components/you-card.tsx');
  assert.match(card, /<input type="hidden" name="next" value=\{next\} \/>/, 'Done does not post the address');
  assert.match(card, /<Link href=\{next\}[^>]*>\s*Later/, 'Later does not go where Done goes');

  const create = read('app/dashboard/(account)/create-event/page.tsx');
  assert.match(create, /nothingBehind = !error && \(count \?\? 0\) === 0;/, 'an unread count would hide the way back');
  assert.match(create, /<NewEventHead nothingBehind=\{nothingBehind\}/);
  // The first screen fits a 320 px phone. It was the "Para kanino ito?" rows (measured 2026-10-21: a long subtitle
  // held them at 334 px and the page zoomed out to 350); since 2026-10-22 (Host 3) there is no who-screen — the first
  // screen IS the grid, and the who is a compact dropdown whose long lines live in its list, not in the page column
  // (`create-event/the-grid-opens-first.test.ts`).
  const picker = read('app/dashboard/(account)/create-event/_components/event-type-picker.tsx');
  assert.doesNotMatch(picker, /Para kanino ito/, 'the who-screen is back in front of the grid');
  assert.match(picker, /<PickMenu[\s\S]{0,120}\bcompact\b/, 'the who must stay a compact dropdown on the first screen');
  const head = read('app/dashboard/(account)/create-event/_components/new-event-head.tsx');
  assert.match(head, /\{nothingBehind \? null : \(\s*<Link/, 'the way back is drawn with nothing behind it');
  // ONE wordmark on the picker: the account bar's top bar (mark + "Setnayan" at every width) — never a second
  // brand line in the page under it.
  assert.doesNotMatch(head, /<FirstRunBrand\b/, 'the picker says SETNAYAN twice (the top bar already does)');
  assert.match(read('app/dashboard/(account)/layout.tsx'), /<AccountBarSlot\b/, 'the picker lost the account bar — and with it the word');
  assert.match(
    read('app/_components/frontdoor/front-door.css'),
    /\.fd\[data-chrome='app'\]:has\(\[data-account-bar\]\) \.fd-wordmark-text \{\s*display: inline;/,
    'the account bar no longer draws the word on a phone',
  );
});

test('3 · the welcome shows once, and is not one of the steps', () => {
  const steps = TOURS.host_spotlight_v1.spotlight!.steps;
  const welcome = steps.filter((s) => s.welcome);
  assert.equal(welcome.length, 1, 'the host tour has no (or two) welcome steps');
  assert.equal(welcome[0]!.anchor, 'home-next', 'the welcome does not ring the Next card');
  assert.match(welcome[0]!.title, /\{name\}/);
  const i = steps.indexOf(welcome[0]!);
  assert.equal(steps[i + 1]!.title, 'Start here, every time', 'the shipped step does not follow the welcome');
  assert.equal(spotlightSteps(steps, true).length, steps.length, 'the first run skips the welcome');
  assert.equal(spotlightSteps(steps, false).filter((s) => s.welcome).length, 0, 'a replay shows the welcome again');
  const mount = read('app/_components/spotlight-mount.tsx');
  assert.match(mount, /steps=\{spotlightSteps\(script\.steps, run\.record\)\}/, 'the mount does not drop the welcome on a replay');
  assert.match(mount, /if \(!seen\) setRun\(\{ record: true,/, 'the first run is no longer the recorded one');
  const engine = read('app/_components/spotlight-tour.tsx');
  assert.match(engine, /const counted = steps\.filter\(\(s\) => !s\.welcome\)\.length;/, 'the welcome is counted in "Step N of M"');
  assert.match(engine, /step\.welcome \? 'Welcome' : `Step \$\{formatCount\(shownN\)\} of \$\{formatCount\(counted\)\}`/);
  assert.match(engine, /<Wordmark size=\{18\}/, 'the welcome does not carry the larger mark');
  assert.match(read('app/dashboard/layout.tsx'), /<Spotlight tourKey="host_spotlight_v1"[^>]*name=\{profile\?\.display_name \?\? null\}/);
});

test('4 · "Then" is the rail’s next two steps, then the approval', () => {
  const rail = (over: Partial<Parameters<typeof buildFirstStepsRail>[0]>) =>
    buildFirstStepsRail({
      verified: false,
      profileDone: 6,
      profileTotal: 6,
      serviceCount: 0,
      docsStatus: 'none',
      docsIn: 0,
      docsTotal: 4,
      submitMissing: [],
      customerCount: 0,
      ...over,
    });
  // S4: details done → the Next card is "Add what you offer".
  const s4 = rail({});
  assert.equal(s4.current?.key, 'service_card');
  // ⚠ Numbers moved by one ON PURPOSE (owner "Yes to all" 2026-10-22, journey_fixes Supplier 2 · A): "Add your
  // logo" is first step 2, so the documents are 4 and the approval 8. A complete profile has its logo, so it is
  // done here and not in "Then".
  assert.deepEqual(firstStepsThen(s4).map((s) => `${s.n} · ${s.title}`), [
    '4 · Send your documents',
    '5 · Mark the days you are not available',
    '8 · Setnayan approves you — you go live',
  ]);
  // S5: a service too → the Next card is "Send your documents".
  const s5 = rail({ serviceCount: 1 });
  assert.equal(s5.current?.key, 'documents');
  assert.deepEqual(firstStepsThen(s5).map((s) => s.n), [5, 6, 8]);
  assert.deepEqual(firstStepsThen(null), []);
  const view = read('lib/supplier-today-view.ts');
  assert.match(view, /then: next\.kind === 'setup' \? firstStepsThen\(input\.firstSteps\) : \[\],/);
  const screen = read('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  const at = screen.indexOf('data-today-then');
  assert.ok(at > screen.indexOf('<NextCard') && at < screen.indexOf('data-today-numbers'), '"Then" is not right under the Next card');
  assert.match(read('app/vendor-dashboard/_components/supplier-today-screen.tsx'), /then=\{view\.then\}/);
});
