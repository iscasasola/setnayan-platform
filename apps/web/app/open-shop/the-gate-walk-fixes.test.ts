/**
 * GUARD — "Open your shop", the owner's 2026-11-06 live gate walk (DECISION_LOG 2026-11-06 "OPEN YOUR SHOP — THE
 * GATE-WALK FIXES"; plan `plans/open-shop-fixes-2026-11-06/PLAN.md`, Session A, items A1–A10).
 *
 * The pure rules are executed in their own tests (`lib/open-shop-phone.test.ts`, `lib/open-shop-logo.test.ts`,
 * `lib/taxonomy-search-close-matches.test.ts`, `tests/db/a-shop-logo-keeps-its-frame.db.test.ts`). This file holds
 * the WIRING — that each screen still draws the rule — read from the source with comments stripped, the shape this
 * folder's other guards use (`four-steps.test.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { TIER_CAPS, categoryLadder } from '@/lib/vendor-tier-caps';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const WIZARD = read('app/open-shop/_components/open-shop-wizard.tsx');
const ACTIONS = read('app/open-shop/actions.ts');
const PAGE = read('app/open-shop/page.tsx');
const ACCOUNT = read('lib/open-shop-account.server.ts');
const PICKER = read('app/open-shop/_components/service-picker.tsx');
const CITY_PIN = read('app/open-shop/_components/city-pin.tsx');
const TAKEN = read('app/open-shop/_components/taken-sign-in.tsx');
const LOGO_SCREEN = read('app/open-shop/logo/_components/add-your-logo.tsx');
const LOGO_PAGE = read('app/open-shop/logo/page.tsx');
const FRAME = read('app/_components/logo-frame-control.tsx');

/* ── A1 · email confirm on the shop door ─────────────────────────────────────────────────────────────────────── */

test('A1 · the confirm flip runs ONLY when verification is not required — the /signup switch', () => {
  assert.match(ACCOUNT, /const mustConfirm = isEmailVerificationRequired\(\);/);
  const flips = [...ACCOUNT.matchAll(/email_confirm: true/g)];
  assert.equal(flips.length, 1, 'one flip, no second ungated one');
  assert.match(
    ACCOUNT,
    /mustConfirm \? Promise\.resolve\(null\) : admin\.auth\.admin\.updateUserById\(userId, \{ email_confirm: true \}\)/,
    'the flip is not behind the verification switch',
  );
});

test('A1 · flag on → nobody is signed in, the shop opens, the page says "We sent a link to <email>"', () => {
  assert.match(ACCOUNT, /if \(mustConfirm\) return \{ ok: 'check-email', user: \{ id: userId, email \} \};/);
  // Returned BEFORE the direct sign-in, which an unconfirmed account would be refused.
  assert.ok(ACCOUNT.indexOf("if (mustConfirm) return") < ACCOUNT.indexOf('signInWithPassword'));
  assert.match(ACCOUNT, /mustConfirm \? '\/vendor-dashboard' : '\/open-shop'/, 'the link does not land on the dashboard');
  assert.match(ACTIONS, /checkEmail = created\.user\.email;/);
  assert.match(ACTIONS, /if \(checkEmail\) redirect\(`\/open-shop\?check_inbox=\$\{encodeURIComponent\(checkEmail\)\}`\);/);
  // The shop is written for that account first: the check-email redirect is after the shop's own update.
  assert.ok(ACTIONS.indexOf('if (checkEmail) redirect') > ACTIONS.indexOf('.update(patch)'));
  assert.match(PAGE, /sentTo=\{guest && checkInbox \?/);
  // `sent` is a global toast word (toast-from-params) — the landing must never use it.
  assert.doesNotMatch(ACTIONS, /open-shop\?sent=/);
  assert.match(WIZARD, /We sent a link to \{sentTo\} — tap it to finish/);
});

test('A1 · flag off → today’s behaviour: flipped, signed in, the welcome mail sent', () => {
  assert.match(ACCOUNT, /confirmed = !mustConfirm && confirmResult\.status === 'fulfilled';/);
  assert.match(ACCOUNT, /mustConfirm \? Promise\.resolve\(null\) : sendEmail\(\{/);
  assert.match(ACCOUNT, /signInWithPassword\(\{ email, password \}\)/);
});

test('A1 · the account is created only after every field of the shop has passed', () => {
  const create = ACTIONS.indexOf('await createVendorAccountForShop(');
  // The location refusal is `locationStepError({…})` since 2026-11-06 (pin · yes · city, the wizard's own rule) —
  // retargeted from the bare `OPEN_SHOP_ERRORS.locationCity` it replaced; `events` joined the same day.
  for (const refusal of ['OPEN_SHOP_ERRORS.shopName', 'OPEN_SHOP_ERRORS.slugTaken', 'OPEN_SHOP_ERRORS.service', 'OPEN_SHOP_ERRORS.events', 'locationStepError({']) {
    const at = ACTIONS.indexOf(refusal);
    assert.ok(at > 0 && at < create, `${refusal} is checked after the account exists — a refusal then strands an unconfirmed account`);
  }
});

/* ── A2 · logo off step 1, asked after the shop opens ────────────────────────────────────────────────────────── */

test('A2 · the signed-out wizard has no upload; a new shop goes to "Add your logo"', () => {
  assert.doesNotMatch(WIZARD, /<FileUpload\b/);
  assert.match(ACTIONS, /if \(!logoUrl && !existingHasLogo\) redirect\(OPEN_SHOP_LOGO_PATH\);/);
});

test('A2 · the logo screen: round preview, the Maker control, Skip → Today, saved by My Shop’s own logo save', () => {
  assert.match(LOGO_SCREEN, /Add your logo/);
  assert.match(LOGO_SCREEN, /roundPreview/);
  assert.match(LOGO_SCREEN, /<LogoFrameControl\b/);
  assert.match(LOGO_SCREEN, /href="\/vendor-dashboard"[\s\S]{0,300}Skip for now/);
  assert.match(LOGO_SCREEN, /useActionState<[^>]*>\(updateVendorProfileField, null\)/);
  assert.match(LOGO_SCREEN, /name="field" value="logo"/);
  assert.match(LOGO_PAGE, /resolveOwnedActiveShop\(supabase, user\.id\)/, 'the screen reads the same shop the save writes');
});

test('A2 · the control IS the Maker’s: its sets, its keypad label, its "How close" menu', () => {
  assert.match(FRAME, /HUB_FOCAL_POINTS\.map/);
  assert.match(FRAME, /HUB_ZOOMS\.map/);
  assert.match(FRAME, /aria-label=\{`Keep area \$\{f\} of 9 in frame`\}/);
  assert.match(FRAME, /label="How close"/);
  assert.match(FRAME, /name="logo_focal"/);
  assert.match(FRAME, /name="logo_zoom"/);
  const maker = read('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');
  assert.match(maker, /aria-label=\{`Keep area \$\{f\} of 9 in frame`\}/, 'the Maker’s control changed — re-read this copy');
});

test('A2 · My Shop’s logo row carries the same control, and its save writes the frame', () => {
  const row = read('app/vendor-dashboard/shop/_components/editable-row.tsx');
  assert.match(row, /<LogoRowControl data=\{data\} onDirty=\{onDirty\} \/>/);
  assert.match(row, /<LogoFrameControl\b/);
  const save = read('app/vendor-dashboard/actions.ts');
  const logoCase = save.slice(save.indexOf("case 'logo': {"), save.indexOf("case 'business_name': {"));
  assert.match(logoCase, /logoFrameColumns\(/);
});

test('A2 · the logo surfaces draw through logoFrameStyle', () => {
  for (const f of ['app/_components/vendor-avatar.tsx', 'app/v/[slug]/page.tsx', 'app/vendor-dashboard/shop/_components/editable-row.tsx', 'app/_components/logo-frame-control.tsx']) {
    assert.match(read(f), /logoFrameStyle\(/, `${f} draws the logo without its frame`);
  }
  assert.match(read('app/vendor-dashboard/shop/page.tsx'), /frame=\{data\.logoFrame\}/);
});

/* ── A3 · primary service, simpler ───────────────────────────────────────────────────────────────────────────── */

test('A3 → v11 · search on top, the CATEGORIES as photo tiles under their group headings, a category → its services as rows', () => {
  // v11 (owner, prototype 6 Nov): "categories are photo tiles on the first screen" — the group icon grid (A3) became the
  // category grid; one tap on a category shows its services, so there is still no third tap between.
  assert.ok(PICKER.indexOf('aria-label="Search services"') < PICKER.indexOf('data-open-shop-categories'));
  assert.match(PICKER, /data-open-shop-categories=""/);
  assert.match(PICKER, /balancedRows\(cats\)/, 'rows that fill the width (4 → 2+2, 5 → 3+2)');
  assert.match(PICKER, /data-open-shop-category-services=\{opened\.category\.tileId\}/);
  assert.match(PICKER, /All categories/);
  assert.doesNotMatch(PICKER, /openBranch|data-open-shop-groups/, 'the group grid (a third tap) is back');
});

test('A4 · the picker calls the SHARED ranker with reviewed aliases — no private substring search', () => {
  assert.match(PICKER, /rankTaxonomyOptionsWithClose\(flat, q, 30\)/);
  assert.match(PICKER, /aliases: l\.aliases/);
  assert.doesNotMatch(PICKER, /\.startsWith\(q\)|\.includes\(q\)/, 'the private search is back');
  assert.match(PICKER, /Close matches/);
  assert.match(PAGE, /reviewedAliasesByLiveTrade\(/);
  // Never auto-picked: a close match is a row the vendor taps, like any hit.
  assert.doesNotMatch(PICKER, /onPick\(close\[0\]/);
});

/* ── A5 · plan limit at the pick ─────────────────────────────────────────────────────────────────────────────── */

test('A5 · the hint, with the categories per plan read from TIER_CAPS', () => {
  // 🔁 Retargeted 2026-11-06 to the approved redesign's words (the prototype's `planHint2`), the ⓘ now the label's.
  assert.match(WIZARD, /label="Add more later\. How many categories you can run depends on your plan"/);
  assert.match(WIZARD, /ariaLabel="Categories per plan"/);
  assert.match(PAGE, /planCategories=\{categoryLadder\(\)\}/);
  const ladder = categoryLadder();
  assert.ok(ladder.length >= 3);
  const solo = ladder.find((l) => l.plan.includes('Solo'))!;
  assert.equal(solo.categories, `${TIER_CAPS.solo.parentCategories} categories`, 'the number is not TIER_CAPS’');
  assert.ok(!ladder.some((l) => /Custom/.test(l.plan)), 'Custom is retired from the app (2026-11-06)');
});

/* ── A6 · events you serve: Select all · Clear ───────────────────────────────────────────────────────────────── */

test('A6 · Select all dims when all are on, Clear when none', () => {
  assert.match(WIZARD, /disabled=\{eventTypeOptions\.every\(\(e\) => events\.includes\(e\.key\)\)\}[\s\S]{0,200}Select all/);
  assert.match(WIZARD, /disabled=\{events\.length === 0\}[\s\S]{0,200}Clear/);
});

/* ── A7 · phone box (rules executed in lib/open-shop-phone.test.ts) ──────────────────────────────────────────── */

test('A7 · the wizard draws the +63 box and refills it from a draft', () => {
  // The box now also draws its own refusal (owner 2026-11-06: every error under its box).
  assert.match(WIZARD, /<PhoneField digits=\{phoneDigits\} onDigits=\{setPhoneDigits\} error=\{errorFor\('contact_phone'\)\} \/>/);
  assert.match(WIZARD, /if \(d\.phone\) setPhoneDigits\(phoneDigitsFromTyped\(d\.phone\)\);/);
});

/* ── A8 · email already has an account → sign in right here ──────────────────────────────────────────────────── */

test('A8 · "taken" comes ONLY from the submit, and turns step 3 into the shipped in-place sign-in', () => {
  assert.match(ACCOUNT, /error: OPEN_SHOP_ACCOUNT_ERRORS\.emailTaken, taken: true/);
  assert.match(ACTIONS, /const takenParam = created\.taken \? '&taken=1' : '';/);
  assert.match(PAGE, /emailTaken=\{taken === '1'\}/);
  assert.match(WIZARD, /useState\(guest && emailTaken\)/);
  assert.match(WIZARD, /\{taken \? \(\s*<TakenSignIn/);
  assert.match(TAKEN, /useActionState\(signInInPlace, SIGN_IN_IN_PLACE_INITIAL\)/);
  assert.match(TAKEN, /<TurnstileField action="login" \/>/);
  assert.match(TAKEN, /router\.refresh\(\)/, 'success must refresh in place, never navigate (the typing stays)');
  assert.doesNotMatch(TAKEN, /router\.push|redirect\(/);
});

test('A8 · never checked while typing (it would reveal who has an account)', () => {
  for (const src of [WIZARD, TAKEN]) {
    assert.doesNotMatch(src, /lookupSignInDoor|emailExists|checkEmail\(|fetch\(/);
  }
});

/* ── A9 · location blocked → say so ──────────────────────────────────────────────────────────────────────────── */

test('A9 · a refused "Use my location" says what to do, under the map', () => {
  const ask = CITY_PIN.slice(CITY_PIN.indexOf('const useMyLocation'), CITY_PIN.indexOf('const copy ='));
  assert.match(ask, /setLocationRefused\(true\)/, 'the refusal is silent again');
  assert.match(CITY_PIN, /Couldn&rsquo;t get your location — type your address or drag the pin\./);
  assert.ok(CITY_PIN.indexOf('data-location-refused') > CITY_PIN.indexOf('ref={mapDivRef}'), 'the line is not under the map');
});

/* ── A10 · fee box → ⓘ ───────────────────────────────────────────────────────────────────────────────────────── */

test('A10 · one line, the numbers inside the ⓘ, still before "Open my shop"', () => {
  const at = WIZARD.indexOf('data-testid="open-shop-fee-disclosure"');
  assert.ok(at > 0);
  const line = WIZARD.slice(at, WIZARD.indexOf('</p>', WIZARD.indexOf('</InfoTip>', at)));
  // The sentence IS the ⓘ's label (2026-11-06, the prototype: "…through Setnayan ⓘ", no full stop before the ⓘ).
  assert.match(line, /label="Free to open, free to run\. You pay only when a couple books you through Setnayan"/);
  assert.match(line, /<InfoTip[\s\S]*\{feeNotice\.detail\}/, 'the numbers left the ⓘ');
  assert.ok(at < WIZARD.indexOf('Open my shop — free'), 'the fee line moved below the button');
});
