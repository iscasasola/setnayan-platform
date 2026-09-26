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
import { signInDestination, SIGNED_IN_LANDING } from './sign-in-landing';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const form = (entries: Record<string, string>) => {
  const m = new Map(Object.entries(entries));
  return { has: (k: string) => m.has(k), get: (k: string) => m.get(k) ?? null };
};

test('a couple meets the You card, carrying where they were going', () => {
  // `/` is "came from nowhere" → the dashboard, never the front door (the same
  // answer /login and the Google/Apple callback give — audit 2026-09-25 §C).
  assert.equal(signupLanding({ accountType: 'customer', next: '/' }), '/signup/you?next=%2Fdashboard');
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

// ── ONE LANDING RULE FOR EVERY DOOR (owner 2026-09-25; audit §C) ───────────
// The rule is `signInDestination`. Where a person ends up after creating an
// account must be the same whether they used email, Google/Apple, or signed in:
//   · came from an event (its page, its invite) → back to that event, whole;
//   · came from the onboarding flow → back into it (`?resume=1`);
//   · came from nowhere (`/`) → the dashboard, which opens their own event when
//     they organise exactly one (`landingJumpTarget`) and is the home otherwise.

// SABOTAGE: return input.next unmapped in signupLanding → RED.
test('the landing rule: an event, the onboarding resume and a shop come back whole; nowhere is the dashboard', () => {
  assert.equal(signInDestination('/'), SIGNED_IN_LANDING);
  assert.equal(SIGNED_IN_LANDING, '/dashboard');
  for (const back of ['/maria-and-jose', '/maria-and-jose/invite', '/onboarding/wedding?resume=1', '/v/saysay']) {
    assert.equal(signInDestination(back), back, `${back} must come back whole`);
    assert.equal(signupLanding({ accountType: 'customer', next: back }), `/signup/you?next=${encodeURIComponent(back)}`);
  }
  // a vendor is never re-routed by the couple's rule
  assert.equal(signupLanding({ accountType: 'vendor', next: '/open-shop' }), '/open-shop');
  // the email door and the Google/Apple door now agree about `/`
  const viaEmail = signupLanding({ accountType: 'customer', next: '/' });
  const viaOAuth = youHref(signInDestination('/'));
  assert.equal(viaEmail, viaOAuth, 'two doors, one answer');
});

// SABOTAGE: drop signInDestination( from app/signup/you/page.tsx → RED.
test('the You card hands on through the same rule, on Done AND on Later', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) => stripComments(readFileSync(join(here, '..', rel), 'utf8'));
  const page = read('app/signup/you/page.tsx');
  const actions = read('app/signup/you/actions.ts');
  assert.match(page, /const next = signInDestination\(safeNext\(params\.next\)\)/, 'Later (the page) resolves `next` through the rule');
  assert.match(actions, /const next = signInDestination\(safeNext\(formData\.get\('next'\)\)\)/, 'Done (saveYou) resolves `next` through the rule');
});
