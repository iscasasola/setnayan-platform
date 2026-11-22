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
const PICKER = read('app/_components/service-picker.tsx');
const TILES = read('app/open-shop/_components/event-tiles.tsx');
const PANE = read('app/_components/auth/sign-in-here-panel.tsx');
const LINK = read('app/_components/auth/sign-in-here-link.tsx');
const CITY_PIN = read('app/open-shop/_components/city-pin.tsx');
const PHONE = read('app/open-shop/_components/phone-field.tsx');
const CARDS = read('app/open-shop/_components/service-cards.tsx');
const AT_EVENTS = read('app/open-shop/_components/services-at-events.tsx');
const SHEET = read('app/open-shop/_components/plan-sheet.tsx');
const LAB = read('app/dev/open-shop-lab/page.lab.tsx');
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
  // Words revised by the owner 2026-11-07 (PR #7351): no leading 0 beside the fixed +63.
  assert.equal(OPEN_SHOP_PHONE_BOX_ERROR, 'Use 9XX XXX YYYY, or a landline like 2 8XXX YYYY.');
  assert.doesNotMatch(OPEN_SHOP_ERRORS.contactPhoneNotPh, /09XX/);
  assert.equal(openShopErrorWords(OPEN_SHOP_ERRORS.contactPhoneNotPh), OPEN_SHOP_PHONE_BOX_ERROR);
  assert.equal(OPEN_SHOP_ERRORS.events, 'Pick at least one event.');
  assert.match(PHONE, /state\.state === 'error' \? OPEN_SHOP_PHONE_BOX_ERROR/);
});

/* ── the order: 1 Name · 2 What you do · 3 Where you are · 4 About you · 5 Your account (prototype v16) ──────────── */

test('five screens in the approved order, the account SECOND (supplier onboarding, owner 19 Nov)', () => {
  // 🚪 SUPERSEDES "the account LAST" (2026-11-06): the owner's 19 Nov approval puts Create account second, and every
  // box the five steps held moves onto Open your shop or into a sheet of Check your shop. Each box is pinned to ITS
  // panel by the panel's own `data-onboarding-fact`.
  const fact = (f: string) => {
    const at = WIZARD.indexOf(`data-onboarding-fact="${f}"`);
    assert.ok(at > 0, `no ${f} panel`);
    const next = WIZARD.indexOf('data-onboarding-fact="', at + 10);
    return WIZARD.slice(at, next > 0 ? next : WIZARD.indexOf('data-onboarding-check'));
  };
  assert.match(fact('name'), /name="shop_name"/);
  assert.match(fact('categories'), /<ServicePicker\b/);
  assert.match(fact('categories'), /<ServiceCards\b/);
  assert.match(fact('events'), /<EventTiles\b/);
  assert.match(fact('events'), /<ServicesAtEvents\b/);
  assert.match(fact('where'), /<CityPin\b/);
  // Contact person: name · role (free text → the shipped `contact_position`, optional); the number is its own sheet.
  assert.match(fact('contact'), /name="contact_name"/);
  // 🚪 PB2 (19 Nov fix): the role sits on the account screen ("Your role · Owner"); signed in — no account screen — it
  // stays in the Contact sheet. ONE box (`roleBox`), mounted in one place or the other.
  assert.match(WIZARD, /const roleBox = \([\s\S]{0,600}name="contact_position"/);
  assert.match(fact('contact'), /\{guest \? null : roleBox\}/);
  assert.match(WIZARD, /\{guest \? roleBox : null\}/);
  assert.match(fact('number'), /<PhoneField\b/);
  const account = WIZARD.slice(WIZARD.indexOf("step === ACCOUNT_STEP ? 'space-y-4'"), WIZARD.indexOf('data-onboarding-check'));
  for (const name of ['contact_email', 'password']) assert.match(account, new RegExp(`name="${name}"`));
  assert.match(account, /name=\{TERMS_FIELD\}/);
  // Gone from the door: the logo upload, "In business since", any role LIST (none exists to reuse).
  assert.doesNotMatch(WIZARD, /<FileUpload\b|in_business_since_year/);
  // No role LIST either: the ONE dropdown on the door is Door C's coordination service (owner 19 Nov).
  assert.equal((WIZARD.match(/<PickMenu\b/g) ?? []).length, 1, 'a second dropdown appeared on the door');
  assert.match(WIZARD, /data-onboarding-coordination="">\s*<PickMenu\s+label="Your main coordination service"/);
  assert.match(WIZARD, /contact: 'Who couples will talk to\.'/);
  assert.match(WIZARD, /2: guest \? ONBOARDING_HEADS\.account : \['Your shop’s email', 'Where couples and Setnayan reach your shop\.'\]/);
  // Five segments in the step bar.
  assert.match(WIZARD, /\(\[1, 2, 3, 4, 5\] as Step\[\]\)\.map\(\(n\) => \(\s*<div key=\{n\} className="h-1 flex-1/);
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
  assert.match(ACTIONS, /if \(submittedEventTypes\.length === 0\)\s*redirect\('\/open-shop\?step=3&error=' \+ encodeURIComponent\(OPEN_SHOP_ERRORS\.events\)\)/);
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
  // 🚪 19 Nov: the coordinator door's first screen is Open your shop, Coordination pre-picked (`supplier-onboarding`).
  assert.match(WIZARD, /1: coordinator \? OPEN_YOUR_COORDINATION_HEAD : OPEN_YOUR_SHOP_HEAD/);
  assert.match(WIZARD, /onSearchAll=\{\(\) => setAllServices\(true\)\}/);
});

test('every event type starts ticked — the full roster, not the column default', () => {
  assert.match(PAGE, /eventTypeOptions\.map\(\(e\) => e\.key\)/, 'the page no longer hands in the whole roster');
  assert.doesNotMatch(WIZARD, /\['wedding'\]/, 'the wizard falls back to weddings again');
  // v19 — the tiles are the events their services are offered for; the hint counts the ones on (Count, never replays).
  assert.match(WIZARD, /<EventTiles\s+options=\{shownEvents\}/);
  assert.match(WIZARD, /<Count value=\{activeEvents\.length\} id="open-shop-evn" \/> of \{formatCount\(shownEvents\.length\)\} on — untick/);
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
  // 🚪 19 Nov: the pin lives in the "Where you are" SHEET, so the card is drawn in place — never portalled behind the
  // sheet's dark (the portal stays CityPin's for its other callers).
  assert.match(WIZARD, /sideSlot=\{null\}/);
  assert.match(WIZARD, /where: 'Type your address; the pin follows\.'/); // PB3·a's own words
});

/* ── step 2, v14 → v16: one card per category, the plan explained on Continue, events per service ─────────────── */

test('v16 ① · one plain card per CATEGORY; a blank "Also do …?" row; a dashed "Another category" frame → tile → row', () => {
  assert.match(WIZARD, /\{service && !\(coordinating && step === 1\) \? 'Your services' : 'Main service'\}/);
  // The card is the tier-2 category (the tree's branch), never the group.
  assert.match(CARDS, /categoryId: b\.tileId,\s*categoryLabel: b\.label,/);
  assert.match(CARDS, /buttonText=\{`Also do \$\{remain\.map\(\(x\) => x\.label\)\.join\(', '\)\}\?`\}/);
  assert.match(CARDS, /<PickMenu\b/, 'the blank row is the house dropdown, never a raw <select>');
  assert.match(CARDS, /Every \{cat\} service is on your list/);
  assert.match(CARDS, /data-open-shop-another-category=""[\s\S]{0,200}Another category/);
  // "Another category" never offers a category already on the list, nor a service already picked.
  assert.match(CARDS, /excludeCategories=\{new Set\(byCat\.map\(\(c\) => c\.id\)\)\}/);
  assert.match(CARDS, /excludeServices=\{pickedKeys\}/);
  assert.match(PICKER, /cats: p\.branches\.filter\(\(b\) => !exclude\?\.has\(b\.tileId\)\)/);
  // The card a pick lands in scrolls into view and flashes once.
  assert.match(CARDS, /setFlash\(leaf\.canonicalService\)/);
  assert.match(CARDS, /scrollIntoView\(\{ block: 'center', behavior: 'smooth' \}\)/);
  assert.match(CARDS, /data-\[flash\]:shadow-/);
  // The v8 shapes are gone.
  assert.doesNotMatch(WIZARD + CARDS, /More in \{|A different category|Add another service|Same events as/);
});

test('owner 7 Nov · a category with ONE service adds it on the tap — no drill-in row, no specialty auto-picked', () => {
  const tap = PICKER.slice(PICKER.indexOf('<CategoryTiles'), PICKER.indexOf('const coordinatorView'));
  assert.match(tap, /if \(only && only\.length === 1 && offered\(only\[0\]!\)\) \{[\s\S]*?onPick\(only\[0\]!\);\s*return;/);
  assert.doesNotMatch(tap, /setPicks|onPicksChange/, 'the tap picks a specialty for them');
});

test('v16 ② → 19 Nov · "Before you continue" sits on the LAST screen, only past Free; its box gates Open my shop', () => {
  // 🚪 SUPERSEDED placement (owner 19 Nov: "the plan sits on this last screen"): the same body, drawn on You're all set.
  // 19 Nov fix (PB5): "I understand how this works." is on the last screen for EVERY new shop — inside the plan when the
  // picks are past Free, on its own (`PlanAgree`) when they are not — and it gates Open my shop either way.
  assert.match(WIZARD, /overFree \? <PlanOnLastScreen \{\.\.\.planProps\} \/> : <PlanAgree /);
  const gate = WIZARD.slice(WIZARD.indexOf('const validateStep = '), WIZARD.indexOf('const focusField'));
  assert.match(gate, /if \(!planAgreed\) return PLAN_AGREE_ERROR;/);
  assert.match(SHEET, /export function PlanAgree\(/);
  const submit = WIZARD.slice(WIZARD.indexOf('const submitGate'), WIZARD.indexOf('const saveDraft'));
  assert.match(submit, /if \(err === PLAN_AGREE_ERROR\) \{\s*setPlanErr\(err\);/);
  assert.match(SHEET, /Before you continue/);
  assert.match(SHEET, /tip\.ladder\.map\(/);
  assert.match(SHEET, /export function PlanOnLastScreen/);
  // The claim door still draws it as its own slide, and the shipped Sheet still holds it there.
  assert.match(SHEET, /<Sheet open=\{open\}/);
  // No number or peso typed on this screen — the ladder is TIER_CAPS'.
  assert.doesNotMatch(SHEET + CARDS, /₱|\b\d+ (categories|per category|km)\b/);
  assert.match(METER, /export function planLadder\(\)/);
  // The one-line hint + ⓘ stays inline under the cards.
  assert.match(CARDS, /What each plan adds shows before you continue\./);
});

test('v16 ③ · specialties compile: picks in ink + "+ Add" when closed, every chip + Done when open, one open at a time', () => {
  assert.match(CARDS, /summary\.join\(' · '\)/);
  // v18/v19 BUTTON_RULE — pills by meaning, never text links: grey "+ Add" / "+ Specialties (optional)" when closed;
  // open = every chip + one fit row of ⌃ grey · Remove red · ✓ Done green.
  assert.match(CARDS, /<ActionButton tone="neutral" icon=\{Plus\} label="Add"/);
  assert.match(CARDS, /<ActionButton tone="neutral" icon=\{Plus\} label=\{`\$\{word\} \(optional\)`\}/);
  assert.match(CARDS, /<ActionButton tone="ok" icon=\{Check\} label="Done"/);
  assert.match(CARDS, /<ActionButton tone="danger" icon=\{Trash2\} label="Remove"/);
  // ONE open key, held by the wizard — opening one closes the others.
  assert.match(WIZARD, /const \[openSpecialty, setOpenSpecialty\] = useState<string \| null>\(null\)/);
  // From the shipped refinement schema, written through the ONE merge.
  // Ruling 5820: the read moved to the ONE loader every picker door shares; the page calls it.
  assert.match(PAGE, /getServicePickerSpecialties\(supabase, serviceTree\)/);
  assert.match(read('lib/service-picker-tree.server.ts'), /fetchCategoryChipRefinementsMany\(/);
  assert.match(ACTIONS, /await mergeServiceRefinements\(admin, vendorProfileId as string, svc, fd\)/);
});

test('v16 ④ → v19 · under each ticked event, ONLY the services it takes as chips; none on → refused', () => {
  // v19 (owner 7 Nov): no greyed chips, no "isn't offered" lines; the count is of the offered ones.
  assert.doesNotMatch(AT_EVENTS, /isn’t offered|isn't offered|aria-disabled/);
  assert.match(AT_EVENTS, /<Count value=\{onCount\} id=\{`open-shop-ev-\$\{e\.key\}`\} \/> of \{formatOffered\(offered\.length\)\}/);
  assert.match(AT_EVENTS, /\.filter\(\(x\) => x\.offered\.length > 0\)/);
  assert.match(WIZARD, /if \(serviceOnNoEvent\) return OPEN_SHOP_ERRORS\.extraEvents;/);
  // Events are their own sheet on Check your shop (19 Nov), with the shipped line.
  assert.match(WIZARD, /events: 'Couples find you by event\.'/);
  // The server keeps each service's own events and refuses one on no event.
  assert.match(ACTIONS, /parseEventListField\(formData\.get\(MAIN_SERVICE_EVENTS_FIELD\)\)/);
  assert.match(ACTIONS, /if \(!ev\) redirect\('\/open-shop\?step=3&error=' \+ encodeURIComponent\(OPEN_SHOP_ERRORS\.extraEvents\)\)/);
  assert.equal(OPEN_SHOP_ERRORS.extraEvents, 'Pick at least one event for each service.');
});

test('v16 ⑤ · three equal buttons; Email opens email + password in place with ONE hint; the leak check speaks on submit', () => {
  // 🚪 SUPERSEDED (owner "approve!" on P2/PB2, 19 Nov — "Email boxes show at once"): Google · Apple, "or", then the
  // email and password boxes, all drawn together — no "Continue with Email" button to open them.
  assert.match(WIZARD, /<OAuthButtonRow next="\/open-shop"[\s\S]{0,400}data-open-shop-or=""/);
  assert.doesNotMatch(WIZARD, /\{OAUTH_VERB\} Email/);
  assert.match(WIZARD, /<PasswordField\s+id="open-shop-password"\s+mode="new"\s+quiet\b/);
  // v19 — the ONE rule line is the field's own (`QuietRule`), drawn only once the box holds something.
  assert.doesNotMatch(WIZARD, /open-shop-password-hint/, 'a second, static hint came back');
  assert.doesNotMatch(WIZARD, /or with email/, 'the "or with email" divider is back');
  assert.match(WIZARD, />\s*Open my shop\s*<\/SubmitButton>/); // PB5's button word
});

test('the door never refuses a service for the plan, and writes each one’s events to vendor_coverages', () => {
  assert.match(ACTIONS, /await insertCoverage\(admin, vendorProfileId as string, \{ \.\.\.row, faiths: \[\] \}\)/);
  assert.doesNotMatch(ACTIONS, /addCoverageForCardKind|parentCategories/, 'a plan cap reached the door');
  // Coverages first, the profile patch last — the patch keeps index 0 the coarse category.
  assert.ok(ACTIONS.indexOf('await insertCoverage(') < ACTIONS.indexOf(".update(patch)"));
  assert.match(METER, /by\.length <= caps\.parentCategories && list\.length <= caps\.serviceCardsTotal/);
  assert.doesNotMatch(METER, /parentCategories:\s*\d|serviceCardsTotal:\s*\d/, 'a plan number is typed into the meter');
  // "Add more later…" is said only BEFORE the pick — once picked, the meter says it with the real numbers.
  assert.match(WIZARD, /\{service \|\| coordinating \? null : \(\s*<span className="block text-xs"[^>]*data-open-shop-plan-hint=""/);
  // The lab never ships.
  assert.match(LAB, /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

/* ── errors under their box; the stale build; the sign-in pane ────────────────────────────────────────────────── */

test('no banner at the top — each error is drawn under its box and tied to it', () => {
  assert.doesNotMatch(WIZARD, /\{banner && !taken &&/, 'the top banner is back');
  assert.match(WIZARD, /id=\{`open-shop-err-\$\{field\}`\}/);
  for (const f of ['shop_name', 'contact_name', 'contact_email', 'password']) {
    assert.match(WIZARD, new RegExp(`aria-describedby=\\{describedBy\\('${f}'[,)]`), `${f} is not tied to its error`);
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
  // In place: the panel's ONLY push is to the profile page a `/` sign-in is handed (22 Nov 2026, "start on their
  // profile page" — lib/a-sign-in-starts-on-the-profile-page.test.ts). The open-shop door's `next` is never `/`, so
  // here it still only refreshes.
  assert.deepEqual(PANE.match(/router\.push\([^)]*\)/g) ?? [], ['router.push(landing)']);
});
