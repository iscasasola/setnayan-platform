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
  CHECK_FACT_LABEL,
  CHECK_FACTS,
  FIRST_CARD_CARRY_LINE,
  FIRST_CARD_NOT_LIVE,
  TODAY_WELCOME_DONE,
  firstCardLiveFrom,
  firstCardLivePath,
  firstCardStateFrom,
  welcomeDoneRow,
  ONBOARDING_HEADS,
  SELF_SERVE_LATER,
  checkFactEmpty,
  firstCardCarryPath,
  firstCardFrom,
  FIRST_CARD_WHY_KEY,
  FIELD_FACT,
  FIRST_CARD_ERRORS,
  ONBOARDING_SCREENS,
  ONBOARDING_STEP,
  SELF_SERVE_FACTS,
  TODAY_WELCOME_LINE_UNREAD,
  todayWelcomeLine,
  todayWelcomeSteps,
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
  // …and its tick is there for every shop (PB5): inside the plan past Free, on its own otherwise.
  assert.match(WIZARD, /overFree \? <PlanOnLastScreen \{\.\.\.planProps\} \/> : <PlanAgree /);
  assert.doesNotMatch(WIZARD, /<PlanSheet\b/);
});

test('2 · Check your shop is ONE list, a sheet per fact, in the drawing’s order', () => {
  assert.deepEqual([...CHECK_FACTS], ['name', 'categories', 'events', 'where', 'contact', 'number', 'package', 'pay']);
  // PB3's own order and short words (19 Nov fix: "copy, rows and steps drift from PB1–PB6").
  assert.deepEqual([...SELF_SERVE_FACTS], ['name', 'categories', 'events', 'where', 'contact', 'number', 'pay']);
  assert.deepEqual(
    SELF_SERVE_FACTS.map((f) => CHECK_FACT_LABEL[f]),
    ['Shop name', 'Services', 'Events', 'Where', 'Contact', 'Number', 'They pay you'],
  );
  assert.equal(checkFactEmpty('events'), 'Add the events you serve');
  assert.equal(checkFactEmpty('where'), 'Add your address');
  assert.equal(checkFactEmpty('number'), 'Add a number');
  assert.deepEqual([...ONBOARDING_HEADS.check], ['Your shop', 'Tap a row to fill it.']);
  // Q3 — a row opens a SHEET (PB3·a): the house backdrop + the house modal hook, the panel kept inside the one form.
  assert.match(WIZARD, /<OverlayBackdrop onClose=\{\(\) => setSheet\(null\)\}/);
  assert.match(WIZARD, /useModalA11y\(\{ open: step === CHECK_STEP && sheet !== null/);
  assert.match(WIZARD, /role: 'dialog', 'aria-modal': true/);
  // Every box the 5-step wizard collected after the first screen lives in a sheet on the list.
  for (const f of ['events', 'extras', 'location', 'contact_name', 'contact_phone'] as const) {
    assert.equal(OPEN_SHOP_FIELD_STEP[f], 3, `${f} refuses onto Check your shop`);
    assert.ok(FIELD_FACT[f], `${f} has a sheet`);
    assert.ok(SELF_SERVE_FACTS.includes(FIELD_FACT[f]!), `${f}'s sheet is on the self-serve list`);
  }
  // The map pin stays — "Where you are" is still the shipped CityPin, now inside its sheet.
  assert.match(WIZARD, /data-onboarding-fact="where"[\s\S]{0,1200}<CityPin/);
  // A missing fact holds Continue and is the one it opens.
  const rows = checkRows(SELF_SERVE_FACTS, { name: 'Banawe Florals', contact: 'Ana', categories: 'Florist', events: 'Wedding', where: 'Quezon City' }, SELF_SERVE_LATER);
  assert.equal(firstMissing(rows), 'number');
  assert.equal(rows.find((r) => r.fact === 'number')?.missing, true);
  // "They pay you" is Later: it never holds Continue.
  assert.equal(firstMissing(checkRows(SELF_SERVE_FACTS, { name: 'a', contact: 'b', categories: 'c', events: 'd', where: 'e', number: 'f' }, SELF_SERVE_LATER)), null);
  assert.ok(!SELF_SERVE_FACTS.includes('package'), 'the self-serve door has no booking to show');
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
  // Skip says so to the welcome, whose ticked row then names the shop alone (never "Your shop and first card").
  assert.equal(firstCardLanding({ choice: 'skip', cardId: null, category: 'florist' }), `${WELCOME_OPENED_PATH}&card=skipped`);
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
    ['Add the clients you already have', 'Add your logo', 'Get verified to be found'],
  );
  assert.ok(TODAY_WELCOME_STEPS.some((s) => s.href === '/open-shop/logo'), 'the logo screen stays reachable');
  for (const line of [TODAY_WELCOME_LINE_UNREAD, todayWelcomeLine({ tierState: 'free', verified: false })])
    assert.doesNotMatch(line, /lead|inquir|booking/i, 'no leads are promised');
  assert.match(TODAY, /const welcome = welcomeFrom\(search\)/);
  assert.match(TODAY, /<TodayWelcome\s+kind=\{welcome\}/);
  assert.match(WELCOME, /todayWelcomeSteps\(shop\)\.map/);
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

test('8 · a first card the door could not make is SAID on Today, never dropped (19 Nov review)', () => {
  // The Email way: nobody is signed in when the shop opens, so the confirm link carries the drafted card to the welcome.
  const waiting = firstCardCarryPath(WELCOME_OPENED_PATH, { state: 'waiting', title: 'Bridal bouquet', price: 8500, category: 'florist' });
  const q = Object.fromEntries(new URL(waiting, 'https://x.invalid').searchParams);
  assert.equal(q.opened, '1');
  assert.deepEqual(firstCardFrom(q), { state: 'waiting', title: 'Bridal bouquet', price: 8500, category: 'florist', why: null, id: null });
  // A refusal carries the maker's own sentence.
  // The reason rides as a KEY (ship review 21 Nov, `lib/first-card-why.ts`); a sentence handed in is never carried.
  const refused = firstCardCarryPath(WELCOME_OPENED_PATH, { state: 'refused', title: 'Bridal bouquet', price: 8500, category: 'florist', why: 'not-made' });
  assert.equal(firstCardFrom(Object.fromEntries(new URL(refused, 'https://x.invalid').searchParams))?.why, 'not-made');
  const sentence = firstCardCarryPath(WELCOME_OPENED_PATH, { state: 'refused', title: 'Bridal bouquet', price: 8500, category: 'florist', why: 'Remove the phone number.' });
  assert.equal(firstCardFrom(Object.fromEntries(new URL(sentence, 'https://x.invalid').searchParams))?.why, null);
  // Anything off on the address draws nothing (it is typed by anyone).
  assert.equal(firstCardFrom({ card: 'waiting', card_title: 'x', card_price: '0', card_category: 'florist' }), null);
  assert.equal(firstCardFrom({ card: 'made', card_title: 'x', card_price: '10', card_category: 'florist' }), null);
  assert.equal(firstCardFrom({ card: 'waiting', card_title: 'x', card_price: '10', card_category: '../x' }), null);
  // The action: the link lands on that welcome; a refused card lands there SAYING so — never a silent Today.
  assert.match(ACTION, /confirmNext: afterConfirm,/);
  assert.match(ACTION, /if \(made\.ok === false\) return firstCardCarryPath\(welcome, \{ \.\.\.card, state: 'refused', why: firstCardWhyKey\(made\.why, 'refused'\) \}\)/);
  assert.match(ACTION, /return \{ ok: false, why: refused \?\? FIRST_CARD_NOT_MADE \}/);
  assert.match(ACTION, /export async function approveFirstCard\(/);
  // The welcome draws it, with Approve card (the shipped maker, through `approveFirstCard`) and the Card Maker.
  assert.match(TODAY, /card=\{firstCardFrom\(search\)\}/);
  assert.match(WELCOME, /<form\s+action=\{approveFirstCard\}/);
  assert.match(WELCOME, /FIRST_CARD_CARRY_LINE\[card\.state\]/);
  assert.match(WELCOME, /role=\{card\.state === 'refused' \? 'alert' : undefined\}/);
  assert.ok(FIRST_CARD_CARRY_LINE.refused.includes('wasn’t made'));
  // The ticked row never claims a card that does not exist.
  assert.match(WELCOME, /\{welcomeDoneRow\(cardState\)\}/);
});

test('11 · "on your page" only when the shipped switch said yes — a refusal is said, no ✓ (20 Nov review)', () => {
  // The switch's answers, read: live; the live-cards cap refusing (its own sentence); the publish gate; no answer.
  assert.deepEqual(firstCardLiveFrom('/vendor-dashboard/services?saved=1'), { live: true });
  const cap = 'Your plan holds 1 live card. Turn one off, or upgrade in Plan.';
  assert.deepEqual(firstCardLiveFrom(`/vendor-dashboard/services?error=${encodeURIComponent(cap)}`), { live: false, why: cap });
  assert.deepEqual(firstCardLiveFrom('/vendor-dashboard/services?error=Add%20a%20cover%20photo%20first.'), { live: false, why: 'Add a cover photo first.' });
  assert.deepEqual(firstCardLiveFrom('/vendor-dashboard/services'), { live: false, why: FIRST_CARD_NOT_LIVE });
  assert.deepEqual(firstCardLiveFrom(null), { live: false, why: FIRST_CARD_NOT_LIVE });
  // The landings: live → `card=live`; refused by the switch → `card=draft` with ITS sentence and the card's id.
  assert.equal(firstCardLivePath(WELCOME_OPENED_PATH), `${WELCOME_OPENED_PATH}&card=live`);
  const id = '0b7e6c1a-3f1e-4c2b-9d5a-1a2b3c4d5e6f';
  // The switch's sentence is carried as its key (`cap-1`, ship review 21 Nov) — the welcome redraws the words.
  const draft = firstCardCarryPath(WELCOME_OPENED_PATH, { state: 'draft', title: 'Bridal bouquet', price: 8500, category: 'florist', why: 'cap-1', id });
  const got = firstCardFrom(Object.fromEntries(new URL(draft, 'https://x.invalid').searchParams));
  assert.equal(got?.state, 'draft');
  assert.equal(got?.why, 'cap-1');
  assert.equal(got?.id, id);
  assert.equal(firstCardFrom({ card: 'draft', card_title: 'x', card_price: '10', card_category: 'florist', card_id: '../x' })?.id, null);
  // The ticked row: the card ONLY on `card=live` — a bare `?opened=1`, a skip or a draft names the shop alone.
  assert.equal(welcomeDoneRow(firstCardStateFrom({ opened: '1' })), TODAY_WELCOME_DONE.shopOnly);
  assert.equal(welcomeDoneRow(firstCardStateFrom({ opened: '1', card: 'skipped' })), TODAY_WELCOME_DONE.shopOnly);
  assert.equal(welcomeDoneRow(firstCardStateFrom({ opened: '1', card: 'draft' })), TODAY_WELCOME_DONE.shopOnly);
  assert.equal(welcomeDoneRow(firstCardStateFrom({ opened: '1', card: 'live' })), TODAY_WELCOME_DONE.withCard);
  assert.ok(!FIRST_CARD_CARRY_LINE.draft.includes('on your page ✓'));
  // The action: the maker's card goes through the SHIPPED switch, and lands where the truth says.
  assert.match(ACTION, /const live = await putFirstCardLive\(id\);/);
  assert.match(ACTION, /if \(made\.live\) return firstCardLivePath\(welcome\);/);
  assert.match(ACTION, /state: 'draft', why: firstCardWhyKey\(made\.why, 'draft'\), id: made\.id/);
  // Idempotent: a card this shop already has under this name is reused — a second Approve makes no duplicate.
  assert.match(ACTION, /const before = await findMade\(\);[\s\S]*?if \(!id\) \{[\s\S]*?await createVendorService\(fd\)/);
  // The wizard's last screen never says "on your page" or ticks the card before it exists.
  assert.doesNotMatch(WIZARD, /· on your page`/);
  assert.match(WELCOME, /FIRST_CARD_RETRY/);
  assert.match(TODAY, /cardState=\{firstCardStateFrom\(search\)\}/);
});

test('9 · Door A (P1 · P3 · P5 · P6) speaks the drawing’s words, and the team door promises no Card Maker', async () => {
  const { readFileSync } = await import('node:fs');
  const door = readFileSync(new URL('../app/open-shop/_components/claim-door.tsx', import.meta.url), 'utf8');
  const mod = await import('./supplier-onboarding');
  // P1
  assert.equal(mod.ACCEPT_LINE, 'Accept to run this booking on Setnayan. Free.');
  assert.match(door, /`\$\{record\.inviterName\} added you\.`/);
  assert.match(door, /data-claim-door-shop=""/);
  // P3 — the claim door's own row names, its two notes, Looks right
  assert.deepEqual(Object.values(mod.CLAIM_CHECK_LABEL), ['Shop name', 'Contact', 'Number', 'Covers', 'Booked', 'Pays', 'They pay you']);
  assert.equal(mod.claimCheckLine('Ana & Ben'), 'Change anything Ana & Ben got wrong.');
  assert.match(door, /\{CLAIM_CHECK_LABEL\[r\.fact\]\}/);
  assert.match(door, /primary = \{ label: LOOKS_RIGHT, onClick: next \};/);
  // P4 — the Setnayan team's finish never reaches the Card Maker hand-off, so its door draws no Edit and says none.
  assert.match(door, /\{team \? null : <ActionButton tone="neutral" icon=\{PenLine\} label="Edit"/);
  assert.match(door, /\? 'Skip makes no card — add one from Today\.'/);
  // P5 — the tick on every claim's last screen; Open my shop waits for it
  assert.match(door, /<PlanAgree\b/);
  assert.match(door, /!d\.planAgreed \? \(/);
  // P6
  assert.equal(mod.claimedWelcomeLine('Ana & Ben', 'wedding'), 'Ana & Ben’s wedding is in Clients.');
});

test('11b · ship review 21 Nov — the welcome says what is TRUE of this shop: its plan, and "Get verified" only when it is not', async () => {
  // `?claimed=1` also lands ESTABLISHED shops (main's claim finalize page and the services action), so nothing fixed.
  assert.equal(todayWelcomeLine({ tierState: 'free', verified: false }), 'Your shop is open on Free.');
  assert.equal(todayWelcomeLine({ tierState: 'verified', verified: true }), 'Your shop is open on Free · Verified.');
  assert.equal(todayWelcomeLine({ tierState: 'pro', verified: true }), 'Your shop is open on Pro.');
  assert.equal(todayWelcomeLine({ tierState: 'enterprise', verified: true }), 'Your shop is open on Ultra.');
  // A failed read, or a plan the code does not know, names no plan at all.
  assert.equal(todayWelcomeLine(null), TODAY_WELCOME_LINE_UNREAD);
  assert.equal(todayWelcomeLine({ tierState: 'mystery', verified: false }), TODAY_WELCOME_LINE_UNREAD);
  assert.equal(todayWelcomeLine({ tierState: null, verified: false }), TODAY_WELCOME_LINE_UNREAD);
  const keys = (shop: Parameters<typeof todayWelcomeSteps>[0]) => todayWelcomeSteps(shop).map((s) => s.key);
  assert.deepEqual(keys({ tierState: 'free', verified: false }), ['clients', 'logo', 'verify']);
  assert.deepEqual(keys({ tierState: 'pro', verified: true }), ['clients', 'logo'], 'a verified shop is asked to get verified');
  assert.deepEqual(keys(null), ['clients', 'logo'], 'a failed read asks for verification it cannot know is missing');
  // Today hands the welcome its one shop read; the welcome draws only from it.
  assert.match(TODAY, /shop=\{shopRow \? \{ tierState: shopRow\.tierState \?\? null, verified: shopRow\.verified \} : null\}/);
  // Door A (P6): the couple's line when that read worked, else this shop's own truth — never a fixed Free.
  assert.match(WELCOME, /claimedWelcomeLine\(claimed\.couple, claimed\.eventWord\) : todayWelcomeLine\(shop\)\}/);
  assert.doesNotMatch(WELCOME, /['"`][^'"`\n]*open on Free/, 'the welcome hard-codes "open on Free" again');
});

test('11c · ship review 21 Nov — a first card’s reason rides the address as a KEY; the welcome draws its sentence from code', async () => {
  const why = await import('./first-card-why');
  const { publishRefusalFor, PUBLISH_REQUIREMENTS } = await import('./service-publish-gate');
  const { liveCardsCapMessage, LIVE_CARDS_UNREAD } = await import('./live-cards-cap');
  const { OWNER_ONLY_SHOP_EDIT, SHOP_UNREADABLE } = await import('./active-shop');
  // Every sentence the door can be handed maps to a key and back to the SAME words.
  const sentences = [why.FIRST_CARD_NOT_MADE, why.FIRST_CARD_MADE_UNREAD, LIVE_CARDS_UNREAD, OWNER_ONLY_SHOP_EDIT, SHOP_UNREADABLE, liveCardsCapMessage(3), liveCardsCapMessage(1)];
  for (const r of PUBLISH_REQUIREMENTS) sentences.push(publishRefusalFor([r])!);
  sentences.push(publishRefusalFor([...PUBLISH_REQUIREMENTS])!);
  for (const s of sentences) {
    const key = why.firstCardWhyKey(s, 'draft');
    assert.ok(key && FIRST_CARD_WHY_KEY.test(key), `no key for: ${s}`);
    assert.equal(why.firstCardWhySentence(key), s, `the key ${key} does not draw its own sentence`);
  }
  // A sentence the door does not know is the state's plain fallback — never carried.
  assert.equal(why.firstCardWhyKey('Some maker words', 'refused'), 'not-made');
  assert.equal(why.firstCardWhyKey('Some switch words', 'draft'), 'not-live');
  // Free text on the address is dropped, never drawn; an unknown key draws nothing.
  const base = { card: 'draft', card_title: 'Bridal bouquet', card_price: '8500', card_category: 'florist' };
  assert.equal(firstCardFrom({ ...base, card_why: 'Call 0917 000 0000 to claim your prize' })?.why, null);
  assert.equal(firstCardFrom({ ...base, card_why: 'not-live' })?.why, 'not-live');
  assert.equal(why.firstCardWhySentence('totally-made-up'), null);
  assert.equal(why.firstCardWhySentence('needs-cover+bogus'), null);
  // Every place the door writes a reason writes a key; the welcome never prints the raw value.
  assert.equal((ACTION.match(/firstCardCarryPath\(welcome, \{ \.\.\.card, state: '(?:refused|draft)', why: firstCardWhyKey\(/g) ?? []).length, 3);
  assert.doesNotMatch(ACTION, /why: (?:shop\.error|made\.why)[ ,}]/, 'a sentence is carried on the address again');
  assert.match(WELCOME, /firstCardWhySentence\(card\.why\)/);
  assert.doesNotMatch(WELCOME, /\$\{card\.why\}|\{card\.why\}/, 'the welcome prints the address value');
});

test('11d · ship review 21 Nov — a failed re-read after the maker answered is said as a failed read, not "made, not live"', () => {
  const maker = ACTION.slice(ACTION.indexOf('async function makeFirstCard('), ACTION.indexOf('if (!id) return { ok: true, id: null, live: false, why: FIRST_CARD_NOT_LIVE };'));
  assert.ok(maker.length > 500, 'makeFirstCard could not be found');
  assert.match(maker, /const after = await findMade\(\);\s*\/\/[\s\S]{0,300}if \(after\.error\) \{[\s\S]{0,200}return \{ ok: true, id: null, live: false, why: FIRST_CARD_MADE_UNREAD \};/);
  // The welcome then sends them to their cards (the id is unknown), not to a new card.
  assert.match(WELCOME, /card\.why === 'made-unread'\s*\?\s*'\/vendor-dashboard\/services'/);
});
