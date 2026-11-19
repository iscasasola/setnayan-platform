/**
 * lib/supplier-onboarding.test.ts — 🚪 THE SUPPLIER ONBOARDING, ONE FLOW (owner 2026-11-19, DECISION_LOG "SUPPLIER CLAIM
 * ONBOARDING (couple QR) APPROVED", "SUPPLIER ONBOARDING — BOTH DOORS APPROVED (v3)"). Each owner rule, run or read:
 *
 *   1. Five screens; Create account is SECOND, not last; the plan sits on the LAST screen.
 *   2. "Check your shop" is ONE list, a sheet per fact, in the drawing's order; the map pin stays; a missing fact holds.
 *   3. The first card: Approve needs a price · Edit opens the SHIPPED Card Maker · Skip makes no card. No price guessed.
 *   4. Today's welcome reads `?claimed=1` (nothing did before) and `?opened=1`; three steps; no leads promised.
 *   5. The self-serve door replaces the 5-step wizard WITHOUT dropping a fact it collected.
 *   6. The door lands on Today's welcome (not the logo screen); `/open-shop/logo` stays reachable from it.
 *   7. The main button of an invite door says "Accept", never "Claim it". The look is the supplier blue.
 *
 * SABOTAGE (each run once, each went red): ONBOARDING_SCREENS with 'account' last → 1; `firstCardRefusal` letting an
 * approve through with no price → 1; `welcomeFrom` ignoring `claimed` → 1; dropping `number` from SELF_SERVE_FACTS → 2.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ACCEPT_LABEL,
  CHECK_FACTS,
  FIELD_FACT,
  FIRST_CARD_ERRORS,
  ONBOARDING_SCREENS,
  ONBOARDING_STEP,
  SELF_SERVE_FACTS,
  TODAY_WELCOME_LINE,
  TODAY_WELCOME_STEPS,
  WELCOME_CLAIMED_PATH,
  WELCOME_OPENED_PATH,
  checkRows,
  draftFirstCard,
  firstCardLanding,
  firstCardRefusal,
  firstMissing,
  parseCardPrice,
  welcomeFrom,
} from './supplier-onboarding';
import { OPEN_SHOP_FIELD_STEP } from './open-shop-error-field';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const WIZARD = read('app/open-shop/_components/open-shop-wizard.tsx');
const ACTION = read('app/open-shop/actions.ts');
const TODAY = read('app/vendor-dashboard/page.tsx');
const WELCOME = read('app/vendor-dashboard/_components/today-welcome.tsx');

test('1 · five screens, the account SECOND, the plan on the LAST', () => {
  assert.deepEqual([...ONBOARDING_SCREENS], ['open', 'account', 'check', 'card', 'done']);
  assert.equal(ONBOARDING_STEP.account, 2, 'Create account is second, not last');
  assert.equal(ONBOARDING_STEP.done, ONBOARDING_SCREENS.length);
  // The account boxes refuse onto screen 2; the name + main service onto screen 1 (PB1 — one screen).
  for (const f of ['contact_email', 'password', 'terms', 'way'] as const) assert.equal(OPEN_SHOP_FIELD_STEP[f], 2, f);
  assert.equal(OPEN_SHOP_FIELD_STEP.shop_name, 1);
  assert.equal(OPEN_SHOP_FIELD_STEP.service, 1);
  // The plan is drawn on the last screen, never as a gate on the first.
  assert.match(WIZARD, /overFree \? <PlanOnLastScreen \{\.\.\.planProps\} \/> : null/);
  assert.doesNotMatch(WIZARD, /<PlanSheet\b/);
});

test('2 · Check your shop is ONE list, a sheet per fact, in the drawing’s order', () => {
  assert.deepEqual([...CHECK_FACTS], ['name', 'contact', 'categories', 'events', 'where', 'number', 'package', 'pay']);
  // Every box the 5-step wizard collected after the first screen lives in a sheet on the list.
  for (const f of ['events', 'extras', 'location', 'contact_name', 'contact_phone'] as const) {
    assert.equal(OPEN_SHOP_FIELD_STEP[f], 3, `${f} refuses onto Check your shop`);
    assert.ok(FIELD_FACT[f], `${f} has a sheet`);
    assert.ok(SELF_SERVE_FACTS.includes(FIELD_FACT[f]!), `${f}'s sheet is on the self-serve list`);
  }
  // The map pin stays — "Where you are" is still the shipped CityPin, now inside its sheet.
  assert.match(WIZARD, /data-onboarding-fact="where"[\s\S]{0,1200}<CityPin/);
  // A missing fact holds Continue and is the one it opens.
  const rows = checkRows(SELF_SERVE_FACTS, { name: 'Banawe Florals', contact: 'Ana', categories: 'Florist', events: '3 of 5', where: 'Quezon City' });
  assert.equal(firstMissing(rows), 'number');
  assert.equal(rows.find((r) => r.fact === 'number')?.missing, true);
  assert.equal(firstMissing(checkRows(SELF_SERVE_FACTS, { name: 'a', contact: 'b', categories: 'c', events: 'd', where: 'e', number: 'f' })), null);
  // The self-serve door draws no package / pay rows — it has nothing to show in them.
  assert.ok(!SELF_SERVE_FACTS.includes('package') && !SELF_SERVE_FACTS.includes('pay'));
});

test('3 · the first card: Approve needs a price · Edit opens the shipped Card Maker · Skip makes no card', () => {
  assert.equal(firstCardRefusal({ choice: 'approve', title: 'Wedding florals', price: '' }), FIRST_CARD_ERRORS.price);
  assert.equal(firstCardRefusal({ choice: 'approve', title: 'Wedding florals', price: '0' }), FIRST_CARD_ERRORS.price);
  assert.equal(firstCardRefusal({ choice: 'approve', title: 'Wedding florals', price: '25000' }), null);
  assert.equal(firstCardRefusal({ choice: 'edit', title: 'Wedding florals', price: '' }), null, 'Edit needs no price');
  assert.equal(firstCardRefusal({ choice: 'skip', title: '', price: '' }), null);
  assert.equal(firstCardRefusal({ choice: null, title: '', price: '' }), FIRST_CARD_ERRORS.choose);
  // Drafted from the service; the price is the supplier's — never guessed.
  assert.deepEqual(draftFirstCard({ serviceLabel: 'Florist' }), { title: 'Florist', price: '' });
  assert.equal(draftFirstCard({ serviceLabel: 'Florist', price: 12500 }).price, '12500');
  assert.equal(parseCardPrice('₱12,500'), 12500);
  assert.equal(parseCardPrice(''), null);
  // Where each way lands.
  assert.equal(firstCardLanding({ choice: 'approve', cardId: 'x', category: 'florist' }), WELCOME_OPENED_PATH);
  assert.equal(firstCardLanding({ choice: 'skip', cardId: null, category: 'florist' }), WELCOME_OPENED_PATH);
  assert.equal(firstCardLanding({ choice: 'edit', cardId: 'abc', category: 'florist' }), '/vendor-dashboard/services/abc');
  assert.equal(firstCardLanding({ choice: 'edit', cardId: null, category: 'florist' }), '/vendor-dashboard/services/new/florist');
  assert.equal(firstCardLanding({ choice: 'approve', cardId: 'x', category: 'f', welcome: WELCOME_CLAIMED_PATH }), WELCOME_CLAIMED_PATH);
  // The card is made by the SHIPPED card maker's own action — never a second insert path.
  assert.match(ACTION, /import \{ createVendorService \} from '@\/app\/vendor-dashboard\/services\/actions'/);
  assert.match(ACTION, /await createVendorService\(fd\)/);
  assert.doesNotMatch(ACTION, /from\('vendor_services'\)\s*\.insert/);
});

test('4 · Today’s welcome reads ?claimed=1 and ?opened=1 — three steps, no leads promised', () => {
  assert.equal(welcomeFrom({ claimed: '1' }), 'claimed');
  assert.equal(welcomeFrom({ opened: '1' }), 'opened');
  assert.equal(welcomeFrom({}), null);
  assert.equal(welcomeFrom({ claimed: 'yes' }), null);
  assert.deepEqual(
    TODAY_WELCOME_STEPS.map((s) => s.label),
    ['Add the clients you already have', 'Add your logo', 'Get verified'],
  );
  assert.ok(TODAY_WELCOME_STEPS.some((s) => s.href === '/open-shop/logo'), 'the logo screen stays reachable');
  assert.doesNotMatch(TODAY_WELCOME_LINE, /lead|inquir|booking/i, 'no leads are promised');
  assert.match(TODAY, /const welcome = welcomeFrom\(search\)/);
  assert.match(TODAY, /<TodayWelcome kind=\{welcome\}/);
  assert.match(WELCOME, /TODAY_WELCOME_STEPS\.map/);
});

test('5 · no fact the 5-step wizard collected is dropped', () => {
  for (const name of [
    'name="shop_name"',
    'name="primary_service"',
    'name="contact_name"',
    'name="contact_position"',
    'name="contact_email"',
    'name="password"',
    'name={TERMS_FIELD}',
    'name={EXTRA_SERVICES_FIELD}',
    'name={MAIN_SERVICE_EVENTS_FIELD}',
    'name={SPECIALTIES_FIELD}',
    '<PhoneField',
    '<CityPin',
    '<EventTiles',
    '<AddressPreview',
    '<NameHold',
  ]) {
    assert.ok(WIZARD.includes(name), `the wizard still posts ${name}`);
  }
});

test('6 · the door lands on Today’s welcome, never forced through the logo screen', () => {
  assert.doesNotMatch(ACTION, /redirect\([^)]*OPEN_SHOP_LOGO_PATH/);
  assert.match(ACTION, /firstCardLanding\(/);
  assert.equal(WELCOME_OPENED_PATH, '/vendor-dashboard?opened=1');
  assert.equal(WELCOME_CLAIMED_PATH, '/vendor-dashboard?claimed=1');
});

test('7 · the invite door says "Accept"; the onboarding wears the supplier blue', () => {
  assert.equal(ACCEPT_LABEL, 'Accept');
  assert.match(WIZARD, /import '@\/app\/vendor-dashboard\/_components\/supplier-look\.css'/);
  assert.match(WIZARD, /data-open-shop-wizard="" data-supplier-look=""/);
});
