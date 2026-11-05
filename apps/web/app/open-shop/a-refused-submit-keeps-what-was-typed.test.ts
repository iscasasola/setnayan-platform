/**
 * a-refused-submit-keeps-what-was-typed.test.ts — a taken web address at Submit no longer throws the whole form away
 * (owner "yes to all" 2026-10-22, prototype `journey_fixes_later_2026-10-22.html` § Supplier 4c).
 *
 * ── THE DEFECT ──────────────────────────────────────────────────────────────
 * The step-1 check (`AddressPreview` + `checkShopAddress`) makes a taken address rare. The race it cannot stop — two
 * people, one word, one minute — ends at the unique index: `becomeVendor` redirects to `/open-shop?…&error=`, and the
 * page reloaded with only the banner. Name, logo, service, events and contact were React state, gone; a brand-new
 * supplier typed four steps again. The address box's own docblock promised "the field intact".
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. The shipped draft (`lib/open-shop-draft.ts`) carries a submit-time park — every typed field and the address
 *      that was sent — and never a password.
 *   2. A draft parked at submit restores ONLY on the error reload; the OAuth round-trip draft restores as before.
 *   3. The wizard parks as the form leaves (after its own gate passed), restores through that rule, and hands the
 *      refused address back to the address box (remounted, holding it).
 *   4. Every way `becomeVendor` sends the form back to `/open-shop` carries `error=` — so every refusal restores.
 *
 * Comments stripped before source matching (`lib/strip-comments.ts`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { parseOpenShopDraft, restoresOnThisLoad, serializeOpenShopDraft } from '@/lib/open-shop-draft';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

const TYPED = {
  step: 4 as const,
  shopName: 'Banawe Florals',
  logoUrl: 'r2://logos/banawe.png',
  service: 'florist',
  serviceLabel: 'Florist',
  events: ['wedding', 'debut'],
  position: 'Owner',
  phone: '09171234567',
  email: 'owner@banawe.ph',
  atSubmit: true as const,
  slug: 'banaweflorals',
};

test('a draft parked at submit carries every typed field and the address that was sent — never a password', () => {
  const now = 1_760_000_000_000;
  const raw = serializeOpenShopDraft({ ...TYPED, password: 'hunter22' } as never, now);
  assert.doesNotMatch(raw, /hunter22|password/i, 'a password reached web storage');
  const back = parseOpenShopDraft(raw, now + 60_000);
  assert.ok(back, 'a fresh submit-time draft did not parse');
  const { v: _v, at: _at, ...fields } = back;
  assert.deepEqual(fields, TYPED);
});

test('a submit-time draft restores only on the error reload; the OAuth draft always', () => {
  assert.equal(restoresOnThisLoad({ atSubmit: true }, true), true, 'the refusal reload does not restore');
  assert.equal(restoresOnThisLoad({ atSubmit: true }, false), false, 'a submit that succeeded would restore on the next visit');
  assert.equal(restoresOnThisLoad({}, false), true, 'the Google / Apple round trip no longer restores');
  assert.equal(restoresOnThisLoad({}, true), true);
});

test('the wizard parks as the form leaves, restores through the rule, and hands the address back', () => {
  const w = read('app/open-shop/_components/open-shop-wizard.tsx');
  const gate = w.slice(w.indexOf('const submitGate'), w.indexOf('const saveDraft'));
  assert.ok(gate.length > 0, 'submitGate / saveDraft moved');
  const validated = gate.indexOf('setBanner(null)');
  const parked = gate.indexOf('saveDraft({ atSubmit: true })');
  assert.ok(parked > 0, 'Submit no longer parks the typed steps');
  assert.ok(validated > 0 && parked > validated, 'the park runs before the gate passed (a refused gate would leave a stale draft)');
  assert.match(w, /atSubmit: true, slug: formRef\.current\?\.querySelector<HTMLInputElement>\('input\[name="business_slug"\]'\)/, 'the park no longer carries the address the form sends');
  assert.match(w, /restoresOnThisLoad\(d, Boolean\(error\)\)/, 'the restore no longer asks whether this load is the refusal');
  assert.match(w, /key=\{restoredSlug \?\? 'typed'\}[\s\S]{0,200}initialValue=\{restoredSlug\}/, 'the address box no longer gets the refused address back');
  // The OAuth row's capture must not pass its event as the `at` argument (an event is truthy).
  assert.doesNotMatch(w, /onSubmitCapture=\{saveDraft\}/, 'the OAuth park passes the submit event as `at`');
  const box = read('app/open-shop/_components/address-preview.tsx');
  assert.match(box, /useState\(initialValue \|\| derivedSlug\)/, 'the address box ignores the refused address');
});

test('every way becomeVendor sends the form back to /open-shop carries error= (so every refusal restores)', () => {
  const a = read('app/open-shop/actions.ts');
  const body = a.slice(a.indexOf('export async function becomeVendor'));
  const backs = [...body.matchAll(/redirect\(\s*(['`])\/open-shop([^'`]*)\1/g)].map((m) => m[2]!);
  assert.ok(backs.length >= 4, `only ${backs.length} redirects back to /open-shop found — the scan is looking at nothing`);
  const bare = backs.filter((q) => !/error=/.test(q));
  assert.deepEqual(bare, [], 'a refusal returns to /open-shop without error= — its parked draft would be thrown away');
});
