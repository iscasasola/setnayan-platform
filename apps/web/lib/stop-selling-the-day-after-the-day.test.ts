import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADD_ONS } from './add-ons-catalog';
import { addOnSellableNow } from './add-on-event-scope';

/**
 * stop-selling-the-day-after-the-day.test.ts
 *
 * Owner, 2026-08-21, asked what should happen to Live Studio, Papic cameras and
 * Custom QR once the celebration is over: **"stop offering them."** The card
 * still shows what it was; the buy path closes.
 *
 * 🛡 Every assertion mutation-checked by occurrence count.
 */

const WEB = dirname(dirname(fileURLToPath(import.meta.url)));
const code = (p: string) =>
  readFileSync(join(WEB, p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/*
  1 · THE LIST, BOTH DIRECTIONS.

  Named by KEY, never by line number — the source material for this work had two
  Papic SKUs swapped, and an implementer editing by the cited line would have
  closed PHOTO PRESERVATION, which is the one purchase that is by definition an
  after-the-event purchase.
*/
const MUST_CLOSE = [
  'papic',
  'papic-guest',
  'panood',
  'patiktok',
  'custom-qr-guest',
  'save-the-date',
  'indoor-blueprint',
  'event',
];
/*
  ⚠ `live-studio-roam` is FLAG-GATED — appended to `ADD_ONS` only when the Live
  Studio launch flag is on, which it is not in a test run. Asserting it through
  `ADD_ONS` would therefore assert nothing, and the first cut of this test did
  exactly that and failed for the right reason. It is checked at its source
  instead, so it cannot be the one entry that ships unflagged the day the owner
  turns the flag on.
*/
const FLAG_GATED_MUST_CLOSE = 'live-studio-roam';
const MUST_STAY_OPEN = [
  'editorial',
  'thank-you',
  'website-pro',
  'pakanta',
  'animated-monogram',
  'photo-delivery',
  'landing-page',
  'setnayan-ai',
];

test('exactly the services that ARE the day are flagged day-of only', () => {
  const flagged = ADD_ONS.filter((a) => a.dayOfOnly).map((a) => a.key).sort();
  assert.deepEqual(flagged, [...MUST_CLOSE].sort());
});

test('the flag-gated Live Studio entry carries the flag at its source', () => {
  const catalog = readFileSync(join(WEB, 'lib/add-ons-catalog.ts'), 'utf8');
  const entry = catalog.slice(catalog.indexOf('const LIVE_STUDIO_ENTRY'));
  const body = entry.slice(0, entry.indexOf('\n};') + 3);
  assert.match(body, new RegExp(`key: '${FLAG_GATED_MUST_CLOSE}'`), 'anchor still valid');
  assert.match(body, /dayOfOnly: true/, 'Live Studio is the day itself');
});

test('the services a person comes back FOR are not flagged', () => {
  for (const key of MUST_STAY_OPEN) {
    const entry = ADD_ONS.find((a) => a.key === key);
    assert.ok(entry, `${key} left the catalog — update this list deliberately`);
    assert.ok(!entry.dayOfOnly, `${key} must stay sellable after the event`);
  }
});

/*
  2 · THE PREDICATE. Narrow on purpose — see the module docblock for why the
  phase must NOT be threaded into `addOnOfferedForEvent`.
*/
test('a day-of service stops being sellable only once the event is over', () => {
  const dayOf = { dayOfOnly: true } as const;
  const after = {} as const;
  assert.equal(addOnSellableNow(dayOf, 'plan'), true);
  assert.equal(addOnSellableNow(dayOf, 'dayof'), true, 'still sellable ON the day');
  assert.equal(addOnSellableNow(dayOf, 'after'), false);
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    assert.equal(addOnSellableNow(after, phase), true, `after-services stay open in ${phase}`);
  }
});

/*
  3 · THE OWNED LIST MUST NOT BE TOUCHED.

  🚨 The obvious fix is the harm: `addOnOfferedForEvent`'s result is the SOLE
  parent of the Suite's `active` list — the services the couple has PAID FOR.
  A phase test there would delete a paid Live Studio from their own shelf the
  morning after their wedding.
*/
test('the owned-services gate never learns about the phase', () => {
  const scope = code('lib/add-on-event-scope.ts');
  const offered = scope.slice(
    scope.indexOf('export function addOnOfferedForEvent'),
    scope.indexOf('export function addOnSellableNow'),
  );
  assert.ok(offered.length > 0, 'both predicates must exist');
  assert.ok(!/phase/.test(offered), 'addOnOfferedForEvent must not read the phase');
  assert.ok(!/dayOfOnly/.test(offered), 'nor the day-of flag');
});

/*
  4 · THE BUY PATH IS CLOSED WHERE A POST LANDS, NOT ONLY WHERE A BUTTON IS.

  `submitOrderAction` is POST-able with any serviceKey — its action id ships in
  the client bundle of every drawer mount — so a gate in a page component closes
  the button and not the door. Fourteen drawers mount against these keys.
*/
test('the shared checkout refuses a day-of service once the event is over', () => {
  const checkout = code('app/dashboard/[eventId]/checkout/actions.ts');
  assert.match(checkout, /dayOfOnlyKeys/, 'the refusal must exist');
  assert.match(checkout, /getMenuLifecyclePhase\(/, 'and ask the one resolver');
  // BEFORE the charge resolvers — a filter inside one is the documented bypass.
  const guard = checkout.indexOf('dayOfOnlyKeys');
  // ⚠ the CALL, not the import at the top of the file. The first cut of this
  // assertion matched the import and reported the guard as running too late.
  const resolver = checkout.indexOf('resolveOrderChargeCentavos({');
  assert.ok(guard > 0 && resolver > 0 && guard < resolver, 'the refusal must precede pricing');
});

/*
  5 · THE FOUR PAPIC ACTIONS MINT ORDERS WITHOUT TOUCHING THAT CHECKOUT.
  A gate only in the shared action would be a button-not-a-door fix.
*/
test('every Papic purchase path refuses once the event is over', () => {
  const papic = code('app/dashboard/[eventId]/studio/papic/actions.ts');
  /*
    ⚠ THE LOCAL HELPER BECAME THE SHARED ONE (2026-08-21). It was
    `papicSaleIsClosed`, declared in this file with its own four-column read; the
    account-less guest buy path needed the same answer, so both now call
    `lib/event-is-over.server.ts`. This guard caught the rename on the very run
    that made it, which is what a guard keyed on the ACT rather than a vibe does.
  */
  assert.equal(
    (papic.match(/await eventIsOver\(admin, eventId\)/g) || []).length,
    4,
    'purchaseCameras · activateLimited · purchaseExtras · poolTopUp',
  );
  assert.match(papic, /from '@\/lib\/event-is-over\.server'/, 'one helper, not a second copy');
  // It must not use the capture window, which FAILS OPEN when unset.
  const helper = code('lib/event-is-over.server.ts');
  assert.match(helper, /getMenuLifecyclePhase\(/);
  assert.ok(!/captureWindow|papic_window/.test(helper), 'never the capture window');
});

/*
  6 · THE CARD STILL SHOWS. Dropping it would also delete it from the Suite's
  search index, so a couple typing "papic" would be told it does not exist.
*/
test('a closed service is re-shaped, not removed', () => {
  const suite = code('app/dashboard/[eventId]/suite/page.tsx');
  assert.match(suite, /if \(isClosed\(entry\)\) return null;/, 'the card stops being a link');
  assert.match(suite, /Event over/, 'and says why where the price was');
  // The pill rung must sit AFTER the owned rungs, or a paid service turns grey.
  const activeRung = suite.indexOf("text: 'Active'");
  const closedRung = suite.indexOf("text: 'Event over'");
  assert.ok(activeRung > 0 && closedRung > activeRung, 'owned rungs win');
  // And it must still be in the lists the search index is built from.
  assert.ok(!/addable = eligible[\s\S]{0,300}addOnSellableNow/.test(suite),
    'closed entries must NOT be filtered out of addable');
});

/*
  7 · A COUPLE WHO PAID KEEPS THEIR TOOL.
*/
test('the deep link sends an owner to their tool before it closes anything', () => {
  const about = code('app/dashboard/[eventId]/studio/about/[addon]/page.tsx');
  const ownership = about.indexOf('eventSkuActive(createAdminClient()');
  const closed = about.indexOf('entry?.dayOfOnly && eventHasHappened');
  assert.ok(ownership > 0 && closed > 0, 'both branches must exist');
  assert.ok(ownership < closed, 'ownership redirect must run FIRST or an owner gets a 404');
});

/*
  8 · THE SERVICES PAGE STOPS OFFERING, AND STOPS SPEAKING IN THE FUTURE.
*/
test('the services page closes its Add buttons and its future tense', () => {
  const launch = code('app/dashboard/[eventId]/launch/page.tsx');
  assert.match(launch, /getMenuLifecyclePhase\(/, 'the one resolver, not the website one');
  assert.ok(
    (launch.match(/eventHasHappened/g) || []).length >= 5,
    'the masthead, three blurbs and the Add branch',
  );
  assert.match(launch, /Event over/, 'the Add button becomes a closed chip');
});
