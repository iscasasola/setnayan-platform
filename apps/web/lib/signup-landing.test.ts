/**
 * EXECUTES lib/signup-landing.ts — where a new account goes, who sees the You
 * card, and what that card may write (owner 2026-09-22: "small card for signup").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAND_NEW_WINDOW_MS,
  isBrandNewAccount,
  planYouCard,
  signupLanding,
  youHref,
  YOU_ERRORS,
  YOU_PATH,
} from './signup-landing';
import { PRESENCE_MARKERS } from './profile-personal-info-patch';

const form = (entries: Record<string, string>) => {
  const m = new Map(Object.entries(entries));
  return { has: (k: string) => m.has(k), get: (k: string) => m.get(k) ?? null };
};

test('a couple meets the You card, carrying where they were going', () => {
  assert.equal(signupLanding({ accountType: 'customer', next: '/' }), YOU_PATH);
  assert.equal(
    signupLanding({ accountType: 'customer', next: '/v/saysay' }),
    '/signup/you?next=%2Fv%2Fsaysay',
  );
  // never nests the card inside itself
  assert.equal(signupLanding({ accountType: 'customer', next: '/signup/you?next=%2F' }), '/signup/you?next=%2F');
});

test('a vendor goes straight on — /open-shop step 3 already asks the name', () => {
  assert.equal(signupLanding({ accountType: 'vendor', next: '/open-shop' }), '/open-shop');
  assert.equal(youHref('/'), YOU_PATH);
});

test('brand-new means created within the OAuth window, either side, and nothing else', () => {
  const now = 1_700_000_000_000;
  assert.equal(isBrandNewAccount({ createdAt: new Date(now - 30_000).toISOString(), now }), true);
  assert.equal(isBrandNewAccount({ createdAt: new Date(now + 30_000).toISOString(), now }), true, 'clock skew');
  assert.equal(isBrandNewAccount({ createdAt: new Date(now - BRAND_NEW_WINDOW_MS - 1).toISOString(), now }), false);
  assert.equal(isBrandNewAccount({ createdAt: null, now }), false);
  assert.equal(isBrandNewAccount({ createdAt: 'not a date', now }), false);
});

test('the display name is the one required thing', () => {
  assert.deepEqual(planYouCard(form({ display_name: '   ' }), { slug: null }), {
    ok: false,
    error: YOU_ERRORS.displayName,
  });
});

test('name, formal name, phone and photo go through the profile page’s own plan', () => {
  const plan = planYouCard(
    form({
      display_name: 'Maria Magsaysay',
      name_prefix: '',
      first_name: ' maria ',
      last_name: 'Magsaysay',
      phone: '+63 917 123 4567',
      [PRESENCE_MARKERS.profile_photo_url]: '1',
      profile_photo_url: 'r2://media/profile-photo/x',
    }),
    { slug: null },
  );
  assert.ok(plan.ok);
  assert.equal(plan.patch.display_name, 'Maria Magsaysay');
  assert.equal(plan.patch.first_name, 'maria', 'trimmed, never re-cased — what you typed stays as you typed it');
  assert.equal(plan.patch.name_prefix, null);
  assert.equal(plan.patch.phone, '+63 917 123 4567');
  assert.equal(plan.patch.profile_photo_url, 'r2://media/profile-photo/x');
  assert.equal(plan.slug, null);
});

test('a form without the photo control never touches the photo', () => {
  const plan = planYouCard(form({ display_name: 'Maria' }), { slug: null });
  assert.ok(plan.ok);
  assert.equal('profile_photo_url' in plan.patch, false);
});

test('the @account name is set ONCE, with the profile page’s shape and reserved rules', () => {
  const ok = planYouCard(form({ display_name: 'Maria', slug: ' Maria-Magsaysay ' }), { slug: null });
  assert.ok(ok.ok);
  assert.equal(ok.slug, 'maria-magsaysay');
  assert.deepEqual(planYouCard(form({ display_name: 'M', slug: 'ab' }), { slug: null }), {
    ok: false,
    error: YOU_ERRORS.slugShape,
  });
  assert.deepEqual(planYouCard(form({ display_name: 'M', slug: 'admin' }), { slug: null }), {
    ok: false,
    error: YOU_ERRORS.slugReserved,
  });
});

test('an account that already has an @name keeps it — a posted slug is ignored here', () => {
  const plan = planYouCard(form({ display_name: 'Maria', slug: 'somebody-else' }), { slug: 'maria' });
  assert.ok(plan.ok);
  assert.equal(plan.slug, null, 'renaming belongs to the profile page, behind its cap and log');
});

test('the showcase consent is recorded only when ticked, and never for a vendor', () => {
  const now = '2026-09-22T10:00:00.000Z';
  const yes = planYouCard(form({ display_name: 'Maria', public_summary_consent: 'yes' }), { slug: null, accountType: 'customer' }, now);
  assert.ok(yes.ok);
  assert.equal(yes.patch.public_summary_consent_at, now);
  const no = planYouCard(form({ display_name: 'Maria' }), { slug: null, accountType: 'customer' }, now);
  assert.ok(no.ok);
  assert.equal('public_summary_consent_at' in no.patch, false, 'unticked posts nothing, and nothing is not consent');
  const vendor = planYouCard(form({ display_name: 'Ana', public_summary_consent: 'yes' }), { slug: null, accountType: 'vendor' }, now);
  assert.ok(vendor.ok);
  assert.equal('public_summary_consent_at' in vendor.patch, false, 'a forged POST cannot consent a vendor to a showcase');
});
