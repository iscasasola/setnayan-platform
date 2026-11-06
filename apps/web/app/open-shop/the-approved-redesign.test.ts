/**
 * GUARD — the supplier sign-up redesign the owner approved on 2026-11-06 (DECISION_LOG: "SUPPLIER SIGN-UP REDESIGN —
 * FOUR CALLS ANSWERED", "EVERY EVENT TYPE STARTS TICKED", "REDESIGN APPROVED"; the contract is
 * `prototypes/open_shop_redesign_2026-11-06/` in the specs repo).
 *
 * What is EXECUTED here: the error → box mapping (`openShopErrorField`), every shared sentence the door can show
 * owning a box on the step that draws it. What is READ: the wiring the owner can see and a refactor could quietly
 * undo — the step order, the server refusing what the browser refuses, the coordinator list read from the constant,
 * the photo tiles using the shipped photo + fallback, the stale-build button, and errors drawn under their box.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { OPEN_SHOP_ERRORS, OPEN_SHOP_PHONE_BOX_ERROR } from '@/lib/open-shop-validation';
import { OPEN_SHOP_ACCOUNT_ERRORS } from '@/lib/open-shop-account';
import { TERMS_REQUIRED_MESSAGE } from '@/lib/terms-agreement';
import { openShopErrorField, openShopErrorWords, OPEN_SHOP_FIELD_STEP } from '@/lib/open-shop-error-field';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const WIZARD = read('app/open-shop/_components/open-shop-wizard.tsx');
const ACTIONS = read('app/open-shop/actions.ts');
const PAGE = read('app/open-shop/page.tsx');
const PICKER = read('app/open-shop/_components/service-picker.tsx');
const TILES = read('app/open-shop/_components/event-tiles.tsx');
const PANE = read('app/_components/auth/sign-in-here-panel.tsx');
const LINK = read('app/_components/auth/sign-in-here-link.tsx');
const CITY_PIN = read('app/open-shop/_components/city-pin.tsx');
const PHONE = read('app/open-shop/_components/phone-field.tsx');
const MORE = read('app/open-shop/_components/more-services.tsx');
const METER = read('lib/open-shop-more-services.ts');

/* ── every sentence has a box, and the box is on the step the server sends you to ─────────────────────────────── */

test('every refusal the door can show names its box — none falls through to "somewhere"', () => {
  const sentences: Array<[string, string]> = [
    ...Object.entries(OPEN_SHOP_ERRORS).map(([k, v]) => [k, v] as [string, string]),
    ...Object.entries(OPEN_SHOP_ACCOUNT_ERRORS).map(([k, v]) => [k, v] as [string, string]),
    ['terms', TERMS_REQUIRED_MESSAGE],
    ['phoneBox', OPEN_SHOP_PHONE_BOX_ERROR],
  ];
  // The one sentence no box owns: the account could not be created just now — drawn above the button that retries.
  const SUBMIT_ONLY = new Set(['accountFailed']);
  for (const [key, sentence] of sentences) {
    const field = openShopErrorField(sentence);
    if (SUBMIT_ONLY.has(key)) assert.equal(field, 'submit', `${key} claims a box`);
    else assert.notEqual(field, 'submit', `${key} ("${sentence}") has no box — it would float above the button`);
  }
  assert.equal(openShopErrorField(null), null);
  assert.equal(openShopErrorField('something new'), 'submit', 'an unknown sentence must still be SHOWN');
});

test('the box a refusal belongs to is on the step the server redirects to', () => {
  const STEP_OF: Record<string, number> = {};
  for (const m of ACTIONS.matchAll(/redirect\(\s*'\/open-shop\?step=(\d)&error='\s*\+\s*encodeURIComponent\(OPEN_SHOP_ERRORS\.([A-Za-z]+)\)/g)) {
    STEP_OF[m[2]!] = Number(m[1]);
  }
  assert.ok(Object.keys(STEP_OF).length >= 8, 'anti-vacuity: the scan found too few redirects');
  for (const [key, step] of Object.entries(STEP_OF)) {
    const field = openShopErrorField(OPEN_SHOP_ERRORS[key as keyof typeof OPEN_SHOP_ERRORS]);
    assert.ok(field && field !== 'submit', `${key} has no box`);
    assert.equal(OPEN_SHOP_FIELD_STEP[field as keyof typeof OPEN_SHOP_FIELD_STEP], step, `${key}: the server sends step=${step}, its box is on another step`);
  }
});

test('the phone box says the approved sentence, whichever way the number was refused', () => {
  assert.equal(OPEN_SHOP_PHONE_BOX_ERROR, 'Use 9XX XXX XXXX, or your landline with its area code.');
  assert.equal(openShopErrorWords(OPEN_SHOP_ERRORS.contactPhoneNotPh), OPEN_SHOP_PHONE_BOX_ERROR);
  assert.equal(OPEN_SHOP_ERRORS.events, 'Pick at least one event.');
  assert.match(PHONE, /state\.state === 'error' \? OPEN_SHOP_PHONE_BOX_ERROR/);
});

/* ── the order: 1 Name · 2 What you do · 3 Where you are · 4 You ──────────────────────────────────────────────── */

test('four steps in the approved order, the account LAST', () => {
  const at = (n: number) => WIZARD.indexOf(`step === ${n} ? 'space-y-4' : 'hidden'`);
  const panel = (n: number) => WIZARD.slice(at(n), n < 4 ? at(n + 1) : WIZARD.indexOf('data-open-shop-bar'));
  assert.match(panel(1), /name="shop_name"/);
  assert.match(panel(2), /<ServicePicker\b/);
  assert.match(panel(2), /<EventTiles\b/);
  assert.match(panel(3), /<CityPin\b/);
  for (const name of ['contact_name', 'contact_email', 'password']) assert.match(panel(4), new RegExp(`name="${name}"`));
  assert.match(panel(4), /<PhoneField\b/);
  // Gone from the door: the logo upload, Position, "In business since".
  assert.doesNotMatch(WIZARD, /<FileUpload\b|contact_position"|in_business_since_year|<PickMenu\b/);
});

test('the server runs the same order, and refuses what the browser refuses', () => {
  const i = (s: string) => {
    const n = ACTIONS.indexOf(s);
    assert.ok(n > 0, `${s} is missing from becomeVendor`);
    return n;
  };
  const order = [
    'OPEN_SHOP_ERRORS.shopName',
    'OPEN_SHOP_ERRORS.service',
    'OPEN_SHOP_ERRORS.events',
    'OPEN_SHOP_ERRORS.extraEvents',
    'locationStepError({',
    'OPEN_SHOP_ERRORS.contactName',
    'await createVendorAccountForShop(',
  ].map(i);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'becomeVendor checks the fields out of screen order');
  // No confirmed pin → no shop (it used to require the city alone).
  assert.match(ACTIONS, /hasPin: parseCoordPair\(formData\.get\('hq_latitude'\), formData\.get\('hq_longitude'\)\) !== null/);
  assert.match(ACTIONS, /confirmed: formData\.get\('location_confirmed'\) === 'yes'/);
  assert.match(ACTIONS, /if \(locationError\) redirect\('\/open-shop\?step=3&error=' \+ encodeURIComponent\(locationError\)\)/);
  // No events → refused; the silent ['wedding'] fallback is gone.
  assert.match(ACTIONS, /if \(submittedEventTypes\.length === 0\)\s*redirect\('\/open-shop\?step=2&error=' \+ encodeURIComponent\(OPEN_SHOP_ERRORS\.events\)\)/);
  assert.doesNotMatch(ACTIONS, /:\s*\['wedding'\]/, 'an empty event set is quietly turned into weddings again');
});

/* ── step 2: the coordinator door, and every event ticked ─────────────────────────────────────────────────────── */

test('?as=coordinator opens on COORDINATOR_TRADE_SERVICES — read from the constant, never a word search', () => {
  assert.match(PAGE, /coordinator=\{arrivedAs === 'coordinator'\}/);
  assert.match(PICKER, /new Set\(COORDINATOR_TRADE_SERVICES\)/);
  assert.match(PICKER, /COORDINATOR_TRADE_SET\.has\(l\.canonicalService\)/);
  assert.match(PICKER, /Coordination services/);
  assert.match(PICKER, /Not a coordinator\?/);
  assert.match(PICKER, /Search all services/);
  assert.match(WIZARD, /'What you coordinate', 'Your main coordination service, and the events you serve\.'/);
  assert.match(WIZARD, /onSearchAll=\{\(\) => setAllServices\(true\)\}/);
});

test('every event type starts ticked — the full roster, not the column default', () => {
  assert.match(PAGE, /eventTypeOptions\.map\(\(e\) => e\.key\)/, 'the page no longer hands in the whole roster');
  assert.doesNotMatch(WIZARD, /\['wedding'\]/, 'the wizard falls back to weddings again');
  assert.match(WIZARD, /All are on to start\. Untick any you don&rsquo;t do\./);
});

test('the tiles wear the shipped photo and the shipped fallback, as real checkboxes', () => {
  assert.match(TILES, /eventTypePhotoSrc\(/);
  assert.match(TILES, /eventTypePlaceholderGradient\(e\.key\)/);
  assert.match(TILES, /onError=\{\(\) => setNoPhoto\(true\)\}/);
  assert.match(TILES, /type="checkbox"\s+name="event_types"/);
  assert.match(TILES, /grid grid-cols-3/, 'three across on a phone');
});

/* ── step 3: the pin's answer is the step's primary action ─────────────────────────────────────────────────────── */

test('"Is this your address?" — the full address, a full-width "Yes, that’s right", the lookup state, the pane', () => {
  assert.match(CITY_PIN, /Is this your address\?/);
  assert.match(CITY_PIN, /className="button-primary[^"]*w-full[^"]*"\s+data-open-shop-yes=""/);
  assert.match(CITY_PIN, /data-open-shop-map-busy=""/);
  assert.match(CITY_PIN, /createPortal\(confirmCard, sideSlot\)/);
  assert.match(WIZARD, /sideSlot=\{wide \? sideSlot : null\}/);
  assert.match(WIZARD, /'Where you are', 'Type your address; the pin follows\. Then confirm it\.'/);
});

/* ── step 2, v8: the services sit together, a meter names the plan (owner 2026-11-06) ─────────────────────────── */

test('v8 · main + added services are ONE "Your services" list above the events, each with its own events', () => {
  assert.match(WIZARD, /\{service \? 'Your services' : 'Main service'\}/);
  // The list sits in the service block, BEFORE "Events you serve".
  assert.ok(WIZARD.indexOf('<MoreServices') > 0 && WIZARD.indexOf('<MoreServices') < WIZARD.indexOf('Events you serve'));
  assert.match(MORE, /Same events as \{mainLabel\}/);
  assert.match(MORE, /Use the same events as \{mainLabel\}/);
  assert.match(MORE, /Pick at least one event for \{a\.label\}\./);
  // The same chosen row for the main and every added one.
  assert.match(PICKER, /<ChosenServiceRow[\s\S]{0,120}action="Change"/);
  assert.match(MORE, /<ChosenServiceRow[\s\S]{0,200}action="Remove"/);
  // Refused in the browser AND on the server.
  assert.match(WIZARD, /if \(added\.some\(\(a\) => \(a\.events \?\? events\)\.length === 0\)\) return OPEN_SHOP_ERRORS\.extraEvents;/);
  assert.match(ACTIONS, /if \(!ev\) redirect\('\/open-shop\?step=2&error=' \+ encodeURIComponent\(OPEN_SHOP_ERRORS\.extraEvents\)\)/);
});

test('v8 · two buttons after a pick: "More in ‹group›" (the picker opened in that group) and "A different category"', () => {
  assert.match(MORE, /More in \{lastGroup\.groupLabel\}/);
  assert.match(MORE, /A different category/);
  assert.match(MORE, /startParent=\{adding \|\| null\}/);
  assert.match(PICKER, /useState<string \| null>\(startParent\)/);
  assert.doesNotMatch(WIZARD + MORE, /Add another service/, 'the single "Add another service" is back');
});

test('v8 · the meter counts tier-2 CATEGORIES (the tree’s branch), never groups; numbers from TIER_CAPS', () => {
  // The branch (tileId) is the category; the folder is only the chosen row's second line.
  assert.match(MORE, /out\.set\(l\.canonicalService, \{ categoryId: b\.tileId, categoryLabel: b\.label, groupId: p\.folderId, groupLabel: p\.label \}\)/);
  assert.match(METER, /by\.length <= caps\.parentCategories && by\.every\(\(c\) => c\.count <= caps\.servicesPerLeaf\)/);
  assert.doesNotMatch(METER, /parentCategories:\s*\d|servicesPerLeaf:\s*\d/, 'a plan number is typed into the meter');
  // "Add more later…" is said only BEFORE the pick — once picked, the meter says it with the real numbers.
  assert.match(WIZARD, /\{service \|\| coordinating \? null : \(\s*<span className="block text-xs"[^>]*data-open-shop-plan-hint=""/);
});

test('v8 · the door never refuses a service for the plan, and writes each one’s events to vendor_coverages', () => {
  assert.match(ACTIONS, /await insertCoverage\(admin, vendorProfileId as string, \{ \.\.\.row, faiths: \[\] \}\)/);
  assert.doesNotMatch(ACTIONS, /addCoverageForCardKind|parentCategories/, 'a plan cap reached the door');
  // Coverages first, the profile patch last — the patch keeps index 0 the coarse category.
  assert.ok(ACTIONS.indexOf('await insertCoverage(') < ACTIONS.indexOf(".update(patch)"));
});

/* ── errors under their box; the stale build; the sign-in pane ────────────────────────────────────────────────── */

test('no banner at the top — each error is drawn under its box and tied to it', () => {
  assert.doesNotMatch(WIZARD, /\{banner && !taken &&/, 'the top banner is back');
  assert.match(WIZARD, /id=\{`open-shop-err-\$\{field\}`\}/);
  for (const f of ['shop_name', 'contact_name', 'contact_email', 'password']) {
    assert.match(WIZARD, new RegExp(`aria-describedby=\\{describedBy\\('${f}'\\)\\}`), `${f} is not tied to its error`);
  }
  assert.match(WIZARD, /error=\{errorFor\('location'\)\}/);
  assert.match(CITY_PIN, /aria-describedby=\{error \? 'open-shop-err-location' : undefined\}/);
});

test('a page left open across a deploy: the button becomes "Tap Reload to keep going", the draft parked first', () => {
  const hook = read('app/open-shop/_components/use-stale-build.ts');
  assert.match(hook, /shouldOfferReload\(LOADED_BUILD_VERSION, serving\)/);
  assert.match(hook, /fetch\('\/api\/health'/);
  assert.match(WIZARD, /Tap Reload to keep going/);
  const reload = WIZARD.slice(WIZARD.indexOf('const reloadKeepingDraft'), WIZARD.indexOf('const restoredRef'));
  assert.ok(reload.indexOf('saveDraft({ reload: true })') < reload.indexOf('window.location.reload()'), 'the reload runs before the draft is parked');
});

test('"Sign in" opens the ONE sign-in panel as the third pane (SidePanel ≥768, sheet on a phone), in place', () => {
  // One login everywhere (owner-locked 2026-07-18; seam-invariants "there is exactly one sign-in panel"): the door
  // does not get its own copy — it asks the shipped panel for its pane mode.
  assert.match(WIZARD, /<SignInHereLink href=\{signInHref\} pane\b/);
  assert.match(LINK, /openSignIn\(pane \? \{ pane: true \} : undefined\)/);
  assert.match(PANE, /if \(options\.pane\) \{[\s\S]*?<SidePanel[\s\S]*?size="wide"[\s\S]*?phone="sheet"/);
  assert.match(PANE, /router\.refresh\(\)/);
  assert.doesNotMatch(PANE, /router\.push/);
});
