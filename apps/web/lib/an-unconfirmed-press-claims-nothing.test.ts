/**
 * an-unconfirmed-press-claims-nothing.test.ts — 📵 A PRESS THAT WAS NOT CONFIRMED NEVER LOOKS DONE — AND A MONEY PRESS
 * NEVER CLAIMS MORE THAN IT KNOWS.
 *
 * `a-failed-press-never-replaces-the-maker.test.ts` holds that these presses no longer THROW. Catching is only half:
 * the catch must not then draw the press as having worked, and for money it must not say "it failed" either — a
 * request that never ANSWERED may have reached us. What each press does when its answer never came:
 *
 *   checkout · Submit ....... says we could not CONFIRM it, that nothing is charged here, and that sending again
 *                              cannot make a second order — true because the drawer mints ONE reference when it
 *                              opens, sends it with every submit, and `orders.reference_code` is UNIQUE.
 *   checkout · voucher ...... the action's own "couldn't check that code"; nothing is redeemed by a check.
 *   Save the Date ........... launch never looks launched; schedule never looks scheduled; cancel never looks
 *                              cancelled — state moves only on `res.ok`.
 *   schedule · Announce ..... never "sent", never "failed": the words stay, the list is re-read, the line says look.
 *   Mood Board · remove ..... the photo is put back, and it says so.
 *   floor plan · Save ....... "Unsaved" stays; the handle stays where it was dragged.
 *
 * ── NOT CLAIMED ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *   · These read SOURCE (the components need a browser, a router and server actions to run). Each assertion was
 *     mutation-checked once when written.
 *   · After an unanswered Submit whose order DID land, pressing again is refused by the unique reference and the
 *     person reads the action's own refusal (a database sentence today) — no second order, but not a kind line.
 *     The action was not changed: `checkout/actions.ts` is money and has no idempotent replay to return.
 *   · That the reference is non-empty on the first submit rests on it being minted in a mount effect.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { namedFunctions, neverRejects, parseSource } from '@/lib/transition-await-scan';

const WEB = join(__dirname, '..');
const E = 'app/dashboard/[eventId]';
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(raw(rel));
const count = (s: string, needle: string) => s.split(needle).length - 1;

test('checkout · an unanswered Submit is "not confirmed" — never "not ordered" — and stays on the form', () => {
  const src = code(`${E}/_components/inline-checkout-drawer.tsx`);
  const line = /const ORDER_NOT_CONFIRMED =\s*'([^']+)';/.exec(src)?.[1] ?? '';
  assert.equal(line, 'We couldn’t confirm that your order reached us, and nothing was charged here. Please send it again — sending it twice cannot create a second order.');
  // It claims only what is known. An unanswered request is not known to have failed.
  assert.doesNotMatch(line, /did not go through|was not placed|not ordered|failed|no order/i, 'the line says the order failed — nobody knows that');
  assert.match(src, /let result: SubmitOrderResult;\s*try \{\s*result = await submitOrderAction\(fd\);\s*\} catch \{\s*result = \{ ok: false, reason: ORDER_NOT_CONFIRMED \};\s*\}/);
  // …and it is drawn by the form's own alert, with the form still mounted (the success card needs `ok`).
  assert.match(src, /submitResult && submitResult\.ok === false \? \(\s*<p\s+role="alert"/);
  assert.match(src, /revealSuccess && submitResult\?\.ok \? \(/);
});

test('checkout · "sending it twice cannot create a second order" is TRUE: one reference per drawer, unique in the database', () => {
  const src = code(`${E}/_components/inline-checkout-drawer.tsx`);
  // Minted once, when the drawer mounts — never per submit.
  assert.match(src, /const \[referenceCode, setReferenceCode\] = useState\(''\);\s*useEffect\(\(\) => \{\s*setReferenceCode\(generateClientReference\(\)\);\s*\}, \[\]\);/);
  assert.equal(count(src, 'setReferenceCode('), 1, 'the reference is minted in more than one place — a retry may carry a new one');
  assert.match(src, /if \(referenceCode\) fd\.set\('preminted_reference', referenceCode\);/);
  // The server writes THAT reference on the order…
  const action = code(`${E}/checkout/actions.ts`);
  assert.match(action, /const premintedRaw = formData\.get\('preminted_reference'\);\s*const referenceCode =\s*typeof premintedRaw === 'string' && \/\^SN\[0-9A-F\]\{8\}\$\/\.test\(premintedRaw\.trim\(\)\)\s*\? premintedRaw\.trim\(\)\s*: generateReferenceCode\(\);/);
  assert.match(action, /reference_code: referenceCode,/);
  // …a refused insert is a refusal, never a success…
  assert.match(action, /if \(orderErr \|\| !orderRow\) \{[\s\S]{0,700}?return \{\s*ok: false,/);
  // …and the column is UNIQUE, in the migration that made the table and in every later one that touches it.
  const migrations = join(WEB, '..', '..', 'supabase', 'migrations');
  const made = readFileSync(join(migrations, '20260513150000_iteration_0034_payments.sql'), 'utf8');
  const orders = made.slice(made.search(/CREATE TABLE[^;]*\borders\b/i));
  assert.match(orders.slice(0, orders.indexOf(');')), /reference_code\s+TEXT NOT NULL UNIQUE/, 'orders.reference_code is not UNIQUE where the table is made');
  const dropped = readdirSync(migrations).filter((f) => /DROP CONSTRAINT[^;]*orders_reference_code_key|DROP INDEX[^;]*orders_reference_code/i.test(readFileSync(join(migrations, f), 'utf8')));
  assert.deepEqual(dropped, [], 'a migration drops the unique reference — a retry could then create a second order');
});

test('checkout · an unanswered voucher check is the action’s own "couldn’t check" — nothing applied', () => {
  const src = code(`${E}/_components/inline-checkout-drawer.tsx`);
  assert.match(src, /const VOUCHER_NOT_CHECKED = 'We couldn’t check that code\. Please try again\.';/);
  assert.match(src, /try \{\s*result = await applyVoucherAction\(null, fd\);\s*\} catch \{\s*result = \{ applied: false, code: null, discount_centavos: '0', final_centavos: originalPriceCentavos,[^}]*reason: VOUCHER_NOT_CHECKED \};\s*\}/);
});

test('Save the Date · launch never looks launched, schedule never scheduled, cancel never cancelled', () => {
  const file = `${E}/studio/save-the-date/_components/launch-std-button.tsx`;
  const answered = namedFunctions(parseSource(file, raw(file))).get('answered');
  assert.ok(answered && neverRejects(answered), '`answered` can reject — the three presses throw into their transition again');
  const src = code(file);
  assert.match(src, /catch \{\s*return \{ ok: false \};\s*\}/, 'an unanswered press is not a refusal');
  const fn = (name: string) => src.slice(src.indexOf(`function ${name}()`), src.indexOf('\n  }\n', src.indexOf(`function ${name}()`)));
  // Each press goes through `answered`, and moves the screen ONLY inside its `ok` branch.
  const launch = fn('doLaunch');
  assert.match(launch, /const res = await answered\(\(\) =>\s*save\.run\(\(\) => launchSaveTheDate\(eventId\)/);
  assert.equal(count(launch, 'setLaunched(true)'), 1);
  assert.ok(launch.indexOf('setLaunched(true)') > launch.indexOf('if (res.ok) {') && launch.indexOf('setLaunched(true)') < launch.indexOf('} else {'), 'a launch is shown outside its ok branch');
  assert.match(launch, /\} else \{\s*setError\('Could not launch right now — please try again\.'\);/);
  const schedule = fn('doSchedule');
  assert.match(schedule, /const res = await answered\(\(\) =>\s*save\.run\(\(\) => scheduleSaveTheDateLaunch\(eventId, pickValue\)/);
  assert.match(schedule, /if \(res\.ok && res\.scheduledAtIso\) \{\s*setScheduledAt\(res\.scheduledAtIso\);/);
  assert.equal(count(schedule, 'setScheduledAt('), 1);
  const cancel = fn('doCancel');
  assert.match(cancel, /const res = await answered\(\(\) =>\s*save\.run\(\(\) => cancelScheduledLaunch\(eventId\)/);
  assert.match(cancel, /if \(res\.ok\) \{\s*setScheduledAt\(null\);[\s\S]*?\} else \{\s*setError\('Could not cancel the schedule — please try again\.'\);/);
  assert.equal(count(cancel, 'setScheduledAt(null)'), 1, 'a cancel is shown outside its ok branch');
});

test('Announce · an unanswered send is neither "sent" nor "failed": the words stay and the list is re-read', () => {
  const src = code(`${E}/schedule/_components/announce-button.tsx`);
  assert.match(src, /const ANNOUNCE_NOT_CONFIRMED = 'We couldn’t confirm that went out\. Check your recent announcements below before sending it again\.';/);
  const caught = /try \{\s*result = await sendCoordinatorBroadcast\(fd\);\s*\} catch \{([\s\S]*?)\n      \}/.exec(src)?.[1] ?? '';
  assert.match(caught, /setError\(ANNOUNCE_NOT_CONFIRMED\);\s*router\.refresh\(\);\s*return;/);
  assert.doesNotMatch(caught, /setSent\(true\)|setText\(/, 'an unconfirmed send is drawn as sent, or the words are thrown away');
});

test('Mood Board · a photo whose remove was not confirmed is put back', () => {
  const src = code(`${E}/studio/mood-board/_components/inspiration-board.tsx`);
  assert.match(src, /const was = tiles\[key\(slot, pos\)\];/);
  assert.match(src, /try \{\s*await removeMoodboardSlot\(fd\);\s*\} catch \{\s*setTiles\(\(t\) => \(\{ \.\.\.t, \[key\(slot, pos\)\]: was \}\)\);\s*setError\('Could not remove — please try again\.'\);\s*\}/);
});

test('floor plan · a Save that was not confirmed stays "unsaved"', () => {
  const src = code(`${E}/studio/indoor-blueprint/_components/blueprint-studio.tsx`);
  assert.match(src, /try \{\s*await saveLoader\.run\(\(\) => saveAction\(fd\), \{[\s\S]*?\}\);\s*\} catch \{\s*setNotSaved\(true\);\s*return;\s*\}\s*setDirty\(false\);/);
  assert.match(src, /\{notSaved \? \(\s*<span role="alert"[^>]*>\s*That did not save\. Please try again\.\s*<\/span>\s*\) : dirty \? \(/);
});
